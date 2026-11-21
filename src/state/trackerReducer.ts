import { createSeedState } from '../data/seedData';
import type {
  AppState,
  ClubId,
  Committee,
  Member,
  PointEvent,
} from '../types/tracker';

export function createId(prefix: string): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type TrackerAction =
  | {
      type: 'ADJUST_POINTS';
      memberId: string;
      delta: number;
      reason?: string;
      eventId?: string;
      timestamp?: string;
    }
  | {
      type: 'BATCH_ADJUST_POINTS';
      memberIds: string[];
      delta: number;
      reason?: string;
      timestamp?: string;
    }
  | {
      type: 'SET_MEMBER_POINTS';
      memberId: string;
      targetPoints: number;
      reason?: string;
      eventId?: string;
      timestamp?: string;
    }
  | {
      type: 'REVERT_EVENT';
      eventId: string;
      timestamp?: string;
    }
  | {
      type: 'ADD_COMMITTEE';
      clubId: ClubId;
      name: string;
      description?: string;
      id?: string;
      createdAt?: string;
    }
  | {
      type: 'UPDATE_COMMITTEE';
      committeeId: string;
      clubId: ClubId;
      name: string;
      description: string;
    }
  | {
      type: 'DELETE_COMMITTEE';
      committeeId: string;
    }
  | {
      type: 'ADD_MEMBER';
      clubId: ClubId;
      committeeId: string;
      name: string;
      role?: string;
      phone?: string;
      email?: string;
      initialPoints?: number;
      id?: string;
      timestamp?: string;
    }
  | {
      type: 'BULK_ADD_MEMBERS';
      clubId: ClubId;
      committeeId: string;
      entries: Array<{
        name: string;
        role?: string;
        phone?: string;
        email?: string;
        initialPoints?: number;
      }>;
      timestamp?: string;
    }
  | {
      type: 'UPDATE_MEMBER';
      memberId: string;
      name: string;
      role: string;
      phone?: string;
      email?: string;
      points?: number;
      clubId: ClubId;
      committeeId: string;
      timestamp?: string;
    }
  | {
      type: 'DELETE_MEMBER';
      memberId: string;
    }
  | {
      type: 'RESTORE_SNAPSHOT';
      snapshot: AppState;
    }
  | {
      type: 'IMPORT_STATE';
      state: AppState;
    }
  | {
      type: 'IMPORT_CLUB_STATE';
      clubId: ClubId;
      state: AppState;
    }
  | {
      type: 'RESET_SEED';
    }
  | {
      type: 'RESET_CLUB_SEED';
      clubId: ClubId;
    }
  | {
      type: 'CLEAR_ALL';
    }
  | {
      type: 'CLEAR_CLUB';
      clubId: ClubId;
    }
  | {
      type: 'SYNC_CLUB_SHEET';
      clubId: ClubId;
      mode: 'merge' | 'replace';
      rows: Array<{
        name: string;
        committeeName: string;
        phone?: string;
        email?: string;
        role?: string;
        points?: number;
      }>;
      timestamp?: string;
    };

