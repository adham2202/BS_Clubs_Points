import fs from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import {
  CLUB_IDS,
  isValidCloudWriteRequest,
  isValidClubRecord,
  isValidPortalConfigRecord,
  type CloudSnapshot,
  type ClubRecord,
  type PortalConfigRecord,
} from './src/state/cloudTypes';
import type { ClubId } from './src/types/tracker';

const PRIVATE_SHEET_ERROR =
  'Sheet is private — set sharing to "Anyone with the link (Viewer)", or upload its CSV.';
const EXCEL_FILE_ERROR =
  'This Drive file is an Excel (.xlsx) file — open it in Google Sheets and share its Sheet link, or upload a CSV.';

interface LocalDbFile {
  clubs: Partial<Record<ClubId, ClubRecord>>;
  config: PortalConfigRecord | null;
}

function sendJson(
  res: {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
    end: (chunk: string) => void;
  },
  statusCode: number,
  payload: unknown,
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readJsonRequestBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(text));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function attachLocalDbMiddleware(middlewares: Connect.Server): void {
  const dbDir = path.resolve(process.cwd(), '.data');
  const dbPath = path.join(dbDir, 'clubs-db.json');
  let queue: Promise<void> = Promise.resolve();

  const readDbFile = async (): Promise<LocalDbFile> => {
    try {
      const raw = await fs.readFile(dbPath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const clubs: Partial<Record<ClubId, ClubRecord>> = {};
      const rawClubs =
        parsed.clubs && typeof parsed.clubs === 'object'
          ? (parsed.clubs as Record<string, unknown>)
          : {};
      for (const clubId of CLUB_IDS) {
        if (isValidClubRecord(rawClubs[clubId])) {
          clubs[clubId] = rawClubs[clubId];
        }
      }
      const config = isValidPortalConfigRecord(parsed.config)
        ? parsed.config
        : null;
      return { clubs, config };
    } catch {
      return { clubs: {}, config: null };
    }
  };

  const writeDbFile = async (db: LocalDbFile): Promise<void> => {
    await fs.mkdir(dbDir, { recursive: true });
    await fs.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf8');
  };

  middlewares.use('/api/state', (req, res) => {
    res.setHeader('X-Clubs-Db', '1');
    res.setHeader('Cache-Control', 'no-store');

    const method = (req.method ?? 'GET').toUpperCase();
    if (method === 'GET') {
      queue = queue.then(async () => {
        try {
          const db = await readDbFile();
          const snapshot: CloudSnapshot = {
            configured: true,
            initialized: Boolean(db.config) || Object.keys(db.clubs).length > 0,
            clubs: db.clubs,
            config: db.config,
          };
          sendJson(res, 200, snapshot);
        } catch (err) {
          console.error('[local /api/state] GET error', err);
          sendJson(res, 500, { error: 'Unable to load local database state.' });
        }
      });
      return;
    }

    if (method === 'PUT') {
      queue = queue.then(async () => {
        let body: unknown;
        try {
          body = await readJsonRequestBody(req);
        } catch {
          sendJson(res, 400, { error: 'Invalid JSON request body.' });
          return;
        }

        if (!isValidCloudWriteRequest(body)) {
          sendJson(res, 400, { error: 'Invalid database payload.' });
          return;
        }

        try {
          const db = await readDbFile();
          let updatedAt = Date.now();

          if (body.scope === 'club') {
            updatedAt = body.record.updatedAt;
            db.clubs[body.clubId] = body.record;
          } else if (body.scope === 'config') {
            updatedAt = body.record.updatedAt;
            db.config = body.record;
          } else {
            updatedAt = body.config.updatedAt;
            db.config = body.config;
            for (const clubId of CLUB_IDS) {
              db.clubs[clubId] = body.clubs[clubId];
            }
          }

          await writeDbFile(db);
          sendJson(res, 200, { ok: true, scope: body.scope, updatedAt });
        } catch (err) {
          console.error('[local /api/state] PUT error', err);
          sendJson(res, 500, { error: 'Unable to save local database state.' });
        }
      });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed.' });
  });
}

async function fetchUpstreamWithRetry(targetUrl: string): Promise<Response> {
  const options: RequestInit = {
    redirect: 'follow',
    headers: { Accept: 'text/csv, text/plain, */*' },
    signal: AbortSignal.timeout(15000),
  };

  try {
    return await fetch(targetUrl, options);
  } catch {
    return await fetch(targetUrl, options);
  }
}

function attachGoogleSheetsProxy(middlewares: Connect.Server): void {
  middlewares.use('/api/fetch-sheet', async (req, res) => {
    res.setHeader('X-Sheet-Proxy', '1');
    res.setHeader('Cache-Control', 'no-store');

    let parsedTarget: URL;
    try {
      const reqUrl = new URL(req.url ?? '/', 'http://localhost');
      const rawTarget = reqUrl.searchParams.get('url') ?? '';
      parsedTarget = new URL(rawTarget);
    } catch {
      sendJson(res, 400, {
        error: 'Only docs.google.com and drive.google.com URLs are allowed.',
      });
      return;
    }

    const host = parsedTarget.hostname.toLowerCase();
    if (
      parsedTarget.protocol !== 'https:' ||
      (host !== 'docs.google.com' && host !== 'drive.google.com')
    ) {
      sendJson(res, 400, {
        error: 'Only docs.google.com and drive.google.com URLs are allowed.',
      });
      return;
    }

    try {
      const upstream = await fetchUpstreamWithRetry(parsedTarget.toString());
      const finalHost = new URL(
        upstream.url || parsedTarget.toString(),
      ).hostname.toLowerCase();

      if (finalHost === 'accounts.google.com') {
        sendJson(res, 403, { error: PRIVATE_SHEET_ERROR });
        return;
      }

      if (
        finalHost !== 'docs.google.com' &&
        finalHost !== 'drive.google.com' &&
        !finalHost.endsWith('.google.com') &&
        !finalHost.endsWith('.googleusercontent.com')
      ) {
        sendJson(res, 400, { error: 'Unexpected redirect host.' });
        return;
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      const upstreamCt = (
        upstream.headers.get('content-type') ?? ''
      ).toLowerCase();

      const isZipOrExcel =
        (buf.length >= 4 &&
          buf[0] === 0x50 &&
          buf[1] === 0x4b &&
          buf[2] === 0x03 &&
          buf[3] === 0x04) ||
        upstreamCt.includes('spreadsheetml');

      if (isZipOrExcel) {
        sendJson(res, 415, { error: EXCEL_FILE_ERROR });
        return;
      }

      if (upstream.status === 401 || upstream.status === 403) {
        sendJson(res, 403, { error: PRIVATE_SHEET_ERROR });
        return;
      }

      if (upstream.status === 404) {
        sendJson(res, 404, {
          error:
            'Sheet not found — check the link and make sure the file is shared.',
        });
        return;
      }

      if (!upstream.ok) {
        sendJson(res, upstream.status, {
          error: `Could not load sheet from Google (HTTP ${upstream.status}).`,
        });
        return;
      }

      const text = buf.toString('utf8');
      const head = text.replace(/^\uFEFF/, '').trimStart();
      if (
        /^<!doctype\s+html/i.test(head) ||
        /^<html[\s>]/i.test(head) ||
        head.includes('accounts.google.com/ServiceLogin')
      ) {
        sendJson(res, 403, { error: PRIVATE_SHEET_ERROR });
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.end(text);
    } catch {
      sendJson(res, 502, {
        error:
          'Could not reach Google Drive right now — check your internet connection and try again, or use Upload CSV.',
      });
    }
  });
}

function localApiPlugins(): Plugin {
  return {
    name: 'clubs-local-api',
    configureServer(server) {
      attachGoogleSheetsProxy(server.middlewares);
      attachLocalDbMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachGoogleSheetsProxy(server.middlewares);
      attachLocalDbMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), localApiPlugins()],
});
