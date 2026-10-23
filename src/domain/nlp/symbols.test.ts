import { parseQuickAdd } from './index'
import { makeCtx } from './test-ctx'

const ctx = makeCtx()
const parse = (s: string, c = ctx) => parseQuickAdd(s, c)

describe('project symbol (#)', () => {
  test('resolves a project by name and removes it from the title', () => {
    const r = parse('보고서 쓰기 #업무')
    expect(r.projectId).toBe('p-work')
    expect(r.title).toBe('보고서 쓰기')
    expect(r.tokens).toEqual([
      expect.objectContaining({ kind: 'project', start: 7, end: 10, text: '#업무' }),
    ])
  })

  test('prefers the longest project name that prefixes the typed text', () => {
    expect(parse('정리 #업무일지').projectId).toBe('p-log')
    expect(parse('정리 #업무일지').title).toBe('정리')
  })

  test('matches case-insensitively', () => {
    expect(parse('plan #work').projectId).toBe('p-en')
  })

  test('accepts quoted names containing spaces', () => {
    const r = parse('청소 #"내 프로젝트" 하기')
    expect(r.projectId).toBe('p-my')
    expect(r.title).toBe('청소 하기')
  })

  test('matches names with spaces without quotes by longest prefix', () => {
    const r = parse('#내 프로젝트 정리')
    expect(r.projectId).toBe('p-my')
    expect(r.title).toBe('정리')
  })

  test('이름이 더 긴 단어의 앞부분만 잘라 쓰지 않는다', () => {
    const r = parse('#Workshop prep')
    expect(r.projectId).toBeNull()
    expect(r.title).toBe('#Workshop prep')
    expect(r.tokens).toEqual([])
    const ko = parse('#업무회의 준비')
    expect(ko.projectId).toBeNull()
    expect(ko.title).toBe('#업무회의 준비')
  })

  test('이름 뒤가 공백·끝·기호일 때는 그대로 일치한다', () => {
    expect(parse('#업무 정리').projectId).toBe('p-work')
    expect(parse('정리 #업무').projectId).toBe('p-work')
    expect(parse('정리 #업무, 급함').projectId).toBe('p-work')
    expect(parse('#업무/계획 정리').projectId).toBe('p-work')
  })

  test('ignores an unknown project and keeps it in the title', () => {
    const r = parse('메모 #없는곳')
    expect(r.projectId).toBeNull()
    expect(r.title).toBe('메모 #없는곳')
    expect(r.tokens).toEqual([])
  })

  test('uses only the first project when two are given', () => {
    const r = parse('#업무 #개인 정리')
    expect(r.projectId).toBe('p-work')
    expect(r.title).toBe('#개인 정리')
  })

  test('ignores an unterminated quote and an empty hash', () => {
    expect(parse('a #"내 프로젝트').projectId).toBeNull()
    expect(parse('a # b').title).toBe('a # b')
    expect(parse('a #"" b').projectId).toBeNull()
  })
})

describe('section symbol (/)', () => {
  test('prefers a section of the already chosen project', () => {
    const r = parse('#개인 /계획 책 읽기')
    expect(r.projectId).toBe('p-home')
    expect(r.sectionId).toBe('s-home-plan')
    expect(r.title).toBe('책 읽기')
  })

  test('uses the project given after the section too', () => {
    const r = parse('/계획 책 읽기 #개인')
    expect(r.sectionId).toBe('s-home-plan')
  })

  test('infers the project from the section when none is typed', () => {
    const r = parse('/장보기 우유')
    expect(r.sectionId).toBe('s-home-buy')
    expect(r.projectId).toBe('p-home')
  })

  test('falls back to a section of another project when the chosen project lacks it', () => {
    const r = parse('#개인 /진행 일')
    expect(r.projectId).toBe('p-home')
    expect(r.sectionId).toBe('s-work-doing')
  })

  test('섹션 이름도 경계까지 맞아야 한다', () => {
    const r = parse('/계획표 작성')
    expect(r.sectionId).toBeNull()
    expect(r.projectId).toBeNull()
    expect(r.title).toBe('/계획표 작성')
  })

  test('ignores unknown sections and keeps them in the title', () => {
    const r = parse('/없음 일')
    expect(r.sectionId).toBeNull()
    expect(r.title).toBe('/없음 일')
  })
})

