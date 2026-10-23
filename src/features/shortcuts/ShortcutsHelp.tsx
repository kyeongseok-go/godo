import { X } from 'lucide-react'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { Dialog } from '../../ui/Dialog'
import { formatKeys } from './keymap'
import { effectiveKeys, useCommands } from './useCommands'
import type { Command } from './useCommands'
import './shortcuts.css'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const GROUPS: Command['group'][] = ['이동', '만들기', '할 일', '보기', '앱']

export function ShortcutsHelp() {
  const open = useUI((s) => s.helpOpen)
  const setHelp = useUI((s) => s.setHelp)
  const commands = useCommands()
  const overrides = useApp((s) => s.settings.shortcuts)

  return (
    <Dialog open={open} onClose={() => setHelp(false)} label="단축키 도움말" width="min(52rem, calc(100vw - 2rem))">
      <div className="help">
        <header className="help__head">
          <h2>단축키</h2>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={() => setHelp(false)}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <p className="help__intro">
          <kbd>G</kbd> 뒤에 글자를 이어서 누르면 화면을 옮겨요. 할 일에 포커스를 두고(<kbd>J</kbd>/<kbd>K</kbd>) 바로 조작할 수 있어요.
        </p>
        <div className="help__cols">
          {GROUPS.map((group) => {
            const rows = commands.flatMap((c) => {
              const keys = effectiveKeys(c, overrides)
              return c.group === group && keys ? [{ c, keys }] : []
            })
            if (rows.length === 0) return null
            return (
              <section key={group} className="help__group">
                <h3>{group}</h3>
                <dl>
                  {rows.map(({ c, keys }) => (
                    <div key={c.id}>
                      <dt>{c.title}</dt>
                      <dd>
                        <kbd>{formatKeys(keys, IS_MAC)}</kbd>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )
          })}
        </div>
      </div>
    </Dialog>
  )
}
