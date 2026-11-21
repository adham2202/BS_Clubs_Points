import { useEffect, useId, useRef, useState } from 'react';
import {
  Check,
  Link2,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { CLUBS } from '../data/clubs';
import type { ClubStat } from '../state/selectors';
import type { ClubFilter, ClubId, DensityMode, RoleFilter, SortOption } from '../types/tracker';

interface ToolbarProps {
  lockedClub?: ClubId | null;
  summaryText?: string;
  clubStats?: ClubStat[];
  clubNames?: Record<ClubId, string>;
  activeClub: ClubFilter;
  onClubChange: (club: ClubFilter) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  roleFilter: RoleFilter;
  availableRoles: string[];
  onRoleFilterChange: (role: RoleFilter) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  density: DensityMode;
  onToggleDensity: () => void;
  allCollapsed: boolean;
  onToggleCollapseAll: () => void;
  onAddCommittee: () => void;
  onOpenDriveSync?: () => void;
  hasLinkedDrive?: boolean;
  hasVisibleCommittees: boolean;
}

export function Toolbar({
  lockedClub = null,
  summaryText = '',
  clubStats,
  clubNames,
  activeClub,
  onClubChange,
  searchQuery,
  onSearchChange,
  searchInputRef,
  roleFilter,
  availableRoles,
  onRoleFilterChange,
  sort,
  onSortChange,
  density,
  onToggleDensity,
  allCollapsed,
  onToggleCollapseAll,
  onAddCommittee,
  onOpenDriveSync,
  hasLinkedDrive = false,
  hasVisibleCommittees,
}: ToolbarProps) {
  const roleSelectId = useId();
  const sortSelectId = useId();
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [filterOpen]);

  const hasActiveFilter =
    roleFilter !== 'all' || sort !== 'points-desc' || density === 'compact';

  return (
    <section className="roster-bar" aria-label="Roster controls">
      {lockedClub ? (
        <div className="roster-summary mono-num">{summaryText}</div>
      ) : (
        <div className="club-tabs" role="tablist" aria-label="Filter by club">
          <button
            type="button"
            role="tab"
            aria-selected={activeClub === 'all'}
            className="club-tab"
            onClick={() => onClubChange('all')}
          >
            <span>All</span>
          </button>

          {CLUBS.map((club) => {
            const clubStat = clubStats?.find((s) => s.club.id === club.id);
            return (
              <button
                key={club.id}
                type="button"
                role="tab"
                aria-selected={activeClub === club.id}
                className="club-tab"
                onClick={() => onClubChange(club.id)}
              >
                <span
                  className="club-dot"
                  style={{ backgroundColor: club.accent }}
                  aria-hidden="true"
                />
                <span>{clubNames?.[club.id] ?? club.name}</span>
                {clubStat && (
                  <span className="club-tab-pts mono-num">{clubStat.totalPoints}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="roster-controls">
        <div className="search-box">
          <label htmlFor="tracker-search" className="sr-only">
            Search committees or members
          </label>
          <Search size={15} className="search-icon" aria-hidden="true" />
          <input
            ref={searchInputRef}
            id="tracker-search"
            type="search"
            className="search-input"
            aria-label="Search committees or members"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear"
              aria-label="Clear search"
              onClick={() => onSearchChange('')}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="menu-wrapper" ref={filterRef}>
          <button
            type="button"
            className="btn"
            aria-haspopup="true"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((prev) => !prev)}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>Filter</span>
            {hasActiveFilter && <span className="filter-active-dot" aria-hidden="true" />}
          </button>

          {filterOpen && (
            <div className="filter-popover" role="region" aria-label="View and filter options">
              <div className="filter-popover-row">
                <label htmlFor={roleSelectId} className="sr-only">
                  Role
                </label>
                <select
                  id={roleSelectId}
                  className="select-input"
                  aria-label="Filter by member role"
                  value={roleFilter}
                  onChange={(e) => onRoleFilterChange(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-popover-row">
                <label htmlFor={sortSelectId} className="sr-only">
                  Sort
                </label>
                <select
                  id={sortSelectId}
                  className="select-input"
                  aria-label="Sort members"
                  value={sort}
                  onChange={(e) => onSortChange(e.target.value as SortOption)}
                >
                  <option value="points-desc">Pts: High → Low</option>
                  <option value="points-asc">Pts: Low → High</option>
                  <option value="name-asc">Name: A → Z</option>
                  <option value="recent">Recent</option>
                </select>
              </div>

              <div className="dropdown-divider" role="separator" />

              <button
                type="button"
                className="dropdown-item"
                aria-pressed={density === 'compact'}
                onClick={onToggleDensity}
              >
                <span>Compact rows</span>
                {density === 'compact' && (
                  <Check size={14} aria-hidden="true" style={{ marginLeft: 'auto' }} />
                )}
              </button>

              {hasVisibleCommittees && (
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    onToggleCollapseAll();
                    setFilterOpen(false);
                  }}
                >
                  <span>{allCollapsed ? 'Expand all' : 'Collapse all'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {onOpenDriveSync && (
          <button type="button" className="btn" onClick={onOpenDriveSync}>
            <Link2 size={14} aria-hidden="true" />
            <span>Drive</span>
            {hasLinkedDrive && (
              <span className="filter-active-dot" aria-hidden="true" />
            )}
          </button>
        )}

        <button type="button" className="btn btn-primary" onClick={onAddCommittee}>
          <Plus size={15} aria-hidden="true" />
          <span>Add Committee</span>
        </button>
      </div>
    </section>
  );
}
