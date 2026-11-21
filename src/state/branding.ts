import { CLUBS } from '../data/clubs';
import type { ClubId } from '../types/tracker';

export interface ClubBranding {
  name: string;
  logoDataUrl: string | null;
}

export interface BrandingConfig {
  registryTitle: string;
  registryLogoDataUrl: string | null;
  clubs: Record<ClubId, ClubBranding>;
}

export const BRANDING_STORAGE_KEY = 'science_clubs_branding_v1';

export const DEFAULT_BRANDING: BrandingConfig = {
  registryTitle: 'Science Clubs',
  registryLogoDataUrl: null,
  clubs: {
    chemistry: { name: CLUBS[0].name, logoDataUrl: null },
    physics: { name: CLUBS[1].name, logoDataUrl: null },
    mathematics: { name: CLUBS[2].name, logoDataUrl: null },
    biology: { name: CLUBS[3].name, logoDataUrl: null },
  },
};

function sanitizeClubBranding(
  raw: unknown,
  fallback: ClubBranding,
): ClubBranding {
  if (!raw || typeof raw !== 'object') {
    return { ...fallback };
  }
  const item = raw as Record<string, unknown>;
  const name =
    typeof item.name === 'string' && item.name.trim().length > 0
      ? item.name.trim()
      : fallback.name;
  const logoDataUrl =
    typeof item.logoDataUrl === 'string' && item.logoDataUrl.startsWith('data:image/')
      ? item.logoDataUrl
      : null;

  return { name, logoDataUrl };
}

export function cloneDefaultBranding(): BrandingConfig {
  return {
    registryTitle: DEFAULT_BRANDING.registryTitle,
    registryLogoDataUrl: DEFAULT_BRANDING.registryLogoDataUrl,
    clubs: {
      chemistry: { ...DEFAULT_BRANDING.clubs.chemistry },
      physics: { ...DEFAULT_BRANDING.clubs.physics },
      mathematics: { ...DEFAULT_BRANDING.clubs.mathematics },
      biology: { ...DEFAULT_BRANDING.clubs.biology },
    },
  };
}

export function loadBranding(): BrandingConfig {
  try {
    const raw = globalThis.localStorage?.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return cloneDefaultBranding();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return cloneDefaultBranding();

    const registryTitle =
      typeof parsed.registryTitle === 'string' && parsed.registryTitle.trim().length > 0
        ? parsed.registryTitle.trim()
        : DEFAULT_BRANDING.registryTitle;
    const registryLogoDataUrl =
      typeof parsed.registryLogoDataUrl === 'string' &&
      parsed.registryLogoDataUrl.startsWith('data:image/')
        ? parsed.registryLogoDataUrl
        : null;

    const rawClubs =
      parsed.clubs && typeof parsed.clubs === 'object'
        ? (parsed.clubs as Record<string, unknown>)
        : {};

    return {
      registryTitle,
      registryLogoDataUrl,
      clubs: {
        chemistry: sanitizeClubBranding(
          rawClubs.chemistry,
          DEFAULT_BRANDING.clubs.chemistry,
        ),
        physics: sanitizeClubBranding(rawClubs.physics, DEFAULT_BRANDING.clubs.physics),
        mathematics: sanitizeClubBranding(
          rawClubs.mathematics,
          DEFAULT_BRANDING.clubs.mathematics,
        ),
        biology: sanitizeClubBranding(rawClubs.biology, DEFAULT_BRANDING.clubs.biology),
      },
    };
  } catch {
    return cloneDefaultBranding();
  }
}

export function saveBranding(config: BrandingConfig): void {
  try {
    globalThis.localStorage?.setItem(BRANDING_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota or privacy restrictions
  }
}

export function resetBranding(): BrandingConfig {
  const fresh = cloneDefaultBranding();
  saveBranding(fresh);
  return fresh;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
    img.src = src;
  });
}

export async function processLogoFile(file: File, maxSize = 256): Promise<string> {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Select a valid image file (PNG, JPG, WebP, or SVG).');
  }

  if (file.type === 'image/svg+xml') {
    if (file.size > 200 * 1024) {
      throw new Error('SVG file must be under 200 KB.');
    }
    return readFileAsDataUrl(file);
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadHtmlImage(rawDataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = maxSize;
  canvas.height = maxSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return rawDataUrl;
  }

  const srcSize = Math.min(img.width, img.height);
  const sx = Math.max(0, (img.width - srcSize) / 2);
  const sy = Math.max(0, (img.height - srcSize) / 2);
  ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, maxSize, maxSize);

  return canvas.toDataURL('image/png', 0.92);
}
