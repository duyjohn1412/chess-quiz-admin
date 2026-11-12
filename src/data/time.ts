import { RoomDoc } from '../types/admin';

export const QUEUE_ALIVE_WINDOW_MS = 25_000;
export const ROOM_STALE_WAITING_MS = 10 * 60_000;
export const ROOM_STALE_ACTIVE_MS = 30 * 60_000;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatTimeAgoVi(updatedAtMs: number, nowMs: number = Date.now()): string {
  if (!updatedAtMs || !Number.isFinite(updatedAtMs)) return 'chưa rõ';
  const diffSec = Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000));
  if (diffSec < 5) return 'vừa xong';
  if (diffSec < 60) return `${diffSec} giây trước`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} giờ trước`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} ngày trước`;
}

export function isQueueTicketAlive(updatedAtMs: number, nowMs: number = Date.now()): boolean {
  if (!updatedAtMs || !Number.isFinite(updatedAtMs)) return false;
  return nowMs - updatedAtMs <= QUEUE_ALIVE_WINDOW_MS;
}

export function isRoomLikelyStale(
  room: Pick<RoomDoc, 'status' | 'phase' | 'updatedAtMs'>,
  nowMs: number = Date.now()
): boolean {
  if (room.status === 'CLOSED' || room.phase === 'GAME_OVER') return false;
  if (!room.updatedAtMs || !Number.isFinite(room.updatedAtMs)) return false;
  const age = nowMs - room.updatedAtMs;
  if (room.status === 'WAITING' || room.phase === 'LOBBY') {
    return age > ROOM_STALE_WAITING_MS;
  }
  return age > ROOM_STALE_ACTIVE_MS;
}

export function isOldClosedRoom(
  room: Pick<RoomDoc, 'status' | 'phase' | 'updatedAtMs'>,
  days = 7,
  nowMs: number = Date.now()
): boolean {
  if (room.status !== 'CLOSED' && room.phase !== 'GAME_OVER') return false;
  if (!room.updatedAtMs || !Number.isFinite(room.updatedAtMs)) return false;
  return nowMs - room.updatedAtMs >= days * MS_PER_DAY;
}
