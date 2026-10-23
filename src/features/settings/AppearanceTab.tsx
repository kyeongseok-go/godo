import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useSettings } from '../../hooks/data'
import { useApp } from '../../store/app'
import { DEFAULT_ACCENT, isDefaultAccent, PALETTE } from '../../store/defaults'
import type { Density, ThemeMode } from '../../domain/types'
import { accentName, accentPresets } from './accent'
import { AppearancePreview } from './AppearancePreview'
import { Group, Row, Segmented } from './fields'
import './appearance.css'

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: React.ReactNode }> = [
  { value: 'auto', label: <><Monitor size={14} aria-hidden="true" /> 자동</> },
  { value: 'light', label: <><Sun size={14} aria-hidden="true" /> 라이트</> },
  { value: 'dark', label: <><Moon size={14} aria-hidden="true" /> 다크</> },
]

const PRESETS = accentPresets(PALETTE)

function isSelected(preset: string, current: string): boolean {
  if (preset === DEFAULT_ACCENT) return isDefaultAccent(current)
  return preset.toLowerCase() === current.toLowerCase()
}

function AccentSwatches({ current, onPick }: { current: string; onPick: (hex: string) => void }) {
  const selected = PRESETS.find((p) => isSelected(p, current))
  return (
    <div className="st-accent">
      <div className="st-swatches" role="radiogroup" aria-label="강조색">
        {PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={hex === selected}
            aria-label={accentName(hex)}
            className="st-swatch"
            style={{ ['--swatch' as string]: hex }}
            onClick={() => onPick(hex)}
          >
            {hex === selected ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      <p className="st-accent__name">{selected ? accentName(selected) : `${accentName(current)} (${current})`}</p>
    </div>
  )
}

export function AppearanceTab() {
  const settings = useSettings()
  const update = useApp((s) => s.updateSettings)
  return (
    <div className="st-appearance">
      <AppearancePreview />
      <div className="st-appearance__controls">
        <Group title="테마" description="고르는 즉시 화면에 적용돼요.">
          <Row label="화면 밝기" group>
            <Segmented value={settings.theme} options={THEME_OPTIONS} onChange={(theme) => update({ theme })} />
          </Row>
        </Group>
        <Group title="강조색" description="버튼과 선택 표시에 쓰는 색이에요. 글자가 읽기 어려운 색은 뺐어요.">
          <Row label="색 고르기" group>
            <AccentSwatches current={settings.accent} onPick={(accent) => update({ accent })} />
          </Row>
        </Group>
        <Group title="밀도">
          <Row label="목록 간격" hint="촘촘하게 두면 한 화면에 더 많은 할 일이 들어와요." group>
            <Segmented<Density>
              hasHint
              value={settings.density}
              options={[
                { value: 'comfortable', label: '기본' },
                { value: 'compact', label: '촘촘' },
              ]}
              onChange={(density) => update({ density })}
            />
          </Row>
        </Group>
      </div>
    </div>
  )
}
