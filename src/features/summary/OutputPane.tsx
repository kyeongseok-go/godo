import { ClipboardCopy, Download } from 'lucide-react'
import { useId, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Markdown } from '../../ui/Markdown'

export type OutputTab = 'preview' | 'raw'

const TABS: ReadonlyArray<{ id: OutputTab; label: string }> = [
  { id: 'preview', label: '미리보기' },
  { id: 'raw', label: '원문' },
]

interface OutputPaneProps {
  markdown: string
  tab: OutputTab
  onTabChange: (tab: OutputTab) => void
  onCopy: () => void
  onDownload: () => void
}

interface OutputTabsProps {
  tab: OutputTab
  baseId: string
  onTabChange: (tab: OutputTab) => void
}

function OutputTabs({ tab, baseId, onTabChange }: OutputTabsProps) {
  const tabRefs = useRef<Record<OutputTab, HTMLButtonElement | null>>({ preview: null, raw: null })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((t) => t.id === tab)
    const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: TABS.length - 1 }[event.key]
    if (target === undefined) return
    event.preventDefault()
    const next = TABS[(target + TABS.length) % TABS.length].id
    onTabChange(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="sum-tabs" role="tablist" aria-label="보기 방식" onKeyDown={onKeyDown}>
      {TABS.map((item) => (
        <button
          key={item.id}
          ref={(el) => { tabRefs.current[item.id] = el }}
          type="button"
          role="tab"
          id={`${baseId}-tab-${item.id}`}
          aria-selected={tab === item.id}
          aria-controls={`${baseId}-panel`}
          tabIndex={tab === item.id ? 0 : -1}
          className="sum-tabs__tab"
          onClick={() => onTabChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/** 마크다운 결과. 미리보기/원문 탭과 복사·저장 버튼을 가진다. */
export function OutputPane({ markdown, tab, onTabChange, onCopy, onDownload }: OutputPaneProps) {
  const baseId = useId()
  return (
    <section className="sum-output" aria-label="보고서 결과">
      <div className="sum-output__bar">
        <OutputTabs tab={tab} baseId={baseId} onTabChange={onTabChange} />
        <div className="sum-output__actions">
          <button type="button" className="btn-ghost" onClick={onCopy}>
            <ClipboardCopy size={15} aria-hidden="true" /> 복사
          </button>
          <button type="button" className="btn-ghost" onClick={onDownload}>
            <Download size={15} aria-hidden="true" /> .md 파일로 저장
          </button>
        </div>
      </div>
      <div className="sum-output__panel" role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${tab}`}>
        {tab === 'preview' ? (
          <Markdown source={markdown} />
        ) : (
          <pre className="sum-raw" tabIndex={0} aria-label="마크다운 원문"><code>{markdown}</code></pre>
        )}
      </div>
    </section>
  )
}
