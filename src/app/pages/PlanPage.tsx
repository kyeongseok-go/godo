import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fromISODate, WEEKDAY_KO } from '../../domain/date'
import { useToday } from '../../hooks/data'
import { EveningPlan } from '../../features/plan/EveningPlan'
import { MorningPlan } from '../../features/plan/MorningPlan'
import { defaultPlanTab } from '../../features/plan/logic'
import type { PlanTab } from '../../features/plan/logic'
import { PageHeader } from '../PageHeader'
import '../../features/plan/plan.css'

const TABS: ReadonlyArray<{ id: PlanTab; label: string; Icon: typeof Sun }> = [
  { id: 'morning', label: '아침 계획', Icon: Sun },
  { id: 'evening', label: '저녁 회고', Icon: Moon },
]

function dateLabel(iso: string): string {
  const d = fromISODate(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_KO[d.getDay()]})`
}

const isTab = (value: string | null): value is PlanTab => value === 'morning' || value === 'evening'

/** F2·F4·F6: 오후 3시 전에는 아침 계획, 이후에는 저녁 회고가 먼저 열린다. 탭은 주소(?tab=)에 남는다. */
export function PlanPage() {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const fromUrl = params.get('tab')
  // 주소에 탭이 없을 때만 시각으로 정한다. 화면을 보는 도중에 바뀌지 않게 처음 한 번만 계산한다.
  const [clockTab] = useState<PlanTab>(() => defaultPlanTab(new Date()))
  const tab: PlanTab = isTab(fromUrl) ? fromUrl : clockTab

  const select = (next: PlanTab) => setParams({ tab: next }, { replace: true })
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = tab === 'morning' ? 'evening' : 'morning'
    select(next)
    document.getElementById(`plan-tab-${next}`)?.focus()
  }

  return (
    <>
      <PageHeader
        eyebrow={dateLabel(today)}
        title="오늘 계획하기"
        description="가볍게 정해요. 다 못 해도 괜찮고, 언제든 미뤄도 돼요."
        actions={
          <div className="plan-tabs" role="tablist" aria-label="계획 시간대" onKeyDown={onKeyDown}>
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                id={`plan-tab-${id}`}
                type="button"
                role="tab"
                className="plan-tabs__tab"
                aria-selected={tab === id}
                aria-controls="plan-panel"
                tabIndex={tab === id ? 0 : -1}
                onClick={() => select(id)}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        }
      />
      <div id="plan-panel" role="tabpanel" aria-labelledby={`plan-tab-${tab}`}>
        {tab === 'morning' ? <MorningPlan /> : <EveningPlan />}
      </div>
    </>
  )
}