describe('label symbols (@ and %)', () => {
  test('resolves existing labels by name', () => {
    const r = parse('전화 @중요 %urgent')
    expect(r.labelIds).toEqual(['l-important', 'l-urgent'])
    expect(r.newLabelNames).toEqual([])
    expect(r.title).toBe('전화')
  })

  test('reports unknown labels as new label names without duplicates', () => {
    const r = parse('일 @집중 @집중 %새라벨')
    expect(r.labelIds).toEqual([])
    expect(r.newLabelNames).toEqual(['집중', '새라벨'])
  })

  test('does not duplicate an existing label used twice', () => {
    expect(parse('@중요 @중요 x').labelIds).toEqual(['l-important'])
  })

  test('ignores a bare symbol and percentages', () => {
    expect(parse('할인 50% 확인').title).toBe('할인 50% 확인')
    expect(parse('a @ b').newLabelNames).toEqual([])
    expect(parse('a % b').newLabelNames).toEqual([])
  })
})

describe('priority (p1 to p4)', () => {
  test('reads p1 to p4 as separate words', () => {
    expect(parse('p1 일').priority).toBe(1)
    expect(parse('일 p2').priority).toBe(2)
    expect(parse('일 P3 하기').priority).toBe(3)
    expect(parse('일 p4').priority).toBe(4)
  })

  test('ignores p5, pp1, p12 and words that merely contain p1', () => {
    for (const s of ['일 p5', '일 pp1', '일 p12', '일 ap1', '일 p0', 'https://x.com/p1']) {
      expect(parse(s).priority).toBeNull()
      expect(parse(s).title).toBe(s)
    }
  })

  test('keeps the second priority in the title', () => {
    const r = parse('p1 일 p2')
    expect(r.priority).toBe(1)
    expect(r.title).toBe('일 p2')
  })

  test('allows a Korean particle or punctuation right after the word', () => {
    expect(parse('일 p1,').priority).toBe(1)
  })
})

describe('estimate (~) and reminders (!)', () => {
  test('reads estimate minutes in several spellings', () => {
    expect(parse('일 ~30분').estimateMin).toBe(30)
    expect(parse('일 ~1h').estimateMin).toBe(60)
    expect(parse('일 ~1시간').estimateMin).toBe(60)
    expect(parse('일 ~1시간 30분').estimateMin).toBe(90)
    expect(parse('일 ~1h30m').estimateMin).toBe(90)
    expect(parse('일 ~1.5h').estimateMin).toBe(90)
    expect(parse('일 ~1시간반').estimateMin).toBe(90)
    expect(parse('일 ~90min').estimateMin).toBe(90)
  })

  test('removes the estimate phrase from the title and records its token', () => {
    const r = parse('일 ~1시간 30분 하기')
    expect(r.title).toBe('일 하기')
    expect(r.tokens[0]).toMatchObject({ kind: 'estimate', start: 2, end: 10, text: '~1시간 30분' })
  })

  test('ignores a tilde without a duration', () => {
    const r = parse('~/문서 정리 ~약간')
    expect(r.estimateMin).toBeNull()
    expect(r.title).toBe('~/문서 정리 ~약간')
  })

  test('keeps a second estimate in the title', () => {
    const r = parse('일 ~30분 ~1h')
    expect(r.estimateMin).toBe(30)
    expect(r.title).toBe('일 ~1h')
  })

  test('collects several reminders in order without duplicates', () => {
    const r = parse('회의 !30분 !1h !1시간 !1일')
    expect(r.reminderOffsetsMin).toEqual([30, 60, 1440])
    expect(r.title).toBe('회의')
  })

  test('ignores exclamation marks that are not reminders', () => {
    const r = parse('급해! 빨리 !중요 ! 끝')
    expect(r.reminderOffsetsMin).toEqual([])
    expect(r.title).toBe('급해! 빨리 !중요 ! 끝')
  })
})

