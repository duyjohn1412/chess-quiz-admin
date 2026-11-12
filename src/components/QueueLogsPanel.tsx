import React from 'react';
import { deleteQueueTicket } from '../services/adminApi';
import { AdminLogDoc, QueueDoc } from '../types/admin';

interface QueueLogsPanelProps {
  queue: QueueDoc[];
  logs: AdminLogDoc[];
  onToast: (msg: string, isErr?: boolean) => void;
}

export const QueueLogsPanel: React.FC<QueueLogsPanelProps> = ({ queue, logs, onToast }) => {
  return (
    <div className="admin-two-col">
      <section className="panel col" style={{ gap: '0.6rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>⏳ Hàng chờ ghép trận ({queue.length})</h2>
        {queue.length === 0 ? (
          <div className="muted" style={{ padding: '1rem', textAlign: 'center', fontSize: '0.86rem' }}>
            Hiện không có người chơi nào trong hàng chờ.
          </div>
        ) : (
          <div className="col" style={{ gap: '0.45rem' }}>
            {queue.map((q) => (
              <div key={q.uid} className="between panel-sub">
                <div className="col" style={{ gap: '0.15rem', fontSize: '0.84rem' }}>
                  <strong>
                    {q.name} ({q.elo} Elo) • {q.clockSeconds / 60}p
                  </strong>
                  <span className="muted">
                    {q.status} {q.roomCode ? `→ ${q.roomCode}` : ''} • UID: {q.uid.slice(0, 12)}…
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
            ))}
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
