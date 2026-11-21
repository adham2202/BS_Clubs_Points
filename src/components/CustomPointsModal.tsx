import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { CLUB_MAP } from '../data/clubs';
import {
  addPointPreset,
  addReasonPreset,
  cloneDefaultClubPresets,
  removePointPreset,
  removeReasonPreset,
  type ClubScoringPresets,
} from '../state/presets';
import type { Member } from '../types/tracker';
import { Modal } from './Modal';

interface CustomPointsModalProps {
  member: Member;
  committeeName: string;
  presets: ClubScoringPresets;
  onUpdatePresets: (next: ClubScoringPresets) => void;
  onApply: (memberId: string, delta: number, reason: string) => void;
  onClose: () => void;
}

export function CustomPointsModal({
  member,
  committeeName,
  presets,
  onUpdatePresets,
  onApply,
  onClose,
}: CustomPointsModalProps) {
  const deltaId = useId();
  const reasonId = useId();
  const newPointId = useId();
  const newReasonId = useId();

  const [deltaInput, setDeltaInput] = useState(
    String(presets.points[1] ?? presets.points[0] ?? 5),
  );
  const [reason, setReason] = useState('');
  const [editingPresets, setEditingPresets] = useState(false);
  const [newPointInput, setNewPointInput] = useState('');
  const [newReasonInput, setNewReasonInput] = useState('');
  const [error, setError] = useState('');

  const parsedDelta = Number(deltaInput);
  const validDelta =
    deltaInput.trim() !== '' && Number.isFinite(parsedDelta) ? Math.trunc(parsedDelta) : 0;
  const projectedTotal = member.points + validDelta;

  const handleAddPoint = () => {
    const parsed = Number(newPointInput);
    const nextPoints = addPointPreset(presets.points, parsed);
    if (nextPoints !== presets.points) {
      onUpdatePresets({ ...presets, points: nextPoints });
      setNewPointInput('');
    }
  };

  const handleAddReason = () => {
    const nextReasons = addReasonPreset(presets.reasons, newReasonInput);
    if (nextReasons !== presets.reasons) {
      onUpdatePresets({ ...presets, reasons: nextReasons });
      setNewReasonInput('');
    }
  };

  const handlePointKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAddPoint();
    }
  };

  const handleReasonKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAddReason();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (deltaInput.trim() === '' || !Number.isFinite(parsedDelta) || validDelta === 0) {
      setError('Enter a non-zero integer point adjustment.');
      return;
    }
    onApply(member.id, validDelta, reason.trim() || 'Custom adjustment');
    onClose();
  };

  return (
    <Modal title={`Adjust Points — ${member.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="points-preview-box">
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {CLUB_MAP[member.clubId].name} &middot; {committeeName}
              </div>
              <div style={{ fontWeight: 700 }}>{member.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Total Preview
              </div>
              <div className="mono-num" style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                {member.points} &rarr; {projectedTotal} pts
              </div>
            </div>
          </div>

          <div className="form-field">
            <div className="preset-section-head">
              <span className="form-label">Quick Presets</span>
              <div className="preset-head-actions">
                {editingPresets && (
                  <button
                    type="button"
                    className="preset-edit-toggle"
                    onClick={() => onUpdatePresets(cloneDefaultClubPresets())}
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  className="preset-edit-toggle"
                  onClick={() => setEditingPresets((prev) => !prev)}
                >
                  {editingPresets ? 'Done' : 'Customize'}
                </button>
              </div>
            </div>

            <div className="chip-row">
              {presets.points.map((preset) =>
                editingPresets ? (
                  <span
                    key={preset}
                    className={`chip-btn removable mono-num${validDelta === preset ? ' selected' : ''}`}
                  >
                    <span>{preset > 0 ? `+${preset}` : preset}</span>
                    <button
                      type="button"
                      className="chip-remove-icon"
                      aria-label={`Remove ${preset > 0 ? `+${preset}` : preset} preset`}
                      onClick={() =>
                        onUpdatePresets({
                          ...presets,
                          points: removePointPreset(presets.points, preset),
                        })
                      }
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </span>
                ) : (
                  <button
                    key={preset}
                    type="button"
                    className={`chip-btn mono-num${validDelta === preset ? ' selected' : ''}`}
                    onClick={() => {
                      setDeltaInput(String(preset));
                      setError('');
                    }}
                  >
                    {preset > 0 ? `+${preset}` : preset}
                  </button>
                ),
              )}
            </div>

            {editingPresets && (
              <div className="preset-inline-add">
                <label htmlFor={newPointId} className="sr-only">
                  Add point preset
                </label>
                <input
                  id={newPointId}
                  type="number"
                  step="1"
                  className="text-input mono-num"
                  placeholder="+15"
                  value={newPointInput}
                  onChange={(e) => setNewPointInput(e.target.value)}
                  onKeyDown={handlePointKeyDown}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!newPointInput.trim() || Number(newPointInput) === 0}
                  onClick={handleAddPoint}
                >
                  Add
                </button>
              </div>
            )}
          </div>

          <div className="form-field">
            <label htmlFor={deltaId} className="form-label">
              Points
            </label>
            <input
              id={deltaId}
              type="number"
              step="1"
              className="text-input mono-num"
              value={deltaInput}
              onChange={(e) => {
                setDeltaInput(e.target.value);
                setError('');
              }}
            />
          </div>

          <div className="form-field">
            <span className="form-label">Quick Reasons</span>
            <div className="chip-row">
              {presets.reasons.map((chip) =>
                editingPresets ? (
                  <span
                    key={chip}
                    className={`chip-btn removable${reason === chip ? ' selected' : ''}`}
                  >
                    <span>{chip}</span>
                    <button
                      type="button"
                      className="chip-remove-icon"
                      aria-label={`Remove ${chip} reason preset`}
                      onClick={() =>
                        onUpdatePresets({
                          ...presets,
                          reasons: removeReasonPreset(presets.reasons, chip),
                        })
                      }
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </span>
                ) : (
                  <button
                    key={chip}
                    type="button"
                    className={`chip-btn${reason === chip ? ' selected' : ''}`}
                    onClick={() => setReason(chip)}
                  >
                    {chip}
                  </button>
                ),
              )}
            </div>

            {editingPresets && (
              <div className="preset-inline-add">
                <label htmlFor={newReasonId} className="sr-only">
                  Add reason preset
                </label>
                <input
                  id={newReasonId}
                  type="text"
                  className="text-input"
                  placeholder="Add reason"
                  value={newReasonInput}
                  onChange={(e) => setNewReasonInput(e.target.value)}
                  onKeyDown={handleReasonKeyDown}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!newReasonInput.trim()}
                  onClick={handleAddReason}
                >
                  Add
                </button>
              </div>
            )}
          </div>

          <div className="form-field">
            <label htmlFor={reasonId} className="form-label">
              Reason
            </label>
            <input
              id={reasonId}
              type="text"
              className="text-input"
              placeholder="Optional"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
            Apply Points
          </button>
        </div>
      </form>
    </Modal>
  );
}