describe('deadline braces', () => {
  test('puts a braced date into dueDate, not startDate', () => {
    const r = parse('보고서 {내일}')
    expect(r.dueDate).toBe('2026-10-24')
    expect(r.startDate).toBeNull()
    expect(r.title).toBe('보고서')
    expect(r.tokens[0]).toMatchObject({ kind: 'deadline', start: 4, end: 8, text: '{내일}' })
  })

  test('ignores braces that do not contain a plain date', () => {
    const r = parse('코드 {a: 1} {} {메모} {내일 오후}')
    expect(r.dueDate).toBeNull()
    expect(r.startDate).toBe('2026-10-24') // 중괄호가 아니어도 자연어 날짜는 시작일로 읽는다
    expect(r.title).toBe('코드 {a: 1} {} {메모}')
  })

  test('still reads braces when natural-language dates are off', () => {
    const r = parse('보고서 {내일}', makeCtx({ parseDates: false }))
    expect(r.dueDate).toBe('2026-10-24')
  })
})

describe('symbol boundaries', () => {
  test('does not treat C#, emails or URLs as symbols', () => {
    for (const s of ['C# 공부', 'a@b.com 보내기', 'https://x.com/#업무/계획@중요 p1 확인']) {
      const r = parse(s)
      expect(r.projectId).toBeNull()
      expect(r.sectionId).toBeNull()
      expect(r.labelIds).toEqual([])
      expect(r.newLabelNames).toEqual([])
    }
    expect(parse('https://x.com/#업무 읽기').title).toBe('https://x.com/#업무 읽기')
    expect(parse('이메일 a@b.com').title).toBe('이메일 a@b.com')
  })

  test('keeps symbol-only text working when the whole input is consumed', () => {
    const r = parse('#업무')
    expect(r.title).toBe('')
    expect(r.projectId).toBe('p-work')
  })

  test('handles empty and whitespace-only input', () => {
    for (const s of ['', '   ']) {
      const r = parse(s)
      expect(r.title).toBe('')
      expect(r.tokens).toEqual([])
      expect(r.labelIds).toEqual([])
    }
  })
})

describe('parseDates off', () => {
  const off = makeCtx({ parseDates: false })

  test('leaves dates, times and recurrences in the title but still reads symbols', () => {
    const r = parse('내일 오후 3시 매주 월요일 회의 #업무 @중요 p1 ~1h !10분', off)
    expect(r.startDate).toBeNull()
    expect(r.startTime).toBeNull()
    expect(r.recurrence).toBeNull()
    expect(r.title).toBe('내일 오후 3시 매주 월요일 회의')
    expect(r.projectId).toBe('p-work')
    expect(r.labelIds).toEqual(['l-important'])
    expect(r.priority).toBe(1)
    expect(r.estimateMin).toBe(60)
    expect(r.reminderOffsetsMin).toEqual([10])
  })
})

describe('token invariants', () => {
  test('tokens are sorted, non-overlapping and point into the original input', () => {
    const input = '내일 오후 3시 팀 회의 #업무 @중요 p1 ~1h !10분 /계획'
    const r = parse(input)
    for (let i = 0; i < r.tokens.length; i += 1) {
      const t = r.tokens[i]
      expect(input.slice(t.start, t.end)).toBe(t.text)
      if (i > 0) expect(t.start).toBeGreaterThanOrEqual(r.tokens[i - 1].end)
    }
  })

  test('does not mutate the context it receives', () => {
    const c = makeCtx()
    const snapshot = JSON.stringify(c)
    parse('내일 #업무 @새라벨 매주 월요일', c)
    expect(JSON.stringify(c)).toBe(snapshot)
  })
})
