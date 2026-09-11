/** Split user PIN input on commas, spaces, or both. */
export function parsePinInputSegments(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}
