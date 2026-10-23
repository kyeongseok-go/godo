// 템플릿 테스트가 함께 쓰는 노드 팩토리
import type { TemplateTaskNode } from './model'

export const node = (patch: Partial<TemplateTaskNode> = {}): TemplateTaskNode => ({
  title: '할 일',
  description: '',
  priority: 4,
  labelIds: [],
  startOffset: null,
  startTime: null,
  durationMin: null,
  dayPart: null,
  dueOffset: null,
  estimateMin: null,
  recurrence: null,
  reminderOffsets: [],
  persistentReminder: false,
  someday: false,
  children: [],
  ...patch,
})
