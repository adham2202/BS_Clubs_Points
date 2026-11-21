import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { CLUBS } from '../data/clubs';
import { DEFAULT_PASSCODES, type ClubPasscodes } from '../state/auth';
import {
  cloneDefaultBranding,
  processLogoFile,
  type BrandingConfig,
} from '../state/branding';
import type { ClubId } from '../types/tracker';
import { ClubLogo } from './ClubLogo';
import { Modal } from './Modal';

interface ClubSettingsModalProps {
  lockedClub: ClubId | null;
  branding: BrandingConfig;
  passcodes: ClubPasscodes;
  onSave: (nextBranding: BrandingConfig, nextPasscodes: ClubPasscodes) => void;
  onClose: () => void;
}

export function ClubSettingsModal({
  lockedClub,
  branding,
  passcodes,
  onSave,
  onClose,
}: ClubSettingsModalProps) {
  const regTitleId = useId();
  const regLogoId = useId();
  const adminCodeId = useId();

  const chemNameId = useId();
  const chemCodeId = useId();
  const chemLogoId = useId();

  const physNameId = useId();
  const physCodeId = useId();
  const physLogoId = useId();

  const mathNameId = useId();
  const mathCodeId = useId();
  const mathLogoId = useId();

  const bioNameId = useId();
  const bioCodeId = useId();
  const bioLogoId = useId();

  const clubFieldIds: Record<ClubId, { name: string; code: string; logo: string }> = {
    chemistry: { name: chemNameId, code: chemCodeId, logo: chemLogoId },
    physics: { name: physNameId, code: physCodeId, logo: physLogoId },
    mathematics: { name: mathNameId, code: mathCodeId, logo: mathLogoId },
    biology: { name: bioNameId, code: bioCodeId, logo: bioLogoId },
  };

  const [draftBranding, setDraftBranding] = useState<BrandingConfig>(() => ({
    registryTitle: branding.registryTitle,
    registryLogoDataUrl: branding.registryLogoDataUrl,
    clubs: {
      chemistry: { ...branding.clubs.chemistry },
      physics: { ...branding.clubs.physics },
      mathematics: { ...branding.clubs.mathematics },
      biology: { ...branding.clubs.biology },
    },
  }));
  const [draftPasscodes, setDraftPasscodes] = useState<ClubPasscodes>({ ...passcodes });
  const [error, setError] = useState('');

  const handleRegistryPhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await processLogoFile(file);
      setDraftBranding((prev) => ({ ...prev, registryLogoDataUrl: dataUrl }));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process image.');
    }
  };

  const handleClubPhotoChange = async (
    clubId: ClubId,
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await processLogoFile(file);
      setDraftBranding((prev) => ({
        ...prev,
        clubs: {
          ...prev.clubs,
          [clubId]: { ...prev.clubs[clubId], logoDataUrl: dataUrl },
        },
      }));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process image.');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (lockedClub) {
      const name = draftBranding.clubs[lockedClub].name.trim();
      const code = draftPasscodes[lockedClub].trim();
      if (!name || !code) {
        setError('Club name and passcode are required.');
        return;
      }
      const nextBranding: BrandingConfig = {
        ...branding,
        clubs: {
          ...branding.clubs,
          [lockedClub]: {
            name,
            logoDataUrl: draftBranding.clubs[lockedClub].logoDataUrl,
          },
        },
      };
      const nextPasscodes: ClubPasscodes = {
        ...passcodes,
        [lockedClub]: code,
      };
      onSave(nextBranding, nextPasscodes);
      onClose();
      return;
    }

    const regTitle = draftBranding.registryTitle.trim();
    const adminCode = draftPasscodes.all.trim();
    if (!regTitle || !adminCode) {
      setError('Registry title and administration passcode are required.');
      return;
    }

    for (const club of CLUBS) {
      if (!draftBranding.clubs[club.id].name.trim() || !draftPasscodes[club.id].trim()) {
        setError('Every club name and passcode is required.');
        return;
      }
    }

    onSave(
      {
        registryTitle: regTitle,
        registryLogoDataUrl: draftBranding.registryLogoDataUrl,
        clubs: {
          chemistry: {
            ...draftBranding.clubs.chemistry,
            name: draftBranding.clubs.chemistry.name.trim(),
          },
          physics: {
            ...draftBranding.clubs.physics,
            name: draftBranding.clubs.physics.name.trim(),
          },
          mathematics: {
            ...draftBranding.clubs.mathematics,
            name: draftBranding.clubs.mathematics.name.trim(),
          },
          biology: {
            ...draftBranding.clubs.biology,
            name: draftBranding.clubs.biology.name.trim(),
          },
        },
      },
      {
        chemistry: draftPasscodes.chemistry.trim(),
        physics: draftPasscodes.physics.trim(),
        mathematics: draftPasscodes.mathematics.trim(),
        biology: draftPasscodes.biology.trim(),
        all: adminCode,
      },
    );
    onClose();
  };

  const handleResetDefaults = () => {
    const defBrand = cloneDefaultBranding();
    if (lockedClub) {
      setDraftBranding((prev) => ({
        ...prev,
        clubs: {
          ...prev.clubs,
          [lockedClub]: { ...defBrand.clubs[lockedClub] },
        },
      }));
      setDraftPasscodes((prev) => ({
        ...prev,
        [lockedClub]: DEFAULT_PASSCODES[lockedClub],
      }));
    } else {
      setDraftBranding(defBrand);
      setDraftPasscodes({ ...DEFAULT_PASSCODES });
    }
    setError('');
  };

  const clubsToRender = lockedClub ? CLUBS.filter((c) => c.id === lockedClub) : CLUBS;

  return (
    <Modal
      title={lockedClub ? `${branding.clubs[lockedClub].name} Settings` : 'Club Settings & Logos'}
      onClose={onClose}
      maxWidth={560}
    >
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {!lockedClub && (
            <div className="settings-club-row">
              <div className="settings-logo-col">
                <ClubLogo
                  kind="registry"
                  logoDataUrl={draftBranding.registryLogoDataUrl}
                  size="lg"
                />
                <div className="settings-photo-actions">
                  <input
                    id={regLogoId}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label="Upload registry logo"
                    onChange={handleRegistryPhotoChange}
                  />
                  <label htmlFor={regLogoId} className="btn btn-sm settings-upload-btn">
                    <Upload size={13} aria-hidden="true" />
                    <span>Upload</span>
                  </label>
                  {draftBranding.registryLogoDataUrl && (
                    <button
                      type="button"
                      className="btn-icon danger"
                      aria-label="Remove registry logo"
                      onClick={() =>
                        setDraftBranding((prev) => ({ ...prev, registryLogoDataUrl: null }))
                      }
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <div className="settings-fields-col">
                <div className="form-field">
                  <label htmlFor={regTitleId} className="form-label">
                    Portal Title
                  </label>
                  <input
                    id={regTitleId}
                    type="text"
                    className="text-input"
                    value={draftBranding.registryTitle}
                    onChange={(e) => {
                      setDraftBranding((prev) => ({ ...prev, registryTitle: e.target.value }));
                      setError('');
                    }}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={adminCodeId} className="form-label">
                    Administration Passcode
                  </label>
                  <input
                    id={adminCodeId}
                    type="text"
                    className="text-input mono-num"
                    value={draftPasscodes.all}
                    onChange={(e) => {
                      setDraftPasscodes((prev) => ({ ...prev, all: e.target.value }));
                      setError('');
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {clubsToRender.map((club) => {
            const ids = clubFieldIds[club.id];
            const clubBrand = draftBranding.clubs[club.id];
            return (
              <div key={club.id} className="settings-club-row">
                <div className="settings-logo-col">
                  <ClubLogo
                    kind={club.id}
                    logoDataUrl={clubBrand.logoDataUrl}
                    size="lg"
                  />
                  <div className="settings-photo-actions">
                    <input
                      id={ids.logo}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      aria-label={`Upload logo for ${clubBrand.name}`}
                      onChange={(e) => handleClubPhotoChange(club.id, e)}
                    />
                    <label htmlFor={ids.logo} className="btn btn-sm settings-upload-btn">
                      <Upload size={13} aria-hidden="true" />
                      <span>Upload</span>
                    </label>
                    {clubBrand.logoDataUrl && (
                      <button
                        type="button"
                        className="btn-icon danger"
                        aria-label={`Remove logo for ${clubBrand.name}`}
                        onClick={() =>
                          setDraftBranding((prev) => ({
                            ...prev,
                            clubs: {
                              ...prev.clubs,
                              [club.id]: { ...prev.clubs[club.id], logoDataUrl: null },
                            },
                          }))
                        }
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="settings-fields-col">
                  <div className="form-field">
                    <label htmlFor={ids.name} className="form-label">
                      Club Name
                    </label>
                    <input
                      id={ids.name}
                      type="text"
                      className="text-input"
                      value={clubBrand.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftBranding((prev) => ({
                          ...prev,
                          clubs: {
                            ...prev.clubs,
                            [club.id]: { ...prev.clubs[club.id], name: val },
                          },
                        }));
                        setError('');
                      }}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor={ids.code} className="form-label">
                      Passcode
                    </label>
                    <input
                      id={ids.code}
                      type="text"
                      className="text-input mono-num"
                      value={draftPasscodes[club.id]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftPasscodes((prev) => ({ ...prev, [club.id]: val }));
                        setError('');
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn" onClick={handleResetDefaults}>
            Reset Defaults
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
