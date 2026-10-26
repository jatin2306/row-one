import { useState } from 'react'

export function ResultPanel({ result, onView }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(result.spreadsheetUrl)
      setCopied(true)
      setCopyError('')
    } catch {
      setCopied(false)
      setCopyError('Could not copy automatically. Select the link and copy it.')
    }
  }

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-moss/25 bg-[#f3faf6] p-5 shadow-sm"
    >
      <p className="text-xs font-semibold tracking-[0.16em] text-moss">CREATED IN YOUR GOOGLE ACCOUNT</p>
      <h2 className="mt-1 font-serif text-3xl tracking-tight">{result.title}</h2>
      <p className="mt-1 text-sm text-mute">
        Tab “{result.tab}” has {result.columnCount} {result.columnCount === 1 ? 'header' : 'headers'} in row 1.
        Creating again adds another spreadsheet.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={result.spreadsheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-dark"
        >
          Open spreadsheet
        </a>
        {onView ? (
          <button
            type="button"
            onClick={onView}
            className="rounded-full border border-moss/30 bg-white px-4 py-2 text-sm font-semibold text-moss hover:bg-white/70"
          >
            View table
          </button>
        ) : null}
        <button
          type="button"
          onClick={copyLink}
          className="rounded-full border border-moss/30 bg-white px-4 py-2 text-sm font-semibold text-moss hover:bg-white/70"
        >
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
      <p className="mt-4 break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-ink/80">
        {result.spreadsheetUrl}
      </p>
      {copyError ? (
        <p role="alert" className="mt-2 text-sm text-clay">
          {copyError}
        </p>
      ) : null}
    </section>
  )
}
