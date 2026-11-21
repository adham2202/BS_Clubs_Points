import { DEFAULT_PASSCODES, cloneDefaultManagers, type ClubManagers, type ClubPasscodes } from './auth';
import { DEFAULT_BRANDING, type BrandingConfig } from './branding';
import {
  CLUB_IDS,
  type CloudSnapshot,
  type CloudWriteRequest,
  type ClubRecord,
} from './cloudTypes';
import { cloneDefaultDriveSources, type ClubDriveSources } from './driveSync';
import {
  cloneDefaultClubPresets,
  cloneDefaultPresets,
  type AllClubPresets,
  type ClubScoringPresets,
} from './presets';
import { validateAppState } from './storage';
import type { AppState, ClubId, Committee, Member, PointEvent } from '../types/tracker';

export const SYNC_PENDING_KEY = 'science_clubs_sync_pending_v1';

export type PendingScopeKey = `club:${ClubId}` | 'config';
export type PendingSyncMap = Partial<Record<PendingScopeKey, number>>;

export function loadPendingSync(): PendingSyncMap {
  try {
    const raw = globalThis.localStorage?.getItem(SYNC_PENDING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    const next: PendingSyncMap = {};
    if (typeof parsed.config === 'number' && Number.isFinite(parsed.config)) {
      next.config = parsed.config;
    }
    for (const clubId of CLUB_IDS) {
      const key = `club:${clubId}` as const;
      const val = parsed[key];
      if (typeof val === 'number' && Number.isFinite(val)) {
        next[key] = val;
      }
    }
    return next;
  } catch {
    return {};
  }
}

export function savePendingSync(map: PendingSyncMap): void {
  try {
    globalThis.localStorage?.setItem(SYNC_PENDING_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota or privacy restrictions
  }
}

export function setPendingTimestamp(scopeKey: PendingScopeKey, ts: number): void {
  const next = loadPendingSync();
  next[scopeKey] = ts;
  savePendingSync(next);
}

export function clearPendingTimestamps(scopeKeys: PendingScopeKey[]): void {
  const next = loadPendingSync();
  for (const key of scopeKeys) {
    delete next[key];
  }
  savePendingSync(next);
}

export async function fetchCloudSnapshot(): Promise<CloudSnapshot | null> {
  try {
    const res = await fetch('/api/state', {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.headers.get('x-clubs-db') !== '1') {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as Partial<CloudSnapshot>;
    if (!data || data.configured !== true) {
      return null;
    }
    return data as CloudSnapshot;
  } catch {
    return null;
  }
}

export async function pushCloudWrite(payload: CloudWriteRequest): Promise<boolean> {
  try {
    const body = JSON.stringify(payload);
    const byteSize = new Blob([body]).size;
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: byteSize < 60_000,
    });
    return res.ok && res.headers.get('x-clubs-db') === '1';
  } catch {
    return false;
  }
}

function sanitizeBrandingFromServer(
  raw: BrandingConfig | undefined,
  fallback: BrandingConfig,
): BrandingConfig {
  if (!raw || typeof raw !== 'object') return fallback;
  const clubs = { ...DEFAULT_BRANDING.clubs };
  for (const clubId of CLUB_IDS) {
    const item = raw.clubs?.[clubId];
    const defClub = DEFAULT_BRANDING.clubs[clubId];
    clubs[clubId] = {
      name:
        item && typeof item.name === 'string' && item.name.trim().length > 0
          ? item.name.trim()
          : defClub.name,
      logoDataUrl:
        item &&
        typeof item.logoDataUrl === 'string' &&
        item.logoDataUrl.startsWith('data:image/')
          ? item.logoDataUrl
          : null,
    };
  }
  return {
    registryTitle:
      typeof raw.registryTitle === 'string' && raw.registryTitle.trim().length > 0
        ? raw.registryTitle.trim()
        : DEFAULT_BRANDING.registryTitle,
    registryLogoDataUrl:
      typeof raw.registryLogoDataUrl === 'string' &&
      raw.registryLogoDataUrl.startsWith('data:image/')
        ? raw.registryLogoDataUrl
        : null,
    clubs,
  };
}

function sanitizePasscodesFromServer(
  raw: ClubPasscodes | undefined,
  fallback: ClubPasscodes,
): ClubPasscodes {
  if (!raw || typeof raw !== 'object') return fallback;
  const pick = (v: unknown, def: string) =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : def;
  return {
    chemistry: pick(raw.chemistry, DEFAULT_PASSCODES.chemistry),
    physics: pick(raw.physics, DEFAULT_PASSCODES.physics),
    mathematics: pick(raw.mathematics, DEFAULT_PASSCODES.mathematics),
    biology: pick(raw.biology, DEFAULT_PASSCODES.biology),
    all: pick(raw.all, DEFAULT_PASSCODES.all),
  };
}

function sanitizeManagersFromServer(
  raw: ClubManagers | undefined,
  fallback: ClubManagers,
): ClubManagers {
  if (!raw || typeof raw !== 'object') return fallback;
  const next = cloneDefaultManagers();
  for (const clubId of CLUB_IDS) {
    const arr = raw[clubId];
    if (Array.isArray(arr)) {
      next[clubId] = arr.filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0,
      );
    }
  }
  return next;
}

function sanitizeClubPresetsFromServer(
  raw: ClubScoringPresets | undefined,
): ClubScoringPresets {
  const defaults = cloneDefaultClubPresets();
  if (!raw || typeof raw !== 'object') return defaults;
  const points = Array.isArray(raw.points)
    ? raw.points.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && Math.trunc(n) !== 0).map(Math.trunc)
    : defaults.points;
  const reasons = Array.isArray(raw.reasons)
    ? raw.reasons.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
    : defaults.reasons;
  return { points, reasons };
}

