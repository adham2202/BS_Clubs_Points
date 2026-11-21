import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { ExternalLink, Plus, Shield, Trash2, Upload, X } from 'lucide-react';
import { CLUBS, CLUB_MAP } from '../data/clubs';
import {
  addManagersToList,
  removeManagerFromList,
  type ClubManagers,
  type ClubPasscodes,
} from '../state/auth';
import { processLogoFile, type BrandingConfig } from '../state/branding';
import { resolveDriveCsvUrl, type ClubDriveSources } from '../state/driveSync';
import {
  addPointPreset,
  addReasonPreset,
  cloneDefaultClubPresets,
  removePointPreset,
  removeReasonPreset,
  type AllClubPresets,
} from '../state/presets';
import { getInitials } from '../state/selectors';
import type { ClubId } from '../types/tracker';
import { ClubLogo } from './ClubLogo';

interface AdminViewProps {
  branding: BrandingConfig;
  passcodes: ClubPasscodes;
  managers: ClubManagers;
  presets: AllClubPresets;
  driveSources: ClubDriveSources;
  onUpdateBranding: (next: BrandingConfig, message?: string) => void;
  onUpdatePasscodes: (next: ClubPasscodes, message?: string) => void;
  onUpdateManagers: (next: ClubManagers, message?: string) => void;
  onUpdatePresets: (next: AllClubPresets, message?: string) => void;
  onUpdateDriveSources: (next: ClubDriveSources, message?: string) => void;
  onOpenDriveSync: (clubId: ClubId) => void;
  onResetAllSettings: () => void;
}

type AdminTab = ClubId | 'portal';

