import { useId, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

interface BatchActionBarProps {
  selectedCount: number;
  onApplyBatch: (delta: number, reason: string) => void;
  onOpenCustomBatch: () => void;
  onClearSelection: () => void;
}

const BATCH_DELTAS = [-1, 1, 5, 10] as const;

export function BatchActionBar({
  selectedCount,
  onApplyBatch,
  onOpenCustomBatch,
  onClearSelection,
}: BatchActionBarProps) {
  const reasonId = useId();
  const [reason, setReason] = useState('');

  if (selectedCount === 0) return null;

  const handleApply = (delta: number) => {
    onApplyBatch(delta, reason.trim() || 'Batch adjustment');
    setReason('');
  };

  return (
    <div className="batch-bar-wrap" role="region" aria-label="Batch point actions">
      <div className="batch-bar">
        <div className="batch-count-badge">
          <span className="mono-num">{selectedCount}</span> selected
        </div>

        <div className="batch-reason-wrap">
          <label htmlFor={reasonId} className="sr-only">
            Reason for batch point adjustment
          </label>
          <input
            id={reasonId}
            type="text"
            className="batch-reason-input"
            aria-label="Reason for batch point adjustment"
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="batch-buttons" role="group" aria-label="Batch point adjustments">
          {BATCH_DELTAS.map((delta) => {
            const label = delta > 0 ? `+${delta}` : String(delta);
            return (
              <button
                key={delta}
                type="button"
                className="batch-pt-btn mono-num"
                aria-label={`${delta > 0 ? 'Add' : 'Subtract'} ${Math.abs(delta)} points for ${selectedCount} selected members`}
                onClick={() => handleApply(delta)}
              >
                {label}
              </button>
            );
          })}

          <button
            type="button"
            className="batch-pt-btn custom"
            onClick={onOpenCustomBatch}
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            <span>Custom</span>
          </button>
        </div>

        <button
          type="button"
          className="batch-clear-btn"
          aria-label="Clear member selection"
          onClick={onClearSelection}
        >
          <X size={14} aria-hidden="true" />
          <span>Clear</span>
        </button>
      </div>
    </div>
  );
}
