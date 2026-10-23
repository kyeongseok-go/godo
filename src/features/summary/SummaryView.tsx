import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildSummaryMarkdown } from '../../domain/stats'
import { useEngineContext, useSettings, useTable } from '../../hooks/data'
import { OptionsPanel } from './OptionsPanel'
import { OutputPane } from './OutputPane'
import type { OutputTab } from './OutputPane'
import { parseSummaryParams, resolveSummaryOptions, writeSummaryParams } from './params'
import type { SummaryParams } from './params'
import { QuickPresets } from './QuickPresets'
import { useSummaryOutput } from './useSummaryOutput'
import './summary.css'

export function SummaryView() {
  const [search, setSearch] = useSearchParams()
  const [tab, setTab] = useState<OutputTab>('preview')
  const ctx = useEngineContext()
  const { weekStartsOn, dayStartHour } = useSettings()
  const projects = useTable('projects')

  const params = useMemo(() => parseSummaryParams(search), [search])
  const options = useMemo(
    () => resolveSummaryOptions(params, ctx.today, weekStartsOn, dayStartHour),
    [params, ctx.today, weekStartsOn, dayStartHour],
  )
  const markdown = useMemo(() => buildSummaryMarkdown(ctx, options), [ctx, options])
  const choosable = useMemo(
    () => projects.filter((p) => !p.isFolder && p.deletedAt === null).sort((a, b) => a.order - b.order),
    [projects],
  )
  const { copy, save } = useSummaryOutput(markdown, options, setTab)

  // 검색 파라미터만 바꾸고 history 항목은 쌓지 않는다(칩을 누를 때마다 뒤로가기가 늘면 곤란하다).
  const update = useCallback(
    (next: SummaryParams) => setSearch(writeSummaryParams(next, search), { replace: true }),
    [search, setSearch],
  )

  return (
    <div className="sum">
      <QuickPresets params={params} today={ctx.today} weekStartsOn={weekStartsOn} onChange={update} />
      <div className="sum__grid">
        <OptionsPanel params={params} resolved={options} projects={choosable} onChange={update} />
        <OutputPane markdown={markdown} tab={tab} onTabChange={setTab} onCopy={copy} onDownload={save} />
      </div>
    </div>
  )
}
