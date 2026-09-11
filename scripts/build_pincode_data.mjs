/**
 * Build public/blr_pincode_demand_reference.csv and public/blr-zones.geojson.
 *
 * Sources
 * - India Post / community locality list: scripts/raw/gist-map.csv (area, pincode, lat, lng)
 * - Curated metro extras + coordinate overrides for known-wrong gist points
 * - BBMP 2011 ward population: scripts/raw/bbmp_wards_population.geojson (198 wards)
 *
 * Method
 * - Unit of analysis is the 6-digit PIN (string). Never parsed as a number.
 * - Ward population is grown 2011 → ~2024 by 1.56 (8.44M → ~13.2M), then
 *   assigned to the nearest pincode centroid. Peri-urban PINs outside BBMP
 *   get a modeled residual so metro total sits near 13–14M.
 * - Households = population / 3.4 (urban Karnataka average HH size).
 * - median_hh_income_inr is a locality-type proxy, not a survey microdata field.
 * - demand_index is precomputed here (not in the UI): 0–100 blend of
 *   log population scale (65%) and income (35%).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(__dirname, 'raw');

const BBOX = { minLat: 12.68, maxLat: 13.28, minLng: 77.38, maxLng: 77.88 };
const GROWTH_2011_TO_2024 = 1.56;
const HH_SIZE = 3.4;
const METRO_TARGET_POP = 13_400_000;

/** Gist rows that dump the city-centre default instead of the locality. */
const COORD_OVERRIDES = {
  560007: { locality: 'HAL', lat: 12.9582, lng: 77.6491 },
  560015: { locality: 'Hospital Town', lat: 12.9961, lng: 77.5988 },
  560030: { locality: 'Adugodi', lat: 12.9424, lng: 77.6106 },
  560054: { locality: 'Mathikere', lat: 13.0338, lng: 77.5572 },
  560074: { locality: 'Kumbalgodu', lat: 12.8762, lng: 77.4481 },
  560076: { locality: 'Bannerghatta Road', lat: 12.8894, lng: 77.5976 },
  560083: { locality: 'Bannerghatta', lat: 12.8006, lng: 77.5772 },
  560006: { locality: 'J C Nagar', lat: 13.0054, lng: 77.5918 },
};

/** Metro PINs missing from the gist, including the sample-network Electronic City pin. */
const EXTRA_PINS = [
  { pincode: '560087', locality: 'Horamavu', lat: 13.0272, lng: 77.6601 },
  { pincode: '560091', locality: 'Herohalli', lat: 13.0168, lng: 77.4876 },
  { pincode: '560098', locality: 'Rajarajeshwari Nagar', lat: 12.9072, lng: 77.5204 },
  { pincode: '560099', locality: 'Bommasandra', lat: 12.8164, lng: 77.6848 },
  { pincode: '560100', locality: 'Electronic City', lat: 12.84007, lng: 77.66354 },
  { pincode: '560102', locality: 'HSR Layout', lat: 12.9121, lng: 77.6446 },
  { pincode: '560103', locality: 'Bellandur', lat: 12.9304, lng: 77.6784 },
  { pincode: '560105', locality: 'Begur', lat: 12.8726, lng: 77.6328 },
  { pincode: '562106', locality: 'Anekal', lat: 12.7108, lng: 77.6959 },
  { pincode: '562107', locality: 'Attibele', lat: 12.7852, lng: 77.7701 },
  { pincode: '562110', locality: 'Devanahalli', lat: 13.2481, lng: 77.7132 },
  { pincode: '562114', locality: 'Hoskote', lat: 13.0706, lng: 77.7981 },
  { pincode: '562123', locality: 'Nelamangala', lat: 13.0989, lng: 77.3936 },
  { pincode: '562125', locality: 'Sarjapur', lat: 12.86, lng: 77.7862 },
  { pincode: '562149', locality: 'Jigani', lat: 12.7854, lng: 77.6381 },
  { pincode: '562157', locality: 'Dommasandra', lat: 12.8824, lng: 77.7571 },
  { pincode: '562162', locality: 'Chandapura', lat: 12.8012, lng: 77.7118 },
];

const IT_CORRIDOR = new Set([
  '560066', '560067', '560037', '560103', '560048', '560036', '560100',
  '560102', '560035', '560068', '560034', '560095', '560038', '560071',
  '560017', '560093', '560016', '560049', '560087', '560105', '560099',
  '562125', '562157', '562107', '562162',
]);
const ESTABLISHED_RESIDENTIAL = new Set([
  '560011', '560041', '560069', '560003', '560055', '560010', '560004',
  '560019', '560028', '560070', '560085', '560050', '560078', '560011',
  '560025', '560008', '560001', '560052', '560080', '560094', '560032',
  '560024', '560092', '560064', '560097', '560086', '560079', '560040',
]);
const INDUSTRIAL = new Set([
  '560058', '560057', '560013', '560022', '560031', '560073', '560090',
  '560074', '560099', '560105', '562149',
]);

