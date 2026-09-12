/**
 * Assign PIN coverage to BBMP wards and peri-urban taluks for choropleth fills.
 */
import { geoContains } from 'd3-geo';
import type { Feature, Geometry } from 'geojson';
import { haversineKm } from './geo';
import type { ServedZone } from './networkCoverage';
import {
  HOUR_COLORS,
  OUT_OF_RANGE_COLOR,
  rewindFeatureForD3,
  taluksCollection,
  wardsCollection,
  zoneLabelPoint,
  zoneSvgPath,
} from './map';

export interface RegionCoverage {
  id: string;
  kind: 'ward' | 'taluk';
  name: string;
  path: string | null;
  x: number;
  y: number;
  hours: number;
  within: boolean;
  isOrigin: boolean;
  pincode: string;
  locality: string;
  node: string;
  population: number | null;
  fill: string;
}

interface IndexedRegion {
  kind: 'ward' | 'taluk';
  feature: Feature<Geometry>;
}

const indexedWards: IndexedRegion[] = wardsCollection.features.map((f) => ({
  kind: 'ward',
  feature: rewindFeatureForD3(f as Feature<Geometry>),
}));

const indexedTaluks: IndexedRegion[] = taluksCollection.features.map((f) => ({
  kind: 'taluk',
  feature: rewindFeatureForD3(f as Feature<Geometry>),
}));

const pinRegionCache = new Map<string, IndexedRegion>();

function featureId(feature: Feature<Geometry>, kind: 'ward' | 'taluk'): string {
  if (kind === 'taluk') {
    return `taluk-${String(feature.properties?.name ?? feature.id ?? '')}`;
  }
  return `ward-${String(feature.id ?? feature.properties?.name ?? '')}`;
}

function featureName(feature: Feature<Geometry>): string {
  return typeof feature.properties?.name === 'string'
    ? feature.properties.name
    : String(feature.id ?? '');
}

function locateRegion(lat: number, lng: number): IndexedRegion | null {
  const point: [number, number] = [lng, lat];
  for (const ward of indexedWards) {
    if (geoContains(ward.feature, point)) return ward;
  }
  for (const taluk of indexedTaluks) {
    if (geoContains(taluk.feature, point)) return taluk;
  }

  let best: IndexedRegion | null = null;
  let bestD = Infinity;
  for (const region of [...indexedWards, ...indexedTaluks]) {
    const rlat = region.feature.properties?.lat;
    const rlng = region.feature.properties?.lng;
    if (typeof rlat !== 'number' || typeof rlng !== 'number') continue;
    const d = haversineKm(lat, lng, rlat, rlng);
    if (d < bestD) {
      bestD = d;
      best = region;
    }
  }
  return best;
}

function regionForPin(row: ServedZone): IndexedRegion | null {
  const cached = pinRegionCache.get(row.zone.pincode);
  if (cached) return cached;
  const found = locateRegion(row.zone.centroid_lat, row.zone.centroid_lng);
  if (found) pinRegionCache.set(row.zone.pincode, found);
  return found;
}

function shadeFill(hours: number, within: boolean): string {
  if (!within) return OUT_OF_RANGE_COLOR;
  if (hours <= 3) return HOUR_COLORS[hours] ?? OUT_OF_RANGE_COLOR;
  return OUT_OF_RANGE_COLOR;
}

function emptyRegion(
  region: IndexedRegion,
): RegionCoverage | null {
  const path = zoneSvgPath(region.feature);
  const centroid = zoneLabelPoint(region.feature);
  if (!path || !centroid) return null;
  const name = featureName(region.feature);
  return {
    id: featureId(region.feature, region.kind),
    kind: region.kind,
    name,
    path,
    x: centroid[0],
    y: centroid[1],
    hours: Infinity,
    within: false,
    isOrigin: false,
    pincode: '',
    locality: '',
    node: '',
    population:
      typeof region.feature.properties?.population === 'number'
        ? region.feature.properties.population
        : null,
    fill: OUT_OF_RANGE_COLOR,
  };
}

/** Choropleth records for wards and taluks from PIN-level network coverage. */
export function computeRegionCoverage(
  servedZones: ServedZone[],
  nodePins: Set<string>,
  hourThreshold: 1 | 2 | 3,
): { taluks: RegionCoverage[]; wards: RegionCoverage[] } {
  const bestByRegion = new Map<string, { region: IndexedRegion; row: ServedZone }>();

  for (const row of servedZones) {
    const region = regionForPin(row);
    if (!region) continue;
    const id = featureId(region.feature, region.kind);
    const prev = bestByRegion.get(id);
    if (!prev || row.min_service_hours < prev.row.min_service_hours) {
      bestByRegion.set(id, { region, row });
    } else if (
      row.min_service_hours === prev.row.min_service_hours &&
      nodePins.has(row.zone.pincode)
    ) {
      bestByRegion.set(id, { region, row });
    }
  }

  const toCoverage = (region: IndexedRegion): RegionCoverage | null => {
    const id = featureId(region.feature, region.kind);
    const hit = bestByRegion.get(id);
    if (!hit) return emptyRegion(region);
    const hours = hit.row.min_service_hours;
    const within = hours <= hourThreshold;
    const centroid = zoneLabelPoint(region.feature);
    const path = zoneSvgPath(region.feature);
    if (!path || !centroid) return null;
    return {
      id,
      kind: region.kind,
      name: featureName(region.feature),
      path,
      x: centroid[0],
      y: centroid[1],
      hours,
      within,
      isOrigin: nodePins.has(hit.row.zone.pincode),
      pincode: hit.row.zone.pincode,
      locality: hit.row.zone.locality,
      node: hit.row.nearest_node_pincode,
      population: hit.row.zone.population,
      fill: shadeFill(hours, within),
    };
  };

  return {
    taluks: indexedTaluks
      .map(toCoverage)
      .filter((r): r is RegionCoverage => r !== null),
    wards: indexedWards
      .map(toCoverage)
      .filter((r): r is RegionCoverage => r !== null),
  };
}
