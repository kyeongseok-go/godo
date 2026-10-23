import { render, screen } from '@testing-library/react'
import { Markdown, renderMarkdown } from './Markdown'

describe('renderMarkdown', () => {
  test('strips script tags and inline event handlers', () => {
    const html = renderMarkdown('<script>alert(1)</script><img src=x onerror="alert(2)"> 안전')

    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).toContain('안전')
  })

  test('removes javascript: links', () => {
    const html = renderMarkdown('[누르세요](javascript:alert(1))')

    expect(html).not.toContain('javascript:')
  })

  test('opens links in a new tab without leaking window.opener', () => {
    const html = renderMarkdown('[문서](https://example.com)')

    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  test('renders task lists and names each checkbox after its text', () => {
    render(<Markdown source={'- [ ] 우유 사기\n- [x] 빵 사기'} />)

    expect(screen.getByRole('checkbox', { name: '우유 사기' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: '빵 사기' })).toBeChecked()
  })

  test('renders headings, emphasis and code', () => {
    const html = renderMarkdown('# 제목\n\n**굵게** `코드`')

    expect(html).toContain('<h1')
    expect(html).toContain('<strong>굵게</strong>')
    expect(html).toContain('<code>코드</code>')
  })
  // 보안 회귀: 사용자(또는 가져온 파일)가 넣은 HTML 이 앱 화면을 가리거나 흉내 내지 못해야 한다.
  describe('security hardening', () => {
    const mount = (source: string): HTMLElement => {
      const host = document.createElement('div')
      host.innerHTML = renderMarkdown(source)
      return host
    }

    test.each([
      ['top-level style tag', '<style>*{visibility:hidden}</style>'],
      ['style tag after text', '안녕\n\n<style>*{display:none!important}</style>'],
      ['style tag nested in a div', '<div>x<style>.a{}</style></div>'],
      ['style tag inside svg', '<svg><style>*{display:none}</style></svg>'],
    ])('removes %s so no page-wide CSS can be injected', (_name, source) => {
      expect(mount(source).querySelector('style')).toBeNull()
    })

    test('removes inline style attributes that could build a full-screen overlay', () => {
      const host = mount('<div style="position:fixed;inset:0;background:red">가짜 화면</div><p style="color:red">x</p>')

      expect(host.querySelector('[style]')).toBeNull()
      expect(host.textContent).toContain('가짜 화면')
    })

    test('removes class attributes so content cannot borrow the app UI classes', () => {
      expect(mount('<div class="toast" role="alert">시스템 오류</div>').querySelector('[class]')).toBeNull()
    })

    test('removes forms and input widgets that could imitate a login prompt', () => {
      const host = mount(
        '<form action="https://evil.example"><input type="password" name="pw"><button formaction="https://evil.example">확인</button></form><textarea>x</textarea><select><option>a</option></select><input type="text" value="비밀번호">',
      )

      expect(host.querySelector('form, textarea, select, button')).toBeNull()
      expect(host.querySelector('input')).toBeNull()
      expect(host.querySelector('[action], [formaction]')).toBeNull()
    })

    test('keeps only checkbox inputs produced by task lists', () => {
      const host = mount('- [x] 하나\n\n<input type="checkbox" onclick="alert(1)">')

      const inputs = [...host.querySelectorAll('input')]
      expect(inputs.length).toBeGreaterThan(0)
      expect(inputs.every((el) => el.getAttribute('type') === 'checkbox')).toBe(true)
      expect(host.querySelector('[onclick]')).toBeNull()
    })

    test.each([
      ['svg', '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>'],
      ['svg image', '<svg><image href="https://evil.example/p.png"/></svg>'],
      ['svg use', '<svg><use href="data:image/svg+xml,<svg id=x xmlns=http://www.w3.org/2000/svg />#x"/></svg>'],
      ['mathml', '<math><mi xlink:href="javascript:alert(1)">x</mi></math>'],
      ['iframe', '<iframe src="https://evil.example"></iframe>'],
      ['video', '<video src="https://evil.example/v.mp4" onerror="alert(1)"></video>'],
      ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.example">'],
      ['base', '<base href="https://evil.example/">'],
      ['link', '<link rel="stylesheet" href="https://evil.example/x.css">'],
      ['template', '<template><img src=x onerror=alert(1)></template>'],
    ])('drops %s elements', (_name, source) => {
      expect(mount(source).querySelector('svg, math, iframe, video, meta, base, link, template, image, use')).toBeNull()
    })

    test.each([
      ['entity-encoded scheme', '[x](&#106;avascript:alert(1))'],
      ['hex entity scheme', '[x](&#x6A;avascript:alert(1))'],
      ['tab inside scheme', '<a href="java\tscript:alert(1)">x</a>'],
      ['data URL', '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
      ['vbscript', '[x](vbscript:msgbox(1))'],
      ['javascript image', '![x](javascript:alert(1))'],
    ])('neutralises %s in links', (_name, source) => {
      const host = mount(source)
      const urls = [...host.querySelectorAll('[href], [src]')].map((el) => el.getAttribute('href') ?? el.getAttribute('src') ?? '')

      expect(urls.some((url) => /^\s*(javascript|vbscript|data):/i.test(url))).toBe(false)
    })

    test('does not execute mutation-XSS payloads or leave event handler attributes', () => {
      const payloads = [
        '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>">',
        '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
        '<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>',
        '<details open ontoggle="alert(1)">x</details>',
        '&lt;img src=x onerror=alert(1)&gt;',
      ]
      for (const payload of payloads) {
        const host = mount(payload)
        const attrs = [...host.querySelectorAll('*')].flatMap((el) => el.getAttributeNames())

        expect(attrs.some((name) => name.startsWith('on'))).toBe(false)
        expect(host.querySelector('style, form, svg, math')).toBeNull()
      }
    })

    test('forces rel=noopener noreferrer and target=_blank on every link, even when the source says otherwise', () => {
      const host = mount('<a href="https://a.example" target="_self" rel="opener">x</a>')
      const link = host.querySelector('a')

      expect(link?.getAttribute('target')).toBe('_blank')
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
    })

    test('keeps the markdown features the app relies on', () => {
      const host = mount('| a | b |\n|:-|-:|\n| 1 | 2 |\n\n```ts\nx\n```\n\n~~d~~ ![i](x.png "t")\n\n1. a\n2. b')

      expect(host.querySelector('table th[align="left"]')).not.toBeNull()
      expect(host.querySelector('pre code')).not.toBeNull()
      expect(host.querySelector('del')).not.toBeNull()
      expect(host.querySelector('img[alt="i"][title="t"]')).not.toBeNull()
      expect(host.querySelectorAll('ol li')).toHaveLength(2)
    })
  })
})
