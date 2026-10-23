import { useMemo } from 'react'
import { useSettings, useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import type { Settings } from '../../domain/types'
import { minutesOfDay } from '../../domain/date'
import { Group, NumberField, Row, Segmented, SelectField, Switch, TimeField } from './fields'
import {
  dateFormatSample,
  homeOptions,
  projectOptions,
  reminderOptions,
  supportedTimeZones,
  timeZoneOptions,
} from './options'
import type { SelectOption } from './options'

const DAY_START_OPTIONS: SelectOption[] = Array.from({ length: 7 }, (_, hour) => ({
  value: String(hour),
  label: hour === 0 ? '0시 (자정)' : `${hour}시`,
}))

const DATE_FORMAT_OPTIONS: SelectOption[] = (['YMD', 'MDY', 'DMY'] as const).map((format) => ({
  value: format,
  label: `${dateFormatSample(format)}  (${{ YMD: '연-월-일', MDY: '월/일/연', DMY: '일/월/연' }[format]})`,
}))

function useUpdate(): (patch: Partial<Settings>) => void {
  return useApp((s) => s.updateSettings)
}

function TimeSection({ settings }: { settings: Settings }) {
  const update = useUpdate()
  const zones = useMemo(() => timeZoneOptions(settings.timeZone, supportedTimeZones()).map((z) => ({ value: z, label: z })), [settings.timeZone])
  return (
    <Group title="시간과 날짜">
      <Row label="시간대" hint="오늘이 언제 바뀌는지, 알림이 몇 시에 울리는지의 기준이에요.">
        <SelectField hasHint value={settings.timeZone} options={zones} onChange={(timeZone) => update({ timeZone })} />
      </Row>
      <Row label="한 주의 시작" group>
        <Segmented
          value={String(settings.weekStartsOn)}
          options={[
            { value: '1', label: '월요일' },
            { value: '0', label: '일요일' },
          ]}
          onChange={(v) => update({ weekStartsOn: v === '0' ? 0 : 1 })}
        />
      </Row>
      <Row label="시간 표시" group>
        <Segmented
          value={settings.timeFormat}
          options={[
            { value: '24h', label: '24시간' },
            { value: '12h', label: '12시간' },
          ]}
          onChange={(timeFormat) => update({ timeFormat })}
        />
      </Row>
      <Row label="날짜 표시">
        <SelectField value={settings.dateFormat} options={DATE_FORMAT_OPTIONS} onChange={(v) => update({ dateFormat: v as Settings['dateFormat'] })} />
      </Row>
      <Row label="하루가 시작되는 시각" hint="새벽까지 깨어 있다면 3시로 두세요. 그 전까지는 아직 어제로 봐요.">
        <SelectField hasHint value={String(settings.dayStartHour)} options={DAY_START_OPTIONS} onChange={(v) => update({ dayStartHour: Number(v) })} />
      </Row>
    </Group>
  )
}

function HomeSection({ settings }: { settings: Settings }) {
  const update = useUpdate()
  const projects = useTable('projects')
  const options = useMemo(() => homeOptions(settings.homeView, projects, settings.modules), [settings.homeView, settings.modules, projects])
  return (
    <Group title="시작 화면">
      <Row label="앱을 열면 처음 보이는 화면">
        <SelectField value={settings.homeView} options={options} onChange={(homeView) => update({ homeView })} />
      </Row>
    </Group>
  )
}

function DefaultsSection({ settings }: { settings: Settings }) {
  const update = useUpdate()
  const projects = useTable('projects')
  const projectChoices = useMemo(() => projectOptions(projects, settings.defaultProjectId), [projects, settings.defaultProjectId])
  const reminders = useMemo(() => reminderOptions(settings.defaultReminderOffsetMin), [settings.defaultReminderOffsetMin])
  return (
    <Group title="새 할 일 기본값">
      <Row label="시작일" group>
        <Segmented
          value={settings.defaultStartDate}
          options={[
            { value: 'none', label: '없음' },
            { value: 'today', label: '오늘' },
          ]}
          onChange={(defaultStartDate) => update({ defaultStartDate })}
        />
      </Row>
      <Row label="알림 시점" hint="시작 시각이 있는 할 일에 자동으로 붙어요.">
        <SelectField
          hasHint
          value={settings.defaultReminderOffsetMin === null ? 'none' : String(settings.defaultReminderOffsetMin)}
          options={reminders}
          onChange={(v) => update({ defaultReminderOffsetMin: v === 'none' ? null : Number(v) })}
        />
      </Row>
      <Row label="기본 길이" hint="캘린더에 블록으로 놓을 때의 길이예요.">
        <NumberField hasHint value={settings.defaultDurationMin} min={5} max={720} step={5} unit="분" onCommit={(defaultDurationMin) => update({ defaultDurationMin })} />
      </Row>
      <Row label="기본 프로젝트">
        <SelectField value={settings.defaultProjectId} options={projectChoices} onChange={(defaultProjectId) => update({ defaultProjectId })} />
      </Row>
    </Group>
  )
}

function InputSection({ settings }: { settings: Settings }) {
  const update = useUpdate()
  return (
    <Group title="입력과 목록">
      <Row label="스마트 날짜 인식" hint="“내일 오후 3시 회의”처럼 쓰면 날짜와 시간을 알아서 채워요.">
        <Switch hasHint checked={settings.smartParsing} onChange={(smartParsing) => update({ smartParsing })} />
      </Row>
      <Row label="시작 전 할 일 숨기기" hint="프로젝트 목록에서 시작일이 아직 오지 않은 할 일을 감춰요.">
        <Switch hasHint checked={settings.hideFutureTasks} onChange={(hideFutureTasks) => update({ hideFutureTasks })} />
      </Row>
      <Row label="완료한 일 표시" hint="목록 안에 완료한 할 일을 함께 보여 줘요.">
        <Switch hasHint checked={settings.showCompleted} onChange={(showCompleted) => update({ showCompleted })} />
      </Row>
    </Group>
  )
}

function validateWorkEnd(start: string): (end: string) => string | null {
  return (end) => (minutesOfDay(end) > minutesOfDay(start) ? null : '종료 시각은 시작 시각보다 늦어야 해요')
}

function validateWorkStart(end: string): (start: string) => string | null {
  return (start) => (minutesOfDay(start) < minutesOfDay(end) ? null : '시작 시각은 종료 시각보다 빨라야 해요')
}

function PlanningSection({ settings }: { settings: Settings }) {
  const update = useUpdate()
  return (
    <Group title="하루 계획" description="자동 배치와 용량 계산에 쓰여요.">
      <Row label="근무 시작">
        <TimeField value={settings.workStart} validate={validateWorkStart(settings.workEnd)} onCommit={(workStart) => update({ workStart })} />
      </Row>
      <Row label="근무 종료">
        <TimeField value={settings.workEnd} validate={validateWorkEnd(settings.workStart)} onCommit={(workEnd) => update({ workEnd })} />
      </Row>
      <Row label="블록 사이 여유" hint="자동 배치할 때 일정 사이에 비워 두는 시간이에요.">
        <NumberField hasHint value={settings.bufferMin} min={0} max={120} step={5} unit="분" onCommit={(bufferMin) => update({ bufferMin })} />
      </Row>
      <Row label="하루 용량" hint="하루에 할 수 있다고 보는 총 시간이에요.">
        <NumberField hasHint value={settings.dailyCapacityMin} min={30} max={1440} step={30} unit="분" onCommit={(dailyCapacityMin) => update({ dailyCapacityMin })} />
      </Row>
      <Row label="이월 보관 제안" hint="같은 할 일이 이 일수만큼 연속으로 넘어가면 보관을 권해요. 0이면 권하지 않아요.">
        <NumberField hasHint value={settings.carryOverArchiveDays} min={0} max={365} unit="일" onCommit={(carryOverArchiveDays) => update({ carryOverArchiveDays })} />
      </Row>
    </Group>
  )
}

export function GeneralTab() {
  const settings = useSettings()
  return (
    <>
      <TimeSection settings={settings} />
      <HomeSection settings={settings} />
      <DefaultsSection settings={settings} />
      <InputSection settings={settings} />
      <PlanningSection settings={settings} />
    </>
  )
}
