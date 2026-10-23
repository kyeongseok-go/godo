import { Download } from 'lucide-react'
import { createBackup, serializeBackup, tasksToCsv } from '../../domain/exchange'
import { useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { Group, InfoRow } from '../settings/fields'
import { collectAppData } from './appData'
import { downloadTextFile, UTF8_BOM } from './download'
import { backupFileName, csvFileName } from './format'

function describe(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류'
}

function exportJson(): void {
  const now = new Date()
  const data = collectAppData(useApp.getState())
  downloadTextFile(backupFileName(now), serializeBackup(createBackup(data, now.toISOString())), 'application/json')
}

function exportCsv(): void {
  const { entities } = useApp.getState()
  const csv = tasksToCsv({
    tasks: Object.values(entities.tasks),
    projects: Object.values(entities.projects),
    sections: Object.values(entities.sections),
    labels: Object.values(entities.labels),
  })
  downloadTextFile(csvFileName(new Date()), UTF8_BOM + csv, 'text/csv')
}

function run(action: () => void, doneMessage: string): void {
  try {
    action()
    useToasts.getState().push(doneMessage)
  } catch (error: unknown) {
    useToasts.getState().push(`파일을 만들지 못했어요. (${describe(error)})`, { tone: 'error' })
  }
}

export function ExportSection() {
  const taskCount = useApp((s) => Object.keys(s.entities.tasks).length)
  const projectCount = useApp((s) => Object.keys(s.entities.projects).length)
  return (
    <Group title="내보내기" description={`지금 할 일 ${taskCount}개, 프로젝트 ${projectCount}개가 있어요.`}>
      <InfoRow label="JSON 백업" hint="할 일, 프로젝트, 습관, 설정까지 전부 담아요. 나중에 가져오면 그대로 되살아나요.">
        <button type="button" className="st-btn st-btn--primary" onClick={() => run(exportJson, '백업 파일을 내려받았어요')}>
          <Download size={15} aria-hidden="true" /> JSON 백업 내려받기
        </button>
      </InfoRow>
      <InfoRow label="CSV (Todoist 형식)" hint="아직 안 끝난 할 일만 담아요. 다른 앱이나 엑셀에서 열 수 있어요.">
        <button type="button" className="st-btn" onClick={() => run(exportCsv, 'CSV 파일을 내려받았어요')}>
          <Download size={15} aria-hidden="true" /> CSV 내려받기
        </button>
      </InfoRow>
    </Group>
  )
}
