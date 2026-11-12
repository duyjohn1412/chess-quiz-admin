import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import {
  descending,
  execute,
  field,
  Pipeline,
  PipelineSource,
} from 'firebase/firestore/pipelines';
import { ADMIN_ALLOWED_EMAIL, FIREBASE_EDITION, getAdminFirebase } from '../config/firebase';
import { buildCreatePlayerDocument, clampElo, EditablePlayerInput, sanitizePlayerEdit } from '../data/rank';
import {
  AdminCommand,
  AdminGameSnapshot,
  AdminLogDoc,
  GameOverInfo,
  PlayerDoc,
  QueueDoc,
  RoomDoc,
} from '../types/admin';

type FirestoreWithPipeline = ReturnType<typeof getAdminFirebase>['db'] & {
  pipeline(): PipelineSource<Pipeline>;
};

export function tsToMs(ts: unknown, fallback = 0): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: unknown }).toMillis === 'function') {
    return (ts as { toMillis(): number }).toMillis();
  }
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  return fallback;
}

function mapPlayerDoc(id: string, d: Record<string, unknown>): PlayerDoc {
  return {
    uid: String(d.uid ?? id),
    name: String(d.name ?? 'Người chơi'),
    elo: clampElo(Number(d.elo ?? 1000)),
    wins: Math.max(0, Math.floor(Number(d.wins ?? 0))),
    losses: Math.max(0, Math.floor(Number(d.losses ?? 0))),
    draws: Math.max(0, Math.floor(Number(d.draws ?? 0))),
    streak: Math.max(0, Math.floor(Number(d.streak ?? 0))),
    bestElo: clampElo(Number(d.bestElo ?? d.elo ?? 1000)),
    gamesPlayed: Math.max(0, Math.floor(Number(d.gamesPlayed ?? 0))),
    ranked: Boolean(d.ranked),
    lastMatchId: typeof d.lastMatchId === 'string' ? d.lastMatchId : '',
    updatedAtMs: tsToMs(d.updatedAt),
  };
}

export async function logAdminAction(
  action: string,
  target: string,
  detail: string
): Promise<void> {
  const { auth, db } = getAdminFirebase();
  try {
    await addDoc(collection(db, 'admin_logs'), {
      action,
      target,
      detail,
      adminEmail: auth.currentUser?.email ?? ADMIN_ALLOWED_EMAIL,
      createdAt: serverTimestamp(),
    });
  } catch {
    // non-fatal audit log failure
  }
}

