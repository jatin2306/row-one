import { useEffect, useMemo, useRef, useState } from 'react'
import { AccountChip, SignInButton } from './components/SignInButton.jsx'
import { ColumnBuilder } from './components/ColumnBuilder.jsx'
import { HeaderPreview } from './components/HeaderPreview.jsx'
import { ResultPanel } from './components/ResultPanel.jsx'
import { SpreadsheetManager } from './components/SpreadsheetManager.jsx'
import { clientIdMessage, inspectClientId } from './lib/clientId.js'
import {
  clearStoredGoogleSession,
  createSpreadsheet,
  initGoogleClient,
  readStoredGoogleSession,
  requestGoogleAccess,
  restoreStoredSession,
  signOutGoogle,
} from './lib/googleSheets.js'
import { LIMITS, createColumn, validateSpreadsheetForm } from './lib/validation.js'

const inputClass =
  'mt-2 w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-mute/70 focus:ring-4 focus:ring-moss/15 disabled:cursor-not-allowed disabled:bg-paper/80'

function shownMessage(message, key, submitted, touched) {
  if (!message) return ''
  if (message.startsWith('Enter ') && !submitted && !touched[key]) return ''
  return message
}

function focusFirstInvalid(errors, columns) {
  if (errors.spreadsheetName) {
    document.getElementById('spreadsheet-name')?.focus()
    return
  }
  if (errors.sheetName) {
    document.getElementById('sheet-name')?.focus()
    return
  }
  const column = columns.find((item) => errors.columnFields?.[item.id])
  if (column) document.getElementById(`column-${column.id}`)?.focus()
}

