import { splitGuide } from './sections'

describe('splitGuide', () => {
  test('puts everything before the first ## into an intro section', () => {
    const [intro, first] = splitGuide('# 제목\n\n소개\n\n## 1. 시작\n내용')

    expect(intro).toMatchObject({ id: '0', title: '시작' })
    expect(intro.body).toContain('소개')
    expect(first).toMatchObject({ id: '1', title: '1. 시작', body: '내용' })
  })

  test('drops the document title so the page does not end up with two h1 headings', () => {
    const [intro] = splitGuide('# 문서 제목\n\n소개 문장\n\n## 1. 장')

    expect(intro.body).toBe('소개 문장')
  })

  test('does not split on ## inside a code fence', () => {
    const sections = splitGuide('## 장\n```\n## 코드 안\n```\n뒤')

    expect(sections.map((s) => s.title)).toEqual(['시작', '장'])
    expect(sections[1].body).toContain('## 코드 안')
  })

  test('drops horizontal rules between chapters', () => {
    const sections = splitGuide('## A\n본문\n\n---\n\n## B\n다음')

    expect(sections[1].body).toBe('본문')
  })

  test('keeps the real guide intact: every chapter has a body and titles are numbered', async () => {
    const raw = (await import('../../../docs/GUIDE.md?raw')).default
    const sections = splitGuide(raw)

    expect(sections.length).toBeGreaterThanOrEqual(12)
    expect(sections.every((s) => s.body.length > 20)).toBe(true)
    expect(sections.slice(1).map((s) => s.title.split('.')[0])).toEqual(
      sections.slice(1).map((_, i) => String(i)),
    )
  })
})
