import React, { useEffect, useState } from 'react';
import { formatTimeAgoVi, isQueueTicketAlive } from '../data/time';
import { cleanupStaleQueue, deleteQueueTicket } from '../services/adminApi';
import { AdminLogDoc, QueueDoc } from '../types/admin';

interface QueueLogsPanelProps {
  queue: QueueDoc[];
  logs: AdminLogDoc[];
  onToast: (msg: string, isErr?: boolean) => void;
}

export const QueueLogsPanel: React.FC<QueueLogsPanelProps> = ({ queue, logs, onToast }) => {
  const [nowMs, setNowMs] = useState(Date.now());
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 2000);
    return () => clearInterval(t);
  }, []);

  const aliveTickets = queue.filter((q) => isQueueTicketAlive(q.updatedAtMs, nowMs));
  const staleTickets = queue.filter((q) => !isQueueTicketAlive(q.updatedAtMs, nowMs));

  return (
    <div className="admin-two-col">
      <section className="panel col" style={{ gap: '0.6rem' }}>
        <div className="between">
          <div className="col" style={{ gap: '0.15rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>⏳ Hàng chờ ghép trận ({queue.length})</h2>
            <span className="muted" style={{ fontSize: '0.78rem' }}>
              🟢 {aliveTickets.length} đang tìm thật (≤25s) • 💤 {staleTickets.length} vé treo quá hạn
            </span>
          </div>
          {staleTickets.length > 0 && (
            <button
              type="button"
              className="btn-sm btn-danger"
              disabled={cleaning}
              onClick={async () => {
                setCleaning(true);
                try {
                  const n = await cleanupStaleQueue(staleTickets);
                  onToast(`Đã dọn ${n} vé treo quá hạn`);
                } catch (err) {
                  onToast(`Lỗi dọn vé: ${err instanceof Error ? err.message : String(err)}`, true);
                } finally {
                  setCleaning(false);
                }
              }}
            >
              🧹 Dọn {staleTickets.length} vé treo
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="muted" style={{ padding: '1rem', textAlign: 'center', fontSize: '0.86rem' }}>
            Hiện không có người chơi nào trong hàng chờ.
          </div>
        ) : (
          <div className="col" style={{ gap: '0.45rem' }}>
            {queue.map((q) => {
              const alive = isQueueTicketAlive(q.updatedAtMs, nowMs);
              const ageText = formatTimeAgoVi(q.updatedAtMs, nowMs);
              return (
                <div key={q.uid} className="between panel-sub">
                  <div className="col" style={{ gap: '0.2rem', fontSize: '0.84rem' }}>
                    <div className="row">
                      <strong>
                        {q.name} ({q.elo} Elo) • {q.clockSeconds / 60}p
                      </strong>
                      <span className={`badge ${alive ? 'ok-badge' : 'danger-badge'}`}>
                        {alive ? '🟢 Đang tìm' : '💤 Vé treo'}
                      </span>
                    </div>
                    <span className="muted" style={{ fontSize: '0.78rem' }}>
                      {q.status} {q.roomCode ? `→ ${q.roomCode}` : ''} • Cập nhật {ageText} • UID: {q.uid.slice(0, 12)}…
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-sm btn-danger"
                    onClick={async () => {
                      try {
                        await deleteQueueTicket(q.uid);
                        onToast(`Đã xóa vé chờ của ${q.name}`);
                      } catch (err) {
                        onToast(`Lỗi xóa vé: ${err instanceof Error ? err.message : String(err)}`, true);
                      }
                    }}
                  >
                    Xóa vé
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel col" style={{ gap: '0.6rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>📜 Nhật ký thao tác Quản trị ({logs.length})</h2>
        {logs.length === 0 ? (
          <div className="muted" style={{ padding: '1rem', textAlign: 'center', fontSize: '0.86rem' }}>
            Chưa có lịch sử can thiệp nào.
          </div>
        ) : (
          <div className="col" style={{ gap: '0.4rem', maxHeight: '65dvh', overflowY: 'auto' }}>
            {logs.map((l) => (
              <div key={l.id} className="panel-sub col" style={{ gap: '0.15rem', fontSize: '0.82rem' }}>
                <div className="between">
                  <strong>{l.action}</strong>
                  <span className="muted">
                    {l.createdAtMs ? new Date(l.createdAtMs).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>
                <div>
                  <span className="badge" style={{ marginRight: 6 }}>{l.target}</span>
                  <span className="muted">{l.detail}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
