// 팔레트·검색용 간단한 매칭. 한글은 형태소 분석 없이 "모든 검색어가 포함되는지"로 충분하다.

/** 점수가 높을수록 잘 맞는다. 0이면 불일치. */
export function matchScore(text: string, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const t = text.toLowerCase()
  const terms = q.split(/\s+/)
  let score = 0
  for (const term of terms) {
    const at = t.indexOf(term)
    if (at === -1) return 0
    // 앞에서 시작할수록, 단어 경계에서 시작할수록 높게 준다.
    score += at === 0 ? 3 : /\s|[-_/]/.test(t[at - 1] ?? '') ? 2 : 1
  }
  if (t === q) score += 5
  return score
}

export function rankBy<T>(items: readonly T[], query: string, text: (item: T) => string, limit: number): T[] {
  return items
    .map((item) => ({ item, score: matchScore(text(item), query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.item)
}
