import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeedState } from '../../data/seedData';
import { cloneDefaultManagers, DEFAULT_PASSCODES } from '../auth';
import { cloneDefaultBranding } from '../branding';
import {
  mergeServerSnapshot,
  type PendingSyncMap,
} from '../cloudSync';
import {
  buildAllClubRecords,
  extractClubRecord,
  isValidCloudWriteRequest,
  type CloudSnapshot,
} from '../cloudTypes';
import { cloneDefaultDriveSources } from '../driveSync';
import { cloneDefaultPresets } from '../presets';

const blobStore = new Map<string, string>();
const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('@vercel/blob', () => {
  class BlobNotFoundError extends Error {
    constructor(message = 'Blob not found') {
      super(message);
      this.name = 'BlobNotFoundError';
    }
  }

  return {
    BlobNotFoundError,
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
  };
});

describe('Science Clubs Points — Persistent Cloud Database Sync & API State', () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  const originalStoreId = process.env.BLOB_STORE_ID;

  beforeEach(() => {
    blobStore.clear();
    mockGet.mockImplementation(async (pathname: string) => {
      const content = blobStore.get(pathname);
      if (content === undefined) return null;
      return {
        statusCode: 200,
        stream: new Response(content).body,
        headers: new Headers(),
        blob: {
          url: `https://example.blob.vercel-storage.com/${pathname}`,
          pathname,
          contentType: 'application/json; charset=utf-8',
          size: content.length,
          uploadedAt: new Date(),
        },
      };
    });
    mockPut.mockImplementation(async (pathname: string, body: string) => {
      blobStore.set(pathname, body);
      return {
        url: `https://example.blob.vercel-storage.com/${pathname}`,
        pathname,
        contentType: 'application/json; charset=utf-8',
      };
    });
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    }
    if (originalStoreId === undefined) {
      delete process.env.BLOB_STORE_ID;
    } else {
      process.env.BLOB_STORE_ID = originalStoreId;
    }
    vi.clearAllMocks();
  });

  it('extracts per-club records and validates scoped CloudWriteRequest payloads', () => {
    const seed = createSeedState();
    const presets = cloneDefaultPresets();
    const driveSources = cloneDefaultDriveSources();

    const chemRecord = extractClubRecord(
      'chemistry',
      seed,
      presets,
      driveSources,
      1000,
    );
    expect(chemRecord.clubId).toBe('chemistry');
    expect(chemRecord.members.every((m) => m.clubId === 'chemistry')).toBe(true);
    expect(
      isValidCloudWriteRequest({
        scope: 'club',
        clubId: 'chemistry',
        record: chemRecord,
      }),
    ).toBe(true);
    expect(
      isValidCloudWriteRequest({
        scope: 'club',
        clubId: 'physics',
        record: chemRecord,
      }),
    ).toBe(false);
    expect(isValidCloudWriteRequest({ scope: 'bad' })).toBe(false);

    const allClubs = buildAllClubRecords(seed, presets, driveSources, 1000);
    expect(
      isValidCloudWriteRequest({
        scope: 'all',
        clubs: allClubs,
        config: {
          branding: cloneDefaultBranding(),
          passcodes: { ...DEFAULT_PASSCODES },
          managers: cloneDefaultManagers(),
          updatedAt: 1000,
        },
      }),
    ).toBe(true);
  });

  it('seeds uninitialized DBs, adopts newer server state, and preserves pending offline edits', () => {
    const localState = createSeedState();
    const localBranding = cloneDefaultBranding();
    const localPasscodes = { ...DEFAULT_PASSCODES };
    const localManagers = cloneDefaultManagers();
    const localPresets = cloneDefaultPresets();
    const localDriveSources = cloneDefaultDriveSources();

    // 1. Fresh DB -> keep local and schedule initial 'all' seed write
    const emptySnapshot: CloudSnapshot = {
      configured: true,
      initialized: false,
      clubs: {},
      config: null,
    };
    const initialMerge = mergeServerSnapshot({
      localState,
      localBranding,
      localPasscodes,
      localManagers,
      localPresets,
      localDriveSources,
      pending: {},
      snapshot: emptySnapshot,
    });
    expect(initialMerge.scopesToPush).toEqual(['all']);
    expect(initialMerge.mergedState.members).toHaveLength(localState.members.length);

    // 2. Server updates Physics & Portal branding while Chemistry has an unsynced newer pending timestamp
    const serverClubs = buildAllClubRecords(
      localState,
      localPresets,
      localDriveSources,
      2000,
    );
    const chemMember = serverClubs.chemistry.members[0];
    const localWithPendingChem = {
      ...localState,
      members: localState.members.map((m) =>
        m.id === chemMember.id ? { ...m, points: m.points + 20 } : m,
      ),
    };
    serverClubs.physics = {
      ...serverClubs.physics,
      presets: { points: [5, 15], reasons: ['Lab Exam'] },
    };

    const serverSnapshot: CloudSnapshot = {
      configured: true,
      initialized: true,
      clubs: serverClubs,
      config: {
        branding: {
          ...cloneDefaultBranding(),
          registryTitle: 'National Science Clubs',
        },
        passcodes: { ...DEFAULT_PASSCODES },
        managers: {
          ...cloneDefaultManagers(),
          chemistry: ['Adham Mohamed'],
        },
        updatedAt: 2000,
      },
    };

    const pending: PendingSyncMap = {
      'club:chemistry': 5000,
    };

    const reconciled = mergeServerSnapshot({
      localState: localWithPendingChem,
      localBranding,
      localPasscodes,
      localManagers,
      localPresets,
      localDriveSources,
      pending,
      snapshot: serverSnapshot,
    });

    expect(reconciled.scopesToPush).toEqual(['club:chemistry']);
    expect(reconciled.mergedBranding.registryTitle).toBe('National Science Clubs');
    expect(reconciled.mergedManagers.chemistry).toEqual(['Adham Mohamed']);
    expect(reconciled.mergedPresets.physics.points).toEqual([5, 15]);
    const reconciledChemMember = reconciled.mergedState.members.find(
      (m) => m.id === chemMember.id,
    )!;
    expect(reconciledChemMember.points).toBe(chemMember.points + 20);
  });

  it('serves 503 when Blob is unconfigured and handles scoped PUT + fresh GET via @vercel/blob', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;

    const { GET, PUT } = await import('../../../api/state');

    const unconfiguredRes = await GET();
    expect(unconfiguredRes.status).toBe(503);
    expect(unconfiguredRes.headers.get('X-Clubs-Db')).toBe('1');
    expect(await unconfiguredRes.json()).toMatchObject({ configured: false });

    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_123';

    const seed = createSeedState();
    const presets = cloneDefaultPresets();
    const driveSources = cloneDefaultDriveSources();
    const chemRecord = extractClubRecord(
      'chemistry',
      seed,
      presets,
      driveSources,
      7777,
    );

    const badPut = await PUT(
      new Request('http://localhost/api/state', {
        method: 'PUT',
        body: JSON.stringify({ scope: 'invalid' }),
      }),
    );
    expect(badPut.status).toBe(400);

    const putRes = await PUT(
      new Request('http://localhost/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'club',
          clubId: 'chemistry',
          record: chemRecord,
        }),
      }),
    );
    expect(putRes.status).toBe(200);
    expect(mockPut).toHaveBeenCalledWith(
      'db/club-chemistry.json',
      expect.any(String),
      expect.objectContaining({
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
      }),
    );

    const getRes = await GET();
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('Cache-Control')).toBe('no-store');
    expect(getRes.headers.get('X-Clubs-Db')).toBe('1');
    expect(mockGet).toHaveBeenCalledWith('db/club-chemistry.json', {
      access: 'private',
      useCache: false,
    });

    const snapshot = (await getRes.json()) as CloudSnapshot;
    expect(snapshot.configured).toBe(true);
    expect(snapshot.initialized).toBe(true);
    expect(snapshot.clubs.chemistry?.updatedAt).toBe(7777);
  });
});
