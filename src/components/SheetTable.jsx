import { useEffect, useId, useRef, useState } from 'react'
import { COLUMN_TYPES, columnTypeSpec } from '../lib/columnTypes.js'
import { rowMatchesSearch } from '../lib/tableSearch.js'
import { LIMITS, columnLetter, validateNewColumnName } from '../lib/validation.js'

const fieldClass =
  'mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-mute/70 focus:border-moss focus:ring-4 focus:ring-moss/15 disabled:cursor-not-allowed disabled:bg-paper/80'

function labelsFor(count, headerCells, useHeader) {
  return Array.from({ length: count }, (_, index) => {
    const header = useHeader ? headerCells?.[index]?.trim() : ''
    return header || `Column ${columnLetter(index)}`
  })
}

function ColumnEditor({ existingHeaders, atColumnLimit, busy, error, onCancel, onSave }) {
  const titleId = useId()
  const fieldRef = useRef(null)
  const cancelRef = useRef(onCancel)
  const busyRef = useRef(busy)
  const [name, setName] = useState('')
  const [typeId, setTypeId] = useState('text')
  const [optionsText, setOptionsText] = useState('')
  const [fieldError, setFieldError] = useState('')
  const selectedType = COLUMN_TYPES.find((type) => type.id === typeId) || COLUMN_TYPES[0]

  useEffect(() => {
    cancelRef.current = onCancel
    busyRef.current = busy
  })

  useEffect(() => {
    fieldRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event) {
      if (event.key === 'Escape' && !busyRef.current) cancelRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-5 shadow-xl sm:p-6"
      >
        <h3 id={titleId} className="font-serif text-3xl tracking-tight">
          Add a column
        </h3>
        <p className="mt-2 text-sm leading-6 text-mute">
          The name stays in row 1. Cells under it use the value type you choose, including numbers, dates, and dropdowns.
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (busy) return
            if (atColumnLimit) {
              setFieldError(`Use ${LIMITS.columns} columns or fewer.`)
              return
            }
            const message = validateNewColumnName(name, existingHeaders)
            if (message) {
              setFieldError(message)
              return
            }
            const spec = columnTypeSpec(typeId, optionsText)
            if (!spec.ok) {
              setFieldError(spec.error)
              return
            }
            setFieldError('')
            onSave(name.trim(), { typeId: spec.id, optionsText })
          }}
        >
          <div>
            <label htmlFor="new-column-name" className="text-sm font-semibold">
              Column name
            </label>
            <input
              ref={fieldRef}
              id="new-column-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setFieldError('')
              }}
              disabled={busy}
              autoComplete="off"
              maxLength={LIMITS.header}
              placeholder="City"
              aria-invalid={fieldError ? 'true' : 'false'}
              className={fieldClass}
            />
            {fieldError ? (
              <p role="alert" className="mt-1.5 text-sm text-clay">
                {fieldError}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="new-column-type" className="text-sm font-semibold">
              Value type
            </label>
            <select
              id="new-column-type"
              value={typeId}
              onChange={(event) => {
                setTypeId(event.target.value)
                setFieldError('')
              }}
              disabled={busy}
              className="mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-moss focus:ring-4 focus:ring-moss/15 disabled:opacity-60"
            >
              {COLUMN_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-sm text-mute">{selectedType.hint}</p>
          </div>
          {typeId === 'dropdown' ? (
            <div>
              <label htmlFor="new-column-choices" className="text-sm font-semibold">
                Dropdown choices
              </label>
              <textarea
                id="new-column-choices"
                value={optionsText}
                onChange={(event) => {
                  setOptionsText(event.target.value)
                  setFieldError('')
                }}
                disabled={busy}
                rows={3}
                placeholder="Yes, No, Maybe"
                className={fieldClass}
              />
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-xl bg-[#fdf1ee] px-3 py-2 text-sm text-clay">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-moss disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? 'Saving…' : 'Add column'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RowEditor({ editor, headerCells, busy, error, onCancel, onSave }) {
  const titleId = useId()
  const firstField = useRef(null)
  const cancelRef = useRef(onCancel)
  const busyRef = useRef(busy)
  const [cells, setCells] = useState(editor.cells)
  const useHeader = editor.mode === 'add' || editor.sheetRow !== 1
  const labels = labelsFor(cells.length, headerCells, useHeader)

  useEffect(() => {
    cancelRef.current = onCancel
    busyRef.current = busy
  })

  useEffect(() => {
    firstField.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event) {
      if (event.key === 'Escape' && !busyRef.current) cancelRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  function updateCell(index, value) {
    setCells((current) => current.map((cell, cellIndex) => (cellIndex === index ? value : cell)))
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-5 shadow-xl sm:p-6"
      >
        <h3 id={titleId} className="font-serif text-3xl tracking-tight">
          {editor.mode === 'add' ? 'Add a row' : `Edit row ${editor.sheetRow}`}
        </h3>
        <p className="mt-2 text-sm leading-6 text-mute">
          {editor.mode === 'add'
            ? 'This fills the columns already in the sheet. Numbers, dates, dropdowns, and the other column types are saved in that form.'
            : 'Saving writes these cells into the Google Sheet. A formula is replaced by the value shown here.'}
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!busy) onSave(cells)
          }}
        >
          {cells.map((cell, index) => {
            const fieldId = `row-cell-${editor.nonce}-${index}`
            return (
              <div key={fieldId}>
                <label htmlFor={fieldId} className="text-sm font-semibold">
                  {labels[index]}
                </label>
                <input
                  ref={index === 0 ? firstField : null}
                  id={fieldId}
                  value={cell}
                  onChange={(event) => updateCell(index, event.target.value)}
                  disabled={busy}
                  autoComplete="off"
                  className={fieldClass}
                />
              </div>
            )
          })}

          {error ? (
            <p role="alert" className="rounded-xl bg-[#fdf1ee] px-3 py-2 text-sm text-clay">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-moss disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? 'Saving…' : editor.mode === 'add' ? 'Add row' : 'Save row'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SheetTable({
  title,
  url,
  tabs,
  activeTitle,
  table,
  status,
  error,
  onBack,
  onSelectTab,
  onReload,
  onAdd,
  onAddColumn,
  onUpdate,
  onDelete,
  onDeleteColumn,
  onShare,
}) {
  const [editor, setEditor] = useState(null)
  const [columnEditor, setColumnEditor] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingDeleteColumn, setPendingDeleteColumn] = useState(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [query, setQuery] = useState('')
  const columnCount = table?.columnCount || 1
  const rows = table?.rows || []
  const visibleRows = query.trim() ? rows.filter((row) => rowMatchesSearch(row.cells, query)) : rows
  const letters = Array.from({ length: columnCount }, (_, index) => columnLetter(index))

  async function runAction(task) {
    setSaving(true)
    setActionError('')
    try {
      await task()
      setEditor(null)
      setColumnEditor(false)
      setPendingDelete(null)
      setPendingDeleteColumn(null)
    } catch (caught) {
      setActionError(caught?.message || 'Could not update the spreadsheet.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="table-heading" className="min-w-0">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-moss underline">
        All spreadsheets
      </button>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="table-heading" className="truncate font-serif text-4xl tracking-tight" title={title}>
            {title}
          </h2>
          <p className="mt-2 text-sm text-mute">
            {rows.length === 0
              ? 'No rows in this tab yet.'
              : query.trim()
                ? `${visibleRows.length} of ${rows.length} rows`
                : `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`}
            {status === 'loading' && table ? ' · Refreshing…' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onShare}
            className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-moss/40"
          >
            Share
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-moss/40"
          >
            Open in Google Sheets
          </a>
          <button
            type="button"
            onClick={() => {
              setEditor(null)
              setColumnEditor(false)
              setPendingDelete(null)
              setPendingDeleteColumn(null)
              setActionError('')
              onReload()
            }}
            disabled={status === 'loading' || saving}
            className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-moss/40 disabled:cursor-wait disabled:opacity-60"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              setEditor(null)
              setPendingDelete(null)
              setPendingDeleteColumn(null)
              setActionError('')
              setColumnEditor(true)
            }}
            disabled={!activeTitle || status === 'loading' || saving || !table}
            className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-moss/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add column
          </button>
          <button
            type="button"
            onClick={() => {
              setColumnEditor(false)
              setPendingDelete(null)
              setPendingDeleteColumn(null)
              setActionError('')
              setEditor({
                mode: 'add',
                sheetRow: null,
                nonce: Date.now(),
                cells: Array.from({ length: columnCount }, () => ''),
              })
            }}
            disabled={!activeTitle || status === 'loading' || saving || !table}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-moss disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add row
          </button>
        </div>
      </div>

      {tabs.length > 1 ? (
        <div className="mt-4 max-w-sm">
          <label htmlFor="sheet-tab" className="text-sm font-semibold">
            Tab
          </label>
          <select
            id="sheet-tab"
            value={activeTitle}
            disabled={saving}
            onChange={(event) => {
              const next = tabs.find((tab) => tab.title === event.target.value)
              if (next) onSelectTab(next)
            }}
            className="mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-moss focus:ring-4 focus:ring-moss/15 disabled:opacity-60"
          >
            {tabs.map((tab) => (
              <option key={tab.sheetId} value={tab.title}>
                {tab.title}
              </option>
            ))}
          </select>
        </div>
      ) : activeTitle ? (
        <p className="mt-4 text-sm text-mute">
          Tab <span className="font-medium text-ink">{activeTitle}</span>
        </p>
      ) : null}

      {table && rows.length > 0 ? (
        <div className="mt-5 max-w-xl">
          <label htmlFor="sheet-search" className="text-sm font-semibold">
            Search this sheet
          </label>
          <input
            id="sheet-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPendingDelete(null)
              setPendingDeleteColumn(null)
            }}
            disabled={saving}
            autoComplete="off"
            placeholder="Search all columns and rows"
            className="mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-mute/70 focus:border-moss focus:ring-4 focus:ring-moss/15 disabled:opacity-60"
          />
        </div>
      ) : null}

      {status === 'loading' && !table ? (
        <p role="status" className="mt-6 text-sm text-mute">
          Loading table…
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 rounded-xl bg-[#fdf1ee] px-3 py-2 text-sm text-clay">
          {error}
        </p>
      ) : null}

      {actionError && !editor ? (
        <p role="alert" className="mt-4 rounded-xl bg-[#fdf1ee] px-3 py-2 text-sm text-clay">
          {actionError}
        </p>
      ) : null}

      {table && rows.length === 0 && status !== 'loading' ? (
        <p className="mt-6 rounded-3xl border border-dashed border-line bg-card px-5 py-10 text-center text-sm text-mute">
          This tab is empty. Add a row to start the table.
        </p>
      ) : null}

      {table && rows.length > 0 && visibleRows.length === 0 ? (
        <p className="mt-4 text-sm text-mute">No rows match that search.</p>
      ) : null}

      {table && visibleRows.length > 0 ? (
        <div className="mt-5 max-h-[70vh] overflow-auto rounded-2xl border border-[#d9d1c3] bg-white shadow-[0_24px_50px_-36px_rgba(50,35,15,0.7)]">
          <table className="min-w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Rows in {title}
              {activeTitle ? `, tab ${activeTitle}` : ''}
            </caption>
            <thead className="sticky top-0 z-10 bg-[#f6f1e7] text-xs font-semibold tracking-wide text-mute">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Row
                </th>
                <th scope="col" className="px-3 py-2">
                  Actions
                </th>
                {letters.map((letter, index) => {
                  const headerName = rows[0]?.cells[index]?.trim()
                  const headerStyle = rows[0]?.formats?.[index] || null
                  const columnLabel = headerName ? `${letter} ${headerName}` : letter
                  return (
                    <th
                      key={letter}
                      scope="col"
                      style={headerStyle?.backgroundColor ? { backgroundColor: headerStyle.backgroundColor } : undefined}
                      className="px-3 py-2 align-bottom font-normal"
                    >
                      <span className="block font-semibold tracking-wide">{letter}</span>
                      {headerName ? (
                        <span className="mt-1 block font-semibold" style={headerStyle || undefined}>
                          {headerName}
                        </span>
                      ) : null}
                      {pendingDeleteColumn === index ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 normal-case">
                          <span className="text-sm font-medium text-ink">Delete {columnLabel}?</span>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => runAction(() => onDeleteColumn(index))}
                            className="font-semibold text-clay underline disabled:opacity-50"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => setPendingDeleteColumn(null)}
                            className="font-semibold text-moss underline disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={saving || status === 'loading'}
                          onClick={() => {
                            setEditor(null)
                            setColumnEditor(false)
                            setPendingDelete(null)
                            setActionError('')
                            setPendingDeleteColumn(index)
                          }}
                          className="mt-2 font-semibold text-clay underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.sheetRow} className="border-t border-line align-top odd:bg-[#fbf7f0]">
                  <th scope="row" className="px-3 py-2 font-semibold text-mute">
                    {row.sheetRow}
                  </th>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {pendingDelete === row.sheetRow ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm">Delete row {row.sheetRow}?</span>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => runAction(() => onDelete(row.sheetRow))}
                          className="font-semibold text-clay underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setPendingDelete(null)}
                          className="font-semibold text-moss underline disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          disabled={saving || status === 'loading'}
                          onClick={() => {
                            setActionError('')
                            setColumnEditor(false)
                            setPendingDelete(null)
                            setPendingDeleteColumn(null)
                            setEditor({
                              mode: 'edit',
                              sheetRow: row.sheetRow,
                              nonce: Date.now(),
                              cells: row.cells.slice(),
                            })
                          }}
                          className="font-semibold text-moss underline disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={saving || status === 'loading'}
                          onClick={() => {
                            setEditor(null)
                            setColumnEditor(false)
                            setPendingDeleteColumn(null)
                            setPendingDelete(row.sheetRow)
                          }}
                          className="font-semibold text-clay underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                  {row.cells.map((cell, index) => {
                    const cellStyle = row.formats?.[index] || undefined
                    const wraps = cellStyle?.whiteSpace === 'normal'
                    return (
                      <td key={`${row.sheetRow}-${letters[index]}`} style={cellStyle} className="max-w-64 px-3 py-2">
                        <span className={wraps ? 'block min-h-5 whitespace-normal' : 'block min-h-5 truncate'} title={cell}>
                          {cell}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {columnEditor ? (
        <ColumnEditor
          existingHeaders={rows[0]?.cells ?? []}
          atColumnLimit={(rows.length === 0 ? 0 : columnCount) >= LIMITS.columns}
          busy={saving}
          error={actionError}
          onCancel={() => {
            if (!saving) {
              setColumnEditor(false)
              setActionError('')
            }
          }}
          onSave={(name, columnType) => {
            const columnIndex = rows.length === 0 ? 0 : columnCount
            runAction(() => onAddColumn(name, columnIndex, columnType))
          }}
        />
      ) : null}

      {editor ? (
        <RowEditor
          key={editor.nonce}
          editor={editor}
          headerCells={rows[0]?.cells}
          busy={saving}
          error={actionError}
          onCancel={() => {
            if (!saving) {
              setEditor(null)
              setActionError('')
            }
          }}
          onSave={(cells) =>
            runAction(() => (editor.mode === 'add' ? onAdd(cells) : onUpdate(editor.sheetRow, cells)))
          }
        />
      ) : null}
    </section>
  )
}
