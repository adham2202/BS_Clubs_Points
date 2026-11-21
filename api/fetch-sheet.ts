const PRIVATE_SHEET_ERROR =
  'Sheet is private — set sharing to "Anyone with the link (Viewer)", or upload its CSV.';
const EXCEL_FILE_ERROR =
  'This Drive file is an Excel (.xlsx) file — open it in Google Sheets and share its Sheet link, or upload a CSV.';

function jsonResponse(
  status: number,
  payload: Record<string, string>,
): Response {
  return Response.json(payload, {
    status,
    headers: {
      'X-Sheet-Proxy': '1',
      'Cache-Control': 'no-store',
    },
  });
}

async function fetchUpstreamOnce(targetUrl: string): Promise<Response> {
  return fetch(targetUrl, {
    redirect: 'follow',
    headers: { Accept: 'text/csv, text/plain, */*' },
    signal: AbortSignal.timeout(15000),
  });
}

async function fetchUpstreamResponse(targetUrl: string): Promise<Response> {
  try {
    return await fetchUpstreamOnce(targetUrl);
  } catch {
    return await fetchUpstreamOnce(targetUrl);
  }
}

export async function GET(request: Request): Promise<Response> {
  let parsedTarget: URL;
  try {
    const reqUrl = new URL(request.url);
    const rawTarget = reqUrl.searchParams.get('url') ?? '';
    parsedTarget = new URL(rawTarget);
  } catch {
    return jsonResponse(400, {
      error: 'Only docs.google.com and drive.google.com URLs are allowed.',
    });
  }

  const host = parsedTarget.hostname.toLowerCase();
  if (
    parsedTarget.protocol !== 'https:' ||
    (host !== 'docs.google.com' && host !== 'drive.google.com')
  ) {
    return jsonResponse(400, {
      error: 'Only docs.google.com and drive.google.com URLs are allowed.',
    });
  }

  try {
    const upstream = await fetchUpstreamResponse(parsedTarget.toString());
    const finalHost = new URL(
      upstream.url || parsedTarget.toString(),
    ).hostname.toLowerCase();

    if (finalHost === 'accounts.google.com') {
      return jsonResponse(403, { error: PRIVATE_SHEET_ERROR });
    }

    if (
      finalHost !== 'docs.google.com' &&
      finalHost !== 'drive.google.com' &&
      !finalHost.endsWith('.google.com') &&
      !finalHost.endsWith('.googleusercontent.com')
    ) {
      return jsonResponse(400, { error: 'Unexpected redirect host.' });
    }

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    const upstreamCt = (
      upstream.headers.get('content-type') ?? ''
    ).toLowerCase();

    const isZipOrExcel =
      (bytes.length >= 4 &&
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        bytes[2] === 0x03 &&
        bytes[3] === 0x04) ||
      upstreamCt.includes('spreadsheetml');

    if (isZipOrExcel) {
      return jsonResponse(415, { error: EXCEL_FILE_ERROR });
    }

    if (upstream.status === 401 || upstream.status === 403) {
      return jsonResponse(403, { error: PRIVATE_SHEET_ERROR });
    }

    if (upstream.status === 404) {
      return jsonResponse(404, {
        error:
          'Sheet not found — check the link and make sure the file is shared.',
      });
    }

    if (!upstream.ok) {
      return jsonResponse(upstream.status, {
        error: `Could not load sheet from Google (HTTP ${upstream.status}).`,
      });
    }

    const text = new TextDecoder('utf-8').decode(bytes);
    const head = text.replace(/^\uFEFF/, '').trimStart();
    if (
      /^<!doctype\s+html/i.test(head) ||
      /^<html[\s>]/i.test(head) ||
      head.includes('accounts.google.com/ServiceLogin')
    ) {
      return jsonResponse(403, { error: PRIVATE_SHEET_ERROR });
    }

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'X-Sheet-Proxy': '1',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[api/fetch-sheet] upstream error', err);
    return jsonResponse(502, {
      error:
        'Could not reach Google Drive right now — check your internet connection and try again, or use Upload CSV.',
    });
  }
}
