import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, getCardMeta } from '../../src/data/cards';
import { buildCreatePlayerDocument, clampElo, getRankTier, sanitizePlayerEdit } from '../../src/data/rank';
import { formatTimeAgoVi, isOldClosedRoom, isQueueTicketAlive, isRoomLikelyStale, MS_PER_DAY } from '../../src/data/time';

describe('Admin helpers & invariants', () => {
  it('clampElo và getRankTier chuẩn theo ngưỡng hạng', () => {
    expect(clampElo(100)).toBe(600);
    expect(clampElo(9999)).toBe(3000);
    expect(getRankTier(1000).tier).toBe('bronze');
    expect(getRankTier(1050).tier).toBe('silver');
    expect(getRankTier(1250).tier).toBe('gold');
    expect(getRankTier(1450).tier).toBe('platinum');
    expect(getRankTier(1700).tier).toBe('diamond');
  });

  it('sanitizePlayerEdit bảo đảm gamesPlayed = W+L+D, streak <= wins, bestElo >= elo', () => {
    const clean = sanitizePlayerEdit({
      name: '   Quang Duy   ',
      elo: 1800,
      bestElo: 1200,
      wins: 3,
      losses: 2,
      draws: 1,
      streak: 10,
      ranked: true,
      lastMatchId: 'QABC1234',
    });

    expect(clean.name).toBe('Quang Duy');
    expect(clean.bestElo).toBe(1800);
    expect(clean.gamesPlayed).toBe(6);
    expect(clean.streak).toBe(3);
    expect(clean.ranked).toBe(true);
  });

  it('buildCreatePlayerDocument giữ uid và thông số hợp lệ', () => {
    const doc = buildCreatePlayerDocument('  uid_custom_1 ', {
      name: '',
      elo: 1350,
      bestElo: 1300,
      wins: 2,
      losses: 0,
      draws: 0,
      streak: 2,
      ranked: true,
    });
    expect(doc.uid).toBe('uid_custom_1');
    expect(doc.name).toBe('Người chơi');
    expect(doc.bestElo).toBe(1350);
    expect(doc.gamesPlayed).toBe(2);
  });

  it('có đủ 23 thẻ chiến thuật trong catalog', () => {
    expect(CARD_CATALOG).toHaveLength(23);
    expect(getCardMeta('q_flash').name).toBe('Flash');
  });

  it('formatTimeAgoVi, isQueueTicketAlive và isRoomLikelyStale tính đúng trạng thái treo', () => {
    const now = 1_000_000_000;
    expect(formatTimeAgoVi(now - 2_000, now)).toBe('vừa xong');
    expect(formatTimeAgoVi(now - 35_000, now)).toBe('35 giây trước');
    expect(formatTimeAgoVi(now - 180_000, now)).toBe('3 phút trước');

    expect(isQueueTicketAlive(now - 10_000, now)).toBe(true);
    expect(isQueueTicketAlive(now - 30_000, now)).toBe(false);

    expect(isRoomLikelyStale({ status: 'WAITING', phase: 'LOBBY', updatedAtMs: now - 15 * 60_000 }, now)).toBe(true);
    expect(isRoomLikelyStale({ status: 'ACTIVE', phase: 'PLAYING', updatedAtMs: now - 5 * 60_000 }, now)).toBe(false);
    expect(isRoomLikelyStale({ status: 'CLOSED', phase: 'GAME_OVER', updatedAtMs: now - 99 * 60_000 }, now)).toBe(false);
  });

  it('isOldClosedRoom phát hiện phòng đã kết thúc quá hạn ngày', () => {
    const now = 1_000_000_000;
    // Phòng ACTIVE/WAITING không được coi là closed
    expect(isOldClosedRoom({ status: 'ACTIVE', phase: 'PLAYING', updatedAtMs: now - 10 * MS_PER_DAY }, 7, now)).toBe(false);
    // Phòng CLOSED mới kết thúc 3 ngày
    expect(isOldClosedRoom({ status: 'CLOSED', phase: 'GAME_OVER', updatedAtMs: now - 3 * MS_PER_DAY }, 7, now)).toBe(false);
    // Phòng CLOSED đã kết thúc 8 ngày
    expect(isOldClosedRoom({ status: 'CLOSED', phase: 'GAME_OVER', updatedAtMs: now - 8 * MS_PER_DAY }, 7, now)).toBe(true);
  });
});
