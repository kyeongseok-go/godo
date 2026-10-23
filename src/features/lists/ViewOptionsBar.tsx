import { ArrowDownAZ, ArrowUpAZ, Eye, EyeOff } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { GroupBy, SortBy } from '../../domain/views'
import { GROUP_LABELS, readOptions, SORT_LABELS, writeOptions } from './viewOptions'
import './view-options.css'

interface ViewOptionsBarProps {
  /** 프로젝트 안에서는 섹션 그룹이 이미 있으니 그룹 선택에서 뺄 항목 */
  hideGroups?: readonly GroupBy[]
}

export function ViewOptionsBar({ hideGroups = [] }: ViewOptionsBarProps) {
  const [params, setParams] = useSearchParams()
  const opts = readOptions(params)
  const update = (patch: Parameters<typeof writeOptions>[1]) => setParams(writeOptions(params, patch), { replace: true })

  return (
    <div className="vopts" role="group" aria-label="보기 옵션">
      <label>
        <span>정렬</span>
        <select value={opts.sort} onChange={(e) => update({ sort: e.target.value as SortBy })}>
          {(Object.keys(SORT_LABELS) as SortBy[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      {opts.sort !== 'manual' ? (
        <button
          type="button"
          className="vopts__btn"
          aria-label={opts.dir === 'asc' ? '오름차순 (눌러서 내림차순)' : '내림차순 (눌러서 오름차순)'}
          onClick={() => update({ dir: opts.dir === 'asc' ? 'desc' : 'asc' })}
        >
          {opts.dir === 'asc' ? <ArrowDownAZ size={15} aria-hidden="true" /> : <ArrowUpAZ size={15} aria-hidden="true" />}
        </button>
      ) : null}
      <label>
        <span>그룹</span>
        <select value={opts.group} onChange={(e) => update({ group: e.target.value as GroupBy })}>
          {(Object.keys(GROUP_LABELS) as GroupBy[])
            .filter((k) => !hideGroups.includes(k))
            .map((k) => (
              <option key={k} value={k}>
                {GROUP_LABELS[k]}
              </option>
            ))}
        </select>
      </label>
      <button type="button" className="vopts__btn" data-on={opts.showDone} onClick={() => update({ showDone: !opts.showDone })}>
        {opts.showDone ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
        완료한 일 {opts.showDone ? '보임' : '숨김'}
      </button>
    </div>
  )
}
