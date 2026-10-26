import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { inspectClientId } from '../src/lib/clientId.js'
import {
  appendSheetColumn,
  createSpreadsheet,
  deleteSheetColumn,
  deleteSheetRow,
  explainAuthError,
  explainSheetsError,
  listSpreadsheets,
  normalizeSheetValues,
  clearStoredGoogleSession,
  quoteSheetTitle,
  readSheetTable,
  readStoredGoogleSession,
  sheetRowCell,
  updateSheetRow,
  writeStoredGoogleSession,
} from '../src/lib/googleSheets.js'
import { columnTypeSpec, parseDropdownOptions } from '../src/lib/columnTypes.js'
import { rowMatchesSearch } from '../src/lib/tableSearch.js'
import { columnLetter, createColumn, reorderColumns, validateNewColumnName, validateSpreadsheetForm } from '../src/lib/validation.js'

function form(overrides = {}) {
  const first = createColumn('Date')
  const second = createColumn('Amount')
  return {
    spreadsheetName: 'April expenses',
    sheetName: 'Transactions',
    columns: [first, second],
    ...overrides,
  }
}

describe('validateSpreadsheetForm', () => {
  it('accepts a named spreadsheet, tab, and ordered headers', () => {
    const result = validateSpreadsheetForm(form())
    assert.equal(result.ok, true)
    assert.deepEqual(result.value, {
      title: 'April expenses',
      tab: 'Transactions',
      headers: ['Date', 'Amount'],
    })
  })

  it('trims names and preserves column order', () => {
    const columns = [createColumn('  Vendor '), createColumn(' Notes ')]
    const result = validateSpreadsheetForm(form({ columns, spreadsheetName: '  Ledger  ', sheetName: '  2026  ' }))
    assert.deepEqual(result.value, {
      title: 'Ledger',
      tab: '2026',
      headers: ['Vendor', 'Notes'],
    })
  })

  it('requires a spreadsheet name, tab name, and column name', () => {
    const column = createColumn('   ')
    const result = validateSpreadsheetForm({
      spreadsheetName: '  ',
      sheetName: '',
      columns: [column],
    })
    assert.equal(result.ok, false)
    assert.equal(result.value, null)
    assert.equal(result.errors.spreadsheetName, 'Enter a spreadsheet name.')
    assert.equal(result.errors.sheetName, 'Enter a sheet tab name.')
    assert.equal(result.errors.columnFields[column.id], 'Enter a column name.')
  })

  it('rejects an empty column list', () => {
    const result = validateSpreadsheetForm(form({ columns: [] }))
    assert.equal(result.errors.columns, 'Add at least one column.')
  })

  it('rejects duplicate headers ignoring case', () => {
    const columns = [createColumn('Name'), createColumn(' name ')]
    const result = validateSpreadsheetForm(form({ columns }))
    assert.match(result.errors.columnFields[columns[1].id], /already used in column A/)
  })

  it('rejects sheet tab characters Google does not allow', () => {
    for (const sheetName of ['Q1:Actuals', 'a/b', 'what?', 'sheet*', 'end]', " 'quoted' "]) {
      const result = validateSpreadsheetForm(form({ sheetName }))
      assert.equal(result.ok, false, sheetName)
      assert.ok(result.errors.sheetName)
    }
  })

  it('reorders columns without dropping names', () => {
    const columns = [createColumn('A'), createColumn('B'), createColumn('C')]
    const moved = reorderColumns(columns, 2, 0)
    assert.deepEqual(moved.map((column) => column.name), ['C', 'A', 'B'])
    assert.deepEqual(reorderColumns(columns, 0, 5), columns)
  })

  it('rejects a blank or duplicate column name', () => {
    assert.equal(validateNewColumnName('  ', ['Name']), 'Enter a column name.')
    assert.equal(validateNewColumnName('City', ['Name', 'Country']), '')
    assert.match(validateNewColumnName(' name ', ['Name', 'Country']), /already used in column A/)
  })

  it('builds spreadsheet column letters', () => {
    assert.equal(columnLetter(0), 'A')
    assert.equal(columnLetter(25), 'Z')
    assert.equal(columnLetter(26), 'AA')
  })
})

describe('inspectClientId', () => {
  it('accepts a public web client id', () => {
    const result = inspectClientId('123-abc.apps.googleusercontent.com')
    assert.equal(result.ok, true)
    assert.equal(result.clientId, '123-abc.apps.googleusercontent.com')
  })

  it('rejects secrets and placeholder values', () => {
    assert.equal(inspectClientId('').reason, 'missing')
    assert.equal(inspectClientId('your-client-id.apps.googleusercontent.com').reason, 'missing')
    assert.equal(inspectClientId('GOCSPX-secret').reason, 'secret')
    assert.equal(inspectClientId('not-a-client-id').reason, 'invalid')
  })
})

describe('Google error copy', () => {
  it('explains popup and API failures', () => {
    assert.match(explainAuthError({ type: 'popup_closed' }), /closed/)
    assert.match(explainAuthError({ type: 'popup_failed_to_open' }), /blocked/)
    assert.match(
      explainSheetsError({
        status: 403,
        result: { error: { code: 403, message: 'Sheets API has not been used in project 1 before or it is disabled.' } },
      }),
      /Google Sheets API is not enabled/,
    )
    assert.match(
      explainSheetsError({
        status: 403,
        result: { error: { code: 403, message: 'Google Drive API has not been used in project 1 before or it is disabled.' } },
      }),
      /Google Drive API is not enabled/,
    )
  })
})

