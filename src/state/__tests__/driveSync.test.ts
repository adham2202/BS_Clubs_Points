import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as fetchSheetHandler } from '../../../api/fetch-sheet';
import { createSeedState } from '../../data/seedData';
import {
  detectSheetColumns,
  EXCEL_BINARY_ERROR,
  extractSheetRows,
  fetchDriveCsv,
  loadDriveSources,
  NETWORK_FETCH_ERROR,
  parseCsvTable,
  PRIVATE_HTML_ERROR,
  resetDriveSources,
  resolveDriveCsvUrl,
  saveDriveSources,
} from '../driveSync';
import {
  addPointPreset,
  addReasonPreset,
  cloneDefaultClubPresets,
  loadPresets,
  removePointPreset,
  removeReasonPreset,
  resetPresets,
  savePresets,
} from '../presets';
import { trackerReducer } from '../trackerReducer';

describe('Science Clubs Points — Custom Presets & Google Drive / Sheet Sync', () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
    });
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function installMockLocalStorage(initial: Record<string, string> = {}) {
    const store = new Map<string, string>(Object.entries(initial));
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, val: string) => {
          store.set(key, val);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
      configurable: true,
    });
    return store;
  }

  it('adds, removes, persists, and resets per-club quick points and reason presets', () => {
    installMockLocalStorage();
    const defaults = cloneDefaultClubPresets();

    const addedPoints = addPointPreset(defaults.points, 15);
    expect(addedPoints).toContain(15);
    expect(addPointPreset(addedPoints, 0)).toBe(addedPoints);
    expect(addPointPreset(addedPoints, 15)).toBe(addedPoints);
    expect(removePointPreset(addedPoints, 10)).not.toContain(10);

    const addedReasons = addReasonPreset(defaults.reasons, '  Lab   Prep ');
    expect(addedReasons).toContain('Lab Prep');
    expect(addReasonPreset(addedReasons, 'lab prep')).toBe(addedReasons);
    expect(removeReasonPreset(addedReasons, 'workshop')).not.toContain('Workshop');

    const loaded = loadPresets();
    loaded.chemistry = { points: addedPoints, reasons: addedReasons };
    savePresets(loaded);

    const roundTrip = loadPresets();
    expect(roundTrip.chemistry.points).toContain(15);
    expect(roundTrip.chemistry.reasons).toContain('Lab Prep');
    expect(roundTrip.physics.points).toEqual(defaults.points);

    const afterReset = resetPresets();
    expect(afterReset.chemistry.points).toEqual(defaults.points);
  });

  it('resolves Google Sheets, Drive links, and rejects Google Forms URLs cleanly', () => {
    const sheetEdit = resolveDriveCsvUrl(
      'https://docs.google.com/spreadsheets/d/1AbCDefGHiJkLmNoPQrStUvWxYz/edit#gid=456',
    );
    expect(sheetEdit).toEqual({
      ok: true,
      csvUrl:
        'https://docs.google.com/spreadsheets/d/1AbCDefGHiJkLmNoPQrStUvWxYz/gviz/tq?tqx=out:csv&gid=456',
      fallbackCsvUrl:
        'https://docs.google.com/spreadsheets/d/1AbCDefGHiJkLmNoPQrStUvWxYz/export?format=csv&gid=456',
    });

    const pubSheet = resolveDriveCsvUrl(
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vTestSheetId/pubhtml?gid=0',
    );
    expect(pubSheet).toEqual({
      ok: true,
      csvUrl:
        'https://docs.google.com/spreadsheets/d/e/2PACX-1vTestSheetId/pub?output=csv&single=true&gid=0',
    });

    const driveFile = resolveDriveCsvUrl(
      'https://drive.google.com/file/d/1DriveFileId/view?usp=sharing',
    );
    expect(driveFile).toEqual({
      ok: true,
      csvUrl: 'https://drive.google.com/uc?export=download&id=1DriveFileId',
      fallbackCsvUrl:
        'https://docs.google.com/spreadsheets/d/1DriveFileId/export?format=csv',
    });

    const multiAccountSheet = resolveDriveCsvUrl(
      'https://docs.google.com/spreadsheets/u/0/d/1MultiAcctSheetId/edit?gid=789#gid=789',
    );
    expect(multiAccountSheet).toEqual({
      ok: true,
      csvUrl:
        'https://docs.google.com/spreadsheets/d/1MultiAcctSheetId/gviz/tq?tqx=out:csv&gid=789',
      fallbackCsvUrl:
        'https://docs.google.com/spreadsheets/d/1MultiAcctSheetId/export?format=csv&gid=789',
    });

    const multiAccountDriveFile = resolveDriveCsvUrl(
      'https://drive.google.com/file/u/1/d/1MultiDriveFileId/view',
    );
    expect(multiAccountDriveFile).toEqual({
      ok: true,
      csvUrl: 'https://drive.google.com/uc?export=download&id=1MultiDriveFileId',
      fallbackCsvUrl:
        'https://docs.google.com/spreadsheets/d/1MultiDriveFileId/export?format=csv',
    });

    const folderLink = resolveDriveCsvUrl(
      'https://drive.google.com/drive/u/0/folders/1FolderAbcDef',
    );
    expect(folderLink.ok).toBe(false);
    if (!folderLink.ok) {
      expect(folderLink.error).toContain('not a folder link');
    }

    const formLink = resolveDriveCsvUrl('https://docs.google.com/forms/d/e/1FAIpQLSc/viewform');
    expect(formLink.ok).toBe(false);
    if (!formLink.ok) {
      expect(formLink.error).toContain('Link to Sheets');
    }

    installMockLocalStorage();
    const sources = loadDriveSources();
    sources.chemistry = { url: 'https://docs.google.com/spreadsheets/d/1AbCD/edit', lastSyncedAt: null };
    saveDriveSources(sources);
    expect(loadDriveSources().chemistry.url).toContain('1AbCD');
    expect(resetDriveSources().chemistry.url).toBe('');
  });

  it('parses RFC-4180 CSV, rejects private HTML pages, detects Google Form headers, and extracts rows', () => {
    expect(() =>
      parseCsvTable('<!doctype html><html><body>accounts.google.com/ServiceLogin</body></html>'),
    ).toThrow(/private/i);

    const csv = [
      '\uFEFFTimestamp,Full Name,Committee,Phone Number,Email Address,Role,Points',
      '2026-11-21 10:00:00,"Alvarez, Hannah",Community Outreach,+20 111 319 5520,hannah@chem.edu,Member,10',
      '2026-11-21 10:05:00,Omar Nabil,Safety & Logistics,+20 100 999 1234,omar@chem.edu,Coordinator,25',
    ].join('\n');

    const table = parseCsvTable(csv);
    expect(table).toHaveLength(3);
    expect(table[1][1]).toBe('Alvarez, Hannah');

    const mapping = detectSheetColumns(table[0]);
    expect(mapping).toEqual({
      name: 1,
      committee: 2,
      phone: 3,
      email: 4,
      role: 5,
      points: 6,
    });

    const rows = extractSheetRows(table, mapping, 'General');
    expect(rows).toEqual([
      {
        name: 'Alvarez, Hannah',
        committeeName: 'Community Outreach',
        phone: '+20 111 319 5520',
        email: 'hannah@chem.edu',
        role: 'Member',
        points: 10,
      },
      {
        name: 'Omar Nabil',
        committeeName: 'Safety & Logistics',
        phone: '+20 100 999 1234',
        email: 'omar@chem.edu',
        role: 'Coordinator',
        points: 25,
      },
    ]);
  });

  it('syncs club sheet in merge and replace modes while preserving other clubs strictly', () => {
    const seed = createSeedState();
    const physCount = seed.members.filter((m) => m.clubId === 'physics').length;

    const merged = trackerReducer(seed, {
      type: 'SYNC_CLUB_SHEET',
      clubId: 'chemistry',
      mode: 'merge',
      rows: [
        // Existing Nadia matched by email: preserves her earned 54 pts and updates phone
        {
          name: 'Nadia Farouk',
          committeeName: 'Lab & Safety',
          phone: '+20 100 000 0001',
          email: 'nadia.farouk@science.edu',
          role: 'Member',
          points: 10,
        },
        // New member & new committee
        {
          name: 'Omar Nabil',
          committeeName: 'Safety & Logistics',
          phone: '+20 100 999 1234',
          email: 'omar@chem.edu',
          role: 'Member',
          points: 25,
        },
      ],
    });

    const nadia = merged.members.find((m) => m.id === 'mem-chem-1')!;
    expect(nadia.points).toBe(54);
    expect(nadia.role).toBe('Chair');
    expect(nadia.phone).toBe('+20 100 000 0001');

    const omar = merged.members.find((m) => m.name === 'Omar Nabil')!;
    expect(omar.clubId).toBe('chemistry');
    expect(omar.points).toBe(25);
    expect(merged.committees.some((c) => c.clubId === 'chemistry' && c.name === 'Safety & Logistics')).toBe(
      true,
    );
    expect(merged.members.filter((m) => m.clubId === 'physics')).toHaveLength(physCount);

    const replaced = trackerReducer(seed, {
      type: 'SYNC_CLUB_SHEET',
      clubId: 'chemistry',
      mode: 'replace',
      rows: [
        {
          name: 'Ziad Kamal',
          committeeName: 'Synthesis',
          phone: '+20 109 111 2222',
          email: 'ziad@chem.edu',
          points: 12,
        },
      ],
    });

    const replacedChem = replaced.members.filter((m) => m.clubId === 'chemistry');
    expect(replacedChem).toHaveLength(1);
    expect(replacedChem[0].name).toBe('Ziad Kamal');
    expect(replaced.members.filter((m) => m.clubId === 'physics')).toHaveLength(physCount);
  });

  it('handles proxy 200, proxy 403 fast-fail, Drive 404 fallback, and offline/CORS errors cleanly', async () => {
    // 1. Proxy 200 returns CSV directly in 1 fetch call
    const fetch200 = vi.fn(async () =>
      new Response('Full Name,Points\nNadia,10', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'X-Sheet-Proxy': '1',
        },
      }),
    );
    globalThis.fetch = fetch200 as unknown as typeof fetch;

    const okCsv = await fetchDriveCsv(
      'https://docs.google.com/spreadsheets/d/1ValidSheet/edit',
    );
    expect(okCsv).toContain('Nadia,10');
    expect(fetch200).toHaveBeenCalledTimes(1);

    // 2. Proxy 403 throws private-sheet error immediately without retry or direct Google call
    const fetch403 = vi.fn(async () =>
      new Response(JSON.stringify({ error: PRIVATE_HTML_ERROR }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Sheet-Proxy': '1',
        },
      }),
    );
    globalThis.fetch = fetch403 as unknown as typeof fetch;

    await expect(
      fetchDriveCsv('https://docs.google.com/spreadsheets/d/1PrivateSheet/edit'),
    ).rejects.toThrow(PRIVATE_HTML_ERROR);
    expect(fetch403).toHaveBeenCalledTimes(1);

    // 3. Proxy 404 on Drive uc?export=download retries fallbackCsvUrl and succeeds
    const fetchDriveFallback = vi.fn(async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes(encodeURIComponent('https://drive.google.com/uc?export=download&id=1DriveSheetId'))) {
        return new Response(JSON.stringify({ error: 'Sheet not found' }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'X-Sheet-Proxy': '1',
          },
        });
      }
      return new Response('Full Name,Points\nOmar,25', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'X-Sheet-Proxy': '1',
        },
      });
    });
    globalThis.fetch = fetchDriveFallback as unknown as typeof fetch;

    const fallbackCsv = await fetchDriveCsv(
      'https://drive.google.com/file/d/1DriveSheetId/view',
    );
    expect(fallbackCsv).toContain('Omar,25');
    expect(fetchDriveFallback).toHaveBeenCalledTimes(2);
    expect(String(fetchDriveFallback.mock.calls[1][0])).toContain(
      encodeURIComponent(
        'https://docs.google.com/spreadsheets/d/1DriveSheetId/export?format=csv',
      ),
    );

    // 4. Offline proxy + CORS-failing direct fetch surfaces clean NETWORK_FETCH_ERROR
    const fetchOffline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    globalThis.fetch = fetchOffline as unknown as typeof fetch;

    await expect(
      fetchDriveCsv('https://docs.google.com/spreadsheets/d/1OfflineSheet/edit'),
    ).rejects.toThrow(NETWORK_FETCH_ERROR);
  });

  it('validates hosts, private redirects, Excel binaries, 404s, and valid CSV in Vercel api/fetch-sheet', async () => {
    const blockedRes = await fetchSheetHandler(
      new Request('http://localhost/api/fetch-sheet?url=https://evil.example.com/data.csv'),
    );
    expect(blockedRes.status).toBe(400);
    expect(blockedRes.headers.get('X-Sheet-Proxy')).toBe('1');
    expect(blockedRes.headers.get('Cache-Control')).toBe('no-store');
    expect(((await blockedRes.json()) as { error: string }).error).toContain(
      'docs.google.com and drive.google.com',
    );

    globalThis.fetch = vi.fn(async () => {
      const res = new Response('<html>Sign in</html>', { status: 200 });
      Object.defineProperty(res, 'url', {
        value: 'https://accounts.google.com/v3/signin',
      });
      return res;
    }) as unknown as typeof fetch;
    const privateRes = await fetchSheetHandler(
      new Request(
        'http://localhost/api/fetch-sheet?url=' +
          encodeURIComponent('https://docs.google.com/spreadsheets/d/1Priv/gviz/tq?tqx=out:csv'),
      ),
    );
    expect(privateRes.status).toBe(403);
    expect(privateRes.headers.get('X-Sheet-Proxy')).toBe('1');
    expect(((await privateRes.json()) as { error: string }).error).toBe(
      PRIVATE_HTML_ERROR,
    );

    globalThis.fetch = vi.fn(
      async () =>
        new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]), {
          status: 200,
        }),
    ) as unknown as typeof fetch;
    const xlsxRes = await fetchSheetHandler(
      new Request(
        'http://localhost/api/fetch-sheet?url=' +
          encodeURIComponent('https://drive.google.com/uc?export=download&id=1XlsxFile'),
      ),
    );
    expect(xlsxRes.status).toBe(415);
    expect(((await xlsxRes.json()) as { error: string }).error).toBe(
      EXCEL_BINARY_ERROR,
    );

    globalThis.fetch = vi.fn(
      async () => new Response('Not Found', { status: 404 }),
    ) as unknown as typeof fetch;
    const notFoundRes = await fetchSheetHandler(
      new Request(
        'http://localhost/api/fetch-sheet?url=' +
          encodeURIComponent('https://docs.google.com/spreadsheets/d/1Missing/gviz/tq?tqx=out:csv'),
      ),
    );
    expect(notFoundRes.status).toBe(404);
    expect(((await notFoundRes.json()) as { error: string }).error).toContain(
      'Sheet not found',
    );

    globalThis.fetch = vi.fn(
      async () => new Response('Full Name,Points\nNadia,54', { status: 200 }),
    ) as unknown as typeof fetch;
    const validRes = await fetchSheetHandler(
      new Request(
        'http://localhost/api/fetch-sheet?url=' +
          encodeURIComponent('https://docs.google.com/spreadsheets/d/1Ok/gviz/tq?tqx=out:csv'),
      ),
    );
    expect(validRes.status).toBe(200);
    expect(validRes.headers.get('Content-Type')).toContain('text/csv');
    expect(validRes.headers.get('X-Sheet-Proxy')).toBe('1');
    expect(validRes.headers.get('Cache-Control')).toBe('no-store');
    expect(await validRes.text()).toBe('Full Name,Points\nNadia,54');
  });
});
