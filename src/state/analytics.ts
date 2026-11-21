import { CLUBS, CLUB_MAP } from '../data/clubs';
import type {
  AppState,
  ClubFilter,
  ClubId,
  ClubMeta,
  Committee,
  Member,
} from '../types/tracker';

export interface AnalyticsOptions {
  attentionThreshold: number;
  milestoneTarget: number;
  clubGoal: number;
  nowMs?: number;
}

export interface AnalyticsOverview {
  totalPoints: number;
  totalMembers: number;
  totalCommittees: number;
  meanPoints: number;
  medianPoints: number;
  minPoints: number;
  maxPoints: number;
  activeRate: number;
  top20SharePercent: number;
  recent7dPoints: number;
  recent7dEvents: number;
  totalEvents: number;
  avgAwardSize: number;
  leadingCommittee: {
    committee: Committee;
    club: ClubMeta;
    totalPoints: number;
    avgPoints: number;
  } | null;
}

export interface ClubComparisonItem {
  club: ClubMeta;
  totalPoints: number;
  avgPoints: number;
  medianPoints: number;
  memberCount: number;
  committeeCount: number;
  sharePercent: number;
  goalGap: number;
  goalProgressPercent: number;
}

export interface CommitteeBenchmarkItem {
  committee: Committee;
  club: ClubMeta;
  memberCount: number;
  totalPoints: number;
  avgPoints: number;
  topMember: Member | null;
  shareOfScope: number;
}

export interface DailyTimelinePoint {
  dateKey: string;
  label: string;
  totalDelta: number;
  eventCount: number;
  byClub: Record<ClubId, number>;
  cumulative: number;
}

export interface DistributionBucket {
  id: string;
  label: string;
  count: number;
  percent: number;
  members: Member[];
}

export interface ReasonBreakdownItem {
  reason: string;
  totalDelta: number;
  eventCount: number;
  sharePercent: number;
  color: string;
}

export interface RoleBreakdownItem {
  role: string;
  memberCount: number;
  totalPoints: number;
  avgPoints: number;
  sharePercent: number;
}

export interface LeaderboardEntry {
  rank: number;
  member: Member;
  club: ClubMeta;
  committeeName: string;
  percentile: number;
  clubSharePercent: number;
}

export interface AnalyticsReport {
  overview: AnalyticsOverview;
  clubComparisons: ClubComparisonItem[];
  committeeBenchmarks: CommitteeBenchmarkItem[];
  dailyTimeline: DailyTimelinePoint[];
  distributionBuckets: DistributionBucket[];
  reasonBreakdown: ReasonBreakdownItem[];
  roleBreakdown: RoleBreakdownItem[];
  needsAttention: Member[];
  milestoneStats: {
    qualifyingMembers: Member[];
    almostThereMembers: Member[];
    qualifyingRate: number;
  };
  leaderboard: LeaderboardEntry[];
}

const REASON_PALETTE = [
  '#0E6B5E',
  '#234B8E',
  '#B45309',
  '#3F6A2E',
  '#7C2D12',
  '#57534E',
  '#9A8F82',
] as const;

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function normalizeReasonCategory(rawReason: string): string {
  const trimmed = rawReason.trim();
  if (!trimmed) return 'Quick adjustment';

  if (/tutor|mentoring|peer/i.test(trimmed)) return 'Peer Tutoring';
  if (/olympiad|competition|contest|qualifier|mock/i.test(trimmed)) {
    return 'Competitions & Olympiad';
  }
  if (/workshop|lab|pcr|titration|calibration|rig|staining|optics|soil|safety/i.test(trimmed)) {
    return 'Labs & Workshops';
  }
  if (/outreach|fair|survey|observation|alumni|panel|seminar|colloquium|journal|digest/i.test(trimmed)) {
    return 'Outreach & Seminars';
  }
  if (/attendance|meeting|monthly/i.test(trimmed)) return 'Attendance & Operations';
  if (/leadership|chair/i.test(trimmed)) return 'Leadership';
  return trimmed;
}

