import { TARGET_TYPES } from '../types'
import type { ElementResult, IfcTypeName, ReviewState } from '../types'
import { pct, shortGuid } from '../utils'

interface Props {
  elements: ElementResult[]
  review: Record<string, ReviewState>
  selectedGuid: string | null
  onSelect: (guid: string) => void
  onAccept: (guid: string) => void
  onReject: (guid: string) => void
  onManualChange: (guid: string, type: IfcTypeName) => void
  onManualSave: (guid: string) => void
}

export default function ListView({
  elements,
  review,
  selectedGuid,
  onSelect,
  onAccept,
  onReject,
  onManualChange,
  onManualSave,
}: Props) {
  return (
    <div className="list-view">
      <div className="table-card">
        <table className="el-table">
          <colgroup>
            <col style={{ width: '17%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '23%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Element</th>
              <th>GUID</th>
              <th>Klasyfikacja</th>
              <th>Pewność</th>
              <th>Status</th>
              <th>Popraw klasyfikację</th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {elements.map((el) => {
              const r = review[el.guid] ?? { status: 'pending' as const }
              return (
                <tr
                  key={el.guid}
                  className={[r.status !== 'pending' ? 'dimmed' : '', el.guid === selectedGuid ? 'selected' : ''].join(' ')}
                  onClick={() => onSelect(el.guid)}
                >
                  <td title={el.name}>{el.name}</td>
                  <td className="guid-cell" title={el.guid}>
                    {shortGuid(el.guid)}
                  </td>
                  <td style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>
                    {el.currentType.replace('Ifc', '')} → <b style={{ color: 'var(--accent-ink)' }}>{el.suggestedType.replace('Ifc', '')}</b>
                  </td>
                  <td>{pct(el.confidence)}</td>
                  <td>
                    {r.status === 'pending' ? (
                      <span style={{ color: 'var(--ink-faint)' }}>Oczekuje</span>
                    ) : (
                      <span className={`status-badge ${r.status}`} style={{ position: 'static' }}>
                        {r.status === 'accepted' ? 'Zaakceptowano' : 'Odrzucono'}
                      </span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="reclassify-cell">
                      <select
                        value={r.manualType ?? el.suggestedType}
                        onChange={(e) => onManualChange(el.guid, e.target.value as IfcTypeName)}
                      >
                        {TARGET_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.replace('Ifc', '')}
                          </option>
                        ))}
                      </select>
                      <button className="action-btn save" onClick={() => onManualSave(el.guid)}>
                        Zapisz
                      </button>
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="action-col">
                      <button className="action-btn accept" onClick={() => onAccept(el.guid)}>
                        Akceptuj
                      </button>
                      <button className="action-btn reject" onClick={() => onReject(el.guid)}>
                        Odrzuć
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
