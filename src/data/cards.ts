import { CardGroup } from '../types/admin';

export interface CardCatalogItem {
  id: string;
  group: CardGroup;
  name: string;
  icon: string;
  levels: [string, string, string, string];
}

export const CARD_CATALOG: CardCatalogItem[] = [
  {
    id: 'time_plus',
    group: 'time',
    name: 'Cộng giờ',
    icon: '⏱',
    levels: ['+5s đồng hồ', '+10s đồng hồ', '+15s đồng hồ', '+20s đồng hồ'],
  },
  {
    id: 'time_minus',
    group: 'time',
    name: 'Trừ giờ',
    icon: '⌛',
    levels: ['-5s đối thủ', '-10s đối thủ', '-15s đối thủ', '-20s đối thủ'],
  },
  {
    id: 'time_force',
    group: 'time',
    name: 'Ép đi nhanh',
    icon: '⚡',
    levels: ['25s đi nước', '20s đi nước', '15s đi nước', '10s đi nước'],
  },
  {
    id: 'time_freeze',
    group: 'time',
    name: 'Đóng băng',
    icon: '❄️',
    levels: ['Dừng đồng hồ 3s', 'Dừng đồng hồ 5s', 'Dừng đồng hồ 8s', 'Dừng đồng hồ 10s'],
  },
  {
    id: 'sup_radar',
    group: 'support',
    name: 'Radar',
    icon: '📡',
    levels: ['1 lượt', '2 lượt', '3 lượt', '5 lượt'],
  },
  {
    id: 'sup_hint',
    group: 'support',
    name: 'Gợi ý nước đi',
    icon: '💡',
    levels: ['Depth 6', 'Depth 10', 'Depth 14', 'Depth 18'],
  },
  {
    id: 'sup_cand',
    group: 'support',
    name: 'Nước ứng viên',
    icon: '🧭',
    levels: ['5 nước', '4 nước', '3 nước', '2 nước'],
  },
  {
    id: 'sup_scan',
    group: 'support',
    name: 'Quét ô',
    icon: '👁️‍🗨️',
    levels: ['1 lượt', '2 lượt', '3 lượt', '5 lượt'],
  },
  {
    id: 'sup_eval',
    group: 'support',
    name: 'Đánh giá thế cờ',
    icon: '📊',
    levels: ['1 lượt', '2 lượt', '3 lượt', '5 lượt'],
  },
  {
    id: 'sup_plan',
    group: 'support',
    name: 'Kế hoạch',
    icon: '⚖️',
    levels: ['1 gợi ý', '2 gợi ý', '3 gợi ý', '4 gợi ý + tô ô'],
  },
  {
    id: 'peek_vault',
    group: 'peek',
    name: 'Soi kho',
    icon: '🔍',
    levels: ['1 thẻ', '2 thẻ', 'Toàn bộ', 'Full + mức (3 lượt)'],
  },
  {
    id: 'peek_track',
    group: 'peek',
    name: 'Theo dõi',
    icon: '🛰️',
    levels: ['2 lượt', '4 lượt', '6 lượt', '10 lượt'],
  },
  {
    id: 'peek_history',
    group: 'peek',
    name: 'Lộ lịch sử',
    icon: '📜',
    levels: ['1 thẻ', '2 thẻ', '3 thẻ', '5 thẻ + giờ'],
  },
  {
    id: 'peek_coins',
    group: 'peek',
    name: 'Xem xu',
    icon: '🪙',
    levels: ['1 lượt', '2 lượt', '3 lượt', '5 lượt + streak'],
  },
  {
    id: 'peek_shop',
    group: 'peek',
    name: 'Soi shop',
    icon: '🛒',
    levels: ['1 shop', 'Full 1 shop', 'Full 3 shop', 'Full 5 shop'],
  },
  {
    id: 'q_timecut',
    group: 'quiz',
    name: 'Giảm giờ trả lời',
    icon: '⏳',
    levels: ['Còn 12s', 'Còn 10s', 'Còn 8s', 'Còn 5s'],
  },
  {
    id: 'q_harder',
    group: 'quiz',
    name: 'Nâng độ khó',
    icon: '📈',
    levels: ['Dễ -> Vừa', '+1 bậc', 'Ép Khó (1 quiz)', 'Ép Khó (2 quiz)'],
  },
  {
    id: 'q_weak',
    group: 'quiz',
    name: 'Ép chủ đề yếu',
    icon: '🎯',
    levels: ['Xem gợi ý', 'Ép chủ đề (1 quiz)', 'Chủ đề + Khó', 'Ép chủ đề (2 quiz)'],
  },
  {
    id: 'q_lockreroll',
    group: 'quiz',
    name: 'Khóa đổi câu',
    icon: '🔒',
    levels: ['1 quiz', '2 quiz', '3 quiz', '5 quiz'],
  },
  {
    id: 'q_shuffle',
    group: 'quiz',
    name: 'Đảo đáp án',
    icon: '🔀',
    levels: ['Sau 8s', 'Sau 5s', 'Sau 3s', '2 lần (3s, 8s)'],
  },
  {
    id: 'q_hide',
    group: 'quiz',
    name: 'Ẩn đáp án sai',
    icon: '🎭',
    levels: ['Ẩn 1 sai', 'Ẩn 2 sai', 'Ẩn 2 + 5s', 'Ẩn 2 + 5s + độ khó'],
  },
  {
    id: 'q_flash',
    group: 'quiz',
    name: 'Flash',
    icon: '💥',
    levels: ['1 lần', '2 lần', '3 lần', '4 lần'],
  },
  {
    id: 'q_shield',
    group: 'quiz',
    name: 'Lá chắn',
    icon: '🛡️',
    levels: ['Chặn 1 thẻ', 'Chặn + trừ 5s', 'Chặn 2 thẻ', 'Phản ngược lại'],
  },
];

export const CARD_BY_ID: Record<string, CardCatalogItem> = Object.fromEntries(
  CARD_CATALOG.map((c) => [c.id, c])
);

export function getCardMeta(cardId: string): CardCatalogItem {
  return (
    CARD_BY_ID[cardId] ?? {
      id: cardId,
      group: 'support',
      name: cardId,
      icon: '🃏',
      levels: ['', '', '', ''],
    }
  );
}
