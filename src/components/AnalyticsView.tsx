import { useId, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Copy,
  FileSpreadsheet,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { CLUBS } from '../data/clubs';
import { computeAnalytics } from '../state/analytics';
import { buildMarkdownSummary } from '../state/selectors';
import type { AppState, ClubFilter, ClubId, Member } from '../types/tracker';

interface AnalyticsViewProps {
  state: AppState;
  lockedClub?: ClubId | null;
  clubNames?: Record<ClubId, string>;
  scope: ClubFilter;
  onScopeChange: (scope: ClubFilter) => void;
  onNavigateToCommittee: (clubId: ClubId, committeeId: string) => void;
  onQuickAdjust: (member: Member, delta: number) => void;
  onOpenCustomPoints: (member: Member) => void;
  onCopySummary: (markdown: string) => void;
  onExportCommitteeCsv: () => void;
}

export function AnalyticsView({
  state,
  lockedClub = null,
  clubNames,
  scope,
  onScopeChange,
  onNavigateToCommittee,
  onQuickAdjust,
  onOpenCustomPoints,
  onCopySummary,
  onExportCommitteeCsv,
}: AnalyticsViewProps) {
  const scopeSelectId = useId();
  const milestoneInputId = useId();
  const clubGoalInputId = useId();
  const attentionInputId = useId();

  const [clubMetric, setClubMetric] = useState<'total' | 'avg'>('total');
  const [committeeMetric, setCommitteeMetric] = useState<'total' | 'avg' | 'members'>('total');
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>('t4');
  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null);

  const [milestoneTarget, setMilestoneTarget] = useState(50);
  const [clubGoal, setClubGoal] = useState(350);
  const [attentionThreshold, setAttentionThreshold] = useState(20);

  const report = useMemo(
    () =>
      computeAnalytics(state, scope, {
        attentionThreshold,
        milestoneTarget,
        clubGoal,
      }),
    [state, scope, attentionThreshold, milestoneTarget, clubGoal],
  );

  // Club comparison max
  const maxClubValue = useMemo(() => {
    const vals = report.clubComparisons.map((c) =>
      clubMetric === 'total' ? c.totalPoints : c.avgPoints,
    );
    return Math.max(1, ...vals);
  }, [report.clubComparisons, clubMetric]);

  // Committee benchmark sorted by chosen metric
  const sortedCommittees = useMemo(() => {
    const copy = report.committeeBenchmarks.slice();
    if (committeeMetric === 'avg') {
      copy.sort((a, b) => b.avgPoints - a.avgPoints || a.committee.name.localeCompare(b.committee.name));
    } else if (committeeMetric === 'members') {
      copy.sort((a, b) => b.memberCount - a.memberCount || b.totalPoints - a.totalPoints);
    }
    return copy;
  }, [report.committeeBenchmarks, committeeMetric]);

  const maxCommitteeValue = useMemo(() => {
    const vals = sortedCommittees.map((item) =>
      committeeMetric === 'total'
        ? item.totalPoints
        : committeeMetric === 'avg'
          ? item.avgPoints
          : item.memberCount,
    );
    return Math.max(1, ...vals);
  }, [sortedCommittees, committeeMetric]);

  const activeBucket = useMemo(
    () => report.distributionBuckets.find((b) => b.id === selectedBucketId) ?? null,
    [report.distributionBuckets, selectedBucketId],
  );

  const maxBucketCount = useMemo(
    () => Math.max(1, ...report.distributionBuckets.map((b) => b.count)),
    [report.distributionBuckets],
  );

  // Timeline SVG math
  const maxDailyAbs = useMemo(
    () => Math.max(10, ...report.dailyTimeline.map((d) => Math.abs(d.totalDelta))),
    [report.dailyTimeline],
  );
  const maxCumulative = useMemo(
    () => Math.max(10, ...report.dailyTimeline.map((d) => d.cumulative)),
    [report.dailyTimeline],
  );

  const activeDay = useMemo(() => {
    if (hoveredDayKey) {
      const found = report.dailyTimeline.find((d) => d.dateKey === hoveredDayKey);
      if (found) return found;
    }
    return report.dailyTimeline[report.dailyTimeline.length - 1] ?? null;
  }, [report.dailyTimeline, hoveredDayKey]);

  // SVG Donut geometry
  const donutSegments = useMemo(() => {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const total = report.reasonBreakdown.reduce((sum, r) => sum + r.totalDelta, 0);
    let offset = 0;
    return report.reasonBreakdown.map((item) => {
      const fraction = total > 0 ? item.totalDelta / total : 0;
      const length = fraction * circumference;
      const seg = {
        ...item,
        dasharray: `${length} ${Math.max(0, circumference - length)}`,
        dashoffset: -offset,
      };
      offset += length;
      return seg;
    });
  }, [report.reasonBreakdown]);

  return (
    <section className="analytics-view" aria-label="Club and committee analytics">
      <div className="roster-bar">
        {lockedClub ? (
          <div className="roster-summary mono-num">
            {report.overview.totalMembers} {report.overview.totalMembers === 1 ? 'member' : 'members'} &middot;{' '}
            {report.overview.totalCommittees}{' '}
            {report.overview.totalCommittees === 1 ? 'committee' : 'committees'}
          </div>
        ) : (
          <div className="sort-group">
            <label htmlFor={scopeSelectId} className="sr-only">
              Scope
            </label>
            <select
              id={scopeSelectId}
              className="select-input"
              aria-label="Analytics club scope"
              value={scope}
              onChange={(e) => onScopeChange(e.target.value as ClubFilter)}
            >
              <option value="all">All Clubs</option>
              {CLUBS.map((club) => (
                <option key={club.id} value={club.id}>
                  {clubNames?.[club.id] ?? club.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="studio-actions">
          <button
            type="button"
            className="btn"
            aria-label="Copy summary"
            onClick={() => onCopySummary(buildMarkdownSummary(state, scope))}
          >
            <Copy size={15} aria-hidden="true" />
            <span>Copy</span>
          </button>

          <button
            type="button"
            className="btn"
            aria-label="Export committee CSV"
            onClick={onExportCommitteeCsv}
          >
            <FileSpreadsheet size={15} aria-hidden="true" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* 4-KPI Summary Strip */}
      <div className="kpi-strip" aria-label="Metrics summary">
        <div className="kpi-tile">
          <span className="kpi-label">Total Points</span>
          <span className="kpi-value mono-num">{report.overview.totalPoints}</span>
        </div>

        <div className="kpi-tile">
          <span className="kpi-label">Avg / Member</span>
          <span className="kpi-value mono-num">{report.overview.meanPoints.toFixed(1)}</span>
        </div>

        <div className="kpi-tile">
          <span className="kpi-label">Active</span>
          <span className="kpi-value mono-num">{report.overview.activeRate}%</span>
        </div>

        <div className="kpi-tile">
          <span className="kpi-label">Top Committee</span>
          <span className="kpi-value-sm">
            {report.overview.leadingCommittee
              ? report.overview.leadingCommittee.committee.name
              : '—'}
          </span>
        </div>
      </div>

      {/* Main 2-column Studio Grid */}
      <div className="analytics-grid">
        {/* Panel 1: Club Comparison (Admin) OR Top Contributors (Single Club Privacy) */}
        {lockedClub ? (
          <article className="studio-card">
            <div className="studio-card-head">
              <div>
                <h3 className="studio-card-title">Top Contributors</h3>
              </div>
            </div>

            {report.leaderboard.length === 0 ? (
              <p className="empty-committee">No members yet.</p>
            ) : (
              <div className="hbar-list">
                {report.leaderboard.slice(0, 6).map((entry) => {
                  const maxPts = Math.max(1, report.leaderboard[0]?.member.points ?? 1);
                  const pct = Math.max(
                    3,
                    Math.round((Math.max(0, entry.member.points) / maxPts) * 100),
                  );
                  return (
                    <div key={entry.member.id} className="hbar-row-btn">
                      <div className="hbar-label-row">
                        <span className="hbar-name">
                          <span className="mono-num" style={{ color: 'var(--text-muted)' }}>
                            #{entry.rank}
                          </span>
                          <span>{entry.member.name}</span>
                          <span className="hbar-club-tag">{entry.committeeName}</span>
                        </span>
                        <span className="hbar-val mono-num">
                          {entry.member.points} pts{' '}
                          <span className="hbar-meta">({entry.clubSharePercent}%)</span>
                        </span>
                      </div>
                      <div className="hbar-track">
                        <div
                          className="hbar-fill"
                          style={{ width: `${pct}%`, backgroundColor: entry.club.accent }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        ) : (
          <article className="studio-card">
            <div className="studio-card-head">
              <div>
                <h3 className="studio-card-title">Club Comparison</h3>
              </div>
              <div className="segmented-mini" role="group" aria-label="Club comparison metric">
                <button
                  type="button"
                  className={`mini-seg-btn${clubMetric === 'total' ? ' active' : ''}`}
                  aria-pressed={clubMetric === 'total'}
                  onClick={() => setClubMetric('total')}
                >
                  Total
                </button>
                <button
                  type="button"
                  className={`mini-seg-btn${clubMetric === 'avg' ? ' active' : ''}`}
                  aria-pressed={clubMetric === 'avg'}
                  onClick={() => setClubMetric('avg')}
                >
                  Avg / Member
                </button>
              </div>
            </div>

            <div className="hbar-list">
              {report.clubComparisons.map((item) => {
                const val = clubMetric === 'total' ? item.totalPoints : item.avgPoints;
                const pct = Math.max(2, Math.round((Math.max(0, val) / maxClubValue) * 100));
                const isScoped = scope === item.club.id;

                return (
                  <button
                    key={item.club.id}
                    type="button"
                    className={`hbar-row-btn${isScoped ? ' scoped' : ''}`}
                    onClick={() =>
                      onScopeChange(scope === item.club.id ? 'all' : item.club.id)
                    }
                  >
                    <div className="hbar-label-row">
                      <span className="hbar-name">
                        <span
                          className="club-dot"
                          style={{ backgroundColor: item.club.accent }}
                          aria-hidden="true"
                        />
                        <span>{clubNames?.[item.club.id] ?? item.club.name}</span>
                      </span>
                      <span className="hbar-val mono-num">
                        {clubMetric === 'total' ? `${item.totalPoints} pts` : `${item.avgPoints.toFixed(1)} avg`}{' '}
                        <span className="hbar-meta">
                          (med {item.medianPoints.toFixed(0)} &middot; {item.sharePercent}%)
                        </span>
                      </span>
                    </div>
                    <div className="hbar-track">
                      <div
                        className="hbar-fill"
                        style={{ width: `${pct}%`, backgroundColor: item.club.accent }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </article>
        )}

        {/* Panel 2: Committee Efficiency Benchmark */}
        <article className="studio-card">
          <div className="studio-card-head">
            <div>
              <h3 className="studio-card-title">Committee Benchmark</h3>
            </div>
            <div className="segmented-mini" role="group" aria-label="Committee ranking metric">
              <button
                type="button"
                className={`mini-seg-btn${committeeMetric === 'total' ? ' active' : ''}`}
                aria-pressed={committeeMetric === 'total'}
                onClick={() => setCommitteeMetric('total')}
              >
                Total
              </button>
              <button
                type="button"
                className={`mini-seg-btn${committeeMetric === 'avg' ? ' active' : ''}`}
                aria-pressed={committeeMetric === 'avg'}
                onClick={() => setCommitteeMetric('avg')}
              >
                Avg / Member
              </button>
              <button
                type="button"
                className={`mini-seg-btn${committeeMetric === 'members' ? ' active' : ''}`}
                aria-pressed={committeeMetric === 'members'}
                onClick={() => setCommitteeMetric('members')}
              >
                Size
              </button>
            </div>
          </div>

          {sortedCommittees.length === 0 ? (
            <p className="empty-committee">No committees yet.</p>
          ) : (
            <div className="hbar-list scroll-capped">
              {sortedCommittees.map((item) => {
                const val =
                  committeeMetric === 'total'
                    ? item.totalPoints
                    : committeeMetric === 'avg'
                      ? item.avgPoints
                      : item.memberCount;
                const pct = Math.max(
                  2,
                  Math.round((Math.max(0, val) / maxCommitteeValue) * 100),
                );
                return (
                  <button
                    key={item.committee.id}
                    type="button"
                    className="hbar-row-btn"
                    onClick={() => onNavigateToCommittee(item.club.id, item.committee.id)}
                  >
                    <div className="hbar-label-row">
                      <span className="hbar-name">
                        <span
                          className="club-dot"
                          style={{ backgroundColor: item.club.accent }}
                          aria-hidden="true"
                        />
                        <span>{item.committee.name}</span>
                        {!lockedClub && (
                          <span className="hbar-club-tag">{item.club.shortName}</span>
                        )}
                      </span>
                      <span className="hbar-val mono-num">
                        {committeeMetric === 'total'
                          ? `${item.totalPoints} pts`
                          : committeeMetric === 'avg'
                            ? `${item.avgPoints.toFixed(1)} avg`
                            : `${item.memberCount} members`}
                        <ArrowUpRight size={13} style={{ marginLeft: 4, verticalAlign: '-2px' }} aria-hidden="true" />
                      </span>
                    </div>
                    <div className="hbar-track">
                      <div
                        className="hbar-fill"
                        style={{ width: `${pct}%`, backgroundColor: item.club.accent }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </article>

        {/* Panel 3: 14-Day Activity Timeline */}
        <article className="studio-card studio-card-wide">
          <div className="studio-card-head">
            <div>
              <h3 className="studio-card-title">14-Day Activity Timeline</h3>
            </div>
            {activeDay && (
              <div className="timeline-readout mono-num" aria-live="polite">
                <strong>{activeDay.label}</strong> &middot;{' '}
                {activeDay.totalDelta >= 0 ? '+' : ''}
                {activeDay.totalDelta} pts &middot; {activeDay.cumulative} total
              </div>
            )}
          </div>

          <div className="svg-chart-wrap">
            <svg
              viewBox="0 0 720 220"
              className="timeline-svg"
              role="img"
              aria-label="14-day point activity timeline chart"
            >
              {/* Baseline & grid */}
              {[0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = 175 - ratio * 140;
                return (
                  <line
                    key={ratio}
                    x1="40"
                    y1={y}
                    x2="700"
                    y2={y}
                    stroke="#DFDAD0"
                    strokeDasharray="3 3"
                  />
                );
              })}
              <line x1="40" y1="175" x2="700" y2="175" stroke="#C9C2B4" strokeWidth="1.2" />

              {/* Y-axis min/max labels */}
              <text x="34" y="39" textAnchor="end" className="svg-axis-text">
                {maxDailyAbs}
              </text>
              <text x="34" y="178" textAnchor="end" className="svg-axis-text">
                0
              </text>

              {/* Daily bars */}
              {report.dailyTimeline.map((day, idx) => {
                const slotWidth = 660 / 14;
                const barWidth = 24;
                const x = 40 + idx * slotWidth + (slotWidth - barWidth) / 2;
                const h = Math.max(
                  day.totalDelta > 0 ? 4 : 0,
                  (Math.max(0, day.totalDelta) / maxDailyAbs) * 140,
                );
                const y = 175 - h;
                const isActive = activeDay?.dateKey === day.dateKey;

                return (
                  <g
                    key={day.dateKey}
                    onMouseEnter={() => setHoveredDayKey(day.dateKey)}
                    onFocus={() => setHoveredDayKey(day.dateKey)}
                  >
                    <rect
                      x={40 + idx * slotWidth}
                      y={24}
                      width={slotWidth}
                      height={160}
                      fill="transparent"
                    />
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={h}
                      rx="3"
                      fill={isActive ? '#1C1917' : '#0E6B5E'}
                      opacity={day.totalDelta > 0 ? (isActive ? 1 : 0.78) : 0.15}
                    />
                    {idx % 2 === 1 && (
                      <text
                        x={x + barWidth / 2}
                        y="196"
                        textAnchor="middle"
                        className="svg-axis-text"
                      >
                        {day.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Cumulative trajectory line */}
              <polyline
                fill="none"
                stroke="#B45309"
                strokeWidth="2.2"
                strokeLinejoin="round"
                points={report.dailyTimeline
                  .map((day, idx) => {
                    const slotWidth = 660 / 14;
                    const cx = 40 + idx * slotWidth + slotWidth / 2;
                    const cy = 175 - (Math.max(0, day.cumulative) / maxCumulative) * 140;
                    return `${cx.toFixed(1)},${cy.toFixed(1)}`;
                  })
                  .join(' ')}
              />
              {report.dailyTimeline.map((day, idx) => {
                const slotWidth = 660 / 14;
                const cx = 40 + idx * slotWidth + slotWidth / 2;
                const cy = 175 - (Math.max(0, day.cumulative) / maxCumulative) * 140;
                const isActive = activeDay?.dateKey === day.dateKey;
                return (
                  <circle
                    key={`pt-${day.dateKey}`}
                    cx={cx}
                    cy={cy}
                    r={isActive ? 4.5 : 3}
                    fill={isActive ? '#1C1917' : '#B45309'}
                    stroke="#FFFEFA"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
          </div>
        </article>

        {/* Panel 4: Score Distribution Histogram */}
        <article className="studio-card">
          <div className="studio-card-head">
            <div>
              <h3 className="studio-card-title">Score Distribution Tiers</h3>
            </div>
          </div>

          <div className="hist-grid" role="group" aria-label="Score distribution buckets">
            {report.distributionBuckets.map((bucket) => {
              const barPct = Math.round((bucket.count / maxBucketCount) * 100);
              const isSelected = selectedBucketId === bucket.id;
              return (
                <button
                  key={bucket.id}
                  type="button"
                  className={`hist-col-btn${isSelected ? ' selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    setSelectedBucketId((prev) => (prev === bucket.id ? null : bucket.id))
                  }
                >
                  <span className="hist-count mono-num">{bucket.count}</span>
                  <div className="hist-track">
                    <div
                      className="hist-fill"
                      style={{ height: `${Math.max(bucket.count > 0 ? 12 : 4, barPct)}%` }}
                    />
                  </div>
                  <span className="hist-label mono-num">{bucket.label}</span>
                  <span className="hist-pct mono-num">{bucket.percent}%</span>
                </button>
              );
            })}
          </div>

          {activeBucket && (
            <div className="bucket-inspector">
              <div className="bucket-inspector-head">
                <strong>
                  Tier {activeBucket.label} ({activeBucket.count}{' '}
                  {activeBucket.count === 1 ? 'member' : 'members'})
                </strong>
              </div>
              {activeBucket.members.length === 0 ? (
                <p className="form-hint">None</p>
              ) : (
                <div className="bucket-chips">
                  {activeBucket.members.slice(0, 12).map((m) => (
                    <span key={m.id} className="bucket-member-chip">
                      <span>{m.name}</span>
                      <strong className="mono-num">{m.points}</strong>
                    </span>
                  ))}
                  {activeBucket.members.length > 12 && (
                    <span className="form-hint">+{activeBucket.members.length - 12} more</span>
                  )}
                </div>
              )}
            </div>
          )}
        </article>

        {/* Panel 5: Award Reasons Donut */}
        <article className="studio-card">
          <div className="studio-card-head">
            <div>
              <h3 className="studio-card-title">Award Reasons Breakdown</h3>
            </div>
          </div>

          {report.reasonBreakdown.length === 0 ? (
            <p className="empty-committee">No events yet.</p>
          ) : (
            <div className="donut-layout">
              <svg
                viewBox="0 0 140 140"
                className="donut-svg"
                role="img"
                aria-label="Award reasons donut chart"
              >
                <circle
                  cx="70"
                  cy="70"
                  r="54"
                  fill="none"
                  stroke="#EFECE4"
                  strokeWidth="18"
                />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.reason}
                    cx="70"
                    cy="70"
                    r="54"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="18"
                    strokeDasharray={seg.dasharray}
                    strokeDashoffset={seg.dashoffset}
                    transform="rotate(-90 70 70)"
                  />
                ))}
                <text x="70" y="66" textAnchor="middle" className="donut-center-num">
                  {report.reasonBreakdown.reduce((s, r) => s + r.totalDelta, 0)}
                </text>
                <text x="70" y="83" textAnchor="middle" className="donut-center-sub">
                  pts logged
                </text>
              </svg>

              <ul className="reason-legend">
                {report.reasonBreakdown.map((item) => (
                  <li key={item.reason} className="reason-legend-row">
                    <span className="reason-legend-left">
                      <span
                        className="club-dot"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="reason-name">{item.reason}</span>
                    </span>
                    <span className="mono-num reason-stats">
                      +{item.totalDelta} pts ({item.sharePercent}%)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>

        {/* Panel 6: Role Contribution Table */}
        <article className="studio-card">
          <div className="studio-card-head">
            <div>
              <h3 className="studio-card-title">Contribution by Role</h3>
            </div>
          </div>

          <div className="table-scroll">
            <table className="ledger-table compact">
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col" className="num-col">
                    Members
                  </th>
                  <th scope="col" className="num-col">
                    Total Pts
                  </th>
                  <th scope="col" className="num-col">
                    Avg / Member
                  </th>
                  <th scope="col" className="num-col">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.roleBreakdown.map((row) => (
                  <tr key={row.role}>
                    <td style={{ fontWeight: 600 }}>{row.role}</td>
                    <td className="num-col mono-num">{row.memberCount}</td>
                    <td className="num-col mono-num" style={{ fontWeight: 700 }}>
                      {row.totalPoints}
                    </td>
                    <td className="num-col mono-num">{row.avgPoints.toFixed(1)}</td>
                    <td className="num-col mono-num">{row.sharePercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {/* Panel 7: Goal & Honors Threshold Simulator */}
        <article className="studio-card">
          <div className="studio-card-head">
            <div>
              <h3 className="studio-card-title">Goal &amp; Honors Simulator</h3>
            </div>
          </div>

          <div className="simulator-controls">
            <div className="form-field">
              <label htmlFor={milestoneInputId} className="form-label">
                Honors target
              </label>
              <input
                id={milestoneInputId}
                type="number"
                min={0}
                max={500}
                step={5}
                className="text-input mono-num"
                value={milestoneTarget}
                onChange={(e) =>
                  setMilestoneTarget(Math.max(0, Number(e.target.value) || 0))
                }
              />
            </div>

            <div className="form-field">
              <label htmlFor={clubGoalInputId} className="form-label">
                Club goal
              </label>
              <input
                id={clubGoalInputId}
                type="number"
                min={10}
                max={5000}
                step={25}
                className="text-input mono-num"
                value={clubGoal}
                onChange={(e) =>
                  setClubGoal(Math.max(10, Number(e.target.value) || 10))
                }
              />
            </div>
          </div>

          <div className="sim-summary-banner">
            <span>
              <strong className="mono-num">{report.milestoneStats.qualifyingMembers.length}</strong>{' '}
              qualify &middot;{' '}
              <strong className="mono-num">
                {report.milestoneStats.almostThereMembers.length}
              </strong>{' '}
              within 10 pts
            </span>
          </div>

          {report.milestoneStats.almostThereMembers.length > 0 && (
            <div className="almost-list">
              {report.milestoneStats.almostThereMembers.slice(0, 4).map((m) => (
                <div key={m.id} className="action-member-row">
                  <div>
                    <strong>{m.name}</strong>{' '}
                    <span className="mono-num" style={{ color: 'var(--text-secondary)' }}>
                      {m.points} pts
                    </span>
                  </div>
                  <button
                    type="button"
                    className="pt-btn compact"
                    aria-label={`Add 5 points to ${m.name}`}
                    onClick={() => onQuickAdjust(m, 5)}
                  >
                    +5
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="goal-bars">
            {report.clubComparisons
              .filter((item) => !lockedClub || item.club.id === lockedClub)
              .map((item) => (
                <div key={item.club.id} className="goal-bar-row">
                  <div className="hbar-label-row">
                    <span>{clubNames?.[item.club.id] ?? item.club.name}</span>
                    <span className="mono-num" style={{ fontSize: '0.8rem' }}>
                      {item.totalPoints} / {clubGoal}{' '}
                      {item.goalGap === 0 ? '· Goal met' : `· ${item.goalGap} to go`}
                    </span>
                  </div>
                  <div className="hbar-track">
                    <div
                      className="hbar-fill"
                      style={{
                        width: `${item.goalProgressPercent}%`,
                        backgroundColor: item.club.accent,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </article>

        {/* Panel 8: Needs Attention Watchlist */}
        <article className="studio-card studio-card-wide">
          <div className="studio-card-head">
            <div>
              <h3 className="studio-card-title">Needs Attention</h3>
            </div>
            <div className="sort-group">
              <label htmlFor={attentionInputId} className="sort-label">
                Under
              </label>
              <input
                id={attentionInputId}
                type="number"
                min={1}
                max={200}
                step={5}
                className="select-input mono-num"
                style={{ width: 76 }}
                value={attentionThreshold}
                onChange={(e) =>
                  setAttentionThreshold(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>
          </div>

          {report.needsAttention.length === 0 ? (
            <p className="empty-committee">
              None under {attentionThreshold} pts.
            </p>
          ) : (
            <div className="attention-grid">
              {report.needsAttention.map((member) => {
                const club = CLUBS.find((c) => c.id === member.clubId)!;
                const trimmedRole = member.role.trim();
                const showRole = trimmedRole && trimmedRole.toLowerCase() !== 'member';
                const style = {
                  '--club-accent': club.accent,
                  '--club-soft': club.softBg,
                  '--club-ink': club.ink,
                  '--club-border': club.border,
                } as CSSProperties;

                return (
                  <div key={member.id} className="attention-card" style={style}>
                    <div className="attention-info">
                      {!lockedClub && <span className="committee-club-pill">{club.name}</span>}
                      <strong>{member.name}</strong>
                      <span className="mono-num" style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {member.points} pts{showRole ? ` · ${trimmedRole}` : ''}
                      </span>
                    </div>
                    <div className="table-quick-actions">
                      <button
                        type="button"
                        className="pt-btn compact"
                        aria-label={`Add 5 points to ${member.name}`}
                        onClick={() => onQuickAdjust(member, 5)}
                      >
                        <Plus size={12} style={{ marginRight: 2 }} aria-hidden="true" />5
                      </button>
                      <button
                        type="button"
                        className="pt-btn compact custom"
                        aria-label={`Open custom points for ${member.name}`}
                        onClick={() => onOpenCustomPoints(member)}
                      >
                        <SlidersHorizontal size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
