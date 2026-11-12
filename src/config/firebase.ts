import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

export const ADMIN_ALLOWED_EMAIL = 'banhtrang1x23@gmail.com';
export const FIREBASE_DATABASE_ID = 'chess';
export const FIREBASE_EDITION = 'enterprise' as const;

export const FIREBASE_CONFIG = {
  apiKey:
    (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) ||
    'AIzaSyCX3izsgMR6Xdz94UDR0H7FtVXj7CjBWcQ',
  authDomain:
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ||
    'chess-quiz-9x4k2m.firebaseapp.com',
  projectId:
    (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ||
    'chess-quiz-9x4k2m',
  storageBucket:
    (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ||
    'chess-quiz-9x4k2m.firebasestorage.app',
  messagingSenderId:
    (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ||
    '952788364294',
  appId:
    (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) ||
    '1:952788364294:web:9639177fd7780a61096787',
};

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

export function getAdminFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (cached) return cached;
  const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  void setPersistence(auth, browserLocalPersistence).catch(() => {});
  const db = getFirestore(app, FIREBASE_DATABASE_ID);
  cached = { app, auth, db };
  return cached;
}

export function isAuthorizedAdminUser(user: User | null): boolean {
  if (!user || !user.email || !user.emailVerified) return false;
  return user.email.toLowerCase() === ADMIN_ALLOWED_EMAIL;
}

export async function consumeAdminRedirect(): Promise<User | null> {
  const { auth } = getAdminFirebase();
  const cred = await getRedirectResult(auth);
  if (!cred) return null;
  if (!isAuthorizedAdminUser(cred.user)) {
    const email = cred.user.email ?? 'không rõ';
    await signOut(auth);
    throw new Error(`Tài khoản ${email} không có quyền quản trị.`);
  }
  return cred.user;
}

export async function signInAdminWithGoogle(): Promise<User | null> {
  const { auth } = getAdminFirebase();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
    login_hint: ADMIN_ALLOWED_EMAIL,
  });
  try {
    const cred = await signInWithPopup(auth, provider);
    if (!isAuthorizedAdminUser(cred.user)) {
      const email = cred.user.email ?? 'không rõ';
      await signOut(auth);
      throw new Error(`Tài khoản ${email} không có quyền quản trị.`);
    }
    return cred.user;
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function signOutAdmin(): Promise<void> {
  const { auth } = getAdminFirebase();
  await signOut(auth);
}
