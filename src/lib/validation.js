export const LIMITS = {
  spreadsheetName: 255,
  sheetName: 100,
  header: 200,
  columns: 100,
}

const SHEET_NAME_FORBIDDEN = /[:\\/?*[\]]/

export function columnLetter(index) {
  let n = index + 1
  let label = ''
  while (n > 0) {
    const remainder = (n - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

export function createColumn(name = '') {
  return { id: crypto.randomUUID(), name }
}

export function validateNewColumnName(name, headers = []) {
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return 'Enter a column name.'
  if (trimmed.length > LIMITS.header) return `Use ${LIMITS.header} characters or fewer.`
  const key = trimmed.toLocaleLowerCase()
  const index = headers.findIndex((header) => String(header ?? '').trim().toLocaleLowerCase() === key)
  if (index >= 0 && String(headers[index] ?? '').trim()) {
    return `“${trimmed}” is already used in column ${columnLetter(index)}.`
  }
  return ''
}

export function reorderColumns(columns, fromIndex, toIndex) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= columns.length ||
    toIndex >= columns.length
  ) {
    return columns
  }

  const next = columns.slice()
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export function validateSpreadsheetForm({ spreadsheetName, sheetName, columns }) {
  const errors = {}
  const title = spreadsheetName.trim()
  const tab = sheetName.trim()

  if (!title) {
    errors.spreadsheetName = 'Enter a spreadsheet name.'
  } else if (title.length > LIMITS.spreadsheetName) {
    errors.spreadsheetName = `Use ${LIMITS.spreadsheetName} characters or fewer.`
  }

  if (!tab) {
    errors.sheetName = 'Enter a sheet tab name.'
  } else if (tab.length > LIMITS.sheetName) {
    errors.sheetName = `Use ${LIMITS.sheetName} characters or fewer.`
  } else if (SHEET_NAME_FORBIDDEN.test(tab)) {
    errors.sheetName = 'Tab names cannot include : \\ / ? * [ or ].'
  } else if (tab.startsWith("'") || tab.endsWith("'")) {
    errors.sheetName = 'Tab names cannot start or end with an apostrophe.'
  }

  if (!columns.length) {
    errors.columns = 'Add at least one column.'
  } else if (columns.length > LIMITS.columns) {
    errors.columns = `Use ${LIMITS.columns} columns or fewer.`
  }

  const columnFields = {}
  const seen = new Map()

  columns.forEach((column, index) => {
    const name = column.name.trim()
    if (!name) {
      columnFields[column.id] = 'Enter a column name.'
      return
    }
    if (name.length > LIMITS.header) {
      columnFields[column.id] = `Use ${LIMITS.header} characters or fewer.`
      return
    }
    const key = name.toLocaleLowerCase()
    if (seen.has(key)) {
      columnFields[column.id] = `“${name}” is already used in column ${columnLetter(seen.get(key))}.`
      return
    }
    seen.set(key, index)
  })

  if (Object.keys(columnFields).length > 0) {
    errors.columnFields = columnFields
  }

  const ok = !errors.spreadsheetName && !errors.sheetName && !errors.columns && !errors.columnFields

  return {
    ok,
    errors,
    value: ok
      ? {
          title,
          tab,
          headers: columns.map((column) => column.name.trim()),
        }
      : null,
  }
}
