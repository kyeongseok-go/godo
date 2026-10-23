import { useEffect, useRef } from 'react'

/** 이 컴포넌트가 떠 있는 동안만 문서 제목을 바꾼다. text 가 null 이면 원래 제목, 떠나면 원래 제목으로 복원한다. */
export function useDocumentTitle(text: string | null): void {
  const original = useRef<string | null>(null)

  useEffect(() => {
    original.current = document.title
    return () => {
      if (original.current !== null) document.title = original.current
    }
  }, [])

  useEffect(() => {
    if (original.current === null) return
    document.title = text === null ? original.current : `${text} · ${original.current}`
  }, [text])
}
