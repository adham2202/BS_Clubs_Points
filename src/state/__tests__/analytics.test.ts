import { describe, expect, it } from 'vitest';
import { createSeedState } from '../../data/seedData';
import { computeAnalytics } from '../analytics';
import { trackerReducer } from '../trackerReducer';

describe('Science Clubs Points — Analytics Engine', () => {
  it('computes overview statistics, mean, median, active rate, and top-20% share', () => {
    const seed = createSeedState();
    const report = computeAnalytics(seed, 'all', {
      attentionThreshold: 20,
      milestoneTarget: 50,
      clubGoal: 350,
      nowMs: Date.parse('2026-11-20T22:00:00.000Z'),
    });

    expect(report.overview.totalMembers).toBe(32);
    expect(report.overview.totalCommittees).toBe(12);
    expect(report.overview.totalPoints).toBe(277 + 295 + 294 + 278);
    expect(report.overview.activeRate).toBe(100);
    expect(report.overview.meanPoints).toBeCloseTo(1144 / 32, 4);
    expect(report.overview.medianPoints).toBe(36.5);
    expect(report.overview.minPoints).toBe(8);
    expect(report.overview.maxPoints).toBe(65);
    expect(report.overview.top20SharePercent).toBeGreaterThan(20);
    expect(report.overview.top20SharePercent).toBeLessThan(60);
    expect(report.overview.totalEvents).toBe(20);
    expect(report.overview.recent7dEvents).toBeGreaterThan(0);
  });

  it('computes club comparisons and goal gaps accurately', () => {
    const seed = createSeedState();
    const report = computeAnalytics(seed, 'all', {
      attentionThreshold: 20,
      milestoneTarget: 50,
      clubGoal: 300,
      nowMs: Date.parse('2026-11-20T22:00:00.000Z'),
    });

    const phys = report.clubComparisons.find((c) => c.club.id === 'physics')!;
    expect(phys.totalPoints).toBe(295);
    expect(phys.goalGap).toBe(5);
    expect(phys.goalProgressPercent).toBe(98);
    expect(phys.avgPoints).toBeCloseTo(295 / 8, 4);
  });

  it('produces 14-day daily timeline buckets with running cumulative totals', () => {
    const seed = createSeedState();
    const report = computeAnalytics(seed, 'all', {
      attentionThreshold: 20,
      milestoneTarget: 50,
      clubGoal: 350,
      nowMs: Date.parse('2026-11-20T22:00:00.000Z'),
    });

    expect(report.dailyTimeline).toHaveLength(14);
    expect(report.dailyTimeline[0].dateKey).toBe('2026-11-07');
    expect(report.dailyTimeline[13].dateKey).toBe('2026-11-20');

    const totalTimelineDelta = report.dailyTimeline.reduce((s, d) => s + d.totalDelta, 0);
    expect(report.dailyTimeline[13].cumulative).toBe(totalTimelineDelta);
    expect(report.dailyTimeline[13].totalDelta).toBe(25);
  });

  it('groups score distribution buckets, award reasons, roles, and milestones', () => {
    const seed = createSeedState();
    const report = computeAnalytics(seed, 'all', {
      attentionThreshold: 20,
      milestoneTarget: 50,
      clubGoal: 350,
      nowMs: Date.parse('2026-11-20T22:00:00.000Z'),
    });

    const bucketSum = report.distributionBuckets.reduce((s, b) => s + b.count, 0);
    expect(bucketSum).toBe(32);

    expect(report.reasonBreakdown.length).toBeGreaterThan(0);
    const reasonDeltaSum = report.reasonBreakdown.reduce((s, r) => s + r.totalDelta, 0);
    expect(reasonDeltaSum).toBe(
      seed.history.filter((e) => !e.reverted && e.delta > 0).reduce((s, e) => s + e.delta, 0),
    );

    expect(report.roleBreakdown.map((r) => r.role)).toContain('Chair');
    expect(report.needsAttention.every((m) => m.points < 20)).toBe(true);
    expect(report.needsAttention.map((m) => m.name)).toContain('Liam O’Connor');

    expect(report.milestoneStats.qualifyingMembers.every((m) => m.points >= 50)).toBe(true);
    expect(
      report.milestoneStats.almostThereMembers.every((m) => m.points >= 40 && m.points < 50),
    ).toBe(true);
  });

  it('computes tie-aware leaderboard ranks and excludes reverted events', () => {
    const seed = createSeedState();
    const withTie = trackerReducer(seed, {
      type: 'SET_MEMBER_POINTS',
      memberId: 'mem-phys-1',
      targetPoints: 65,
      reason: 'Matched top score',
    });
    const withReverted = trackerReducer(withTie, {
      type: 'ADJUST_POINTS',
      memberId: 'mem-bio-1',
      delta: 100,
      eventId: 'evt-to-revert',
      reason: 'Erroneous',
    });
    const finalState = trackerReducer(withReverted, {
      type: 'REVERT_EVENT',
      eventId: 'evt-to-revert',
    });

    const report = computeAnalytics(finalState, 'all', {
      attentionThreshold: 20,
      milestoneTarget: 50,
      clubGoal: 350,
    });

    expect(report.leaderboard[0].rank).toBe(1);
    expect(report.leaderboard[1].rank).toBe(1);
    expect(report.leaderboard[2].rank).toBe(3);
    expect(report.leaderboard[0].percentile).toBe(100);
  });
});
