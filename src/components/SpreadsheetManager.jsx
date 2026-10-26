import { useEffect, useRef, useState } from 'react'
import { ShareDialog } from './ShareDialog.jsx'
import { SheetTable } from './SheetTable.jsx'
import { SpreadsheetLibrary } from './SpreadsheetLibrary.jsx'
import {
  appendSheetColumn,
  appendSheetRow,
  deleteSheetColumn,
  deleteSheetRow,
  getSpreadsheet,
  listSpreadsheets,
  readSheetTable,
  updateSheetRow,
} from '../lib/googleSheets.js'

export function SpreadsheetManager({ runGoogle, openRequest }) {
  const runRef = useRef(runGoogle)
  const listToken = useRef(0)
  const openToken = useRef(0)
  const viewRef = useRef(null)
  const seenNonce = useRef(null)
  const openFileRef = useRef(null)

  const [files, setFiles] = useState([])
  const [nextPageToken, setNextPageToken] = useState('')
  const [listStatus, setListStatus] = useState('loading')
  const [listError, setListError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState('')
  const [view, setView] = useState(null)
  const [shareFile, setShareFile] = useState(null)

  async function refreshList({ background = false } = {}) {
    const token = ++listToken.current
    setLoadingMore(false)
    setListError('')
    if (background) setRefreshing(true)
    else setListStatus('loading')

    try {
      const page = await runRef.current(() => listSpreadsheets())
      if (listToken.current !== token) return
      setFiles(page.files)
      setNextPageToken(page.nextPageToken)
      setListStatus('ready')
    } catch (error) {
      if (listToken.current !== token) return
      setListStatus('error')
      setListError(error?.message || 'Could not load spreadsheets.')
    } finally {
      if (listToken.current === token) setRefreshing(false)
    }
  }

  useEffect(() => {
    const token = ++listToken.current
    let cancelled = false
    runRef.current(() => listSpreadsheets())
      .then((page) => {
        if (cancelled || listToken.current !== token) return
        setFiles(page.files)
        setNextPageToken(page.nextPageToken)
        setListStatus('ready')
      })
      .catch((error) => {
        if (cancelled || listToken.current !== token) return
        setListStatus('error')
        setListError(error?.message || 'Could not load spreadsheets.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function loadMore() {
    if (!nextPageToken || loadingMore) return
    const token = listToken.current
    const pageToken = nextPageToken
    setLoadingMore(true)
    setListError('')
    try {
      const page = await runRef.current(() => listSpreadsheets({ pageToken }))
      if (listToken.current !== token) return
      setFiles((current) => {
        const seen = new Set(current.map((file) => file.id))
        return [...current, ...page.files.filter((file) => file.id && !seen.has(file.id))]
      })
      setNextPageToken(page.nextPageToken)
    } catch (error) {
      if (listToken.current !== token) return
      setListError(error?.message || 'Could not load more spreadsheets.')
    } finally {
      if (listToken.current === token) setLoadingMore(false)
    }
  }

  async function openFile(file) {
    const token = ++openToken.current
    setView({
      id: file.id,
      title: file.name || 'Untitled spreadsheet',
      url: file.url || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
      tabs: [],
      activeTitle: '',
      sheetId: null,
      table: null,
      status: 'loading',
      error: '',
    })

    try {
      const meta = await runRef.current(() => getSpreadsheet(file.id))
      if (openToken.current !== token) return
      const tab = meta.tabs[0]
      if (!tab) throw new Error('This spreadsheet has no tabs.')
      const table = await runRef.current(() => readSheetTable(meta.spreadsheetId, tab.title))
      if (openToken.current !== token) return
      setView({
        id: meta.spreadsheetId,
        title: meta.title,
        url: meta.url,
        tabs: meta.tabs,
        activeTitle: tab.title,
        sheetId: tab.sheetId,
        table,
        status: 'ready',
        error: '',
      })
    } catch (error) {
      if (openToken.current !== token) return
      setView((current) => ({
        id: file.id,
        title: current?.title || file.name || 'Untitled spreadsheet',
        url: current?.url || file.url || '',
        tabs: current?.tabs || [],
        activeTitle: '',
        sheetId: null,
        table: null,
        status: 'error',
        error: error?.message || 'Could not open this spreadsheet.',
      }))
    }
  }

  useEffect(() => {
    runRef.current = runGoogle
    viewRef.current = view
    openFileRef.current = openFile
  })

  useEffect(() => {
    if (!openRequest?.id || openRequest.nonce == null) return
    if (seenNonce.current === openRequest.nonce) return
    seenNonce.current = openRequest.nonce
    openFileRef.current({
      id: openRequest.id,
      name: openRequest.name,
      url: openRequest.url,
    })
  }, [openRequest])

  async function selectTab(tab) {
    const current = viewRef.current
    if (!current || current.activeTitle === tab.title) return
    const token = ++openToken.current
    setView({
      ...current,
      activeTitle: tab.title,
      sheetId: tab.sheetId,
      table: null,
      status: 'loading',
      error: '',
    })
    try {
      const table = await runRef.current(() => readSheetTable(current.id, tab.title))
      if (openToken.current !== token) return
      setView((latest) =>
        latest && latest.id === current.id
          ? { ...latest, activeTitle: tab.title, sheetId: tab.sheetId, table, status: 'ready', error: '' }
          : latest,
      )
    } catch (error) {
      if (openToken.current !== token) return
      setView((latest) =>
        latest && latest.id === current.id
          ? { ...latest, status: 'error', error: error?.message || 'Could not load this tab.' }
          : latest,
      )
    }
  }

  async function reloadTable() {
    const current = viewRef.current
    if (!current?.activeTitle) return
    const token = ++openToken.current
    setView((latest) => (latest ? { ...latest, status: 'loading', error: '' } : latest))
    try {
      const table = await runRef.current(() => readSheetTable(current.id, current.activeTitle))
      if (openToken.current !== token) return
      setView((latest) =>
        latest && latest.id === current.id && latest.activeTitle === current.activeTitle
          ? { ...latest, table, status: 'ready', error: '' }
          : latest,
      )
    } catch (error) {
      if (openToken.current !== token) return
      setView((latest) =>
        latest && latest.id === current.id
          ? { ...latest, status: 'error', error: error?.message || 'Could not reload rows.' }
          : latest,
      )
    }
  }

  async function changeRows(task) {
    const current = viewRef.current
    if (!current?.activeTitle || !Number.isInteger(current.sheetId)) {
      throw new Error('Choose a spreadsheet tab first.')
    }
    await runRef.current(() => task(current))
    const token = ++openToken.current
    try {
      const table = await runRef.current(() => readSheetTable(current.id, current.activeTitle))
      if (openToken.current !== token) return
      setView((latest) =>
        latest && latest.id === current.id && latest.activeTitle === current.activeTitle
          ? { ...latest, table, sheetId: current.sheetId, status: 'ready', error: '' }
          : latest,
      )
    } catch (error) {
      if (openToken.current !== token) return
      setView((latest) =>
        latest && latest.id === current.id
          ? { ...latest, status: 'error', error: error?.message || 'The change was saved, but the table could not be reloaded.' }
          : latest,
      )
    }
  }

  const shareDialog = shareFile ? (
    <ShareDialog file={shareFile} runGoogle={runGoogle} onClose={() => setShareFile(null)} />
  ) : null

  if (view) {
    return (
      <>
        <SheetTable
        key={`${view.id}:${view.activeTitle}`}
        title={view.title}
        url={view.url}
        tabs={view.tabs}
        activeTitle={view.activeTitle}
        table={view.table}
        status={view.status}
        error={view.error}
        onBack={() => {
          setView(null)
          refreshList({ background: true })
        }}
        onSelectTab={selectTab}
        onReload={reloadTable}
        onAdd={(cells) =>
          changeRows((current) =>
            appendSheetRow(
              current.id,
              current.sheetId,
              current.activeTitle,
              (current.table?.rows.length || 0) + 1,
              cells,
            ),
          )
        }
        onAddColumn={(name, columnIndex, columnType) =>
          changeRows((current) => {
            const tab = current.tabs.find((item) => item.sheetId === current.sheetId)
            return appendSheetColumn(
              current.id,
              current.sheetId,
              columnIndex,
              name,
              columnType,
              tab?.rowCount || 1000,
            )
          })
        }
        onUpdate={(sheetRow, cells) =>
          changeRows((current) => updateSheetRow(current.id, current.sheetId, current.activeTitle, sheetRow, cells))
        }
        onDelete={(sheetRow) => changeRows((current) => deleteSheetRow(current.id, current.sheetId, sheetRow))}
        onDeleteColumn={(columnIndex) =>
          changeRows((current) => deleteSheetColumn(current.id, current.sheetId, columnIndex))
        }
        onShare={() => setShareFile({ id: view.id, name: view.title })}
        />
        {shareDialog}
      </>
    )
  }

  return (
    <>
      <SpreadsheetLibrary
      files={files}
      query={query}
      onQueryChange={setQuery}
      status={listStatus}
      error={listError}
      refreshing={refreshing}
      loadingMore={loadingMore}
      hasMore={Boolean(nextPageToken)}
      onRefresh={() => refreshList({ background: listStatus === 'ready' })}
      onLoadMore={loadMore}
      onView={openFile}
        onShare={setShareFile}
      />
      {shareDialog}
    </>
  )
}
