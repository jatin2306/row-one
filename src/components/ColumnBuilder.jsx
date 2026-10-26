import { useEffect, useRef, useState } from 'react'
import { LIMITS, columnLetter, createColumn, reorderColumns } from '../lib/validation.js'

function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="text-mute">
      <circle cx="5" cy="3.5" r="1.1" fill="currentColor" />
      <circle cx="11" cy="3.5" r="1.1" fill="currentColor" />
      <circle cx="5" cy="8" r="1.1" fill="currentColor" />
      <circle cx="11" cy="8" r="1.1" fill="currentColor" />
      <circle cx="5" cy="12.5" r="1.1" fill="currentColor" />
      <circle cx="11" cy="12.5" r="1.1" fill="currentColor" />
    </svg>
  )
}

export function ColumnBuilder({ columns, onChange, onTouch, errors, disabled }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const pendingFocus = useRef(null)
  const atLimit = columns.length >= LIMITS.columns

  useEffect(() => {
    if (!pendingFocus.current) return
    document.getElementById(`column-${pendingFocus.current}`)?.focus()
    pendingFocus.current = null
  }, [columns])

  function addColumn() {
    if (atLimit || disabled) return
    const column = createColumn()
    pendingFocus.current = column.id
    onChange([...columns, column])
  }

  function updateName(id, name) {
    onChange(columns.map((column) => (column.id === id ? { ...column, name } : column)))
  }

  function removeColumn(id) {
    onChange(columns.filter((column) => column.id !== id))
  }

  function moveColumn(fromIndex, toIndex) {
    const next = reorderColumns(columns, fromIndex, toIndex)
    if (next !== columns) onChange(next)
  }

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-semibold">Column headers</legend>
      <p className="mt-1 text-sm text-mute">
        These names are written, in this order, across row 1. Drag a handle, or use Alt+Up and Alt+Down.
      </p>

      {columns.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-white/70 px-4 py-5 text-sm text-mute">
          No columns yet. Add the first header for row 1.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {columns.map((column, index) => {
            const error = errors?.[column.id] || ''
            const letter = columnLetter(index)
            return (
              <li
                key={column.id}
                onDragOver={(event) => {
                  event.preventDefault()
                  setOverIndex(index)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragIndex !== null) moveColumn(dragIndex, index)
                  setDragIndex(null)
                  setOverIndex(null)
                }}
                className={`rounded-xl border bg-white p-2 shadow-sm ${
                  overIndex === index && dragIndex !== null ? 'border-moss' : 'border-line'
                } ${dragIndex === index ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    draggable={!disabled}
                    aria-label={`Drag to reorder column ${letter}`}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', column.id)
                      setDragIndex(index)
                    }}
                    onDragEnd={() => {
                      setDragIndex(null)
                      setOverIndex(null)
                    }}
                    className="grid size-9 shrink-0 cursor-grab place-items-center rounded-lg hover:bg-paper active:cursor-grabbing"
                  >
                    <GripIcon />
                  </button>
                  <span className="w-7 shrink-0 text-center text-xs font-semibold tracking-wide text-mute">
                    {letter}
                  </span>
                  <label className="sr-only" htmlFor={`column-${column.id}`}>
                    Column {letter} name
                  </label>
                  <input
                    id={`column-${column.id}`}
                    value={column.name}
                    maxLength={LIMITS.header}
                    disabled={disabled}
                    autoComplete="off"
                    placeholder="Column name"
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? `column-${column.id}-error` : undefined}
                    onChange={(event) => updateName(column.id, event.target.value)}
                    onBlur={() => onTouch?.(column.id)}
                    onKeyDown={(event) => {
                      if (!event.altKey) return
                      if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        moveColumn(index, index - 1)
                      } else if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        moveColumn(index, index + 1)
                      }
                    }}
                    className={`min-w-0 w-0 flex-1 rounded-lg border bg-card px-3 py-2 text-[15px] outline-none focus:ring-4 focus:ring-moss/15 disabled:bg-paper/70 ${
                      error ? 'border-clay' : 'border-line focus:border-moss'
                    }`}
                  />
                  <button
                    type="button"
                    aria-label={`Move column ${letter} up`}
                    disabled={disabled || index === 0}
                    onClick={() => moveColumn(index, index - 1)}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-sm hover:bg-paper disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move column ${letter} down`}
                    disabled={disabled || index === columns.length - 1}
                    onClick={() => moveColumn(index, index + 1)}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-sm hover:bg-paper disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete column ${letter}${column.name.trim() ? `, ${column.name.trim()}` : ''}`}
                    onClick={() => removeColumn(column.id)}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-lg text-clay hover:bg-clay/10"
                  >
                    ×
                  </button>
                </div>
                {error ? (
                  <p id={`column-${column.id}-error`} role="alert" className="mt-1.5 px-1 text-sm text-clay">
                    {error}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={addColumn}
          disabled={disabled || atLimit}
          className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold hover:border-moss hover:text-moss disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add column
        </button>
        <p className="text-sm text-mute">
          {columns.length} / {LIMITS.columns}
        </p>
      </div>
    </fieldset>
  )
}
