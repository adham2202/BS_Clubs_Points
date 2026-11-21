import { useId, useMemo, useState, type FormEvent } from 'react';
import { CLUBS } from '../data/clubs';
import { parseBulkMembersInput } from '../state/selectors';
import type { ClubId, Committee, Member } from '../types/tracker';
import { Modal } from './Modal';

const ROLE_OPTIONS = ['Member', 'Coordinator', 'Chair', 'Treasurer', 'Secretary'] as const;

interface MemberModalProps {
  mode: 'add' | 'edit';
  initialCommittee: Committee;
  lockedClub?: ClubId | null;
  member?: Member;
  committees: Committee[];
  onAddSingle: (payload: {
    clubId: ClubId;
    committeeId: string;
    name: string;
    role: string;
    phone: string;
    email: string;
    initialPoints: number;
  }) => void;
  onAddBulk: (payload: {
    clubId: ClubId;
    committeeId: string;
    entries: Array<{
      name: string;
      role: string;
      phone?: string;
      email?: string;
      initialPoints: number;
    }>;
  }) => void;
  onUpdate: (payload: {
    memberId: string;
    clubId: ClubId;
    committeeId: string;
    name: string;
    role: string;
    phone: string;
    email: string;
    points: number;
  }) => void;
  onClose: () => void;
}

