import type { ClubManagers, ClubPasscodes } from './auth';
import type { BrandingConfig } from './branding';
import type { ClubDriveSource, ClubDriveSources } from './driveSync';
import type { AllClubPresets, ClubScoringPresets } from './presets';
import type { AppState, ClubId, Committee, Member, PointEvent } from '../types/tracker';

export const CLUB_IDS: readonly ClubId[] = [
  'chemistry',
  'physics',
  'mathematics',
  'biology',
] as const;

export interface ClubRecord {
  clubId: ClubId;
  committees: Committee[];
  members: Member[];
  history: PointEvent[];
  presets: ClubScoringPresets;
  driveSource: ClubDriveSource;
  updatedAt: number;
}

export interface PortalConfigRecord {
  branding: BrandingConfig;
  passcodes: ClubPasscodes;
  managers: ClubManagers;
  updatedAt: number;
}

export interface CloudSnapshot {
  configured: true;
  initialized: boolean;
  clubs: Partial<Record<ClubId, ClubRecord>>;
  config: PortalConfigRecord | null;
}

export type CloudWriteRequest =
  | {
      scope: 'club';
      clubId: ClubId;
      record: ClubRecord;
    }
  | {
      scope: 'config';
      record: PortalConfigRecord;
    }
  | {
      scope: 'all';
      clubs: Record<ClubId, ClubRecord>;
      config: PortalConfigRecord;
    };

export function isValidClubId(val: unknown): val is ClubId {
  return (
    val === 'chemistry' ||
    val === 'physics' ||
    val === 'mathematics' ||
    val === 'biology'
  );
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

export function isValidClubRecord(val: unknown): val is ClubRecord {
  if (!isPlainObject(val)) return false;
  if (!isValidClubId(val.clubId)) return false;
  if (
    !Array.isArray(val.committees) ||
    !Array.isArray(val.members) ||
    !Array.isArray(val.history)
  ) {
    return false;
  }
  if (!isPlainObject(val.presets)) return false;
  if (!Array.isArray(val.presets.points) || !Array.isArray(val.presets.reasons)) {
    return false;
  }
  if (!isPlainObject(val.driveSource) || typeof val.driveSource.url !== 'string') {
    return false;
  }
  return typeof val.updatedAt === 'number' && Number.isFinite(val.updatedAt);
}

export function isValidPortalConfigRecord(val: unknown): val is PortalConfigRecord {
  if (!isPlainObject(val)) return false;
  if (
    !isPlainObject(val.branding) ||
    !isPlainObject(val.passcodes) ||
    !isPlainObject(val.managers)
  ) {
    return false;
  }
  return typeof val.updatedAt === 'number' && Number.isFinite(val.updatedAt);
}

export function isValidCloudWriteRequest(body: unknown): body is CloudWriteRequest {
  if (!isPlainObject(body)) return false;
  if (body.scope === 'club') {
    return (
      isValidClubId(body.clubId) &&
      isValidClubRecord(body.record) &&
      body.record.clubId === body.clubId
    );
  }
  if (body.scope === 'config') {
    return isValidPortalConfigRecord(body.record);
  }
  if (body.scope === 'all') {
    const clubsObj = body.clubs;
    if (!isPlainObject(clubsObj) || !isValidPortalConfigRecord(body.config)) {
      return false;
    }
    return CLUB_IDS.every((clubId) => {
      const rec = clubsObj[clubId];
      return isValidClubRecord(rec) && rec.clubId === clubId;
    });
  }
  return false;
}

export function extractClubRecord(
  clubId: ClubId,
  state: AppState,
  presets: AllClubPresets,
  driveSources: ClubDriveSources,
  updatedAt = Date.now(),
): ClubRecord {
  return {
    clubId,
    committees: state.committees.filter((c) => c.clubId === clubId),
    members: state.members.filter((m) => m.clubId === clubId),
    history: state.history.filter((h) => h.clubId === clubId),
    presets: presets[clubId],
    driveSource: driveSources[clubId],
    updatedAt,
  };
}

export function buildAllClubRecords(
  state: AppState,
  presets: AllClubPresets,
  driveSources: ClubDriveSources,
  updatedAt = Date.now(),
): Record<ClubId, ClubRecord> {
  return {
    chemistry: extractClubRecord('chemistry', state, presets, driveSources, updatedAt),
    physics: extractClubRecord('physics', state, presets, driveSources, updatedAt),
    mathematics: extractClubRecord('mathematics', state, presets, driveSources, updatedAt),
    biology: extractClubRecord('biology', state, presets, driveSources, updatedAt),
  };
}
