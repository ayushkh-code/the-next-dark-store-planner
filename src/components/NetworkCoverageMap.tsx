import { useMemo, useState } from 'react';
import type { PinZone } from '../data';
import type { ServedZone } from '../networkCoverage';
import { formatNumber } from '../format';
import { EMPTY_NODE_PROMPT } from '../labels';
import { TransitDayText } from './TransitDaysHint';
import { computeRegionCoverage } from '../regionCoverage';
import {
  HOUR_COLORS,
  MAP_HEIGHT,
  MAP_WIDTH,
  NODE_MARKER_COLOR,
  getZoneMapLabels,
  lakePaths,
  projectPoint,
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

interface HoveredRegion {
  name: string;
  pincode: string;
  locality: string;
  service_hours: number;
  node: string;
  population: number | null;
  within: boolean;
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
  const [hovered, setHovered] = useState<HoveredRegion | null>(null);
  const nodePins = useMemo(
    () => new Set(nodes.map((w) => w.pincode)),
    [nodes],
  );

  const regions = useMemo(
    () => computeRegionCoverage(servedZones, nodePins, hourThreshold),
    [servedZones, nodePins, hourThreshold],
  );

  const nodeMarkers = useMemo(() => {
    return nodes
      .map((zone) => {
        const coords = projectPoint(zone.centroid_lat, zone.centroid_lng);
        if (!coords) return null;
        return { zone, x: coords[0], y: coords[1] };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [nodes]);

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
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#F8F7F5" rx={4} />

          <g className="coverage-map__taluks">
            {regions.taluks.map((region) =>
              region.path ? (
                <path
                  key={region.id}
                  d={region.path}
                  fill={region.fill}
                  stroke={region.isOrigin ? NODE_MARKER_COLOR : '#F8F7F5'}
                  strokeWidth={region.isOrigin ? 1.4 : 0.55}
                  className="coverage-map__region"
                  onMouseEnter={() =>
                    setHovered({
                      name: region.name,
                      pincode: region.pincode,
                      locality: region.locality,
                      service_hours: region.hours,
                      node: region.node,
                      population: region.population,
                      within: region.within,
                      x: region.x,
                      y: region.y,
                    })
                  }
                  onMouseLeave={() => setHovered(null)}
                />
              ) : null,
            )}
          </g>

          <g className="coverage-map__states">
            {regions.wards.map((region) =>
              region.path ? (
                <path
                  key={region.id}
                  d={region.path}
                  fill={region.fill}
                  stroke={region.isOrigin ? NODE_MARKER_COLOR : '#F8F7F5'}
                  strokeWidth={region.isOrigin ? 1.4 : 0.45}
                  className="coverage-map__region"
                  onMouseEnter={() =>
                    setHovered({
                      name: region.name,
                      pincode: region.pincode,
                      locality: region.locality,
                      service_hours: region.hours,
                      node: region.node,
                      population: region.population,
                      within: region.within,
                      x: region.x,
                      y: region.y,
                    })
                  }
                  onMouseLeave={() => setHovered(null)}
                />
              ) : null,
            )}
          </g>

          <g className="coverage-map__lakes">
            {lakePaths.map((s) =>
              s.d ? (
                <path
                  key={`lake-${s.id}`}
                  d={s.d}
                  fill="#C5D4DE"
                  stroke="#B3C5D1"
                  strokeWidth={0.4}
                />
              ) : null,
            )}
          </g>

          {regions.orphans.map((pin) =>
            pin.isOrigin ? null : (
              <circle
                key={`orphan-${pin.pincode}`}
                cx={pin.x}
                cy={pin.y}
                r={4.5}
                fill={pin.fill}
                stroke={pin.within ? '#0F2438' : 'none'}
                strokeWidth={pin.within ? 0.6 : 0}
                className="coverage-map__region-dot"
                onMouseEnter={() =>
                  setHovered({
                    name: pin.locality,
                    pincode: pin.pincode,
                    locality: pin.locality,
                    service_hours: pin.hours,
                    node: pin.node,
                    population: pin.population,
                    within: pin.within,
                    x: pin.x,
                    y: pin.y,
                  })
                }
                onMouseLeave={() => setHovered(null)}
              />
            ),
          )}

          {nodeMarkers.map(({ zone, x, y }) => (
            <g
              key={`node-${zone.pincode}`}
              className="coverage-map__node"
              transform={`translate(${x}, ${y})`}
              aria-label={`Existing node ${zone.pincode}`}
            >
              <circle
                r={6.5}
                fill={NODE_MARKER_COLOR}
                stroke="#fff"
                strokeWidth={1.75}
              />
            </g>
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
                fontSize={st.name.length > 8 ? 8 : 10}
              >
                {st.name}
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
            <strong>{hovered.name}</strong>
            {hovered.pincode ? (
              <span>
                {hovered.locality} ·{' '}
                <span className="mono">{hovered.pincode}</span>
              </span>
            ) : null}
            <span className="mono">
              {Number.isFinite(hovered.service_hours)
                ? `${hovered.service_hours} hour${hovered.service_hours > 1 ? 's' : ''}${
                    hovered.within ? '' : ' (beyond threshold)'
                  } from ${hovered.node}`
                : 'No coverage yet'}
            </span>
            <span className="mono">Pop. {formatNumber(hovered.population)}</span>
          </div>
        )}
      </div>

      {nodes.length > 0 && (
        <ul className="coverage-map__legend" aria-label="Map legend">
          <li>
            <span
              className="coverage-map__swatch coverage-map__swatch--fill"
              style={{ background: HOUR_COLORS[1] }}
            />
            <TransitDayText hours={1} hint />
          </li>
          <li>
            <span
              className="coverage-map__swatch coverage-map__swatch--fill"
              style={{ background: HOUR_COLORS[2] }}
            />
            <TransitDayText hours={2} hint />
          </li>
          <li>
            <span
              className="coverage-map__swatch coverage-map__swatch--fill"
              style={{ background: HOUR_COLORS[3] }}
            />
            <TransitDayText hours={3} hint />
          </li>
          <li>
            <span className="coverage-map__swatch coverage-map__swatch--fill coverage-map__swatch--muted" />
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
