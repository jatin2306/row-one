import { inspectClientId } from './clientId.js'
import { columnTypeSpec } from './columnTypes.js'

/**
 * Browser-only Google sign-in, Drive file listing, and Sheets API calls.
 * Uses Google Identity Services and the Google API JavaScript client.
 * The OAuth client ID is public. This module never reads a client secret.
 * A successful sign-in is kept in sessionStorage for this tab so a refresh
 * stays connected. Sign out removes it. No client secret or refresh token is stored.
 */

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
export const DRIVE_METADATA_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly'
const SCOPES = [
  SHEETS_SCOPE,
  DRIVE_METADATA_SCOPE,
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

const GSI_SRC = 'https://accounts.google.com/gsi/client'
const GAPI_SRC = 'https://apis.google.com/js/api.js'
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4'
const HEADER_GREEN = { red: 20 / 255, green: 108 / 255, blue: 67 / 255 }
const HEADER_INK = { red: 1, green: 1, blue: 1 }
const BODY_PAPER = { red: 1, green: 1, blue: 1 }
const BODY_INK = { red: 34 / 255, green: 30 / 255, blue: 26 / 255 }

const SESSION_KEY = 'row-one.google-session'
const SESSION_SKEW_MS = 60_000

let initPromise = null
let tokenClient = null
let pendingAuth = null

function storageArea(storage) {
  if (storage !== undefined) return storage
  return globalThis.sessionStorage
}

export function writeStoredGoogleSession(session, storage) {
  const area = storageArea(storage)
  if (!area || !session?.accessToken || !Number.isFinite(session.expiresAt)) return
  try {
    area.setItem(
      SESSION_KEY,
      JSON.stringify({
        accessToken: String(session.accessToken),
        expiresAt: session.expiresAt,
        email: session.email || '',
        name: session.name || '',
        picture: session.picture || '',
      }),
    )
  } catch {
    // The tab can still use the in-memory token when storage is blocked.
  }
}

export function readStoredGoogleSession(storage, now = Date.now()) {
  const area = storageArea(storage)
  if (!area) return null
  try {
    const raw = area.getItem(SESSION_KEY)
    if (!raw) return null
    const record = JSON.parse(raw)
    if (!record || typeof record.accessToken !== 'string' || record.accessToken.length === 0) return null
    const expiresAt = Number(record.expiresAt)
    if (!Number.isFinite(expiresAt)) return null
    return {
      accessToken: record.accessToken,
      expiresAt,
      email: typeof record.email === 'string' ? record.email : '',
      name: typeof record.name === 'string' ? record.name : '',
      picture: typeof record.picture === 'string' ? record.picture : '',
      usable: expiresAt >= now + SESSION_SKEW_MS,
    }
  } catch {
    return null
  }
}

export function clearStoredGoogleSession(storage) {
  try {
    storageArea(storage)?.removeItem(SESSION_KEY)
  } catch {
    // Ignore storage failures. Sign-out still clears the in-memory token.
  }
}

export function restoreStoredSession() {
  const stored = readStoredGoogleSession()
  if (!stored) return null
  if (!stored.usable) return { expired: true }
  const client = globalThis.window?.gapi?.client
  if (!client?.setToken) return { expired: true }
  client.setToken({ access_token: stored.accessToken })
  return {
    expired: false,
    expiresAt: stored.expiresAt,
    email: stored.email,
    name: stored.name,
    picture: stored.picture,
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing?.dataset.loaded === 'true') {
      resolve()
      return
    }
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Could not load ${src}.`)), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => {
      reject(new Error('Could not load Google’s sign-in libraries. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
}

export function explainAuthError(error) {
  const type = error?.type
  const code = error?.error || ''

  if (type === 'popup_failed_to_open') {
    return 'The Google sign-in window was blocked. Allow popups for this site and try again.'
  }
  if (type === 'popup_closed') {
    return 'The Google window closed before sign-in finished.'
  }
  if (code === 'access_denied') {
    return 'Google sign-in was cancelled before spreadsheet access was granted.'
  }
  if (code === 'invalid_scope' || (typeof code === 'string' && /invalid_scope/i.test(code))) {
    return 'Google rejected a permission this app asks for. Enable the Google Drive API, add the Drive metadata scope on the consent screen, and sign in again.'
  }
  if (typeof code === 'string' && /origin|redirect_uri/i.test(code)) {
    return 'This site is not an authorized JavaScript origin for your OAuth client. Add http://localhost:5173 in Google Cloud, then try again.'
  }
  if (error?.message) return error.message
  return 'Google sign-in failed.'
}

export function readGoogleError(error) {
  let apiError = error?.result?.error
  if (!apiError && typeof error?.body === 'string') {
    try {
      apiError = JSON.parse(error.body).error
    } catch {
      apiError = null
    }
  }

  return {
    status: error?.status || apiError?.code || 0,
    message: apiError?.message || error?.message || '',
  }
}

export function explainSheetsError(error) {
  const { status, message } = readGoogleError(error)
  const detail = message.toLowerCase()

  if (status === 401 || detail.includes('invalid authentication') || detail.includes('login required')) {
    return 'Your Google session expired. Sign in again, then try again.'
  }

  if (
    status === 403 &&
    (detail.includes('has not been used') ||
      detail.includes('is disabled') ||
      detail.includes('access not configured') ||
      detail.includes('service_disabled'))
  ) {
    const apiName = detail.includes('drive') ? 'Google Drive API' : 'Google Sheets API'
    return `The ${apiName} is not enabled for this Cloud project. Enable it, wait a minute, and try again.`
  }

  if (status === 403 && (detail.includes('insufficient') || detail.includes('scope'))) {
    return 'Google did not grant permission to use your spreadsheets. Sign out, sign in again, and allow Sheets and Drive access.'
  }

  if (status === 403) {
    const reason = message || 'Google refused this request.'
    return `${reason} Confirm the Sheets API is enabled and that your account is a test user on the OAuth consent screen.`
  }

  return message || 'The Google Sheets request failed.'
}

function rejectPending(error) {
  const pending = pendingAuth
  pendingAuth = null
  pending?.reject(error)
}

function resolvePending(value) {
  const pending = pendingAuth
  pendingAuth = null
  pending?.resolve(value)
}

async function fetchUserProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return null
  const profile = await response.json()
  return {
    email: profile.email || '',
    name: profile.name || '',
    picture: profile.picture || '',
  }
}

function onTokenResponse(response) {
  if (!pendingAuth) return

  if (response.error) {
    rejectPending(new Error(explainAuthError(response)))
    return
  }

  const granted = new Set(String(response.scope || '').split(/\s+/).filter(Boolean))
  if (!granted.has(SHEETS_SCOPE) || !granted.has(DRIVE_METADATA_SCOPE)) {
    if (response.access_token) {
      window.google.accounts.oauth2.revoke(response.access_token, () => {})
    }
    rejectPending(
      new Error('Google did not grant permission to see and edit your spreadsheets. Sign in again and allow Sheets and Drive access.'),
    )
    return
  }

  window.gapi.client.setToken({ access_token: response.access_token })
  const expiresAt = Date.now() + Number(response.expires_in || 3600) * 1000
  const accessToken = response.access_token
  writeStoredGoogleSession({ accessToken, expiresAt, email: '', name: '', picture: '' })

  fetchUserProfile(accessToken)
    .catch(() => null)
    .then((profile) => {
      const session = {
        expiresAt,
        email: profile?.email || '',
        name: profile?.name || '',
        picture: profile?.picture || '',
      }
      writeStoredGoogleSession({ ...session, accessToken })
      resolvePending(session)
    })
}

async function loadGoogle(clientId) {
  await Promise.all([loadScript(GSI_SRC), loadScript(GAPI_SRC)])
  await new Promise((resolve, reject) => {
    window.gapi.load('client', {
      callback: resolve,
      onerror: () => reject(new Error('The Google API client failed to load.')),
    })
  })
  await window.gapi.client.init({
    discoveryDocs: [DISCOVERY_DOC],
  })
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: () => {},
    error_callback: (error) => {
      rejectPending(new Error(explainAuthError(error)))
    },
  })
}

export function initGoogleClient(clientId) {
  return Promise.resolve().then(() => {
    const inspected = inspectClientId(clientId)
    if (!inspected.ok) {
      throw new Error('A public Web client ID is required before signing in.')
    }
    if (!initPromise) {
      initPromise = loadGoogle(inspected.clientId).catch((error) => {
        initPromise = null
        tokenClient = null
        throw error
      })
    }
    return initPromise
  })
}

export function requestGoogleAccess(prompt) {
  if (!tokenClient) {
    return Promise.reject(new Error('Google sign-in is not ready yet.'))
  }

  return new Promise((resolve, reject) => {
    pendingAuth = { resolve, reject }
    tokenClient.callback = onTokenResponse
    try {
      tokenClient.requestAccessToken({ prompt })
    } catch (error) {
      rejectPending(error instanceof Error ? error : new Error('Google sign-in failed.'))
    }
  })
}

export function signOutGoogle() {
  clearStoredGoogleSession()
  const token = globalThis.window?.gapi?.client?.getToken?.()
  globalThis.window?.gapi?.client?.setToken?.(null)
  if (token?.access_token && globalThis.window?.google?.accounts?.oauth2?.revoke) {
    globalThis.window.google.accounts.oauth2.revoke(token.access_token, () => {})
  }
}

export function sheetRowCell(value, role) {
  const header = role === 'header'
  return {
    userEnteredValue: { stringValue: value == null ? '' : String(value) },
    userEnteredFormat: {
      backgroundColor: header ? HEADER_GREEN : BODY_PAPER,
      horizontalAlignment: 'LEFT',
      verticalAlignment: 'MIDDLE',
      wrapStrategy: 'OVERFLOW_CELL',
      textFormat: {
        bold: header,
        fontSize: 11,
        foregroundColor: header ? HEADER_INK : BODY_INK,
      },
    },
  }
}

function headerCell(value) {
  return sheetRowCell(value, 'header')
}

export async function createSpreadsheet({ title, tab, headers }) {
  if (!title || !tab || !Array.isArray(headers) || headers.length === 0) {
    throw new Error('Spreadsheet name, tab name, and at least one column are required.')
  }

  const sheetsClient = globalThis.window?.gapi?.client?.sheets?.spreadsheets
  const token = globalThis.window?.gapi?.client?.getToken?.()
  if (!token?.access_token) {
    const error = new Error('Sign in with Google before creating a spreadsheet.')
    error.status = 401
    throw error
  }
  if (!sheetsClient?.create) {
    throw new Error('The Google Sheets client is not ready. Reload the page and sign in again.')
  }

  const body = {
    properties: { title },
    sheets: [
      {
        properties: {
          title: tab,
          gridProperties: {
            frozenRowCount: 1,
            rowCount: 1000,
            columnCount: Math.max(headers.length, 26),
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [{ values: headers.map(headerCell) }],
            columnMetadata: headers.map((header) => ({
              pixelSize: Math.min(320, Math.max(128, header.length * 10 + 48)),
            })),
          },
        ],
      },
    ],
  }

  try {
    const response = await sheetsClient.create(body)
    const created = response?.result ?? response
    const spreadsheetId = created?.spreadsheetId
    if (!spreadsheetId) {
      throw new Error('Google did not return the new spreadsheet.')
    }

    return {
      spreadsheetId,
      spreadsheetUrl: created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      title: created.properties?.title || title,
      tab: created.sheets?.[0]?.properties?.title || tab,
      columnCount: headers.length,
    }
  } catch (error) {
    rethrowSheets(error)
  }
}

function requireAccess() {
  const client = globalThis.window?.gapi?.client
  const token = client?.getToken?.()
  if (!token?.access_token) {
    const error = new Error('Sign in with Google before using spreadsheets.')
    error.status = 401
    throw error
  }
  return client
}

function rethrowSheets(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    throw new Error('Google took too long to respond. Try again.')
  }
  if (error instanceof Error && !error.result && !error.body) throw error
  const explained = new Error(explainSheetsError(error))
  explained.status = readGoogleError(error).status || error?.status || 0
  throw explained
}

export function quoteSheetTitle(title) {
  return `'${String(title).replaceAll("'", "''")}'`
}

export function normalizeSheetValues(values) {
  const source = Array.isArray(values) ? values : []
  const width = source.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0)
  const columnCount = Math.max(width, 1)
  return {
    columnCount,
    rows: source.map((row, index) => ({
      sheetRow: index + 1,
      cells: Array.from({ length: columnCount }, (_, column) => {
        const value = Array.isArray(row) ? row[column] : ''
        return value == null ? '' : String(value)
      }),
    })),
  }
}

