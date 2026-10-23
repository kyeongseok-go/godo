import { useSettings } from '../../hooks/data'
import { GoalSettings } from './GoalSettings'
import { KarmaHero, StatRow } from './KarmaHero'
import { ProjectBars } from './ProjectBars'
import { TrendChart } from './TrendChart'
import { useProductivityData } from './useProductivityData'
import './productivity.css'

function Legend({ dailyGoal }: { dailyGoal: number }) {
  return (
    <ul className="prod-legend" aria-label="범례">
      <li><i className="prod-legend__swatch prod-legend__swatch--bar" aria-hidden="true" />완료</li>
      <li><i className="prod-legend__swatch prod-legend__swatch--off" aria-hidden="true" />쉬는 요일</li>
      <li><i className="prod-legend__swatch prod-legend__swatch--today" aria-hidden="true" />오늘</li>
      <li><i className="prod-legend__swatch prod-legend__swatch--goal" aria-hidden="true" />목표선 {dailyGoal}건</li>
    </ul>
  )
}

export function ProductivityView() {
  const settings = useSettings()
  const { productivity } = settings
  const { today, summary, distribution, hasHistory } = useProductivityData()

  return (
    <div className="prod">
      <section className="prod__ledger" aria-label="카르마와 목표">
        <KarmaHero summary={summary} enabled={productivity.karmaEnabled} />
        <StatRow
          summary={summary}
          dailyGoal={productivity.dailyGoal}
          weeklyGoal={productivity.weeklyGoal}
          vacationMode={productivity.vacationMode}
        />
      </section>

      <section className="prod__section" aria-labelledby="prod-trend">
        <header className="prod__section-head">
          <h2 id="prod-trend" className="prod__h2">최근 30일 완료 추이</h2>
          <Legend dailyGoal={Math.max(1, productivity.dailyGoal)} />
        </header>
        {hasHistory ? (
          <TrendChart series={summary.series} dailyGoal={productivity.dailyGoal} daysOff={productivity.daysOff} today={today} />
        ) : (
          <p className="prod-empty">아직 끝낸 일이 없어요. 오늘 하나를 체크하면 첫 막대가 올라와요.</p>
        )}
      </section>

      <div className="prod__split">
        <section className="prod__section" aria-labelledby="prod-projects">
          <header className="prod__section-head">
            <h2 id="prod-projects" className="prod__h2">프로젝트별 완료</h2>
            <span className="prod__sub">최근 30일 · {distribution.total}건</span>
          </header>
          <ProjectBars distribution={distribution} />
        </section>

        <section className="prod__section" aria-labelledby="prod-settings">
          <header className="prod__section-head">
            <h2 id="prod-settings" className="prod__h2">목표와 휴식</h2>
            <span className="prod__sub">바로 저장돼요</span>
          </header>
          <GoalSettings value={productivity} weekStartsOn={settings.weekStartsOn} />
        </section>
      </div>
    </div>
  )
}
