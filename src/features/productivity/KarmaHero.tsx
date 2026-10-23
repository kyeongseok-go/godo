import { Check } from 'lucide-react'
import type { KarmaSummary } from '../../domain/stats'
import { levelProgress } from './chart'
import './ledger.css'

const formatNumber = (value: number): string => value.toLocaleString('ko-KR')

function LevelRule({ summary }: { summary: KarmaSummary }) {
  const { ratio, remaining } = levelProgress(summary.points, summary.levelIndex, summary.nextLevelAt)
  const percent = Math.round(ratio * 100)
  return (
    <div className="prod-level">
      <div
        className="prod-level__rule"
        role="progressbar"
        aria-label="다음 레벨까지 진행"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={remaining === null ? '최고 레벨' : `${percent}%, ${formatNumber(remaining)}점 남음`}
      >
        <span className="prod-level__fill" style={{ ['--ratio' as string]: ratio }} />
      </div>
      <p className="prod-level__caption">
        {remaining === null ? '가장 높은 레벨이에요.' : `다음 레벨까지 ${formatNumber(remaining)}점`}
        <span className="prod-level__percent">{percent}%</span>
      </p>
    </div>
  )
}

export function KarmaHero({ summary, enabled }: { summary: KarmaSummary; enabled: boolean }) {
  if (!enabled) {
    return (
      <div className="prod-hero prod-hero--off">
        <p className="prod-hero__eyebrow">카르마</p>
        <p className="prod-hero__off">카르마가 꺼져 있어요</p>
        <p className="prod-hero__sub">점수와 레벨은 숨겼고, 아래 목표와 연속 기록은 계속 세요. 설정에서 다시 켤 수 있어요.</p>
      </div>
    )
  }
  return (
    <div className="prod-hero">
      <p className="prod-hero__eyebrow">카르마</p>
      <div className="prod-hero__score">
        <span className="prod-hero__points">{formatNumber(summary.points)}</span>
        <span className="prod-hero__level">{summary.level}</span>
      </div>
      <LevelRule summary={summary} />
    </div>
  )
}

interface StatProps {
  label: string
  value: number
  unit: string
  goal?: number
  met?: boolean
  note?: string
}

function Stat({ label, value, unit, goal, met, note }: StatProps) {
  const ratio = goal ? Math.min(1, value / goal) : 0
  return (
    <div className="prod-stat" data-met={met === true}>
      <p className="prod-stat__label">{label}</p>
      <p className="prod-stat__value">
        {value}
        {goal !== undefined ? <span className="prod-stat__goal">/ {goal}</span> : <span className="prod-stat__goal">{unit}</span>}
      </p>
      {goal !== undefined ? (
        <>
          <span className="prod-stat__rule" aria-hidden="true"><span style={{ ['--ratio' as string]: ratio }} /></span>
          <p className="prod-stat__note">
            {met ? <><Check size={13} strokeWidth={3} aria-hidden="true" /> 목표 달성</> : `${Math.max(0, goal - value)}건 남음`}
          </p>
        </>
      ) : (
        <p className="prod-stat__note">{note}</p>
      )}
    </div>
  )
}

export interface StatRowProps {
  summary: KarmaSummary
  dailyGoal: number
  weeklyGoal: number
  vacationMode: boolean
}

export function StatRow({ summary, dailyGoal, weeklyGoal, vacationMode }: StatRowProps) {
  return (
    <div className="prod-stats">
      <Stat label="오늘 완료" value={summary.todayDone} unit="건" goal={Math.max(1, dailyGoal)} met={summary.dailyGoalMet} />
      <Stat label="이번 주 완료" value={summary.weekDone} unit="건" goal={Math.max(1, weeklyGoal)} met={summary.weeklyGoalMet} />
      <Stat label="현재 연속" value={summary.streakDays} unit="일" note={vacationMode ? '휴가 모드로 이어 가는 중' : '목표를 채운 날이 이어진 일수'} />
      <Stat label="최장 연속" value={summary.longestStreak} unit="일" note="지금까지의 최고 기록" />
    </div>
  )
}
