import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EditablePlayerInput, getRankTier } from '../data/rank';
import {
  createPlayerProfile,
  deletePlayerProfile,
  fetchAllPlayersPipeline,
  updatePlayerProfile,
} from '../services/adminApi';
import { PlayerDoc } from '../types/admin';

interface PlayersPanelProps {
  onToast: (msg: string, isErr?: boolean) => void;
}

export const PlayersPanel: React.FC<PlayersPanelProps> = ({ onToast }) => {
  const [players, setPlayers] = useState<PlayerDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState<'ALL' | 'RANKED' | 'UNRANKED'>('ALL');
  const [editing, setEditing] = useState<{ uid: string; isNew: boolean; form: EditablePlayerInput } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAllPlayersPipeline(200);
      setPlayers(list);
    } catch (err) {
      onToast(`Lỗi tải người chơi: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    void loadPlayers();
  }, [loadPlayers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (rankFilter === 'RANKED' && !p.ranked) return false;
      if (rankFilter === 'UNRANKED' && p.ranked) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.uid.toLowerCase().includes(q);
    });
  }, [players, search, rankFilter]);

  const quickAdjustElo = async (p: PlayerDoc, newElo: number) => {
    try {
      await updatePlayerProfile(p.uid, {
        name: p.name,
        elo: newElo,
        bestElo: Math.max(p.bestElo, newElo),
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
        streak: p.streak,
        ranked: p.ranked,
        lastMatchId: p.lastMatchId,
      });
      onToast(`Đã cập nhật ${p.name} → ${newElo} Elo`);
      await loadPlayers();
    } catch (err) {
      onToast(`Lỗi sửa Elo: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.uid.trim()) {
      onToast('UID không được để trống', true);
      return;
    }
    setSaving(true);
    try {
      if (editing.isNew) {
        await createPlayerProfile(editing.uid, editing.form);
        onToast(`Đã tạo hồ sơ ${editing.form.name}`);
      } else {
        await updatePlayerProfile(editing.uid, editing.form);
        onToast(`Đã lưu chỉnh sửa cho ${editing.form.name}`);
      }
      setEditing(null);
      await loadPlayers();
    } catch (err) {
      onToast(`Lỗi lưu hồ sơ: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      onToast('Không có người chơi nào để xuất', true);
      return;
    }
    const headers = [
      'STT',
      'Tên người chơi',
      'UID',
      'Elo',
      'Hạng',
      'Đỉnh Elo',
      'Thắng',
      'Hòa',
      'Thua',
      'Tổng trận',
      'Chuỗi thắng',
      'Trên BXH',
      'Mã trận cuối',
      'Cập nhật lần cuối',
    ];
    const rows = filtered.map((p, idx) => {
      const tier = getRankTier(p.elo);
      const updatedStr = p.updatedAtMs ? new Date(p.updatedAtMs).toLocaleString('vi-VN') : '';
      return [
        idx + 1,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.uid}"`,
        p.elo,
        `"${tier.label}"`,
        p.bestElo,
        p.wins,
        p.draws,
        p.losses,
        p.gamesPlayed,
        p.streak,
        p.ranked ? 'Có' : 'Không',
        `"${p.lastMatchId || ''}"`,
        `"${updatedStr}"`,
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const nowStr = new Date().toISOString().slice(0, 10);
    a.download = `chess_quiz_players_${nowStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onToast(`Đã xuất ${filtered.length} người chơi sang file CSV`);
  };

  return (
    <div className="col" style={{ gap: '0.75rem' }}>
      <div className="panel between">
        <div className="row">
          <h2 style={{ margin: 0, fontSize: '1.08rem' }}>👑 Quản trị Người chơi &amp; Elo ({filtered.length}/{players.length})</h2>
          <div className="row">
            {(['ALL', 'RANKED', 'UNRANKED'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`btn-sm ${rankFilter === f ? 'btn-primary' : ''}`}
                onClick={() => setRankFilter(f)}
              >
                {f === 'ALL' ? 'Tất cả' : f === 'RANKED' ? 'Trên BXH' : 'Chưa Ranked'}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <input
            className="input-field"
            style={{ inlineSize: 220 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên hoặc UID..."
          />
          <button
            type="button"
            className="btn-sm btn-primary"
            onClick={() =>
              setEditing({
                uid: `admin_test_${Date.now()}`,
                isNew: true,
                form: {
                  name: 'Người chơi mới',
                  elo: 1000,
                  bestElo: 1000,
                  wins: 0,
                  losses: 0,
                  draws: 0,
                  streak: 0,
                  ranked: true,
                  lastMatchId: 'ADMIN01',
                },
              })
            }
          >
            ➕ Tạo hồ sơ
          </button>
          <button
            type="button"
            className="btn-sm"
            onClick={handleExportCsv}
            title="Tải bảng danh sách người chơi dạng Excel/CSV"
          >
            📥 Xuất CSV
          </button>
          <button type="button" className="btn-sm" disabled={loading} onClick={() => void loadPlayers()}>
            {loading ? 'Đang tải…' : '🔄 Làm mới'}
          </button>
        </div>
      </div>

      <div className="panel table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Người chơi</th>
              <th>UID</th>
              <th>Hạng &amp; Elo</th>
              <th>Đỉnh</th>
              <th>T / H / B</th>
              <th>Chuỗi</th>
              <th>BXH</th>
              <th>Thao tác nhanh</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, idx) => {
              const tier = getRankTier(p.elo);
              return (
                <tr key={p.uid}>
                  <td>{idx + 1}</td>
                  <td><strong>{p.name}</strong></td>
                  <td className="mono muted" style={{ fontSize: '0.76rem' }}>{p.uid.slice(0, 14)}…</td>
                  <td>
                    <span style={{ color: tier.color, fontWeight: 700 }}>
                      {tier.icon} {p.elo}
                    </span>
                  </td>
                  <td className="muted">{p.bestElo}</td>
                  <td>{p.wins}/{p.draws}/{p.losses}</td>
                  <td>🔥 {p.streak}</td>
                  <td>{p.ranked ? '✅' : '—'}</td>
                  <td>
                    <div className="row" style={{ gap: '0.25rem' }}>
                      <button type="button" className="btn-xs btn-success" onClick={() => void quickAdjustElo(p, p.elo + 25)}>
                        +25
                      </button>
                      <button type="button" className="btn-xs btn-danger" onClick={() => void quickAdjustElo(p, p.elo - 25)}>
                        -25
                      </button>
                      <button
                        type="button"
                        className="btn-xs btn-primary"
                        onClick={() =>
                          setEditing({
                            uid: p.uid,
                            isNew: false,
                            form: {
                              name: p.name,
                              elo: p.elo,
                              bestElo: p.bestElo,
                              wins: p.wins,
                              losses: p.losses,
                              draws: p.draws,
                              streak: p.streak,
                              ranked: p.ranked,
                              lastMatchId: p.lastMatchId,
                            },
                          })
                        }
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        type="button"
                        className="btn-xs btn-danger"
                        onClick={async () => {
                          if (!confirm(`Xóa vĩnh viễn hồ sơ "${p.name}" (${p.uid})?`)) return;
                          try {
                            await deletePlayerProfile(p.uid, p.name);
                            onToast(`Đã xóa ${p.name}`);
                            await loadPlayers();
                          } catch (err) {
                            onToast(`Lỗi xóa: ${err instanceof Error ? err.message : String(err)}`, true);
                          }
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" style={{ textAlign: 'center', padding: '1.2rem' }}>
                  {loading ? 'Đang tải dữ liệu từ Firestore Enterprise Pipeline…' : 'Không có dữ liệu người chơi.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="panel col modal-card" onSubmit={handleSaveModal}>
            <div className="between">
              <h3 style={{ margin: 0 }}>
                {editing.isNew ? '➕ Tạo hồ sơ người chơi' : `✏️ Chỉnh sửa: ${editing.form.name}`}
              </h3>
              <button type="button" className="btn-sm" onClick={() => setEditing(null)}>
                Đóng
              </button>
            </div>

            {editing.isNew && (
              <label className="col" style={{ gap: '0.2rem', fontSize: '0.84rem' }}>
                <span>UID tài khoản:</span>
                <input
                  className="input-field"
                  value={editing.uid}
                  onChange={(e) => setEditing({ ...editing, uid: e.target.value })}
                  required
                />
              </label>
            )}

            <div className="form-grid-2">
              <label className="col" style={{ gap: '0.2rem', fontSize: '0.84rem' }}>
                <span>Tên hiển thị:</span>
                <input
                  className="input-field"
                  maxLength={24}
                  value={editing.form.name}
                  onChange={(e) =>
                    setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })
                  }
                  required
                />
              </label>
              <label className="col" style={{ gap: '0.2rem', fontSize: '0.84rem' }}>
                <span>Elo (600–3000):</span>
                <input
                  type="number"
                  min={600}
                  max={3000}
                  className="input-field"
                  value={editing.form.elo}
                  onChange={(e) =>
                    setEditing({ ...editing, form: { ...editing.form, elo: Number(e.target.value) } })
                  }
                />
              </label>
              <label className="col" style={{ gap: '0.2rem', fontSize: '0.84rem' }}>
                <span>Best Elo:</span>
                <input
                  type="number"
                  min={600}
                  max={3000}
                  className="input-field"
                  value={editing.form.bestElo}
                  onChange={(e) =>
                    setEditing({ ...editing, form: { ...editing.form, bestElo: Number(e.target.value) } })
                  }
                />
              </label>
              <label className="col" style={{ gap: '0.2rem', fontSize: '0.84rem' }}>
                <span>Chuỗi thắng (Streak):</span>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={editing.form.streak}
                  onChange={(e) =>
                    setEditing({ ...editing, form: { ...editing.form, streak: Number(e.target.value) } })
                  }
                />
              </label>
              <label className="col" style={{ gap: '0.2rem', fontSize: '0.84rem' }}>
                <span>Thắng (Wins):</span>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={editing.form.wins}
                  onChange={(e) =>
                    setEditing({ ...editing, form: { ...editing.form, wins: Number(e.target.value) } })
                  }
                />
              </label>
              <label className="col" style={{ gap: '0.2rem', fontSize: '0.84rem' }}>
                <span>Hòa (Draws):</span>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={editing.form.draws}
                  onChange={(e) =>
                    setEditing({ ...editing, form: { ...editing.form, draws: Number(e.target.value) } })
                  }
                />
              </label>
              <label className="col" style={{ gap: '0.2rem', fontSize: '0.84rem' }}>
                <span>Thua (Losses):</span>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={editing.form.losses}
                  onChange={(e) =>
                    setEditing({ ...editing, form: { ...editing.form, losses: Number(e.target.value) } })
                  }
                />
              </label>
              <label className="col" style={{ gap: '0.2rem', fontSize: '0.84rem' }}>
                <span>Mã trận gần nhất:</span>
                <input
                  className="input-field"
                  maxLength={16}
                  value={editing.form.lastMatchId ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, form: { ...editing.form, lastMatchId: e.target.value } })
                  }
                />
              </label>
            </div>

            <label className="row" style={{ cursor: 'pointer', fontSize: '0.86rem' }}>
              <input
                type="checkbox"
                checked={editing.form.ranked}
                onChange={(e) =>
                  setEditing({ ...editing, form: { ...editing.form, ranked: e.target.checked } })
                }
              />
              <span>Hiển thị trên Bảng xếp hạng Top 20 (`ranked = true`)</span>
            </label>

            <div className="between">
              <button
                type="button"
                className="btn-sm"
                onClick={() =>
                  setEditing({
                    ...editing,
                    form: { ...editing.form, elo: 1000, bestElo: 1000, wins: 0, losses: 0, draws: 0, streak: 0 },
                  })
                }
              >
                ↺ Reset 1000 Elo
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Đang lưu…' : '💾 Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
