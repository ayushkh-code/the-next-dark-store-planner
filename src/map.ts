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
import basemap from './blr-basemap.json';

/**
 * Service-hour fills: rust / vivid orange / peach so 1h, 2h, and 3h
 * stay in the amber family but do not collapse into one wash.
 */
export const HOUR_COLORS: Record<number, string> = {
  1: '#9A3412',
  2: '#EA580C',
  3: '#FDBA74',
};

export const OUT_OF_RANGE_COLOR = '#E7E5E4';
export const NODE_MARKER_COLOR = '#0F2438';

export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 720;

export interface BasemapProperties {
  kind?: 'ward' | 'taluk';
  name?: string;
  abbr?: string;
  zone?: string;
  lat?: number;
  lng?: number;
  population?: number;
  areaSqKm?: number;
  density?: number;
}

type BasemapFeature = Feature<Geometry, BasemapProperties>;

interface BasemapFile {
  wards: FeatureCollection<Geometry, BasemapProperties>;
  taluks: FeatureCollection<Geometry, BasemapProperties>;
  lakes: FeatureCollection<Geometry, BasemapProperties>;
}

const { wards, taluks, lakes } = basemap as BasemapFile;

export const wardsCollection = wards;
export const taluksCollection = taluks;
export const lakesCollection = lakes;
/** @deprecated Prefer wardsCollection; kept for older density hull callers. */
export const zonesCollection = wards;

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
 * (~4π steradians). Clockwise exteriors keep Bengaluru polygons local.
 */
function ensureClockwiseRing(ring: Position[], clockwise: boolean): Position[] {
  const closed =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const open = closed ? ring.slice(0, -1) : ring.slice();
  const isClockwise = ringArea(open.concat([open[0]])) < 0;
  const ordered = clockwise === isClockwise ? open : open.reverse();
  return [...ordered, ordered[0]];
}

function rewindPolygonRings(rings: Position[][]): Position[][] {
  return rings.map((ring, i) => ensureClockwiseRing(ring, i === 0));
}

/** Rewind polygons so d3-geo area, bounds, and path fills stay local. */
export function rewindFeatureForD3(
  feature: Feature<Geometry>,
): Feature<Geometry> {
  const g = feature.geometry;
  if (!g) return feature;
  if (g.type === 'Polygon') {
    return {
      ...feature,
      geometry: {
        type: 'Polygon',
        coordinates: rewindPolygonRings(g.coordinates),
      },
    };
  }
  if (g.type === 'MultiPolygon') {
    return {
      ...feature,
      geometry: {
        type: 'MultiPolygon',
        coordinates: g.coordinates.map((poly) => rewindPolygonRings(poly)),
      },
    };
  }
  return feature;
}

function collectPositions(geometry: Geometry | null): Position[] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates.flat();
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat(2);
  if (geometry.type === 'Point') return [geometry.coordinates];
  if (geometry.type === 'MultiPoint') return geometry.coordinates;
  return [];
}

const rewoundWards: FeatureCollection<Geometry, BasemapProperties> = {
  type: 'FeatureCollection',
  features: wards.features.map(
    (f) => rewindFeatureForD3(f) as BasemapFeature,
  ),
};

const rewoundTaluks: FeatureCollection<Geometry, BasemapProperties> = {
  type: 'FeatureCollection',
  features: taluks.features.map(
    (f) => rewindFeatureForD3(f) as BasemapFeature,
  ),
};

const rewoundLakes: FeatureCollection<Geometry, BasemapProperties> = {
  type: 'FeatureCollection',
  features: lakes.features.map(
    (f) => rewindFeatureForD3(f) as BasemapFeature,
  ),
};

/** Peri-urban PIN centroids so the frame keeps Hoskote / Anekal / airport in view. */
const METRO_FIT_POINTS: Position[] = [
  [77.3936, 13.0989],
  [77.7132, 13.2481],
  [77.7981, 13.0706],
  [77.6959, 12.7108],
  [77.7701, 12.7852],
  [77.7862, 12.86],
];

const fitPoints: MultiPoint = {
  type: 'MultiPoint',
  coordinates: [
    ...rewoundWards.features.flatMap((f) => collectPositions(f.geometry)),
    ...METRO_FIT_POINTS,
  ],
};

const projection = geoMercator().fitExtent(
  [
    [28, 18],
    [MAP_WIDTH - 28, MAP_HEIGHT - 18],
  ],
  fitPoints,
);

const pathGenerator = geoPath(projection);

function featurePaths(
  collection: FeatureCollection<Geometry, BasemapProperties>,
): { id: string; d: string | null }[] {
  return collection.features.map((f) => ({
    id: String(f.id ?? f.properties?.name ?? ''),
    d: pathGenerator(f) ?? null,
  }));
}

/** SVG path for a polygon feature in the shared Mercator projection. */
export function zoneSvgPath(feature: Feature<Geometry>): string | null {
  return pathGenerator(rewindFeatureForD3(feature)) ?? null;
}

/** Projected centroid for zone / ward labels. */
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

export const wardPaths = featurePaths(rewoundWards);
export const talukPaths = featurePaths(rewoundTaluks);
export const lakePaths = featurePaths(rewoundLakes);
/** Coverage / density choropleth units: BBMP wards. */
export const zonePaths = wardPaths;

const ZONE_LABEL_NUDGE: Record<string, [number, number]> = {
  East: [8, -4],
  West: [-10, 4],
  South: [0, 10],
  'RR Nagar': [-6, 8],
  Bommanahalli: [8, 6],
  Mahadevapura: [12, 0],
  Yelahanka: [0, -6],
  Dasarahalli: [-8, -4],
};

/** Projected label positions for metro zones / taluks. */
export function getZoneMapLabels(): ZoneMapLabel[] {
  const buckets = new Map<
    string,
    { abbr: string; lat: number; lng: number; n: number }
  >();

  const add = (name: string, abbr: string, lat: number, lng: number) => {
    const cur = buckets.get(name);
    if (!cur) {
      buckets.set(name, { abbr, lat, lng, n: 1 });
      return;
    }
    cur.lat += lat;
    cur.lng += lng;
    cur.n += 1;
  };

  for (const f of rewoundWards.features) {
    const name = f.properties?.zone;
    const lat = f.properties?.lat;
    const lng = f.properties?.lng;
    if (!name || lat == null || lng == null) continue;
    add(name, name, lat, lng);
  }
  for (const f of rewoundTaluks.features) {
    const name = f.properties?.name;
    const lat = f.properties?.lat;
    const lng = f.properties?.lng;
    if (!name || lat == null || lng == null) continue;
    add(name, f.properties?.abbr ?? name, lat, lng);
  }

  return [...buckets.entries()]
    .map(([name, b]) => {
      const centroid = projectPoint(b.lat / b.n, b.lng / b.n);
      if (!centroid) return null;
      const nudge = ZONE_LABEL_NUDGE[name] ?? [0, 0];
      return {
        name,
        abbr: b.abbr,
        x: centroid[0] + nudge[0],
        y: centroid[1] + nudge[1],
      };
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
  _isOrigin = false,
): string {
  if (!withinThreshold) return OUT_OF_RANGE_COLOR;
  if (serviceHours <= 3) return HOUR_COLORS[serviceHours] ?? OUT_OF_RANGE_COLOR;
  return OUT_OF_RANGE_COLOR;
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
