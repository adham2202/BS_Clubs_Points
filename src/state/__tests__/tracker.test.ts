import { describe, expect, it } from 'vitest';
import { createSeedState } from '../../data/seedData';
import {
  buildCommitteeSummaryCsv,
  buildCsv,
  buildMarkdownSummary,
  filterCommitteesAndMembers,
  getClubStats,
  parseBulkMembersInput,
  sortMembers,
} from '../selectors';
import { parseImportedJson } from '../storage';
import { trackerReducer } from '../trackerReducer';

describe('Science Clubs Points — Seed & State Logic', () => {
  it('provides starter committees and members for all four required clubs', () => {
    const seed = createSeedState();
    const summary = getClubStats(seed);

    expect(summary.byClub.map((c) => c.club.id)).toEqual([
      'chemistry',
      'physics',
      'mathematics',
      'biology',
    ]);
    for (const clubStat of summary.byClub) {
      expect(clubStat.committeeCount).toBeGreaterThanOrEqual(1);
      expect(clubStat.memberCount).toBeGreaterThanOrEqual(1);
      expect(clubStat.totalPoints).toBeGreaterThan(0);
    }
  });

  it('adjusts member points immutably, records history, and ignores zero delta', () => {
    const seed = createSeedState();
    const target = seed.members[0];

    const unchanged = trackerReducer(seed, {
      type: 'ADJUST_POINTS',
      memberId: target.id,
      delta: 0,
    });
    expect(unchanged).toBe(seed);

    const added = trackerReducer(seed, {
      type: 'ADJUST_POINTS',
      memberId: target.id,
      delta: 12,
      reason: 'Lab Olympiad',
      eventId: 'evt-test-1',
      timestamp: '2026-11-20T20:00:00.000Z',
    });

    const updatedMember = added.members.find((m) => m.id === target.id)!;
    expect(updatedMember.points).toBe(target.points + 12);
    expect(updatedMember.updatedAt).toBe('2026-11-20T20:00:00.000Z');
    expect(added.history[0]).toMatchObject({
      id: 'evt-test-1',
      memberId: target.id,
      delta: 12,
      previousPoints: target.points,
      newPoints: target.points + 12,
      reason: 'Lab Olympiad',
    });

    const deducted = trackerReducer(added, {
      type: 'ADJUST_POINTS',
      memberId: target.id,
      delta: -5,
      reason: 'Correction',
    });
    expect(deducted.members.find((m) => m.id === target.id)!.points).toBe(
      target.points + 7,
    );
  });

  it('reverts a point event once and ignores double revert', () => {
    const seed = createSeedState();
    const target = seed.members[0];

    const afterAdd = trackerReducer(seed, {
      type: 'ADJUST_POINTS',
      memberId: target.id,
      delta: 15,
      eventId: 'evt-revert-target',
      reason: 'Workshop',
    });

    const afterRevert = trackerReducer(afterAdd, {
      type: 'REVERT_EVENT',
      eventId: 'evt-revert-target',
    });
    expect(afterRevert.members.find((m) => m.id === target.id)!.points).toBe(
      target.points,
    );
    expect(afterRevert.history[0].reverted).toBe(true);

    const doubleRevert = trackerReducer(afterRevert, {
      type: 'REVERT_EVENT',
      eventId: 'evt-revert-target',
    });
    expect(doubleRevert).toBe(afterRevert);
  });

  it('adds, bulk-adds, updates, moves, and deletes members', () => {
    const seed = createSeedState();
    const chemCom = seed.committees.find((c) => c.clubId === 'chemistry')!;
    const physCom = seed.committees.find((c) => c.clubId === 'physics')!;

    const withSingle = trackerReducer(seed, {
      type: 'ADD_MEMBER',
      clubId: chemCom.clubId,
      committeeId: chemCom.id,
      name: 'Zayd Al-Mansoor',
      role: 'Coordinator',
      initialPoints: 10,
      id: 'mem-custom-1',
    });
    const addedMember = withSingle.members.find((m) => m.id === 'mem-custom-1')!;
    expect(addedMember.points).toBe(10);
    expect(addedMember.clubId).toBe('chemistry');
    expect(withSingle.history[0].reason).toBe('Initial points');

    const withBulk = trackerReducer(withSingle, {
      type: 'BULK_ADD_MEMBERS',
      clubId: chemCom.clubId,
      committeeId: chemCom.id,
      entries: [
        { name: 'Alice Lin', role: 'Member', initialPoints: 5 },
        { name: 'Bob Ortega', role: 'Chair', initialPoints: 0 },
      ],
    });
    expect(withBulk.members.length).toBe(withSingle.members.length + 2);

    const moved = trackerReducer(withBulk, {
      type: 'UPDATE_MEMBER',
      memberId: 'mem-custom-1',
      name: 'Zayd Al-Mansoor',
      role: 'Chair',
      clubId: 'physics',
      committeeId: physCom.id,
    });
    const movedMember = moved.members.find((m) => m.id === 'mem-custom-1')!;
    expect(movedMember.clubId).toBe('physics');
    expect(movedMember.committeeId).toBe(physCom.id);
    expect(movedMember.role).toBe('Chair');

    const deleted = trackerReducer(moved, {
      type: 'DELETE_MEMBER',
      memberId: 'mem-custom-1',
    });
    expect(deleted.members.some((m) => m.id === 'mem-custom-1')).toBe(false);
  });

  it('creates, updates (propagating club change), and deletes committees with their members', () => {
    const seed = createSeedState();

    const withCom = trackerReducer(seed, {
      type: 'ADD_COMMITTEE',
      clubId: 'biology',
      name: 'Botany Lab',
      description: 'Plant genetics',
      id: 'com-new-bio',
    });
    expect(withCom.committees.some((c) => c.id === 'com-new-bio')).toBe(true);

    const withMember = trackerReducer(withCom, {
      type: 'ADD_MEMBER',
      clubId: 'biology',
      committeeId: 'com-new-bio',
      name: 'Maya Test',
      id: 'mem-new-bio',
    });

    const movedCom = trackerReducer(withMember, {
      type: 'UPDATE_COMMITTEE',
      committeeId: 'com-new-bio',
      clubId: 'chemistry',
      name: 'Biochemistry Lab',
      description: 'Cross-club enzymes',
    });
    expect(movedCom.committees.find((c) => c.id === 'com-new-bio')!.clubId).toBe(
      'chemistry',
    );
    expect(movedCom.members.find((m) => m.id === 'mem-new-bio')!.clubId).toBe(
      'chemistry',
    );

    const removedCom = trackerReducer(movedCom, {
      type: 'DELETE_COMMITTEE',
      committeeId: 'com-new-bio',
    });
    expect(removedCom.committees.some((c) => c.id === 'com-new-bio')).toBe(false);
    expect(removedCom.members.some((m) => m.id === 'mem-new-bio')).toBe(false);
  });

  it('parses bulk member rows pasted from Excel or Google Sheets', () => {
    const input = [
      'Alice Johnson',
      'Bob Smith, Coordinator',
      'Carlos Diaz, 18',
      'Dana Kim\tChair\t25',
      '',
    ].join('\n');

    const parsed = parseBulkMembersInput(input);
    expect(parsed).toEqual([
      { name: 'Alice Johnson', role: 'Member', initialPoints: 0 },
      { name: 'Bob Smith', role: 'Coordinator', initialPoints: 0 },
      { name: 'Carlos Diaz', role: 'Member', initialPoints: 18 },
      { name: 'Dana Kim', role: 'Chair', initialPoints: 25 },
    ]);
  });

  it('builds RFC-4180 escaped CSV with UTF-8 BOM and respects club filters', () => {
    const seed = createSeedState();
    const withCommaName = trackerReducer(seed, {
      type: 'ADD_MEMBER',
      clubId: 'chemistry',
      committeeId: 'com-chem-lab',
      name: 'Doe, "Jane"',
      role: 'Member',
      initialPoints: 12,
    });

    const chemCsv = buildCsv(withCommaName, 'chemistry');
    expect(chemCsv.startsWith('\uFEFF')).toBe(true);
    expect(chemCsv).toContain('"Doe, ""Jane"""');
    expect(chemCsv).toContain('Chemistry,');
    expect(chemCsv).not.toContain('Physics,');
  });

  it('round-trips valid JSON backups and rejects invalid payloads', () => {
    const seed = createSeedState();
    const valid = parseImportedJson(JSON.stringify(seed));
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.state.members.length).toBe(seed.members.length);
    }

    expect(parseImportedJson('{bad json').ok).toBe(false);
    expect(parseImportedJson(JSON.stringify({ version: 2 })).ok).toBe(false);
  });

  it('filters committees/members by club and search query and sorts correctly', () => {
    const seed = createSeedState();

    const filteredChem = filterCommitteesAndMembers(
      seed,
      'chemistry',
      'Nadia',
      'points-desc',
    );
    expect(filteredChem).toHaveLength(1);
    expect(filteredChem[0].committees).toHaveLength(1);
    expect(filteredChem[0].committees[0].members.map((m) => m.name)).toEqual([
      'Nadia Farouk',
    ]);

    const sortedAsc = sortMembers(seed.members.slice(0, 4), 'name-asc');
    expect(sortedAsc.map((m) => m.name)).toEqual(
      seed.members
        .slice(0, 4)
        .map((m) => m.name)
        .sort((a, b) => a.localeCompare(b)),
    );

    const chairsOnly = filterCommitteesAndMembers(
      seed,
      'chemistry',
      '',
      'points-desc',
      'Chair',
    );
    const chairNames = chairsOnly[0].committees.flatMap((c) =>
      c.members.map((m) => m.role),
    );
    expect(chairNames.length).toBeGreaterThan(0);
    expect(chairNames.every((r) => r === 'Chair')).toBe(true);
  });

  it('batch-adjusts multiple members atomically and supports SET_MEMBER_POINTS', () => {
    const seed = createSeedState();
    const m1 = seed.members[0];
    const m2 = seed.members[1];

    const zeroBatch = trackerReducer(seed, {
      type: 'BATCH_ADJUST_POINTS',
      memberIds: [m1.id, m2.id],
      delta: 0,
    });
    expect(zeroBatch).toBe(seed);

    const batched = trackerReducer(seed, {
      type: 'BATCH_ADJUST_POINTS',
      memberIds: [m1.id, m2.id],
      delta: 5,
      reason: 'Group Lab',
    });
    expect(batched.members.find((m) => m.id === m1.id)!.points).toBe(m1.points + 5);
    expect(batched.members.find((m) => m.id === m2.id)!.points).toBe(m2.points + 5);
    expect(batched.history.length).toBe(seed.history.length + 2);
    expect(batched.history[0].reason).toBe('Group Lab');

    const exactNoOp = trackerReducer(batched, {
      type: 'SET_MEMBER_POINTS',
      memberId: m1.id,
      targetPoints: m1.points + 5,
    });
    expect(exactNoOp).toBe(batched);

    const setLower = trackerReducer(batched, {
      type: 'SET_MEMBER_POINTS',
      memberId: m1.id,
      targetPoints: 20,
      reason: 'Manual score edit',
    });
    expect(setLower.members.find((m) => m.id === m1.id)!.points).toBe(20);
    expect(setLower.history[0].delta).toBe(20 - (m1.points + 5));
  });

  it('generates committee summary CSV and markdown summary', () => {
    const seed = createSeedState();
    const summaryCsv = buildCommitteeSummaryCsv(seed);
    expect(summaryCsv.startsWith('\uFEFF')).toBe(true);
    expect(summaryCsv).toContain('Club,Committee,Members,Total Points,Avg Points/Member');
    expect(summaryCsv).toContain('Chemistry,Lab & Safety,3,118,39.3,Nadia Farouk,54');

    const md = buildMarkdownSummary(seed, 'physics');
    expect(md).toContain('## Physics Club — Points Summary');
    expect(md).toContain('Soren Lindqvist');

    const mathSummaryCsv = buildCommitteeSummaryCsv(seed, 'mathematics');
    expect(mathSummaryCsv).toContain('Mathematics,Olympiad Training');
    expect(mathSummaryCsv).not.toContain('Chemistry,');
    expect(mathSummaryCsv).not.toContain('Physics,');
    expect(mathSummaryCsv).not.toContain('Biology,');
  });

  it('isolates CLEAR_CLUB, RESET_CLUB_SEED, and IMPORT_CLUB_STATE strictly to target club', () => {
    const seed = createSeedState();
    const otherClubCount = seed.members.filter((m) => m.clubId !== 'mathematics').length;

    const clearedMath = trackerReducer(seed, {
      type: 'CLEAR_CLUB',
      clubId: 'mathematics',
    });
    expect(clearedMath.members.filter((m) => m.clubId === 'mathematics')).toHaveLength(0);
    expect(clearedMath.committees.filter((c) => c.clubId === 'mathematics')).toHaveLength(0);
    expect(clearedMath.history.filter((e) => e.clubId === 'mathematics')).toHaveLength(0);
    expect(clearedMath.members.filter((m) => m.clubId !== 'mathematics')).toHaveLength(
      otherClubCount,
    );

    const resetMath = trackerReducer(clearedMath, {
      type: 'RESET_CLUB_SEED',
      clubId: 'mathematics',
    });
    expect(resetMath.members.filter((m) => m.clubId === 'mathematics').length).toBe(
      seed.members.filter((m) => m.clubId === 'mathematics').length,
    );
    expect(resetMath.members.filter((m) => m.clubId !== 'mathematics')).toHaveLength(
      otherClubCount,
    );

    const importedMath = trackerReducer(clearedMath, {
      type: 'IMPORT_CLUB_STATE',
      clubId: 'mathematics',
      state: seed,
    });
    expect(importedMath.members.filter((m) => m.clubId === 'mathematics').length).toBe(
      seed.members.filter((m) => m.clubId === 'mathematics').length,
    );
    expect(importedMath.members.filter((m) => m.clubId !== 'mathematics')).toHaveLength(
      otherClubCount,
    );
  });

  it('stores, updates, searches, exports, and bulk-parses phone, email, and custom points', () => {
    const seed = createSeedState();
    const chemCom = seed.committees.find((c) => c.clubId === 'chemistry')!;

    // Add member with phone, email, and starting points
    const addedState = trackerReducer(seed, {
      type: 'ADD_MEMBER',
      clubId: 'chemistry',
      committeeId: chemCom.id,
      name: 'Omar Nabil',
      role: 'Member',
      phone: '+20 100 999 1234',
      email: 'omar@chem.edu',
      initialPoints: 25,
      id: 'mem-omar',
    });
    const added = addedState.members.find((m) => m.id === 'mem-omar')!;
    expect(added.phone).toBe('+20 100 999 1234');
    expect(added.email).toBe('omar@chem.edu');
    expect(added.points).toBe(25);

    // Search by phone and email
    const byPhone = filterCommitteesAndMembers(addedState, 'chemistry', '999 1234', 'points-desc');
    expect(byPhone[0].committees.flatMap((c) => c.members).map((m) => m.id)).toEqual(['mem-omar']);
    const byEmail = filterCommitteesAndMembers(addedState, 'chemistry', 'omar@chem.edu', 'points-desc');
    expect(byEmail[0].committees.flatMap((c) => c.members).map((m) => m.id)).toEqual(['mem-omar']);

    // Edit phone, email, and custom points (records history delta)
    const editedState = trackerReducer(addedState, {
      type: 'UPDATE_MEMBER',
      memberId: 'mem-omar',
      clubId: 'chemistry',
      committeeId: chemCom.id,
      name: 'Omar Nabil',
      role: 'Coordinator',
      phone: '+20 101 000 4321',
      email: 'omar.nabil@science.edu',
      points: 40,
    });
    const edited = editedState.members.find((m) => m.id === 'mem-omar')!;
    expect(edited.phone).toBe('+20 101 000 4321');
    expect(edited.email).toBe('omar.nabil@science.edu');
    expect(edited.points).toBe(40);
    expect(editedState.history[0]).toMatchObject({
      memberId: 'mem-omar',
      delta: 15,
      previousPoints: 25,
      newPoints: 40,
      reason: 'Manual score edit',
    });

    // Smart bulk paste with phone, email, points, role
    const bulkParsed = parseBulkMembersInput(
      [
        'Laila Hassan, +20 100 123 4567, laila@bio.edu, 30',
        'Karim Adel\t01001234567\tkarim@phys.edu\tChair\t15',
      ].join('\n'),
    );
    expect(bulkParsed).toEqual([
      {
        name: 'Laila Hassan',
        role: 'Member',
        phone: '+20 100 123 4567',
        email: 'laila@bio.edu',
        initialPoints: 30,
      },
      {
        name: 'Karim Adel',
        role: 'Chair',
        phone: '01001234567',
        email: 'karim@phys.edu',
        initialPoints: 15,
      },
    ]);

    // CSV includes Phone and Email columns
    const csv = buildCsv(editedState, 'chemistry');
    expect(csv).toContain('Club,Committee,Member Name,Phone,Email,Role,Points,Last Updated');
    expect(csv).toContain('omar.nabil@science.edu');
    expect(csv).toContain('+20 101 000 4321');

    // JSON round-trip with contact-enabled and legacy members
    const roundTrip = parseImportedJson(JSON.stringify(editedState));
    expect(roundTrip.ok).toBe(true);
    const legacyParse = parseImportedJson(
      JSON.stringify({
        version: 1,
        committees: [chemCom],
        members: [
          {
            id: 'mem-legacy',
            clubId: 'chemistry',
            committeeId: chemCom.id,
            name: 'Legacy User',
            role: 'Member',
            points: 10,
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
          },
        ],
        history: [],
      }),
    );
    expect(legacyParse.ok).toBe(true);
  });
});
