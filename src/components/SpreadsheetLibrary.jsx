function formatModified(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function SpreadsheetLibrary({
  files,
  query,
  onQueryChange,
  status,
  error,
  refreshing,
  loadingMore,
  hasMore,
  onRefresh,
  onLoadMore,
  onView,
}) {
  const needle = query.trim().toLocaleLowerCase()
  const visible = needle ? files.filter((file) => file.name.toLocaleLowerCase().includes(needle)) : files
  const countLabel = needle
    ? `${visible.length} of ${files.length}${hasMore ? ' loaded' : ''}`
    : hasMore
      ? `${files.length} loaded`
      : `${files.length} ${files.length === 1 ? 'spreadsheet' : 'spreadsheets'}`

  return (
    <section aria-labelledby="library-heading" className="min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="library-heading" className="font-serif text-4xl tracking-tight">
            Your spreadsheets
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-mute">
            Every spreadsheet in the signed-in Google account. Open one to see its rows, then add, edit, or delete any row.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={status === 'loading' || refreshing}
          className="inline-flex items-center justify-center rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-moss/40 disabled:cursor-wait disabled:opacity-60"
        >
          {refreshing ? 'Refreshing…' : 'Refresh list'}
        </button>
      </div>

      <div className="mt-5">
        <label htmlFor="spreadsheet-filter" className="text-sm font-semibold">
          Search spreadsheets
        </label>
        <input
          id="spreadsheet-filter"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          autoComplete="off"
          placeholder="Search by spreadsheet name"
          className="mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-mute/70 focus:border-moss focus:ring-4 focus:ring-moss/15 sm:max-w-md"
        />
        {needle && hasMore ? (
          <p className="mt-2 text-sm text-mute">This search checks loaded spreadsheets. Load more to include older files.</p>
        ) : null}
      </div>

      {status === 'loading' ? (
        <p role="status" className="mt-6 text-sm text-mute">
          Loading your spreadsheets…
        </p>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-xl bg-[#fdf1ee] px-3 py-2 text-sm text-clay">
          <p role="alert">{error}</p>
          <button type="button" onClick={onRefresh} className="mt-2 font-semibold text-moss underline">
            Try again
          </button>
        </div>
      ) : null}

      {status === 'ready' && files.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-dashed border-line bg-card px-5 py-10 text-center text-sm leading-6 text-mute">
          This Google account has no spreadsheets yet. Use Create spreadsheet to add one.
        </p>
      ) : null}

      {status === 'ready' && files.length > 0 ? (
        <p className="mt-5 text-sm text-mute">{countLabel}</p>
      ) : null}

      {visible.length > 0 ? (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-card shadow-[0_24px_50px_-40px_rgba(50,35,15,0.8)]">
          {visible.map((file) => {
            const modified = formatModified(file.modifiedTime)
            return (
              <li key={file.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="truncate font-semibold" title={file.name}>
                    {file.name}
                  </p>
                  <p className="mt-1 text-sm text-mute">{modified ? `Updated ${modified}` : 'Google Sheet'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-moss underline"
                  >
                    Open in Google Sheets
                  </a>
                  <button
                    type="button"
                    onClick={() => onView(file)}
                    className="inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-moss"
                  >
                    View table
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {status === 'ready' && files.length > 0 && visible.length === 0 ? (
        <p className="mt-4 text-sm text-mute">No spreadsheets match that search.</p>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-4 rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-moss/40 disabled:cursor-wait disabled:opacity-60"
        >
          {loadingMore ? 'Loading more…' : 'Load more'}
        </button>
      ) : null}
    </section>
  )
}
