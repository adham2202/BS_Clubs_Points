import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type { ClubMeta, Committee, Member } from '../types/tracker';
import { MemberRow } from './MemberRow';

interface CommitteeCardProps {
  club: ClubMeta;
  committee: Committee;
  members: Member[];
  totalMemberCount: number;
  totalPoints: number;
  showClubBadge: boolean;
  collapsed: boolean;
  selectedMemberIds: Set<string>;
  onToggleCollapse: (committeeId: string) => void;
  onToggleSelectMember: (memberId: string) => void;
  onToggleSelectCommittee: (memberIds: string[], shouldSelect: boolean) => void;
  onSelectMember: (member: Member) => void;
  onQuickAdjust: (member: Member, delta: number) => void;
  onSetExactOrRelativePoints: (member: Member, rawInput: string) => void;
  onOpenCustomPoints: (member: Member) => void;
  onOpenMemberHistory: (member: Member) => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (member: Member) => void;
  onQuickAddMember: (
    committee: Committee,
    payload: { name: string; phone: string; email: string; initialPoints: number },
  ) => void;
  onOpenAddMemberModal: (committee: Committee) => void;
  onEditCommittee: (committee: Committee) => void;
  onDeleteCommittee: (committee: Committee) => void;
}

export function CommitteeCard({
  club,
  committee,
  members,
  totalPoints,
  showClubBadge,
  collapsed,
  selectedMemberIds,
  onToggleCollapse,
  onToggleSelectMember,
  onToggleSelectCommittee,
  onSelectMember,
  onQuickAdjust,
  onSetExactOrRelativePoints,
  onOpenCustomPoints,
  onOpenMemberHistory,
  onEditMember,
  onDeleteMember,
  onQuickAddMember,
  onOpenAddMemberModal,
  onEditCommittee,
  onDeleteCommittee,
}: CommitteeCardProps) {
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickPoints, setQuickPoints] = useState('');
  const [quickExpanded, setQuickExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const visibleIds = members.map((m) => m.id);
  const selectedInCommittee = visibleIds.filter((id) => selectedMemberIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedInCommittee === visibleIds.length;
  const someVisibleSelected = selectedInCommittee > 0 && !allVisibleSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

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
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const cardStyle = {
    '--club-accent': club.accent,
    '--club-soft': club.softBg,
    '--club-ink': club.ink,
    '--club-border': club.border,
  } as CSSProperties;

  const handleQuickAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = quickName.trim();
    if (!trimmed) return;
    const parsedPts = quickPoints.trim() === '' ? 0 : Number(quickPoints);
    const initialPoints = Number.isFinite(parsedPts) ? Math.trunc(parsedPts) : 0;
    onQuickAddMember(committee, {
      name: trimmed,
      phone: quickPhone.trim(),
      email: quickEmail.trim(),
      initialPoints,
    });
    setQuickName('');
    setQuickPhone('');
    setQuickEmail('');
    setQuickPoints('');
  };

  const quickInputId = `quick-add-name-${committee.id}`;
  const quickPhoneId = `quick-add-phone-${committee.id}`;
  const quickEmailId = `quick-add-email-${committee.id}`;
  const quickPtsId = `quick-add-pts-${committee.id}`;
  const hasQuickDraft = Boolean(
    quickName.trim() || quickPhone.trim() || quickEmail.trim() || quickPoints.trim(),
  );
  const showQuickControls = quickExpanded || hasQuickDraft;

  return (
    <article
      id={`committee-card-${committee.id}`}
      className={`committee-card${collapsed ? ' collapsed' : ''}`}
      style={cardStyle}
    >
      <div className="committee-header">
        <div className="committee-header-left">
          {members.length > 0 && (
            <input
              ref={selectAllRef}
              type="checkbox"
              className="row-checkbox"
              checked={allVisibleSelected}
              aria-label={`Select all members in ${committee.name}`}
              onChange={() => onToggleSelectCommittee(visibleIds, !allVisibleSelected)}
            />
          )}

          <button
            type="button"
            className="committee-toggle"
            aria-expanded={!collapsed}
            onClick={() => onToggleCollapse(committee.id)}
          >
            {collapsed ? (
              <ChevronRight size={18} aria-hidden="true" />
            ) : (
              <ChevronDown size={18} aria-hidden="true" />
            )}
            <div className="committee-title-block">
              <div className="committee-title-line">
                <h3 className="committee-name">{committee.name}</h3>
                {showClubBadge && <span className="committee-club-pill">{club.name}</span>}
              </div>
            </div>
          </button>
        </div>

        <div className="committee-header-right">
          <span className="committee-pts mono-num">{totalPoints} pts</span>

          <div className="menu-wrapper" ref={menuRef}>
            <button
              type="button"
              className="btn-icon"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Committee actions for ${committee.name}`}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </button>

            {menuOpen && (
              <div
                className="dropdown-menu"
                role="menu"
                aria-label={`Actions for ${committee.name}`}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenAddMemberModal(committee);
                  }}
                >
                  <UserPlus size={15} aria-hidden="true" />
                  <span>Add / Bulk Paste</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onEditCommittee(committee);
                  }}
                >
                  <Pencil size={15} aria-hidden="true" />
                  <span>Edit Committee</span>
                </button>
                <div className="dropdown-divider" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteCommittee(committee);
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  <span>Delete Committee</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
          {members.length === 0 ? (
            <div className="empty-committee">No members yet.</div>
          ) : (
            <ul className="members-list" aria-label={`${committee.name} members`}>
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  selected={selectedMemberIds.has(member.id)}
                  onToggleSelect={onToggleSelectMember}
                  onOpenDetails={onSelectMember}
                  onQuickAdjust={onQuickAdjust}
                  onSetExactOrRelativePoints={onSetExactOrRelativePoints}
                  onOpenCustomPoints={onOpenCustomPoints}
                  onOpenHistory={onOpenMemberHistory}
                  onEditMember={onEditMember}
                  onDeleteMember={onDeleteMember}
                />
              ))}
            </ul>
          )}

          <form
            className={`quick-add-bar${showQuickControls ? ' expanded' : ''}`}
            onSubmit={handleQuickAddSubmit}
            onFocus={() => setQuickExpanded(true)}
            onBlur={(e) => {
              if (
                !e.currentTarget.contains(e.relatedTarget as Node | null) &&
                !hasQuickDraft
              ) {
                setQuickExpanded(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !hasQuickDraft) {
                setQuickExpanded(false);
                (document.activeElement as HTMLElement | null)?.blur?.();
              }
            }}
          >
            <label htmlFor={quickInputId} className="sr-only">
              Quick add member name to {committee.name}
            </label>
            <input
              id={quickInputId}
              type="text"
              className="quick-add-input"
              aria-label={`Quick add member name to ${committee.name}`}
              placeholder={showQuickControls ? 'Name' : '+ Add member'}
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
            />

            {showQuickControls && (
              <>
                <label htmlFor={quickPhoneId} className="sr-only">
                  Phone for new member in {committee.name}
                </label>
                <input
                  id={quickPhoneId}
                  type="tel"
                  className="quick-add-phone"
                  aria-label={`Phone for new member in ${committee.name}`}
                  placeholder="Phone"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                />

                <label htmlFor={quickEmailId} className="sr-only">
                  Email for new member in {committee.name}
                </label>
                <input
                  id={quickEmailId}
                  type="email"
                  className="quick-add-email"
                  aria-label={`Email for new member in ${committee.name}`}
                  placeholder="Email"
                  value={quickEmail}
                  onChange={(e) => setQuickEmail(e.target.value)}
                />

                <label htmlFor={quickPtsId} className="sr-only">
                  Starting points for new member in {committee.name}
                </label>
                <input
                  id={quickPtsId}
                  type="number"
                  step="1"
                  className="quick-add-pts mono-num"
                  aria-label={`Starting points for new member in ${committee.name}`}
                  placeholder="Pts"
                  value={quickPoints}
                  onChange={(e) => setQuickPoints(e.target.value)}
                />

                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={!quickName.trim()}
                >
                  <Plus size={14} aria-hidden="true" />
                  <span>Add</span>
                </button>
              </>
            )}
          </form>
        </>
      )}
    </article>
  );
}
