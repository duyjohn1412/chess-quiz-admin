import { PlayerDoc } from '../types/admin';

export const MIN_ELO = 600;
export const MAX_ELO = 3000;
export const INITIAL_ELO = 1000;

export interface RankTierInfo {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  label: string;
  icon: string;
  color: string;
}

const TIERS: { minElo: number; info: RankTierInfo }[] = [
  { minElo: 1600, info: { tier: 'diamond', label: 'Kim Cương', icon: '👑', color: '#a78bfa' } },
  { minElo: 1400, info: { tier: 'platinum', label: 'Bạch Kim', icon: '💎', color: '#38bdf8' } },
  { minElo: 1200, info: { tier: 'gold', label: 'Vàng', icon: '🥇', color: '#facc15' } },
  { minElo: 1050, info: { tier: 'silver', label: 'Bạc', icon: '🥈', color: '#cbd5e1' } },
  { minElo: 0, info: { tier: 'bronze', label: 'Đồng', icon: '🥉', color: '#d97706' } },
];

export function clampElo(elo: number): number {
  if (!Number.isFinite(elo)) return INITIAL_ELO;
  return Math.max(MIN_ELO, Math.min(MAX_ELO, Math.round(elo)));
}

export function getRankTier(elo: number): RankTierInfo {
  const safe = clampElo(elo);
  return TIERS.find((t) => safe >= t.minElo)?.info ?? TIERS[TIERS.length - 1].info;
}

export interface EditablePlayerInput {
  name: string;
  elo: number;
  bestElo: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  ranked: boolean;
  lastMatchId?: string;
}

export function sanitizePlayerEdit(input: EditablePlayerInput): {
  name: string;
  elo: number;
  bestElo: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  streak: number;
  ranked: boolean;
  lastMatchId: string;
} {
  const cleanName = input.name.trim().slice(0, 24) || 'Người chơi';
  const wins = Math.max(0, Math.floor(Number(input.wins) || 0));
  const losses = Math.max(0, Math.floor(Number(input.losses) || 0));
  const draws = Math.max(0, Math.floor(Number(input.draws) || 0));
  const elo = clampElo(Number(input.elo));
  const bestElo = Math.max(elo, clampElo(Number(input.bestElo)));
  const streak = Math.max(0, Math.min(wins, Math.floor(Number(input.streak) || 0)));
  const lastMatchId = String(input.lastMatchId ?? '').trim().slice(0, 16);

  return {
    name: cleanName,
    elo,
    bestElo,
    wins,
    losses,
    draws,
    gamesPlayed: wins + losses + draws,
    streak,
    ranked: Boolean(input.ranked),
    lastMatchId,
  };
}

export function buildCreatePlayerDocument(uid: string, input: EditablePlayerInput): Omit<PlayerDoc, 'updatedAtMs'> {
  const cleanUid = uid.trim().slice(0, 128);
  const sanitized = sanitizePlayerEdit(input);
  return {
    uid: cleanUid,
    ...sanitized,
  };
}
