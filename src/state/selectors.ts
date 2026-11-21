import { CLUBS, CLUB_MAP } from '../data/clubs';
import type {
  AppState,
  ClubFilter,
  ClubId,
  ClubMeta,
  Committee,
  Member,
  PointEvent,
  RoleFilter,
  SortOption,
} from '../types/tracker';

export interface ClubStat {
  club: ClubMeta;
  totalPoints: number;
  committeeCount: number;
  memberCount: number;
  sharePercent: number;
  topMember: Member | null;
}

export interface ClubStatsSummary {
  byClub: ClubStat[];
  totalPoints: number;
  totalCommittees: number;
  totalMembers: number;
}

export interface CommitteeWithMembers {
  committee: Committee;
  members: Member[];
  totalPoints: number;
  totalMemberCount: number;
}

export interface ClubSectionGroup {
  club: ClubMeta;
  committees: CommitteeWithMembers[];
  totalPoints: number;
  memberCount: number;
}

export interface BulkMemberEntry {
  name: string;
  role: string;
  phone?: string;
  email?: string;
  initialPoints: number;
}

export function getClubStats(state: AppState): ClubStatsSummary {
  const rawCounts = CLUBS.map((club) => {
    const clubCommittees = state.committees.filter((c) => c.clubId === club.id);
    const clubMembers = state.members.filter((m) => m.clubId === club.id);
    const totalPoints = clubMembers.reduce((sum, m) => sum + m.points, 0);

    let topMember: Member | null = null;
    for (const member of clubMembers) {
      if (
        !topMember ||
        member.points > topMember.points ||
        (member.points === topMember.points && member.name.localeCompare(topMember.name) < 0)
      ) {
        topMember = member;
      }
    }

    return {
      club,
      totalPoints,
      committeeCount: clubCommittees.length,
      memberCount: clubMembers.length,
      topMember,
    };
  });

  const positiveSum = rawCounts.reduce((sum, item) => sum + Math.max(0, item.totalPoints), 0);
  const totalPoints = rawCounts.reduce((sum, item) => sum + item.totalPoints, 0);

  const byClub: ClubStat[] = rawCounts.map((item) => ({
    ...item,
    sharePercent:
      positiveSum > 0 ? Math.round((Math.max(0, item.totalPoints) / positiveSum) * 100) : 0,
  }));

  return {
    byClub,
    totalPoints,
    totalCommittees: state.committees.length,
    totalMembers: state.members.length,
  };
}

export function getCommitteePoints(members: Member[], committeeId: string): number {
  return members
    .filter((m) => m.committeeId === committeeId)
    .reduce((sum, m) => sum + m.points, 0);
}

export function sortMembers(members: Member[], sort: SortOption): Member[] {
  const copy = members.slice();
  switch (sort) {
    case 'points-desc':
      return copy.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    case 'points-asc':
      return copy.sort((a, b) => a.points - b.points || a.name.localeCompare(b.name));
    case 'name-asc':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'recent':
      return copy.sort(
        (a, b) =>
          Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.name.localeCompare(b.name),
      );
    default:
      return copy;
  }
}

