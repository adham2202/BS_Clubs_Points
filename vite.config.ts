import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const PRIVATE_SHEET_ERROR =
  'Sheet is private — set sharing to "Anyone with the link (Viewer)", or upload its CSV.';
const EXCEL_FILE_ERROR =
  'This Drive file is an Excel (.xlsx) file — open it in Google Sheets and share its Sheet link, or upload a CSV.';

function sendJson(
  res: {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
    end: (chunk: string) => void;
  },
  statusCode: number,
  payload: Record<string, string>,
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
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

function googleSheetsProxyPlugin(): Plugin {
  return {
    name: 'google-sheets-proxy',
    configureServer(server) {
      attachGoogleSheetsProxy(server.middlewares);
    },
    configurePreviewServer(server) {
      attachGoogleSheetsProxy(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), googleSheetsProxyPlugin()],
});
