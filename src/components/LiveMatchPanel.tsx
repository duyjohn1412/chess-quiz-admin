import React, { useEffect, useMemo, useState } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { CARD_CATALOG, getCardMeta } from '../data/cards';
import { formatTimeAgoVi, isOldClosedRoom, isRoomLikelyStale } from '../data/time';
import {
  cleanupOldClosedRooms,
  cleanupStaleRooms,
  closeOrDeleteRoom,
  sendMatchCommand,
  subscribeRoomLive,
} from '../services/adminApi';
import {
  AdminCommand,
  AdminGameSnapshot,
  AdminPlayerSnapshot,
  CardLevel,
  PlayerId,
  RoomDoc,
} from '../types/admin';
import { KatexText } from './KatexText';

interface LiveMatchPanelProps {
  rooms: RoomDoc[];
  onToast: (msg: string, isErr?: boolean) => void;
}

const PHASE_VI: Record<string, string> = {
  LOBBY: 'Phòng chờ',
  PLAYING: 'Đang đánh cờ',
  PRE_QUIZ: 'Trước Quiz',
  QUIZ: 'Đang giải Quiz',
  RESULT: 'Kết quả Quiz',
  SHOP: 'Cửa hàng thẻ',
  GAME_OVER: 'Đã kết thúc',
};