export async function listSpreadsheets({ pageToken } = {}) {
  const client = requireAccess()
  const params = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'nextPageToken,files(id,name,modifiedTime,webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: '40',
    spaces: 'drive',
  })
  if (pageToken) params.set('pageToken', pageToken)

  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${client.getToken().access_token}` },
      signal: AbortSignal.timeout(20000),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(body?.error?.message || 'Could not list spreadsheets.')
      error.status = response.status
      error.result = { error: { code: response.status, message: body?.error?.message || '' } }
      throw error
    }

    return {
      files: (body.files || []).map((file) => ({
        id: file.id,
        name: file.name || 'Untitled spreadsheet',
        modifiedTime: file.modifiedTime || '',
        url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
      })),
      nextPageToken: body.nextPageToken || '',
    }
  } catch (error) {
    rethrowSheets(error)
  }
}

export async function getSpreadsheet(spreadsheetId) {
  if (!spreadsheetId) throw new Error('Choose a spreadsheet first.')
  const client = requireAccess()
  const sheets = client.sheets?.spreadsheets
  if (!sheets?.get) {
    throw new Error('The Google Sheets client is not ready. Reload the page and sign in again.')
  }

  try {
    const response = await sheets.get({
      spreadsheetId,
      fields: 'spreadsheetId,spreadsheetUrl,properties.title,sheets.properties',
    })
    const result = response?.result ?? response
    const tabs = (result.sheets || [])
      .map((sheet) => sheet.properties)
      .filter((properties) => properties && Number.isInteger(properties.sheetId) && properties.title)
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
      .map((properties) => ({
        sheetId: properties.sheetId,
        title: properties.title,
        rowCount: properties.gridProperties?.rowCount || 1000,
      }))

    return {
      spreadsheetId: result.spreadsheetId || spreadsheetId,
      title: result.properties?.title || 'Untitled spreadsheet',
      url: result.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      tabs,
    }
  } catch (error) {
    rethrowSheets(error)
  }
}

export async function readSheetTable(spreadsheetId, sheetTitle) {
  if (!spreadsheetId || !sheetTitle) throw new Error('Choose a spreadsheet tab first.')
  const client = requireAccess()
  const valuesApi = client.sheets?.spreadsheets?.values
  if (!valuesApi?.get) {
    throw new Error('The Google Sheets client is not ready. Reload the page and sign in again.')
  }

  try {
    const response = await valuesApi.get({
      spreadsheetId,
      range: quoteSheetTitle(sheetTitle),
      majorDimension: 'ROWS',
      valueRenderOption: 'FORMATTED_VALUE',
    })
    const result = response?.result ?? response
    return normalizeSheetValues(result.values)
  } catch (error) {
    rethrowSheets(error)
  }
}

const PLAIN_FORMAT_FIELDS =
  'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)'

function plainFormat() {
  const format = sheetRowCell('', 'body').userEnteredFormat
  return {
    backgroundColor: format.backgroundColor,
    horizontalAlignment: format.horizontalAlignment,
    verticalAlignment: format.verticalAlignment,
    wrapStrategy: format.wrapStrategy,
    textFormat: format.textFormat,
  }
}

async function writeSheetRow(spreadsheetId, sheetId, sheetTitle, sheetRow, cells, role) {
  if (!spreadsheetId) throw new Error('Choose a spreadsheet first.')
  if (!Number.isInteger(sheetId) || sheetId < 0) throw new Error('Choose a spreadsheet tab first.')
  if (!Number.isInteger(sheetRow) || sheetRow < 1) throw new Error('Choose a row to update.')
  if (!Array.isArray(cells) || cells.length === 0) throw new Error('Enter at least one cell.')
  const client = requireAccess()
  const sheets = client.sheets?.spreadsheets
  if (!sheets?.batchUpdate) {
    throw new Error('The Google Sheets client is not ready. Reload the page and sign in again.')
  }

  const rowRange = {
    sheetId,
    startRowIndex: sheetRow - 1,
    endRowIndex: sheetRow,
    startColumnIndex: 0,
    endColumnIndex: cells.length,
  }

  try {
    if (role === 'body') {
      if (!sheetTitle) throw new Error('Choose a spreadsheet tab first.')
      const valuesApi = sheets.values
      if (!valuesApi?.update) {
        throw new Error('The Google Sheets client is not ready. Reload the page and sign in again.')
      }
      await valuesApi.update({
        spreadsheetId,
        range: `${quoteSheetTitle(sheetTitle)}!A${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [cells.map((cell) => (cell == null ? '' : String(cell)))] },
      })
      await sheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            {
              repeatCell: {
                range: rowRange,
                cell: { userEnteredFormat: plainFormat() },
                fields: PLAIN_FORMAT_FIELDS,
              },
            },
          ],
        },
      })
      return
    }

    await sheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            updateCells: {
              range: rowRange,
              rows: [{ values: cells.map((cell) => sheetRowCell(cell, 'header')) }],
              fields: 'userEnteredValue,userEnteredFormat',
            },
          },
        ],
      },
    })
  } catch (error) {
    rethrowSheets(error)
  }
}

