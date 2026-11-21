import { useId, useState, type FormEvent } from 'react';
import { CLUBS } from '../data/clubs';
import type { ClubId, Committee } from '../types/tracker';
import { Modal } from './Modal';

interface CommitteeModalProps {
  mode: 'add' | 'edit';
  defaultClubId: ClubId;
  lockedClub?: ClubId | null;
  committee?: Committee;
  onSave: (payload: {
    clubId: ClubId;
    name: string;
    description: string;
    committeeId?: string;
  }) => void;
  onClose: () => void;
}

export function CommitteeModal({
  mode,
  defaultClubId,
  lockedClub = null,
  committee,
  onSave,
  onClose,
}: CommitteeModalProps) {
  const clubSelectId = useId();
  const nameInputId = useId();

  const [clubId, setClubId] = useState<ClubId>(
    lockedClub ?? committee?.clubId ?? defaultClubId,
  );
  const [name, setName] = useState(committee?.name ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a committee name.');
      return;
    }
    onSave({
      committeeId: committee?.id,
      clubId,
      name: name.trim(),
      description: committee?.description ?? '',
    });
    onClose();
  };

  return (
    <Modal
      title={mode === 'edit' ? `Edit Committee — ${committee?.name ?? ''}` : 'Add Committee'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {!lockedClub && (
            <div className="form-field">
              <label htmlFor={clubSelectId} className="form-label">
                Club
              </label>
              <select
                id={clubSelectId}
                className="select-input"
                value={clubId}
                onChange={(e) => setClubId(e.target.value as ClubId)}
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
            <label htmlFor={nameInputId} className="form-label">
              Committee Name
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
            {mode === 'edit' ? 'Save Committee' : 'Create Committee'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
