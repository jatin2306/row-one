import { columnLetter } from '../lib/validation.js'

const EMPTY_ROWS = [2, 3, 4]

export function HeaderPreview({ spreadsheetName, sheetName, columns }) {
  const title = spreadsheetName.trim() || 'Untitled spreadsheet'
  const tab = sheetName.trim() || 'Sheet'
  const titleMuted = !spreadsheetName.trim()
  const tabMuted = !sheetName.trim()

  return (
    <section aria-labelledby="preview-heading" className="min-w-0 lg:sticky lg:top-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="preview-heading" className="font-serif text-3xl tracking-tight">
            Header preview
          </h2>
          <p className="mt-1 text-sm text-mute">Row 1 updates as you edit. The created file freezes and bolds this row.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#d9d1c3] bg-white shadow-[0_24px_50px_-36px_rgba(50,35,15,0.7)]">
        <div className="flex items-center gap-2 bg-[#1e2a24] px-4 py-3 text-white">
          <span className="size-2.5 rounded-sm bg-[#68c08f]" />
          <p data-testid="preview-title" className={`truncate text-sm font-medium ${titleMuted ? 'text-white/55' : ''}`}>{title}</p>
        </div>

        {columns.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-mute">Add a column to preview the header row.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Live preview of spreadsheet {title}, tab {tab}, with {columns.length} header cells in row 1.
              </caption>
              <thead>
                <tr className="bg-[#f6f3ed] text-[11px] font-semibold tracking-wide text-mute">
                  <th scope="col" className="w-10 border-r border-b border-[#e6dfd3] px-2 py-1.5 text-center">
                    <span className="sr-only">Row</span>
                  </th>
                  {columns.map((column, index) => (
                    <th
                      key={column.id}
                      scope="col"
                      className="min-w-32 border-r border-b border-[#e6dfd3] px-3 py-1.5 text-center font-semibold"
                    >
                      {columnLetter(index)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr data-testid="preview-headers">
                  <th scope="row" className="border-r border-b border-[#e6dfd3] bg-[#f6f3ed] px-2 py-3 text-center text-xs text-mute">
                    1
                  </th>
                  {columns.map((column) => {
                    const name = column.name.trim()
                    return (
                      <td
                        key={column.id}
                        className="min-w-32 border-r border-b border-[#0d5232] bg-moss px-3 py-3 font-semibold text-white"
                      >
                        {name || <span className="sr-only">Empty header</span>}
                      </td>
                    )
                  })}
                </tr>
                {EMPTY_ROWS.map((rowNumber) => (
                  <tr key={rowNumber}>
                    <th scope="row" className="border-r border-b border-[#e6dfd3] bg-[#f6f3ed] px-2 py-3 text-center text-xs text-mute">
                      {rowNumber}
                    </th>
                    {columns.map((column) => (
                      <td key={column.id} className="border-r border-b border-[#eee6da] px-3 py-3" />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-end border-t border-[#e6dfd3] bg-[#f7f4ee] px-3 pt-2">
          <p
            data-testid="preview-tab"
            className={`rounded-t-md border border-b-0 border-[#e6dfd3] bg-white px-4 py-1.5 text-sm font-medium ${
              tabMuted ? 'text-mute' : 'text-moss'
            }`}
          >
            {tab}
          </p>
        </div>
      </div>
    </section>
  )
}