function formatShortDay(utcDate: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[utcDate.getUTCMonth()]} ${utcDate.getUTCDate()}`;
}

export function computeAnalytics(
  state: AppState,
  scope: ClubFilter,
  options: AnalyticsOptions,
): AnalyticsReport {
  const scopedCommittees = state.committees.filter(
    (c) => scope === 'all' || c.clubId === scope,
  );
  const scopedMembers = state.members.filter(
    (m) => scope === 'all' || m.clubId === scope,
  );
  const scopedEvents = state.history.filter(
    (e) => !e.reverted && (scope === 'all' || e.clubId === scope),
  );

  const committeeById = new Map(state.committees.map((c) => [c.id, c]));
  const totalPoints = scopedMembers.reduce((sum, m) => sum + m.points, 0);
  const memberCount = scopedMembers.length;
  const pointValues = scopedMembers.map((m) => m.points);

  const meanPoints = memberCount > 0 ? totalPoints / memberCount : 0;
  const medianPoints = computeMedian(pointValues);
  const minPoints = memberCount > 0 ? Math.min(...pointValues) : 0;
  const maxPoints = memberCount > 0 ? Math.max(...pointValues) : 0;
  const activeCount = scopedMembers.filter((m) => m.points > 0).length;
  const activeRate = memberCount > 0 ? Math.round((activeCount / memberCount) * 100) : 0;

  // Top 20% concentration share
  const sortedDesc = scopedMembers
    .slice()
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const top20Count = memberCount > 0 ? Math.max(1, Math.ceil(memberCount * 0.2)) : 0;
  const top20Sum = sortedDesc
    .slice(0, top20Count)
    .reduce((sum, m) => sum + Math.max(0, m.points), 0);
  const positiveScopeSum = scopedMembers.reduce((sum, m) => sum + Math.max(0, m.points), 0);
  const top20SharePercent =
    positiveScopeSum > 0 ? Math.round((top20Sum / positiveScopeSum) * 100) : 0;

  // Club comparisons (always across all 4 clubs so cross-club benchmarking stays visible)
  const allPositiveClubSum = CLUBS.reduce((sum, club) => {
    const pts = state.members
      .filter((m) => m.clubId === club.id)
      .reduce((s, m) => s + m.points, 0);
    return sum + Math.max(0, pts);
  }, 0);

  const clubTotalsMap = new Map<ClubId, number>();
  const clubComparisons: ClubComparisonItem[] = CLUBS.map((club) => {
    const clubMembers = state.members.filter((m) => m.clubId === club.id);
    const clubCommittees = state.committees.filter((c) => c.clubId === club.id);
    const clubTotal = clubMembers.reduce((sum, m) => sum + m.points, 0);
    clubTotalsMap.set(club.id, clubTotal);
    const clubAvg = clubMembers.length > 0 ? clubTotal / clubMembers.length : 0;
    const clubMedian = computeMedian(clubMembers.map((m) => m.points));
    const sharePercent =
      allPositiveClubSum > 0
        ? Math.round((Math.max(0, clubTotal) / allPositiveClubSum) * 100)
        : 0;
    const goal = Math.max(1, options.clubGoal);
    const goalGap = Math.max(0, goal - clubTotal);
    const goalProgressPercent = Math.min(100, Math.max(0, Math.round((clubTotal / goal) * 100)));

    return {
      club,
      totalPoints: clubTotal,
      avgPoints: clubAvg,
      medianPoints: clubMedian,
      memberCount: clubMembers.length,
      committeeCount: clubCommittees.length,
      sharePercent,
      goalGap,
      goalProgressPercent,
    };
  });

  // Committee benchmarks in scope
  const committeeBenchmarks: CommitteeBenchmarkItem[] = scopedCommittees
    .map((committee) => {
      const members = scopedMembers.filter((m) => m.committeeId === committee.id);
      const comTotal = members.reduce((sum, m) => sum + m.points, 0);
      const sorted = members
        .slice()
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
      return {
        committee,
        club: CLUB_MAP[committee.clubId],
        memberCount: members.length,
        totalPoints: comTotal,
        avgPoints: members.length > 0 ? comTotal / members.length : 0,
        topMember: sorted[0] ?? null,
        shareOfScope:
          positiveScopeSum > 0
            ? Math.round((Math.max(0, comTotal) / positiveScopeSum) * 100)
            : 0,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || a.committee.name.localeCompare(b.committee.name));

  const leadingCommittee =
    committeeBenchmarks.length > 0
      ? {
          committee: committeeBenchmarks[0].committee,
          club: committeeBenchmarks[0].club,
          totalPoints: committeeBenchmarks[0].totalPoints,
          avgPoints: committeeBenchmarks[0].avgPoints,
        }
      : null;

  // 14-day timeline anchored on max(now, latestEvent) when nowMs omitted
  let latestEventMs = 0;
  for (const evt of scopedEvents) {
    const t = Date.parse(evt.timestamp);
    if (Number.isFinite(t) && t > latestEventMs) {
      latestEventMs = t;
    }
  }
  const anchorMs = options.nowMs ?? Math.max(Date.now(), latestEventMs);
  const anchorDate = new Date(anchorMs);
  const anchorDayStartUtc = Date.UTC(
    anchorDate.getUTCFullYear(),
    anchorDate.getUTCMonth(),
    anchorDate.getUTCDate(),
  );
  const dayMs = 24 * 60 * 60 * 1000;

  const dayBuckets = new Map<
    string,
    { totalDelta: number; eventCount: number; byClub: Record<ClubId, number> }
  >();
  const dayOrder: Array<{ key: string; label: string }> = [];

  for (let offset = 13; offset >= 0; offset--) {
    const d = new Date(anchorDayStartUtc - offset * dayMs);
    const key = d.toISOString().slice(0, 10);
    dayOrder.push({ key, label: formatShortDay(d) });
    dayBuckets.set(key, {
      totalDelta: 0,
      eventCount: 0,
      byClub: { chemistry: 0, physics: 0, mathematics: 0, biology: 0 },
    });
  }

  const sevenDayCutoffMs = anchorDayStartUtc - 6 * dayMs;
  const anchorWindowEndMs = anchorDayStartUtc + dayMs - 1;
  let recent7dPoints = 0;
  let recent7dEvents = 0;

  for (const evt of scopedEvents) {
    const ts = Date.parse(evt.timestamp);
    if (!Number.isFinite(ts)) continue;
    const key = new Date(ts).toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key);
    if (bucket) {
      bucket.totalDelta += evt.delta;
      bucket.eventCount += 1;
      bucket.byClub[evt.clubId] += evt.delta;
    }
    if (ts >= sevenDayCutoffMs && ts <= anchorWindowEndMs) {
      recent7dPoints += evt.delta;
      recent7dEvents += 1;
    }
  }

  let runningCumulative = 0;
  const dailyTimeline: DailyTimelinePoint[] = dayOrder.map(({ key, label }) => {
    const bucket = dayBuckets.get(key)!;
    runningCumulative += bucket.totalDelta;
    return {
      dateKey: key,
      label,
      totalDelta: bucket.totalDelta,
      eventCount: bucket.eventCount,
      byClub: bucket.byClub,
      cumulative: runningCumulative,
    };
  });

  const totalEvents = scopedEvents.length;
  const sumEventDelta = scopedEvents.reduce((sum, e) => sum + e.delta, 0);
  const avgAwardSize = totalEvents > 0 ? sumEventDelta / totalEvents : 0;

  // Score distribution histogram (5 tiers)
  const bucketDefs: Array<{ id: string; label: string; test: (pts: number) => boolean }> = [
    { id: 'zero', label: '0 pts', test: (p) => p <= 0 },
    { id: 't1', label: '1–19', test: (p) => p >= 1 && p <= 19 },
    { id: 't2', label: '20–39', test: (p) => p >= 20 && p <= 39 },
    { id: 't3', label: '40–59', test: (p) => p >= 40 && p <= 59 },
    { id: 't4', label: '60+', test: (p) => p >= 60 },
  ];

  const distributionBuckets: DistributionBucket[] = bucketDefs.map((def) => {
    const members = sortedDesc.filter((m) => def.test(m.points));
    return {
      id: def.id,
      label: def.label,
      count: members.length,
      percent: memberCount > 0 ? Math.round((members.length / memberCount) * 100) : 0,
      members,
    };
  });

  // Award reason breakdown (positive net reasons)
  const reasonMap = new Map<string, { totalDelta: number; eventCount: number }>();
  for (const evt of scopedEvents) {
    if (evt.delta <= 0) continue;
    const category = normalizeReasonCategory(evt.reason);
    const existing = reasonMap.get(category) ?? { totalDelta: 0, eventCount: 0 };
    existing.totalDelta += evt.delta;
    existing.eventCount += 1;
    reasonMap.set(category, existing);
  }

  const sortedReasons = Array.from(reasonMap.entries())
    .map(([reason, data]) => ({ reason, ...data }))
    .sort((a, b) => b.totalDelta - a.totalDelta || b.eventCount - a.eventCount);

  const topReasons = sortedReasons.slice(0, 6);
  const overflowReasons = sortedReasons.slice(6);
  if (overflowReasons.length > 0) {
    topReasons.push({
      reason: 'Other',
      totalDelta: overflowReasons.reduce((s, r) => s + r.totalDelta, 0),
      eventCount: overflowReasons.reduce((s, r) => s + r.eventCount, 0),
    });
  }

  const totalReasonDelta = topReasons.reduce((s, r) => s + r.totalDelta, 0);
  const reasonBreakdown: ReasonBreakdownItem[] = topReasons.map((item, idx) => ({
    reason: item.reason,
    totalDelta: item.totalDelta,
    eventCount: item.eventCount,
    sharePercent:
      totalReasonDelta > 0 ? Math.round((item.totalDelta / totalReasonDelta) * 100) : 0,
    color: REASON_PALETTE[idx % REASON_PALETTE.length],
  }));

  // Role breakdown
  const roleMap = new Map<string, { memberCount: number; totalPoints: number }>();
  for (const member of scopedMembers) {
    const role = member.role.trim() || 'Member';
    const existing = roleMap.get(role) ?? { memberCount: 0, totalPoints: 0 };
    existing.memberCount += 1;
    existing.totalPoints += member.points;
    roleMap.set(role, existing);
  }
  const roleBreakdown: RoleBreakdownItem[] = Array.from(roleMap.entries())
    .map(([role, data]) => ({
      role,
      memberCount: data.memberCount,
      totalPoints: data.totalPoints,
      avgPoints: data.memberCount > 0 ? data.totalPoints / data.memberCount : 0,
      sharePercent:
        positiveScopeSum > 0
          ? Math.round((Math.max(0, data.totalPoints) / positiveScopeSum) * 100)
          : 0,
    }))
    .sort((a, b) => b.avgPoints - a.avgPoints || b.totalPoints - a.totalPoints);

  // Needs attention
  const needsAttention = scopedMembers
    .filter((m) => m.points < options.attentionThreshold)
    .slice()
    .sort((a, b) => a.points - b.points || a.name.localeCompare(b.name));

  // Milestones
  const qualifyingMembers = sortedDesc.filter((m) => m.points >= options.milestoneTarget);
  const almostThereMembers = sortedDesc.filter(
    (m) => m.points < options.milestoneTarget && m.points >= options.milestoneTarget - 10,
  );
  const qualifyingRate =
    memberCount > 0 ? Math.round((qualifyingMembers.length / memberCount) * 100) : 0;

  // Leaderboard with tie-aware ranks and percentiles
  let lastPoints: number | null = null;
  let currentRank = 0;
  const leaderboard: LeaderboardEntry[] = sortedDesc.map((member, index) => {
    if (lastPoints === null || member.points !== lastPoints) {
      currentRank = index + 1;
      lastPoints = member.points;
    }
    const clubTotal = clubTotalsMap.get(member.clubId) ?? 0;
    const clubSharePercent =
      clubTotal > 0 ? Math.round((Math.max(0, member.points) / clubTotal) * 100) : 0;
    const percentile =
      memberCount <= 1
        ? 100
        : Math.round(((memberCount - 1 - index) / (memberCount - 1)) * 100);

    return {
      rank: currentRank,
      member,
      club: CLUB_MAP[member.clubId],
      committeeName: committeeById.get(member.committeeId)?.name ?? 'Committee',
      percentile,
      clubSharePercent,
    };
  });

  return {
    overview: {
      totalPoints,
      totalMembers: memberCount,
      totalCommittees: scopedCommittees.length,
      meanPoints,
      medianPoints,
      minPoints,
      maxPoints,
      activeRate,
      top20SharePercent,
      recent7dPoints,
      recent7dEvents,
      totalEvents,
      avgAwardSize,
      leadingCommittee,
    },
    clubComparisons,
    committeeBenchmarks,
    dailyTimeline,
    distributionBuckets,
    reasonBreakdown,
    roleBreakdown,
    needsAttention,
    milestoneStats: {
      qualifyingMembers,
      almostThereMembers,
      qualifyingRate,
    },
    leaderboard,
  };
}
