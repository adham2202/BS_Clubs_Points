import { CLUBS } from '../data/clubs';
import type { ClubId } from '../types/tracker';

export interface ClubScoringPresets {
  points: number[];
  reasons: string[];
}

export type AllClubPresets = Record<ClubId, ClubScoringPresets>;

export const PRESETS_STORAGE_KEY = 'science_clubs_presets_v1';

export const DEFAULT_POINT_PRESETS: readonly number[] = [2, 5, 10, 20, -5];
export const DEFAULT_REASON_PRESETS: readonly string[] = [
  'Attendance',
  'Workshop',
  'Event Support',
  'Competition',
  'Leadership',
];

export function cloneDefaultClubPresets(): ClubScoringPresets {
  return {
    points: [...DEFAULT_POINT_PRESETS],
    reasons: [...DEFAULT_REASON_PRESETS],
  };
}

export function cloneDefaultPresets(): AllClubPresets {
  return {
    chemistry: cloneDefaultClubPresets(),
    physics: cloneDefaultClubPresets(),
    mathematics: cloneDefaultClubPresets(),
    biology: cloneDefaultClubPresets(),
  };
}

function sanitizePointsList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_POINT_PRESETS];
  const result: number[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    if (typeof item !== 'number' || !Number.isFinite(item)) continue;
    const val = Math.trunc(item);
    if (val === 0 || seen.has(val)) continue;
    seen.add(val);
    result.push(val);
  }
  return result;
}

function sanitizeReasonsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_REASON_PRESETS];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const cleaned = item.trim().replace(/\s+/g, ' ');
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

export function loadPresets(): AllClubPresets {
  try {
    const raw = globalThis.localStorage?.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return cloneDefaultPresets();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return cloneDefaultPresets();

    const next = cloneDefaultPresets();
    for (const club of CLUBS) {
      const item = parsed[club.id];
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      next[club.id] = {
        points: sanitizePointsList(obj.points),
        reasons: sanitizeReasonsList(obj.reasons),
      };
    }
    return next;
  } catch {
    return cloneDefaultPresets();
  }
}

export function savePresets(presets: AllClubPresets): void {
  try {
    globalThis.localStorage?.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore storage quota or privacy restrictions
  }
}

export function resetPresets(): AllClubPresets {
  const defaults = cloneDefaultPresets();
  savePresets(defaults);
  return defaults;
}

export function addPointPreset(list: number[], raw: number): number[] {
  if (!Number.isFinite(raw)) return list;
  const val = Math.trunc(raw);
  if (val === 0 || list.includes(val)) return list;
  return [...list, val];
}

export function removePointPreset(list: number[], value: number): number[] {
  return list.filter((item) => item !== value);
}

export function addReasonPreset(list: string[], raw: string): string[] {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return list;
  const key = cleaned.toLowerCase();
  if (list.some((item) => item.trim().toLowerCase() === key)) return list;
  return [...list, cleaned];
}

export function removeReasonPreset(list: string[], target: string): string[] {
  const key = target.trim().toLowerCase();
  return list.filter((item) => item.trim().toLowerCase() !== key);
}