export function getUniqueRoles(members: Member[]): string[] {
  const set = new Set<string>();
  for (const m of members) {
    const role = m.role.trim() || 'Member';
    set.add(role);
  }
  const preferredOrder = ['Chair', 'Coordinator', 'Treasurer', 'Secretary', 'Member'];
  return Array.from(set).sort((a, b) => {
    const idxA = preferredOrder.indexOf(a);
    const idxB = preferredOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function filterCommitteesAndMembers(
  state: AppState,
  clubFilter: ClubFilter,
  searchQuery: string,
  sort: SortOption,
  roleFilter: RoleFilter = 'all',
): ClubSectionGroup[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const normalizedRole = roleFilter === 'all' ? '' : roleFilter.toLowerCase();
  const visibleClubs = clubFilter === 'all' ? CLUBS : [CLUB_MAP[clubFilter]];
  const groups: ClubSectionGroup[] = [];

  for (const club of visibleClubs) {
    const clubCommittees = state.committees.filter((c) => c.clubId === club.id);
    const committeeGroups: CommitteeWithMembers[] = [];

    for (const committee of clubCommittees) {
      const allMembersInCommittee = state.members.filter((m) => m.committeeId === committee.id);
      const committeeTotalPoints = allMembersInCommittee.reduce((sum, m) => sum + m.points, 0);

      const roleScopedMembers = normalizedRole
        ? allMembersInCommittee.filter(
            (m) => (m.role.trim() || 'Member').toLowerCase() === normalizedRole,
          )
        : allMembersInCommittee;

      if (!normalizedQuery) {
        if (!normalizedRole || roleScopedMembers.length > 0) {
          committeeGroups.push({
            committee,
            members: sortMembers(roleScopedMembers, sort),
            totalPoints: committeeTotalPoints,
            totalMemberCount: allMembersInCommittee.length,
          });
        }
        continue;
      }

      const committeeMatches =
        committee.name.toLowerCase().includes(normalizedQuery) ||
        committee.description.toLowerCase().includes(normalizedQuery) ||
        club.name.toLowerCase().includes(normalizedQuery);

      const matchingMembers = roleScopedMembers.filter(
        (m) =>
          m.name.toLowerCase().includes(normalizedQuery) ||
          m.role.toLowerCase().includes(normalizedQuery) ||
          (m.phone ?? '').toLowerCase().includes(normalizedQuery) ||
          (m.email ?? '').toLowerCase().includes(normalizedQuery),
      );

      if (committeeMatches && (!normalizedRole || roleScopedMembers.length > 0)) {
        committeeGroups.push({
          committee,
          members: sortMembers(roleScopedMembers, sort),
          totalPoints: committeeTotalPoints,
          totalMemberCount: allMembersInCommittee.length,
        });
      } else if (matchingMembers.length > 0) {
        committeeGroups.push({
          committee,
          members: sortMembers(matchingMembers, sort),
          totalPoints: committeeTotalPoints,
          totalMemberCount: allMembersInCommittee.length,
        });
      }
    }

    if (committeeGroups.length > 0 || (!normalizedQuery && !normalizedRole)) {
      const clubMembers = state.members.filter((m) => m.clubId === club.id);
      groups.push({
        club,
        committees: committeeGroups,
        totalPoints: clubMembers.reduce((sum, m) => sum + m.points, 0),
        memberCount: clubMembers.length,
      });
    }
  }

  return groups;
}

export function getLatestEventByMember(history: PointEvent[]): Map<string, PointEvent> {
  const map = new Map<string, PointEvent>();
  for (const event of history) {
    if (!event.reverted && !map.has(event.memberId)) {
      map.set(event.memberId, event);
    }
  }
  return map;
}

export function parseBulkMembersInput(text: string): BulkMemberEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const entries: BulkMemberEntry[] = [];

  for (const line of lines) {
    // Support Excel/Sheets tab-delimited or comma-delimited columns
    const parts = line.includes('\t')
      ? line.split('\t').map((p) => p.trim())
      : line.split(',').map((p) => p.trim());

    const name = parts[0] ?? '';
    if (!name) continue;

    let role = 'Member';
    let initialPoints = 0;
    let phone = '';
    let email = '';

    for (let i = 1; i < parts.length; i += 1) {
      const token = parts[i];
      if (!token) continue;
      const digitsOnly = token.replace(/\D/g, '');
      if (!email && token.includes('@')) {
        email = token;
      } else if (
        !phone &&
        /^[+]?[\d\s()-]{7,}$/.test(token) &&
        digitsOnly.length >= 7
      ) {
        phone = token;
      } else if (/^[+-]?\d+$/.test(token)) {
        initialPoints = Math.trunc(Number(token));
      } else {
        role = token;
      }
    }

    entries.push({
      name,
      role,
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      initialPoints,
    });
  }

  return entries;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(state: AppState, clubFilter: ClubFilter = 'all'): string {
  const header = [
    'Club',
    'Committee',
    'Member Name',
    'Phone',
    'Email',
    'Role',
    'Points',
    'Last Updated',
  ];
  const rows: string[] = [header.map(escapeCsvCell).join(',')];

  const committeeById = new Map(state.committees.map((c) => [c.id, c]));
  const clubOrder: Record<ClubId, number> = {
    chemistry: 0,
    physics: 1,
    mathematics: 2,
    biology: 3,
  };

  const filteredMembers = state.members
    .filter((m) => clubFilter === 'all' || m.clubId === clubFilter)
    .slice()
    .sort((a, b) => {
      const clubDiff = clubOrder[a.clubId] - clubOrder[b.clubId];
      if (clubDiff !== 0) return clubDiff;
      const comA = committeeById.get(a.committeeId)?.name ?? '';
      const comB = committeeById.get(b.committeeId)?.name ?? '';
      const comDiff = comA.localeCompare(comB);
      if (comDiff !== 0) return comDiff;
      return b.points - a.points || a.name.localeCompare(b.name);
    });

  for (const member of filteredMembers) {
    const clubName = CLUB_MAP[member.clubId].name;
    const committeeName = committeeById.get(member.committeeId)?.name ?? '';
    rows.push(
      [
        clubName,
        committeeName,
        member.name,
        member.phone ?? '',
        member.email ?? '',
        member.role,
        member.points,
        member.updatedAt,
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }

  // UTF-8 BOM ensures Excel opens accented names cleanly
  return `\uFEFF${rows.join('\r\n')}`;
}

export function buildCommitteeSummaryCsv(
  state: AppState,
  clubFilter: ClubFilter = 'all',
): string {
  const header = [
    'Club',
    'Committee',
    'Members',
    'Total Points',
    'Avg Points/Member',
    'Top Member',
    'Top Points',
  ];
  const rows: string[] = [header.map(escapeCsvCell).join(',')];

  const targetClubs = clubFilter === 'all' ? CLUBS : [CLUB_MAP[clubFilter]];

  for (const club of targetClubs) {
    const committees = state.committees.filter((c) => c.clubId === club.id);
    for (const committee of committees) {
      const members = state.members.filter((m) => m.committeeId === committee.id);
      const totalPoints = members.reduce((sum, m) => sum + m.points, 0);
      const avg = members.length > 0 ? (totalPoints / members.length).toFixed(1) : '0.0';
      const sorted = sortMembers(members, 'points-desc');
      const top = sorted[0] ?? null;

      rows.push(
        [
          club.name,
          committee.name,
          members.length,
          totalPoints,
          avg,
          top ? top.name : '—',
          top ? top.points : 0,
        ]
          .map(escapeCsvCell)
          .join(','),
      );
    }
  }

  return `\uFEFF${rows.join('\r\n')}`;
}

export function buildMarkdownSummary(state: AppState, clubFilter: ClubFilter = 'all'): string {
  const visibleClubs = clubFilter === 'all' ? CLUBS : [CLUB_MAP[clubFilter]];
  const scopedMembers = state.members.filter(
    (m) => clubFilter === 'all' || m.clubId === clubFilter,
  );
  const scopedTotal = scopedMembers.reduce((sum, m) => sum + m.points, 0);
  const title =
    clubFilter === 'all'
      ? 'Science Clubs Points — Registry Summary'
      : `${CLUB_MAP[clubFilter].name} Club — Points Summary`;

  const lines: string[] = [
    `## ${title}`,
    `**Total:** ${scopedTotal} pts across ${scopedMembers.length} members`,
    '',
  ];

  for (const club of visibleClubs) {
    const clubMembers = state.members.filter((m) => m.clubId === club.id);
    const clubTotal = clubMembers.reduce((sum, m) => sum + m.points, 0);
    const clubCommittees = state.committees.filter((c) => c.clubId === club.id);
    lines.push(`### ${club.name} (${clubTotal} pts · ${clubMembers.length} members)`);
    for (const com of clubCommittees) {
      const comMembers = sortMembers(
        clubMembers.filter((m) => m.committeeId === com.id),
        'points-desc',
      );
      const comTotal = comMembers.reduce((sum, m) => sum + m.points, 0);
      const top = comMembers[0];
      lines.push(
        `- **${com.name}**: ${comTotal} pts (${comMembers.length} members${top ? `, leader: ${top.name} ${top.points} pts` : ''})`,
      );
    }
    lines.push('');
  }

  const topMembers = sortMembers(scopedMembers, 'points-desc').slice(0, 5);
  if (topMembers.length > 0) {
    lines.push('### Top Contributors');
    topMembers.forEach((m, idx) => {
      lines.push(`${idx + 1}. **${m.name}** (${CLUB_MAP[m.clubId].name}) — ${m.points} pts`);
    });
  }

  return lines.join('\n');
}

export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const diffSec = Math.round((nowMs - ts) / 1000);
  if (diffSec < 45) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 14) return `${diffDay}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
