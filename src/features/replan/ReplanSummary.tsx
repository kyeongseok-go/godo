import { ArrowRight, Undo2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { paths } from '../../app/nav'
import '../plan/ritual.css'
import { describeSummary } from './flow'
import type { ReplanSummary as Summary } from './flow'
import './replan.css'

interface ReplanSummaryProps {
  summary: Summary
  canUndo: boolean
  onUndo: () => void
}

const ROWS: Array<[keyof Summary, string]> = [
  ['today', '오늘로 다시 잡음'],
  ['otherDay', '다른 날로 옮김'],
  ['inbox', '받은편지함으로'],
  ['done', '완료'],
  ['someday', '언젠가로 보관'],
  ['deleted', '삭제'],
]

export function ReplanSummary({ summary, canUndo, onUndo }: ReplanSummaryProps) {
  const empty = summary.total === 0
  return (
    <section className="replan-summary" aria-labelledby="replan-summary-title">
      <p className="replan-summary__kicker">{empty ? '정리할 게 없어요' : '정리 끝'}</p>
      <h2 className="replan-summary__title" id="replan-summary-title">
        {empty ? '밀린 일이 없어요. 가볍게 시작해요.' : describeSummary(summary)}
      </h2>
      {empty ? null : (
        <dl className="replan-summary__rows">
          {ROWS.filter(([key]) => summary[key] > 0).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{summary[key]}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="replan-card__calm">
        {empty ? '오늘 할 일을 골라 볼까요?' : '수고했어요. 이제 오늘 하루를 가볍게 짜 봐요.'}
      </p>
      <div className="replan-summary__actions">
        <Link to={paths.plan} className="ritual-btn ritual-btn--primary">
          오늘 계획하기
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        {empty ? null : (
          <button type="button" className="ritual-btn ritual-btn--quiet" disabled={!canUndo} onClick={onUndo}>
            <Undo2 size={16} aria-hidden="true" />
            마지막 결정 되돌리기
            <kbd className="keycap" aria-hidden="true">
              ⌫
            </kbd>
          </button>
        )}
      </div>
    </section>
  )
}
