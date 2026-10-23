import { AlertTriangle, RotateCcw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '../../store/app'
import { formatKeys } from '../shortcuts/keymap'
import { effectiveKeys, useCommands } from '../shortcuts/useCommands'
import type { Command } from '../shortcuts/useCommands'
import { ConfirmDialog } from './ConfirmDialog'
import { Group } from './fields'
import { KeyCapture } from './KeyCapture'
import { describeConflicts, findKeyConflicts, setShortcut } from './shortcutBindings'
import type { KeyConflict } from './shortcutBindings'
import './shortcuts-tab.css'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const GROUPS: Command['group'][] = ['이동', '만들기', '할 일', '보기', '앱']

interface Row {
  command: Command
  keys: string | undefined
  isCustom: boolean
}

interface CommandRowProps {
  row: Row
  conflicts: readonly KeyConflict[]
  onChange: (command: Command, keys: string | null) => void
}

function CommandRow({ row, conflicts, onChange }: CommandRowProps) {
  const { command, keys, isCustom } = row
  const warnings = describeConflicts(conflicts)
  return (
    <tr className="st-keys__row" data-custom={isCustom}>
      <th scope="row" className="st-keys__name">
        <div className="st-keys__text">
          <span>{command.title}</span>
          {isCustom ? (
            <span className="st-keys__default">기본값: {command.keys ? formatKeys(command.keys, IS_MAC) : '없음'}</span>
          ) : null}
          {warnings.map((text) => (
            <span key={text} className="st-keys__warn">
              <AlertTriangle size={13} aria-hidden="true" />
              {text}
            </span>
          ))}
        </div>
      </th>
      <td className="st-keys__cell">
        <KeyCapture title={command.title} keys={keys} onCapture={(next) => onChange(command, next)} />
        <span className="st-keys__slot">
          {isCustom ? (
            <button type="button" className="st-icon" aria-label={`${command.title} 단축키를 기본값으로`} title="기본값으로" onClick={() => onChange(command, null)}>
              <RotateCcw size={15} aria-hidden="true" />
            </button>
          ) : null}
        </span>
        <span className="st-keys__slot">
          {keys ? (
            <button type="button" className="st-icon" aria-label={`${command.title} 단축키 비우기`} title="비우기 (단축키 끄기)" onClick={() => onChange(command, '')}>
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </span>
      </td>
    </tr>
  )
}

function matches(command: Command, query: string): boolean {
  if (query === '') return true
  return `${command.title} ${command.aliases ?? ''} ${command.group}`.toLowerCase().includes(query)
}

interface ToolsProps {
  query: string
  onQuery: (query: string) => void
  customCount: number
  onResetAll: () => void
}

function ShortcutTools({ query, onQuery, customCount, onResetAll }: ToolsProps) {
  return (
    <div className="st-keys-tools">
      <p className="st-keys-tools__help">
        키 칸을 누른 뒤 원하는 키를 누르세요. <kbd>G</kbd> 다음 <kbd>I</kbd>처럼 두 키까지 이어서 지정할 수 있고, <kbd>Esc</kbd>로 취소해요. 겹치는 키는 경고만 하고 저장은 막지 않아요.
      </p>
      <div className="st-keys-tools__bar">
        <input
          type="search"
          className="st-input st-keys-tools__search"
          placeholder="명령 찾기"
          aria-label="명령 찾기"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <button type="button" className="st-btn" disabled={customCount === 0} onClick={onResetAll}>
          <RotateCcw size={14} aria-hidden="true" /> 모두 기본값으로{customCount > 0 ? ` (${customCount})` : ''}
        </button>
      </div>
    </div>
  )
}

interface GroupTableProps {
  group: Command['group']
  rows: readonly Row[]
  conflicts: ReadonlyMap<string, KeyConflict[]>
  onChange: (command: Command, keys: string | null) => void
}

function GroupTable({ group, rows, conflicts, onChange }: GroupTableProps) {
  return (
    <Group title={group}>
      <table className="st-keys">
        <caption className="sr-only">{group} 명령의 단축키</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">명령</th>
            <th scope="col">단축키</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <CommandRow key={row.command.id} row={row} conflicts={conflicts.get(row.command.id) ?? []} onChange={onChange} />
          ))}
        </tbody>
      </table>
    </Group>
  )
}

export function ShortcutsTab() {
  const commands = useCommands()
  const overrides = useApp((s) => s.settings.shortcuts)
  const update = useApp((s) => s.updateSettings)
  const [query, setQuery] = useState('')
  const [confirmingReset, setConfirmingReset] = useState(false)

  const rows = useMemo<Row[]>(
    () => commands.map((command) => ({ command, keys: effectiveKeys(command, overrides), isCustom: overrides[command.id] !== undefined })),
    [commands, overrides],
  )
  const conflicts = useMemo(
    () => findKeyConflicts(rows.flatMap((r) => (r.keys ? [{ id: r.command.id, title: r.command.title, keys: r.keys }] : []))),
    [rows],
  )
  const customCount = rows.filter((r) => r.isCustom).length
  const needle = query.trim().toLowerCase()
  const visible = rows.filter((r) => matches(r.command, needle))
  const change = (command: Command, keys: string | null): void => update({ shortcuts: setShortcut(overrides, command, keys) })

  return (
    <>
      <ShortcutTools query={query} onQuery={setQuery} customCount={customCount} onResetAll={() => setConfirmingReset(true)} />
      {GROUPS.map((group) => {
        const groupRows = visible.filter((r) => r.command.group === group)
        return groupRows.length > 0 ? <GroupTable key={group} group={group} rows={groupRows} conflicts={conflicts} onChange={change} /> : null
      })}
      {visible.length === 0 ? <p className="st-empty">“{query}”와 맞는 명령이 없어요. 다른 말로 찾아 보세요.</p> : null}

      <ConfirmDialog
        open={confirmingReset}
        title="단축키를 모두 기본값으로 되돌릴까요?"
        confirmLabel="모두 되돌리기"
        onCancel={() => setConfirmingReset(false)}
        onConfirm={() => {
          update({ shortcuts: {} })
          setConfirmingReset(false)
        }}
      >
        <p>직접 지정하거나 끈 단축키 {customCount}개가 처음 상태로 돌아가요.</p>
      </ConfirmDialog>
    </>
  )
}
