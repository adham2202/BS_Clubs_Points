import type { ClubId, ClubMeta } from '../types/tracker';

export const CLUBS: readonly ClubMeta[] = [
  {
    id: 'chemistry',
    name: 'Chemistry',
    shortName: 'Chem',
    tagline: 'Reactions, synthesis & lab outreach',
    accent: '#0E6B5E',
    softBg: '#E6F4F1',
    ink: '#0A5248',
    border: '#B8DDD6',
  },
  {
    id: 'physics',
    name: 'Physics',
    shortName: 'Phys',
    tagline: 'Mechanics, optics & experimental demos',
    accent: '#234B8E',
    softBg: '#E8EFFA',
    ink: '#1A396D',
    border: '#C2D3EE',
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    shortName: 'Math',
    tagline: 'Olympiad problem-solving & seminars',
    accent: '#B45309',
    softBg: '#FBF0DC',
    ink: '#853D06',
    border: '#E9CD9D',
  },
  {
    id: 'biology',
    name: 'Biology',
    shortName: 'Bio',
    tagline: 'Microscopy, ecology & field studies',
    accent: '#3F6A2E',
    softBg: '#EAF3E4',
    ink: '#2D4E1F',
    border: '#C5DCBA',
  },
] as const;

export const CLUB_MAP: Record<ClubId, ClubMeta> = {
  chemistry: CLUBS[0],
  physics: CLUBS[1],
  mathematics: CLUBS[2],
  biology: CLUBS[3],
};

export function isClubId(val: unknown): val is ClubId {
  return (
    val === 'chemistry' ||
    val === 'physics' ||
    val === 'mathematics' ||
    val === 'biology'
  );
}
