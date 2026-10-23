// 신뢰할 수 없는 JSON 값의 "모양"만 검사한다. 재귀 없이 반복문으로 훑기 때문에 아주 깊은 입력에도 스택이 터지지 않는다.

export interface PayloadLimits {
  /** 객체·배열이 겹쳐 들어갈 수 있는 최대 깊이(최상위 컨테이너가 1) */
  maxDepth: number
  /** 객체·배열을 모두 합친 최대 개수 */
  maxContainers: number
}

/**
 * zod 의 재귀 스키마(템플릿 하위 작업 등)는 중첩이 깊으면 스택 오버플로로 예외를 던지고,
 * 이 예외가 화면 렌더링 중에 나면 앱이 통째로 멈춘다. 스키마를 돌리기 전에 먼저 이 함수로 걸러 낸다.
 */
export function isSafePayloadShape(value: unknown, limits: PayloadLimits): boolean {
  if (typeof value !== 'object' || value === null) return true

  const stack: Array<{ node: object; depth: number }> = [{ node: value, depth: 1 }]
  let containers = 0

  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    containers += 1
    if (item.depth > limits.maxDepth || containers > limits.maxContainers) return false
    for (const child of Object.values(item.node)) {
      if (typeof child === 'object' && child !== null) stack.push({ node: child, depth: item.depth + 1 })
    }
  }
  return true
}

/** 템플릿 payload 한도. 하위 작업 약 60단계, 컨테이너 10만 개면 현실적인 템플릿에 충분하고 zod 재귀(수백 단계에서 터짐)보다 훨씬 안전하다. */
export const TEMPLATE_PAYLOAD_LIMITS: PayloadLimits = { maxDepth: 128, maxContainers: 100_000 }
