import { useSettings } from '../../hooks/data'
import { useApp } from '../../store/app'
import type { Settings } from '../../domain/types'
import { Group, Row, Switch } from './fields'

type ModuleKey = keyof Settings['modules']
type SidebarKey = keyof Settings['sidebar']

const MODULES: ReadonlyArray<{ key: ModuleKey; label: string; hint: string }> = [
  { key: 'calendar', label: '캘린더', hint: '월·주·일 보기로 일정을 봐요.' },
  { key: 'matrix', label: '아이젠하워 매트릭스', hint: '중요도와 긴급도로 할 일을 나눠 봐요.' },
  { key: 'timeline', label: '타임라인', hint: '시작일과 마감일을 막대로 이어서 봐요.' },
  { key: 'habits', label: '습관', hint: '매일·매주 반복하는 습관을 기록해요.' },
  { key: 'focus', label: '집중', hint: '포모도로 타이머와 집중 기록이에요.' },
  { key: 'countdown', label: '디데이', hint: '다가오는 날까지 남은 날수를 세요.' },
]

const SIDEBAR_ITEMS: ReadonlyArray<{ key: SidebarKey; label: string; hint?: string }> = [
  { key: 'showToday', label: '오늘' },
  { key: 'showUpcoming', label: '다음 7일' },
  { key: 'showAnytime', label: '지금 할 수 있는 것' },
  { key: 'showSomeday', label: '언젠가' },
  { key: 'showCompleted', label: '완료' },
  { key: 'showCounts', label: '할 일 개수 표시', hint: '사이드바 항목 옆에 남은 할 일 수를 보여 줘요.' },
]

export function ModulesTab() {
  const settings = useSettings()
  const update = useApp((s) => s.updateSettings)
  return (
    <>
      <Group title="모듈" description="안 쓰는 기능은 꺼서 사이드바를 간결하게 둘 수 있어요. 데이터는 지워지지 않아요.">
        {MODULES.map(({ key, label, hint }) => (
          <Row key={key} label={label} hint={hint}>
            <Switch hasHint checked={settings.modules[key]} onChange={(on) => update({ modules: { ...settings.modules, [key]: on } })} />
          </Row>
        ))}
      </Group>
      <Group title="사이드바 항목" description="받은편지함과 휴지통, 설정은 항상 보여요.">
        {SIDEBAR_ITEMS.map(({ key, label, hint }) => (
          <Row key={key} label={label} hint={hint}>
            <Switch hasHint={hint !== undefined} checked={settings.sidebar[key]} onChange={(on) => update({ sidebar: { ...settings.sidebar, [key]: on } })} />
          </Row>
        ))}
      </Group>
    </>
  )
}