export function trackerReducer(state: AppState, action: TrackerAction): AppState {
  switch (action.type) {
    case 'ADJUST_POINTS': {
      const delta = Math.trunc(action.delta);
      if (!Number.isFinite(delta) || delta === 0) {
        return state;
      }

      const memberIndex = state.members.findIndex((m) => m.id === action.memberId);
      if (memberIndex === -1) {
        return state;
      }

      const member = state.members[memberIndex];
      const committee = state.committees.find((c) => c.id === member.committeeId);
      const now = action.timestamp ?? new Date().toISOString();
      const previousPoints = member.points;
      const newPoints = previousPoints + delta;

      const updatedMember: Member = {
        ...member,
        points: newPoints,
        updatedAt: now,
      };

      const nextMembers = state.members.slice();
      nextMembers[memberIndex] = updatedMember;

      const event: PointEvent = {
        id: action.eventId ?? createId('evt'),
        memberId: member.id,
        memberName: member.name,
        clubId: member.clubId,
        committeeId: member.committeeId,
        committeeName: committee?.name ?? 'Committee',
        delta,
        previousPoints,
        newPoints,
        reason: action.reason?.trim() || 'Quick adjustment',
        timestamp: now,
      };

      return {
        ...state,
        members: nextMembers,
        history: [event, ...state.history],
      };
    }

    case 'BATCH_ADJUST_POINTS': {
      const delta = Math.trunc(action.delta);
      if (!Number.isFinite(delta) || delta === 0 || action.memberIds.length === 0) {
        return state;
      }

      const targetIds = new Set(action.memberIds);
      const now = action.timestamp ?? new Date().toISOString();
      const reason = action.reason?.trim() || 'Batch adjustment';
      const committeeNameById = new Map(state.committees.map((c) => [c.id, c.name]));
      const newEvents: PointEvent[] = [];
      let changed = false;

      const nextMembers = state.members.map((member) => {
        if (!targetIds.has(member.id)) return member;
        changed = true;
        const previousPoints = member.points;
        const newPoints = previousPoints + delta;
        newEvents.push({
          id: createId('evt'),
          memberId: member.id,
          memberName: member.name,
          clubId: member.clubId,
          committeeId: member.committeeId,
          committeeName: committeeNameById.get(member.committeeId) ?? 'Committee',
          delta,
          previousPoints,
          newPoints,
          reason,
          timestamp: now,
        });
        return {
          ...member,
          points: newPoints,
          updatedAt: now,
        };
      });

      if (!changed) {
        return state;
      }

      return {
        ...state,
        members: nextMembers,
        history: [...newEvents.reverse(), ...state.history],
      };
    }

    case 'SET_MEMBER_POINTS': {
      if (!Number.isFinite(action.targetPoints)) {
        return state;
      }
      const targetPoints = Math.trunc(action.targetPoints);
      const memberIndex = state.members.findIndex((m) => m.id === action.memberId);
      if (memberIndex === -1) {
        return state;
      }

      const member = state.members[memberIndex];
      const delta = targetPoints - member.points;
      if (delta === 0) {
        return state;
      }

      const committee = state.committees.find((c) => c.id === member.committeeId);
      const now = action.timestamp ?? new Date().toISOString();
      const nextMembers = state.members.slice();
      nextMembers[memberIndex] = {
        ...member,
        points: targetPoints,
        updatedAt: now,
      };

      const event: PointEvent = {
        id: action.eventId ?? createId('evt'),
        memberId: member.id,
        memberName: member.name,
        clubId: member.clubId,
        committeeId: member.committeeId,
        committeeName: committee?.name ?? 'Committee',
        delta,
        previousPoints: member.points,
        newPoints: targetPoints,
        reason: action.reason?.trim() || 'Manual score edit',
        timestamp: now,
      };

      return {
        ...state,
        members: nextMembers,
        history: [event, ...state.history],
      };
    }

    case 'REVERT_EVENT': {
      const eventIndex = state.history.findIndex((e) => e.id === action.eventId);
      if (eventIndex === -1) {
        return state;
      }

      const targetEvent = state.history[eventIndex];
      if (targetEvent.reverted) {
        return state;
      }

      const now = action.timestamp ?? new Date().toISOString();
      const nextHistory = state.history.map((evt, idx) =>
        idx === eventIndex ? { ...evt, reverted: true } : evt,
      );

      const memberIndex = state.members.findIndex((m) => m.id === targetEvent.memberId);
      if (memberIndex === -1) {
        return {
          ...state,
          history: nextHistory,
        };
      }

      const member = state.members[memberIndex];
      const nextMembers = state.members.slice();
      nextMembers[memberIndex] = {
        ...member,
        points: member.points - targetEvent.delta,
        updatedAt: now,
      };

      return {
        ...state,
        members: nextMembers,
        history: nextHistory,
      };
    }

    case 'ADD_COMMITTEE': {
      const name = action.name.trim();
      if (!name) {
        return state;
      }

      const newCommittee: Committee = {
        id: action.id ?? createId('com'),
        clubId: action.clubId,
        name,
        description: action.description?.trim() ?? '',
        createdAt: action.createdAt ?? new Date().toISOString(),
      };

      return {
        ...state,
        committees: [...state.committees, newCommittee],
      };
    }

    case 'UPDATE_COMMITTEE': {
      const name = action.name.trim();
      if (!name) {
        return state;
      }

      const existing = state.committees.find((c) => c.id === action.committeeId);
      if (!existing) {
        return state;
      }

      const clubChanged = existing.clubId !== action.clubId;

      const nextCommittees = state.committees.map((c) =>
        c.id === action.committeeId
          ? {
              ...c,
              clubId: action.clubId,
              name,
              description: action.description.trim(),
            }
          : c,
      );

      const nextMembers = clubChanged
        ? state.members.map((m) =>
            m.committeeId === action.committeeId ? { ...m, clubId: action.clubId } : m,
          )
        : state.members;

      return {
        ...state,
        committees: nextCommittees,
        members: nextMembers,
      };
    }

    case 'DELETE_COMMITTEE': {
      if (!state.committees.some((c) => c.id === action.committeeId)) {
        return state;
      }

      return {
        ...state,
        committees: state.committees.filter((c) => c.id !== action.committeeId),
        members: state.members.filter((m) => m.committeeId !== action.committeeId),
      };
    }

    case 'ADD_MEMBER': {
      const name = action.name.trim();
      if (!name) {
        return state;
      }

      const committee = state.committees.find((c) => c.id === action.committeeId);
      if (!committee) {
        return state;
      }

      const now = action.timestamp ?? new Date().toISOString();
      const initialPoints = Number.isFinite(action.initialPoints)
        ? Math.trunc(action.initialPoints ?? 0)
        : 0;
      const memberId = action.id ?? createId('mem');
      const phone = action.phone?.trim() || undefined;
      const email = action.email?.trim() || undefined;

      const newMember: Member = {
        id: memberId,
        clubId: committee.clubId,
        committeeId: committee.id,
        name,
        role: action.role?.trim() || 'Member',
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
        points: initialPoints,
        createdAt: now,
        updatedAt: now,
      };

      let nextHistory = state.history;
      if (initialPoints !== 0) {
        const initEvent: PointEvent = {
          id: createId('evt'),
          memberId,
          memberName: name,
          clubId: committee.clubId,
          committeeId: committee.id,
          committeeName: committee.name,
          delta: initialPoints,
          previousPoints: 0,
          newPoints: initialPoints,
          reason: 'Initial points',
          timestamp: now,
        };
        nextHistory = [initEvent, ...state.history];
      }

      return {
        ...state,
        members: [...state.members, newMember],
        history: nextHistory,
      };
    }

    case 'BULK_ADD_MEMBERS': {
      const committee = state.committees.find((c) => c.id === action.committeeId);
      if (!committee) {
        return state;
      }

      const now = action.timestamp ?? new Date().toISOString();
      const addedMembers: Member[] = [];
      const addedEvents: PointEvent[] = [];

      for (const entry of action.entries) {
        const name = entry.name.trim();
        if (!name) continue;
        const initialPoints = Number.isFinite(entry.initialPoints)
          ? Math.trunc(entry.initialPoints ?? 0)
          : 0;
        const memberId = createId('mem');
        const phone = entry.phone?.trim() || undefined;
        const email = entry.email?.trim() || undefined;

        addedMembers.push({
          id: memberId,
          clubId: committee.clubId,
          committeeId: committee.id,
          name,
          role: entry.role?.trim() || 'Member',
          ...(phone ? { phone } : {}),
          ...(email ? { email } : {}),
          points: initialPoints,
          createdAt: now,
          updatedAt: now,
        });

        if (initialPoints !== 0) {
          addedEvents.push({
            id: createId('evt'),
            memberId,
            memberName: name,
            clubId: committee.clubId,
            committeeId: committee.id,
            committeeName: committee.name,
            delta: initialPoints,
            previousPoints: 0,
            newPoints: initialPoints,
            reason: 'Initial points',
            timestamp: now,
          });
        }
      }

      if (addedMembers.length === 0) {
        return state;
      }

      return {
        ...state,
        members: [...state.members, ...addedMembers],
        history: [...addedEvents.reverse(), ...state.history],
      };
    }

    case 'UPDATE_MEMBER': {
      const name = action.name.trim();
      if (!name) {
        return state;
      }

      const targetCommittee = state.committees.find((c) => c.id === action.committeeId);
      if (!targetCommittee) {
        return state;
      }

      const existing = state.members.find((m) => m.id === action.memberId);
      if (!existing) {
        return state;
      }

      const now = action.timestamp ?? new Date().toISOString();
      const nextPhone =
        action.phone !== undefined ? action.phone.trim() || undefined : existing.phone;
      const nextEmail =
        action.email !== undefined ? action.email.trim() || undefined : existing.email;

      const hasTargetPoints =
        action.points !== undefined && Number.isFinite(action.points);
      const targetPoints = hasTargetPoints
        ? Math.trunc(action.points!)
        : existing.points;
      const pointsDelta = targetPoints - existing.points;

      let nextHistory = state.history;
      if (hasTargetPoints && pointsDelta !== 0) {
        const editEvent: PointEvent = {
          id: createId('evt'),
          memberId: existing.id,
          memberName: name,
          clubId: targetCommittee.clubId,
          committeeId: targetCommittee.id,
          committeeName: targetCommittee.name,
          delta: pointsDelta,
          previousPoints: existing.points,
          newPoints: targetPoints,
          reason: 'Manual score edit',
          timestamp: now,
        };
        nextHistory = [editEvent, ...state.history];
      }

      return {
        ...state,
        members: state.members.map((m) =>
          m.id === action.memberId
            ? {
                ...m,
                name,
                role: action.role.trim() || 'Member',
                phone: nextPhone,
                email: nextEmail,
                points: targetPoints,
                clubId: targetCommittee.clubId,
                committeeId: targetCommittee.id,
                updatedAt: now,
              }
            : m,
        ),
        history: nextHistory,
      };
    }

    case 'DELETE_MEMBER': {
      if (!state.members.some((m) => m.id === action.memberId)) {
        return state;
      }

      return {
        ...state,
        members: state.members.filter((m) => m.id !== action.memberId),
      };
    }

    case 'RESTORE_SNAPSHOT':
      return action.snapshot;

    case 'IMPORT_STATE':
      return action.state;

    case 'IMPORT_CLUB_STATE': {
      const target = action.clubId;
      return {
        version: 1,
        committees: [
          ...state.committees.filter((c) => c.clubId !== target),
          ...action.state.committees.filter((c) => c.clubId === target),
        ],
        members: [
          ...state.members.filter((m) => m.clubId !== target),
          ...action.state.members.filter((m) => m.clubId === target),
        ],
        history: [
          ...state.history.filter((e) => e.clubId !== target),
          ...action.state.history.filter((e) => e.clubId === target),
        ],
      };
    }

    case 'RESET_SEED':
      return createSeedState();

    case 'RESET_CLUB_SEED': {
      const seed = createSeedState();
      const target = action.clubId;
      return {
        version: 1,
        committees: [
          ...state.committees.filter((c) => c.clubId !== target),
          ...seed.committees.filter((c) => c.clubId === target),
        ],
        members: [
          ...state.members.filter((m) => m.clubId !== target),
          ...seed.members.filter((m) => m.clubId === target),
        ],
        history: [
          ...state.history.filter((e) => e.clubId !== target),
          ...seed.history.filter((e) => e.clubId === target),
        ],
      };
    }

    case 'CLEAR_ALL':
      return {
        version: 1,
        committees: [],
        members: [],
        history: [],
      };

    case 'CLEAR_CLUB': {
      const target = action.clubId;
      return {
        version: 1,
        committees: state.committees.filter((c) => c.clubId !== target),
        members: state.members.filter((m) => m.clubId !== target),
        history: state.history.filter((e) => e.clubId !== target),
      };
    }

    case 'SYNC_CLUB_SHEET': {
      if (action.rows.length === 0) {
        return state;
      }

      const target = action.clubId;
      const now = action.timestamp ?? new Date().toISOString();
      const otherCommittees = state.committees.filter((c) => c.clubId !== target);
      const otherMembers = state.members.filter((m) => m.clubId !== target);

      const nextClubCommittees: Committee[] =
        action.mode === 'replace'
          ? []
          : state.committees
              .filter((c) => c.clubId === target)
              .map((c) => ({ ...c }));
      const nextClubMembers: Member[] =
        action.mode === 'replace'
          ? []
          : state.members
              .filter((m) => m.clubId === target)
              .map((m) => ({ ...m }));

      const committeeByKey = new Map<string, Committee>();
      for (const com of nextClubCommittees) {
        committeeByKey.set(com.name.trim().toLowerCase(), com);
      }

      const ensureCommittee = (rawName: string): Committee => {
        const cleaned = rawName.trim().replace(/\s+/g, ' ') || 'General';
        const key = cleaned.toLowerCase();
        const found = committeeByKey.get(key);
        if (found) return found;

        const created: Committee = {
          id: createId('com'),
          clubId: target,
          name: cleaned,
          description: '',
          createdAt: now,
        };
        committeeByKey.set(key, created);
        nextClubCommittees.push(created);
        return created;
      };

      const addedEvents: PointEvent[] = [];

      for (const row of action.rows) {
        const rowName = row.name.trim().replace(/\s+/g, ' ');
        if (!rowName) continue;

        const rowEmail = (row.email ?? '').trim();
        const rowPhone = (row.phone ?? '').trim();
        const rowRole = (row.role ?? '').trim() || 'Member';
        const rowPoints =
          row.points !== undefined && Number.isFinite(row.points)
            ? Math.trunc(row.points)
            : 0;
        const targetCom = ensureCommittee(row.committeeName);

        const matchIdx = nextClubMembers.findIndex((m) => {
          if (rowEmail && m.email) {
            if (m.email.trim().toLowerCase() === rowEmail.toLowerCase()) {
              return true;
            }
          }
          return (
            m.name.trim().replace(/\s+/g, ' ').toLowerCase() ===
            rowName.toLowerCase()
          );
        });

        if (matchIdx !== -1) {
          const existing = nextClubMembers[matchIdx];
          const nextPoints =
            existing.points === 0 && rowPoints !== 0 ? rowPoints : existing.points;
          if (nextPoints !== existing.points) {
            addedEvents.push({
              id: createId('evt'),
              memberId: existing.id,
              memberName: rowName,
              clubId: target,
              committeeId: targetCom.id,
              committeeName: targetCom.name,
              delta: nextPoints - existing.points,
              previousPoints: existing.points,
              newPoints: nextPoints,
              reason: 'Google Sheet import',
              timestamp: now,
            });
          }
          const preservedRole =
            rowRole.toLowerCase() === 'member' &&
            existing.role.trim().toLowerCase() !== 'member'
              ? existing.role
              : rowRole;

          nextClubMembers[matchIdx] = {
            ...existing,
            name: rowName,
            role: preservedRole,
            committeeId: targetCom.id,
            phone: rowPhone || existing.phone,
            email: rowEmail || existing.email,
            points: nextPoints,
            updatedAt: now,
          };
        } else {
          const memberId = createId('mem');
          nextClubMembers.push({
            id: memberId,
            clubId: target,
            committeeId: targetCom.id,
            name: rowName,
            role: rowRole,
            ...(rowPhone ? { phone: rowPhone } : {}),
            ...(rowEmail ? { email: rowEmail } : {}),
            points: rowPoints,
            createdAt: now,
            updatedAt: now,
          });
          if (rowPoints !== 0) {
            addedEvents.push({
              id: createId('evt'),
              memberId,
              memberName: rowName,
              clubId: target,
              committeeId: targetCom.id,
              committeeName: targetCom.name,
              delta: rowPoints,
              previousPoints: 0,
              newPoints: rowPoints,
              reason: 'Google Sheet import',
              timestamp: now,
            });
          }
        }
      }

      return {
        version: 1,
        committees: [...otherCommittees, ...nextClubCommittees],
        members: [...otherMembers, ...nextClubMembers],
        history: [...addedEvents.reverse(), ...state.history],
      };
    }

    default:
      return state;
  }
}