export async function appendSheetColumn(spreadsheetId, sheetId, columnIndex, headerName, columnType, rowCount = 1000) {
  const name = String(headerName ?? '').trim()
  if (!name) throw new Error('Enter a column name.')
  const spec = columnTypeSpec(columnType?.typeId || 'text', columnType?.optionsText || '')
  if (!spec.ok) throw new Error(spec.error)
  if (!spreadsheetId) throw new Error('Choose a spreadsheet first.')
  if (!Number.isInteger(sheetId) || sheetId < 0) throw new Error('Choose a spreadsheet tab first.')
  if (!Number.isInteger(columnIndex) || columnIndex < 0) throw new Error('Choose where to add the column.')
  const client = requireAccess()
  const sheets = client.sheets?.spreadsheets
  if (!sheets?.batchUpdate) {
    throw new Error('The Google Sheets client is not ready. Reload the page and sign in again.')
  }

  const requests = []
  if (columnIndex > 0) {
    requests.push({
      insertDimension: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: columnIndex,
          endIndex: columnIndex + 1,
        },
        inheritFromBefore: false,
      },
    })
  }
  requests.push({
    updateCells: {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: columnIndex,
        endColumnIndex: columnIndex + 1,
      },
      rows: [{ values: [sheetRowCell(name, 'header')] }],
      fields: 'userEnteredValue,userEnteredFormat',
    },
  })

  const endRow = Math.max(Number(rowCount) || 1000, 2)
  const valueRange = {
    sheetId,
    startRowIndex: 1,
    endRowIndex: endRow,
    startColumnIndex: columnIndex,
    endColumnIndex: columnIndex + 1,
  }
  if (spec.numberFormat) {
    requests.push({
      repeatCell: {
        range: valueRange,
        cell: {
          userEnteredFormat: {
            ...plainFormat(),
            numberFormat: spec.numberFormat,
          },
        },
        fields: 'userEnteredFormat(numberFormat,backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
      },
    })
  } else if (spec.id === 'checkbox') {
    requests.push({
      repeatCell: {
        range: valueRange,
        cell: { userEnteredFormat: plainFormat() },
        fields: PLAIN_FORMAT_FIELDS,
      },
    })
  }
  if (spec.validation) {
    requests.push({
      setDataValidation: {
        range: valueRange,
        rule: spec.validation,
      },
    })
  }

  try {
    await sheets.batchUpdate({
      spreadsheetId,
      resource: { requests },
    })
  } catch (error) {
    rethrowSheets(error)
  }
}

