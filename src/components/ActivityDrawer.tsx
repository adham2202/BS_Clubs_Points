import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { CLUBS, CLUB_MAP } from '../data/clubs';
import { formatRelativeTime } from '../state/selectors';
import type { ClubFilter, ClubId, Member, PointEvent } from '../types/tracker';

interface ActivityDrawerProps {
  lockedClub?: ClubId | null;
  history: PointEvent[];
  focusMember: Member | null;
  onClearFocusMember: () => void;
  onRevertEvent: (eventId: string) => void;
  onClose: () => void;
}

export function ActivityDrawer({
  lockedClub = null,
  history,
  focusMember,
  onClearFocusMember,
  onRevertEvent,
  onClose,
}: ActivityDrawerProps) {
  const titleId = useId();
  const clubSelectId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [clubFilter, setClubFilter] = useState<ClubFilter>(
    focusMember ? focusMember.clubId : 'all',
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  const filteredEvents = useMemo(() => {
    return history.filter((evt) => {
      if (focusMember && evt.memberId !== focusMember.id) return false;
      if (!focusMember && clubFilter !== 'all' && evt.clubId !== clubFilter) return false;
      return true;
    });
  }, [history, focusMember, clubFilter]);

  return (
    <div
      className="drawer-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <h2 id={titleId} className="modal-title">
              {focusMember ? `History — ${focusMember.name}` : 'Point Activity Log'}
            </h2>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close activity log"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {(focusMember || !lockedClub) && (
          <div
            style={{
              padding: '10px 18px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              background: '#faf8f3',
            }}
          >
            {focusMember ? (
              <button type="button" className="btn btn-sm" onClick={onClearFocusMember}>
                Show All Members
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <label htmlFor={clubSelectId} className="sort-label">
                  Club
                </label>
                <select
                  id={clubSelectId}
                  className="select-input"
                  style={{ flex: 1, height: 34 }}
                  value={clubFilter}
                  onChange={(e) => setClubFilter(e.target.value as ClubFilter)}
                >
                  <option value="all">All Clubs</option>
                  {CLUBS.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="drawer-body">
          {filteredEvents.length === 0 ? (
            <div className="empty-committee">
              No activity yet.
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const club = CLUB_MAP[evt.clubId];
              const deltaText = evt.delta > 0 ? `+${evt.delta}` : String(evt.delta);
              return (
                <div
                  key={evt.id}
                  className={`history-item${evt.reverted ? ' reverted' : ''}`}
                >
                  <div className="history-top">
                    <div>
                      <strong>{evt.memberName}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {lockedClub ? evt.committeeName : `${club.name} · ${evt.committeeName}`}
                      </div>
                    </div>
                    <span className={`history-delta ${evt.delta >= 0 ? 'pos' : 'neg'}`}>
                      {deltaText} pts
                    </span>
                  </div>

                  <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                    {evt.reason}{' '}
                    <span className="mono-num" style={{ color: 'var(--text-secondary)' }}>
                      ({evt.previousPoints} &rarr; {evt.newPoints})
                    </span>
                  </div>

                  <div className="history-meta">
                    <span>
                      {formatRelativeTime(evt.timestamp)}
                      {evt.reverted ? ' · Reverted' : ''}
                    </span>

                    {!evt.reverted && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onRevertEvent(evt.id)}
                      >
                        <RotateCcw size={13} aria-hidden="true" />
                        <span>Revert</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
