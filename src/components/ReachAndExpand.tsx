import { useEffect, useMemo, useState } from 'react';
import type { PinZone } from '../data';
import {
  computeNetworkCoverage,
  computeNetworkHourSummaries,
  groupServedZonesByTaluk,
  RECOMMENDATION_ALTERNATIVE_COUNT,
  recommendNextSiteAlternatives,
  sortServedZones,
  type MaximizeObjective,
  type NetworkSortKey,
} from '../networkCoverage';
import { formatDecimal, formatNumber } from '../format';
import {
  EMPTY_NODE_PROMPT,
  PIN_HELP,
} from '../labels';
import { HowItWorks } from './HowItWorks';
import { DayThresholdToggle } from './DayThresholdToggle';
import { NetworkCoverageMap } from './NetworkCoverageMap';
import { ShipSpeedHint, TransitDayText, TransitDaysHint } from './TransitDaysHint';
import { SavedPinBar } from './SavedPinBar';

type TableView = 'all' | 'zone';

interface ReachAndExpandProps {
  zones: PinZone[];
  pinIndex: Map<string, PinZone>;
  totalMetroPopulation: number;
  totalMetroDemandIndex: number;
  savedPins: string[];
  onAdd: (pincode: string) => boolean;
  onRemove: (pincode: string) => void;
  addError: string | null;
  onClearError: () => void;
}