export function subscribeRooms(
  onData: (rooms: RoomDoc[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const { db } = getAdminFirebase();
  const q = query(collection(db, 'rooms'), orderBy('updatedAt', 'desc'), limit(80));
  return onSnapshot(
    q,
    (snap) => {
      const list: RoomDoc[] = snap.docs.map((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        return {
          code: String(d.code ?? docSnap.id),
          mode: d.mode === 'quick' ? 'quick' : 'private',
          isRanked: Boolean(d.isRanked),
          phase: (d.phase as RoomDoc['phase']) ?? 'LOBBY',
          clockSeconds: (d.clockSeconds as 180 | 300 | 600) ?? 300,
          hostUid: String(d.hostUid ?? ''),
          hostName: String(d.hostName ?? 'Chủ phòng'),
          hostElo: Number(d.hostElo ?? 1000),
          guestUid: typeof d.guestUid === 'string' ? d.guestUid : null,
          guestName: typeof d.guestName === 'string' ? d.guestName : null,
          guestElo: typeof d.guestElo === 'number' ? d.guestElo : null,
          spectatorUids: Array.isArray(d.spectatorUids) ? (d.spectatorUids as string[]) : [],
          status: (d.status as RoomDoc['status']) ?? 'WAITING',
          winner: (d.winner as RoomDoc['winner']) ?? null,
          updatedAtMs: tsToMs(d.updatedAt),
          createdAtMs: tsToMs(d.createdAt),
        };
      });
      onData(list);
    },
    (err) => onError?.(err)
  );
}

export function subscribeRoomLive(
  code: string,
  onSnap: (snap: AdminGameSnapshot | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const { db } = getAdminFirebase();
  let hasAdminDoc = false;
  let latestAdmin: AdminGameSnapshot | null = null;
  let latestP2: AdminGameSnapshot | null = null;

  const emitBest = () => {
    if (latestAdmin) onSnap(latestAdmin);
    else if (latestP2) onSnap({ ...latestP2, isFallbackP2View: true });
    else onSnap(null);
  };

  const unsubAdmin = onSnapshot(
    doc(db, 'rooms', code, 'views', 'admin'),
    (dSnap) => {
      if (dSnap.exists()) {
        const raw = dSnap.data() as Record<string, unknown>;
        if (typeof raw.adminJson === 'string' && raw.adminJson) {
          try {
            latestAdmin = JSON.parse(raw.adminJson) as AdminGameSnapshot;
            hasAdminDoc = true;
            emitBest();
          } catch {
            // ignore parse error
          }
        }
      }
    },
    (err) => onError?.(err)
  );

  const unsubP2 = onSnapshot(
    doc(db, 'rooms', code, 'views', 'p2'),
    (dSnap) => {
      if (hasAdminDoc || !dSnap.exists()) return;
      const raw = dSnap.data() as Record<string, unknown>;
      if (typeof raw.stateJson === 'string' && raw.stateJson) {
        try {
          const st = JSON.parse(raw.stateJson) as Record<string, unknown>;
          const mapP = (p: Record<string, unknown>, id: 'p1' | 'p2') => ({
            id,
            name: String(p.name ?? id),
            elo: typeof p.elo === 'number' ? p.elo : undefined,
            color: (p.color as 'w' | 'b') ?? (id === 'p1' ? 'w' : 'b'),
            clockMs: Number(p.clockMs ?? 0),
            freezeRemainingMs: Number(p.freezeRemainingMs ?? 0),
            coins: typeof p.coins === 'number' ? p.coins : null,
            streak: typeof p.streak === 'number' ? p.streak : null,
            hand: Array.isArray(p.hand) ? (p.hand as AdminGameSnapshot['p1']['hand']) : [],
            connected: Boolean(p.connected),
          });
          latestP2 = {
            phase: st.phase as AdminGameSnapshot['phase'],
            hostNow: Number(st.hostNow ?? Date.now()),
            clockSeconds: Number(st.clockSeconds ?? 300),
            fen: String(st.fen ?? ''),
            turn: (st.turn as 'w' | 'b') ?? 'w',
            lastMove: (st.lastMove as { from: string; to: string } | null) ?? null,
            ply: Number(st.ply ?? 0),
            phaseDeadlineAt: typeof st.phaseDeadlineAt === 'number' ? st.phaseDeadlineAt : null,
            activeEffects: Array.isArray(st.activeEffects)
              ? (st.activeEffects as AdminGameSnapshot['activeEffects'])
              : [],
            pendingHarmful: (st.pendingHarmful as AdminGameSnapshot['pendingHarmful']) ?? null,
            forceMove: (st.forceMove as AdminGameSnapshot['forceMove']) ?? null,
            drawOfferBy: (st.drawOfferBy as 'p1' | 'p2' | null) ?? null,
            p1: mapP((st.p1 as Record<string, unknown>) ?? {}, 'p1'),
            p2: mapP((st.p2 as Record<string, unknown>) ?? {}, 'p2'),
            quizInfo: null,
            events: Array.isArray(st.events) ? (st.events as AdminGameSnapshot['events']) : [],
            gameOver: (st.gameOver as GameOverInfo | null) ?? null,
            isFallbackP2View: true,
          };
          emitBest();
        } catch {
          // ignore
        }
      }
    }
  );

  return () => {
    unsubAdmin();
    unsubP2();
  };
}

export async function sendMatchCommand(
  roomCode: string,
  cmd: AdminCommand,
  auditDetail?: string
): Promise<void> {
  const { db } = getAdminFirebase();
  const cleanCmd: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cmd)) {
    if (v !== undefined) cleanCmd[k] = v;
  }
  await addDoc(collection(db, 'rooms', roomCode, 'admin_commands'), {
    ...cleanCmd,
    sentAt: serverTimestamp(),
  });
  if (cmd.type !== 'WATCH_PING') {
    await logAdminAction(`MATCH_${cmd.type}`, roomCode, auditDetail ?? JSON.stringify(cleanCmd));
  }
}

export async function closeOrDeleteRoom(
  roomCode: string,
  action: 'close_w' | 'close_b' | 'close_draw' | 'delete'
): Promise<void> {
  const { db } = getAdminFirebase();
  const ref = doc(db, 'rooms', roomCode);
  if (action === 'delete') {
    await deleteDoc(ref);
    await logAdminAction('ROOM_DELETE', roomCode, 'Xóa document phòng trên Firestore');
    return;
  }
  const winner = action === 'close_w' ? 'w' : action === 'close_b' ? 'b' : 'draw';
  await updateDoc(ref, {
    phase: 'GAME_OVER',
    status: 'CLOSED',
    winner,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction('ROOM_FORCE_CLOSE', roomCode, `Đóng phòng trên DB (winner=${winner})`);
}

export async function fetchAllPlayersPipeline(maxRows = 200): Promise<PlayerDoc[]> {
  const { db } = getAdminFirebase();
  if (FIREBASE_EDITION === 'enterprise') {
    const pipeDb = db as FirestoreWithPipeline;
    if (typeof pipeDb.pipeline === 'function') {
      const p = pipeDb
        .pipeline()
        .collection('players')
        .sort(descending(field('elo')))
        .limit(maxRows);
      const snap = await execute(p);
      return snap.results
        .map((r) => {
          const data = r.data() as Record<string, unknown> | undefined;
          return data ? mapPlayerDoc(String(data.uid ?? r.id ?? ''), data) : null;
        })
        .filter((x): x is PlayerDoc => Boolean(x));
    }
  }
  const q = query(collection(db, 'players'), orderBy('elo', 'desc'), limit(maxRows));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPlayerDoc(d.id, d.data() as Record<string, unknown>));
}

export async function updatePlayerProfile(uid: string, input: EditablePlayerInput): Promise<void> {
  const { db } = getAdminFirebase();
  const payload = sanitizePlayerEdit(input);
  await updateDoc(doc(db, 'players', uid), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction(
    'PLAYER_UPDATE',
    uid,
    `${payload.name} | Elo=${payload.elo} | T/H/B=${payload.wins}/${payload.draws}/${payload.losses} | ranked=${payload.ranked}`
  );
}

export async function createPlayerProfile(uid: string, input: EditablePlayerInput): Promise<void> {
  const { db } = getAdminFirebase();
  const docData = buildCreatePlayerDocument(uid, input);
  await setDoc(doc(db, 'players', docData.uid), {
    ...docData,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction('PLAYER_CREATE', docData.uid, `${docData.name} | Elo=${docData.elo}`);
}

export async function deletePlayerProfile(uid: string, name: string): Promise<void> {
  const { db } = getAdminFirebase();
  await deleteDoc(doc(db, 'players', uid));
  await logAdminAction('PLAYER_DELETE', uid, `Xóa hồ sơ ${name}`);
}

export function subscribeQueue(
  onData: (items: QueueDoc[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const { db } = getAdminFirebase();
  const q = query(collection(db, 'queue'), orderBy('updatedAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((dSnap) => {
          const d = dSnap.data() as Record<string, unknown>;
          return {
            uid: String(d.uid ?? dSnap.id),
            name: String(d.name ?? 'Người chơi'),
            elo: Number(d.elo ?? 1000),
            clockSeconds: (d.clockSeconds as 180 | 300 | 600) ?? 300,
            status: d.status === 'MATCHED' ? 'MATCHED' : 'WAITING',
            roomCode: String(d.roomCode ?? ''),
            hostUid: String(d.hostUid ?? ''),
            peerUid: String(d.peerUid ?? ''),
            peerName: String(d.peerName ?? ''),
            peerElo: Number(d.peerElo ?? 0),
            updatedAtMs: tsToMs(d.updatedAt),
            createdAtMs: tsToMs(d.createdAt),
          };
        })
      );
    },
    (err) => onError?.(err)
  );
}

export async function deleteQueueTicket(uid: string): Promise<void> {
  const { db } = getAdminFirebase();
  await deleteDoc(doc(db, 'queue', uid));
  await logAdminAction('QUEUE_DELETE', uid, 'Xóa vé khỏi hàng chờ');
}

export async function cleanupStaleRooms(staleRooms: RoomDoc[]): Promise<number> {
  if (staleRooms.length === 0) return 0;
  const { db } = getAdminFirebase();
  await Promise.all(staleRooms.map((r) => deleteDoc(doc(db, 'rooms', r.code))));
  await logAdminAction(
    'ROOMS_CLEANUP_STALE',
    `${staleRooms.length} phòng`,
    `Dọn ${staleRooms.length} phòng treo cũ: ${staleRooms.map((r) => r.code).slice(0, 8).join(', ')}`
  );
  return staleRooms.length;
}

export async function cleanupStaleQueue(staleTickets: QueueDoc[]): Promise<number> {
  if (staleTickets.length === 0) return 0;
  const { db } = getAdminFirebase();
  await Promise.all(staleTickets.map((q) => deleteDoc(doc(db, 'queue', q.uid))));
  await logAdminAction(
    'QUEUE_CLEANUP_STALE',
    `${staleTickets.length} vé`,
    `Dọn ${staleTickets.length} vé hàng chờ quá hạn (>25s)`
  );
  return staleTickets.length;
}

export function subscribeAdminLogs(
  onData: (logs: AdminLogDoc[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const { db } = getAdminFirebase();
  const q = query(collection(db, 'admin_logs'), orderBy('createdAt', 'desc'), limit(60));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((dSnap) => {
          const d = dSnap.data() as Record<string, unknown>;
          return {
            id: dSnap.id,
            action: String(d.action ?? ''),
            detail: String(d.detail ?? ''),
            target: String(d.target ?? ''),
            adminEmail: String(d.adminEmail ?? ''),
            createdAtMs: tsToMs(d.createdAt),
          };
        })
      );
    },
    (err) => onError?.(err)
  );
}