function padPin(raw) {
  return String(raw).replace(/\D/g, '').padStart(6, '0').slice(0, 6);
}

function inBbox(lat, lng) {
  return (
    lat >= BBOX.minLat &&
    lat <= BBOX.maxLat &&
    lng >= BBOX.minLng &&
    lng <= BBOX.maxLng
  );
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

function incomeFor(pin, zone) {
  if (IT_CORRIDOR.has(pin)) return 1450000;
  if (ESTABLISHED_RESIDENTIAL.has(pin)) return 1100000;
  if (INDUSTRIAL.has(pin)) return 720000;
  if (['Anekal', 'Hoskote', 'Devanahalli', 'Nelamangala'].includes(zone)) {
    return 620000;
  }
  if (['Mahadevapura', 'Bommanahalli', 'Yelahanka'].includes(zone)) {
    return 980000;
  }
  return 820000;
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
  return n ? [x / n, y / n] : null;
}

function convexHull(points) {
  const pts = [...points]
    .map(([lng, lat]) => [lng, lat])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 1) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function ringFor(points) {
  if (points.length === 0) return null;
  if (points.length < 3) {
    const [lng, lat] = points[0];
    const d = 0.035;
    return [
      [lng - d, lat - d],
      [lng + d, lat - d],
      [lng + d, lat + d],
      [lng - d, lat + d],
      [lng - d, lat - d],
    ];
  }
  const hull = convexHull(points);
  if (hull.length < 3) {
    const [lng, lat] = points[0];
    const d = 0.035;
    return [
      [lng - d, lat - d],
      [lng + d, lat - d],
      [lng + d, lat + d],
      [lng - d, lat + d],
      [lng - d, lat - d],
    ];
  }
  return [...hull, hull[0]];
}

function parseGist() {
  const text = fs.readFileSync(path.join(RAW, 'gist-map.csv'), 'utf8');
  const byPin = new Map();
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const parts = line.split(',');
    if (parts.length < 4) continue;
    const locality = parts[0].trim();
    const pincode = padPin(parts[1]);
    const lat = Number(parts[2]);
    const lng = Number(parts[3]);
    if (!pincode || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!inBbox(lat, lng)) continue;
    const prev = byPin.get(pincode);
    if (!prev || (lat === 12.9716 && lng === 77.5946)) {
      if (prev && lat === 12.9716 && lng === 77.5946) continue;
      byPin.set(pincode, { pincode, locality, lat, lng });
    }
  }
  return byPin;
}

function loadWards() {
  const geo = JSON.parse(
    fs.readFileSync(path.join(RAW, 'bbmp_wards_population.geojson'), 'utf8'),
  );
  return geo.features.map((f) => {
    const [lng, lat] = centroidOf(f.geometry.coordinates);
    return {
      lat,
      lng,
      pop: Number(f.properties.pop_total) || 0,
      area: Number(f.properties.area_sq_km) || 0,
    };
  });
}

