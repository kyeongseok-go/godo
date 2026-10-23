import { splitBulkLines } from './bulk'

describe('splitBulkLines', () => {
  test('a single line stays a single top-level item', () => {
    expect(splitBulkLines('우유 사기')).toEqual([{ text: '우유 사기', depth: 0 }])
  })

  test('ignores blank lines and trims trailing spaces', () => {
    expect(splitBulkLines('가  \n\n나\n')).toEqual([
      { text: '가', depth: 0 },
      { text: '나', depth: 0 },
    ])
  })

  test('indentation by spaces creates nested depth', () => {
    expect(splitBulkLines('장보기\n  우유\n  계란\n    유정란')).toEqual([
      { text: '장보기', depth: 0 },
      { text: '우유', depth: 1 },
      { text: '계란', depth: 1 },
      { text: '유정란', depth: 2 },
    ])
  })

  test('tabs count as one level and list markers are stripped', () => {
    expect(splitBulkLines('- 큰일\n\t- 작은일\n* 다른일')).toEqual([
      { text: '큰일', depth: 0 },
      { text: '작은일', depth: 1 },
      { text: '다른일', depth: 0 },
    ])
  })

  test('markdown checkboxes become plain titles', () => {
    expect(splitBulkLines('- [ ] 해야 할 일\n- [x] 끝난 일')).toEqual([
      { text: '해야 할 일', depth: 0 },
      { text: '끝난 일', depth: 0 },
    ])
  })

  test('a first line that is indented is treated as top level, and jumps are capped at one level', () => {
    expect(splitBulkLines('    시작\n          너무 깊게')).toEqual([
      { text: '시작', depth: 0 },
      { text: '너무 깊게', depth: 1 },
    ])
  })

  test('returns an empty list for whitespace only input', () => {
    expect(splitBulkLines('  \n \t\n')).toEqual([])
  })
})
