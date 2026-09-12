/**
 * Bengaluru map projection and styling helpers for coverage visualization.
 */
import { geoMercator, geoPath } from 'd3-geo';
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPoint,
  Position,
} from 'geojson';
import zonesGeo from './blr-zones.json';

/** Amber sequential ramp: 1-hour (closest) = most saturated. */
export const HOUR_COLORS: Record<number, string> = {
  1: '#F59E0B',
  2: '#FBBF24',
  3: '#FDE68A',
};

const OUT_OF_RANGE_COLOR = '#E3E0DB';
const ORIGIN_COLOR = '#F59E0B';

export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 720;

export const zonesCollection = zonesGeo as FeatureCollection<Geometry>;

export interface ZoneMapLabel {
  name: string;
  abbr: string;
  x: number;
  y: number;
}

/** Signed planar area; positive means counter-clockwise. */
function ringArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[i];
    area += x0 * y1 - x1 * y0;
  }
  return area / 2;
}

/**
 * d3-geo treats a counter-clockwise ring as the complement of the globe
 * (~4π steradians). Clockwise exteriors keep Bengaluru hulls as small polygons.
 */
function ensureClockwiseRing(ring: Position[]): Position[] {
  const closed =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const open = closed ? ring.slice(0, -1) : ring.slice();
  const ordered = ringArea(open.concat([open[0]])) > 0 ? open.reverse() : open;
  return [...ordered, ordered[0]];
}

/** Rewind polygons so d3-geo area, bounds, and path fills stay local. */
export function rewindFeatureForD3(
  feature: Feature<Geometry>,
): Feature<Geometry> {
  const g = feature.geometry;
  if (!g || g.type !== 'Polygon') return feature;
  return {
    ...feature,
    geometry: {
      type: 'Polygon',
      coordinates: g.coordinates.map((ring) => ensureClockwiseRing(ring)),
    },
  };
}

const rewoundZones: FeatureCollection<Geometry> = {
  type: 'FeatureCollection',
  features: zonesCollection.features.map((f) =>
    rewindFeatureForD3(f as Feature<Geometry>),
  ),
};

const fitPoints: MultiPoint = {
  type: 'MultiPoint',
  coordinates: rewoundZones.features.flatMap((f) => {
    const g = f.geometry;
    if (g?.type === 'Polygon') return g.coordinates[0] ?? [];
    return [];
  }),
};

const projection = geoMercator().fitExtent(
  [
    [36, 24],
    [MAP_WIDTH - 36, MAP_HEIGHT - 24],
  ],
  fitPoints,
);

const pathGenerator = geoPath(projection);

/** SVG path for a zone feature in the shared Mercator projection. */
export function zoneSvgPath(feature: Feature<Geometry>): string | null {
  return pathGenerator(rewindFeatureForD3(feature)) ?? null;
}

/** Projected centroid for zone labels. */
export function zoneLabelPoint(
  feature: Feature<Geometry>,
): [number, number] | null {
  const lat =
    typeof feature.properties?.lat === 'number'
      ? feature.properties.lat
      : null;
  const lng =
    typeof feature.properties?.lng === 'number'
      ? feature.properties.lng
      : null;
  if (lat != null && lng != null) {
    return projectPoint(lat, lng);
  }
  const c = pathGenerator.centroid(rewindFeatureForD3(feature));
  if (!c || Number.isNaN(c[0]) || Number.isNaN(c[1])) return null;
  return c;
}

/** SVG path data for Bengaluru zone outlines. */
export const zonePaths: { id: string; d: string | null }[] =
  rewoundZones.features.map((f) => ({
    id: String(f.properties?.name ?? f.id ?? ''),
    d: pathGenerator(f) ?? null,
  }));

/** Projected label positions for metro zones / taluks. */
export function getZoneMapLabels(): ZoneMapLabel[] {
  return rewoundZones.features
    .map((f) => {
      const name =
        typeof f.properties?.name === 'string' ? f.properties.name : '';
      const abbr =
        typeof f.properties?.abbr === 'string' ? f.properties.abbr : name;
      const centroid = zoneLabelPoint(f as Feature<Geometry>);
      if (!name || !centroid) return null;
      return { name, abbr, x: centroid[0], y: centroid[1] };
    })
    .filter((l): l is ZoneMapLabel => l !== null);
}

/** Project lat/lng to SVG [x, y], or null if unprojectable. */
export function projectPoint(
  lat: number,
  lng: number,
): [number, number] | null {
  const p = projection([lng, lat]);
  if (!p || Number.isNaN(p[0]) || Number.isNaN(p[1])) return null;
  return p;
}

/** Dot radius scaled by population (visual weight, not geographic). */
export function dotRadius(population: number | null, isOrigin: boolean): number {
  if (isOrigin) return 7;
  if (!population) return 2.5;
  return Math.min(9, Math.max(2.5, 1.8 + Math.sqrt(population / 12_000)));
}

export function zoneFillColor(
  serviceHours: number,
  withinThreshold: boolean,
  isOrigin: boolean,
): string {
  if (isOrigin) return ORIGIN_COLOR;
  if (!withinThreshold) return OUT_OF_RANGE_COLOR;
  if (serviceHours <= 3) return HOUR_COLORS[serviceHours] ?? OUT_OF_RANGE_COLOR;
  return '#94a3b8';
}

export function zoneOpacity(
  serviceHours: number,
  hourThreshold: number,
  isOrigin: boolean,
): number {
  if (isOrigin) return 1;
  if (serviceHours <= hourThreshold) return 0.85;
  return 0.18;
}