function build() {
  const byPin = parseGist();
  for (const [pin, ov] of Object.entries(COORD_OVERRIDES)) {
    byPin.set(pin, { pincode: pin, locality: ov.locality, lat: ov.lat, lng: ov.lng });
  }
  for (const extra of EXTRA_PINS) {
    byPin.set(extra.pincode, extra);
  }

  const pins = [...byPin.values()].filter((p) => inBbox(p.lat, p.lng));
  pins.sort((a, b) => a.pincode.localeCompare(b.pincode));

  const wards = loadWards();
  const assigned = new Map(pins.map((p) => [p.pincode, 0]));
  let bbmpAssigned = 0;
  for (const ward of wards) {
    if (ward.lat == null || ward.lng == null) continue;
    let best = null;
    let bestD = Infinity;
    for (const pin of pins) {
      const d = haversineKm(ward.lat, ward.lng, pin.lat, pin.lng);
      if (d < bestD) {
        bestD = d;
        best = pin;
      }
    }
    if (!best) continue;
    const grown = ward.pop * GROWTH_2011_TO_2024;
    assigned.set(best.pincode, (assigned.get(best.pincode) ?? 0) + grown);
    bbmpAssigned += grown;
  }

  for (const p of pins) {
    const zone = assignZone(p.lat, p.lng);
    const floor = IT_CORRIDOR.has(p.pincode)
      ? 90_000
      : ['Anekal', 'Hoskote', 'Devanahalli', 'Nelamangala'].includes(zone)
        ? 45_000
        : 22_000;
    const current = assigned.get(p.pincode) ?? 0;
    if (current < floor) assigned.set(p.pincode, floor);
  }

  const afterFloors = [...assigned.values()].reduce((s, n) => s + n, 0);
  const scale = METRO_TARGET_POP / Math.max(afterFloors, 1);
  for (const [pin, pop] of assigned) {
    assigned.set(pin, pop * scale);
  }

  const maxPop = Math.max(...pins.map((p) => assigned.get(p.pincode) ?? 0), 1);
  const rows = pins.map((p) => {
    const zone = assignZone(p.lat, p.lng);
    const population = Math.round(assigned.get(p.pincode) ?? 0);
    const households = Math.round(population / HH_SIZE);
    const income = incomeFor(p.pincode, zone);
    return { ...p, zone, population, households, income };
  });
  const maxIncome = Math.max(...rows.map((r) => r.income));
  for (const row of rows) {
    const popScore = Math.log1p(row.population) / Math.log1p(maxPop);
    const incScore = row.income / maxIncome;
    row.demand = Math.round((100 * (0.65 * popScore + 0.35 * incScore) + Number.EPSILON) * 10) / 10;
  }

  const csvHeader =
    'pincode,locality,zone_or_taluk,centroid_lat,centroid_lng,population,households,median_hh_income_inr,demand_index';
  const csvLines = [
    csvHeader,
    ...rows.map(
      (r) =>
        `${r.pincode},${escapeCsv(r.locality)},${escapeCsv(r.zone)},${r.lat.toFixed(5)},${r.lng.toFixed(5)},${r.population},${r.households},${r.income},${r.demand.toFixed(1)}`,
    ),
  ];

  const publicDir = path.join(ROOT, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  const csvPath = path.join(publicDir, 'blr_pincode_demand_reference.csv');
  fs.writeFileSync(csvPath, `${csvLines.join('\n')}\n`);

  const byZone = new Map();
  for (const r of rows) {
    const list = byZone.get(r.zone) ?? [];
    list.push([r.lng, r.lat]);
    byZone.set(r.zone, list);
  }
  const zoneGeo = {
    type: 'FeatureCollection',
    features: [...byZone.entries()].map(([name, pts]) => {
      const ring = ringFor(pts);
      const [lng, lat] = centroidOf([ring]);
      return {
        type: 'Feature',
        properties: { name, abbr: zoneAbbr(name), lat, lng },
        geometry: { type: 'Polygon', coordinates: [ring] },
      };
    }),
  };
  const zoneJson = JSON.stringify(zoneGeo);
  fs.writeFileSync(path.join(publicDir, 'blr-zones.geojson'), zoneJson);
  fs.writeFileSync(path.join(ROOT, 'src', 'blr-zones.json'), zoneJson);

  const totalPop = rows.reduce((s, r) => s + r.population, 0);
  const required = ['560034', '560066', '560100'];
  const missing = required.filter((p) => !rows.some((r) => r.pincode === p));

  console.log(`rows=${rows.length}`);
  console.log(`totalPopulation=${totalPop}`);
  console.log(`bbmpGrown=${Math.round(bbmpAssigned)}`);
  console.log(`zones=${[...byZone.keys()].sort().join(', ')}`);
  console.log(`csv=${csvPath}`);
  console.log(
    `metroVs13_14M=${totalPop} (${(((totalPop - 13_500_000) / 13_500_000) * 100).toFixed(1)}% vs 13.5M midpoint)`,
  );
  if (missing.length) {
    console.error('MISSING SAMPLE PINS', missing.join(', '));
    process.exit(1);
  } else {
    for (const p of required) {
      const row = rows.find((r) => r.pincode === p);
      console.log(`sample ${p} ${row.locality} ${row.zone} pop=${row.population}`);
    }
  }
}

function zoneAbbr(name) {
  const map = {
    East: 'E',
    West: 'W',
    South: 'S',
    Mahadevapura: 'MDP',
    Bommanahalli: 'BMH',
    'RR Nagar': 'RRN',
    Dasarahalli: 'DSH',
    Yelahanka: 'YLK',
    Anekal: 'ANK',
    Hoskote: 'HSK',
    Devanahalli: 'DVH',
    Nelamangala: 'NLG',
  };
  return map[name] ?? name.slice(0, 3).toUpperCase();
}

function escapeCsv(value) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

build();