export default function App() {
  const client = useMemo(() => inspectClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID), [])
  const [hadStoredAccount] = useState(() => Boolean(readStoredGoogleSession()))
  const [library, setLibrary] = useState({ status: client.ok ? 'loading' : 'idle', message: '' })
  const [attempt, setAttempt] = useState(0)
  const [session, setSession] = useState(null)
  const [signingIn, setSigningIn] = useState(false)
  const [authError, setAuthError] = useState('')
  const [spreadsheetName, setSpreadsheetName] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [columns, setColumns] = useState(() => [createColumn()])
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const [result, setResult] = useState(null)
  const [screen, setScreen] = useState('list')
  const [openRequest, setOpenRequest] = useState(null)
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    if (!client.ok) return undefined
    let cancelled = false
    initGoogleClient(client.clientId)
      .then(async () => {
        if (cancelled) return
        const restored = restoreStoredSession()
        if (restored && !restored.expired) {
          const nextSession = {
            expiresAt: restored.expiresAt,
            email: restored.email,
            name: restored.name,
            picture: restored.picture,
          }
          sessionRef.current = nextSession
          setSession(nextSession)
        } else if (restored?.expired) {
          try {
            const nextSession = await requestGoogleAccess('')
            if (cancelled) return
            sessionRef.current = nextSession
            setSession(nextSession)
          } catch {
            if (!cancelled) clearStoredGoogleSession()
          }
        }
        if (!cancelled) setLibrary({ status: 'ready', message: '' })
      })
      .catch((error) => {
        if (!cancelled) {
          setLibrary({
            status: 'error',
            message: error?.message || 'Google’s libraries could not be loaded.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [client, attempt])

  const validation = useMemo(
    () => validateSpreadsheetForm({ spreadsheetName, sheetName, columns }),
    [spreadsheetName, sheetName, columns],
  )

  const columnErrors = {}
  for (const column of columns) {
    const message = shownMessage(validation.errors.columnFields?.[column.id], column.id, submitted, touched)
    if (message) columnErrors[column.id] = message
  }

  const spreadsheetError = shownMessage(validation.errors.spreadsheetName, 'spreadsheetName', submitted, touched)
  const sheetError = shownMessage(validation.errors.sheetName, 'sheetName', submitted, touched)
  const columnsError =
    validation.errors.columns && (submitted || columns.length > LIMITS.columns) ? validation.errors.columns : ''

  function markTouched(key) {
    setTouched((current) => (current[key] ? current : { ...current, [key]: true }))
  }

  async function handleSignIn() {
    setAuthError('')
    setSigningIn(true)
    try {
      const nextSession = await requestGoogleAccess('select_account consent')
      sessionRef.current = nextSession
      setSession(nextSession)
      setOpenRequest(null)
    } catch (error) {
      setAuthError(error?.message || 'Google sign-in failed.')
    } finally {
      setSigningIn(false)
    }
  }

  function handleSignOut() {
    signOutGoogle()
    sessionRef.current = null
    setSession(null)
    setAuthError('')
    setOpenRequest(null)
  }

  async function runGoogle(action) {
    let active = sessionRef.current
    if (!active) {
      const error = new Error('Sign in with Google before using spreadsheets.')
      error.status = 401
      throw error
    }
    if (active.expiresAt < Date.now() + 60_000) {
      active = await requestGoogleAccess('')
      sessionRef.current = active
      setSession(active)
    }
    try {
      return await action()
    } catch (error) {
      if (error?.status === 401) {
        signOutGoogle()
        sessionRef.current = null
        setSession(null)
      }
      throw error
    }
  }

  async function handleCreate(event) {
    event.preventDefault()
    if (creating) return
    setSubmitted(true)

    const nextValidation = validateSpreadsheetForm({ spreadsheetName, sheetName, columns })
    if (!nextValidation.ok) {
      setFormError('')
      focusFirstInvalid(nextValidation.errors, columns)
      return
    }

    if (!client.ok) {
      setFormError(clientIdMessage(client.reason))
      return
    }
    if (library.status !== 'ready') {
      setFormError(library.message || 'Google sign-in is still loading. Try again in a moment.')
      return
    }
    if (!session) {
      setFormError('Sign in with Google before creating a spreadsheet.')
      return
    }

    setCreating(true)
    setFormError('')
    try {
      let activeSession = session
      if (activeSession.expiresAt < Date.now() + 60_000) {
        activeSession = await requestGoogleAccess('')
        sessionRef.current = activeSession
        setSession(activeSession)
      }
      const created = await createSpreadsheet(nextValidation.value)
      setResult(created)
    } catch (error) {
      setFormError(error?.message || 'Could not create the spreadsheet.')
      if (error?.status === 401) {
        signOutGoogle()
        sessionRef.current = null
        setSession(null)
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-6 border-b border-line/80 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-semibold tracking-[0.22em] text-moss">GOOGLE SHEETS</p>
          <h1 className="mt-2 font-serif text-5xl tracking-tight sm:text-6xl">Row One</h1>
          <p className="mt-3 text-base leading-7 text-mute">
            See every spreadsheet in your Google account, open a table, and add, edit, or delete any row. You can also create a new file with headers in row 1.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {session ? (
            <AccountChip session={session} onSignOut={handleSignOut} disabled={creating} />
          ) : (
            <SignInButton
              onClick={handleSignIn}
              busy={signingIn}
              disabled={!client.ok || library.status !== 'ready' || creating}
            />
          )}
          {!session && library.status === 'loading' ? (
            <p className="text-sm text-mute">
              {hadStoredAccount ? 'Restoring your Google account…' : 'Loading Google sign-in…'}
            </p>
          ) : null}
          {library.status === 'error' ? (
            <div className="max-w-sm text-sm">
              <p role="alert" className="text-clay">
                {library.message}
              </p>
              <button
                type="button"
                onClick={() => {
                  setLibrary({ status: 'loading', message: '' })
                  setAttempt((value) => value + 1)
                }}
                className="mt-2 font-semibold text-moss underline"
              >
                Try again
              </button>
            </div>
          ) : null}
          {authError ? (
            <p role="alert" className="max-w-sm text-sm text-clay">
              {authError}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Sections">
        <button
          type="button"
          aria-pressed={screen === 'list'}
          onClick={() => setScreen('list')}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${screen === 'list' ? 'bg-ink text-white' : 'border border-line bg-card text-ink hover:border-moss/40'}`}
        >
          Your spreadsheets
        </button>
        <button
          type="button"
          aria-pressed={screen === 'create'}
          onClick={() => setScreen('create')}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${screen === 'create' ? 'bg-ink text-white' : 'border border-line bg-card text-ink hover:border-moss/40'}`}
        >
          Create spreadsheet
        </button>
      </div>

      <main>
      <div className={screen === 'list' ? 'mt-6' : 'hidden'}>
        {session ? (
          <SpreadsheetManager
            key={session.email || session.name || 'account'}
            runGoogle={runGoogle}
            openRequest={openRequest}
          />
        ) : (
          <section className="rounded-3xl border border-line bg-card px-5 py-10 shadow-[0_24px_50px_-40px_rgba(50,35,15,0.8)] sm:px-8">
            <h2 className="font-serif text-4xl tracking-tight">Your spreadsheets</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-mute">
              Sign in with Google to list the spreadsheets in that account. From a table you can add a row, edit any row, or delete any row.
            </p>
          </section>
        )}
      </div>

      <div className={screen === 'create' ? 'mt-6 grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]' : 'hidden'}>
        <form onSubmit={handleCreate} noValidate className="min-w-0 space-y-6 rounded-3xl border border-line bg-card p-5 shadow-[0_24px_50px_-40px_rgba(50,35,15,0.8)] sm:p-6">
          {result ? (
            <ResultPanel
              key={result.spreadsheetId}
              result={result}
              onView={() => {
                setOpenRequest({
                  id: result.spreadsheetId,
                  name: result.title,
                  url: result.spreadsheetUrl,
                  nonce: Date.now(),
                })
                setScreen('list')
              }}
            />
          ) : null}

          <div>
            <label htmlFor="spreadsheet-name" className="text-sm font-semibold">
              Spreadsheet name
            </label>
            <p id="spreadsheet-name-hint" className="mt-1 text-sm text-mute">
              This becomes the file name in Google Drive.
            </p>
            <input
              id="spreadsheet-name"
              name="spreadsheetName"
              value={spreadsheetName}
              onChange={(event) => setSpreadsheetName(event.target.value)}
              onBlur={() => markTouched('spreadsheetName')}
              maxLength={255}
              autoComplete="off"
              disabled={creating}
              placeholder="April expenses"
              aria-invalid={spreadsheetError ? 'true' : 'false'}
              aria-describedby={spreadsheetError ? 'spreadsheet-name-error' : 'spreadsheet-name-hint'}
              className={`${inputClass} ${spreadsheetError ? 'border-clay' : 'border-line focus:border-moss'}`}
            />
            {spreadsheetError ? (
              <p id="spreadsheet-name-error" role="alert" className="mt-1.5 text-sm text-clay">
                {spreadsheetError}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="sheet-name" className="text-sm font-semibold">
              Sheet / tab name
            </label>
            <p id="sheet-name-hint" className="mt-1 text-sm text-mute">
              The only tab in the new file. It cannot include : \ / ? * [ or ].
            </p>
            <input
              id="sheet-name"
              name="sheetName"
              value={sheetName}
              onChange={(event) => setSheetName(event.target.value)}
              onBlur={() => markTouched('sheetName')}
              maxLength={100}
              autoComplete="off"
              disabled={creating}
              placeholder="Transactions"
              aria-invalid={sheetError ? 'true' : 'false'}
              aria-describedby={sheetError ? 'sheet-name-error' : 'sheet-name-hint'}
              className={`${inputClass} ${sheetError ? 'border-clay' : 'border-line focus:border-moss'}`}
            />
            {sheetError ? (
              <p id="sheet-name-error" role="alert" className="mt-1.5 text-sm text-clay">
                {sheetError}
              </p>
            ) : null}
          </div>

          <ColumnBuilder
            columns={columns}
            onChange={setColumns}
            onTouch={markTouched}
            errors={columnErrors}
            disabled={creating}
          />
          {columnsError ? (
            <p role="alert" className="-mt-3 text-sm text-clay">
              {columnsError}
            </p>
          ) : null}

          {formError ? (
            <p id="form-error" role="alert" className="rounded-xl bg-[#fdf1ee] px-3 py-2 text-sm text-clay">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-mute">
              {session
                ? 'This creates a real spreadsheet in the signed-in Google account.'
                : 'Sign in with Google to create this file in your account.'}
            </p>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss disabled:cursor-wait disabled:opacity-70"
            >
              {creating ? 'Creating spreadsheet…' : 'Create spreadsheet'}
            </button>
          </div>
          {creating ? (
            <p role="status" className="text-sm text-mute">
              Sending the spreadsheet to Google Sheets…
            </p>
          ) : null}
        </form>

        <HeaderPreview spreadsheetName={spreadsheetName} sheetName={sheetName} columns={columns} />
      </div>
      </main>

   
    </div>
  )
}
