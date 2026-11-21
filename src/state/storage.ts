import { isClubId } from '../data/clubs';
import { createSeedState } from '../data/seedData';
import type { AppState, Committee, Member, PointEvent } from '../types/tracker';

export const STORAGE_KEY = 'science_clubs_points_v1';

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function isCommittee(val: unknown): val is Committee {
  if (!val || typeof val !== 'object') return false;
  const item = val as Record<string, unknown>;
  return (
    isNonEmptyString(item.id) &&
    isClubId(item.clubId) &&
    isNonEmptyString(item.name) &&
    typeof item.description === 'string' &&
    typeof item.createdAt === 'string'
  );
}

function isMember(val: unknown): val is Member {
  if (!val || typeof val !== 'object') return false;
  const item = val as Record<string, unknown>;
  return (
    isNonEmptyString(item.id) &&
    isClubId(item.clubId) &&
    isNonEmptyString(item.committeeId) &&
    isNonEmptyString(item.name) &&
    typeof item.role === 'string' &&
    (item.phone === undefined || typeof item.phone === 'string') &&
    (item.email === undefined || typeof item.email === 'string') &&
    typeof item.points === 'number' &&
    Number.isFinite(item.points) &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string'
  );
}

function isPointEvent(val: unknown): val is PointEvent {
  if (!val || typeof val !== 'object') return false;
  const item = val as Record<string, unknown>;
  return (
    isNonEmptyString(item.id) &&
    isNonEmptyString(item.memberId) &&
    typeof item.memberName === 'string' &&
    isClubId(item.clubId) &&
    typeof item.committeeId === 'string' &&
    typeof item.committeeName === 'string' &&
    typeof item.delta === 'number' &&
    Number.isFinite(item.delta) &&
    typeof item.previousPoints === 'number' &&
    Number.isFinite(item.previousPoints) &&
    typeof item.newPoints === 'number' &&
    Number.isFinite(item.newPoints) &&
    typeof item.reason === 'string' &&
    typeof item.timestamp === 'string' &&
    (item.reverted === undefined || typeof item.reverted === 'boolean')
  );
}

export function validateAppState(
  input: unknown,
): { ok: true; state: AppState } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Backup must be a JSON object.' };
  }

  const raw = input as Record<string, unknown>;
  if (raw.version !== 1) {
    return { ok: false, error: 'Unsupported data version (expected version: 1).' };
  }
  if (!Array.isArray(raw.committees) || !raw.committees.every(isCommittee)) {
    return { ok: false, error: 'Invalid or corrupted committees list.' };
  }
  if (!Array.isArray(raw.members) || !raw.members.every(isMember)) {
    return { ok: false, error: 'Invalid or corrupted members list.' };
  }
  if (!Array.isArray(raw.history) || !raw.history.every(isPointEvent)) {
    return { ok: false, error: 'Invalid or corrupted point history list.' };
  }

  const committeeIds = new Set(raw.committees.map((c) => c.id));
  const cleanedMembers = raw.members.filter((m) => committeeIds.has(m.committeeId));

  return {
    ok: true,
    state: {
      version: 1,
      committees: raw.committees,
      members: cleanedMembers,
      history: raw.history,
    },
  };
}

export function parseImportedJson(
  raw: string,
): { ok: true; state: AppState } | { ok: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(raw);
    return validateAppState(parsed);
  } catch {
    return { ok: false, error: 'Could not parse JSON file. Make sure it is valid JSON.' };
  }
}

export function loadState(): AppState {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      return createSeedState();
    }
    const result = parseImportedJson(raw);
    return result.ok ? result.state : createSeedState();
  } catch {
    return createSeedState();
  }
}

export function saveState(state: AppState): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or privacy-mode restrictions gracefully
  }
}
