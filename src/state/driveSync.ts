import { CLUBS } from '../data/clubs';
import type { ClubId } from '../types/tracker';

export interface ClubDriveSource {
  url: string;
  lastSyncedAt: string | null;
}

export type ClubDriveSources = Record<ClubId, ClubDriveSource>;

export interface SheetColumnMapping {
  name: number | null;
  committee: number | null;
  phone: number | null;
  email: number | null;
  role: number | null;
  points: number | null;
}

export interface SyncedMemberRow {
  name: string;
  committeeName: string;
  phone: string;
  email: string;
  role: string;
  points: number;
}

export type DriveUrlResolution =
  | {
      ok: true;
      csvUrl: string;
      fallbackCsvUrl?: string;
    }
  | {
      ok: false;
      error: string;
    };

export const DRIVE_SOURCES_STORAGE_KEY = 'science_clubs_drive_sources_v1';

export function cloneDefaultDriveSources(): ClubDriveSources {
  return {
    chemistry: { url: '', lastSyncedAt: null },
    physics: { url: '', lastSyncedAt: null },
    mathematics: { url: '', lastSyncedAt: null },
    biology: { url: '', lastSyncedAt: null },
  };
}

export function loadDriveSources(): ClubDriveSources {
  try {
    const raw = globalThis.localStorage?.getItem(DRIVE_SOURCES_STORAGE_KEY);
    if (!raw) return cloneDefaultDriveSources();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return cloneDefaultDriveSources();

    const next = cloneDefaultDriveSources();
    for (const club of CLUBS) {
      const item = parsed[club.id];
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      next[club.id] = {
        url: typeof obj.url === 'string' ? obj.url.trim() : '',
        lastSyncedAt:
          typeof obj.lastSyncedAt === 'string' ? obj.lastSyncedAt : null,
      };
    }
    return next;
  } catch {
    return cloneDefaultDriveSources();
  }
}

export function saveDriveSources(sources: ClubDriveSources): void {
  try {
    globalThis.localStorage?.setItem(
      DRIVE_SOURCES_STORAGE_KEY,
      JSON.stringify(sources),
    );
  } catch {
    // Ignore storage quota or privacy restrictions
  }
}

export function resetDriveSources(): ClubDriveSources {
  const defaults = cloneDefaultDriveSources();
  saveDriveSources(defaults);
  return defaults;
}

