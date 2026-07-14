import { useMemo, useRef, useState } from 'react'
import './App.css'
import TopBar from './components/TopBar'
import Sidebar from './components/Sidebar'
import DetailPanel from './components/DetailPanel'
import ListView from './components/ListView'
import DashboardView from './components/DashboardView'
import IfcViewer, { type IfcViewerHandle } from './IfcViewer'
import { classifyIfc } from './api'
import type { ClassifyResponse, IfcTypeName, ReviewState, ViewMode } from './types'

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const viewerRef = useRef<IfcViewerHandle>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ClassifyResponse | null>(null)
  const [review, setReview] = useState<Record<string, ReviewState>>({})
  const [selectedGuid, setSelectedGuid] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('3d')

  const flagged = useMemo(() => result?.elements.filter((el) => el.mismatch) ?? [], [result])
  const pendingCount = flagged.filter((el) => (review[el.guid]?.status ?? 'pending') === 'pending').length
  const selectedElement = flagged.find((el) => el.guid === selectedGuid) ?? null
  const fileLoaded = !!result

  function triggerFileInput() {
    fileInputRef.current?.click()
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setLoading(true)
    setError(null)
    setResult(null)
    setReview({})
    setSelectedGuid(null)
    setFileName(file.name)

    try {
      const [classifyResult] = await Promise.all([
        classifyIfc(file),
        viewerRef.current?.loadFile(file).catch((err) => {
          console.error(err)
          const detail = err instanceof Error ? err.message : String(err)
          setError((prev) => prev ?? `Nie udało się wczytać geometrii do widoku 3D: ${detail} (klasyfikacja mimo to działa — sprawdź widok Lista/Dashboard).`)
        }),
      ])
      setResult(classifyResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd klasyfikacji')
      setFileName(null)
    } finally {
      setLoading(false)
    }
  }

  async function onSelect(guid: string) {
    const next = guid === selectedGuid ? null : guid
    setSelectedGuid(next)
    await viewerRef.current?.highlightGuid(next)
  }

  function updateReview(guid: string, patch: Partial<ReviewState>) {
    setReview((prev) => {
      const current: ReviewState = prev[guid] ?? { status: 'pending' }
      return { ...prev, [guid]: { ...current, ...patch } }
    })
  }

  return (
    <div className="app">
      <input ref={fileInputRef} type="file" accept=".ifc" style={{ display: 'none' }} onChange={onFileChosen} />

      <TopBar
        fileName={fileName}
        fileLoaded={fileLoaded}
        pendingCount={pendingCount}
        viewMode={viewMode}
        onPickFile={triggerFileInput}
        onSetView={setViewMode}
      />

      {error && <div className="error-banner">{error}</div>}

      <div className="body">
        {fileLoaded && <Sidebar elements={flagged} review={review} selectedGuid={selectedGuid} onSelect={onSelect} />}

        <div className="main">
          {!fileLoaded && !loading && (
            <div className="empty-state">
              <div className="empty-card" onClick={triggerFileInput}>
                <div className="empty-icon">📐</div>
                <div className="empty-title">Przeciągnij plik IFC lub kliknij, aby załadować</div>
                <div className="empty-sub">Model zostanie przepuszczony przez klasyfikator elementów</div>
              </div>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              Przetwarzanie modelu przez klasyfikator...
            </div>
          )}

          <div className="viewport-wrap" style={{ display: fileLoaded && !loading && viewMode === '3d' ? 'block' : 'none' }}>
            <IfcViewer ref={viewerRef} onError={setError} />
            <div className="viewport-watermark">IFC VIEWER — THAT OPEN COMPANY</div>
          </div>

          {fileLoaded && !loading && viewMode === 'list' && (
            <ListView
              elements={flagged}
              review={review}
              selectedGuid={selectedGuid}
              onSelect={onSelect}
              onAccept={(g) => updateReview(g, { status: 'accepted' })}
              onReject={(g) => updateReview(g, { status: 'rejected' })}
              onManualChange={(g, t) => updateReview(g, { manualType: t, savedManual: false })}
              onManualSave={(g) => updateReview(g, { savedManual: true })}
            />
          )}

          {fileLoaded && !loading && viewMode === 'dashboard' && <DashboardView elements={flagged} review={review} />}
        </div>

        {viewMode === '3d' && selectedElement && (
          <DetailPanel
            element={selectedElement}
            review={review[selectedElement.guid] ?? { status: 'pending' }}
            onClose={() => onSelect(selectedElement.guid)}
            onAccept={() => updateReview(selectedElement.guid, { status: 'accepted' })}
            onReject={() => updateReview(selectedElement.guid, { status: 'rejected' })}
            onManualChange={(t: IfcTypeName) => updateReview(selectedElement.guid, { manualType: t, savedManual: false })}
            onManualSave={() => updateReview(selectedElement.guid, { savedManual: true })}
          />
        )}
      </div>
    </div>
  )
}
