import { TARGET_TYPES } from '../types'
import type { ElementResult, ReviewState } from '../types'
import { pct, typeColor } from '../utils'

interface Props {
  elements: ElementResult[]
  review: Record<string, ReviewState>
}

export default function DashboardView({ elements, review }: Props) {
  const total = elements.length
  const statuses = elements.map((el) => review[el.guid]?.status ?? 'pending')
  const accepted = statuses.filter((s) => s === 'accepted').length
  const rejected = statuses.filter((s) => s === 'rejected').length
  const pending = total - accepted - rejected
  const avgConfidence = total ? elements.reduce((sum, el) => sum + el.confidence, 0) / total : 0
  const manualSaved = Object.values(review).filter((r) => r.savedManual).length

  const perType = TARGET_TYPES.map((t) => ({
    type: t,
    count: elements.filter((el) => el.suggestedType === t).length,
  }))
  const maxPerType = Math.max(1, ...perType.map((p) => p.count))

  return (
    <div className="dashboard">
      <div className="stat-cards">
        <div className="stat-card">
          <div className="num">{total}</div>
          <div className="label">Elementy do przeglądu</div>
        </div>
        <div className="stat-card">
          <div className="num" style={{ color: 'var(--ink-soft)' }}>
            {pending}
          </div>
          <div className="label">Oczekujące</div>
        </div>
        <div className="stat-card">
          <div className="num" style={{ color: 'var(--good-ink)' }}>
            {accepted}
          </div>
          <div className="label">Zaakceptowane</div>
        </div>
        <div className="stat-card">
          <div className="num" style={{ color: 'var(--ink-faint)' }}>
            {rejected}
          </div>
          <div className="label">Odrzucone</div>
        </div>
      </div>

      <div className="dash-panels">
        <div className="dash-panel">
          <h3>Oflagowane elementy wg sugerowanego typu</h3>
          {perType.map((p) => (
            <div className="bar-row" key={p.type}>
              <div>{p.type.replace('Ifc', '')}</div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${(p.count / maxPerType) * 100}%`, background: typeColor(p.type) }}
                />
              </div>
              <div style={{ textAlign: 'right' }}>{p.count}</div>
            </div>
          ))}
        </div>

        <div className="dash-panel">
          <h3>Postęp weryfikacji</h3>
          <div className="progress-track">
            {accepted > 0 && (
              <div style={{ width: `${(accepted / total) * 100}%`, background: 'var(--good-ink)' }} />
            )}
            {rejected > 0 && (
              <div style={{ width: `${(rejected / total) * 100}%`, background: 'var(--border-strong)' }} />
            )}
            {pending > 0 && (
              <div style={{ width: `${(pending / total) * 100}%`, background: 'var(--bg)' }} />
            )}
          </div>
          <div className="progress-legend">
            <span>
              <span className="legend-dot" style={{ background: 'var(--good-ink)' }} /> Zaakceptowane {pct(total ? accepted / total : 0)}
            </span>
            <span>
              <span className="legend-dot" style={{ background: 'var(--border-strong)' }} /> Odrzucone {pct(total ? rejected / total : 0)}
            </span>
            <span>
              <span className="legend-dot" style={{ background: 'var(--ink-faint)' }} /> Oczekujące {pct(total ? pending / total : 0)}
            </span>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 24 }}>
            <div>
              <div className="detail-conf-label">Średnia pewność modelu</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600 }}>{pct(avgConfidence)}</div>
            </div>
            <div>
              <div className="detail-conf-label">Ręcznych reklasyfikacji</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600 }}>{manualSaved}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
