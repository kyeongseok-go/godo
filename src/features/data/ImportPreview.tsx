import { summarizeAppData } from './appData'
import type { ImportPlan } from './analyzeImport'
import type { ImportFlow } from './useImportFlow'

function formatExportedAt(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' })
}

function Counts({ items }: { items: ReadonlyArray<{ key: string; label: string; count: number }> }) {
  if (items.length === 0) return <p className="dt-preview__empty">가져올 항목이 없어요. 다른 파일을 골라 보세요.</p>
  return (
    <dl className="dt-counts">
      {items.map(({ key, label, count }) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{count}</dd>
        </div>
      ))}
    </dl>
  )
}

function Warnings({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null
  return (
    <details className="dt-warnings" open={items.length <= 3}>
      <summary>확인할 점 {items.length}개</summary>
      <ul>
        {items.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </details>
  )
}

function ModeChoice({ flow }: { flow: ImportFlow }) {
  return (
    <fieldset className="dt-mode">
      <legend>어떻게 가져올까요?</legend>
      <label className="dt-mode__option">
        <input type="radio" name="import-mode" checked={flow.mode === 'merge'} onChange={() => flow.setMode('merge')} />
        <span>
          <strong>병합</strong>
          <small>지금 데이터는 그대로 두고, 파일에만 있는 항목을 더해요. 같은 항목은 더 최근에 고친 쪽을 남겨요.</small>
        </span>
      </label>
      <label className="dt-mode__option">
        <input type="radio" name="import-mode" checked={flow.mode === 'replace'} onChange={() => flow.setMode('replace')} />
        <span>
          <strong>덮어쓰기</strong>
          <small>지금 데이터를 모두 지우고 파일 내용으로 바꿔요. 새 기기에서 복원할 때 알맞아요.</small>
        </span>
      </label>
    </fieldset>
  )
}

function JsonPreview({ plan, flow }: { plan: Extract<ImportPlan, { kind: 'json' }>; flow: ImportFlow }) {
  const counts = summarizeAppData(plan.data)
  return (
    <>
      <p className="dt-preview__meta">내보낸 시각: {formatExportedAt(plan.exportedAt)}</p>
      <Counts items={counts} />
      <Warnings items={flow.warnings} />
      {plan.data.settings && flow.mode === 'merge' ? <p className="dt-preview__note">파일에 담긴 설정(테마, 단축키 등)도 함께 적용돼요.</p> : null}
      <ModeChoice flow={flow} />
    </>
  )
}

function CsvPreview({ plan, flow }: { plan: Extract<ImportPlan, { kind: 'csv' }>; flow: ImportFlow }) {
  const counts = [
    { key: 'tasks', label: '할 일', count: plan.parsed.tasks.length },
    { key: 'sections', label: '섹션', count: plan.parsed.sections.length },
  ].filter((c) => c.count > 0)
  return (
    <>
      <Counts items={counts} />
      <Warnings items={flow.warnings} />
      <label className="dt-name">
        <span>새 프로젝트 이름</span>
        <input className="st-input" value={flow.csvName} onChange={(e) => flow.setCsvName(e.target.value)} />
      </label>
      <p className="dt-preview__note">지금 데이터는 건드리지 않고 새 프로젝트 하나로 넣어요. 반복 규칙과 라벨은 가져오지 않아요.</p>
    </>
  )
}

export function ImportPreview({ plan, flow }: { plan: ImportPlan; flow: ImportFlow }) {
  const nothing = plan.kind === 'json' ? summarizeAppData(plan.data).length === 0 : plan.parsed.tasks.length === 0
  return (
    <div className="dt-preview" aria-live="polite">
      <p className="dt-preview__file">
        <span>{plan.kind === 'json' ? 'Pace 백업' : 'Todoist CSV'}</span> {plan.fileName}
      </p>
      {plan.kind === 'json' ? <JsonPreview plan={plan} flow={flow} /> : <CsvPreview plan={plan} flow={flow} />}
      <div className="dt-preview__actions">
        <button type="button" className="st-btn" onClick={flow.cancel} disabled={flow.busy}>
          취소
        </button>
        <button type="button" className="st-btn st-btn--primary" onClick={flow.requestApply} disabled={flow.busy || nothing}>
          {flow.busy ? '가져오는 중…' : plan.kind === 'csv' ? '새 프로젝트로 가져오기' : flow.mode === 'merge' ? '병합해서 가져오기' : '덮어쓰기'}
        </button>
      </div>
    </div>
  )
}
