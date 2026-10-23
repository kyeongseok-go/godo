import { daysBetween } from '../../domain/date'
import type { SummaryOptions } from '../../domain/stats'
import type { ID, ISODate, Project } from '../../domain/types'
import { ChoiceGroup } from './ChoiceGroup'
import { RANGE_LABELS, STATUS_LABELS, toggleProject } from './params'
import type { SummaryParams, SummaryRange, SummaryStatus } from './params'

const RANGE_OPTIONS = (Object.keys(RANGE_LABELS) as SummaryRange[]).map((value) => ({ value, label: RANGE_LABELS[value] }))
const STATUS_OPTIONS = (['completed', 'pending', 'all'] as const).map((value): { value: SummaryStatus; label: string } => ({
  value,
  label: STATUS_LABELS[value],
}))

interface OptionsPanelProps {
  params: SummaryParams
  resolved: Pick<SummaryOptions, 'from' | 'to'>
  projects: readonly Project[]
  onChange: (next: SummaryParams) => void
}

function DateFields({ from, to, onChange }: { from: ISODate; to: ISODate; onChange: (from: ISODate, to: ISODate) => void }) {
  return (
    <div className="sum-dates">
      <label className="sum-date">
        <span>시작</span>
        <input type="date" value={from} onChange={(e) => e.target.value && onChange(e.target.value, to)} />
      </label>
      <span className="sum-dates__tilde" aria-hidden="true">~</span>
      <label className="sum-date">
        <span>끝</span>
        <input type="date" value={to} onChange={(e) => e.target.value && onChange(from, e.target.value)} />
      </label>
    </div>
  )
}

function ProjectChips({ selected, projects, onToggle, onAll }: {
  selected: readonly ID[] | null
  projects: readonly Project[]
  onToggle: (id: ID) => void
  onAll: () => void
}) {
  return (
    <fieldset className="sum-field">
      <legend className="sum-field__legend">프로젝트</legend>
      <div className="sum-chips">
        <button type="button" className="sum-chip sum-chip--button" aria-pressed={selected === null} onClick={onAll}>
          <span className="sum-chip__face">전체</span>
        </button>
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className="sum-chip sum-chip--button"
            aria-pressed={selected?.includes(project.id) ?? false}
            onClick={() => onToggle(project.id)}
          >
            <span className="sum-chip__face">
              <i className="dot" style={{ background: project.color }} aria-hidden="true" />
              {project.name}
              {project.archived ? <span className="sum-chip__tag">보관</span> : null}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function OptionsPanel({ params, resolved, projects, onChange }: OptionsPanelProps) {
  const days = daysBetween(resolved.from, resolved.to) + 1
  const allIds = projects.map((project) => project.id)

  return (
    <div className="sum-options">
      <ChoiceGroup
        legend="기간"
        name="summary-range"
        value={params.range}
        options={RANGE_OPTIONS}
        onChange={(range) =>
          onChange(range === 'custom' ? { ...params, range, from: resolved.from, to: resolved.to } : { ...params, range })
        }
      />
      {params.range === 'custom' ? (
        <DateFields from={resolved.from} to={resolved.to} onChange={(from, to) => onChange({ ...params, from, to })} />
      ) : null}
      <p className="sum-range" aria-live="polite">
        {resolved.from} ~ {resolved.to}
        <span className="sum-range__days">{days}일</span>
      </p>

      <ProjectChips
        selected={params.projectIds}
        projects={projects}
        onAll={() => onChange({ ...params, projectIds: null })}
        onToggle={(id) => onChange({ ...params, projectIds: toggleProject(params.projectIds, id, allIds) })}
      />

      <ChoiceGroup
        legend="상태"
        name="summary-status"
        value={params.status}
        options={STATUS_OPTIONS}
        onChange={(status) => onChange({ ...params, status })}
      />
    </div>
  )
}
