// 가이드 문서(docs/GUIDE.md)를 장(##) 단위로 나눈다. 앱 안 도움말 화면이 장별로 보여주기 위해 쓴다.

export interface GuideSection {
  /** URL에 쓰는 순번 키. 머리말은 '0' */
  id: string
  /** 목차에 보일 제목(번호 포함, 예: "2. 빠른 추가 — 이 앱의 핵심") */
  title: string
  /** 제목 줄을 뺀 본문 마크다운 */
  body: string
}

/**
 * 첫 `## ` 앞은 "시작" 머리말, 이후는 `## ` 마다 한 장. 코드 블록 안의 `## `는 장 구분으로 보지 않는다.
 * `---` 구분선은 화면에서 의미가 없으므로 뺀다.
 */
export function splitGuide(markdown: string): GuideSection[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const sections: { title: string; lines: string[] }[] = [{ title: '시작', lines: [] }]
  let inFence = false
  for (const line of lines) {
    if (line.trim().startsWith('```')) inFence = !inFence
    if (!inFence && /^## /.test(line)) {
      sections.push({ title: line.replace(/^## /, '').trim(), lines: [] })
      continue
    }
    sections[sections.length - 1].lines.push(line)
  }
  return sections
    .map((s, i) => ({
      id: String(i),
      title: s.title,
      body: s.lines.filter((l) => l.trim() !== '---').join('\n').trim(),
    }))
    .filter((s) => s.body.length > 0 || s.id === '0')
}
