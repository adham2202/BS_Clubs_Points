import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  FileJson,
  FileSpreadsheet,
  History,
  Keyboard,
  Link2,
  LogOut,
  RotateCcw,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';
import { CLUB_MAP } from '../data/clubs';
import type { AuthSession } from '../state/auth';
import type { BrandingConfig } from '../state/branding';
import type { ClubId, WorkspaceView } from '../types/tracker';
import { ClubLogo } from './ClubLogo';

interface HeaderProps {
  session: AuthSession;
  lockedClub: ClubId | null;
  branding: BrandingConfig;
  activeView: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
  historyCount: number;
  onOpenActivity: () => void;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  onOpenDriveSync: () => void;
  onSignOut: () => void;
  onExportCsv: () => void;
  onExportCommitteeCsv: () => void;
  onExportJson: () => void;
  onImportJsonClick: () => void;
  onResetSample: () => void;
  onClearAll: () => void;
}

export function Header({
  session,
  lockedClub,
  branding,
  activeView,
  onChangeView,
  historyCount,
  onOpenActivity,
  onOpenShortcuts,
  onOpenSettings,
  onOpenDriveSync,
  onSignOut,
  onExportCsv,
  onExportCommitteeCsv,
  onExportJson,
  onImportJsonClick,
  onResetSample,
  onClearAll,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const headerTitle = lockedClub
    ? branding.clubs[lockedClub].name
    : branding.registryTitle;
  const headerLogoUrl = lockedClub
    ? branding.clubs[lockedClub].logoDataUrl
    : branding.registryLogoDataUrl;

  return (
    <header className="app-header">
      <div className="container header-inner">
        <div className="brand-group">
          <ClubLogo
            kind={lockedClub ?? 'registry'}
            logoDataUrl={headerLogoUrl}
            size="md"
          />
          <div>
            <h1 className="brand-title">{headerTitle}</h1>
          </div>
        </div>

        <nav className="workspace-nav" aria-label="Workspace views">
          <div className="workspace-tablist" role="tablist" aria-label="Primary workspace views">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'roster'}
              className="workspace-tab"
              onClick={() => onChangeView('roster')}
            >
              <span>Roster</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'analytics'}
              className="workspace-tab"
              onClick={() => onChangeView('analytics')}
            >
              <span>Analytics</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'leaderboard'}
              className="workspace-tab"
              onClick={() => onChangeView('leaderboard')}
            >
              <span>Leaderboard</span>
            </button>
            {!lockedClub && (
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'admin'}
                className="workspace-tab"
                onClick={() => onChangeView('admin')}
              >
                <span>Admin</span>
              </button>
            )}
          </div>
        </nav>

        <div className="header-actions">
          <div className="menu-wrapper" ref={menuRef}>
            <button
              type="button"
              className="btn header-menu-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Workspace menu"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <span
                className="club-dot"
                style={{
                  backgroundColor: lockedClub ? CLUB_MAP[lockedClub].accent : '#1C1917',
                }}
                aria-hidden="true"
              />
              <span className="header-menu-name">{session.officerName.split(' ')[0]}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>

            {menuOpen && (
              <div className="dropdown-menu" role="menu" aria-label="Workspace menu">
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenActivity();
                  }}
                >
                  <History size={16} aria-hidden="true" />
                  <span>Activity Log</span>
                  <span className="count-pill mono-num" style={{ marginLeft: 'auto' }}>
                    {historyCount}
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSettings();
                  }}
                >
                  <Settings size={16} aria-hidden="true" />
                  <span>{lockedClub ? 'Club Settings & Logo' : 'Club Settings & Logos'}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenDriveSync();
                  }}
                >
                  <Link2 size={16} aria-hidden="true" />
                  <span>Google Drive Sync</span>
                </button>
                <div className="dropdown-divider" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onExportCsv();
                  }}
                >
                  <Download size={16} aria-hidden="true" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onExportCommitteeCsv();
                  }}
                >
                  <FileSpreadsheet size={16} aria-hidden="true" />
                  <span>Committee CSV</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onExportJson();
                  }}
                >
                  <FileJson size={16} aria-hidden="true" />
                  <span>Export JSON</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onImportJsonClick();
                  }}
                >
                  <Upload size={16} aria-hidden="true" />
                  <span>Import JSON</span>
                </button>
                <div className="dropdown-divider" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenShortcuts();
                  }}
                >
                  <Keyboard size={16} aria-hidden="true" />
                  <span>Shortcuts</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onResetSample();
                  }}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  <span>Reset Data</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onClearAll();
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  <span>Clear Data</span>
                </button>
                <div className="dropdown-divider" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                >
                  <LogOut size={16} aria-hidden="true" />
                  <span>Switch Club</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
