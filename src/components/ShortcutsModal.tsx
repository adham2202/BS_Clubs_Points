import { Modal } from './Modal';

interface ShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: '/', description: 'Search' },
  { keys: '1 / 2 / 3', description: 'Switch view' },
  { keys: 'Ctrl + Z', description: 'Undo' },
  { keys: 'Enter', description: 'Edit score' },
  { keys: 'Esc', description: 'Close / clear' },
  { keys: '?', description: 'Shortcuts' },
] as const;

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <Modal title="Keyboard Shortcuts" onClose={onClose} maxWidth={460}>
      <div className="modal-body">
        <div className="shortcuts-list">
          {SHORTCUTS.map((item) => (
            <div key={item.keys} className="shortcut-row">
              <kbd className="kbd-pill mono-num">{item.keys}</kbd>
              <span className="shortcut-desc">{item.description}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
