export type Color = 'w' | 'b';
export type PlayerId = 'p1' | 'p2';
export type CardLevel = 1 | 2 | 3 | 4;
export type CardGroup = 'time' | 'support' | 'peek' | 'quiz';
export type GamePhase =
  | 'LOBBY'
  | 'PLAYING'
  | 'PRE_QUIZ'
  | 'QUIZ'
  | 'RESULT'
  | 'SHOP'
  | 'GAME_OVER';

export interface HeldCard {
  uid: string;
  cardId: string;
  level: CardLevel;
}

export interface GameEvent {
  id: string;
  at: number;
  kind: string;
  message: string;
  by?: PlayerId;
  target?: PlayerId;
  flashCount?: number;
}

export interface GameOverInfo {
  winner: Color | 'draw';
  reason:
    | 'checkmate'
    | 'timeout'
    | 'resign'
    | 'draw_agreement'
    | 'stalemate'
    | 'threefold'
    | 'insufficient'
    | 'fifty_move'
    | 'disconnect';
  stats: {
    p1: { name: string; color: Color; quizCorrect: number; quizTotal: number; totalCoins: number; cardsUsed: number };
    p2: { name: string; color: Color; quizCorrect: number; quizTotal: number; totalCoins: number; cardsUsed: number };
    totalQuizzes: number;
    totalPlies: number;
  };
}

export interface AdminPlayerSnapshot {
  id: PlayerId;
  name: string;
  elo?: number;
  color: Color;
  clockMs: number;
  freezeRemainingMs: number;
  coins: number | null;
  streak: number | null;
  hand: HeldCard[];
  connected: boolean;
}

export interface AdminQuizSlotSummary {
  qid: string;
  prompt: string;
  correctIndex: number;
  correctText: string;
  choice: number | null;
  isCorrect: boolean | null;
}

export interface AdminGameSnapshot {
  phase: GamePhase;
  hostNow: number;
  clockSeconds: number;
  fen: string;
  turn: Color;
  lastMove: { from: string; to: string } | null;
  ply: number;
  phaseDeadlineAt: number | null;
  activeEffects: { uid: string; cardId: string; level: CardLevel; owner: PlayerId; target: PlayerId | null }[];
  pendingHarmful: { cardId: string; level: CardLevel; caster: PlayerId; target: PlayerId } | null;
  forceMove: { target: PlayerId; limitMs: number; deadlineAt: number } | null;
  drawOfferBy: PlayerId | null;
  p1: AdminPlayerSnapshot;
  p2: AdminPlayerSnapshot;
  quizInfo: {
    p1: AdminQuizSlotSummary | null;
    p2: AdminQuizSlotSummary | null;
  } | null;
  events: GameEvent[];
  gameOver: GameOverInfo | null;
  isFallbackP2View?: boolean;
}

export type AdminCommand =
  | { type: 'WATCH_PING'; untilMs: number }
  | { type: 'ADJUST_CLOCK'; target: PlayerId; deltaSec: number }
  | { type: 'FREEZE_CLOCK'; target: PlayerId; seconds: number }
  | { type: 'ADJUST_COINS'; target: PlayerId; delta: number }
  | { type: 'SET_STREAK'; target: PlayerId; streak: number }
  | { type: 'GIVE_CARD'; target: PlayerId; cardId: string; level: CardLevel }
  | { type: 'REMOVE_CARD'; target: PlayerId; uid: string }
  | { type: 'TRIGGER_FLASH'; target: PlayerId; count: number }
  | { type: 'TRIGGER_QUIZ_NOW' }
  | { type: 'SKIP_TO_PLAYING' }
  | { type: 'FORCE_MOVE'; target: PlayerId; seconds: number }
  | { type: 'MAKE_MOVE'; from: string; to: string; promo?: 'q' | 'r' | 'b' | 'n' }
  | { type: 'FORCE_GAME_OVER'; winner: Color | 'draw'; reason?: GameOverInfo['reason'] };

export interface RoomDoc {
  code: string;
  mode: 'private' | 'quick';
  isRanked: boolean;
  phase: GamePhase;
  clockSeconds: 180 | 300 | 600;
  hostUid: string;
  hostName: string;
  hostElo: number;
  guestUid: string | null;
  guestName: string | null;
  guestElo: number | null;
  spectatorUids: string[];
  status: 'WAITING' | 'ACTIVE' | 'CLOSED' | 'ABANDONED';
  winner: 'w' | 'b' | 'draw' | null;
  updatedAtMs: number;
  createdAtMs: number;
}

export interface PlayerDoc {
  uid: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestElo: number;
  gamesPlayed: number;
  ranked: boolean;
  lastMatchId: string;
  updatedAtMs: number;
}

export interface QueueDoc {
  uid: string;
  name: string;
  elo: number;
  clockSeconds: 180 | 300 | 600;
  status: 'WAITING' | 'MATCHED';
  roomCode: string;
  hostUid: string;
  peerUid: string;
  peerName: string;
  peerElo: number;
  updatedAtMs: number;
  createdAtMs: number;
}

export interface AdminLogDoc {
  id: string;
  action: string;
  detail: string;
  target: string;
  adminEmail: string;
  createdAtMs: number;
}
