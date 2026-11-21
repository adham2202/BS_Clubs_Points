import { useId, useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Shield } from 'lucide-react';
import { CLUBS, CLUB_MAP } from '../data/clubs';
import {
  verifyClubAccess,
  type AuthSession,
  type ClubManagers,
  type ClubPasscodes,
} from '../state/auth';
import type { BrandingConfig } from '../state/branding';
import type { ClubFilter } from '../types/tracker';
import { ClubLogo } from './ClubLogo';

interface ClubLoginPageProps {
  branding: BrandingConfig;
  passcodes: ClubPasscodes;
  managers: ClubManagers;
  onSignIn: (session: AuthSession) => void;
}

export function ClubLoginPage({
  branding,
  passcodes,
  managers,
  onSignIn,
}: ClubLoginPageProps) {
  const nameInputId = useId();
  const codeInputId = useId();
  const rememberCheckId = useId();

  const [selectedScope, setSelectedScope] = useState<ClubFilter | null>(null);
  const [officerName, setOfficerName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');

  const openScopeSignIn = (scope: ClubFilter) => {
    setSelectedScope(scope);
    setPasscode('');
    setShowCode(false);
    setError('');
  };

  if (selectedScope === null) {
    return (
      <div className="portal-page">
        <main className="portal-column">
          <div className="portal-masthead">
            <ClubLogo
              kind="registry"
              logoDataUrl={branding.registryLogoDataUrl}
              size="lg"
            />
            <h1 className="portal-title">{branding.registryTitle}</h1>
          </div>

          <nav className="portal-vertical-list" aria-label="Select a club">
            {CLUBS.map((club) => {
              const clubBrand = branding.clubs[club.id];
              const rowStyle = {
                '--club-accent': club.accent,
                '--club-ink': club.ink,
                '--club-soft': club.softBg,
                '--club-border': club.border,
              } as CSSProperties;

              return (
                <button
                  key={club.id}
                  type="button"
                  className="portal-club-row"
                  style={rowStyle}
                  onClick={() => openScopeSignIn(club.id)}
                >
                  <span className="portal-club-row-left">
                    <ClubLogo
                      kind={club.id}
                      logoDataUrl={clubBrand.logoDataUrl}
                      size="lg"
                    />
                    <span className="portal-club-row-name">{clubBrand.name}</span>
                  </span>
                  <ArrowRight size={19} className="portal-club-arrow" aria-hidden="true" />
                </button>
              );
            })}
          </nav>

          <div className="portal-admin-footer">
            <button
              type="button"
              className="portal-admin-btn"
              onClick={() => openScopeSignIn('all')}
            >
              <Shield size={15} aria-hidden="true" />
              <span>Administration</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  const activeMeta = selectedScope === 'all' ? null : CLUB_MAP[selectedScope];
  const scopeTitle =
    selectedScope === 'all' ? 'Administration' : branding.clubs[selectedScope].name;
  const scopeLogoUrl =
    selectedScope === 'all'
      ? branding.registryLogoDataUrl
      : branding.clubs[selectedScope].logoDataUrl;

  const themeVars = (
    activeMeta
      ? {
          '--portal-accent': activeMeta.accent,
          '--portal-ink': activeMeta.ink,
          '--portal-soft': activeMeta.softBg,
          '--portal-border': activeMeta.border,
          '--portal-btn': activeMeta.ink,
        }
      : {
          '--portal-accent': '#1C1917',
          '--portal-ink': '#1C1917',
          '--portal-soft': '#EFECE4',
          '--portal-border': '#C9C2B4',
          '--portal-btn': '#1C1917',
        }
  ) as CSSProperties;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const access = verifyClubAccess(
      selectedScope,
      officerName,
      passcode,
      passcodes,
      managers,
    );
    if (!access.ok) {
      setError(access.error);
      return;
    }

    onSignIn({
      scope: selectedScope,
      officerName: access.canonicalName,
      signedInAt: new Date().toISOString(),
      remember,
    });
  };

  return (
    <div className="portal-page" style={themeVars}>
      <main className="portal-signin-column">
        <button
          type="button"
          className="portal-back-btn"
          onClick={() => {
            setSelectedScope(null);
            setPasscode('');
            setError('');
          }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Clubs</span>
        </button>

        <section className="portal-signin-card" aria-label={`${scopeTitle} sign in`}>
          <div className="portal-signin-head">
            <ClubLogo
              kind={selectedScope === 'all' ? 'registry' : selectedScope}
              logoDataUrl={scopeLogoUrl}
              size="lg"
            />
            <h1 className="portal-signin-title">{scopeTitle}</h1>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor={nameInputId} className="form-label">
                Name
              </label>
              <input
                id={nameInputId}
                type="text"
                className="text-input"
                autoComplete="name"
                value={officerName}
                onChange={(e) => {
                  setOfficerName(e.target.value);
                  setError('');
                }}
              />
            </div>

            <div className="form-field">
              <label htmlFor={codeInputId} className="form-label">
                Passcode
              </label>
              <div className="password-input-wrap">
                <input
                  id={codeInputId}
                  type={showCode ? 'text' : 'password'}
                  className="text-input mono-num password-input"
                  autoComplete="current-password"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setError('');
                  }}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  aria-label={showCode ? 'Hide passcode' : 'Show passcode'}
                  onClick={() => setShowCode((prev) => !prev)}
                >
                  {showCode ? (
                    <EyeOff size={16} aria-hidden="true" />
                  ) : (
                    <Eye size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="login-remember-row">
              <input
                id={rememberCheckId}
                type="checkbox"
                className="row-checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label htmlFor={rememberCheckId} className="login-remember-label">
                Stay signed in
              </label>
            </div>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="login-submit-btn">
              <span>Sign in</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
