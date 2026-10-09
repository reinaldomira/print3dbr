import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  GoogleAuthProvider, 
  signInWithPopup, 
  linkWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

export interface GoogleAuthResult {
  user: User;
  linkedInPlace: boolean;
  prevAnonUid: string | null;
}

/**
 * Conecta a conta Google ao usuário.
 * 1. Se o usuário atual for anônimo, tenta vincular com linkWithPopup para manter o mesmo UID.
 * 2. Se a credencial já pertencer a outra conta existente, faz login na conta Google existente preservando o prevAnonUid.
 * 3. Trata cancelamentos e outros erros com clareza.
 */
export async function connectWithGoogle(): Promise<GoogleAuthResult> {
  const currentUser = auth.currentUser;
  const isAnonymous = currentUser?.isAnonymous === true;
  const prevAnonUid = isAnonymous ? (currentUser?.uid || null) : null;

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  if (currentUser && isAnonymous) {
    try {
      const linkResult = await linkWithPopup(currentUser, provider);
      return {
        user: linkResult.user,
        linkedInPlace: true,
        prevAnonUid
      };
    } catch (linkError: any) {
      // Credencial já vinculada a outra conta existente no Firebase
      if (linkError?.code === 'auth/credential-already-in-use') {
        const credential = GoogleAuthProvider.credentialFromError(linkError);
        let userCredential;
        if (credential) {
          userCredential = await signInWithCredential(auth, credential);
        } else {
          userCredential = await signInWithPopup(auth, provider);
        }
        return {
          user: userCredential.user,
          linkedInPlace: false,
          prevAnonUid
        };
      }

      // Usuário cancelou ou fechou a janela do popup
      if (
        linkError?.code === 'auth/popup-closed-by-user' ||
        linkError?.code === 'auth/cancelled-popup-request'
      ) {
        const cancelError = new Error('Login cancelado pelo usuário.');
        (cancelError as any).code = linkError.code;
        throw cancelError;
      }

      throw linkError;
    }
  }

  // Usuário já identificado ou não anônimo: login padrão
  try {
    const signinResult = await signInWithPopup(auth, provider);
    return {
      user: signinResult.user,
      linkedInPlace: false,
      prevAnonUid: null
    };
  } catch (signinError: any) {
    if (
      signinError?.code === 'auth/popup-closed-by-user' ||
      signinError?.code === 'auth/cancelled-popup-request'
    ) {
      const cancelError = new Error('Login cancelado pelo usuário.');
      (cancelError as any).code = signinError.code;
      throw cancelError;
    }
    throw signinError;
  }
}

export async function signInWithGoogle(): Promise<User> {
  const result = await connectWithGoogle();
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Fallback anônimo para manter o app funcional quando o usuário ainda não conectou com Google
onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth).catch((err) => {
      console.log('Firebase auth fallback initialization:', err?.message || err);
    });
  }
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}
