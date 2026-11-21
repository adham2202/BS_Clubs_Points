import { useId, useMemo, useState, type CSSProperties } from 'react';
import { Award, Copy, Search, SlidersHorizontal, X } from 'lucide-react';
import { CLUBS } from '../data/clubs';
import { computeAnalytics } from '../state/analytics';
import { getInitials, getUniqueRoles } from '../state/selectors';
import type { AppState, ClubFilter, ClubId, Member, RoleFilter } from '../types/tracker';

interface LeaderboardViewProps {
  state: AppState;
  lockedClub?: ClubId | null;
  clubFilter: ClubFilter;
  onClubFilterChange: (club: ClubFilter) => void;
  onSelectMember?: (member: Member) => void;
  onQuickAdjust: (member: Member, delta: number) => void;
  onOpenCustomPoints: (member: Member) => void;
  onCopyStandings: (text: string) => void;
}

export function LeaderboardView({
  state,
  lockedClub = null,
  clubFilter,
  onClubFilterChange,
  onSelectMember,
  onQuickAdjust,
  onOpenCustomPoints,
  onCopyStandings,
}: LeaderboardViewProps) {
  const committeeSelectId = useId();
  const roleSelectId = useId();
  const searchId = useId();

  const [committeeFilter, setCommitteeFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');

  const availableCommittees = useMemo(
    () =>
      state.committees.filter(
        (c) => clubFilter === 'all' || c.clubId === clubFilter,
      ),
    [state.committees, clubFilter],
  );

  const availableRoles = useMemo(() => getUniqueRoles(state.members), [state.members]);

  const report = useMemo(
    () =>
      computeAnalytics(state, clubFilter, {
        attentionThreshold: 20,
        milestoneTarget: 50,
        clubGoal: 350,
      }),
    [state, clubFilter],
  );

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return report.leaderboard.filter((entry) => {
      if (committeeFilter !== 'all' && entry.member.committeeId !== committeeFilter) {
        return false;
      }
      if (
        roleFilter !== 'all' &&
        (entry.member.role.trim() || 'Member').toLowerCase() !== roleFilter.toLowerCase()
      ) {
        return false;
      }
      if (q) {
        const hit =
          entry.member.name.toLowerCase().includes(q) ||
          entry.committeeName.toLowerCase().includes(q) ||
          entry.club.name.toLowerCase().includes(q) ||
          (entry.member.phone ?? '').toLowerCase().includes(q) ||
          (entry.member.email ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [report.leaderboard, committeeFilter, roleFilter, search]);

  const podiumEntries = filteredEntries.slice(0, 3);

  const handleCopyStandings = () => {
    const lines = [
      `Science Clubs Standings (${clubFilter === 'all' ? 'All Clubs' : CLUBS.find((c) => c.id === clubFilter)?.name ?? ''})`,
      ...filteredEntries.slice(0, 20).map(
        (entry) =>
          `#${entry.rank} ${entry.member.name} — ${entry.club.name} / ${entry.committeeName} (${entry.member.points} pts)`,
      ),
    ];
    onCopyStandings(lines.join('\n'));
  };

  const searchControl = (
    <div className="search-box">
      <label htmlFor={searchId} className="sr-only">
        Search standings by member or committee
      </label>
      <Search size={15} className="search-icon" aria-hidden="true" />
      <input
        id={searchId}
        type="search"
        className="search-input"
        aria-label="Search standings by member or committee"
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {search && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear standings search"
          onClick={() => setSearch('')}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  return (
    <section className="leaderboard-view" aria-label="Member leaderboard">
      <div className="roster-bar">
        {lockedClub ? (
          searchControl
        ) : (
          <div className="club-tabs" role="tablist" aria-label="Leaderboard club filter">
            <button
              type="button"
              role="tab"
              aria-selected={clubFilter === 'all'}
              className="club-tab"
              onClick={() => {
                onClubFilterChange('all');
                setCommitteeFilter('all');
              }}
            >
              All
            </button>
            {CLUBS.map((club) => (
              <button
                key={club.id}
                type="button"
                role="tab"
                aria-selected={clubFilter === club.id}
                className="club-tab"
                onClick={() => {
                  onClubFilterChange(club.id);
                  setCommitteeFilter('all');
                }}
              >
                <span
                  className="club-dot"
                  style={{ backgroundColor: club.accent }}
                  aria-hidden="true"
                />
                <span>{club.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="roster-controls">
          {!lockedClub && searchControl}

          <div className="sort-group">
            <label htmlFor={committeeSelectId} className="sr-only">
              Committee
            </label>
            <select
              id={committeeSelectId}
              className="select-input"
              aria-label="Filter by committee"
              value={committeeFilter}
              onChange={(e) => setCommitteeFilter(e.target.value)}
            >
              <option value="all">All Committees</option>
              {availableCommittees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sort-group">
            <label htmlFor={roleSelectId} className="sr-only">
              Role
            </label>
            <select
              id={roleSelectId}
              className="select-input"
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn"
            aria-label="Copy standings"
            onClick={handleCopyStandings}
          >
            <Copy size={15} aria-hidden="true" />
            <span>Copy</span>
          </button>
        </div>
      </div>

      {podiumEntries.length > 0 && (
        <div className="podium-grid" aria-label="Top 3 contributors">
          {podiumEntries.map((entry, idx) => {
            const tierClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze';
            const trimmedRole = entry.member.role.trim();
            const showRole = trimmedRole && trimmedRole.toLowerCase() !== 'member';
            const style = {
              '--club-accent': entry.club.accent,
              '--club-soft': entry.club.softBg,
              '--club-ink': entry.club.ink,
              '--club-border': entry.club.border,
            } as CSSProperties;

            return (
              <article key={entry.member.id} className={`podium-card ${tierClass}`} style={style}>
                <div className="podium-top">
                  <span className={`podium-rank-badge ${tierClass} mono-num`}>
                    <Award size={14} aria-hidden="true" />
                    <span>#{entry.rank}</span>
                  </span>
                  {!lockedClub && <span className="committee-club-pill">{entry.club.name}</span>}
                </div>

                <div className="podium-member-row">
                  <span className="member-avatar" aria-hidden="true">
                    {getInitials(entry.member.name)}
                  </span>
                  <div>
                    <div className="podium-member-name">{entry.member.name}</div>
                    <div className="podium-member-meta">
                      {entry.committeeName}
                      {showRole ? ` · ${trimmedRole}` : ''}
                    </div>
                  </div>
                </div>

                <div className="podium-bottom">
                  <div className="podium-score mono-num">
                    {entry.member.points} <span className="points-unit">pts</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <div className="empty-state-panel">
          <h3>No matches found</h3>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setCommitteeFilter('all');
              setRoleFilter('all');
              setSearch('');
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="ledger-table-card">
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Member</th>
                  {!lockedClub && <th scope="col">Club</th>}
                  <th scope="col">Committee</th>
                  <th scope="col">Role</th>
                  <th scope="col" className="num-col">
                    Points
                  </th>
                  <th scope="col" className="num-col">
                    Share
                  </th>
                  <th scope="col" className="num-col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const trimmedRole = entry.member.role.trim();
                  const showRoleBadge =
                    Boolean(trimmedRole) && trimmedRole.toLowerCase() !== 'member';
                  const style = {
                    '--club-accent': entry.club.accent,
                    '--club-soft': entry.club.softBg,
                    '--club-ink': entry.club.ink,
                    '--club-border': entry.club.border,
                  } as CSSProperties;

                  return (
                    <tr key={entry.member.id} style={style}>
                      <td className="mono-num" style={{ fontWeight: 700 }}>
                        #{entry.rank}
                      </td>
                      <td>
                        {onSelectMember ? (
                          <button
                            type="button"
                            className="member-identity-btn"
                            aria-label={`View details for ${entry.member.name}`}
                            onClick={() => onSelectMember(entry.member)}
                          >
                            <span className="member-avatar sm" aria-hidden="true">
                              {getInitials(entry.member.name)}
                            </span>
                            <span className="member-name">{entry.member.name}</span>
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span className="member-avatar sm" aria-hidden="true">
                              {getInitials(entry.member.name)}
                            </span>
                            <span style={{ fontWeight: 600 }}>{entry.member.name}</span>
                          </div>
                        )}
                      </td>
                      {!lockedClub && (
                        <td>
                          <span className="committee-club-pill">{entry.club.name}</span>
                        </td>
                      )}
                      <td style={{ color: 'var(--text-secondary)' }}>{entry.committeeName}</td>
                      <td>
                        {showRoleBadge ? (
                          <span className="member-role-badge">{trimmedRole}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>
                        )}
                      </td>
                      <td className="num-col mono-num" style={{ fontWeight: 700 }}>
                        {entry.member.points}
                      </td>
                      <td className="num-col mono-num">{entry.clubSharePercent}%</td>
                      <td className="num-col">
                        <div className="table-quick-actions">
                          <button
                            type="button"
                            className="pt-btn compact"
                            aria-label={`Add 1 point to ${entry.member.name}`}
                            onClick={() => onQuickAdjust(entry.member, 1)}
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            className="pt-btn compact"
                            aria-label={`Add 5 points to ${entry.member.name}`}
                            onClick={() => onQuickAdjust(entry.member, 5)}
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            className="pt-btn compact custom"
                            aria-label={`Open custom points for ${entry.member.name}`}
                            onClick={() => onOpenCustomPoints(entry.member)}
                          >
                            <SlidersHorizontal size={12} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
