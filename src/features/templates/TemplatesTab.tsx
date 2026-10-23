import { BookmarkPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { INBOX_ID } from '../../domain/types'
import { useTable } from '../../hooks/data'
import { Group, InfoRow, Row, SelectField, TextField } from '../settings/fields'
import { projectOptions } from '../settings/options'
import { TemplateRow } from './TemplateRow'
import { useTemplateActions } from './useTemplateActions'
import type { TemplateActions } from './useTemplateActions'
import './templates.css'

function SaveProjectGroup({ actions }: { actions: TemplateActions }) {
  const projects = useTable('projects')
  const choices = useMemo(() => projectOptions(projects, INBOX_ID), [projects])
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const selected = choices.some((c) => c.value === projectId) ? projectId : (choices[0]?.value ?? '')

  return (
    <Group title="프로젝트를 템플릿으로 저장" description="섹션과 할 일 구조를 통째로 저장해 두고, 비슷한 프로젝트를 새로 만들 때 불러와요.">
      <Row label="프로젝트">
        <SelectField value={selected} options={choices} onChange={setProjectId} />
      </Row>
      <Row label="템플릿 이름" hint="비우면 프로젝트 이름을 그대로 써요.">
        <TextField hasHint value={name} onChange={setName} placeholder="예) 새 집 이사 체크리스트" />
      </Row>
      <InfoRow label="저장" hint="완료한 일도 구조에 포함돼요. 불러올 때는 모두 새 할 일로 만들어져요.">
        <button
          type="button"
          className="st-btn st-btn--primary"
          disabled={selected === ''}
          onClick={() => {
            if (actions.saveProject(selected, name)) setName('')
          }}
        >
          <BookmarkPlus size={15} aria-hidden="true" /> 템플릿으로 저장
        </button>
      </InfoRow>
    </Group>
  )
}

/** 설정의 템플릿 탭. 설정 화면이 열릴 때 동적으로 불러온다. */
export function TemplatesTab() {
  const templates = useTable('templates')
  const projects = useTable('projects')
  const actions = useTemplateActions()
  const sorted = useMemo(() => [...templates].sort((a, b) => b.createdAt - a.createdAt), [templates])

  return (
    <>
      <Group title="저장한 템플릿" description="자주 만드는 할 일이나 프로젝트를 템플릿으로 저장해 두면, 날짜를 새로 맞춰서 한 번에 만들 수 있어요.">
        {sorted.length === 0 ? (
          <p className="tp-empty">아직 템플릿이 없어요. 아래에서 프로젝트를 템플릿으로 저장해 보세요. 할 일 하나를 저장하는 것은 할 일 화면에서 해요.</p>
        ) : (
          <ul className="tp-list" aria-label="템플릿 목록">
            {sorted.map((template) => (
              <TemplateRow key={template.id} template={template} projects={projects} actions={actions} />
            ))}
          </ul>
        )}
      </Group>
      <SaveProjectGroup actions={actions} />
    </>
  )
}
