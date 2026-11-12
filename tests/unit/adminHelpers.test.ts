import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, getCardMeta } from '../../src/data/cards';
import { buildCreatePlayerDocument, clampElo, getRankTier, sanitizePlayerEdit } from '../../src/data/rank';

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
});