function memoryStorage() {
  const items = new Map()
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

describe('column types', () => {
  it('builds number, date, dropdown, and email rules', () => {
    const number = columnTypeSpec('number')
    assert.equal(number.ok, true)
    assert.equal(number.numberFormat.type, 'NUMBER')
    assert.equal(number.validation, null)

    const date = columnTypeSpec('date')
    assert.equal(date.numberFormat.type, 'DATE')
    assert.equal(date.validation.condition.type, 'DATE_IS_VALID')

    const email = columnTypeSpec('email')
    assert.equal(email.validation.condition.type, 'TEXT_IS_EMAIL')

    const dropdown = columnTypeSpec('dropdown', 'Yes, no\nMaybe, yes')
    assert.deepEqual(dropdown.options, ['Yes', 'no', 'Maybe'])
    assert.equal(dropdown.validation.condition.type, 'ONE_OF_LIST')
    assert.equal(dropdown.validation.showCustomUi, true)

    assert.equal(columnTypeSpec('dropdown', ' , ').ok, false)
    assert.equal(columnTypeSpec('made-up').ok, false)
    assert.deepEqual(parseDropdownOptions('A, A, b'), ['A', 'b'])
  })
})

describe('sheet search', () => {
  it('matches a value in any column and keeps every row when the search is empty', () => {
    const rows = [
      ['Name', 'Country'],
      ['Saloni', 'India'],
      ['Asha', 'Spain'],
    ]
    assert.equal(rowMatchesSearch(rows[0], 'country'), true)
    assert.equal(rowMatchesSearch(rows[1], 'india'), true)
    assert.equal(rowMatchesSearch(rows[1], 'asha'), false)
    assert.equal(rowMatchesSearch(rows[2], '  '), true)
    assert.deepEqual(
      rows.filter((cells) => rowMatchesSearch(cells, 'a')),
      [
        ['Name', 'Country'],
        ['Saloni', 'India'],
        ['Asha', 'Spain'],
      ],
    )
  })
})

describe('stored Google session', () => {
  it('keeps a signed-in account until it expires or is cleared', () => {
    const storage = memoryStorage()
    const now = Date.parse('2026-10-26T07:00:00Z')
    writeStoredGoogleSession(
      {
        accessToken: 'token-1',
        expiresAt: now + 30 * 60 * 1000,
        email: 'person@example.com',
        name: 'Person',
        picture: '',
      },
      storage,
    )

    const stored = readStoredGoogleSession(storage, now)
    assert.equal(stored.usable, true)
    assert.equal(stored.email, 'person@example.com')
    assert.equal(stored.accessToken, 'token-1')

    const expired = readStoredGoogleSession(storage, now + 40 * 60 * 1000)
    assert.equal(expired.usable, false)

    clearStoredGoogleSession(storage)
    assert.equal(readStoredGoogleSession(storage, now), null)
    assert.equal(readStoredGoogleSession(memoryStorage(), now), null)
  })
})

describe('sheet tables', () => {
  it('quotes tab names and keeps apostrophes', () => {
    assert.equal(quoteSheetTitle('Transactions'), "'Transactions'")
    assert.equal(quoteSheetTitle("Q1's"), "'Q1''s'")
  })

  it('pads short rows and numbers them from the sheet', () => {
    const table = normalizeSheetValues([['Date', 'Amount'], ['May', 12], ['June']])
    assert.equal(table.columnCount, 2)
    assert.equal(table.rows[0].sheetRow, 1)
    assert.deepEqual(table.rows[1].cells, ['May', '12'])
    assert.deepEqual(table.rows[2].cells, ['June', ''])
    assert.deepEqual(normalizeSheetValues([]), { columnCount: 1, rows: [] })
    assert.deepEqual(normalizeSheetValues(undefined), { columnCount: 1, rows: [] })
  })

  it('keeps data rows plain and header rows green', () => {
    const data = sheetRowCell('Saloni', 'body')
    const header = sheetRowCell('Name', 'header')
    assert.equal(data.userEnteredFormat.textFormat.bold, false)
    assert.equal(data.userEnteredFormat.backgroundColor.red, 1)
    assert.equal(data.userEnteredFormat.backgroundColor.green, 1)
    assert.equal(header.userEnteredFormat.textFormat.bold, true)
    assert.notDeepEqual(data.userEnteredFormat.backgroundColor, header.userEnteredFormat.backgroundColor)
    assert.equal(data.userEnteredValue.stringValue, 'Saloni')
  })

  it('rejects a missing row before calling Google', async () => {
    await assert.rejects(() => appendSheetColumn('sheet', 0, 1, '  '), /Enter a column name/)
    await assert.rejects(() => updateSheetRow('sheet', 1, 0, ['A']), /Choose a row to update/)
    await assert.rejects(() => deleteSheetRow('sheet', 0, 0), /Choose a row to delete/)
    await assert.rejects(() => deleteSheetColumn('sheet', 0, -1), /Choose a column to delete/)
  })
})

describe('createSpreadsheet', () => {
  const previousWindow = globalThis.window

  afterEach(() => {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  })

  it('does not invent a spreadsheet when Google is not signed in', async () => {
    globalThis.window = { gapi: { client: { getToken: () => null } } }
    await assert.rejects(
      () => createSpreadsheet({ title: 'Ledger', tab: 'Data', headers: ['Date'] }),
      /Sign in with Google/,
    )
  })

  it('does not list or read sheets when Google is not signed in', async () => {
    globalThis.window = { gapi: { client: { getToken: () => null } } }
    await assert.rejects(() => listSpreadsheets(), /Sign in with Google/)
    await assert.rejects(() => readSheetTable('sheet', 'Tab'), /Sign in with Google/)
  })
})
