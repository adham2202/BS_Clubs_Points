import { afterEach, describe, expect, it } from 'vitest';
import {
  BRANDING_STORAGE_KEY,
  cloneDefaultBranding,
  DEFAULT_BRANDING,
  loadBranding,
  resetBranding,
  saveBranding,
} from '../branding';

describe('Science Clubs Points — Branding & Logo Config', () => {
  const originalLocalStorage = globalThis.localStorage;

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
    });
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

  it('provides clean default names and null logos for registry and all four clubs', () => {
    expect(DEFAULT_BRANDING.registryTitle).toBe('Science Clubs');
    expect(DEFAULT_BRANDING.registryLogoDataUrl).toBeNull();
    expect(DEFAULT_BRANDING.clubs.chemistry.name).toBe('Chemistry');
    expect(DEFAULT_BRANDING.clubs.physics.name).toBe('Physics');
    expect(DEFAULT_BRANDING.clubs.mathematics.name).toBe('Mathematics');
    expect(DEFAULT_BRANDING.clubs.biology.name).toBe('Biology');
  });

  it('round-trips custom club names and image data URLs in localStorage', () => {
    installMockLocalStorage();
    const custom = cloneDefaultBranding();
    custom.registryTitle = 'Faculty Science Union';
    custom.clubs.mathematics = {
      name: 'Applied Math Society',
      logoDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    };

    saveBranding(custom);
    const loaded = loadBranding();

    expect(loaded.registryTitle).toBe('Faculty Science Union');
    expect(loaded.clubs.mathematics.name).toBe('Applied Math Society');
    expect(loaded.clubs.mathematics.logoDataUrl).toBe(
      'data:image/png;base64,iVBORw0KGgo=',
    );
    expect(loaded.clubs.chemistry.name).toBe('Chemistry');
    expect(loaded.clubs.chemistry.logoDataUrl).toBeNull();

    const afterReset = resetBranding();
    expect(afterReset).toEqual(DEFAULT_BRANDING);
  });

  it('falls back safely on corrupted JSON or non-image data URLs', () => {
    installMockLocalStorage({ [BRANDING_STORAGE_KEY]: '{broken' });
    expect(loadBranding()).toEqual(DEFAULT_BRANDING);

    installMockLocalStorage({
      [BRANDING_STORAGE_KEY]: JSON.stringify({
        registryTitle: '',
        registryLogoDataUrl: 'javascript:alert(1)',
        clubs: {
          chemistry: { name: '  Chem Society  ', logoDataUrl: 'http://evil.example/a.png' },
        },
      }),
    });
    const sanitized = loadBranding();
    expect(sanitized.registryTitle).toBe('Science Clubs');
    expect(sanitized.registryLogoDataUrl).toBeNull();
    expect(sanitized.clubs.chemistry.name).toBe('Chem Society');
    expect(sanitized.clubs.chemistry.logoDataUrl).toBeNull();
  });
});