export async function appendSheetRow(spreadsheetId, sheetId, sheetTitle, sheetRow, cells) {
  if (!Number.isInteger(sheetRow) || sheetRow < 1) throw new Error('Choose a row to add.')
  await writeSheetRow(spreadsheetId, sheetId, sheetTitle, sheetRow, cells, 'body')
}

export async function updateSheetRow(spreadsheetId, sheetId, sheetTitle, sheetRow, cells) {
  if (!Number.isInteger(sheetRow) || sheetRow < 1) throw new Error('Choose a row to update.')
  await writeSheetRow(spreadsheetId, sheetId, sheetTitle, sheetRow, cells, sheetRow === 1 ? 'header' : 'body')
}

export async function plainDataRows(spreadsheetId, sheetId, rowCount, columnCount) {
  if (!spreadsheetId) throw new Error('Choose a spreadsheet first.')
  if (!Number.isInteger(sheetId) || sheetId < 0) throw new Error('Choose a spreadsheet tab first.')
  if (!Number.isInteger(rowCount) || rowCount < 2) return
  if (!Number.isInteger(columnCount) || columnCount < 1) return
  const client = requireAccess()
  const sheets = client.sheets?.spreadsheets
  if (!sheets?.batchUpdate) {
    throw new Error('The Google Sheets client is not ready. Reload the page and sign in again.')
  }

  try {
    await sheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: rowCount,
                startColumnIndex: 0,
                endColumnIndex: columnCount,
              },
              cell: { userEnteredFormat: sheetRowCell('', 'body').userEnteredFormat },
              fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
            },
          },
        ],
      },
    })
  } catch (error) {
    rethrowSheets(error)
  }
}

