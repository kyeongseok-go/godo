import { useId, useState } from 'react'
import { db, useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { wipeAllData } from './importer'

const CONFIRM_WORD = '삭제'

function describe(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류'
}

/** 되돌릴 수 없는 일은 따로 떼어 위험색 괘선으로 구획하고, 확인 글자를 직접 쓰게 한다. */
export function DangerSection({ onWiped }: { onWiped: () => void }) {
  const inputId = useId()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wipe = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await wipeAllData(db)
      await useApp.getState().reload()
      setTyped('')
      onWiped()
      useToasts.getState().push('모든 데이터를 지웠어요')
    } catch (e: unknown) {
      setError(`지우지 못했어요. (${describe(e)})`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dt-danger" aria-labelledby={`${inputId}-title`}>
      <h3 id={`${inputId}-title`} className="dt-danger__title">
        위험 구역
      </h3>
      <p className="dt-danger__lead">
        <strong>모든 데이터 삭제</strong> — 할 일, 프로젝트, 습관, 설정, 자동 백업 스냅샷까지 이 브라우저에서 모두 지워요. 되돌릴 수 없어요. 필요하면 먼저 JSON 백업을 내려받으세요.
      </p>
      <div className="dt-danger__form">
        <label htmlFor={inputId}>
          확인을 위해 아래 칸에 <strong>{CONFIRM_WORD}</strong>를 직접 입력하세요
        </label>
        <div className="dt-danger__bar">
          <input id={inputId} className="st-input" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
          <button type="button" className="st-btn st-btn--danger" disabled={typed.trim() !== CONFIRM_WORD || busy} onClick={() => void wipe()}>
            {busy ? '지우는 중…' : '모든 데이터 삭제'}
          </button>
        </div>
        {error ? (
          <p className="dt-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}
