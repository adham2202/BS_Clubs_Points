export type ClubId = 'chemistry' | 'physics' | 'mathematics' | 'biology';

export type ClubFilter = 'all' | ClubId;

export type RoleFilter = 'all' | string;

export type SortOption = 'points-desc' | 'points-asc' | 'name-asc' | 'recent';

export type WorkspaceView = 'roster' | 'analytics' | 'leaderboard' | 'admin';

export type DensityMode = 'comfortable' | 'compact';

export interface ClubMeta {
  id: ClubId;
  name: string;
  shortName: string;
  tagline: string;
  accent: string;
  softBg: string;
  ink: string;
  border: string;
}

export interface Committee {
  id: string;
  clubId: ClubId;
  name: string;
  description: string;
  createdAt: string;
}

export interface Member {
  id: string;
  clubId: ClubId;
  committeeId: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  points: number;
  createdAt: string;
  updatedAt: string;
}

export interface PointEvent {
  id: string;
  memberId: string;
  memberName: string;
  clubId: ClubId;
  committeeId: string;
  committeeName: string;
  delta: number;
  previousPoints: number;
  newPoints: number;
  reason: string;
  timestamp: string;
  reverted?: boolean;
}

export interface AppState {
  version: 1;
  committees: Committee[];
  members: Member[];
  history: PointEvent[];
}
