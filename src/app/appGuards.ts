// 데이터가 브라우저 안에만 있는 앱이 지켜야 할 안전장치 모음.
import { useEffect, useState } from 'react'
import { DB_STALE_EVENT } from '../db/db'
import { syncChannel, useApp } from '../store/app'
import { useToasts } from '../ui/toast'

const RELOAD_RETRY_MS = 250
const RELOAD_RETRY_LIMIT = 20
const STORAGE_WARNED_KEY = 'godo.storageWarned'

/** 아직 DB에 쓰는 중이거나 저장 실패가 남아 있으면 탭을 닫기 전에 한 번 더 묻는다. */
export function useBeforeUnloadGuard(): void {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const { pendingWrites, persistError } = useApp.getState()
      if (pendingWrites > 0 || persistError) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])
}

/**
 * 다른 탭에서 데이터가 바뀌면 이 탭도 다시 읽는다. 그렇지 않으면 이 탭이 가진 오래된 객체로
 * 다음 수정을 저장하면서 다른 탭의 변경을 덮어쓴다. 이 탭에 저장 중인 변경이 있으면 끝날 때까지 기다린다.
 */
export function useCrossTabSync(): void {
  useEffect(() => {
    if (!syncChannel) return
    let timer: ReturnType<typeof setTimeout> | undefined
    // 숨은 탭에서는 타이머가 느려지므로, 신호를 받아 둔 뒤 화면으로 돌아올 때 다시 읽는다.
    let missed = false
    let warnedUnsaved = false

    const tryReload = (attempt: number) => {
      const { pendingWrites, ready, persistError } = useApp.getState()
      if (!ready) return
      // 저장하지 못한 변경이 메모리에만 있다. 다시 읽으면 그 변경이 사라지므로 읽지 않고 알린다.
      if (persistError !== null) {
        if (!warnedUnsaved) {
          warnedUnsaved = true
          useToasts
            .getState()
            .push('다른 탭에서 데이터가 바뀌었어요. 저장하지 못한 변경이 있어 이 탭은 그대로 두었어요. 설정 > 데이터에서 백업한 뒤 새로고침해 주세요.', {
              ttlMs: 15000,
              tone: 'error',
            })
        }
        return
      }
      if (pendingWrites > 0 && attempt < RELOAD_RETRY_LIMIT) {
        timer = setTimeout(() => tryReload(attempt + 1), RELOAD_RETRY_MS)
        return
      }
      useApp
        .getState()
        .reload()
        .catch(() => {
          // 다시 읽기 실패는 화면을 가리지 않는다(이미 쓰던 데이터는 그대로다). 다만 조용히 두면 낡은 화면으로 계속 쓰게 된다.
          useToasts.getState().push('다른 탭의 변경을 읽지 못했어요. 새로고침해 주세요.', { ttlMs: 12000, tone: 'error' })
        })
    }

    const onMessage = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        missed = true
        return
      }
      clearTimeout(timer)
      timer = setTimeout(() => tryReload(0), 100)
    }

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (!missed) return
      missed = false
      tryReload(0)
    }

    syncChannel.addEventListener('message', onMessage)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      syncChannel?.removeEventListener('message', onMessage)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}

/** 다른 탭이 DB를 업그레이드해서 이 탭의 연결이 닫혔는지 */
export function useStaleDb(): boolean {
  const [stale, setStale] = useState(false)
  useEffect(() => {
    const onStale = () => setStale(true)
    window.addEventListener(DB_STALE_EVENT, onStale)
    return () => window.removeEventListener(DB_STALE_EVENT, onStale)
  }, [])
  return stale
}

/**
 * 브라우저에 저장 공간을 "지우지 말라"고 요청한다. 거부되면(Safari 등) 오래 안 쓰면 IndexedDB가
 * 통째로 정리될 수 있으므로 백업을 권하는 안내를 한 번만 띄운다.
 */
export function useStorageGuard(): void {
  const ready = useApp((s) => s.ready)
  useEffect(() => {
    if (!ready || typeof navigator === 'undefined' || !navigator.storage?.persist) return
    let cancelled = false
    navigator.storage
      .persist()
      .then((granted) => {
        if (cancelled || granted) return
        try {
          if (localStorage.getItem(STORAGE_WARNED_KEY)) return
          localStorage.setItem(STORAGE_WARNED_KEY, '1')
        } catch {
          // 저장소 접근이 막힌 환경에서는 안내를 매번 띄운다.
        }
        useToasts.getState().push('브라우저가 이 앱의 저장 공간을 보호해 주지 않아요. 설정 > 데이터에서 가끔 백업해 두세요.', { ttlMs: 12000 })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [ready])
}
