export function rowMatchesSearch(cells, query) {
  const needle = String(query ?? '').trim().toLocaleLowerCase()
  if (!needle) return true
  return (Array.isArray(cells) ? cells : []).some((cell) => String(cell ?? '').toLocaleLowerCase().includes(needle))
}
