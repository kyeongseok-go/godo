import { describe, expect, it } from 'vitest'
import { parseCsvRows, toCsvRow } from './csv-core'

describe('toCsvRow', () => {
  it('joins plain cells with commas', () => {
    expect(toCsvRow(['a', 'b', 'c'])).toBe('a,b,c')
  })

  it('keeps empty cells as empty fields', () => {
    expect(toCsvRow(['a', '', 'c', ''])).toBe('a,,c,')
  })

  it('quotes cells that contain commas', () => {
    expect(toCsvRow(['a,b', 'c'])).toBe('"a,b",c')
  })

  it('doubles double quotes inside quoted cells', () => {
    expect(toCsvRow(['say "hi"'])).toBe('"say ""hi"""')
  })

  it('quotes cells that contain line breaks', () => {
    expect(toCsvRow(['a\nb', 'c\r\nd', 'e\rf'])).toBe('"a\nb","c\r\nd","e\rf"')
  })

  it('does not quote Korean text or spaces', () => {
    expect(toCsvRow(['보고서 작성', ' 공백 '])).toBe('보고서 작성, 공백 ')
  })

  it('returns an empty string for no cells', () => {
    expect(toCsvRow([])).toBe('')
  })
})

describe('parseCsvRows', () => {
  it('parses simple rows', () => {
    expect(parseCsvRows('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('returns no rows for empty text', () => {
    expect(parseCsvRows('')).toEqual([])
  })

  it('does not add an empty row for a trailing newline', () => {
    expect(parseCsvRows('a,b\n')).toEqual([['a', 'b']])
    expect(parseCsvRows('a,b\r\n')).toEqual([['a', 'b']])
  })

  it('keeps a trailing empty field', () => {
    expect(parseCsvRows('a,\n')).toEqual([['a', '']])
  })

  it('keeps blank lines as a single empty cell row', () => {
    expect(parseCsvRows('a\n\nb')).toEqual([['a'], [''], ['b']])
  })

  it('handles CRLF and lone CR line endings', () => {
    expect(parseCsvRows('a,b\r\nc,d\re,f')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ])
  })

  it('reads commas inside quotes as part of the cell', () => {
    expect(parseCsvRows('"a,b",c')).toEqual([['a,b', 'c']])
  })

  it('reads doubled quotes as one literal quote', () => {
    expect(parseCsvRows('"say ""hi""",x')).toEqual([['say "hi"', 'x']])
  })

  it('reads line breaks inside quotes as part of the cell', () => {
    expect(parseCsvRows('"line1\nline2",x\r\ny,z')).toEqual([
      ['line1\nline2', 'x'],
      ['y', 'z'],
    ])
  })

  it('keeps a quoted empty final field', () => {
    expect(parseCsvRows('a,""')).toEqual([['a', '']])
  })

  it('strips a leading UTF-8 BOM', () => {
    expect(parseCsvRows('﻿TYPE,CONTENT\ntask,x')).toEqual([
      ['TYPE', 'CONTENT'],
      ['task', 'x'],
    ])
  })

  it('treats a quote in the middle of an unquoted cell as a literal', () => {
    expect(parseCsvRows('5"6,x')).toEqual([['5"6', 'x']])
  })

  it('keeps text after a closing quote instead of dropping it', () => {
    expect(parseCsvRows('"ab"cd,x')).toEqual([['abcd', 'x']])
  })

  it('reads an unterminated quote up to the end of the text', () => {
    expect(parseCsvRows('a,"unfinished\nstill')).toEqual([['a', 'unfinished\nstill']])
  })

  it('round-trips tricky cells through toCsvRow', () => {
    const cells = ['a,b', 'say "hi"', 'multi\nline', '', '한글']
    expect(parseCsvRows(toCsvRow(cells))).toEqual([cells])
  })
})
