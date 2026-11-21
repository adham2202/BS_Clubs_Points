import { CLUBS, isClubId } from '../data/clubs';
import type { AppState, ClubFilter, ClubId } from '../types/tracker';

export interface AuthSession {
  scope: ClubFilter;
  officerName: string;
  signedInAt: string;
  remember: boolean;
}

export type ClubPasscodes = Record<ClubFilter, string>;
export type ClubManagers = Record<ClubId, string[]>;

export const SESSION_STORAGE_KEY = 'science_clubs_session_v1';
export const PASSCODES_STORAGE_KEY = 'science_clubs_passcodes_v1';
export const MANAGERS_STORAGE_KEY = 'science_clubs_managers_v1';

export const DEFAULT_PASSCODES: ClubPasscodes = {
  chemistry: 'CHEM-2026',
  physics: 'PHYS-2026',
  mathematics: 'MATH-2026',
  biology: 'BIO-2026',
  all: 'ADMIN-2026',
};

export const DEFAULT_MANAGERS: ClubManagers = {
  chemistry: [],
  physics: [],
  mathematics: [],
  biology: [],
};

export function cloneDefaultManagers(): ClubManagers {
  return {
    chemistry: [],
    physics: [],
    mathematics: [],
    biology: [],
  };
}

export function cleanManagerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function normalizeManagerName(name: string): string {
  return cleanManagerName(name).toLowerCase();
}

export function addManagersToList(existing: string[], rawInput: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of existing) {
    const cleaned = cleanManagerName(item);
    const key = cleaned.toLowerCase();
    if (cleaned && !seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }

  for (const piece of rawInput.split(/[,\n\r]+/)) {
    const cleaned = cleanManagerName(piece);
    const key = cleaned.toLowerCase();
    if (cleaned && !seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }

  return result;
}

export function removeManagerFromList(existing: string[], targetName: string): string[] {
  const targetKey = normalizeManagerName(targetName);
  return existing.filter((name) => normalizeManagerName(name) !== targetKey);
}

function sanitizeManagerArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const list: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const cleaned = cleanManagerName(entry);
    const key = cleaned.toLowerCase();
    if (cleaned && !seen.has(key)) {
      seen.add(key);
      list.push(cleaned);
    }
  }
  return list;
}

export function loadManagers(): ClubManagers {
  try {
    const raw = globalThis.localStorage?.getItem(MANAGERS_STORAGE_KEY);
    if (!raw) return cloneDefaultManagers();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return cloneDefaultManagers();

    const next = cloneDefaultManagers();
    for (const club of CLUBS) {
      next[club.id] = sanitizeManagerArray(parsed[club.id]);
    }
    return next;
  } catch {
    return cloneDefaultManagers();
  }
}

export function saveManagers(managers: ClubManagers): void {
  try {
    globalThis.localStorage?.setItem(MANAGERS_STORAGE_KEY, JSON.stringify(managers));
  } catch {
    // Ignore storage quota or privacy restrictions
  }
}

export function resetManagers(): ClubManagers {
  const defaults = cloneDefaultManagers();
  saveManagers(defaults);
  return defaults;
}

function isValidScope(val: unknown): val is ClubFilter {
  return val === 'all' || isClubId(val);
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

export function loadPasscodes(): ClubPasscodes {
  try {
    const raw = globalThis.localStorage?.getItem(PASSCODES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PASSCODES };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PASSCODES };

    return {
      chemistry: isNonEmptyString(parsed.chemistry)
        ? parsed.chemistry.trim()
        : DEFAULT_PASSCODES.chemistry,
      physics: isNonEmptyString(parsed.physics)
        ? parsed.physics.trim()
        : DEFAULT_PASSCODES.physics,
      mathematics: isNonEmptyString(parsed.mathematics)
        ? parsed.mathematics.trim()
        : DEFAULT_PASSCODES.mathematics,
      biology: isNonEmptyString(parsed.biology)
        ? parsed.biology.trim()
        : DEFAULT_PASSCODES.biology,
      all: isNonEmptyString(parsed.all)
        ? parsed.all.trim()
        : DEFAULT_PASSCODES.all,
    };
  } catch {
    return { ...DEFAULT_PASSCODES };
  }
}

export function savePasscodes(passcodes: ClubPasscodes): void {
  try {
    globalThis.localStorage?.setItem(PASSCODES_STORAGE_KEY, JSON.stringify(passcodes));
  } catch {
    // Ignore storage quota or privacy restrictions
  }
}

