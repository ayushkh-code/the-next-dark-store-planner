/**
 * Build src/blr-basemap.json: simplified BBMP wards, peri-urban taluks, lakes.
 *
 * Sources
 * - scripts/raw/bbmp_wards_population.geojson (198 BBMP 2011 wards)
 * - scripts/raw/osm-taluks.json (OSM admin polygons, ODbL)
 * - scripts/raw/osm-lakes.json (named Bengaluru lakes, ODbL)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea } from 'd3-geo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(__dirname, 'raw');

const TALUK_BY_OSM_ID = {
  10594819: { name: 'Anekal', abbr: 'ANK' },
  4458926: { name: 'Hoskote', abbr: 'HSK' },
  16742307: { name: 'Devanahalli', abbr: 'DVH' },
  4458929: { name: 'Nelamangala', abbr: 'NLG' },
};

const WARD_SIMPLIFY = 0.00022;
const TALUK_SIMPLIFY = 0.00065;
const LAKE_SIMPLIFY = 0.00012;

function assignZone(lat, lng) {
  if (lat >= 13.18) return 'Devanahalli';
  if (lng >= 77.78 && lat >= 12.95) return 'Hoskote';
  if (lng <= 77.42) return 'Nelamangala';
  if (lat <= 12.82 && lng >= 77.58) return 'Anekal';
  if (lat >= 13.05 && lng >= 77.52 && lng <= 77.7) return 'Yelahanka';
  if (lat >= 13.02 && lng <= 77.54) return 'Dasarahalli';
  if (lng >= 77.68) return 'Mahadevapura';
  if (lat <= 12.91 && lng >= 77.58) return 'Bommanahalli';
  if (lat <= 12.96 && lng <= 77.53) return 'RR Nagar';
  if (lng >= 77.61 && lat >= 12.95) return 'East';
  if (lng <= 77.56) return 'West';
  return 'South';
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return area / 2;
}

function openRing(ring) {
  const closed =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  return closed ? ring.slice(0, -1) : ring.slice();
}

function closeRing(open) {
  return [...open, open[0]];
}

function ensureRingWinding(ring, clockwise) {
  const open = openRing(ring);
  const area = ringArea(closeRing(open));
  const isClockwise = area < 0;
  if (clockwise !== isClockwise) open.reverse();
  return closeRing(open);
}

function sqSegDist(p, a, b) {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplifyRing(ring, epsilon) {
  const pts = openRing(ring);
  if (pts.length <= 4) return closeRing(pts);
  const sqEps = epsilon * epsilon;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = start + 1; i < end; i++) {
      const d = sqSegDist(pts[i], pts[start], pts[end]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > sqEps && idx >= 0) {
      keep[idx] = 1;
      stack.push([start, idx], [idx, end]);
    }
  }
  const out = pts.filter((_, i) => keep[i]);
  return out.length >= 3 ? closeRing(out) : closeRing(pts);
}

function roundCoord(n) {
  return Math.round(n * 1e5) / 1e5;
}

function roundRing(ring) {
  return ring.map(([lng, lat]) => [roundCoord(lng), roundCoord(lat)]);
}

function rewindPolygon(rings, epsilon) {
  return rings.map((ring, i) =>
    ensureRingWinding(roundRing(simplifyRing(ring, epsilon)), i === 0),
  );
}

function normalizeGeometry(geometry, epsilon) {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: rewindPolygon(geometry.coordinates, epsilon),
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((poly) =>
        rewindPolygon(poly, epsilon),
      ),
    };
  }
  return null;
}

function centroidOf(coords) {
  let x = 0;
  let y = 0;
  let n = 0;
  const walk = (c) => {
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      x += c[0];
      y += c[1];
      n += 1;
      return;
    }
    for (const child of c) walk(child);
  };
  walk(coords);
  return n ? [x / n, y / n] : [0, 0];
}

function readJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

function buildWards() {
  const geo = readJson(path.join(RAW, 'bbmp_wards_population.geojson'));
  return geo.features.map((f, i) => {
    const geometry = normalizeGeometry(f.geometry, WARD_SIMPLIFY);
    const [lng, lat] = centroidOf(geometry.coordinates);
    const population = Number(f.properties.pop_total) || 0;
    const feature = { type: 'Feature', properties: {}, geometry };
    const areaFromGeom =
      geoArea(feature) * 6378137 * 6378137 * (1 / 1_000_000);
    const areaFromProp = Number(f.properties.area_sq_km) || 0;
    const areaSqKm =
      areaFromProp > 0.05 && areaFromProp < 50 ? areaFromProp : areaFromGeom;
    const densityFromProp = Number(f.properties.pop_density) || 0;
    const density =
      densityFromProp > 10 && densityFromProp < 200_000
        ? densityFromProp
        : areaSqKm > 0
          ? population / areaSqKm
          : 0;
    const name = String(f.properties.ward_name ?? `Ward ${i + 1}`);
    const wardNo = Number(f.properties.ward_no) || i + 1;
    return {
      type: 'Feature',
      id: wardNo,
      properties: {
        kind: 'ward',
        name,
        abbr: String(wardNo),
        zone: assignZone(lat, lng),
        lat: roundCoord(lat),
        lng: roundCoord(lng),
        population,
        areaSqKm,
        density,
      },
      geometry,
    };
  });
}

function buildTaluks() {
  const rows = readJson(path.join(RAW, 'osm-taluks.json'));
  return rows
    .map((row) => {
      const meta = TALUK_BY_OSM_ID[row.osm_id];
      const geometry = normalizeGeometry(row.geojson, TALUK_SIMPLIFY);
      if (!meta || !geometry) return null;
      const [lng, lat] = centroidOf(geometry.coordinates);
      return {
        type: 'Feature',
        id: meta.name,
        properties: {
          kind: 'taluk',
          name: meta.name,
          abbr: meta.abbr,
          zone: meta.name,
          lat: roundCoord(lat),
          lng: roundCoord(lng),
        },
        geometry,
      };
    })
    .filter(Boolean);
}

function buildLakes() {
  const rows = readJson(path.join(RAW, 'osm-lakes.json'));
  return rows
    .map((row) => {
      const geometry = normalizeGeometry(row.geojson, LAKE_SIMPLIFY);
      if (!geometry) return null;
      return {
        type: 'Feature',
        id: row.name,
        properties: { name: row.name },
        geometry,
      };
    })
    .filter(Boolean);
}

function collection(features) {
  return { type: 'FeatureCollection', features };
}

function build() {
  const wards = buildWards();
  const taluks = buildTaluks();
  const lakes = buildLakes();
  const out = {
    wards: collection(wards),
    taluks: collection(taluks),
    lakes: collection(lakes),
  };
  const dest = path.join(ROOT, 'src', 'blr-basemap.json');
  fs.writeFileSync(dest, JSON.stringify(out));
  console.log(
    `wards=${wards.length} taluks=${taluks.length} lakes=${lakes.length} bytes=${fs.statSync(dest).size} dest=${dest}`,
  );
}

build();
