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

/** 에디토리얼 머리글: 큰 세리프 제목, 오른쪽에 개수, 아래에 굵은 괘선 */
export function PageHeader({ title, eyebrow, count, description, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="page-header__title">
          {title}
          {count !== undefined ? <sup className="page-header__count">{count}</sup> : null}
        </h1>
        {description ? <p className="page-header__desc">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  )
}
