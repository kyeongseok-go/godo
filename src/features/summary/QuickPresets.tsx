import type { ISODate } from '../../domain/types'
import { isQuickPresetActive, QUICK_PRESET_LABELS, quickPresetParams } from './params'
import type { QuickPreset, SummaryParams } from './params'

const PRESETS: readonly QuickPreset[] = ['thisWeekDone', 'nextWeekTodo']

interface QuickPresetsProps {
  params: SummaryParams
  today: ISODate
  weekStartsOn: 0 | 1
  onChange: (next: SummaryParams) => void
}

/** 주간 보고서용 빠른 버튼. 지금 옵션이 그 프리셋과 같으면 눌린 상태로 보인다. */
export function QuickPresets({ params, today, weekStartsOn, onChange }: QuickPresetsProps) {
  return (
    <div className="sum__quick" role="group" aria-label="주간 보고서 빠른 설정">
      {PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          className="sum-quick"
          aria-pressed={isQuickPresetActive(preset, params, today, weekStartsOn)}
          onClick={() => onChange(quickPresetParams(preset, params, today, weekStartsOn))}
        >
          {QUICK_PRESET_LABELS[preset]}
        </button>
      ))}
    </div>
  )
}
