import { pageNumbers } from '../lib/pagination.js'

const controlClass =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-line bg-card px-3 text-sm font-semibold hover:border-moss/40 disabled:cursor-not-allowed disabled:opacity-50'

export function Pager({ page, pageCount, hasMore = false, loading = false, onPage, onLoadMore, label = 'Pages' }) {
  if (pageCount <= 1 && !hasMore) return null

  const numbers = pageNumbers(page, pageCount)
  const nextDisabled = loading || (page >= pageCount && !hasMore)

  async function showNext() {
    if (loading) return
    if (page < pageCount) {
      onPage(page + 1)
      return
    }
    if (hasMore && onLoadMore) {
      await onLoadMore()
      onPage(page + 1)
    }
  }

  return (
    <nav aria-label={label} className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" className={controlClass} onClick={() => onPage(page - 1)} disabled={loading || page <= 1}>
        Previous
      </button>
      {numbers.map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-sm text-mute" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-current={item === page ? 'page' : undefined}
            onClick={() => onPage(item)}
            disabled={loading}
            className={
              item === page
                ? 'inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-ink px-3 text-sm font-semibold text-white'
                : controlClass
            }
          >
            {item}
          </button>
        ),
      )}
      <button type="button" className={controlClass} onClick={showNext} disabled={nextDisabled}>
        {loading ? 'Loading…' : 'Next'}
      </button>
    </nav>
  )
}