export function resolveDriveCsvUrl(rawUrl: string): DriveUrlResolution {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter a Google Sheet or Drive link.' };
  }

  const normalized = /^(docs\.google\.com|drive\.google\.com)\//i.test(trimmed)
    ? `https://${trimmed}`
    : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { ok: false, error: 'Enter a valid Google Sheet or Drive URL.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Enter a valid http(s) URL.' };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  if (
    (host === 'docs.google.com' && path.startsWith('/forms')) ||
    host === 'forms.gle'
  ) {
    return {
      ok: false,
      error:
        'Paste the linked Google Sheet from Form Responses (Google Forms → Responses → Link to Sheets).',
    };
  }

  if (host === 'docs.google.com') {
    const pubMatch = path.match(
      /\/spreadsheets\/(?:u\/\d+\/)?d\/e\/([a-zA-Z0-9_-]+)/,
    );
    const gidMatch =
      parsed.searchParams.get('gid') ??
      parsed.hash.match(/gid=(\d+)/)?.[1] ??
      null;

    if (pubMatch) {
      const id = pubMatch[1];
      const csvUrl = gidMatch
        ? `https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv&single=true&gid=${gidMatch}`
        : `https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv`;
      return { ok: true, csvUrl };
    }

    const sheetMatch = path.match(
      /\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/,
    );
    if (sheetMatch) {
      const id = sheetMatch[1];
      const gidSuffix = gidMatch ? `&gid=${gidMatch}` : '';
      return {
        ok: true,
        csvUrl: `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gidSuffix}`,
        fallbackCsvUrl: `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gidSuffix}`,
      };
    }
  }

  if (host === 'drive.google.com') {
    if (/\/drive\/(?:u\/\d+\/)?folders\//i.test(path)) {
      return {
        ok: false,
        error:
          'Paste the link to the Google Sheet or CSV file inside the folder (not a folder link).',
      };
    }

    const fileMatch = path.match(/\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
    const id = fileMatch?.[1] ?? parsed.searchParams.get('id');
    if (id) {
      return {
        ok: true,
        csvUrl: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`,
        fallbackCsvUrl: `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv`,
      };
    }
  }

  if (
    path.toLowerCase().endsWith('.csv') ||
    parsed.searchParams.get('output') === 'csv' ||
    parsed.searchParams.get('format') === 'csv' ||
    parsed.searchParams.get('tqx')?.includes('csv')
  ) {
    return { ok: true, csvUrl: parsed.toString() };
  }

  return {
    ok: false,
    error: 'Use a Google Sheets, Google Drive file, or direct CSV link.',
  };
}

export const PRIVATE_HTML_ERROR =
  'Sheet is private — set sharing to "Anyone with the link (Viewer)", or upload its CSV.';
export const EXCEL_BINARY_ERROR =
  'This Drive file is an Excel (.xlsx) file — open it in Google Sheets and share its Sheet link, or upload a CSV.';
export const NETWORK_FETCH_ERROR =
  'Could not reach the Google Sheet — check that the sheet is shared as "Anyone with the link (Viewer)" and reload the page, or use Upload CSV.';

function assertValidCsvPayload(text: string): string {
  const clean = text.replace(/^\uFEFF/, '');
  if (clean.startsWith('PK\u0003\u0004')) {
    throw new Error(EXCEL_BINARY_ERROR);
  }
  const head = clean.trimStart();
  if (
    /^<!doctype\s+html/i.test(head) ||
    /^<html[\s>]/i.test(head) ||
    head.includes('accounts.google.com/ServiceLogin')
  ) {
    throw new Error(PRIVATE_HTML_ERROR);
  }
  return clean;
}

export function parseCsvTable(csvText: string): string[][] {
  const clean = assertValidCsvPayload(csvText);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r') {
      if (clean[i + 1] === '\n') {
        i += 1;
      }
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function isTimestampHeader(normalized: string): boolean {
  return /timestamp|time\s*stamp|submitted|created_at|الطابع الزمني|تاريخ التسجيل|^date$/i.test(
    normalized,
  );
}

export function detectSheetColumns(headers: string[]): SheetColumnMapping {
  const mapping: SheetColumnMapping = {
    name: null,
    committee: null,
    phone: null,
    email: null,
    role: null,
    points: null,
  };
  const used = new Set<number>();

  headers.forEach((raw, idx) => {
    const h = raw.trim().toLowerCase();
    if (!h || isTimestampHeader(h)) return;

    if (
      mapping.email === null &&
      /email|e-mail|mail|البريد|ايميل|إيميل/.test(h)
    ) {
      mapping.email = idx;
      used.add(idx);
    } else if (
      mapping.phone === null &&
      /phone|mobile|tel|whatsapp|contact|cell|الهاتف|الموبايل|رقم الهاتف|التليفون|واتس/.test(
        h,
      )
    ) {
      mapping.phone = idx;
      used.add(idx);
    } else if (
      mapping.committee === null &&
      /committee|team|group|track|section|division|department|اللجنة|لجنة/.test(
        h,
      )
    ) {
      mapping.committee = idx;
      used.add(idx);
    } else if (
      mapping.points === null &&
      /point|pts|score|total|نقاط|النقاط|الدرجة/.test(h)
    ) {
      mapping.points = idx;
      used.add(idx);
    } else if (
      mapping.role === null &&
      /role|position|title|rank|المنصب|الدور/.test(h)
    ) {
      mapping.role = idx;
      used.add(idx);
    } else if (
      mapping.name === null &&
      /full\s*name|member\s*name|student\s*name|\bname\b|الاسم|اسم العضو|الاسم الكامل/.test(
        h,
      )
    ) {
      mapping.name = idx;
      used.add(idx);
    }
  });

  if (mapping.name === null) {
    for (let i = 0; i < headers.length; i += 1) {
      const h = headers[i].trim().toLowerCase();
      if (!used.has(i) && !isTimestampHeader(h)) {
        mapping.name = i;
        break;
      }
    }
  }

  return mapping;
}

export function extractSheetRows(
  table: string[][],
  mapping: SheetColumnMapping,
  fallbackCommitteeName: string,
): SyncedMemberRow[] {
  if (table.length <= 1 || mapping.name === null) return [];
  const defaultCommittee = fallbackCommitteeName.trim() || 'General';
  const rows: SyncedMemberRow[] = [];

  for (let i = 1; i < table.length; i += 1) {
    const rawRow = table[i];
    const getCell = (colIdx: number | null): string =>
      colIdx !== null && colIdx >= 0 && colIdx < rawRow.length
        ? (rawRow[colIdx] ?? '').trim()
        : '';

    const name = getCell(mapping.name).replace(/\s+/g, ' ');
    if (!name) continue;

    const committeeName = getCell(mapping.committee) || defaultCommittee;
    const phone = getCell(mapping.phone);
    const email = getCell(mapping.email);
    const role = getCell(mapping.role) || 'Member';
    const ptsRaw = getCell(mapping.points);
    const ptsNum = ptsRaw === '' ? 0 : Number(ptsRaw);
    const points = Number.isFinite(ptsNum) ? Math.trunc(ptsNum) : 0;

    rows.push({
      name,
      committeeName,
      phone,
      email,
      role,
      points,
    });
  }

  return rows;
}

class SheetProxyError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'SheetProxyError';
    this.retryable = retryable;
  }
}

async function readValidCsvBody(res: Response): Promise<string> {
  const text = await res.text();
  try {
    return assertValidCsvPayload(text);
  } catch (err) {
    throw new SheetProxyError(
      err instanceof Error ? err.message : PRIVATE_HTML_ERROR,
      false,
    );
  }
}

async function fetchSingleCsvTarget(targetUrl: string): Promise<string> {
  try {
    const proxyRes = await fetch(
      `/api/fetch-sheet?url=${encodeURIComponent(targetUrl)}`,
    );
    const isProxyResponse = proxyRes.headers.get('x-sheet-proxy') === '1';

    if (isProxyResponse) {
      if (proxyRes.ok) {
        return await readValidCsvBody(proxyRes);
      }

      const contentType = (proxyRes.headers.get('content-type') ?? '').toLowerCase();
      let message = `Could not fetch sheet (HTTP ${proxyRes.status}).`;
      if (contentType.includes('application/json')) {
        const body = (await proxyRes.json()) as { error?: string };
        if (body?.error) {
          message = body.error;
        }
      }
      throw new SheetProxyError(
        message,
        proxyRes.status === 404 || proxyRes.status >= 500,
      );
    }
  } catch (err) {
    if (err instanceof SheetProxyError) {
      throw err;
    }
    // Proxy unavailable in static hosting or dev server restart: fall through to direct fetch
  }

  let directRes: Response;
  try {
    directRes = await fetch(targetUrl);
  } catch {
    throw new SheetProxyError(NETWORK_FETCH_ERROR, true);
  }

  if (!directRes.ok) {
    if (directRes.status === 401 || directRes.status === 403) {
      throw new SheetProxyError(PRIVATE_HTML_ERROR, false);
    }
    if (directRes.status === 404) {
      throw new SheetProxyError(
        'Sheet not found — check the link and make sure the file is shared.',
        true,
      );
    }
    throw new SheetProxyError(
      `Could not fetch sheet (HTTP ${directRes.status}).`,
      directRes.status >= 500,
    );
  }

  return readValidCsvBody(directRes);
}

export async function fetchDriveCsv(rawUrl: string): Promise<string> {
  const resolved = resolveDriveCsvUrl(rawUrl);
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }

  try {
    return await fetchSingleCsvTarget(resolved.csvUrl);
  } catch (err) {
    if (
      resolved.fallbackCsvUrl &&
      !(err instanceof SheetProxyError && !err.retryable)
    ) {
      return await fetchSingleCsvTarget(resolved.fallbackCsvUrl);
    }
    throw err;
  }
}
