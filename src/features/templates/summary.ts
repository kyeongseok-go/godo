import type { Template } from '../../domain/types'
import { countTemplateTasks, parseTemplatePayload } from './model'

/** 목록에서 템플릿 이름 아래에 보여 줄 한 줄 요약 */
export function describeTemplate(template: Pick<Template, 'kind' | 'payload'>): string {
  const parsed = parseTemplatePayload(template)
  if (!parsed.ok) return '내용을 읽을 수 없어요'
  const count = countTemplateTasks(parsed)
  if (parsed.kind === 'task') return count > 1 ? `할 일 1개 + 하위 작업 ${count - 1}개` : '할 일 1개'
  const sections = parsed.payload.sections.length
  return sections > 0 ? `섹션 ${sections}개 · 할 일 ${count}개` : `할 일 ${count}개`
}
