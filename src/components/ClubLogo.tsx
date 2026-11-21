import type { CSSProperties } from 'react';
import { Atom, Dna, FlaskConical, Sigma } from 'lucide-react';
import { CLUB_MAP } from '../data/clubs';
import type { ClubId } from '../types/tracker';

interface ClubLogoProps {
  kind: ClubId | 'registry';
  logoDataUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  alt?: string;
}

const CLUB_ICONS: Record<ClubId, typeof FlaskConical> = {
  chemistry: FlaskConical,
  physics: Atom,
  mathematics: Sigma,
  biology: Dna,
};

const ICON_SIZES: Record<'sm' | 'md' | 'lg', number> = {
  sm: 17,
  md: 20,
  lg: 24,
};

export function ClubLogo({
  kind,
  logoDataUrl,
  size = 'md',
  alt = '',
}: ClubLogoProps) {
  if (kind === 'registry') {
    if (logoDataUrl) {
      return (
        <span className={`club-logo-box registry ${size}`}>
          <img src={logoDataUrl} alt={alt} className="club-logo-img" />
        </span>
      );
    }
    return (
      <span className={`club-logo-box registry fallback ${size}`} aria-hidden={alt === ''}>
        <span className="brand-monogram">SC</span>
      </span>
    );
  }

  const meta = CLUB_MAP[kind];
  const Icon = CLUB_ICONS[kind];
  const style = {
    '--club-accent': meta.accent,
    '--club-soft': meta.softBg,
    '--club-ink': meta.ink,
    '--club-border': meta.border,
  } as CSSProperties;

  if (logoDataUrl) {
    return (
      <span className={`club-logo-box ${size}`} style={style}>
        <img src={logoDataUrl} alt={alt} className="club-logo-img" />
      </span>
    );
  }

  return (
    <span
      className={`club-logo-box fallback ${size}`}
      style={style}
      aria-hidden={alt === ''}
    >
      <Icon size={ICON_SIZES[size]} />
    </span>
  );
}
