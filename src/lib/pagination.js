export const LIBRARY_PAGE_SIZE = 10

export function paginate(items, page, pageSize = LIBRARY_PAGE_SIZE) {
  const list = Array.isArray(items) ? items : []
  const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : LIBRARY_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(list.length / size))
  const current = Math.min(Math.max(1, Number.isInteger(page) ? page : 1), pageCount)
  const start = (current - 1) * size
  return {
    page: current,
    pageCount,
    start,
    total: list.length,
    items: list.slice(start, start + size),
  }
}

export function pageNumbers(page, pageCount) {
  const count = Math.max(1, pageCount)
  const current = Math.min(Math.max(1, page), count)
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1)

  const included = new Set(
    [1, count, current - 1, current, current + 1].filter((number) => number >= 1 && number <= count),
  )
  const sorted = [...included].sort((left, right) => left - right)
  const numbers = []
  for (let index = 0; index < sorted.length; index += 1) {
    if (index > 0 && sorted[index] - sorted[index - 1] > 1) numbers.push('gap')
    numbers.push(sorted[index])
  }
  return numbers
}
