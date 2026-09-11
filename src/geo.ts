/**
 * Pure geographic / logistics heuristic functions for dark-store siting.
 * No external APIs; all distance and service estimates are computed client-side.
 */

/** Mean Earth radius in kilometres. */
export const EARTH_RADIUS_KM = 6371;

/** Bangalore urban road-circuity multiplier on great-circle distance. */
export const ROAD_FACTOR = 1.35;

/**
 * Road-km thresholds for 1–5 hour service bands (last-mile / dark-store catchments).
 * 1h / 2h / 3h in the UI map to the first three buckets.
 */
export const SERVICE_HOUR_THRESHOLDS_KM = [8, 16, 28, 45] as const;

/**
 * Great-circle distance between two lat/lng points in kilometres.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Approximate over-the-road kilometres from great-circle distance. */
export function roadKm(gcKm: number): number {
  return gcKm * ROAD_FACTOR;
}

/**
 * Estimated last-mile service hours from origin to destination (road km).
 */
export function serviceHours(roadKilometres: number): number {
  if (roadKilometres <= SERVICE_HOUR_THRESHOLDS_KM[0]) return 1;
  if (roadKilometres <= SERVICE_HOUR_THRESHOLDS_KM[1]) return 2;
  if (roadKilometres <= SERVICE_HOUR_THRESHOLDS_KM[2]) return 3;
  if (roadKilometres <= SERVICE_HOUR_THRESHOLDS_KM[3]) return 4;
  return 5;
}

/**
 * Coarse service band 2–6 from road km (legend / table analog of parcel zone).
 */
export function serviceBand(roadKilometres: number): number {
  if (roadKilometres <= 5) return 2;
  if (roadKilometres <= 8) return 3;
  if (roadKilometres <= 16) return 4;
  if (roadKilometres <= 28) return 5;
  return 6;
}

/** Compute road kilometres and derived service metrics between two centroids. */
export function distanceMetrics(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): { gcKm: number; roadKilometres: number; hours: number; band: number } {
  const gcKm = haversineKm(originLat, originLng, destLat, destLng);
  const roadKilometres = roadKm(gcKm);
  return {
    gcKm,
    roadKilometres,
    hours: serviceHours(roadKilometres),
    band: serviceBand(roadKilometres),
  };
}
