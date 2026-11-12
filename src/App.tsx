import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  ADMIN_ALLOWED_EMAIL,
  consumeAdminRedirect,
  getAdminFirebase,
  isAuthorizedAdminUser,
  signInAdminWithGoogle,
  signOutAdmin,
} from './config/firebase';
import { subscribeAdminLogs, subscribeQueue, subscribeRooms } from './services/adminApi';
import { AdminLogDoc, QueueDoc, RoomDoc } from './types/admin';
import { LiveMatchPanel } from './components/LiveMatchPanel';
import { PlayersPanel } from './components/PlayersPanel';
import { QueueLogsPanel } from './components/QueueLogsPanel';

type Tab = 'rooms' | 'players' | 'queue';

export const App: React.FC = () => {
  const [authReady, setAuthReady] = useState(false);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [tab, setTab] = useState<Tab>('rooms');
  const [rooms, setRooms] = useState<RoomDoc[]>([]);
  const [queue, setQueue] = useState<QueueDoc[]>([]);
  const [logs, setLogs] = useState<AdminLogDoc[]>([]);
  const [toast, setToast] = useState<{ msg: string; isErr?: boolean } | null>(null);

  const showToast = useCallback((msg: string, isErr = false) => {
    setToast({ msg, isErr });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const { auth } = getAdminFirebase();
    void consumeAdminRedirect().catch((err) => {
      setAuthError(err instanceof Error ? err.message : String(err));
    });
    return onAuthStateChanged(auth, (user) => {
      if (user && !isAuthorizedAdminUser(user)) {
        setAuthError(`Tài khoản ${user.email ?? 'hiện tại'} không phải Admin được cấp phép.`);
        void signOutAdmin();
        setAdminUser(null);
      } else {
        setAdminUser(user);
      }
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!adminUser) {
      setRooms([]);
      setQueue([]);
      setLogs([]);
      return;
    }

    const u1 = subscribeRooms(setRooms, (err) => showToast(`Lỗi rooms: ${err.message}`, true));
    const u2 = subscribeQueue(setQueue, (err) => showToast(`Lỗi queue: ${err.message}`, true));
    const u3 = subscribeAdminLogs(setLogs, (err) => showToast(`Lỗi logs: ${err.message}`, true));
    return () => {
      u1();
      u2();
      u3();
    };
  }, [adminUser, showToast]);

  const handleLogin = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      const u = await signInAdminWithGoogle();
      if (u) setAdminUser(u);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setSigningIn(false);
    }
  };

  if (!authReady) {
    return (
      <main className="app-shell">
        <div className="panel" style={{ maxWidth: 440, margin: '4rem auto', textAlign: 'center' }}>
          Đang kiểm tra phiên đăng nhập Quản trị…
        </div>
      </main>
    );
  }

  if (!adminUser) {
    return (
      <main className="app-shell">
        <section className="panel col" style={{ maxWidth: 460, margin: '4rem auto', gap: '0.9rem' }}>
          <div className="col" style={{ gap: '0.25rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.35rem' }}>🛡️ Cổng Quản Trị — Cờ Vua × Trắc Nghiệm</h1>
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              Khu vực riêng tư. Chỉ tài khoản Google duy nhất được khóa trong{' '}
              <code>firestore.rules</code> mới có quyền đọc &amp; can thiệp dữ liệu.
            </p>
          </div>

          <div className="panel-sub muted" style={{ fontSize: '0.84rem' }}>
            Email được cấp phép: <strong>{ADMIN_ALLOWED_EMAIL}</strong>
          </div>

          {authError && (
            <div className="banner danger" role="alert">
              ⛔ {authError}
            </div>
          )}

          <button type="button" className="btn-primary" disabled={signingIn} onClick={() => void handleLogin()}>
            {signingIn ? 'Đang xác thực Google…' : '🔐 Đăng nhập bằng Google'}
          </button>
        </section>
      </main>
    );
  }

  const liveCount = rooms.filter((r) => r.status !== 'CLOSED' && r.phase !== 'GAME_OVER').length;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span>🛡️ Quản Trị — Cờ Vua × Trắc Nghiệm</span>
          <span className="badge ok-badge">{adminUser.email}</span>
        </div>

        <nav className="row">
          <button
            type="button"
            className={`btn-sm ${tab === 'rooms' ? 'btn-primary' : ''}`}
            onClick={() => setTab('rooms')}
          >
            🎥 Trận đấu ({liveCount} đang chạy / {rooms.length})
          </button>
          <button
            type="button"
            className={`btn-sm ${tab === 'players' ? 'btn-primary' : ''}`}
            onClick={() => setTab('players')}
          >
            👑 Người chơi &amp; Elo
          </button>
          <button
            type="button"
            className={`btn-sm ${tab === 'queue' ? 'btn-primary' : ''}`}
            onClick={() => setTab('queue')}
          >
            ⏳ Hàng chờ ({queue.length}) &amp; Nhật ký
          </button>
          <button type="button" className="btn-sm btn-danger" onClick={() => void signOutAdmin()}>
            Đăng xuất
          </button>
        </nav>
      </header>

      {toast && (
        <div className={`banner ${toast.isErr ? 'danger' : 'ok'}`} role="status">
          {toast.isErr ? '⚠️ ' : '✅ '}
          {toast.msg}
        </div>
      )}

      {tab === 'rooms' && <LiveMatchPanel rooms={rooms} onToast={showToast} />}
      {tab === 'players' && <PlayersPanel onToast={showToast} />}
      {tab === 'queue' && <QueueLogsPanel queue={queue} logs={logs} onToast={showToast} />}
    </main>
  );
};