async function deleteDimension(spreadsheetId, sheetId, dimension, startIndex, endIndex, missingMessage) {
  if (!spreadsheetId) throw new Error('Choose a spreadsheet first.')
  if (!Number.isInteger(sheetId) || sheetId < 0) throw new Error('Choose a spreadsheet tab first.')
  if (!Number.isInteger(startIndex) || startIndex < 0 || endIndex <= startIndex) {
    throw new Error(missingMessage)
  }
  const client = requireAccess()
  const sheets = client.sheets?.spreadsheets
  if (!sheets?.batchUpdate) {
    throw new Error('The Google Sheets client is not ready. Reload the page and sign in again.')
  }

  try {
    await sheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension,
                startIndex,
                endIndex,
              },
            },
          },
        ],
      },
    })
  } catch (error) {
    rethrowSheets(error)
  }
}

export async function deleteSheetRow(spreadsheetId, sheetId, sheetRow) {
  if (!Number.isInteger(sheetRow) || sheetRow < 1) throw new Error('Choose a row to delete.')
  await deleteDimension(spreadsheetId, sheetId, 'ROWS', sheetRow - 1, sheetRow, 'Choose a row to delete.')
}

export async function deleteSheetColumn(spreadsheetId, sheetId, columnIndex) {
  if (!Number.isInteger(columnIndex) || columnIndex < 0) throw new Error('Choose a column to delete.')
  await deleteDimension(
    spreadsheetId,
    sheetId,
    'COLUMNS',
    columnIndex,
    columnIndex + 1,
    'Choose a column to delete.',
  )
}
