import { BlobNotFoundError, get, put } from '@vercel/blob';
import {
  CLUB_IDS,
  isValidCloudWriteRequest,
  isValidClubRecord,
  isValidPortalConfigRecord,
  type CloudSnapshot,
  type ClubRecord,
  type PortalConfigRecord,
} from '../src/state/cloudTypes';
import type { ClubId } from '../src/types/tracker';

const DB_CONFIG_PATH = 'db/portal-config.json';

function clubBlobPath(clubId: ClubId): string {
  return `db/club-${clubId}.json`;
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
    if (
      err instanceof Error &&
      /not\s*found|404/i.test(err.message)
    ) {
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
      readPrivateJson<PortalConfigRecord>(
        DB_CONFIG_PATH,
        isValidPortalConfigRecord,
      ),
      ...CLUB_IDS.map((clubId) =>
        readPrivateJson<ClubRecord>(clubBlobPath(clubId), isValidClubRecord),
      ),
    ]);

    const clubs: Partial<Record<ClubId, ClubRecord>> = {};
    CLUB_IDS.forEach((clubId, index) => {
      const rec = clubRecords[index];
      if (rec) {
        clubs[clubId] = rec;
      }
    });

    const snapshot: CloudSnapshot = {
      configured: true,
      initialized: Boolean(config) || Object.keys(clubs).length > 0,
      clubs,
      config,
    };

    return jsonResponse(200, snapshot);
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