export function MemberModal({
  mode,
  initialCommittee,
  lockedClub = null,
  member,
  committees,
  onAddSingle,
  onAddBulk,
  onUpdate,
  onClose,
}: MemberModalProps) {
  const clubSelectId = useId();
  const committeeSelectId = useId();
  const nameInputId = useId();
  const pointsInputId = useId();
  const phoneInputId = useId();
  const emailInputId = useId();
  const bulkInputId = useId();

  const [tab, setTab] = useState<'single' | 'bulk'>('single');
  const [clubId, setClubId] = useState<ClubId>(member?.clubId ?? initialCommittee.clubId);
  const [committeeId, setCommitteeId] = useState<string>(
    member?.committeeId ?? initialCommittee.id,
  );
  const [name, setName] = useState(member?.name ?? '');
  const [role, setRole] = useState(member?.role ?? 'Member');
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [pointsDraft, setPointsDraft] = useState(
    mode === 'edit' && member ? String(member.points) : '0',
  );
  const [bulkText, setBulkText] = useState('');
  const [error, setError] = useState('');

  const availableCommittees = useMemo(
    () => committees.filter((c) => c.clubId === clubId),
    [committees, clubId],
  );

  const parsedBulk = useMemo(() => parseBulkMembersInput(bulkText), [bulkText]);

  const handleClubChange = (nextClub: ClubId) => {
    setClubId(nextClub);
    const firstInClub = committees.find((c) => c.clubId === nextClub);
    setCommitteeId(firstInClub?.id ?? '');
    setError('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!committeeId) {
      setError('Create or choose a committee in this club first.');
      return;
    }

    if (mode === 'edit' && member) {
      if (!name.trim()) {
        setError('Member name cannot be empty.');
        return;
      }
      const trimmedPts = pointsDraft.trim();
      const parsedPts = trimmedPts === '' ? member.points : Number(trimmedPts);
      if (!Number.isFinite(parsedPts)) {
        setError('Enter a valid integer for points.');
        return;
      }
      onUpdate({
        memberId: member.id,
        clubId,
        committeeId,
        name: name.trim(),
        role: role.trim() || 'Member',
        phone: phone.trim(),
        email: email.trim(),
        points: Math.trunc(parsedPts),
      });
      onClose();
      return;
    }

    if (tab === 'single') {
      if (!name.trim()) {
        setError('Please enter the member’s full name.');
        return;
      }
      const trimmedPts = pointsDraft.trim();
      const parsedPts = trimmedPts === '' ? 0 : Number(trimmedPts);
      if (!Number.isFinite(parsedPts)) {
        setError('Enter a valid integer for points.');
        return;
      }
      onAddSingle({
        clubId,
        committeeId,
        name: name.trim(),
        role: role.trim() || 'Member',
        phone: phone.trim(),
        email: email.trim(),
        initialPoints: Math.trunc(parsedPts),
      });
      onClose();
      return;
    }

    if (parsedBulk.length === 0) {
      setError('Paste at least one member name (one per line).');
      return;
    }

    onAddBulk({
      clubId,
      committeeId,
      entries: parsedBulk,
    });
    onClose();
  };

  return (
    <Modal
      title={mode === 'edit' ? `Edit Member — ${member?.name ?? ''}` : 'Add Member(s)'}
      onClose={onClose}
      maxWidth={520}
    >
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {mode === 'add' && (
            <div className="segmented-tabs" role="tablist" aria-label="Member entry mode">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'single'}
                className={`segmented-tab${tab === 'single' ? ' active' : ''}`}
                onClick={() => {
                  setTab('single');
                  setError('');
                }}
              >
                Single
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'bulk'}
                className={`segmented-tab${tab === 'bulk' ? ' active' : ''}`}
                onClick={() => {
                  setTab('bulk');
                  setError('');
                }}
              >
                Bulk Paste
              </button>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: lockedClub ? '1fr' : '1fr 1fr',
              gap: 10,
            }}
          >
            {!lockedClub && (
              <div className="form-field">
                <label htmlFor={clubSelectId} className="form-label">
                  Club
                </label>
                <select
                  id={clubSelectId}
                  className="select-input"
                  value={clubId}
                  onChange={(e) => handleClubChange(e.target.value as ClubId)}
                >
                  {CLUBS.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-field">
              <label htmlFor={committeeSelectId} className="form-label">
                Committee
              </label>
              <select
                id={committeeSelectId}
                className="select-input"
                value={committeeId}
                onChange={(e) => {
                  setCommitteeId(e.target.value);
                  setError('');
                }}
              >
                {availableCommittees.length === 0 ? (
                  <option value="">No committees in club</option>
                ) : (
                  availableCommittees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {mode === 'edit' || tab === 'single' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div className="form-field">
                  <label htmlFor={nameInputId} className="form-label">
                    Name
                  </label>
                  <input
                    id={nameInputId}
                    type="text"
                    className="text-input"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError('');
                    }}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor={pointsInputId} className="form-label">
                    Points
                  </label>
                  <input
                    id={pointsInputId}
                    type="number"
                    step="1"
                    className="text-input mono-num"
                    value={pointsDraft}
                    onChange={(e) => {
                      setPointsDraft(e.target.value);
                      setError('');
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-field">
                  <label htmlFor={phoneInputId} className="form-label">
                    Phone
                  </label>
                  <input
                    id={phoneInputId}
                    type="tel"
                    className="text-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor={emailInputId} className="form-label">
                    Email
                  </label>
                  <input
                    id={emailInputId}
                    type="email"
                    className="text-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-field">
                <span className="form-label">Role</span>
                <div className="chip-row" role="group" aria-label="Role">
                  {ROLE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`chip-btn${role.trim().toLowerCase() === option.toLowerCase() ? ' selected' : ''}`}
                      aria-pressed={role.trim().toLowerCase() === option.toLowerCase()}
                      onClick={() => setRole(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="form-field">
              <label htmlFor={bulkInputId} className="form-label">
                Name, Phone, Email, Points (one per line)
              </label>
              <textarea
                id={bulkInputId}
                className="textarea-input"
                value={bulkText}
                onChange={(e) => {
                  setBulkText(e.target.value);
                  setError('');
                }}
              />
              {parsedBulk.length > 0 && (
                <p className="form-hint mono-num">{parsedBulk.length} ready</p>
              )}
            </div>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {mode === 'edit'
              ? 'Save Changes'
              : tab === 'bulk'
                ? `Import ${parsedBulk.length || ''} Members`.trim()
                : 'Add Member'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