export function resetPasscodes(): ClubPasscodes {
  const defaults = { ...DEFAULT_PASSCODES };
  savePasscodes(defaults);
  return defaults;
}

export function verifyClubLogin(
  scope: ClubFilter,
  inputPasscode: string,
  passcodes: ClubPasscodes,
): boolean {
  const candidate = inputPasscode.trim().toUpperCase();
  const expected = passcodes[scope]?.trim().toUpperCase() ?? '';
  if (!candidate || !expected) return false;
  return candidate === expected;
}

export function isManagerAuthorized(
  scope: ClubFilter,
  inputName: string,
  managers: ClubManagers,
): { allowed: boolean; canonicalName: string } {
  const cleaned = cleanManagerName(inputName);
  if (!cleaned) {
    return { allowed: false, canonicalName: '' };
  }
  if (scope === 'all') {
    return { allowed: true, canonicalName: cleaned };
  }

  const list = managers[scope] ?? [];
  if (list.length === 0) {
    return { allowed: true, canonicalName: cleaned };
  }

  const inputKey = cleaned.toLowerCase();
  const match = list.find((entry) => normalizeManagerName(entry) === inputKey);
  if (match) {
    return { allowed: true, canonicalName: cleanManagerName(match) };
  }
  return { allowed: false, canonicalName: cleaned };
}

export function verifyClubAccess(
  scope: ClubFilter,
  officerName: string,
  inputPasscode: string,
  passcodes: ClubPasscodes,
  managers: ClubManagers,
): { ok: true; canonicalName: string } | { ok: false; error: string } {
  if (!cleanManagerName(officerName)) {
    return { ok: false, error: 'Enter your name.' };
  }
  if (!verifyClubLogin(scope, inputPasscode, passcodes)) {
    return { ok: false, error: 'Invalid passcode.' };
  }
  const auth = isManagerAuthorized(scope, officerName, managers);
  if (!auth.allowed) {
    return { ok: false, error: 'Not authorized for this club.' };
  }
  return { ok: true, canonicalName: auth.canonicalName };
}

function parseSession(raw: string | null | undefined): AuthSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!isValidScope(parsed.scope)) return null;
    if (!isNonEmptyString(parsed.officerName)) return null;
    if (typeof parsed.signedInAt !== 'string') return null;

    return {
      scope: parsed.scope,
      officerName: parsed.officerName.trim(),
      signedInAt: parsed.signedInAt,
      remember: Boolean(parsed.remember),
    };
  } catch {
    return null;
  }
}

export function loadSession(): AuthSession | null {
  try {
    const fromLocal = parseSession(globalThis.localStorage?.getItem(SESSION_STORAGE_KEY));
    if (fromLocal) return fromLocal;
    const fromSession = parseSession(globalThis.sessionStorage?.getItem(SESSION_STORAGE_KEY));
    return fromSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  try {
    globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
    globalThis.sessionStorage?.removeItem(SESSION_STORAGE_KEY);
    const serialized = JSON.stringify(session);
    if (session.remember) {
      globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, serialized);
    } else {
      globalThis.sessionStorage?.setItem(SESSION_STORAGE_KEY, serialized);
    }
  } catch {
    // Ignore storage restrictions
  }
}

export function clearSession(): void {
  try {
    globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
    globalThis.sessionStorage?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage restrictions
  }
}

export function getSuggestedOfficers(state: AppState, scope: ClubFilter): string[] {
  const scopedMembers = state.members.filter(
    (m) => scope === 'all' || m.clubId === scope,
  );

  const priorityRank = (role: string): number => {
    const normalized = role.trim().toLowerCase();
    if (normalized === 'chair') return 0;
    if (normalized === 'coordinator') return 1;
    if (normalized === 'secretary' || normalized === 'treasurer') return 2;
    return 3;
  };

  const sorted = scopedMembers
    .slice()
    .sort(
      (a, b) =>
        priorityRank(a.role) - priorityRank(b.role) ||
        b.points - a.points ||
        a.name.localeCompare(b.name),
    );

  const unique: string[] = [];
  for (const m of sorted) {
    if (!unique.includes(m.name)) {
      unique.push(m.name);
      if (unique.length >= 3) break;
    }
  }
  return unique;
}
