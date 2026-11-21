import { X } from 'lucide-react';

interface ToastProps {
  message: string;
  canUndo: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

export function Toast({ message, canUndo, onUndo, onDismiss }: ToastProps) {
  return (
    <div className="toast-container" role="status" aria-live="polite">
      <div className="toast-card">
        <span>{message}</span>
        {canUndo && (
          <button type="button" className="toast-undo-btn" onClick={onUndo}>
            Undo
          </button>
        )}
        <button
          type="button"
          className="toast-close-btn"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
