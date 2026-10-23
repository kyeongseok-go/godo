import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../../app/PageHeader'
import type { Countdown } from '../../domain/types'
import { useTable, useToday } from '../../hooks/data'
import { CountdownDialog } from './CountdownDialog'
import type { CountdownPreset } from './CountdownDialog'
import { CountdownRow } from './CountdownRow'
import { COUNTDOWN_EXAMPLES, splitCountdowns } from './countdownView'
import './countdown.css'

interface Editing {
  countdown: Countdown | null
  preset: CountdownPreset | null
}

export function CountdownScreen() {
  const countdowns = useTable('countdowns')
  const today = useToday()
  const [editing, setEditing] = useState<Editing | null>(null)
  const { upcoming, passed } = useMemo(() => splitCountdowns(countdowns, today), [countdowns, today])

  const nearest = upcoming[0]
  const description = nearest
    ? nearest.info.daysLeft === 0
      ? `오늘은 '${nearest.countdown.name}'이에요.`
      : `가장 가까운 건 '${nearest.countdown.name}', ${nearest.info.daysLeft}일 남았어요.`
    : '기다리는 날을 등록해 두면 며칠 남았는지 보여드려요.'

  return (
    <div className="cd">
      <PageHeader
        title="디데이"
        eyebrow="남은 날 세기"
        count={upcoming.length}
        description={description}
        actions={
          <button type="button" className="btn-accent cd__add" onClick={() => setEditing({ countdown: null, preset: null })}>
            <Plus size={16} aria-hidden="true" /> 새 디데이
          </button>
        }
      />

      {countdowns.length === 0 ? (
        <section className="cdempty" aria-labelledby="cd-empty-title">
          <p className="cdempty__big" aria-hidden="true">
            D-?
          </p>
          <div className="cdempty__body">
            <h2 id="cd-empty-title">기다리는 날이 있나요?</h2>
            <p>이름과 날짜만 정하면 남은 날수를 크게 보여드려요. 자주 쓰는 걸로 시작해 보세요.</p>
            <ul className="cdempty__chips" aria-label="예시 디데이">
              {COUNTDOWN_EXAMPLES.map((example) => (
                <li key={example.name}>
                  <button type="button" className="cdchip" onClick={() => setEditing({ countdown: null, preset: example })}>
                    {example.name}
                    <small>{example.repeatYearly ? '매년' : '한 번'}</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <ul className="cdlist" aria-label="다가오는 디데이">
              {upcoming.map((entry, i) => (
                <CountdownRow key={entry.countdown.id} entry={entry} hero={i === 0} onEdit={() => setEditing({ countdown: entry.countdown, preset: null })} />
              ))}
            </ul>
          ) : (
            <p className="page-note">다가오는 디데이가 없어요. 지난 항목은 아래에 있어요.</p>
          )}
          {passed.length > 0 ? (
            <details className="cdpassed">
              <summary>
                지난 디데이 <span>{passed.length}</span>
              </summary>
              <ul className="cdlist" aria-label="지난 디데이">
                {passed.map((entry) => (
                  <CountdownRow key={entry.countdown.id} entry={entry} onEdit={() => setEditing({ countdown: entry.countdown, preset: null })} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}

      <CountdownDialog open={editing !== null} countdown={editing?.countdown ?? null} preset={editing?.preset ?? null} today={today} onClose={() => setEditing(null)} />
    </div>
  )
}
