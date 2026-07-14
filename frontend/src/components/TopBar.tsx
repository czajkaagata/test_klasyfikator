import type { ViewMode } from '../types'

interface Props {
  fileName: string | null
  fileLoaded: boolean
  pendingCount: number
  viewMode: ViewMode
  onPickFile: () => void
  onSetView: (v: ViewMode) => void
}

export default function TopBar({ fileName, fileLoaded, pendingCount, viewMode, onPickFile, onSetView }: Props) {
  return (
    <div className="topbar">
      <div className="topbar-brand">
        <div className="topbar-badge">IFC</div>
        <div className="topbar-title">Klasyfikator elementów IFC</div>
      </div>

      <div className="topbar-divider" />

      <button className="btn btn-dark" onClick={onPickFile}>
        Załaduj model IFC
      </button>

      {fileName && <div className="topbar-filename">{fileName}</div>}

      <div className="topbar-spacer" />

      {fileLoaded && (
        <div className="pending-pill">
          <span className="pending-dot" />
          {pendingCount} podejrzanych elementów
        </div>
      )}

      {fileLoaded && (
        <div className="view-switch">
          <button className={viewMode === '3d' ? 'active' : ''} onClick={() => onSetView('3d')}>
            3D
          </button>
          <button className={viewMode === 'list' ? 'active' : ''} onClick={() => onSetView('list')}>
            Lista
          </button>
          <button className={viewMode === 'dashboard' ? 'active' : ''} onClick={() => onSetView('dashboard')}>
            Dashboard
          </button>
        </div>
      )}
    </div>
  )
}
