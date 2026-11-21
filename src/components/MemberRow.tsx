import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  History,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { getInitials } from '../state/selectors';
import type { Member } from '../types/tracker';

interface MemberRowProps {
  member: Member;
  selected: boolean;
  onToggleSelect: (memberId: string) => void;
  onOpenDetails: (member: Member) => void;
  onQuickAdjust: (member: Member, delta: number) => void;
  onSetExactOrRelativePoints: (member: Member, rawInput: string) => void;
  onOpenCustomPoints: (member: Member) => void;
  onOpenHistory: (member: Member) => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (member: Member) => void;
}

const QUICK_DELTAS = [-1, 1, 5, 10] as const;

export function MemberRow({
  member,
  selected,
  onToggleSelect,
  onOpenDetails,
  onQuickAdjust,
  onSetExactOrRelativePoints,
  onOpenCustomPoints,
  onOpenHistory,
  onEditMember,
  onDeleteMember,
}: MemberRowProps) {
  const [editingScore, setEditingScore] = useState(false);
  const [scoreDraft, setScoreDraft] = useState(String(member.points));
  const [menuOpen, setMenuOpen] = useState(false);
  const scoreInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingScore) {
      scoreInputRef.current?.focus();
      scoreInputRef.current?.select();
    }
  }, [editingScore]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown as unknown as EventListener);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown as unknown as EventListener);
    };
  }, [menuOpen]);

  const commitScoreEdit = () => {
    const trimmed = scoreDraft.trim();
    setEditingScore(false);
    if (!trimmed) return;
    onSetExactOrRelativePoints(member, trimmed);
  };

  const handleScoreKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitScoreEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingScore(false);
      setScoreDraft(String(member.points));
    }
  };

  const trimmedRole = member.role.trim();
  const showRoleBadge =
    Boolean(trimmedRole) && trimmedRole.toLowerCase() !== 'member';
  const isChair = trimmedRole.toLowerCase() === 'chair';
  const contactTooltip =
    [member.phone, member.email].filter(Boolean).join(' · ') || undefined;

  return (
    <li className={`member-row${selected ? ' selected' : ''}`}>
      <div className="member-info">
        <input
          type="checkbox"
          className="row-checkbox"
          checked={selected}
          aria-label={`Select ${member.name} for batch actions`}
          onChange={() => onToggleSelect(member.id)}
        />

        <button
          type="button"
          className="member-identity-btn"
          aria-label={`View details for ${member.name}`}
          title={contactTooltip}
          onClick={() => onOpenDetails(member)}
        >
          <span className="member-avatar" aria-hidden="true">
            {getInitials(member.name)}
          </span>

          <span className="member-name">{member.name}</span>
        </button>

        {showRoleBadge && (
          <span className={`member-role-badge${isChair ? ' chair' : ''}`}>
            {trimmedRole}
          </span>
        )}
      </div>

      <div className="member-actions-cluster">
        {editingScore ? (
          <input
            ref={scoreInputRef}
            type="text"
            inputMode="numeric"
            className="points-inline-input mono-num"
            aria-label={`Edit points for ${member.name}`}
            value={scoreDraft}
            onChange={(e) => setScoreDraft(e.target.value)}
            onBlur={commitScoreEdit}
            onKeyDown={handleScoreKeyDown}
          />
        ) : (
          <button
            type="button"
            className={`points-badge mono-num${member.points < 0 ? ' negative' : ''}`}
            aria-label={`${member.name} has ${member.points} points. Click to edit score.`}
            onClick={() => {
              setScoreDraft(String(member.points));
              setEditingScore(true);
            }}
          >
            {member.points}
            <span className="points-unit">pts</span>
          </button>
        )}

        <div
          className="quick-points-group"
          role="group"
          aria-label={`Adjust points for ${member.name}`}
        >
          {QUICK_DELTAS.map((delta) => {
            const label = delta > 0 ? `+${delta}` : String(delta);
            const actionText =
              delta > 0
                ? `Add ${delta} ${delta === 1 ? 'point' : 'points'} to ${member.name}`
                : `Subtract ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'point' : 'points'} from ${member.name}`;

            return (
              <button
                key={delta}
                type="button"
                className={`pt-btn${delta < 0 ? ' minus' : ''}`}
                aria-label={actionText}
                onClick={() => onQuickAdjust(member, delta)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="menu-wrapper" ref={menuRef}>
          <button
            type="button"
            className="btn-icon"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Actions for ${member.name}`}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>

          {menuOpen && (
            <div className="dropdown-menu" role="menu" aria-label={`Actions for ${member.name}`}>
              <button
                type="button"
                role="menuitem"
                className="dropdown-item"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenCustomPoints(member);
                }}
              >
                <SlidersHorizontal size={15} aria-hidden="true" />
                <span>Custom Points…</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="dropdown-item"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenHistory(member);
                }}
              >
                <History size={15} aria-hidden="true" />
                <span>History</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="dropdown-item"
                onClick={() => {
                  setMenuOpen(false);
                  onEditMember(member);
                }}
              >
                <Pencil size={15} aria-hidden="true" />
                <span>Edit</span>
              </button>
              <div className="dropdown-divider" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="dropdown-item danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDeleteMember(member);
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
                <span>Remove</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