export function AdminView({
  branding,
  passcodes,
  managers,
  presets,
  driveSources,
  onUpdateBranding,
  onUpdatePasscodes,
  onUpdateManagers,
  onUpdatePresets,
  onUpdateDriveSources,
  onOpenDriveSync,
  onResetAllSettings,
}: AdminViewProps) {
  const clubLogoInputId = useId();
  const clubNameInputId = useId();
  const clubCodeInputId = useId();
  const portalLogoInputId = useId();
  const portalTitleInputId = useId();
  const adminCodeInputId = useId();
  const addManagerInputId = useId();
  const driveUrlInputId = useId();
  const addPointPresetId = useId();
  const addReasonPresetId = useId();

  const [selectedTab, setSelectedTab] = useState<AdminTab>('chemistry');
  const [newManagerInput, setNewManagerInput] = useState('');

  const [clubNameDraft, setClubNameDraft] = useState(branding.clubs.chemistry.name);
  const [clubCodeDraft, setClubCodeDraft] = useState(passcodes.chemistry);

  const [portalTitleDraft, setPortalTitleDraft] = useState(branding.registryTitle);
  const [adminCodeDraft, setAdminCodeDraft] = useState(passcodes.all);
  const [formError, setFormError] = useState('');

  const [driveUrlDraft, setDriveUrlDraft] = useState(driveSources.chemistry.url);
  const [driveError, setDriveError] = useState('');
  const [newPointPreset, setNewPointPreset] = useState('');
  const [newReasonPreset, setNewReasonPreset] = useState('');

  useEffect(() => {
    setFormError('');
    setNewManagerInput('');
    setDriveError('');
    setNewPointPreset('');
    setNewReasonPreset('');
    if (selectedTab === 'portal') {
      setPortalTitleDraft(branding.registryTitle);
      setAdminCodeDraft(passcodes.all);
    } else {
      setClubNameDraft(branding.clubs[selectedTab].name);
      setClubCodeDraft(passcodes[selectedTab]);
      setDriveUrlDraft(driveSources[selectedTab].url);
    }
  }, [selectedTab, branding, passcodes, driveSources]);

  const handleAddManagers = (e: FormEvent) => {
    e.preventDefault();
    if (selectedTab === 'portal') return;
    const clubId = selectedTab;
    const currentList = managers[clubId] ?? [];
    const nextList = addManagersToList(currentList, newManagerInput);
    const addedCount = nextList.length - currentList.length;
    setNewManagerInput('');
    if (addedCount <= 0) return;

    onUpdateManagers(
      { ...managers, [clubId]: nextList },
      `Updated ${branding.clubs[clubId].name} management`,
    );
  };

  const handleRemoveManager = (targetName: string) => {
    if (selectedTab === 'portal') return;
    const clubId = selectedTab;
    const nextList = removeManagerFromList(managers[clubId] ?? [], targetName);
    onUpdateManagers(
      { ...managers, [clubId]: nextList },
      `Removed ${targetName}`,
    );
  };

  const handleClubLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (selectedTab === 'portal') return;
    const clubId = selectedTab;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await processLogoFile(file);
      onUpdateBranding(
        {
          ...branding,
          clubs: {
            ...branding.clubs,
            [clubId]: { ...branding.clubs[clubId], logoDataUrl: dataUrl },
          },
        },
        `Updated ${branding.clubs[clubId].name} logo`,
      );
      setFormError('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to process image.');
    }
  };

  const handlePortalLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await processLogoFile(file);
      onUpdateBranding(
        { ...branding, registryLogoDataUrl: dataUrl },
        'Updated portal logo',
      );
      setFormError('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to process image.');
    }
  };

  const handleSaveClubAccess = (e: FormEvent) => {
    e.preventDefault();
    if (selectedTab === 'portal') return;
    const clubId = selectedTab;
    const trimmedName = clubNameDraft.trim();
    const trimmedCode = clubCodeDraft.trim();
    if (!trimmedName || !trimmedCode) {
      setFormError('Club name and passcode are required.');
      return;
    }

    if (trimmedName !== branding.clubs[clubId].name) {
      onUpdateBranding(
        {
          ...branding,
          clubs: {
            ...branding.clubs,
            [clubId]: { ...branding.clubs[clubId], name: trimmedName },
          },
        },
        `Saved ${trimmedName}`,
      );
    }
    if (trimmedCode !== passcodes[clubId]) {
      onUpdatePasscodes(
        { ...passcodes, [clubId]: trimmedCode },
        trimmedName === branding.clubs[clubId].name
          ? `Updated ${trimmedName} passcode`
          : undefined,
      );
    }
    setFormError('');
  };

  const handleSavePortalAccess = (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = portalTitleDraft.trim();
    const trimmedCode = adminCodeDraft.trim();
    if (!trimmedTitle || !trimmedCode) {
      setFormError('Portal title and passcode are required.');
      return;
    }

    if (trimmedTitle !== branding.registryTitle) {
      onUpdateBranding(
        { ...branding, registryTitle: trimmedTitle },
        `Saved ${trimmedTitle}`,
      );
    }
    if (trimmedCode !== passcodes.all) {
      onUpdatePasscodes(
        { ...passcodes, all: trimmedCode },
        trimmedTitle === branding.registryTitle ? 'Updated administration passcode' : undefined,
      );
    }
    setFormError('');
  };

  const activeClub = selectedTab === 'portal' ? null : CLUB_MAP[selectedTab];
  const activeManagers = activeClub ? (managers[activeClub.id] ?? []) : [];
  const activeBrand = activeClub ? branding.clubs[activeClub.id] : null;

  const isClubDirty =
    activeClub !== null &&
    activeBrand !== null &&
    (clubNameDraft.trim() !== activeBrand.name ||
      clubCodeDraft.trim() !== passcodes[activeClub.id]);

  const isPortalDirty =
    portalTitleDraft.trim() !== branding.registryTitle ||
    adminCodeDraft.trim() !== passcodes.all;

  const clubCardStyle = activeClub
    ? ({
        '--club-accent': activeClub.accent,
        '--club-soft': activeClub.softBg,
        '--club-ink': activeClub.ink,
        '--club-border': activeClub.border,
      } as CSSProperties)
    : undefined;

  return (
    <section className="admin-view" aria-label="Administration management and settings">
      <div className="roster-bar">
        <div className="club-tabs" role="tablist" aria-label="Manage club">
          {CLUBS.map((club) => {
            const count = (managers[club.id] ?? []).length;
            return (
              <button
                key={club.id}
                type="button"
                role="tab"
                aria-selected={selectedTab === club.id}
                className="club-tab"
                onClick={() => setSelectedTab(club.id)}
              >
                <span
                  className="club-dot"
                  style={{ backgroundColor: club.accent }}
                  aria-hidden="true"
                />
                <span>{branding.clubs[club.id].name}</span>
                {count > 0 && <span className="club-tab-pts mono-num">{count}</span>}
              </button>
            );
          })}

          <button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'portal'}
            className="club-tab"
            onClick={() => setSelectedTab('portal')}
          >
            <Shield size={13} aria-hidden="true" />
            <span>Portal</span>
          </button>
        </div>

        <button type="button" className="btn" onClick={onResetAllSettings}>
          <span>Reset Defaults</span>
        </button>
      </div>

      {activeClub && activeBrand ? (
        <div className="admin-stack" style={clubCardStyle}>
          <article className="admin-card">
            <div className="admin-card-head">
              <h3 className="admin-card-title">Management</h3>
              <span className="admin-status-pill mono-num">
                {activeManagers.length > 0
                  ? `${activeManagers.length} authorized`
                  : 'Passcode only'}
              </span>
            </div>

            {activeManagers.length === 0 ? (
              <p className="admin-empty">No managers assigned</p>
            ) : (
              <ul
                className="admin-manager-list"
                aria-label={`${activeBrand.name} authorized managers`}
              >
                {activeManagers.map((name) => (
                  <li key={name} className="admin-manager-row">
                    <div className="admin-manager-left">
                      <span className="member-avatar sm" aria-hidden="true">
                        {getInitials(name)}
                      </span>
                      <span className="admin-manager-name">{name}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-icon danger"
                      aria-label={`Remove ${name} from ${activeBrand.name} management`}
                      onClick={() => handleRemoveManager(name)}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form className="admin-add-form" onSubmit={handleAddManagers}>
              <label htmlFor={addManagerInputId} className="sr-only">
                Add manager to {activeBrand.name}
              </label>
              <input
                id={addManagerInputId}
                type="text"
                className="text-input"
                aria-label={`Add manager to ${activeBrand.name}`}
                placeholder="Add manager name"
                value={newManagerInput}
                onChange={(e) => setNewManagerInput(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!newManagerInput.trim()}
              >
                <Plus size={14} aria-hidden="true" />
                <span>Add</span>
              </button>
            </form>
          </article>

          <article className="admin-card">
            <div className="admin-card-head">
              <h3 className="admin-card-title">Access &amp; Branding</h3>
            </div>

            <div className="admin-identity-row">
              <div className="settings-logo-col">
                <ClubLogo
                  kind={activeClub.id}
                  logoDataUrl={activeBrand.logoDataUrl}
                  size="lg"
                />
                <div className="settings-photo-actions">
                  <input
                    id={clubLogoInputId}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label={`Upload logo for ${activeBrand.name}`}
                    onChange={handleClubLogoChange}
                  />
                  <label htmlFor={clubLogoInputId} className="btn btn-sm settings-upload-btn">
                    <Upload size={13} aria-hidden="true" />
                    <span>Upload</span>
                  </label>
                  {activeBrand.logoDataUrl && (
                    <button
                      type="button"
                      className="btn-icon danger"
                      aria-label={`Remove logo for ${activeBrand.name}`}
                      onClick={() =>
                        onUpdateBranding(
                          {
                            ...branding,
                            clubs: {
                              ...branding.clubs,
                              [activeClub.id]: {
                                ...branding.clubs[activeClub.id],
                                logoDataUrl: null,
                              },
                            },
                          },
                          `Removed ${activeBrand.name} logo`,
                        )
                      }
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <form className="admin-fields-form" onSubmit={handleSaveClubAccess}>
                <div className="admin-fields-grid">
                  <div className="form-field">
                    <label htmlFor={clubNameInputId} className="form-label">
                      Club Name
                    </label>
                    <input
                      id={clubNameInputId}
                      type="text"
                      className="text-input"
                      value={clubNameDraft}
                      onChange={(e) => {
                        setClubNameDraft(e.target.value);
                        setFormError('');
                      }}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor={clubCodeInputId} className="form-label">
                      Passcode
                    </label>
                    <input
                      id={clubCodeInputId}
                      type="text"
                      className="text-input mono-num"
                      value={clubCodeDraft}
                      onChange={(e) => {
                        setClubCodeDraft(e.target.value);
                        setFormError('');
                      }}
                    />
                  </div>
                </div>

                {formError && (
                  <p className="form-error" role="alert">
                    {formError}
                  </p>
                )}

                <div className="admin-save-row">
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={
                      !isClubDirty || !clubNameDraft.trim() || !clubCodeDraft.trim()
                    }
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </article>

          <article className="admin-card">
            <div className="admin-card-head">
              <h3 className="admin-card-title">Google Drive / Form Sheet</h3>
              <span className="admin-status-pill">
                {driveSources[activeClub.id].url ? 'Linked' : 'Not linked'}
              </span>
            </div>

            <form
              className="drive-url-row"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = driveUrlDraft.trim();
                if (trimmed) {
                  const res = resolveDriveCsvUrl(trimmed);
                  if (!res.ok) {
                    setDriveError(res.error);
                    return;
                  }
                }
                setDriveError('');
                onUpdateDriveSources(
                  {
                    ...driveSources,
                    [activeClub.id]: {
                      ...driveSources[activeClub.id],
                      url: trimmed,
                    },
                  },
                  trimmed
                    ? `Saved ${activeBrand.name} Drive link`
                    : `Cleared ${activeBrand.name} Drive link`,
                );
              }}
            >
              <label htmlFor={driveUrlInputId} className="sr-only">
                Drive or Google Sheet link for {activeBrand.name}
              </label>
              <input
                id={driveUrlInputId}
                type="url"
                className="text-input"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={driveUrlDraft}
                onChange={(e) => {
                  setDriveUrlDraft(e.target.value);
                  setDriveError('');
                }}
              />
              <button
                type="submit"
                className="btn btn-sm"
                disabled={driveUrlDraft.trim() === driveSources[activeClub.id].url}
              >
                Save
              </button>
              {driveSources[activeClub.id].url && (
                <a
                  href={driveSources[activeClub.id].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm"
                  aria-label={`Open ${activeBrand.name} Drive link`}
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  <span>Open</span>
                </a>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const trimmed = driveUrlDraft.trim();
                  if (trimmed && trimmed !== driveSources[activeClub.id].url) {
                    const res = resolveDriveCsvUrl(trimmed);
                    if (!res.ok) {
                      setDriveError(res.error);
                      return;
                    }
                    onUpdateDriveSources({
                      ...driveSources,
                      [activeClub.id]: {
                        ...driveSources[activeClub.id],
                        url: trimmed,
                      },
                    });
                  }
                  onOpenDriveSync(activeClub.id);
                }}
              >
                Sync
              </button>
            </form>

            {driveError && (
              <p className="form-error" role="alert">
                {driveError}
              </p>
            )}
          </article>

          <article className="admin-card">
            <div className="admin-card-head">
              <h3 className="admin-card-title">Scoring Presets</h3>
              <button
                type="button"
                className="preset-edit-toggle"
                onClick={() =>
                  onUpdatePresets(
                    {
                      ...presets,
                      [activeClub.id]: cloneDefaultClubPresets(),
                    },
                    `Reset ${activeBrand.name} presets`,
                  )
                }
              >
                Reset
              </button>
            </div>

            <div className="form-field">
              <span className="form-label">Quick Points</span>
              <div className="chip-row">
                {presets[activeClub.id].points.map((preset) => (
                  <span key={preset} className="chip-btn removable mono-num">
                    <span>{preset > 0 ? `+${preset}` : preset}</span>
                    <button
                      type="button"
                      className="chip-remove-icon"
                      aria-label={`Remove ${preset > 0 ? `+${preset}` : preset} preset`}
                      onClick={() =>
                        onUpdatePresets({
                          ...presets,
                          [activeClub.id]: {
                            ...presets[activeClub.id],
                            points: removePointPreset(
                              presets[activeClub.id].points,
                              preset,
                            ),
                          },
                        })
                      }
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
              <form
                className="preset-inline-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  const nextPts = addPointPreset(
                    presets[activeClub.id].points,
                    Number(newPointPreset),
                  );
                  if (nextPts !== presets[activeClub.id].points) {
                    onUpdatePresets(
                      {
                        ...presets,
                        [activeClub.id]: {
                          ...presets[activeClub.id],
                          points: nextPts,
                        },
                      },
                      'Updated quick points',
                    );
                    setNewPointPreset('');
                  }
                }}
              >
                <label htmlFor={addPointPresetId} className="sr-only">
                  Add point preset
                </label>
                <input
                  id={addPointPresetId}
                  type="number"
                  step="1"
                  className="text-input mono-num"
                  placeholder="+15"
                  value={newPointPreset}
                  onChange={(e) => setNewPointPreset(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-sm"
                  disabled={!newPointPreset.trim() || Number(newPointPreset) === 0}
                >
                  Add
                </button>
              </form>
            </div>

            <div className="form-field">
              <span className="form-label">Quick Reasons</span>
              <div className="chip-row">
                {presets[activeClub.id].reasons.map((chip) => (
                  <span key={chip} className="chip-btn removable">
                    <span>{chip}</span>
                    <button
                      type="button"
                      className="chip-remove-icon"
                      aria-label={`Remove ${chip} reason preset`}
                      onClick={() =>
                        onUpdatePresets({
                          ...presets,
                          [activeClub.id]: {
                            ...presets[activeClub.id],
                            reasons: removeReasonPreset(
                              presets[activeClub.id].reasons,
                              chip,
                            ),
                          },
                        })
                      }
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
              <form
                className="preset-inline-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  const nextReasons = addReasonPreset(
                    presets[activeClub.id].reasons,
                    newReasonPreset,
                  );
                  if (nextReasons !== presets[activeClub.id].reasons) {
                    onUpdatePresets(
                      {
                        ...presets,
                        [activeClub.id]: {
                          ...presets[activeClub.id],
                          reasons: nextReasons,
                        },
                      },
                      'Updated quick reasons',
                    );
                    setNewReasonPreset('');
                  }
                }}
              >
                <label htmlFor={addReasonPresetId} className="sr-only">
                  Add reason preset
                </label>
                <input
                  id={addReasonPresetId}
                  type="text"
                  className="text-input"
                  placeholder="Add reason"
                  value={newReasonPreset}
                  onChange={(e) => setNewReasonPreset(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-sm"
                  disabled={!newReasonPreset.trim()}
                >
                  Add
                </button>
              </form>
            </div>
          </article>
        </div>
      ) : (
        <div className="admin-stack">
          <article className="admin-card">
            <div className="admin-card-head">
              <h3 className="admin-card-title">Portal</h3>
            </div>

            <div className="admin-identity-row">
              <div className="settings-logo-col">
                <ClubLogo
                  kind="registry"
                  logoDataUrl={branding.registryLogoDataUrl}
                  size="lg"
                />
                <div className="settings-photo-actions">
                  <input
                    id={portalLogoInputId}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label="Upload registry logo"
                    onChange={handlePortalLogoChange}
                  />
                  <label htmlFor={portalLogoInputId} className="btn btn-sm settings-upload-btn">
                    <Upload size={13} aria-hidden="true" />
                    <span>Upload</span>
                  </label>
                  {branding.registryLogoDataUrl && (
                    <button
                      type="button"
                      className="btn-icon danger"
                      aria-label="Remove registry logo"
                      onClick={() =>
                        onUpdateBranding(
                          { ...branding, registryLogoDataUrl: null },
                          'Removed portal logo',
                        )
                      }
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <form className="admin-fields-form" onSubmit={handleSavePortalAccess}>
                <div className="admin-fields-grid">
                  <div className="form-field">
                    <label htmlFor={portalTitleInputId} className="form-label">
                      Portal Title
                    </label>
                    <input
                      id={portalTitleInputId}
                      type="text"
                      className="text-input"
                      value={portalTitleDraft}
                      onChange={(e) => {
                        setPortalTitleDraft(e.target.value);
                        setFormError('');
                      }}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor={adminCodeInputId} className="form-label">
                      Administration Passcode
                    </label>
                    <input
                      id={adminCodeInputId}
                      type="text"
                      className="text-input mono-num"
                      value={adminCodeDraft}
                      onChange={(e) => {
                        setAdminCodeDraft(e.target.value);
                        setFormError('');
                      }}
                    />
                  </div>
                </div>

                {formError && (
                  <p className="form-error" role="alert">
                    {formError}
                  </p>
                )}

                <div className="admin-save-row">
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={
                      !isPortalDirty || !portalTitleDraft.trim() || !adminCodeDraft.trim()
                    }
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
