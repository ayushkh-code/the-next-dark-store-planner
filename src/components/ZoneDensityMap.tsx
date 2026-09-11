import { useCallback, useMemo, useState } from 'react';
import type { PinZone } from '../data';
import { formatNumber } from '../format';
import { TAB_PURPOSE } from '../tabPurpose';
import { TabPurpose } from './TabPurpose';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  computeZoneDensities,
  densityFillColor,
  densityLabelColor,
  densityTierRanges,
  DENSITY_TIER_COLORS,
  DENSITY_TIER_LABELS,
  type ZoneDensity,
} from '../zoneDensity';

interface ZoneDensityMapProps {
  zones: PinZone[];
}

interface MapViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL_VIEW: MapViewBox = {
  x: 0,
  y: 0,
  w: MAP_WIDTH,
  h: MAP_HEIGHT,
};

const ZOOM_FACTOR = 0.55;
const MIN_VIEW_RATIO = 0.18;

function isFullView(viewBox: MapViewBox): boolean {
  return (
    viewBox.x === FULL_VIEW.x &&
    viewBox.y === FULL_VIEW.y &&
    viewBox.w === FULL_VIEW.w &&
    viewBox.h === FULL_VIEW.h
  );
}

function zoomViewBoxAt(
  viewBox: MapViewBox,
  relX: number,
  relY: number,
): MapViewBox | null {
  const svgX = viewBox.x + relX * viewBox.w;
  const svgY = viewBox.y + relY * viewBox.h;
  const newW = viewBox.w * ZOOM_FACTOR;
  const newH = viewBox.h * ZOOM_FACTOR;

  if (newW < MAP_WIDTH * MIN_VIEW_RATIO) {
    return null;
  }

  const newX = Math.max(0, Math.min(MAP_WIDTH - newW, svgX - newW * relX));
  const newY = Math.max(0, Math.min(MAP_HEIGHT - newH, svgY - newH * relY));

  return { x: newX, y: newY, w: newW, h: newH };
}

export function ZoneDensityMap({ zones }: ZoneDensityMapProps) {
  const [hovered, setHovered] = useState<ZoneDensity | null>(null);
  const [viewBox, setViewBox] = useState<MapViewBox>(FULL_VIEW);

  const densityZones = useMemo(() => computeZoneDensities(zones), [zones]);
  const tierRanges = useMemo(() => densityTierRanges(densityZones), [densityZones]);
  const zoomed = !isFullView(viewBox);

  const hoveredCentroid = useMemo(() => {
    if (!hovered?.labelX || hovered.labelY === null) return null;
    return { x: hovered.labelX, y: hovered.labelY };
  }, [hovered]);

  const handleMapClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      const next = zoomViewBoxAt(viewBox, relX, relY);
      if (next) {
        setViewBox(next);
      }
    },
    [viewBox],
  );

  const resetView = useCallback(() => {
    setViewBox(FULL_VIEW);
  }, []);

  return (
    <section className="mode-panel density-panel">
      <TabPurpose>{TAB_PURPOSE.density}</TabPurpose>

      <div className="coverage-map density-map">
        <div className="coverage-map__header density-map__header">
          <h3>Population density by zone</h3>
        </div>

        <div className="coverage-map__frame density-map__frame">
          {zoomed && (
            <button
              type="button"
              className="density-map__reset"
              onClick={resetView}
            >
              Reset view
            </button>
          )}

          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className="coverage-map__svg density-map__svg"
            role="img"
            aria-label="Bengaluru zone map colored by population density"
            onClick={handleMapClick}
          >
            <rect
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              fill="#f8fafc"
              rx={4}
            />

            <g className="density-map__states">
              {densityZones.map((st) =>
                st.path ? (
                  <path
                    key={st.name}
                    d={st.path}
                    fill={densityFillColor(st.tier)}
                    stroke="#fff"
                    strokeWidth={0.75}
                    className="density-map__state"
                    onMouseEnter={() => setHovered(st)}
                    onMouseLeave={() => setHovered(null)}
                  />
                ) : null,
              )}
            </g>

            <g className="density-map__labels" aria-hidden="true">
              {densityZones.map((st) =>
                st.abbr && st.labelX !== null && st.labelY !== null ? (
                  <text
                    key={`label-${st.name}`}
                    x={st.labelX}
                    y={st.labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="density-map__label"
                    fill={densityLabelColor(st.tier)}
                    fontSize={st.abbr.length > 3 ? 8 : 10}
                  >
                    {st.abbr}
                  </text>
                ) : null,
              )}
            </g>
          </svg>

          {hovered && hoveredCentroid && (
            <div
              className="coverage-map__tooltip"
              style={{
                left: `${((hoveredCentroid.x - viewBox.x) / viewBox.w) * 100}%`,
                top: `${((hoveredCentroid.y - viewBox.y) / viewBox.h) * 100}%`,
              }}
            >
              <strong>{hovered.name}</strong>
              <span className="mono">
                {formatNumber(Math.round(hovered.density))} / km²
              </span>
              <span className="mono">
                Pop. {formatNumber(hovered.population)}
              </span>
              <span>
                {hovered.tier !== null
                  ? `${DENSITY_TIER_LABELS[hovered.tier]} density`
                  : 'No data'}
              </span>
            </div>
          )}

          <ul className="coverage-map__legend density-map__legend" aria-label="Density legend">
            {tierRanges.map(({ tier, label, min, max }) => (
              <li key={tier}>
                <span
                  className="coverage-map__swatch density-map__swatch"
                  style={{ background: DENSITY_TIER_COLORS[tier] }}
                />
                {label}
                <span className="mono density-map__range">
                  {Math.round(min)}–{Math.round(max)}/km²
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
