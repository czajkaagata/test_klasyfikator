import type { ElementResult, ReviewState } from '../types'
import { TYPE_ABBR } from '../types'
import { pct, shortGuid, typeColor } from '../utils'

interface Props {
  elements: ElementResult[]
  review: Record<string, ReviewState>
  selectedGuid: string | null
  onSelect: (guid: string) => void
}

export default function Sidebar({ elements, review, selectedGuid, onSelect }: Props) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">Podejrzane elementy</div>
      <div className="sidebar-list">
        {elements.map((el) => {
          const status = review[el.guid]?.status ?? 'pending'
          return (
            <div
              key={el.guid}
              className={[
                'elrow',
                el.guid === selectedGuid ? 'selected' : '',
                status !== 'pending' ? 'dimmed' : '',
              ].join(' ')}
              onClick={() => onSelect(el.guid)}
            >
              {status !== 'pending' && (
                <span className={`status-badge ${status}`}>
                  {status === 'accepted' ? 'Zaakceptowano' : 'Odrzucono'}
                </span>
              )}
              <div className="elrow-top">
                <div className="type-badge" style={{ background: typeColor(el.currentType) }}>
                  {TYPE_ABBR[el.currentType] ?? '??'}
                </div>
                <div className="elrow-name">{el.name}</div>
              </div>
              <div className="elrow-guid">{shortGuid(el.guid)}</div>
              <div className="class-line">
                {el.currentType.replace('Ifc', '')} → <b>{el.suggestedType.replace('Ifc', '')}</b>
              </div>
              <div className="conf-track">
                <div className="conf-fill" style={{ width: pct(el.confidence) }} />
              </div>
              <div className="conf-label">{pct(el.confidence)} pewności</div>
            </div>
          )
        })}
        {elements.length === 0 && (
          <div style={{ padding: 16, fontSize: 12.5, color: 'var(--ink-soft)' }}>
            Brak elementów do przeglądu w tym modelu.
          </div>
        )}
      </div>
    </div>
  )
}
