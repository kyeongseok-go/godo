import type { ProjectDistribution } from './chart'

/** 프로젝트별 완료 건수 가로 막대. 막대 길이는 transform 으로만 그린다. */
export function ProjectBars({ distribution }: { distribution: ProjectDistribution }) {
  if (distribution.items.length === 0) {
    return <p className="prod-empty">최근 30일에 끝낸 일이 없어요. 하나만 끝내도 여기에 쌓여요.</p>
  }
  return (
    <>
      <ul className="prod-pbars">
        {distribution.items.map((item) => (
          <li key={item.projectId} className="prod-pbars__row">
            <span className="prod-pbars__name">
              <i className="dot" style={{ background: item.color }} aria-hidden="true" />
              {item.name}
            </span>
            <span className="prod-pbars__track" aria-hidden="true">
              <span className="prod-pbars__fill" style={{ ['--ratio' as string]: item.ratio, background: item.color }} />
            </span>
            <span className="prod-pbars__count">{item.count}<span className="sr-only">건 완료</span></span>
          </li>
        ))}
      </ul>
      {distribution.otherProjects > 0 ? (
        <p className="prod-note">그 밖에 {distribution.otherProjects}개 프로젝트에서도 끝냈어요.</p>
      ) : null}
    </>
  )
}
