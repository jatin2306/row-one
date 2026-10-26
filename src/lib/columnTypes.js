export const COLUMN_TYPES = [
  { id: 'text', label: 'Text', hint: 'Any words or mixed values.' },
  { id: 'number', label: 'Number', hint: 'Whole numbers and decimals, such as 12 or 3.5.' },
  { id: 'currency', label: 'Currency', hint: 'Money amounts, using the spreadsheet’s currency.' },
  { id: 'percent', label: 'Percent', hint: 'Percentages. Type 25% or 0.25.' },
  { id: 'date', label: 'Date', hint: 'Calendar dates, such as 2026-10-26.' },
  { id: 'time', label: 'Time', hint: 'Times of day, such as 3:30 PM.' },
  { id: 'datetime', label: 'Date and time', hint: 'A date with a time, such as 2026-10-26 15:30.' },
  { id: 'dropdown', label: 'Dropdown', hint: 'A list of choices. Enter them separated by commas.' },
  { id: 'checkbox', label: 'Checkbox', hint: 'Yes or no. In Google Sheets this cell is a checkbox.' },
  { id: 'email', label: 'Email', hint: 'Values must be email addresses.' },
  { id: 'url', label: 'Link', hint: 'Values must be web addresses, such as https://example.com.' },
]

const NUMBER_FORMATS = {
  text: { type: 'TEXT', pattern: '@' },
  number: { type: 'NUMBER', pattern: '#,##0.##' },
  currency: { type: 'CURRENCY' },
  percent: { type: 'PERCENT', pattern: '0.00%' },
  date: { type: 'DATE', pattern: 'yyyy-mm-dd' },
  time: { type: 'TIME', pattern: 'h:mm am/pm' },
  datetime: { type: 'DATE_TIME', pattern: 'yyyy-mm-dd h:mm' },
  dropdown: { type: 'TEXT', pattern: '@' },
  email: { type: 'TEXT', pattern: '@' },
  url: { type: 'TEXT', pattern: '@' },
}

export function parseDropdownOptions(text) {
  const seen = new Set()
  const options = []
  for (const part of String(text ?? '').split(/[\n,]/)) {
    const option = part.trim()
    if (!option) continue
    const key = option.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    options.push(option)
  }
  return options
}

function rule(conditionType, inputMessage, values) {
  const condition = { type: conditionType }
  if (values) condition.values = values.map((value) => ({ userEnteredValue: value }))
  return {
    condition,
    strict: true,
    showCustomUi: true,
    inputMessage,
  }
}

export function columnTypeSpec(typeId, optionsText = '') {
  const known = COLUMN_TYPES.find((type) => type.id === typeId)
  if (!known) return { ok: false, error: 'Choose a column type.' }

  if (known.id === 'dropdown') {
    const options = parseDropdownOptions(optionsText)
    if (options.length === 0) return { ok: false, error: 'Enter at least one dropdown choice, separated by commas.' }
    if (options.length > 100) return { ok: false, error: 'Use 100 dropdown choices or fewer.' }
    if (options.some((option) => option.length > 200)) {
      return { ok: false, error: 'Use 200 characters or fewer for each dropdown choice.' }
    }
    return {
      ok: true,
      id: known.id,
      options,
      numberFormat: NUMBER_FORMATS.dropdown,
      validation: rule('ONE_OF_LIST', 'Choose one of the listed values.', options),
    }
  }

  if (known.id === 'checkbox') {
    return {
      ok: true,
      id: known.id,
      options: [],
      numberFormat: null,
      validation: rule('BOOLEAN', 'Check the box for yes.'),
    }
  }

  if (known.id === 'email') {
    return {
      ok: true,
      id: known.id,
      options: [],
      numberFormat: NUMBER_FORMATS.email,
      validation: rule('TEXT_IS_EMAIL', 'Enter an email address.'),
    }
  }

  if (known.id === 'url') {
    return {
      ok: true,
      id: known.id,
      options: [],
      numberFormat: NUMBER_FORMATS.url,
      validation: rule('TEXT_IS_URL', 'Enter a web address.'),
    }
  }

  const numberFormat = NUMBER_FORMATS[known.id] || NUMBER_FORMATS.text
  const validation =
    known.id === 'date' || known.id === 'datetime'
      ? rule('DATE_IS_VALID', known.id === 'date' ? 'Enter a date.' : 'Enter a date and time.')
      : null

  return {
    ok: true,
    id: known.id,
    options: [],
    numberFormat,
    validation,
  }
}
