import { useEffect, useId, useRef, useState } from 'react'
import { listSheetAccess, removeSheetAccess, shareSheetWithEmail } from '../lib/googleSheets.js'
import { SHARE_ACCESS, shareAccessLabel, shareRequest } from '../lib/sharing.js'

const fieldClass =
  'mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-mute/70 focus:border-moss focus:ring-4 focus:ring-moss/15 disabled:cursor-not-allowed disabled:bg-paper/80'

function personLabel(person) {
  if (person.type === 'anyone') return 'Anyone with the link'
  if (person.name && person.email) return `${person.name} · ${person.email}`
  return person.email || person.name || 'Someone with access'
}

export function ShareDialog({ file, runGoogle, onClose }) {
  const titleId = useId()
  const emailRef = useRef(null)
  const closeRef = useRef(onClose)
  const runRef = useRef(runGoogle)
  const busyRef = useRef(false)
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('writer')
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState('')
  const [error, setError] = useState('')

  const busy = loading || saving || Boolean(removingId)

  useEffect(() => {
    closeRef.current = onClose
    runRef.current = runGoogle
    busyRef.current = busy
  })

  useEffect(() => {
    emailRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event) {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    let active = true
    runRef.current(() => listSheetAccess(file.id))
      .then((next) => {
        if (!active) return
        setPeople(next)
        setLoading(false)
      })
      .catch((caught) => {
        if (!active) return
        setError(caught?.message || 'Could not load who has access.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [file.id])

  async function addPerson(event) {
    event.preventDefault()
    if (busy) return
    const request = shareRequest(email, role)
    if (!request.ok) {
      setError(request.error)
      return
    }
    setSaving(true)
    setError('')
    try {
      await runGoogle(() => shareSheetWithEmail(file.id, request.email, request.role, notify))
      const next = await runGoogle(() => listSheetAccess(file.id))
      setPeople(next)
      setEmail('')
    } catch (caught) {
      setError(caught?.message || 'Could not share this spreadsheet.')
    } finally {
      setSaving(false)
    }
  }

  async function removePerson(person) {
    if (busy || person.role === 'owner') return
    setRemovingId(person.id)
    setError('')
    try {
      await runGoogle(() => removeSheetAccess(file.id, person.id, person.role))
      setPeople((current) => current.filter((item) => item.id !== person.id))
    } catch (caught) {
      setError(caught?.message || 'Could not remove that person.')
    } finally {
      setRemovingId('')
    }
  }

  const ordered = [...people].sort((left, right) => {
    if (left.role === 'owner') return -1
    if (right.role === 'owner') return 1
    return personLabel(left).localeCompare(personLabel(right))
  })

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-5 shadow-xl sm:p-6"
      >
        <h3 id={titleId} className="font-serif text-3xl tracking-tight">
          Share
        </h3>
        <p className="mt-2 text-sm leading-6 text-mute">
          Add another Google account to <span className="font-semibold text-ink">{file.name}</span>. They can open it
          in Google Sheets, and it shows in their list here after they sign in with that email.
        </p>

        <form className="mt-4 space-y-4" onSubmit={addPerson}>
          <div>
            <label htmlFor="share-email" className="text-sm font-semibold">
              Email
            </label>
            <input
              ref={emailRef}
              id="share-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              placeholder="teammate@gmail.com"
              disabled={busy}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="share-role" className="text-sm font-semibold">
              Access
            </label>
            <select
              id="share-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              disabled={busy}
              className={fieldClass}
            >
              {SHARE_ACCESS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm leading-6">
            <input
              type="checkbox"
              checked={notify}
              onChange={(event) => setNotify(event.target.checked)}
              disabled={busy}
              className="mt-1"
            />
            Email them a Google invite
          </label>
          {error ? (
            <p role="alert" className="rounded-xl bg-[#fdf1ee] px-3 py-2 text-sm text-clay">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-moss disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? 'Adding…' : 'Add person'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-moss/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Close
            </button>
          </div>
        </form>

        <div className="mt-6 border-t border-line pt-4">
          <h4 className="text-sm font-semibold">People with access</h4>
          {loading ? <p className="mt-2 text-sm text-mute">Loading…</p> : null}
          {!loading && ordered.length === 0 ? (
            <p className="mt-2 text-sm text-mute">No one else is listed on this spreadsheet yet.</p>
          ) : null}
          {ordered.length > 0 ? (
            <ul className="mt-3 divide-y divide-line">
              {ordered.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{personLabel(person)}</p>
                    <p className="text-sm text-mute">{shareAccessLabel(person.role)}</p>
                  </div>
                  {person.role === 'owner' ? null : (
                    <button
                      type="button"
                      onClick={() => removePerson(person)}
                      disabled={busy}
                      className="shrink-0 text-sm font-semibold text-clay underline disabled:opacity-60"
                    >
                      {removingId === person.id ? 'Removing…' : 'Remove'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
