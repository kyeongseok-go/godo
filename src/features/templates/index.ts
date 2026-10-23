// 템플릿 기능의 공개 진입점. 상세 패널·명령 팔레트는 useTemplateActions 로 연결한다.
export { useTemplateActions } from './useTemplateActions'
export type { TemplateActions, TaskTarget, ProjectTarget } from './useTemplateActions'
export { buildProjectTemplate, buildTaskTemplate } from './build'
export { instantiateProjectTemplate, instantiateTaskTemplate } from './instantiate'
export { parseTemplatePayload } from './model'
export type { ParsedTemplate } from './model'
export { describeTemplate } from './summary'
