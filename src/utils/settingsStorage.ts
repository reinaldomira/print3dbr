import { db, auth, subscribeToAuth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';

export interface SystemSettings {
  ownerUid?: string;
  nomeEmpresa: string;
  subtituloEmpresa: string;
  logotipoUrl: string;
  whatsapp: string;
  instagram: string;
  email: string;
  chavePix: string;
  corPrincipal: string;
  mensagemRodape: string;
  observacoesPadrao: string;
  // Configurações Financeiras Padrão
  impostoPadrao: number;
  taxaPagamentoPadrao: number;
  comissaoMarketplacePadrao: number;
  embalagemPadrao: number;
  outrosCustosPadrao: number;
  margemLucroPadrao: number; // % sobre o custo (markup)
  arredondamentoComercialPadrao?: boolean;
}

const SETTINGS_KEY = 'print3dbr_settings';

export const DEFAULT_SETTINGS: SystemSettings = {
  nomeEmpresa: 'Print_3dbr',
  subtituloEmpresa: 'Laboratório de Impressão 3D',
  logotipoUrl: '',
  whatsapp: '47 988512351',
  instagram: '@print_3dbr',
  email: 'contato@print3dbr.com',
  chavePix: '47 988512351',
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

let activeSettingsUnsub: Unsubscribe | null = null;
let currentSettingsUid: string | null = null;

function setupSettingsListener(uid: string | null) {
  if (activeSettingsUnsub && currentSettingsUid === uid) {
    return;
  }

  if (activeSettingsUnsub) {
    activeSettingsUnsub();
    activeSettingsUnsub = null;
  }

  currentSettingsUid = uid;

  if (!uid) {
    return;
  }

  try {
    const userDocRef = doc(db, 'settings', uid);
    activeSettingsUnsub = onSnapshot(userDocRef, (snap) => {
      const local = getStoredSettings();
      if (!snap.exists()) {
        // Inicializa as configurações do usuário na nuvem preservando o estado local
        const initialData: SystemSettings = {
          ...local,
          ownerUid: uid
        };
        const sanitized = { ...initialData };
        if (sanitized.logotipoUrl && sanitized.logotipoUrl.length > 500000) {
          sanitized.logotipoUrl = '';
        }
        setDoc(userDocRef, sanitized).catch(err => {
          handleFirestoreError(err, OperationType.CREATE, `settings/${uid}`);
        });
        return;
      }

      const remoteData = snap.data() as SystemSettings;
      const merged: SystemSettings = { 
        ...DEFAULT_SETTINGS, 
        ...remoteData,
        ownerUid: uid,
        logotipoUrl: remoteData.logotipoUrl || local.logotipoUrl || ''
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: merged }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `settings/${uid}`);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `settings/${uid}`);
  }
}

// Observa mudanças de autenticação para chavear o documento de configurações
subscribeToAuth((user) => {
  if (user) {
    setupSettingsListener(user.uid);
  } else {
    setupSettingsListener(null);
  }
});

export function getStoredSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Erro ao ler configurações do localStorage:', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(newSettings: SystemSettings): SystemSettings {
  const currentUid = auth.currentUser?.uid;
  const merged: SystemSettings = { 
    ...DEFAULT_SETTINGS, 
    ...newSettings,
    ...(currentUid ? { ownerUid: currentUid } : {})
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: merged }));

  // Grava no documento do usuário autenticado no Firestore se disponível
  if (currentUid) {
    try {
      const firestoreSettings = { ...merged };
      if (firestoreSettings.logotipoUrl && firestoreSettings.logotipoUrl.length > 500000) {
        firestoreSettings.logotipoUrl = '';
      }

      const userDocRef = doc(db, 'settings', currentUid);
      setDoc(userDocRef, firestoreSettings).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `settings/${currentUid}`);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `settings/${currentUid}`);
    }
  }

  return merged;
}

export function getStoredFinancialDefaults() {
  const s = getStoredSettings();
  return {
    imposto: typeof s.impostoPadrao === 'number' ? s.impostoPadrao : 0,
    taxaPagamento: typeof s.taxaPagamentoPadrao === 'number' ? s.taxaPagamentoPadrao : 0,
    comissaoMarketplace: typeof s.comissaoMarketplacePadrao === 'number' ? s.comissaoMarketplacePadrao : 0,
    embalagem: typeof s.embalagemPadrao === 'number' ? s.embalagemPadrao : 0,
    outrosCustos: typeof s.outrosCustosPadrao === 'number' ? s.outrosCustosPadrao : 0,
    margemLucro: typeof s.margemLucroPadrao === 'number' ? s.margemLucroPadrao : 40,
    arredondamentoComercial: !!s.arredondamentoComercialPadrao
  };
}
