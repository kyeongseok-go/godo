import type { ReactNode } from 'react'
import { WEEKDAY_KO } from '../../domain/date'
import type { Settings, Weekday } from '../../domain/types'
import { useApp } from '../../store/app'
import { DAILY_GOAL_RANGE, orderedWeekdays, toggleDayOff, WEEKLY_GOAL_RANGE } from './goalModel'
import { NumberStepper } from './NumberStepper'
import { ToggleSwitch } from './ToggleSwitch'

type ProductivitySettings = Settings['productivity']

/** 바로 저장한다. 최신 설정을 스토어에서 읽어 덮어쓰므로 연속 조작에도 값이 유실되지 않는다. */
function save(patch: Partial<ProductivitySettings>): void {
  const state = useApp.getState()
  state.updateSettings({ productivity: { ...state.settings.productivity, ...patch } })
}

function Row({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="prod-setrow">
      <div className="prod-setrow__text">
        <p className="prod-setrow__title">{title}</p>
        {hint ? <p className="prod-setrow__hint">{hint}</p> : null}
      </div>
      <div className="prod-setrow__control">{children}</div>
    </div>
  )
}

function DayOffPicker({ daysOff, weekStartsOn }: { daysOff: readonly Weekday[]; weekStartsOn: 0 | 1 }) {
  return (
    <div className="prod-daypick" role="group" aria-label="쉬는 요일">
      {orderedWeekdays(weekStartsOn).map((day) => (
        <button
          key={day}
          type="button"
          className="prod-daypick__btn"
          aria-pressed={daysOff.includes(day)}
          aria-label={`${WEEKDAY_KO[day]}요일`}
          onClick={() => save({ daysOff: toggleDayOff(daysOff, day) })}
        >
          {WEEKDAY_KO[day]}
        </button>
      ))}
    </div>
  )
}

interface GoalSettingsProps {
  value: ProductivitySettings
  weekStartsOn: 0 | 1
}

export function GoalSettings({ value, weekStartsOn }: GoalSettingsProps) {
  return (
    <div className="prod-setlist">
      <Row title="카르마" hint="끄면 점수와 레벨만 숨겨요. 목표와 연속 기록은 그대로예요.">
        <ToggleSwitch checked={value.karmaEnabled} label="카르마 사용" onChange={(karmaEnabled) => save({ karmaEnabled })} />
      </Row>
      <Row title="일일 목표" hint="하루에 끝낼 일의 수">
        <NumberStepper value={value.dailyGoal} label="일일 목표" unit="건" range={DAILY_GOAL_RANGE} onChange={(dailyGoal) => save({ dailyGoal })} />
      </Row>
      <Row title="주간 목표" hint="한 주에 끝낼 일의 수">
        <NumberStepper value={value.weeklyGoal} label="주간 목표" unit="건" range={WEEKLY_GOAL_RANGE} onChange={(weeklyGoal) => save({ weeklyGoal })} />
      </Row>
      <Row title="쉬는 요일" hint="이 요일에 목표를 못 채워도 연속 기록이 끊기지 않아요.">
        <DayOffPicker daysOff={value.daysOff} weekStartsOn={weekStartsOn} />
      </Row>
      <Row
        title="휴가 모드"
        hint={
          value.vacationMode
            ? '휴가 중이에요. 마지막으로 목표를 채운 날 이후에 비어 있는 날은 연속 기록을 끊지 않아요. 돌아오면 꺼 주세요.'
            : '켜 두면 쉬는 동안 비어 있는 날이 연속 기록을 끊지 않아요.'
        }
      >
        <ToggleSwitch checked={value.vacationMode} label="휴가 모드" onChange={(vacationMode) => save({ vacationMode })} />
      </Row>
    </div>
  )
}
