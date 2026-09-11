/**
 * CSV loading and parsing for Bengaluru pincode demand reference data.
 */
import Papa from 'papaparse';

/** A single 6-digit PIN zone from the reference dataset. */
export interface PinZone {
  pincode: string;
  zone_or_taluk: string;
  locality: string;
  centroid_lat: number;
  centroid_lng: number;
  population: number | null;
  households: number | null;
  median_hh_income: number | null;
  demand_index: number | null;
}

const CSV_PATH = '/blr_pincode_demand_reference.csv';

function parseOptionalNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Normalize user input to a 6-digit PIN string. */
export function toPincode(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(0, 6);
  return digits;
}

let cachedZones: PinZone[] | null = null;
let loadPromise: Promise<PinZone[]> | null = null;

function parseRow(row: Record<string, string>): PinZone {
  return {
    pincode: String(row.pincode ?? '').replace(/\D/g, '').padStart(6, '0'),
    zone_or_taluk: row.zone_or_taluk ?? '',
    locality: row.locality ?? '',
    centroid_lat: parseOptionalNumber(row.centroid_lat) ?? 0,
    centroid_lng: parseOptionalNumber(row.centroid_lng) ?? 0,
    population: parseOptionalNumber(row.population),
    households: parseOptionalNumber(row.households),
    median_hh_income: parseOptionalNumber(row.median_hh_income_inr),
    demand_index: parseOptionalNumber(row.demand_index),
  };
}

/** Fetch and parse the pincode reference CSV (cached after first load). */
export async function loadPinData(): Promise<PinZone[]> {
  if (cachedZones) return cachedZones;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const response = await fetch(CSV_PATH);
    if (!response.ok) {
      throw new Error(`Failed to load ${CSV_PATH}: ${response.status}`);
    }
    const text = await response.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    if (parsed.errors.length > 0) {
      console.warn('CSV parse warnings:', parsed.errors);
    }
    cachedZones = parsed.data.map(parseRow);
    return cachedZones;
  })();

  return loadPromise;
}

/** Build a pincode → zone lookup map. */
export function buildPinIndex(zones: PinZone[]): Map<string, PinZone> {
  return new Map(zones.map((z) => [z.pincode, z]));
}

/** Sum population across all zones (treat null as 0). */
export function totalPopulation(zones: PinZone[]): number {
  return zones.reduce((sum, z) => sum + (z.population ?? 0), 0);
}

/** Sum demand index across all zones (treat null as 0). */
export function totalDemandIndex(zones: PinZone[]): number {
  return zones.reduce((sum, z) => sum + (z.demand_index ?? 0), 0);
}
