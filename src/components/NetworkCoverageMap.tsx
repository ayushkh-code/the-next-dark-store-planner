import { useMemo, useState } from 'react';
import type { PinZone } from '../data';
import type { ServedZone } from '../networkCoverage';
import { formatNumber } from '../format';
import { EMPTY_NODE_PROMPT } from '../labels';
import { TransitDayText } from './TransitDaysHint';
import {
  HOUR_COLORS,
  MAP_HEIGHT,
  MAP_WIDTH,
  dotRadius,
  getZoneMapLabels,
  projectPoint,
  zonePaths,
  zoneFillColor,
  zoneOpacity,
} from '../map';

const zoneLabels = getZoneMapLabels();

interface NetworkCoverageMapProps {
  nodes: PinZone[];
  recommendedNodes?: PinZone[];
  servedZones: ServedZone[];
  hourThreshold: 1 | 2 | 3;
  /** Tighter layout for Reach & Expand (title only, minimal frame padding). */
  compact?: boolean;
}

interface HoveredZone {
  pincode: string;
  label: string;
  service_hours: number;
  node: string;
  population: number | null;
  x: number;
  y: number;
}

export function NetworkCoverageMap({
  nodes,
  recommendedNodes = [],
  servedZones,
  hourThreshold,
  compact = false,
}: NetworkCoverageMapProps) {
  const [hovered, setHovered] = useState<HoveredZone | null>(null);
  const nodePins = useMemo(
    () => new Set(nodes.map((w) => w.pincode)),
    [nodes],
  );

  const plotted = useMemo(() => {
    return servedZones
      .map((row) => {
        const coords = projectPoint(
          row.zone.centroid_lat,
          row.zone.centroid_lng,
        );
        if (!coords) return null;
        const isNode = nodePins.has(row.zone.pincode);
        const within = row.min_service_hours <= hourThreshold;
        return {
          row,
          x: coords[0],
          y: coords[1],
          isNode,
          within,
          r: dotRadius(row.zone.population, isNode),
          fill: zoneFillColor(row.min_service_hours, within, isNode),
          opacity: zoneOpacity(row.min_service_hours, hourThreshold, isNode),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => a.r - b.r);
  }, [servedZones, nodePins, hourThreshold]);

  const recommendedMarkers = useMemo(() => {
    return recommendedNodes
      .map((zone, i) => {
        const coords = projectPoint(zone.centroid_lat, zone.centroid_lng);
        if (!coords || nodePins.has(zone.pincode)) return null;
        return {
          zone,
          rank: i + 1,
          x: coords[0],
          y: coords[1],
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [recommendedNodes, nodePins]);

  return (
    <div className={compact ? 'coverage-map coverage-map--reach' : 'coverage-map'}>
      {compact ? (
        <div className="coverage-map__header coverage-map__header--compact">
          <h3>Coverage Map</h3>
        </div>
      ) : (
        <div className="coverage-map__header">
          <h3>Network coverage map</h3>
          <p>
            {nodes.length > 0
              ? `${nodes.length} node${nodes.length > 1 ? 's' : ''}: demand served within `
              : EMPTY_NODE_PROMPT}
            {nodes.length > 0 && (
              <>
                <TransitDayText hours={hourThreshold} />
                {' highlighted'}
              </>
            )}
          </p>
        </div>
      )}

      <div className="coverage-map__frame">
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="coverage-map__svg"
          preserveAspectRatio={compact ? 'xMidYMax meet' : undefined}
          role="img"
          aria-label={
            compact
              ? `Bengaluru network coverage map at ${hourThreshold}-hour service speed`
              : 'Bengaluru map showing multi-node network coverage'
          }
        >
          <defs>
            <filter
              id="coverage-glow"
              x="-80%"
              y="-80%"
              width="260%"
              height="260%"
            >
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#F8F7F5" rx={4} />

          <g className="coverage-map__states">
            {zonePaths.map((s) =>
              s.d ? (
                <path
                  key={s.id}
                  d={s.d}
                  fill="#EFEDE8"
                  stroke="#E3E0DB"
                  strokeWidth={0.6}
                />
              ) : null,
            )}
          </g>

          {plotted.map(({ row, x, y, r, fill, opacity, isNode, within }) => (
            <circle
              key={row.zone.pincode}
              cx={x}
              cy={y}
              r={r}
              fill={fill}
              fillOpacity={opacity}
              stroke={isNode ? '#0F2438' : 'none'}
              strokeWidth={isNode ? 2 : 0}
              filter={within && !isNode ? 'url(#coverage-glow)' : undefined}
              className={`coverage-map__dot${within ? ' coverage-map__dot--within' : ''}`}
              onMouseEnter={() =>
                setHovered({
                  pincode: row.zone.pincode,
                  label: `${row.zone.locality}, ${row.zone.zone_or_taluk}`,
                  service_hours: row.min_service_hours,
                  node: row.nearest_node_pincode,
                  population: row.zone.population,
                  x,
                  y,
                })
              }
              onMouseLeave={() => setHovered(null)}
            />
          ))}

          {recommendedMarkers.map(({ zone, rank, x, y }) => (
            <g
              key={`rec-${zone.pincode}`}
              className="coverage-map__recommended"
              transform={`translate(${x}, ${y})`}
              aria-label={`Recommended node ${rank}: ${zone.pincode}`}
            >
              <circle
                className="coverage-map__recommended-halo"
                r={10}
                fill="none"
                stroke="#16a34a"
                strokeWidth={2}
              />
              <circle
                className="coverage-map__recommended-dot"
                r={5}
                fill="#16a34a"
                stroke="#fff"
                strokeWidth={1.5}
              />
              <text
                y={18}
                textAnchor="middle"
                className="coverage-map__recommended-label mono"
              >
                #{rank} {zone.pincode}
              </text>
            </g>
          ))}

          <g className="density-map__labels" aria-hidden="true">
            {zoneLabels.map((st) => (
              <text
                key={`label-${st.name}`}
                x={st.x}
                y={st.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="density-map__label network-map__state-label"
                fill="#374151"
                fontSize={st.abbr.length > 3 ? 8 : 10}
              >
                {st.abbr}
              </text>
            ))}
          </g>
        </svg>

        {hovered && (
          <div
            className="coverage-map__tooltip"
            style={{
              left: `${(hovered.x / MAP_WIDTH) * 100}%`,
              top: `${(hovered.y / MAP_HEIGHT) * 100}%`,
            }}
          >
            <strong className="mono">{hovered.pincode}</strong>
            <span>{hovered.label}</span>
            <span className="mono">
              {hovered.service_hours} hour{hovered.service_hours > 1 ? 's' : ''}{' '}
              from {hovered.node}
            </span>
            <span className="mono">Pop. {formatNumber(hovered.population)}</span>
          </div>
        )}
      </div>

      {nodes.length > 0 && (
        <ul className="coverage-map__legend" aria-label="Map legend">
          <li>
            <span
              className="coverage-map__swatch"
              style={{ background: HOUR_COLORS[1] }}
            />
            <TransitDayText hours={1} hint />
          </li>
          <li>
            <span
              className="coverage-map__swatch"
              style={{ background: HOUR_COLORS[2] }}
            />
            <TransitDayText hours={2} hint />
          </li>
          <li>
            <span
              className="coverage-map__swatch"
              style={{ background: HOUR_COLORS[3] }}
            />
            <TransitDayText hours={3} hint />
          </li>
          <li>
            <span className="coverage-map__swatch coverage-map__swatch--muted" />
            Not served
          </li>
          <li>
            <span className="coverage-map__swatch coverage-map__swatch--origin" />
            Existing node
          </li>
          {recommendedMarkers.length > 0 && (
            <li>
              <span className="coverage-map__swatch coverage-map__swatch--recommended" />
              Recommended node
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
