import type { ReactNode } from 'react'
import './page-header.css'

interface PageHeaderProps {
  title: string
  /** 제목 위에 작게 얹는 한 줄(날짜, 경로 등) */
  eyebrow?: string
  /** 제목 옆에 크게 보이는 숫자 */
  count?: number
  description?: ReactNode
  actions?: ReactNode
}

/** 화면 머리글: 날짜 한 줄 + 제목 + 개수 알약. 제목이 화면을 다 먹지 않도록 작게 둔다. */
export function PageHeader({ title, eyebrow, count, description, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="page-header__title">
          {title}
          {count !== undefined ? <span className="page-header__count">{count}</span> : null}
        </h1>
        {description ? <p className="page-header__desc">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  )
}
