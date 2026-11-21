import type { CSSProperties } from 'react';
import { Copy, History, Mail, Pencil, Phone, SlidersHorizontal } from 'lucide-react';
import { getInitials } from '../state/selectors';
import type { Member } from '../types/tracker';
import { Modal } from './Modal';

interface MemberDetailModalProps {
  member: Member;
  committeeName: string;
  clubName: string;
  clubAccent: string;
  clubSoft: string;
  clubInk: string;
  clubBorder: string;
  showClubName: boolean;
  onQuickAdjust: (member: Member, delta: number) => void;
  onOpenCustomPoints: (member: Member) => void;
  onOpenHistory: (member: Member) => void;
  onEditMember: (member: Member) => void;
  onCopyText: (value: string, label: string) => void;
  onClose: () => void;
}

const QUICK_DELTAS = [-1, 1, 5, 10] as const;

export function MemberDetailModal({
  member,
  committeeName,
  clubName,
  clubAccent,
  clubSoft,
  clubInk,
  clubBorder,
  showClubName,
  onQuickAdjust,
  onOpenCustomPoints,
  onOpenHistory,
  onEditMember,
  onCopyText,
  onClose,
}: MemberDetailModalProps) {
  const trimmedRole = member.role.trim();
  const showRoleBadge =
    Boolean(trimmedRole) && trimmedRole.toLowerCase() !== 'member';
  const isChair = trimmedRole.toLowerCase() === 'chair';

  const style = {
    '--club-accent': clubAccent,
    '--club-soft': clubSoft,
    '--club-ink': clubInk,
    '--club-border': clubBorder,
  } as CSSProperties;

  return (
    <Modal title={member.name} onClose={onClose} maxWidth={460}>
      <div className="modal-body" style={style}>
        <div className="detail-top-strip">
          <span className="member-avatar" aria-hidden="true">
            {getInitials(member.name)}
          </span>
          <div className="detail-meta-wrap">
            {showClubName && <span className="committee-club-pill">{clubName}</span>}
            <span className="detail-committee-name">{committeeName}</span>
            {showRoleBadge && (
              <span className={`member-role-badge${isChair ? ' chair' : ''}`}>
                {trimmedRole}
              </span>
            )}
          </div>
        </div>

        <div className="detail-points-card">
          <div className="detail-points-val mono-num">
            {member.points}
            <span className="points-unit"> pts</span>
          </div>

          <div className="detail-points-controls">
            <div
              className="quick-points-group"
              role="group"
              aria-label={`Adjust points for ${member.name}`}
            >
              {QUICK_DELTAS.map((delta) => {
                const label = delta > 0 ? `+${delta}` : String(delta);
                return (
                  <button
                    key={delta}
                    type="button"
                    className={`pt-btn${delta < 0 ? ' minus' : ''}`}
                    aria-label={`${delta > 0 ? 'Add' : 'Subtract'} ${Math.abs(delta)} points for ${member.name}`}
                    onClick={() => onQuickAdjust(member, delta)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onOpenCustomPoints(member)}
            >
              <SlidersHorizontal size={13} aria-hidden="true" />
              <span>Custom</span>
            </button>
          </div>
        </div>

        <div className="detail-contact-list" aria-label="Contact details">
          <div className="detail-contact-row">
            <div className="detail-contact-left">
              <Phone size={15} className="detail-contact-icon" aria-hidden="true" />
              {member.phone ? (
                <a
                  href={`tel:${member.phone.replace(/\s+/g, '')}`}
                  className="detail-contact-link mono-num"
                >
                  {member.phone}
                </a>
              ) : (
                <button
                  type="button"
                  className="detail-empty-action"
                  onClick={() => onEditMember(member)}
                >
                  Add phone
                </button>
              )}
            </div>
            {member.phone && (
              <button
                type="button"
                className="btn-icon"
                aria-label={`Copy phone for ${member.name}`}
                onClick={() => onCopyText(member.phone!, 'phone')}
              >
                <Copy size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="detail-contact-row">
            <div className="detail-contact-left">
              <Mail size={15} className="detail-contact-icon" aria-hidden="true" />
              {member.email ? (
                <a href={`mailto:${member.email}`} className="detail-contact-link">
                  {member.email}
                </a>
              ) : (
                <button
                  type="button"
                  className="detail-empty-action"
                  onClick={() => onEditMember(member)}
                >
                  Add email
                </button>
              )}
            </div>
            {member.email && (
              <button
                type="button"
                className="btn-icon"
                aria-label={`Copy email for ${member.name}`}
                onClick={() => onCopyText(member.email!, 'email')}
              >
                <Copy size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn" onClick={() => onOpenHistory(member)}>
          <History size={15} aria-hidden="true" />
          <span>History</span>
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onEditMember(member)}
        >
          <Pencil size={15} aria-hidden="true" />
          <span>Edit</span>
        </button>
      </div>
    </Modal>
  );
}
