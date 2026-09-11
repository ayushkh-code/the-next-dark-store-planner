/**
 * Bengaluru map projection and styling helpers for coverage visualization.
 */
import { geoMercator, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
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

const projection = geoMercator().fitSize(
  [MAP_WIDTH, MAP_HEIGHT],
  zonesCollection,
);

const pathGenerator = geoPath(projection);

/** SVG path for a zone feature in the shared Mercator projection. */
export function zoneSvgPath(feature: Feature<Geometry>): string | null {
  return pathGenerator(feature) ?? null;
}

/** Projected centroid for zone labels. */
export function zoneLabelPoint(
  feature: Feature<Geometry>,
): [number, number] | null {
  const c = pathGenerator.centroid(feature);
  if (!c || Number.isNaN(c[0]) || Number.isNaN(c[1])) return null;
  return c;
}

/** SVG path data for Bengaluru zone outlines. */
export const zonePaths: { id: string; d: string | null }[] =
  zonesCollection.features.map((f) => ({
    id: String(f.properties?.name ?? f.id ?? ''),
    d: pathGenerator(f) ?? null,
  }));

/** Projected label positions for metro zones / taluks. */
export function getZoneMapLabels(): ZoneMapLabel[] {
  return zonesCollection.features
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
