import { BlobNotFoundError, get, put } from '@vercel/blob';

type ClubId = 'chemistry' | 'physics' | 'mathematics' | 'biology';

const CLUB_IDS: readonly ClubId[] = [
  'chemistry',
  'physics',
  'mathematics',
  'biology',
] as const;

interface StoredClubRecord {
  clubId: ClubId;
  committees: unknown[];
  members: unknown[];
  history: unknown[];
  presets: { points: unknown[]; reasons: unknown[] };
  driveSource: { url: string; lastSyncedAt?: string | null };
  updatedAt: number;
}

interface StoredConfigRecord {
  branding: Record<string, unknown>;
  passcodes: Record<string, unknown>;
  managers: Record<string, unknown>;
  updatedAt: number;
}

type StoredWriteRequest =
  | { scope: 'club'; clubId: ClubId; record: StoredClubRecord }
  | { scope: 'config'; record: StoredConfigRecord }
  | {
      scope: 'all';
      clubs: Record<ClubId, StoredClubRecord>;
      config: StoredConfigRecord;
    };

const DB_CONFIG_PATH = 'db/portal-config.json';

function clubBlobPath(clubId: ClubId): string {
  return `db/club-${clubId}.json`;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

function isValidClubId(val: unknown): val is ClubId {
  return (
    val === 'chemistry' ||
    val === 'physics' ||
    val === 'mathematics' ||
    val === 'biology'
  );
}

function isValidClubRecord(val: unknown): val is StoredClubRecord {
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

function isValidPortalConfigRecord(val: unknown): val is StoredConfigRecord {
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

function isValidCloudWriteRequest(body: unknown): body is StoredWriteRequest {
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

function isBlobConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID,
  );
}

function jsonResponse(status: number, payload: unknown): Response {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Clubs-Db': '1',
    },
  });
}

async function readPrivateJson<T>(
  pathname: string,
  validate: (val: unknown) => val is T,
): Promise<T | null> {
  try {
    const result = await get(pathname, {
      access: 'private',
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }
    const text = await new Response(result.stream).text();
    const parsed: unknown = JSON.parse(text);
    return validate(parsed) ? parsed : null;
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      return null;
    }
    if (err instanceof Error && /not\s*found|404/i.test(err.message)) {
      return null;
    }
    throw err;
  }
}

async function writePrivateJson(pathname: string, data: unknown): Promise<void> {
  await put(pathname, JSON.stringify(data), {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json; charset=utf-8',
  });
}

export async function GET(): Promise<Response> {
  if (!isBlobConfigured()) {
    return jsonResponse(503, {
      configured: false,
      error: 'Database store is not connected yet.',
    });
  }

  try {
    const [config, ...clubRecords] = await Promise.all([
      readPrivateJson<StoredConfigRecord>(
        DB_CONFIG_PATH,
        isValidPortalConfigRecord,
      ),
      ...CLUB_IDS.map((clubId) =>
        readPrivateJson<StoredClubRecord>(
          clubBlobPath(clubId),
          isValidClubRecord,
        ),
      ),
    ]);

    const clubs: Partial<Record<ClubId, StoredClubRecord>> = {};
    CLUB_IDS.forEach((clubId, index) => {
      const rec = clubRecords[index];
      if (rec) {
        clubs[clubId] = rec;
      }
    });

    return jsonResponse(200, {
      configured: true,
      initialized: Boolean(config) || Object.keys(clubs).length > 0,
      clubs,
      config,
    });
  } catch (err) {
    console.error('[api/state] GET failed', err);
    return jsonResponse(500, {
      error: 'Unable to load database state.',
    });
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!isBlobConfigured()) {
    return jsonResponse(503, {
      configured: false,
      error: 'Database store is not connected yet.',
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON request body.' });
  }

  if (!isValidCloudWriteRequest(body)) {
    return jsonResponse(400, { error: 'Invalid database payload.' });
  }

  try {
    let updatedAt = Date.now();

    if (body.scope === 'club') {
      updatedAt = body.record.updatedAt;
      await writePrivateJson(clubBlobPath(body.clubId), body.record);
    } else if (body.scope === 'config') {
      updatedAt = body.record.updatedAt;
      await writePrivateJson(DB_CONFIG_PATH, body.record);
    } else {
      updatedAt = body.config.updatedAt;
      await Promise.all([
        writePrivateJson(DB_CONFIG_PATH, body.config),
        ...CLUB_IDS.map((clubId) =>
          writePrivateJson(clubBlobPath(clubId), body.clubs[clubId]),
        ),
      ]);
    }

    return jsonResponse(200, {
      ok: true,
      scope: body.scope,
      updatedAt,
    });
  } catch (err) {
    console.error('[api/state] PUT failed', err);
    return jsonResponse(500, {
      error: 'Unable to save database state.',
    });
  }
}
