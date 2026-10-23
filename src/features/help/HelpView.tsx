import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import guide from '../../../docs/GUIDE.md?raw'
import { Markdown } from '../../ui/Markdown'
import { splitGuide } from './sections'
import './help.css'

/** 사용 가이드(docs/GUIDE.md)를 장별로 보여준다. 장은 주소(?ch=)에 남아서 새로고침·링크 공유가 된다. */
export function HelpView() {
  const sections = useMemo(() => splitGuide(guide), [])
  const [params, setParams] = useSearchParams()
  const current = sections.find((s) => s.id === params.get('ch')) ?? sections[0]
  const index = sections.indexOf(current)
  const go = (id: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (id === '0') next.delete('ch')
        else next.set('ch', id)
        return next
      },
      { replace: false },
    )

  return (
    <div className="help-layout">
      <nav className="help-toc" aria-label="가이드 목차">
        <ol>
          {sections.map((s) => (
            <li key={s.id}>
              <button type="button" aria-current={s.id === current.id ? 'page' : undefined} onClick={() => go(s.id)}>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="help-select">
        <label htmlFor="help-chapter">장 선택</label>
        <select id="help-chapter" value={current.id} onChange={(e) => go(e.target.value)}>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>

      <article className="help-article">
        <h2 className="help-article__title">{current.title}</h2>
        <Markdown source={current.body} />
        <footer className="help-pager">
          {index > 0 ? (
            <button type="button" onClick={() => go(sections[index - 1].id)}>
              <ChevronLeft size={16} aria-hidden="true" /> {sections[index - 1].title}
            </button>
          ) : (
            <span />
          )}
          {index < sections.length - 1 ? (
            <button type="button" onClick={() => go(sections[index + 1].id)}>
              {sections[index + 1].title} <ChevronRight size={16} aria-hidden="true" />
            </button>
          ) : null}
        </footer>
      </article>
    </div>
  )
}
