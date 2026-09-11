import { CreatorCredit } from './CreatorCredit';
import { VisitorCount } from './VisitorCount';

interface AppHeroProps {
  totalPopulation: number;
  zoneCount: number;
  statsReady?: boolean;
}

function formatCompactPeople(n: number): string {
  if (n >= 1_000_000) {
    const millions = n / 1_000_000;
    const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10;
    return `${rounded}M people`;
  }
  return `${n.toLocaleString('en-IN')} people`;
}

export function AppHero({
  totalPopulation,
  zoneCount,
  statsReady = true,
}: AppHeroProps) {
  return (
    <div className="app-hero">
      <div className="app-hero__inner">
        <div className="app-hero__top">
          <div className="app-hero__brand">
            <h1 className="app-hero__title">The next Dark store planner</h1>
            <VisitorCount />
          </div>
          <CreatorCredit />
        </div>
        <p className="app-hero__subhead">
          Find where to place your next dark store. See what population your
          current last-mile and micro-fulfillment network reaches today, then
          get data-backed recommendations for where to expand across Bengaluru.
        </p>
        {statsReady && (
          <dl className="app-hero__stats">
          <div className="app-hero__stat">
            <dt className="app-hero__stat-value mono">
              {formatCompactPeople(totalPopulation)}
            </dt>
            <dd className="app-hero__stat-label">in dataset</dd>
          </div>
          <div className="app-hero__stat">
            <dt className="app-hero__stat-value mono">{zoneCount}</dt>
            <dd className="app-hero__stat-label">Bengaluru PINs</dd>
          </div>
          <div className="app-hero__stat">
            <dt className="app-hero__stat-value">Ward-backed</dt>
            <dd className="app-hero__stat-label">demand data</dd>
          </div>
        </dl>
        )}
      </div>
    </div>
  );
}