export interface MergedCloudResult {
  mergedState: AppState;
  mergedBranding: BrandingConfig;
  mergedPasscodes: ClubPasscodes;
  mergedManagers: ClubManagers;
  mergedPresets: AllClubPresets;
  mergedDriveSources: ClubDriveSources;
  scopesToPush: Array<PendingScopeKey | 'all'>;
}

export function mergeServerSnapshot(params: {
  localState: AppState;
  localBranding: BrandingConfig;
  localPasscodes: ClubPasscodes;
  localManagers: ClubManagers;
  localPresets: AllClubPresets;
  localDriveSources: ClubDriveSources;
  pending: PendingSyncMap;
  snapshot: CloudSnapshot;
}): MergedCloudResult {
  const {
    localState,
    localBranding,
    localPasscodes,
    localManagers,
    localPresets,
    localDriveSources,
    pending,
    snapshot,
  } = params;

  if (!snapshot.initialized) {
    return {
      mergedState: localState,
      mergedBranding: localBranding,
      mergedPasscodes: localPasscodes,
      mergedManagers: localManagers,
      mergedPresets: localPresets,
      mergedDriveSources: localDriveSources,
      scopesToPush: ['all'],
    };
  }

  const scopesToPush: Array<PendingScopeKey | 'all'> = [];

  const pendingConfigTs = pending.config ?? 0;
  const serverConfigTs = snapshot.config?.updatedAt ?? 0;
  let mergedBranding = localBranding;
  let mergedPasscodes = localPasscodes;
  let mergedManagers = localManagers;

  if (!snapshot.config || pendingConfigTs > serverConfigTs) {
    scopesToPush.push('config');
  } else {
    mergedBranding = sanitizeBrandingFromServer(snapshot.config.branding, localBranding);
    mergedPasscodes = sanitizePasscodesFromServer(snapshot.config.passcodes, localPasscodes);
    mergedManagers = sanitizeManagersFromServer(snapshot.config.managers, localManagers);
  }

  const committees: Committee[] = [];
  const members: Member[] = [];
  const history: PointEvent[] = [];
  const mergedPresets = cloneDefaultPresets();
  const mergedDriveSources = cloneDefaultDriveSources();

  for (const clubId of CLUB_IDS) {
    const scopeKey = `club:${clubId}` as const;
    const pendingClubTs = pending[scopeKey] ?? 0;
    const serverClub: ClubRecord | undefined = snapshot.clubs[clubId];
    const serverClubTs = serverClub?.updatedAt ?? 0;

    if (!serverClub || pendingClubTs > serverClubTs) {
      committees.push(...localState.committees.filter((c) => c.clubId === clubId));
      members.push(...localState.members.filter((m) => m.clubId === clubId));
      history.push(...localState.history.filter((h) => h.clubId === clubId));
      mergedPresets[clubId] = localPresets[clubId];
      mergedDriveSources[clubId] = localDriveSources[clubId];
      scopesToPush.push(scopeKey);
    } else {
      const candidate = validateAppState({
        version: 1,
        committees: serverClub.committees,
        members: serverClub.members,
        history: serverClub.history,
      });
      if (candidate.ok) {
        committees.push(...candidate.state.committees.filter((c) => c.clubId === clubId));
        members.push(...candidate.state.members.filter((m) => m.clubId === clubId));
        history.push(...candidate.state.history.filter((h) => h.clubId === clubId));
      } else {
        committees.push(...localState.committees.filter((c) => c.clubId === clubId));
        members.push(...localState.members.filter((m) => m.clubId === clubId));
        history.push(...localState.history.filter((h) => h.clubId === clubId));
      }
      mergedPresets[clubId] = sanitizeClubPresetsFromServer(serverClub.presets);
      mergedDriveSources[clubId] = {
        url:
          typeof serverClub.driveSource?.url === 'string'
            ? serverClub.driveSource.url.trim()
            : '',
        lastSyncedAt:
          typeof serverClub.driveSource?.lastSyncedAt === 'string'
            ? serverClub.driveSource.lastSyncedAt
            : null,
      };
    }
  }

  const finalValidation = validateAppState({
    version: 1,
    committees,
    members,
    history,
  });

  return {
    mergedState: finalValidation.ok ? finalValidation.state : localState,
    mergedBranding,
    mergedPasscodes,
    mergedManagers,
    mergedPresets,
    mergedDriveSources,
    scopesToPush,
  };
}
