/** 충돌 확률이 사실상 없는 ID. randomUUID가 없는 환경(구형 웹뷰)에서는 난수 문자열로 대체한다. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const rand = () => Math.random().toString(36).slice(2, 10)
  return `${Date.now().toString(36)}-${rand()}-${rand()}`
}
