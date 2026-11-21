import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { Plus } from 'lucide-react';
import { ActivityDrawer } from './components/ActivityDrawer';
import { AdminView } from './components/AdminView';
import { AnalyticsView } from './components/AnalyticsView';
import { BatchActionBar } from './components/BatchActionBar';
import { BatchPointsModal } from './components/BatchPointsModal';
import { ClubLoginPage } from './components/ClubLoginPage';
import { ClubSettingsModal } from './components/ClubSettingsModal';
import { CommitteeCard } from './components/CommitteeCard';
import { CommitteeModal } from './components/CommitteeModal';
import { ConfirmModal } from './components/ConfirmModal';
import { CustomPointsModal } from './components/CustomPointsModal';
import { DriveSyncModal } from './components/DriveSyncModal';
import { Header } from './components/Header';
import { LeaderboardView } from './components/LeaderboardView';
import { MemberDetailModal } from './components/MemberDetailModal';
import { MemberModal } from './components/MemberModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Toast } from './components/Toast';
import { Toolbar } from './components/Toolbar';
import { CLUB_MAP } from './data/clubs';
import {
  clearSession,
  isManagerAuthorized,
  loadManagers,
  loadPasscodes,
  loadSession,
  resetManagers,
  resetPasscodes,
  saveManagers,
  savePasscodes,
  saveSession,
  type AuthSession,
  type ClubManagers,
  type ClubPasscodes,
} from './state/auth';
import {
  loadBranding,
  resetBranding,
  saveBranding,
  type BrandingConfig,
} from './state/branding';
import {
  loadDriveSources,
  resetDriveSources,
  saveDriveSources,
  type ClubDriveSources,
} from './state/driveSync';
import {
  loadPresets,
  resetPresets,
  savePresets,
  type AllClubPresets,
} from './state/presets';
import {
  buildCommitteeSummaryCsv,
  buildCsv,
  filterCommitteesAndMembers,
  getClubStats,
  getUniqueRoles,
} from './state/selectors';
import { loadState, parseImportedJson, saveState } from './state/storage';
import { trackerReducer, type TrackerAction } from './state/trackerReducer';
import type {
  AppState,
  ClubFilter,
  ClubId,
  Committee,
  DensityMode,
  Member,
  RoleFilter,
  SortOption,
  WorkspaceView,
} from './types/tracker';

interface ToastState {
  id: number;
  message: string;
  snapshot?: AppState;
}

type MemberModalState =
  | { mode: 'add'; committee: Committee }
  | { mode: 'edit'; member: Member; committee: Committee }
  | null;

type CommitteeModalState =
  | { mode: 'add'; defaultClubId: ClubId }
  | { mode: 'edit'; committee: Committee }
  | null;

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => void;
}

