import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export interface SystemSettings {
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
  margemLucroPadrao: number;
  arredondamentoComercialPadrao?: boolean;
}

const SETTINGS_KEY = 'print3dbr_settings';
const SETTINGS_DOC_REF = doc(db, 'settings', 'global');

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

let isSettingsInitialized = false;

function initSettingsListener() {
  if (isSettingsInitialized) return;
  isSettingsInitialized = true;

  try {
    onSnapshot(SETTINGS_DOC_REF, (snap) => {
      if (!snap.exists()) {
        // Seed default settings to Firestore
        setDoc(SETTINGS_DOC_REF, DEFAULT_SETTINGS).catch(err => {
          console.error('Error seeding default settings to Firestore:', err);
        });
        return;
      }

      const data = snap.data() as SystemSettings;
      const local = getStoredSettings();
      // Preserve local logo if Firestore payload stripped it for size
      const merged = { 
        ...DEFAULT_SETTINGS, 
        ...data,
        logotipoUrl: data.logotipoUrl || local.logotipoUrl || ''
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: merged }));
    }, (error) => {
      console.error('Firestore settings listener error:', error);
    });
  } catch (err) {
    console.error('Error initializing settings listener:', err);
  }
}

initSettingsListener();

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
  const merged = { ...DEFAULT_SETTINGS, ...newSettings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: merged }));

  // Sanitize for Firestore write to guarantee avoiding 1MB limit
  const firestoreSettings = { ...merged };
  if (firestoreSettings.logotipoUrl && firestoreSettings.logotipoUrl.length > 500000) {
    console.warn('logotipoUrl too large for Firestore document limit (>500KB). Keeping locally.');
    firestoreSettings.logotipoUrl = '';
  }

  setDoc(SETTINGS_DOC_REF, firestoreSettings).catch(err => {
    console.error('Error saving settings to Firestore:', err);
  });

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
