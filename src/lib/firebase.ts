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

let isGlobalMigrationInProgress = false;

export function setGlobalMigrationInProgress(inProgress: boolean): void {
  isGlobalMigrationInProgress = inProgress;
}

export function getGlobalMigrationInProgress(): boolean {
  return isGlobalMigrationInProgress;
}

const DEFAULT_SYSTEM_SETTINGS = {
  nomeEmpresa: 'Print_3dbr',
  subtituloEmpresa: 'Laboratório de Impressão 3D',
  logotipoUrl: '',
  whatsapp: '',
  instagram: '@print_3dbr',
  email: '',
  chavePix: '',
  corPrincipal: '#0066ff',
  mensagemRodape: 'Obrigado pela preferência! Este documento é um recibo de prestação de serviços de impressão 3D.',
  observacoesPadrao: 'Peças produzidas com precisão de 0.12mm. Recomendado evitar exposição solar direta prolongada.',
  impostoPadrao: 0,
  taxaPagamentoPadrao: 0,
  comissaoMarketplacePadrao: 0,
  embalagemPadrao: 0,
  outrosCustosPadrao: 0,
  margemLucroPadrao: 40,
  arredondamentoComercialPadrao: false
};

const STORAGE_KEYS_TO_CLEAR = [
  'print3dbr_pedidos',
  'print3dbr_clientes',
  'print3dbr_settings',
  'print3dbr_has_seeded'
];

/**
 * Limpa o cache local e notifica a interface com dados vazios/padrões,
 * impedindo vazamento de informações entre usuários no mesmo navegador.
 */
export function clearLocalUserData(): void {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return;
  const storage = typeof localStorage !== 'undefined' ? localStorage : (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storage) return;

  try {
    STORAGE_KEYS_TO_CLEAR.forEach(key => {
      storage.removeItem(key);
    });

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: [] }));
      window.dispatchEvent(new CustomEvent('clientesUpdated', { detail: [] }));
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: DEFAULT_SYSTEM_SETTINGS }));
    }
  } catch (err) {
    console.error('[Print3DBR] Erro ao limpar cache local:', err);
  }
}

export async function logoutUser(): Promise<void> {
  clearLocalUserData();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('print3dbr_last_uid');
  }
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

const LAST_UID_KEY = 'print3dbr_last_uid';

// Observador central para gerenciar transição de contas e fallback anônimo
onAuthStateChanged(auth, (user) => {
  if (typeof window !== 'undefined') {
    const lastUid = localStorage.getItem(LAST_UID_KEY);
    const currentUid = user?.uid || null;

    if (currentUid) {
      // Se o usuário autenticado mudou para um uid diferente do anterior,
      // limpa o cache local antes de carregar os dados do novo usuário.
      // Exceção: migração de anônimo para Google já existente em andamento.
      if (lastUid && lastUid !== currentUid && !getGlobalMigrationInProgress()) {
        console.log(`[Print3DBR] Transição de usuário detectada (${lastUid} -> ${currentUid}). Limpando cache local.`);
        clearLocalUserData();
      }
      localStorage.setItem(LAST_UID_KEY, currentUid);
    }
  }

  // Fallback anônimo para manter o app funcional quando o usuário ainda não conectou com Google
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