function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export function App() {
  const [state, dispatch] = useReducer(trackerReducer, undefined, loadState);
  const [branding, setBranding] = useState<BrandingConfig>(loadBranding);
  const [passcodes, setPasscodes] = useState<ClubPasscodes>(loadPasscodes);
  const [managers, setManagers] = useState<ClubManagers>(loadManagers);
  const [presets, setPresets] = useState<AllClubPresets>(loadPresets);
  const [driveSources, setDriveSources] = useState<ClubDriveSources>(loadDriveSources);
  const [session, setSession] = useState<AuthSession | null>(() => {
    const loaded = loadSession();
    if (!loaded) return null;
    const initialManagers = loadManagers();
    if (!isManagerAuthorized(loaded.scope, loaded.officerName, initialManagers).allowed) {
      clearSession();
      return null;
    }
    return loaded;
  });

  const [activeView, setActiveView] = useState<WorkspaceView>('roster');
  const [clubFilter, setClubFilter] = useState<ClubFilter>(
    () => loadSession()?.scope ?? 'all',
  );
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('points-desc');
  const [density, setDensity] = useState<DensityMode>('comfortable');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<ToastState | null>(null);

  const [customPointsMember, setCustomPointsMember] = useState<Member | null>(null);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [memberModal, setMemberModal] = useState<MemberModalState>(null);
  const [committeeModal, setCommitteeModal] = useState<CommitteeModalState>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFocusMember, setDrawerFocusMember] = useState<Member | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [driveSyncModalClub, setDriveSyncModalClub] = useState<ClubId | null>(null);
  const [scrollCommitteeId, setScrollCommitteeId] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (activeView !== 'roster' || !scrollCommitteeId) return;
    const el = document.getElementById(`committee-card-${scrollCommitteeId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollCommitteeId(null);
    }
  }, [activeView, scrollCommitteeId]);

  const showToast = useCallback((message: string, snapshot?: AppState) => {
    setToast({ id: Date.now(), message, snapshot });
  }, []);

  const dispatchWithUndo = useCallback(
    (action: TrackerAction, message: string) => {
      const snapshot = state;
      dispatch(action);
      showToast(message, snapshot);
    },
    [state, showToast],
  );

  // Prune any member IDs no longer in state
  const existingMemberIds = useMemo(
    () => new Set(state.members.map((m) => m.id)),
    [state.members],
  );

  const validSelectedIds = useMemo(() => {
    const next = new Set<string>();
    for (const id of selectedMemberIds) {
      if (existingMemberIds.has(id)) next.add(id);
    }
    return next;
  }, [selectedMemberIds, existingMemberIds]);

  const selectedMembersList = useMemo(
    () => state.members.filter((m) => validSelectedIds.has(m.id)),
    [state.members, validSelectedIds],
  );

  const lockedClub: ClubId | null =
    session && session.scope !== 'all' ? session.scope : null;
  const effectiveClubFilter: ClubFilter = lockedClub ?? clubFilter;

  const hasOpenOverlay = Boolean(
    customPointsMember ||
      detailMemberId ||
      memberModal ||
      committeeModal ||
      confirmDialog ||
      drawerOpen ||
      batchModalOpen ||
      shortcutsOpen ||
      settingsModalOpen ||
      driveSyncModalClub,
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!session) return;

      const target = event.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        if (!inEditable && toast?.snapshot) {
          event.preventDefault();
          dispatch({ type: 'RESTORE_SNAPSHOT', snapshot: toast.snapshot });
          setToast(null);
        }
        return;
      }

      if (inEditable) return;

      if (event.key === 'Escape' && !hasOpenOverlay && validSelectedIds.size > 0) {
        event.preventDefault();
        setSelectedMemberIds(new Set());
        return;
      }

      if (hasOpenOverlay) return;

      if (event.key === '/') {
        event.preventDefault();
        if (activeView !== 'roster') {
          setActiveView('roster');
          window.setTimeout(() => searchInputRef.current?.focus(), 20);
        } else {
          searchInputRef.current?.focus();
        }
      } else if (event.key === '1') {
        setActiveView('roster');
      } else if (event.key === '2') {
        setActiveView('analytics');
      } else if (event.key === '3') {
        setActiveView('leaderboard');
      } else if (event.key === '4' && !lockedClub) {
        setActiveView('admin');
      } else if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [session, lockedClub, activeView, hasOpenOverlay, toast, validSelectedIds.size]);

  // Strict privacy isolation: single-club management only ever receives its own club's data
  const visibleState = useMemo<AppState>(() => {
    if (!lockedClub) return state;
    return {
      version: 1,
      committees: state.committees.filter((c) => c.clubId === lockedClub),
      members: state.members.filter((m) => m.clubId === lockedClub),
      history: state.history.filter((e) => e.clubId === lockedClub),
    };
  }, [state, lockedClub]);

  const clubNames = useMemo<Record<ClubId, string>>(
    () => ({
      chemistry: branding.clubs.chemistry.name,
      physics: branding.clubs.physics.name,
      mathematics: branding.clubs.mathematics.name,
      biology: branding.clubs.biology.name,
    }),
    [branding],
  );

  const stats = useMemo(() => getClubStats(visibleState), [visibleState]);
  const availableRoles = useMemo(
    () => getUniqueRoles(visibleState.members),
    [visibleState.members],
  );
  const clubGroups = useMemo(
    () => filterCommitteesAndMembers(visibleState, effectiveClubFilter, searchQuery, sort, roleFilter),
    [visibleState, effectiveClubFilter, searchQuery, sort, roleFilter],
  );
  const lockedClubStat = lockedClub
    ? stats.byClub.find((s) => s.club.id === lockedClub)
    : null;
  const rosterSummaryText = lockedClubStat
    ? `${lockedClubStat.totalPoints} pts · ${lockedClubStat.memberCount} ${
        lockedClubStat.memberCount === 1 ? 'member' : 'members'
      }`
    : '';

  const visibleCommitteeIds = useMemo(
    () => clubGroups.flatMap((g) => g.committees.map((c) => c.committee.id)),
    [clubGroups],
  );

  const allCollapsed =
    visibleCommitteeIds.length > 0 &&
    visibleCommitteeIds.every((id) => collapsedIds.has(id));

  const handleToggleCollapseAll = () => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (allCollapsed) {
        for (const id of visibleCommitteeIds) next.delete(id);
      } else {
        for (const id of visibleCommitteeIds) next.add(id);
      }
      return next;
    });
  };

  const handleToggleCommitteeCollapse = (committeeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(committeeId)) {
        next.delete(committeeId);
      } else {
        next.add(committeeId);
      }
      return next;
    });
  };

  const handleToggleSelectMember = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleToggleSelectCommittee = (memberIds: string[], shouldSelect: boolean) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      for (const id of memberIds) {
        if (shouldSelect) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  };

  const handleSignIn = (nextSession: AuthSession) => {
    saveSession(nextSession);
    setSession(nextSession);
    setClubFilter(nextSession.scope);
    setActiveView('roster');
    setSearchQuery('');
    setRoleFilter('all');
    setSelectedMemberIds(new Set());
    const scopeLabel =
      nextSession.scope === 'all'
        ? branding.registryTitle
        : branding.clubs[nextSession.scope].name;
    showToast(`Signed in to ${scopeLabel} as ${nextSession.officerName}`);
  };

  const handleSignOut = () => {
    clearSession();
    setSession(null);
    setSelectedMemberIds(new Set());
    setSettingsModalOpen(false);
    setDriveSyncModalClub(null);
    setDrawerOpen(false);
    setShortcutsOpen(false);
    setBatchModalOpen(false);
    setCustomPointsMember(null);
    setDetailMemberId(null);
    setMemberModal(null);
    setCommitteeModal(null);
    setConfirmDialog(null);
  };

  const handleQuickAdjust = (member: Member, delta: number) => {
    const label = delta > 0 ? `+${delta}` : String(delta);
    dispatchWithUndo(
      { type: 'ADJUST_POINTS', memberId: member.id, delta, reason: 'Quick adjustment' },
      `${label} pts for ${member.name} (total: ${member.points + delta} pts)`,
    );
  };

  const handleSetExactOrRelativePoints = (member: Member, rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
      const parsedDelta = Number(trimmed);
      if (!Number.isFinite(parsedDelta) || Math.trunc(parsedDelta) === 0) {
        if (!Number.isFinite(parsedDelta)) {
          showToast('Enter a valid integer like 60, +10, or -4.');
        }
        return;
      }
      const delta = Math.trunc(parsedDelta);
      const label = delta > 0 ? `+${delta}` : String(delta);
      dispatchWithUndo(
        { type: 'ADJUST_POINTS', memberId: member.id, delta, reason: 'Inline adjustment' },
        `${label} pts for ${member.name} (total: ${member.points + delta} pts)`,
      );
      return;
    }

    const parsedTarget = Number(trimmed);
    if (!Number.isFinite(parsedTarget)) {
      showToast('Enter a valid integer like 60, +10, or -4.');
      return;
    }
    const targetPoints = Math.trunc(parsedTarget);
    if (targetPoints === member.points) return;

    dispatchWithUndo(
      { type: 'SET_MEMBER_POINTS', memberId: member.id, targetPoints, reason: 'Inline score edit' },
      `Updated ${member.name} to ${targetPoints} pts`,
    );
  };

  const handleApplyCustomPoints = (memberId: string, delta: number, reason: string) => {
    const member = state.members.find((m) => m.id === memberId);
    if (!member) return;
    const label = delta > 0 ? `+${delta}` : String(delta);
    dispatchWithUndo(
      { type: 'ADJUST_POINTS', memberId, delta, reason },
      `${label} pts for ${member.name} — ${reason}`,
    );
  };

  const handleApplyBatch = (delta: number, reason: string) => {
    const ids = Array.from(validSelectedIds);
    if (ids.length === 0 || delta === 0) return;
    const label = delta > 0 ? `+${delta}` : String(delta);
    dispatchWithUndo(
      { type: 'BATCH_ADJUST_POINTS', memberIds: ids, delta, reason },
      `${label} pts applied to ${ids.length} ${ids.length === 1 ? 'member' : 'members'} — ${reason}`,
    );
    setSelectedMemberIds(new Set());
  };

  const handleQuickAddMember = (
    committee: Committee,
    payload: { name: string; phone: string; email: string; initialPoints: number },
  ) => {
    dispatchWithUndo(
      {
        type: 'ADD_MEMBER',
        clubId: committee.clubId,
        committeeId: committee.id,
        name: payload.name,
        role: 'Member',
        phone: payload.phone,
        email: payload.email,
        initialPoints: payload.initialPoints,
      },
      `Added ${payload.name} to ${committee.name}`,
    );
  };

  const handleExportCsv = () => {
    const csv = buildCsv(visibleState, effectiveClubFilter);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const suffix = effectiveClubFilter === 'all' ? 'all-clubs' : effectiveClubFilter;
    triggerFileDownload(
      `science-clubs-points-${suffix}-${dateStamp}.csv`,
      csv,
      'text/csv;charset=utf-8;',
    );
    showToast(
      `Exported CSV (${effectiveClubFilter === 'all' ? 'All Clubs' : branding.clubs[effectiveClubFilter].name})`,
    );
  };

  const handleExportCommitteeCsv = () => {
    const csv = buildCommitteeSummaryCsv(visibleState, effectiveClubFilter);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const suffix = effectiveClubFilter === 'all' ? 'all-clubs' : effectiveClubFilter;
    triggerFileDownload(
      `science-clubs-committee-summary-${suffix}-${dateStamp}.csv`,
      csv,
      'text/csv;charset=utf-8;',
    );
    showToast('Exported Committee Summary CSV');
  };

  const handleExportJson = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const suffix = lockedClub ?? 'all';
    triggerFileDownload(
      `science-clubs-backup-${suffix}-${dateStamp}.json`,
      JSON.stringify(visibleState, null, 2),
      'application/json',
    );
    showToast('Exported JSON backup');
  };

  const handleImportFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImportedJson(text);
      if (!parsed.ok) {
        showToast(`Import failed: ${parsed.error}`);
        return;
      }
      if (lockedClub) {
        const clubMembers = parsed.state.members.filter((m) => m.clubId === lockedClub);
        const clubCommittees = parsed.state.committees.filter((c) => c.clubId === lockedClub);
        dispatchWithUndo(
          { type: 'IMPORT_CLUB_STATE', clubId: lockedClub, state: parsed.state },
          `Imported ${clubMembers.length} members across ${clubCommittees.length} ${branding.clubs[lockedClub].name} committees`,
        );
      } else {
        dispatchWithUndo(
          { type: 'IMPORT_STATE', state: parsed.state },
          `Imported ${parsed.state.members.length} members across ${parsed.state.committees.length} committees`,
        );
      }
    } catch {
      showToast('Could not read the selected file.');
    }
  };

  const handleRevertHistoryEvent = (eventId: string) => {
    const evt = state.history.find((h) => h.id === eventId);
    if (!evt || evt.reverted) return;
    dispatchWithUndo(
      { type: 'REVERT_EVENT', eventId },
      `Reverted ${evt.delta > 0 ? `+${evt.delta}` : evt.delta} pts for ${evt.memberName}`,
    );
  };

  const handleCopyText = async (text: string, label: string) => {
    const ok = await copyTextToClipboard(text);
    showToast(ok ? `Copied ${label} to clipboard` : 'Could not copy automatically.');
  };

  const handleNavigateToCommittee = (clubId: ClubId, committeeId: string) => {
    setClubFilter(clubId);
    setSearchQuery('');
    setRoleFilter('all');
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.delete(committeeId);
      return next;
    });
    setActiveView('roster');
    setScrollCommitteeId(committeeId);
  };

  const defaultClubForModal: ClubId =
    lockedClub ?? (effectiveClubFilter === 'all' ? 'chemistry' : effectiveClubFilter);
  const committeeById = useMemo(
    () => new Map(visibleState.committees.map((c) => [c.id, c])),
    [visibleState.committees],
  );

  if (!session) {
    return (
      <>
        <ClubLoginPage
          branding={branding}
          passcodes={passcodes}
          managers={managers}
          onSignIn={handleSignIn}
        />
        {toast && (
          <Toast
            key={toast.id}
            message={toast.message}
            canUndo={false}
            onUndo={() => {}}
            onDismiss={() => setToast(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className={`app-shell${density === 'compact' ? ' density-compact' : ''}`}>
      <input
        ref={importInputRef}
        id="json-backup-input"
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-label="Import JSON backup file"
        onChange={handleImportFileChange}
      />

      <Header
        session={session}
        lockedClub={lockedClub}
        branding={branding}
        activeView={activeView}
        onChangeView={setActiveView}
        historyCount={visibleState.history.length}
        onOpenActivity={() => {
          setDrawerFocusMember(null);
          setDrawerOpen(true);
        }}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenSettings={() => {
          if (lockedClub) {
            setSettingsModalOpen(true);
          } else {
            setActiveView('admin');
          }
        }}
        onOpenDriveSync={() => setDriveSyncModalClub(defaultClubForModal)}
        onSignOut={handleSignOut}
        onExportCsv={handleExportCsv}
        onExportCommitteeCsv={handleExportCommitteeCsv}
        onExportJson={handleExportJson}
        onImportJsonClick={() => importInputRef.current?.click()}
        onResetSample={() =>
          setConfirmDialog({
            title: lockedClub
              ? `Reset ${branding.clubs[lockedClub].name} Data?`
              : 'Reset to Sample Data?',
            message: lockedClub
              ? `Restore starter committees, members, and log entries for ${branding.clubs[lockedClub].name}.`
              : 'Restore starter committees, members, and point logs across all clubs.',
            confirmLabel: 'Reset Data',
            destructive: false,
            onConfirm: () =>
              lockedClub
                ? dispatchWithUndo(
                    { type: 'RESET_CLUB_SEED', clubId: lockedClub },
                    `Restored ${branding.clubs[lockedClub].name} sample data`,
                  )
                : dispatchWithUndo({ type: 'RESET_SEED' }, 'Restored starter sample data'),
          })
        }
        onClearAll={() =>
          setConfirmDialog({
            title: lockedClub
              ? `Clear ${branding.clubs[lockedClub].name} Data?`
              : 'Clear All Data?',
            message: lockedClub
              ? `Remove all committees, members, and events in ${branding.clubs[lockedClub].name}.`
              : 'Remove every committee, member, and point event.',
            confirmLabel: 'Clear Data',
            destructive: true,
            onConfirm: () =>
              lockedClub
                ? dispatchWithUndo(
                    { type: 'CLEAR_CLUB', clubId: lockedClub },
                    `Cleared ${branding.clubs[lockedClub].name} data`,
                  )
                : dispatchWithUndo({ type: 'CLEAR_ALL' }, 'Cleared all committees and members'),
          })
        }
      />

      <main className="container main-content">
        {activeView === 'roster' && (
          <>
            <Toolbar
              lockedClub={lockedClub}
              summaryText={rosterSummaryText}
              clubStats={stats.byClub}
              clubNames={clubNames}
              activeClub={effectiveClubFilter}
              onClubChange={setClubFilter}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchInputRef={searchInputRef}
              roleFilter={roleFilter}
              availableRoles={availableRoles}
              onRoleFilterChange={setRoleFilter}
              sort={sort}
              onSortChange={setSort}
              density={density}
              onToggleDensity={() =>
                setDensity((prev) => (prev === 'comfortable' ? 'compact' : 'comfortable'))
              }
              allCollapsed={allCollapsed}
              onToggleCollapseAll={handleToggleCollapseAll}
              hasVisibleCommittees={visibleCommitteeIds.length > 0}
              onOpenDriveSync={() => setDriveSyncModalClub(defaultClubForModal)}
              hasLinkedDrive={
                lockedClub
                  ? Boolean(driveSources[lockedClub].url)
                  : Object.values(driveSources).some((s) => Boolean(s.url))
              }
              onAddCommittee={() =>
                setCommitteeModal({ mode: 'add', defaultClubId: defaultClubForModal })
              }
            />

            <section className="clubs-sections" aria-label="Committees and members">
              {clubGroups.length === 0 ? (
                <div className="empty-state-panel">
                  <h3>No matches found</h3>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setSearchQuery('');
                      setRoleFilter('all');
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                clubGroups.map((group) => (
                  <div key={group.club.id} className="club-section">
                    {!lockedClub && effectiveClubFilter === 'all' && (
                      <div className="club-section-header">
                        <div className="club-section-title-wrap">
                          <span
                            className="club-dot"
                            style={{ backgroundColor: group.club.accent, width: 10, height: 10 }}
                            aria-hidden="true"
                          />
                          <h2 className="club-section-heading">
                            {branding.clubs[group.club.id].name}
                          </h2>
                          <span className="club-section-stats mono-num">
                            {group.totalPoints} pts
                          </span>
                        </div>
                      </div>
                    )}

                    {group.committees.length === 0 ? (
                      <div className="empty-state-panel">
                        <h3>No committees yet</h3>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() =>
                            setCommitteeModal({ mode: 'add', defaultClubId: group.club.id })
                          }
                        >
                          <Plus size={16} aria-hidden="true" />
                          <span>Add Committee</span>
                        </button>
                      </div>
                    ) : (
                      <div className="committees-stack">
                        {group.committees.map((item) => (
                          <CommitteeCard
                            key={item.committee.id}
                            club={group.club}
                            committee={item.committee}
                            members={item.members}
                            totalMemberCount={item.totalMemberCount}
                            totalPoints={item.totalPoints}
                            showClubBadge={effectiveClubFilter === 'all'}
                            collapsed={collapsedIds.has(item.committee.id)}
                            selectedMemberIds={validSelectedIds}
                            onToggleCollapse={handleToggleCommitteeCollapse}
                            onToggleSelectMember={handleToggleSelectMember}
                            onToggleSelectCommittee={handleToggleSelectCommittee}
                            onSelectMember={(m) => setDetailMemberId(m.id)}
                            onQuickAdjust={handleQuickAdjust}
                            onSetExactOrRelativePoints={handleSetExactOrRelativePoints}
                            onOpenCustomPoints={(m) => setCustomPointsMember(m)}
                            onOpenMemberHistory={(m) => {
                              setDrawerFocusMember(m);
                              setDrawerOpen(true);
                            }}
                            onEditMember={(m) =>
                              setMemberModal({
                                mode: 'edit',
                                member: m,
                                committee: item.committee,
                              })
                            }
                            onDeleteMember={(m) =>
                              setConfirmDialog({
                                title: `Remove ${m.name}?`,
                                message: `Remove ${m.name} (${m.points} pts) from ${item.committee.name}?`,
                                confirmLabel: 'Remove Member',
                                destructive: true,
                                onConfirm: () =>
                                  dispatchWithUndo(
                                    { type: 'DELETE_MEMBER', memberId: m.id },
                                    `Removed ${m.name} from ${item.committee.name}`,
                                  ),
                              })
                            }
                            onQuickAddMember={handleQuickAddMember}
                            onOpenAddMemberModal={(com) =>
                              setMemberModal({ mode: 'add', committee: com })
                            }
                            onEditCommittee={(com) =>
                              setCommitteeModal({ mode: 'edit', committee: com })
                            }
                            onDeleteCommittee={(com) =>
                              setConfirmDialog({
                                title: `Delete ${com.name}?`,
                                message: `Delete the "${com.name}" committee and all ${item.totalMemberCount} of its members?`,
                                confirmLabel: 'Delete Committee',
                                destructive: true,
                                onConfirm: () =>
                                  dispatchWithUndo(
                                    { type: 'DELETE_COMMITTEE', committeeId: com.id },
                                    `Deleted committee "${com.name}"`,
                                  ),
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>
          </>
        )}

        {activeView === 'analytics' && (
          <AnalyticsView
            state={visibleState}
            lockedClub={lockedClub}
            clubNames={clubNames}
            scope={effectiveClubFilter}
            onScopeChange={setClubFilter}
            onNavigateToCommittee={handleNavigateToCommittee}
            onQuickAdjust={handleQuickAdjust}
            onOpenCustomPoints={(m) => setCustomPointsMember(m)}
            onCopySummary={(md) => handleCopyText(md, 'summary')}
            onExportCommitteeCsv={handleExportCommitteeCsv}
          />
        )}

        {activeView === 'leaderboard' && (
          <LeaderboardView
            state={visibleState}
            lockedClub={lockedClub}
            clubFilter={effectiveClubFilter}
            onClubFilterChange={setClubFilter}
            onSelectMember={(m) => setDetailMemberId(m.id)}
            onQuickAdjust={handleQuickAdjust}
            onOpenCustomPoints={(m) => setCustomPointsMember(m)}
            onCopyStandings={(txt) => handleCopyText(txt, 'standings')}
          />
        )}

        {activeView === 'admin' && !lockedClub && (
          <AdminView
            branding={branding}
            passcodes={passcodes}
            managers={managers}
            presets={presets}
            driveSources={driveSources}
            onUpdateBranding={(next, message) => {
              saveBranding(next);
              setBranding(next);
              if (message) showToast(message);
            }}
            onUpdatePasscodes={(next, message) => {
              savePasscodes(next);
              setPasscodes(next);
              if (message) showToast(message);
            }}
            onUpdateManagers={(next, message) => {
              saveManagers(next);
              setManagers(next);
              if (message) showToast(message);
            }}
            onUpdatePresets={(next, message) => {
              savePresets(next);
              setPresets(next);
              if (message) showToast(message);
            }}
            onUpdateDriveSources={(next, message) => {
              saveDriveSources(next);
              setDriveSources(next);
              if (message) showToast(message);
            }}
            onOpenDriveSync={(clubId) => setDriveSyncModalClub(clubId)}
            onResetAllSettings={() =>
              setConfirmDialog({
                title: 'Reset All Settings?',
                message:
                  'Restore default club names, logos, passcodes, presets, Drive links, and clear management assignments.',
                confirmLabel: 'Reset Defaults',
                destructive: false,
                onConfirm: () => {
                  const defBrand = resetBranding();
                  const defCodes = resetPasscodes();
                  const defManagers = resetManagers();
                  const defPresets = resetPresets();
                  const defDrive = resetDriveSources();
                  setBranding(defBrand);
                  setPasscodes(defCodes);
                  setManagers(defManagers);
                  setPresets(defPresets);
                  setDriveSources(defDrive);
                  showToast('Restored default settings');
                },
              })
            }
          />
        )}
      </main>

      {activeView === 'roster' && (
        <BatchActionBar
          selectedCount={validSelectedIds.size}
          onApplyBatch={handleApplyBatch}
          onOpenCustomBatch={() => setBatchModalOpen(true)}
          onClearSelection={() => setSelectedMemberIds(new Set())}
        />
      )}

      {batchModalOpen && selectedMembersList.length > 0 && (() => {
        const batchClubId = lockedClub ?? selectedMembersList[0]?.clubId ?? 'chemistry';
        return (
          <BatchPointsModal
            selectedCount={selectedMembersList.length}
            selectedNames={selectedMembersList.map((m) => m.name)}
            presets={presets[batchClubId]}
            onUpdatePresets={(nextClubPresets) => {
              const nextAll = { ...presets, [batchClubId]: nextClubPresets };
              savePresets(nextAll);
              setPresets(nextAll);
            }}
            onApply={handleApplyBatch}
            onClose={() => setBatchModalOpen(false)}
          />
        );
      })()}

      {customPointsMember && (
        <CustomPointsModal
          member={customPointsMember}
          committeeName={
            committeeById.get(customPointsMember.committeeId)?.name ?? 'Committee'
          }
          presets={presets[customPointsMember.clubId]}
          onUpdatePresets={(nextClubPresets) => {
            const nextAll = {
              ...presets,
              [customPointsMember.clubId]: nextClubPresets,
            };
            savePresets(nextAll);
            setPresets(nextAll);
          }}
          onApply={handleApplyCustomPoints}
          onClose={() => setCustomPointsMember(null)}
        />
      )}

      {driveSyncModalClub && (
        <DriveSyncModal
          lockedClub={lockedClub}
          initialClubId={driveSyncModalClub}
          clubNames={clubNames}
          sources={driveSources}
          existingCommittees={visibleState.committees}
          onSaveSource={(clubId, source) => {
            const next = { ...driveSources, [clubId]: source };
            saveDriveSources(next);
            setDriveSources(next);
          }}
          onApplySync={({ clubId, mode, rows, sourceUrl }) => {
            if (sourceUrl) {
              const next = {
                ...driveSources,
                [clubId]: {
                  url: sourceUrl,
                  lastSyncedAt: new Date().toISOString(),
                },
              };
              saveDriveSources(next);
              setDriveSources(next);
            }
            dispatchWithUndo(
              {
                type: 'SYNC_CLUB_SHEET',
                clubId,
                mode,
                rows,
              },
              `Imported ${rows.length} ${rows.length === 1 ? 'member' : 'members'} to ${branding.clubs[clubId].name}`,
            );
          }}
          onClose={() => setDriveSyncModalClub(null)}
        />
      )}

      {(() => {
        const detailMember = detailMemberId
          ? (visibleState.members.find((m) => m.id === detailMemberId) ?? null)
          : null;
        if (!detailMember) return null;
        const detailClubMeta = CLUB_MAP[detailMember.clubId];
        return (
          <MemberDetailModal
            member={detailMember}
            committeeName={
              committeeById.get(detailMember.committeeId)?.name ?? 'Committee'
            }
            clubName={branding.clubs[detailMember.clubId].name}
            clubAccent={detailClubMeta.accent}
            clubSoft={detailClubMeta.softBg}
            clubInk={detailClubMeta.ink}
            clubBorder={detailClubMeta.border}
            showClubName={!lockedClub}
            onQuickAdjust={handleQuickAdjust}
            onOpenCustomPoints={(m) => {
              setDetailMemberId(null);
              setCustomPointsMember(m);
            }}
            onOpenHistory={(m) => {
              setDetailMemberId(null);
              setDrawerFocusMember(m);
              setDrawerOpen(true);
            }}
            onEditMember={(m) => {
              const com = committeeById.get(m.committeeId);
              if (!com) return;
              setDetailMemberId(null);
              setMemberModal({ mode: 'edit', member: m, committee: com });
            }}
            onCopyText={handleCopyText}
            onClose={() => setDetailMemberId(null)}
          />
        );
      })()}

      {memberModal && (
        <MemberModal
          mode={memberModal.mode}
          initialCommittee={memberModal.committee}
          lockedClub={lockedClub}
          member={memberModal.mode === 'edit' ? memberModal.member : undefined}
          committees={visibleState.committees}
          onAddSingle={(payload) =>
            dispatchWithUndo(
              {
                type: 'ADD_MEMBER',
                clubId: payload.clubId,
                committeeId: payload.committeeId,
                name: payload.name,
                role: payload.role,
                phone: payload.phone,
                email: payload.email,
                initialPoints: payload.initialPoints,
              },
              `Added ${payload.name}`,
            )
          }
          onAddBulk={(payload) =>
            dispatchWithUndo(
              {
                type: 'BULK_ADD_MEMBERS',
                clubId: payload.clubId,
                committeeId: payload.committeeId,
                entries: payload.entries,
              },
              `Imported ${payload.entries.length} ${
                payload.entries.length === 1 ? 'member' : 'members'
              }`,
            )
          }
          onUpdate={(payload) =>
            dispatchWithUndo(
              {
                type: 'UPDATE_MEMBER',
                memberId: payload.memberId,
                clubId: payload.clubId,
                committeeId: payload.committeeId,
                name: payload.name,
                role: payload.role,
                phone: payload.phone,
                email: payload.email,
                points: payload.points,
              },
              `Updated ${payload.name}`,
            )
          }
          onClose={() => setMemberModal(null)}
        />
      )}

      {committeeModal && (
        <CommitteeModal
          mode={committeeModal.mode}
          lockedClub={lockedClub}
          defaultClubId={
            committeeModal.mode === 'add'
              ? committeeModal.defaultClubId
              : committeeModal.committee.clubId
          }
          committee={committeeModal.mode === 'edit' ? committeeModal.committee : undefined}
          onSave={(payload) => {
            if (committeeModal.mode === 'edit' && payload.committeeId) {
              dispatchWithUndo(
                {
                  type: 'UPDATE_COMMITTEE',
                  committeeId: payload.committeeId,
                  clubId: payload.clubId,
                  name: payload.name,
                  description: payload.description,
                },
                `Updated committee "${payload.name}"`,
              );
            } else {
              dispatchWithUndo(
                {
                  type: 'ADD_COMMITTEE',
                  clubId: payload.clubId,
                  name: payload.name,
                  description: payload.description,
                },
                `Created committee "${payload.name}"`,
              );
            }
          }}
          onClose={() => setCommitteeModal(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          destructive={confirmDialog.destructive}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(null)}
        />
      )}

      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}

      {settingsModalOpen && (
        <ClubSettingsModal
          lockedClub={lockedClub}
          branding={branding}
          passcodes={passcodes}
          onSave={(nextBranding, nextPasscodes) => {
            saveBranding(nextBranding);
            savePasscodes(nextPasscodes);
            setBranding(nextBranding);
            setPasscodes(nextPasscodes);
            showToast('Saved settings');
          }}
          onClose={() => setSettingsModalOpen(false)}
        />
      )}

      {drawerOpen && (
        <ActivityDrawer
          lockedClub={lockedClub}
          history={visibleState.history}
          focusMember={drawerFocusMember}
          onClearFocusMember={() => setDrawerFocusMember(null)}
          onRevertEvent={handleRevertHistoryEvent}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          canUndo={Boolean(toast.snapshot)}
          onUndo={() => {
            if (toast.snapshot) {
              dispatch({ type: 'RESTORE_SNAPSHOT', snapshot: toast.snapshot });
              setToast(null);
            }
          }}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default App;
