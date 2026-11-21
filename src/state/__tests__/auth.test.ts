import { afterEach, describe, expect, it } from 'vitest';
import { createSeedState } from '../../data/seedData';
import {
  addManagersToList,
  cloneDefaultManagers,
  DEFAULT_PASSCODES,
  getSuggestedOfficers,
  isManagerAuthorized,
  loadManagers,
  MANAGERS_STORAGE_KEY,
  removeManagerFromList,
  resetManagers,
  saveManagers,
  verifyClubAccess,
  verifyClubLogin,
} from '../auth';

describe('Science Clubs Points — Club Login & Passcode Auth', () => {
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
  it('provides non-empty default passcodes for all four clubs and Administration', () => {
    expect(DEFAULT_PASSCODES.chemistry).toBe('CHEM-2026');
    expect(DEFAULT_PASSCODES.physics).toBe('PHYS-2026');
    expect(DEFAULT_PASSCODES.mathematics).toBe('MATH-2026');
    expect(DEFAULT_PASSCODES.biology).toBe('BIO-2026');
    expect(DEFAULT_PASSCODES.all).toBe('ADMIN-2026');
  });

  it('verifies passcodes case-insensitively with trimming and blocks wrong or cross-club codes', () => {
    expect(verifyClubLogin('chemistry', 'CHEM-2026', DEFAULT_PASSCODES)).toBe(true);
    expect(verifyClubLogin('chemistry', '  chem-2026  ', DEFAULT_PASSCODES)).toBe(true);
    expect(verifyClubLogin('physics', 'phys-2026', DEFAULT_PASSCODES)).toBe(true);
    expect(verifyClubLogin('mathematics', 'MATH-2026', DEFAULT_PASSCODES)).toBe(true);
    expect(verifyClubLogin('biology', 'bio-2026', DEFAULT_PASSCODES)).toBe(true);
    expect(verifyClubLogin('all', 'admin-2026', DEFAULT_PASSCODES)).toBe(true);

    // Reject cross-club, wrong, and empty codes
    expect(verifyClubLogin('chemistry', 'PHYS-2026', DEFAULT_PASSCODES)).toBe(false);
    expect(verifyClubLogin('mathematics', 'CHEM-2026', DEFAULT_PASSCODES)).toBe(false);
    expect(verifyClubLogin('physics', 'WRONG', DEFAULT_PASSCODES)).toBe(false);
    expect(verifyClubLogin('biology', '   ', DEFAULT_PASSCODES)).toBe(false);
  });

  it('suggests relevant club chairs and coordinators for each scope', () => {
    const seed = createSeedState();
    const chemOfficers = getSuggestedOfficers(seed, 'chemistry');
    expect(chemOfficers.length).toBeGreaterThanOrEqual(1);
    expect(chemOfficers).toContain('Nadia Farouk');

    const councilOfficers = getSuggestedOfficers(seed, 'all');
    expect(councilOfficers).toHaveLength(3);
  });

  it('adds and removes club managers cleanly without duplicates', () => {
    const added = addManagersToList([], 'Adham Mohamed, Reem Hitham\n  adham   mohamed , Sara Ali');
    expect(added).toEqual(['Adham Mohamed', 'Reem Hitham', 'Sara Ali']);

    const afterRemove = removeManagerFromList(added, 'reem hitham');
    expect(afterRemove).toEqual(['Adham Mohamed', 'Sara Ali']);
  });

  it('enforces both authorized manager name and club passcode on sign-in', () => {
    const managers = cloneDefaultManagers();

    // Empty club list allows any non-empty name with valid passcode
    expect(
      verifyClubAccess('chemistry', 'Anyone', 'CHEM-2026', DEFAULT_PASSCODES, managers),
    ).toEqual({ ok: true, canonicalName: 'Anyone' });

    managers.chemistry = ['Adham Mohamed', 'Reem Hitham'];

    // Authorized names (case/whitespace insensitive) + valid passcode succeed with canonical casing
    expect(
      verifyClubAccess(
        'chemistry',
        '  reem   hitham ',
        'chem-2026',
        DEFAULT_PASSCODES,
        managers,
      ),
    ).toEqual({ ok: true, canonicalName: 'Reem Hitham' });

    // Unauthorized name blocked even with valid passcode
    expect(
      verifyClubAccess('chemistry', 'Sara Ali', 'CHEM-2026', DEFAULT_PASSCODES, managers),
    ).toEqual({ ok: false, error: 'Not authorized for this club.' });

    // Authorized name blocked with wrong/cross-club passcode
    expect(
      verifyClubAccess('chemistry', 'Adham Mohamed', 'PHYS-2026', DEFAULT_PASSCODES, managers),
    ).toEqual({ ok: false, error: 'Invalid passcode.' });

    // Empty name blocked
    expect(
      verifyClubAccess('chemistry', '   ', 'CHEM-2026', DEFAULT_PASSCODES, managers),
    ).toEqual({ ok: false, error: 'Enter your name.' });

    // Administration still requires ADMIN-2026 and allows admin name
    expect(
      verifyClubAccess('all', 'Adham Mohamed', 'ADMIN-2026', DEFAULT_PASSCODES, managers),
    ).toEqual({ ok: true, canonicalName: 'Adham Mohamed' });
    expect(
      isManagerAuthorized('physics', 'Guest Officer', managers),
    ).toEqual({ allowed: true, canonicalName: 'Guest Officer' });
  });

  it('persists, sanitizes, and resets club manager assignments in localStorage', () => {
    installMockLocalStorage();
    const custom = cloneDefaultManagers();
    custom.chemistry = ['Adham Mohamed', 'Reem Hitham'];
    saveManagers(custom);

    const loaded = loadManagers();
    expect(loaded.chemistry).toEqual(['Adham Mohamed', 'Reem Hitham']);
    expect(loaded.physics).toEqual([]);

    installMockLocalStorage({
      [MANAGERS_STORAGE_KEY]: JSON.stringify({
        chemistry: ['  Adham   Mohamed ', '', 42, 'adham mohamed', 'Reem Hitham'],
        biology: 'invalid',
      }),
    });
    const sanitized = loadManagers();
    expect(sanitized.chemistry).toEqual(['Adham Mohamed', 'Reem Hitham']);
    expect(sanitized.biology).toEqual([]);

    const reset = resetManagers();
    expect(reset).toEqual(cloneDefaultManagers());
    expect(loadManagers()).toEqual(cloneDefaultManagers());
  });
});