function fmtMs(ms: number): string {
  const safe = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const LiveMatchPanel: React.FC<LiveMatchPanelProps> = ({ rooms, onToast }) => {
  const [filter, setFilter] = useState<'ALL' | 'LIVE' | 'CLOSED'>('LIVE');
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [liveSnap, setLiveSnap] = useState<AdminGameSnapshot | null>(null);
  const [syncAtMs, setSyncAtMs] = useState(Date.now());
  const [nowTick, setNowTick] = useState(Date.now());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [allowAdminMove, setAllowAdminMove] = useState(false);
  const [selectedSq, setSelectedSq] = useState<Square | null>(null);

  const [giftTarget, setGiftTarget] = useState<PlayerId>('p1');
  const [giftCardId, setGiftCardId] = useState<string>('time_plus');
  const [giftLevel, setGiftLevel] = useState<CardLevel>(4);
  const [customClockSec, setCustomClockSec] = useState<number>(30);
  const [busyCmd, setBusyCmd] = useState(false);
  const [boardWidth, setBoardWidth] = useState<number>(360);

  useEffect(() => {
    const updateWidth = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      const maxAllowed = Math.min(360, Math.max(260, w - 48));
      setBoardWidth(maxAllowed);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (filter === 'LIVE' && (r.status === 'CLOSED' || r.phase === 'GAME_OVER')) return false;
      if (filter === 'CLOSED' && r.status !== 'CLOSED' && r.phase !== 'GAME_OVER') return false;
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.hostName.toLowerCase().includes(q) ||
        (r.guestName ?? '').toLowerCase().includes(q)
      );
    });
  }, [rooms, filter, search]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.code === selectedCode) ?? null,
    [rooms, selectedCode]
  );

  const staleRooms = useMemo(
    () => rooms.filter((r) => isRoomLikelyStale(r, nowTick)),
    [rooms, nowTick]
  );

  const oldClosedRooms = useMemo(
    () => rooms.filter((r) => isOldClosedRoom(r, 7, nowTick)),
    [rooms, nowTick]
  );

  // Tự chọn trận LIVE đầu tiên nếu chưa chọn
  useEffect(() => {
    if (!selectedCode && filteredRooms.length > 0) {
      setSelectedCode(filteredRooms[0].code);
    }
  }, [filteredRooms, selectedCode]);

  // Theo dõi real-time trận đang chọn + gửi WATCH_PING mỗi 18s
  useEffect(() => {
    if (!selectedCode) {
      setLiveSnap(null);
      return;
    }
    setSelectedSq(null);
    const unsub = subscribeRoomLive(
      selectedCode,
      (snap) => {
        setLiveSnap(snap);
        setSyncAtMs(Date.now());
      },
      (err) => onToast(`Lỗi tải trận ${selectedCode}: ${err.message}`, true)
    );

    const ping = () => {
      void sendMatchCommand(selectedCode, {
        type: 'WATCH_PING',
        untilMs: Date.now() + 30_000,
      }).catch(() => {});
    };
    ping();
    const timer = window.setInterval(ping, 18_000);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [selectedCode, onToast]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const chess = useMemo(() => {
    if (!liveSnap?.fen) return null;
    try {
      return new Chess(liveSnap.fen);
    } catch {
      return null;
    }
  }, [liveSnap?.fen]);

  const runCmd = async (cmd: AdminCommand, label: string) => {
    if (!selectedCode || busyCmd) return;
    setBusyCmd(true);
    try {
      await sendMatchCommand(selectedCode, cmd, label);
      onToast(`Đã gửi lệnh: ${label}`);
    } catch (err) {
      onToast(`Lỗi gửi lệnh: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setBusyCmd(false);
    }
  };

  const handleSquareClick = (sq: Square) => {
    if (!allowAdminMove || !chess || !liveSnap || liveSnap.phase !== 'PLAYING') return;
    if (selectedSq && selectedSq !== sq) {
      const moves = chess.moves({ square: selectedSq, verbose: true });
      const mv = moves.find((m) => m.to === sq);
      if (mv) {
        setSelectedSq(null);
        void runCmd(
          {
            type: 'MAKE_MOVE',
            from: mv.from,
            to: mv.to,
            ...(mv.promotion ? { promo: 'q' as const } : {}),
          },
          `Đi cờ hộ: ${mv.from}->${mv.to}`
        );
        return;
      }
    }
    const piece = chess.get(sq);
    if (piece && piece.color === liveSnap.turn) {
      setSelectedSq(sq === selectedSq ? null : sq);
    } else {
      setSelectedSq(null);
    }
  };

  const renderPlayerControls = (p: AdminPlayerSnapshot, tag: string) => {
    const isTurn = liveSnap?.phase === 'PLAYING' && liveSnap.turn === p.color;
    const elapsed = isTurn && p.freezeRemainingMs <= 0 ? Math.min(4000, Math.max(0, nowTick - syncAtMs)) : 0;
    const estClock = Math.max(0, p.clockMs - elapsed);

    return (
      <div className="panel col" style={{ gap: '0.6rem', borderColor: isTurn ? '#6366f1' : undefined }}>
        <div className="between">
          <div className="row">
            <strong>
              {p.color === 'w' ? '⚪' : '⚫'} {p.name}
            </strong>
            <span className="badge">{tag}</span>
            {typeof p.elo === 'number' && <span className="badge">{p.elo} Elo</span>}
            {!p.connected && <span className="badge danger-badge">Offline</span>}
          </div>
          <div className="row">
            {p.freezeRemainingMs > 0 && <span className="badge">❄️ {(p.freezeRemainingMs / 1000).toFixed(1)}s</span>}
            <span className={`clock-pill ${estClock <= 15000 ? 'low' : ''}`}>{fmtMs(estClock)}</span>
          </div>
        </div>

        <div className="row muted" style={{ fontSize: '0.84rem' }}>
          <span>🪙 Xu: <strong>{p.coins ?? '—'}</strong></span>
          <span>🔥 Streak: <strong>{p.streak ?? '—'}</strong></span>
          <span>🃏 Thẻ: <strong>{p.hand.length}/3</strong></span>
        </div>

        <div className="col" style={{ gap: '0.35rem' }}>
          <span className="muted" style={{ fontSize: '0.78rem' }}>Tác động đồng hồ &amp; đóng băng:</span>
          <div className="row">
            <button type="button" className="btn-sm btn-danger" disabled={busyCmd} onClick={() => runCmd({ type: 'ADJUST_CLOCK', target: p.id, deltaSec: -30 }, `${p.name}: -30s`)}>
              -30s
            </button>
            <button type="button" className="btn-sm btn-danger" disabled={busyCmd} onClick={() => runCmd({ type: 'ADJUST_CLOCK', target: p.id, deltaSec: -10 }, `${p.name}: -10s`)}>
              -10s
            </button>
            <button type="button" className="btn-sm btn-success" disabled={busyCmd} onClick={() => runCmd({ type: 'ADJUST_CLOCK', target: p.id, deltaSec: 15 }, `${p.name}: +15s`)}>
              +15s
            </button>
            <button type="button" className="btn-sm btn-success" disabled={busyCmd} onClick={() => runCmd({ type: 'ADJUST_CLOCK', target: p.id, deltaSec: 60 }, `${p.name}: +60s`)}>
              +60s
            </button>
            <button type="button" className="btn-sm" disabled={busyCmd} onClick={() => runCmd({ type: 'FREEZE_CLOCK', target: p.id, seconds: 10 }, `${p.name}: Đóng băng 10s`)}>
              ❄️ +10s
            </button>
          </div>
        </div>

        <div className="col" style={{ gap: '0.35rem' }}>
          <span className="muted" style={{ fontSize: '0.78rem' }}>Xu, Streak &amp; Hiệu ứng tức thì:</span>
          <div className="row">
            <button type="button" className="btn-sm" disabled={busyCmd} onClick={() => runCmd({ type: 'ADJUST_COINS', target: p.id, delta: -20 }, `${p.name}: -20 xu`)}>
              -20 xu
            </button>
            <button type="button" className="btn-sm btn-primary" disabled={busyCmd} onClick={() => runCmd({ type: 'ADJUST_COINS', target: p.id, delta: 30 }, `${p.name}: +30 xu`)}>
              +30 xu
            </button>
            <button type="button" className="btn-sm btn-primary" disabled={busyCmd} onClick={() => runCmd({ type: 'ADJUST_COINS', target: p.id, delta: 100 }, `${p.name}: +100 xu`)}>
              +100 xu
            </button>
            <button type="button" className="btn-sm" disabled={busyCmd} onClick={() => runCmd({ type: 'SET_STREAK', target: p.id, streak: 5 }, `${p.name}: Streak = 5`)}>
              🔥 Streak 5
            </button>
            <button type="button" className="btn-sm btn-danger" disabled={busyCmd} onClick={() => runCmd({ type: 'TRIGGER_FLASH', target: p.id, count: 2 }, `${p.name}: Flash x2`)}>
              💥 Flash x2
            </button>
            <button type="button" className="btn-sm btn-danger" disabled={busyCmd} onClick={() => runCmd({ type: 'FORCE_MOVE', target: p.id, seconds: 10 }, `${p.name}: Ép đi 10s`)}>
              ⚡ Ép đi 10s
            </button>
          </div>
        </div>

        <div className="col" style={{ gap: '0.3rem' }}>
          <span className="muted" style={{ fontSize: '0.78rem' }}>Kho thẻ đang giữ:</span>
          {p.hand.length === 0 ? (
            <span className="muted" style={{ fontSize: '0.8rem' }}>Trống (hoặc đang đợi client đồng bộ admin view)</span>
          ) : (
            <div className="row">
              {p.hand.map((h) => {
                const meta = getCardMeta(h.cardId);
                return (
                  <span key={h.uid} className="badge" style={{ gap: '0.4rem' }}>
                    {meta.icon} {meta.name} ★{h.level}
                    <button
                      type="button"
                      className="btn-xs btn-danger"
                      disabled={busyCmd}
                      onClick={() =>
                        runCmd({ type: 'REMOVE_CARD', target: p.id, uid: h.uid }, `Xóa thẻ ${meta.name} của ${p.name}`)
                      }
                      title="Xóa thẻ này"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="admin-split">
      {/* Cột trái: Danh sách phòng */}
      <aside className="panel col" style={{ gap: '0.65rem' }}>
        <div className="between">
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>🎥 Danh sách phòng ({filteredRooms.length})</h2>
          <div className="row" style={{ gap: '0.25rem' }}>
            {staleRooms.length > 0 && (
              <button
                type="button"
                className="btn-xs btn-danger"
                onClick={async () => {
                  if (!confirm(`Xóa ${staleRooms.length} phòng treo cũ không còn hoạt động khỏi Firestore?`)) return;
                  try {
                    const n = await cleanupStaleRooms(staleRooms);
                    if (selectedCode && staleRooms.some((s) => s.code === selectedCode)) {
                      setSelectedCode(null);
                    }
                    onToast(`Đã dọn ${n} phòng treo cũ`);
                  } catch (e) {
                    onToast(`Lỗi dọn phòng: ${e instanceof Error ? e.message : String(e)}`, true);
                  }
                }}
              >
                🧹 Dọn {staleRooms.length} treo
              </button>
            )}
            {oldClosedRooms.length > 0 && (
              <button
                type="button"
                className="btn-xs"
                style={{ borderColor: '#f59e0b', color: '#fbbf24' }}
                onClick={async () => {
                  if (!confirm(`Xóa ${oldClosedRooms.length} phòng đã kết thúc > 7 ngày khỏi Firestore để dọn sạch bộ nhớ?`)) return;
                  try {
                    const n = await cleanupOldClosedRooms(oldClosedRooms, 7);
                    if (selectedCode && oldClosedRooms.some((s) => s.code === selectedCode)) {
                      setSelectedCode(null);
                    }
                    onToast(`Đã dọn ${n} phòng đóng > 7 ngày`);
                  } catch (e) {
                    onToast(`Lỗi dọn phòng cũ: ${e instanceof Error ? e.message : String(e)}`, true);
                  }
                }}
              >
                🧹 Dọn {oldClosedRooms.length} phòng &gt;7d
              </button>
            )}
          </div>
        </div>

        <div className="row">
          {(['LIVE', 'ALL', 'CLOSED'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn-sm ${filter === f ? 'btn-primary' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'LIVE' ? 'Đang diễn ra' : f === 'ALL' ? 'Tất cả' : 'Đã đóng'}
            </button>
          ))}
        </div>

        <input
          className="input-field"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm mã phòng hoặc tên..."
        />

        <div className="room-list col" style={{ gap: '0.45rem', maxHeight: '72dvh', overflowY: 'auto' }}>
          {filteredRooms.length === 0 ? (
            <div className="muted" style={{ padding: '1rem 0', textAlign: 'center', fontSize: '0.86rem' }}>
              Không có phòng nào khớp bộ lọc.
            </div>
          ) : (
            filteredRooms.map((r) => {
              const active = r.code === selectedCode;
              const stale = isRoomLikelyStale(r, nowTick);
              return (
                <div
                  key={r.code}
                  className={`room-card col ${active ? 'active' : ''}`}
                  onClick={() => setSelectedCode(r.code)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedCode(r.code);
                  }}
                >
                  <div className="between">
                    <strong>{r.code}</strong>
                    <div className="row" style={{ gap: '0.25rem' }}>
                      <span className="badge">{r.isRanked ? '🏆 Ranked' : '🔑 Riêng'}</span>
                      {stale ? (
                        <span className="badge danger-badge">💤 Treo cũ</span>
                      ) : (
                        <span className={`badge ${r.status === 'ACTIVE' ? 'ok-badge' : r.status === 'CLOSED' ? 'muted' : ''}`}>
                          {r.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.83rem' }}>
                    ⚪ {r.hostName} ({r.hostElo}) vs ⚫ {r.guestName ?? 'Đang chờ'} {r.guestElo ? `(${r.guestElo})` : ''}
                  </div>
                  <div className="between muted" style={{ fontSize: '0.76rem' }}>
                    <span>{PHASE_VI[r.phase] ?? r.phase} • {formatTimeAgoVi(r.updatedAtMs, nowTick)}</span>
                    <span>{r.clockSeconds / 60}p • 👁 {r.spectatorUids.length}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Cột phải: Xem trực tiếp + Tác động */}
      <section className="col" style={{ gap: '0.75rem' }}>
        {!selectedRoom ? (
          <div className="panel muted" style={{ textAlign: 'center', padding: '2rem' }}>
            Chọn một phòng ở danh sách bên trái để xem trực tiếp và tác động.
          </div>
        ) : (
          <>
            <div className="panel between">
              <div className="row">
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                  Phòng {selectedRoom.code} {selectedRoom.isRanked ? '🏆 Ranked' : '🔑 Phòng riêng'}
                </h2>
                <span className="badge">{PHASE_VI[liveSnap?.phase ?? selectedRoom.phase] ?? selectedRoom.phase}</span>
                {liveSnap && !liveSnap.isFallbackP2View && (
                  <span className="badge ok-badge">🟢 Host đang đồng bộ trực tiếp</span>
                )}
                {liveSnap?.isFallbackP2View && (
                  <span className="badge danger-badge" title="Host đã tắt tab hoặc đang dùng bản cũ nên không trả lời WATCH_PING">
                    Chế độ xem cơ bản (Host không phản hồi)
                  </span>
                )}
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn-sm"
                  onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
                >
                  🔄 Xoay bàn cờ
                </button>
                <button
                  type="button"
                  className="btn-sm btn-danger"
                  onClick={async () => {
                    if (!confirm(`Xóa hoàn toàn document phòng ${selectedRoom.code} khỏi Firestore?`)) return;
                    try {
                      await closeOrDeleteRoom(selectedRoom.code, 'delete');
                      setSelectedCode(null);
                      onToast(`Đã xóa phòng ${selectedRoom.code}`);
                    } catch (e) {
                      onToast(`Lỗi xóa phòng: ${e instanceof Error ? e.message : String(e)}`, true);
                    }
                  }}
                >
                  🗑️ Xóa phòng DB
                </button>
              </div>
            </div>

            <div className="match-inspector-grid">
              {/* Bàn cờ */}
              <div className="panel col" style={{ alignItems: 'center', gap: '0.65rem' }}>
                {liveSnap?.fen ? (
                  <>
                    <Chessboard
                      id="admin-live-board"
                      position={liveSnap.fen}
                      boardWidth={boardWidth}
                      boardOrientation={orientation}
                      arePiecesDraggable={false}
                      onSquareClick={handleSquareClick}
                      customDarkSquareStyle={{ backgroundColor: '#5c6b7a' }}
                      customLightSquareStyle={{ backgroundColor: '#cbd5e1' }}
                      customSquareStyles={
                        selectedSq
                          ? { [selectedSq]: { backgroundColor: 'rgba(99, 102, 241, 0.5)' } }
                          : undefined
                      }
                    />
                    <div className="between" style={{ width: '100%', fontSize: '0.84rem' }}>
                      <span>
                        Nước {Math.floor(liveSnap.ply / 2) + 1} • Lượt{' '}
                        <strong>{liveSnap.turn === 'w' ? '⚪ Trắng' : '⚫ Đen'}</strong>
                      </span>
                      <label className="row" style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={allowAdminMove}
                          onChange={(e) => {
                            setAllowAdminMove(e.target.checked);
                            setSelectedSq(null);
                          }}
                        />
                        <span>Click bàn cờ để đi hộ</span>
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="muted" style={{ padding: '2rem', textAlign: 'center' }}>
                    Đang chờ Host đồng bộ bàn cờ...
                  </div>
                )}

                {/* Điều khiển Phase & Kết quả trận */}
                <div className="col" style={{ width: '100%', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
                  <strong style={{ fontSize: '0.84rem' }}>Can thiệp diễn biến &amp; kết quả:</strong>
                  <div className="row">
                    <button type="button" className="btn-sm btn-primary" disabled={busyCmd} onClick={() => runCmd({ type: 'TRIGGER_QUIZ_NOW' }, 'Mở Quiz ngay')}>
                      🧠 Mở Quiz ngay
                    </button>
                    <button type="button" className="btn-sm" disabled={busyCmd} onClick={() => runCmd({ type: 'SKIP_TO_PLAYING' }, 'Nhảy về Đánh cờ')}>
                      ▶️ Về Đánh cờ
                    </button>
                  </div>
                  <div className="row">
                    <button
                      type="button"
                      className="btn-sm btn-success"
                      disabled={busyCmd}
                      onClick={() => runCmd({ type: 'FORCE_GAME_OVER', winner: 'w', reason: 'resign' }, 'Ép Trắng thắng')}
                    >
                      🏆 Trắng thắng
                    </button>
                    <button
                      type="button"
                      className="btn-sm btn-success"
                      disabled={busyCmd}
                      onClick={() => runCmd({ type: 'FORCE_GAME_OVER', winner: 'b', reason: 'resign' }, 'Ép Đen thắng')}
                    >
                      🏆 Đen thắng
                    </button>
                    <button
                      type="button"
                      className="btn-sm"
                      disabled={busyCmd}
                      onClick={() => runCmd({ type: 'FORCE_GAME_OVER', winner: 'draw', reason: 'draw_agreement' }, 'Ép Hòa')}
                    >
                      🤝 Cho Hòa
                    </button>
                    <button
                      type="button"
                      className="btn-sm btn-danger"
                      onClick={() =>
                        void closeOrDeleteRoom(selectedRoom.code, 'close_draw')
                          .then(() => onToast('Đã đóng phòng trên DB'))
                          .catch((err) => onToast(`Lỗi đóng phòng: ${err instanceof Error ? err.message : String(err)}`, true))
                      }
                    >
                      🔒 Đóng DB
                    </button>
                  </div>
                </div>
              </div>

              {/* Controls 2 người chơi + Tặng thẻ + Quiz */}
              <div className="col" style={{ gap: '0.75rem' }}>
                {liveSnap ? (
                  <>
                    {renderPlayerControls(liveSnap.p1, 'Host (P1)')}
                    {renderPlayerControls(liveSnap.p2, 'Khách (P2)')}
                  </>
                ) : (
                  <div className="panel muted">Chưa nhận được snapshot chi tiết từ Host.</div>
                )}

                {/* Tặng thẻ tùy chọn & chỉnh giờ tùy chọn */}
                <div className="panel col" style={{ gap: '0.55rem' }}>
                  <strong style={{ fontSize: '0.88rem' }}>🎁 Tặng thẻ bất kỳ &amp; Chỉnh giờ tùy ý</strong>
                  <div className="row">
                    <select className="input-field" value={giftTarget} onChange={(e) => setGiftTarget(e.target.value as PlayerId)}>
                      <option value="p1">Cho P1 ({liveSnap?.p1.name ?? selectedRoom.hostName})</option>
                      <option value="p2">Cho P2 ({liveSnap?.p2.name ?? selectedRoom.guestName ?? 'Khách'})</option>
                    </select>
                    <select className="input-field" value={giftCardId} onChange={(e) => setGiftCardId(e.target.value)}>
                      {CARD_CATALOG.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input-field"
                      value={giftLevel}
                      onChange={(e) => setGiftLevel(Number(e.target.value) as CardLevel)}
                    >
                      <option value={1}>★1</option>
                      <option value={2}>★2</option>
                      <option value={3}>★3</option>
                      <option value={4}>★4</option>
                    </select>
                    <button
                      type="button"
                      className="btn-sm btn-primary"
                      disabled={busyCmd}
                      onClick={() => {
                        const meta = getCardMeta(giftCardId);
                        void runCmd(
                          { type: 'GIVE_CARD', target: giftTarget, cardId: giftCardId, level: giftLevel },
                          `Tặng ${meta.name} ★${giftLevel} cho ${giftTarget}`
                        );
                      }}
                    >
                      Tặng thẻ
                    </button>
                  </div>

                  <div className="row">
                    <input
                      type="number"
                      className="input-field"
                      style={{ inlineSize: 90 }}
                      value={customClockSec}
                      onChange={(e) => setCustomClockSec(Number(e.target.value))}
                    />
                    <span className="muted" style={{ fontSize: '0.82rem' }}>giây</span>
                    <button
                      type="button"
                      className="btn-sm btn-success"
                      disabled={busyCmd}
                      onClick={() =>
                        runCmd(
                          { type: 'ADJUST_CLOCK', target: giftTarget, deltaSec: Math.abs(customClockSec) },
                          `${giftTarget}: +${Math.abs(customClockSec)}s`
                        )
                      }
                    >
                      + Cộng giờ
                    </button>
                    <button
                      type="button"
                      className="btn-sm btn-danger"
                      disabled={busyCmd}
                      onClick={() =>
                        runCmd(
                          { type: 'ADJUST_CLOCK', target: giftTarget, deltaSec: -Math.abs(customClockSec) },
                          `${giftTarget}: -${Math.abs(customClockSec)}s`
                        )
                      }
                    >
                      − Trừ giờ
                    </button>
                  </div>
                </div>

                {/* Live Quiz Info */}
                {liveSnap?.quizInfo && (
                  <div className="panel col" style={{ gap: '0.45rem', borderColor: '#f5a524' }}>
                    <strong style={{ fontSize: '0.9rem' }}>🧠 Câu hỏi Quiz đang mở</strong>
                    {(['p1', 'p2'] as const).map((pid) => {
                      const slot = liveSnap.quizInfo?.[pid];
                      if (!slot) return null;
                      return (
                        <div key={pid} className="col" style={{ fontSize: '0.84rem', background: 'var(--panel-2)', padding: '0.55rem', borderRadius: 8 }}>
                          <div className="between">
                            <strong>{pid === 'p1' ? liveSnap.p1.name : liveSnap.p2.name}</strong>
                            <span>
                              {slot.isCorrect === true
                                ? '✅ Trả lời ĐÚNG'
                                : slot.isCorrect === false
                                  ? '❌ Sai / Hết giờ'
                                  : '⏳ Chưa trả lời'}
                            </span>
                          </div>
                          <div><KatexText text={slot.prompt} /></div>
                          <div className="muted">
                            Đáp án đúng: <strong>{['A', 'B', 'C', 'D'][slot.correctIndex]}</strong> — <KatexText text={slot.correctText} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Match Events */}
                {liveSnap && liveSnap.events.length > 0 && (
                  <div className="panel col" style={{ gap: '0.3rem' }}>
                    <strong style={{ fontSize: '0.86rem' }}>📜 Nhật ký trận đấu gần đây</strong>
                    <div style={{ maxHeight: 140, overflowY: 'auto', fontSize: '0.8rem' }} className="col muted">
                      {[...liveSnap.events].reverse().map((ev) => (
                        <div key={ev.id}>• {ev.message}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
