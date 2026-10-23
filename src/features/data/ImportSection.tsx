import { Upload } from 'lucide-react'
import { useRef } from 'react'
import { ConfirmDialog } from '../settings/ConfirmDialog'
import { Group } from '../settings/fields'
import { ImportPreview } from './ImportPreview'
import { useImportFlow } from './useImportFlow'

export function ImportSection({ onApplied }: { onApplied: () => void }) {
  const flow = useImportFlow(onApplied)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Group title="가져오기" description="Pace에서 내보낸 JSON 백업이나 Todoist CSV 파일을 불러와요. 고른 뒤 내용을 확인하고 적용해요.">
      <div className="dt-import">
        <input
          ref={inputRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void flow.pickFile(file)
          }}
        />
        <button type="button" className="st-btn" disabled={flow.busy} onClick={() => inputRef.current?.click()}>
          <Upload size={15} aria-hidden="true" /> 파일 고르기
        </button>
        {flow.error ? (
          <p className="dt-error" role="alert">
            {flow.error}
          </p>
        ) : null}
        {flow.plan ? <ImportPreview plan={flow.plan} flow={flow} /> : null}
      </div>

      <ConfirmDialog
        open={flow.confirmingReplace}
        title="현재 데이터를 덮어쓸까요?"
        confirmLabel="덮어쓰기"
        danger
        busy={flow.busy}
        onCancel={flow.closeConfirm}
        onConfirm={() => void flow.apply()}
      >
        <p>
          <strong>현재 데이터는 사라져요.</strong> 파일에 든 내용으로 모두 바뀌어요.
        </p>
        <p>혹시 모르니 지우기 직전 상태를 자동 백업 스냅샷으로 남겨 둬요. 아래 스냅샷 목록에서 복원할 수 있어요.</p>
      </ConfirmDialog>
    </Group>
  )
}
