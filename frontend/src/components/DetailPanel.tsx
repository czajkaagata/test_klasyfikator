import { TARGET_TYPES, TYPE_LABEL } from '../types'
import type { ElementResult, IfcTypeName, ReviewState } from '../types'
import { pct } from '../utils'

interface Props {
  element: ElementResult
  review: ReviewState
  onClose: () => void
  onAccept: () => void
  onReject: () => void
  onManualChange: (type: IfcTypeName) => void
  onManualSave: () => void
}

export default function DetailPanel({ element, review, onClose, onAccept, onReject, onManualChange, onManualSave }: Props) {
  const probs = Object.entries(element.probabilities)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k.replace('Ifc', '')} ${pct(v)}`)
    .join(' · ')

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-eyebrow">Szczegóły elementu</div>
        <button className="detail-close" onClick={onClose} aria-label="Zamknij">
          ×
        </button>
      </div>

      <div className="detail-name">{element.name}</div>
      <div className="detail-guid">{element.guid}</div>

      <div className="chip-row">
        <div className="chip current">Obecna: {element.currentType.replace('Ifc', '')}</div>
        <span className="chip-arrow">→</span>
        <div className="chip suggested">Sugerowana: {element.suggestedType.replace('Ifc', '')}</div>
      </div>

      <div className="detail-conf-label">Pewność modelu</div>
      <div className="detail-conf-track">
        <div className="detail-conf-fill" style={{ width: pct(element.confidence) }} />
      </div>
      <div className="detail-conf-num">{pct(element.confidence)}</div>

      <div className="reasoning-box">
        Klasyfikacja oparta wyłącznie na geometrii elementu (kształt, smukłość, orientacja
        względem pionu, regularność przekroju) — bez odczytu zapisanego typu IFC. Rozkład
        prawdopodobieństw modelu: {probs}.
      </div>

      {review.status !== 'pending' && (
        <div className="status-confirm">
          Status: <strong>{review.status === 'accepted' ? 'Zaakceptowano sugestię' : 'Odrzucono sugestię'}</strong>
        </div>
      )}

      <div className="manual-block">
        <label>Popraw klasyfikację ręcznie</label>
        <div className="manual-row">
          <select
            value={review.manualType ?? element.suggestedType}
            onChange={(e) => onManualChange(e.target.value as IfcTypeName)}
          >
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]} ({t.replace('Ifc', '')})
              </option>
            ))}
          </select>
          <button className="action-btn save" onClick={onManualSave}>
            Zapisz
          </button>
        </div>
        {review.savedManual && (
          <div className="saved-banner">Zapisano ręczną klasyfikację: {review.manualType?.replace('Ifc', '')}</div>
        )}
      </div>

      <div className="detail-actions">
        <button className="btn btn-dark" onClick={onAccept}>
          Akceptuj sugestię
        </button>
        <button className="btn btn-outline" onClick={onReject}>
          Odrzuć
        </button>
      </div>
    </div>
  )
}