export function ReachAndExpand({
  zones,
  pinIndex,
  totalMetroPopulation,
  totalMetroDemandIndex,
  savedPins,
  onAdd,
  onRemove,
  addError,
  onClearError,
}: ReachAndExpandProps) {
  const [hourThreshold, setHourThreshold] = useState<1 | 2 | 3>(1);
  const [maximizeFor, setMaximizeFor] =
    useState<MaximizeObjective>('demand_index');
  const [tableView, setTableView] = useState<TableView>('all');
  const [sortKey, setSortKey] = useState<NetworkSortKey>('population');
  const [blacklistedPins, setBlacklistedPins] = useState<string[]>([]);
  const [showAllAlternatives, setShowAllAlternatives] = useState(false);

  const toggleBlacklist = (pincode: string) => {
    setBlacklistedPins((prev) =>
      prev.includes(pincode) ? prev.filter((z) => z !== pincode) : [...prev, pincode],
    );
  };

  const nodes = useMemo(
    () =>
      savedPins
        .map((z) => pinIndex.get(z))
        .filter((z): z is PinZone => z !== undefined),
    [savedPins, pinIndex],
  );

  const summaries = useMemo(
    () =>
      computeNetworkHourSummaries(
        nodes,
        zones,
        totalMetroPopulation,
        totalMetroDemandIndex,
      ),
    [nodes, zones, totalMetroPopulation, totalMetroDemandIndex],
  );

  const networkCoverage = useMemo(
    () => computeNetworkCoverage(nodes, zones),
    [nodes, zones],
  );

  const activeSummary = summaries.find((s) => s.hourThreshold === hourThreshold);

  const servedRows = useMemo(
    () =>
      networkCoverage.filter((z) => z.min_service_hours <= hourThreshold),
    [networkCoverage, hourThreshold],
  );

  const servedByZone = useMemo(
    () => groupServedZonesByTaluk(servedRows),
    [servedRows],
  );

  const sortedAllRows = useMemo(
    () => sortServedZones(servedRows, sortKey),
    [servedRows, sortKey],
  );

  const alternatives = useMemo(
    () =>
      recommendNextSiteAlternatives(
        nodes,
        zones,
        RECOMMENDATION_ALTERNATIVE_COUNT,
        hourThreshold,
        maximizeFor,
        totalMetroPopulation,
        totalMetroDemandIndex,
        blacklistedPins,
      ),
    [
      nodes,
      zones,
      hourThreshold,
      maximizeFor,
      totalMetroPopulation,
      totalMetroDemandIndex,
      blacklistedPins,
    ],
  );

  useEffect(() => {
    setShowAllAlternatives(false);
  }, [hourThreshold, maximizeFor, blacklistedPins, savedPins]);

  const visibleAlternatives = showAllAlternatives
    ? alternatives
    : alternatives.slice(0, 1);
  const moreAlternativeCount = Math.max(0, alternatives.length - 1);

  const recommendedZones = useMemo(
    () => visibleAlternatives.map((r) => r.zone),
    [visibleAlternatives],
  );

  const gainLabel =
    maximizeFor === 'demand_index'
      ? 'demand index'
      : maximizeFor === 'population'
        ? 'population'
        : 'pincodes';

  return (
    <section className="mode-panel reach-panel">
      <HowItWorks />

      <SavedPinBar
        embedded
        savedPins={savedPins}
        pinIndex={pinIndex}
        onAdd={onAdd}
        onRemove={onRemove}
        addError={addError}
        onClearError={onClearError}
        inputId="reach-pin-input"
        label="Add current dark-store / node PINs"
        emptyHint={null}
        examplePlaceholder="560034, 560066, 560100"
        samplePins={['560034', '560066', '560100']}
      />

      <div className="ship-speed-row network-day-selector">
        <span id="reach-ship-speed-label" className="day-selector__label">
          Service speed:
          <ShipSpeedHint />
        </span>
        <DayThresholdToggle
          value={hourThreshold}
          onChange={setHourThreshold}
          disabled={nodes.length === 0}
        />
      </div>

      {nodes.length > 0 && activeSummary && (
        <>
          <p className="origin-label">
            {nodes.length === 1 ? (
              <>
                Selected PINs: <strong>{nodes[0].pincode}</strong>
                {' · '}
                {nodes[0].locality}, {nodes[0].zone_or_taluk}
              </>
            ) : (
              <>
                Selected PINs:{' '}
                <strong>{nodes.map((w) => w.pincode).join(', ')}</strong>
              </>
            )}
          </p>

          <div className="network-hero">
            <p className="network-hero__label">
              Demand served (
              <TransitDayText hours={hourThreshold} hint /> last-mile)
            </p>
            <p className="network-hero__value mono">
              {activeSummary.demandIndexPct.toFixed(1)}%
            </p>
            <p className="network-hero__sub">
              of total Bengaluru demand index (
              <span className="mono">
                {formatDecimal(activeSummary.totalDemandIndex, 1)}
              </span>{' '}
              of{' '}
              <span className="mono">
                {formatDecimal(totalMetroDemandIndex, 1)}
              </span>
              )
            </p>
          </div>

          <div className="summary-cards summary-cards--single">
            <article className="summary-card summary-card--active">
              <h3>
                <TransitDayText hours={activeSummary.hourThreshold} hint /> reach
              </h3>
              <p className="summary-card__stat mono summary-card__stat--sm">
                {formatDecimal(activeSummary.totalDemandIndex, 1)} demand
              </p>
              <p className="summary-card__label">demand index served</p>
              <p className="summary-card__pct mono">
                {activeSummary.demandIndexPct.toFixed(1)}%
              </p>
              <p className="summary-card__label">of Bengaluru demand</p>
              <p className="summary-card__stat mono summary-card__stat--sm">
                {formatNumber(activeSummary.totalPopulation)}
              </p>
              <p className="summary-card__label">
                population ({activeSummary.populationPct.toFixed(1)}%)
              </p>
              <p className="summary-card__stat mono">
                {formatNumber(activeSummary.pincodesServed)}
              </p>
              <p className="summary-card__label">
                PIN {PIN_HELP} zones
              </p>
            </article>
          </div>
        </>
      )}

      <NetworkCoverageMap
        compact
        nodes={nodes}
        recommendedNodes={recommendedZones}
        servedZones={networkCoverage}
        hourThreshold={hourThreshold}
      />

      <section className="reach-panel-section reach-panel-section--planner">
        <h3 className="reach-panel-section__title">
          Where should I launch a node next?
        </h3>

        <div className="expansion-planner">
          <fieldset className="expansion-planner__objective">
            <legend>Maximize for</legend>
            <label className="day-option">
              <input
                type="radio"
                name="maximizeFor"
                value="demand_index"
                checked={maximizeFor === 'demand_index'}
                onChange={() => setMaximizeFor('demand_index')}
                disabled={nodes.length === 0}
              />
              Demand index
            </label>
            <label className="day-option">
              <input
                type="radio"
                name="maximizeFor"
                value="population"
                checked={maximizeFor === 'population'}
                onChange={() => setMaximizeFor('population')}
                disabled={nodes.length === 0}
              />
              Population
            </label>
            <label className="day-option">
              <input
                type="radio"
                name="maximizeFor"
                value="zones"
                checked={maximizeFor === 'zones'}
                onChange={() => setMaximizeFor('zones')}
                disabled={nodes.length === 0}
              />
              Pincodes served
            </label>
          </fieldset>
        </div>

        {nodes.length === 0 ? (
          <p className="saved-zip-bar__note">{EMPTY_NODE_PROMPT}</p>
        ) : (
          <section className="node-recommendations" aria-live="polite">
            <div className="node-recommendations__header">
              <h4 className="node-recommendations__heading">
                Top site alternatives
              </h4>
              <div className="ship-speed-row ship-speed-row--inline">
                <span className="day-selector__label">Service speed:</span>
                <DayThresholdToggle
                  id="reach-recommendations-ship-speed"
                  value={hourThreshold}
                  onChange={setHourThreshold}
                  ariaLabel="Service speed for site alternatives"
                />
              </div>
            </div>
            <p className="node-recommendations__note">
              Five ranked options at{' '}
              <span className="mono">{hourThreshold}h</span> service speed if your
              first choice is ineligible. Excluding a site refreshes the list.
            </p>
            {blacklistedPins.length > 0 && (
              <ul className="recommendation-blacklist">
                {blacklistedPins.map((pincode) => {
                  const zone = pinIndex.get(pincode);
                  return (
                    <li key={pincode} className="recommendation-blacklist__chip">
                      <span className="mono">{pincode}</span>
                      {zone && (
                        <span className="recommendation-blacklist__place">
                          {zone.locality}, {zone.zone_or_taluk}
                        </span>
                      )}
                      <button
                        type="button"
                        className="recommendation-blacklist__remove"
                        onClick={() => toggleBlacklist(pincode)}
                      >
                        Restore
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {alternatives.length === 0 ? (
              <p className="message message--loading">
                No additional nodes improve {gainLabel} at{' '}
                <span className="mono">{hourThreshold}h</span> service speed.
              </p>
            ) : (
              <>
                <ol className="node-recommendations__list">
                  {visibleAlternatives.map((rec) => (
                    <li key={rec.zone.pincode} className="node-recommendation-card">
                      <p className="node-recommendation-card__rank mono">
                        #{rec.rank}
                      </p>
                      <div className="node-recommendation-card__body">
                        <p className="node-recommendation-card__place">
                          <span className="mono">{rec.zone.pincode}</span>
                          {' · '}
                          {rec.zone.locality}, {rec.zone.zone_or_taluk}
                        </p>
                        <p className="node-recommendation-card__gain">
                          Adds{' '}
                          <span className="mono">
                            {maximizeFor === 'zones'
                              ? formatNumber(rec.incrementalGain)
                              : maximizeFor === 'population'
                                ? formatNumber(rec.incrementalGain)
                                : formatDecimal(rec.incrementalGain, 1)}
                          </span>{' '}
                          {gainLabel}
                        </p>
                        <p className="node-recommendation-card__projected">
                          Projected network at{' '}
                          <span className="mono">{hourThreshold}h</span> service
                          speed:{' '}
                          <span className="mono">
                            {rec.demandIndexPct.toFixed(1)}%
                          </span>{' '}
                          Bengaluru demand ·{' '}
                          <span className="mono">
                            {rec.populationPct.toFixed(1)}%
                          </span>{' '}
                          Bengaluru population ·{' '}
                          <span className="mono">
                            {formatNumber(rec.pincodesServed)}
                          </span>{' '}
                          pincodes
                        </p>
                        <button
                          type="button"
                          className="recommendation-exclude-btn"
                          onClick={() => toggleBlacklist(rec.zone.pincode)}
                        >
                          Exclude from recommendations
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                {!showAllAlternatives && moreAlternativeCount > 0 && (
                  <button
                    type="button"
                    className="recommendation-more-btn"
                    onClick={() => setShowAllAlternatives(true)}
                  >
                    See more alternatives..
                  </button>
                )}
              </>
            )}
          </section>
        )}
      </section>

      {nodes.length > 0 && activeSummary && (
        <section className="reach-panel-section">
          <div className="table-controls">
            <h3 className="state-zip-table__heading">Served pincodes</h3>
            <fieldset className="table-view-toggle">
              <legend className="sr-only">Table layout</legend>
              <label className="day-option">
                <input
                  type="radio"
                  name="tableView"
                  checked={tableView === 'all'}
                  onChange={() => setTableView('all')}
                />
                All pincodes
              </label>
              <label className="day-option">
                <input
                  type="radio"
                  name="tableView"
                  checked={tableView === 'zone'}
                  onChange={() => setTableView('zone')}
                />
                By zone
              </label>
            </fieldset>
            <p className="table-count mono">
              {formatNumber(servedRows.length)} pincodes in {servedByZone.length}{' '}
              zones
            </p>
          </div>

          {tableView === 'all' ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PIN</th>
                    <th>Locality / zone</th>
                    <th>
                      <button
                        type="button"
                        className={`sort-btn ${sortKey === 'population' ? 'sort-btn--active' : ''}`}
                        onClick={() => setSortKey('population')}
                      >
                        Population ↓
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className={`sort-btn ${sortKey === 'demand_index' ? 'sort-btn--active' : ''}`}
                        onClick={() => setSortKey('demand_index')}
                      >
                        Demand Index ↓
                      </button>
                    </th>
                    <th>Nearest node</th>
                    <th>
                      Hours <TransitDaysHint />
                    </th>
                    <th>Service band</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAllRows.map((row) => (
                    <tr key={row.zone.pincode}>
                      <td className="mono">{row.zone.pincode}</td>
                      <td>
                        {row.zone.locality}, {row.zone.zone_or_taluk}
                      </td>
                      <td className="mono num">
                        {formatNumber(row.zone.population)}
                      </td>
                      <td className="mono num">
                        {row.zone.demand_index?.toFixed(2) ?? '-'}
                      </td>
                      <td className="mono">{row.nearest_node_pincode}</td>
                      <td className="mono num">{row.min_service_hours}</td>
                      <td className="mono num">{row.service_band}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="state-zip-tables">
              {servedByZone.map((group) => (
                <section key={group.zoneName} className="state-zip-section">
                  <h4 className="state-zip-section__title">
                    <span className="mono">{group.zoneName}</span>
                    <span className="state-zip-section__count">
                      {group.zones.length} PIN
                      {group.zones.length !== 1 ? 's' : ''}
                    </span>
                  </h4>
                  <div className="table-wrap state-zip-section__table">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>PIN</th>
                          <th>Locality</th>
                          <th>Population</th>
                          <th>Demand Index</th>
                          <th>Nearest node</th>
                          <th>
                            Hours <TransitDaysHint />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.zones.map((row) => (
                          <tr key={row.zone.pincode}>
                            <td className="mono">{row.zone.pincode}</td>
                            <td>{row.zone.locality}</td>
                            <td className="mono num">
                              {formatNumber(row.zone.population)}
                            </td>
                            <td className="mono num">
                              {row.zone.demand_index?.toFixed(2) ?? '-'}
                            </td>
                            <td className="mono">{row.nearest_node_pincode}</td>
                            <td className="mono num">{row.min_service_hours}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
