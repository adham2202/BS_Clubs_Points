import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import {
  addPointPreset,
  addReasonPreset,
  cloneDefaultClubPresets,
  removePointPreset,
  removeReasonPreset,
  type ClubScoringPresets,
} from '../state/presets';
import { Modal } from './Modal';

interface BatchPointsModalProps {
  selectedCount: number;
  selectedNames: string[];
  presets: ClubScoringPresets;
  onUpdatePresets: (next: ClubScoringPresets) => void;
  onApply: (delta: number, reason: string) => void;
  onClose: () => void;
}

export function BatchPointsModal({
  selectedCount,
  selectedNames,
  presets,
  onUpdatePresets,
  onApply,
  onClose,
}: BatchPointsModalProps) {
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

  const previewNames =
    selectedNames.length <= 4
      ? selectedNames.join(', ')
      : `${selectedNames.slice(0, 3).join(', ')} + ${selectedNames.length - 3} more`;

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
    onApply(validDelta, reason.trim() || 'Batch adjustment');
    onClose();
  };

  return (
    <Modal title={`Batch Adjust — ${selectedCount} Members`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="points-preview-box">
            <div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Selected Recipients
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                {previewNames}
              </div>
            </div>
            <div className="mono-num" style={{ fontWeight: 700, fontSize: '0.96rem' }}>
              {validDelta > 0 ? `+${validDelta}` : validDelta} pts each
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
            Apply to {selectedCount} Members
          </button>
        </div>
      </form>
    </Modal>
  );
}
