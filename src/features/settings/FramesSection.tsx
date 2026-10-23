import { Plus, Trash2 } from 'lucide-react'
import { weekdayOrder } from '../../domain/calendarGrid'
import { WEEKDAY_KO } from '../../domain/date'
import type { Label, Settings, TimeFrame, Weekday } from '../../domain/types'
import { useSettings, useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import { newId } from '../../store/id'
import { Group } from './fields'
import {
  addFrame,
  describeFrameMatch,
  FRAME_PRESETS,
  frameProblem,
  framesFromPresets,
  MAX_FRAMES,
  newFrame,
  patchFrame,
  PRIORITIES,
  removeFrame,
  toggleFrameDay,
  toggleFrameLabel,
  toggleFramePriority,
} from './frames'
import './frames.css'

const MAX_MIN_MINUTES = 480

interface FrameEditorProps {
  frame: TimeFrame
  labels: readonly Label[]
  weekStartsOn: 0 | 1
  onPatch: (patch: Partial<TimeFrame>) => void
  onToggleDay: (day: Weekday) => void
  onToggleLabel: (labelId: string) => void
  onTogglePriority: (priority: (typeof PRIORITIES)[number]) => void
  onRemove: () => void
}

function FrameEditor({
  frame,
  labels,
  weekStartsOn,
  onPatch,
  onToggleDay,
  onToggleLabel,
  onTogglePriority,
  onRemove,
}: FrameEditorProps) {
  const problem = frameProblem(frame)
  return (
    <li className="frame" aria-label={`시간대 ${frame.name}`}>
      <div className="frame__head">
        <input
          className="frame__name"
          value={frame.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          aria-label="시간대 이름"
          maxLength={20}
        />
        <input
          type="time"
          value={frame.start}
          onChange={(e) => onPatch({ start: e.target.value })}
          aria-label={`${frame.name} 시작 시각`}
        />
        <span aria-hidden="true">–</span>
        <input
          type="time"
          value={frame.end}
          onChange={(e) => onPatch({ end: e.target.value })}
          aria-label={`${frame.name} 종료 시각`}
        />
        <button type="button" className="icon-btn" aria-label={`${frame.name} 삭제`} onClick={onRemove}>
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="frame__days" role="group" aria-label={`${frame.name} 요일`}>
        {weekdayOrder(weekStartsOn).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={frame.days.includes(d as Weekday)}
            onClick={() => onToggleDay(d as Weekday)}
          >
            {WEEKDAY_KO[d]}
          </button>
        ))}
      </div>

      <div className="frame__match">
        <p className="frame__summary">여기에 넣을 일: {describeFrameMatch(frame, labels)}</p>
        <div className="frame__chips" role="group" aria-label={`${frame.name} 우선순위 조건`}>
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              className="chip-btn"
              aria-pressed={frame.match.priorities.includes(p)}
              onClick={() => onTogglePriority(p)}
            >
              P{p}
            </button>
          ))}
        </div>
        {labels.length > 0 ? (
          <div className="frame__chips" role="group" aria-label={`${frame.name} 라벨 조건`}>
            {labels.map((l) => (
              <button
                key={l.id}
                type="button"
                className="chip-btn"
                aria-pressed={frame.match.labelIds.includes(l.id)}
                onClick={() => onToggleLabel(l.id)}
              >
                @{l.name}
              </button>
            ))}
          </div>
        ) : null}
        <label className="frame__min">
          예상 시간이 이 값 이상인 일만
          <input
            type="number"
            min={0}
            max={MAX_MIN_MINUTES}
            step={15}
            value={frame.match.minMinutes ?? 0}
            onChange={(e) => {
              const minutes = Number(e.target.value)
              onPatch({
                match: { ...frame.match, minMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null },
              })
            }}
            aria-label={`${frame.name} 최소 예상 시간(분)`}
          />
          분 (0이면 길이를 따지지 않아요)
        </label>
      </div>

      {problem ? (
        <p className="frame__problem" role="status">
          {problem}
        </p>
      ) : null}
    </li>
  )
}

/** F12: 작업 유형별 시간대 템플릿. 바꾸는 즉시 저장한다. */
export function FramesSection() {
  const settings = useSettings()
  const labels = useTable('labels')
  const update = useApp((s) => s.updateSettings)
  const frames = settings.frames
  const save = (next: TimeFrame[]): void => update({ frames: next } satisfies Partial<Settings>)

  return (
    <Group
      title="시간대 템플릿"
      description="딥워크는 오전, 잡무는 오후처럼 일의 종류마다 시간대를 정해 두면 자동 배치가 그 안에만 넣어요. 비워 두면 근무 시간 전체를 써요."
    >
      {frames.length === 0 ? (
        <div className="frames__empty">
          <p>아직 시간대가 없어요. 추천 조합으로 시작해 볼 수 있어요.</p>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => save(framesFromPresets(FRAME_PRESETS, FRAME_PRESETS.map(() => newId())))}
          >
            딥워크·잡무로 시작하기
          </button>
        </div>
      ) : (
        <ul className="frames">
          {[...frames]
            .sort((a, b) => a.order - b.order)
            .map((frame) => (
              <FrameEditor
                key={frame.id}
                frame={frame}
                labels={labels}
                weekStartsOn={settings.weekStartsOn}
                onPatch={(patch) => save(patchFrame(frames, frame.id, patch))}
                onToggleDay={(day) => save(toggleFrameDay(frames, frame.id, day))}
                onToggleLabel={(labelId) => save(toggleFrameLabel(frames, frame.id, labelId))}
                onTogglePriority={(priority) => save(toggleFramePriority(frames, frame.id, priority))}
                onRemove={() => save(removeFrame(frames, frame.id))}
              />
            ))}
        </ul>
      )}
      {frames.length < MAX_FRAMES ? (
        <button
          type="button"
          className="btn-ghost frames__add"
          onClick={() => save(addFrame(frames, newFrame(newId(), frames)))}
        >
          <Plus size={15} aria-hidden="true" /> 시간대 추가
        </button>
      ) : (
        <p className="frames__limit">시간대는 {MAX_FRAMES}개까지 둘 수 있어요.</p>
      )}
    </Group>
  )
}
