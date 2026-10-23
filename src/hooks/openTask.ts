import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ID } from '../domain/types'

const TASK_PARAM = 'task'

/**
 * 상세 패널에 열린 할 일을 URL(?task=)에 둔다. 새로고침·뒤로가기·링크 공유가 자연스럽게 된다.
 * `open`/`close` 는 URL 이 바뀌어도 같은 함수로 유지한다. 목록 행(`memo(TaskRow)`)에 내려가는 콜백이라서,
 * 주소가 바뀔 때마다 새 함수가 되면 행 전부가 다시 그려진다. 호출 시점의 최신 주소는 ref 에서 읽는다.
 */
export function useOpenTask(): { openId: ID | null; open: (id: ID) => void; close: () => void } {
  const navigate = useNavigate()
  const location = useLocation()
  const latest = useRef({ navigate, location })
  useEffect(() => {
    latest.current = { navigate, location }
  })

  const openId = useMemo(() => new URLSearchParams(location.search).get(TASK_PARAM), [location.search])

  const open = useCallback((id: ID) => {
    const { navigate: go, location: here } = latest.current
    const next = new URLSearchParams(here.search)
    next.set(TASK_PARAM, id)
    go(`?${next}`, { replace: false })
  }, [])

  const close = useCallback(() => {
    const { navigate: go, location: here } = latest.current
    const next = new URLSearchParams(here.search)
    next.delete(TASK_PARAM)
    go(`?${next}`, { replace: true })
  }, [])

  return { openId, open, close }
}
