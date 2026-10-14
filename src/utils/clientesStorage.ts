import { Cliente } from '../types';
import { db, auth, subscribeToAuth, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  Unsubscribe 
} from 'firebase/firestore';

const STORAGE_KEY = 'print3dbr_clientes';
const CLIENTES_COLLECTION = 'clientes';

export const INITIAL_CLIENTES: Cliente[] = [
  {
    id: 'cli-001',
    nome: 'Ricardo Mendes da Silva',
    telefone: '(47) 99912-4455',
    email: 'ricardo.mendes@email.com',
    cidade: 'Joinville/SC',
    observacoes: 'Cliente recorrente. Exige peças com alta precisão e acabamento fino.',
    criadoEm: '2023-10-10T10:00:00.000Z'
  },
  {
    id: 'cli-002',
    nome: 'Engenharia 360',
    telefone: '(11) 98765-4321',
    email: 'contato@engenharia360.com.br',
    cidade: 'São Paulo/SP',
    observacoes: 'Projetos técnicos e prototipagem industrial rápida.',
    criadoEm: '2023-10-12T14:20:00.000Z'
  },
  {
    id: 'cli-003',
    nome: 'Carlos Almeida Design',
    telefone: '(21) 97123-8899',
    email: 'carlos@almeidadesign.art.br',
    cidade: 'Rio de Janeiro/RJ',
    observacoes: 'Foco em filamentos nobres (Silk, Madeira, Mármore) para decoração.',
    criadoEm: '2023-10-15T09:30:00.000Z'
  },
  {
    id: 'cli-004',
    nome: 'Mecânica Alfa',
    telefone: '(41) 99112-0033',
    email: 'compras@mecanicaalfa.ind.br',
    cidade: 'Curitiba/PR',
    observacoes: 'Peças funcionais mecânicas e lotes de engrenagens em Nylon/PETG.',
    criadoEm: '2023-10-18T16:00:00.000Z'
  },
  {
    id: 'cli-005',
    nome: 'Studio Creativo 3D',
    telefone: '(19) 98221-7744',
    email: 'studio@creativo3d.com',
    cidade: 'Campinas/SP',
    observacoes: 'Maquetes arquitetônicas e modelos para apresentação executiva.',
    criadoEm: '2023-10-20T11:45:00.000Z'
  },
  {
    id: 'cli-006',
    nome: 'Tech Labs Innovations',
    telefone: '(31) 99344-2211',
    email: 'lab@techinnovations.io',
    cidade: 'Belo Horizonte/MG',
    observacoes: 'Cases sob medida para circuitos eletrônicos e IoT.',
    criadoEm: '2023-10-22T08:15:00.000Z'
  }
];

export function getStoredClientes(): Cliente[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CLIENTES));
      return INITIAL_CLIENTES;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : INITIAL_CLIENTES;
  } catch (err) {
    console.error('Erro ao ler clientes do localStorage:', err);
    return INITIAL_CLIENTES;
  }
}

function notifyClientesUpdated(clientes: Cliente[]) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('clientesUpdated', { detail: clientes }));
  }
}

export async function saveCliente(cliente: Cliente): Promise<void> {
  const current = getStoredClientes();
  const existingIndex = current.findIndex(c => c.id === cliente.id);
  
  let updated: Cliente[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = cliente;
  } else {
    updated = [cliente, ...current];
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyClientesUpdated(updated);

  // Firestore sync if user is authenticated
  if (auth?.currentUser && db) {
    try {
      const ownerUid = auth.currentUser.uid;
      const clienteDocRef = doc(db, CLIENTES_COLLECTION, cliente.id);
      await setDoc(clienteDocRef, {
        ...cliente,
        ownerUid
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'clientes');
    }
  }
}

export async function updateCliente(id: string, updates: Partial<Cliente>): Promise<void> {
  const current = getStoredClientes();
  const index = current.findIndex(c => c.id === id);
  if (index === -1) return;

  const updatedItem = { ...current[index], ...updates };
  const updatedList = [...current];
  updatedList[index] = updatedItem;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  notifyClientesUpdated(updatedList);

  if (auth?.currentUser && db) {
    try {
      const clienteDocRef = doc(db, CLIENTES_COLLECTION, id);
      const { id: _, ...fieldsToUpdate } = updates;
      await updateDoc(clienteDocRef, fieldsToUpdate);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'clientes');
    }
  }
}

export async function deleteCliente(id: string): Promise<void> {
  const current = getStoredClientes();
  const filtered = current.filter(c => c.id !== id);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  notifyClientesUpdated(filtered);

  if (auth?.currentUser && db) {
    try {
      const clienteDocRef = doc(db, CLIENTES_COLLECTION, id);
      await deleteDoc(clienteDocRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'clientes');
    }
  }
}

let activeListener: Unsubscribe | null = null;

export function setupClientesListener(onUpdate?: (clientes: Cliente[]) => void): () => void {
  const unsubs: Array<() => void> = [];

  const attachFirestoreListener = (uid: string) => {
    if (activeListener) {
      activeListener();
      activeListener = null;
    }

    if (!db) return;

    try {
      const q = query(
        collection(db, CLIENTES_COLLECTION),
        where('ownerUid', '==', uid)
      );

      activeListener = onSnapshot(q, (snapshot) => {
        const remoteClientes: Cliente[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Cliente;
          remoteClientes.push({
            ...data,
            id: docSnap.id
          });
        });

        if (remoteClientes.length > 0) {
          const currentLocal = getStoredClientes();
          const mergedMap = new Map<string, Cliente>();

          // Merge preserving all items
          currentLocal.forEach(c => mergedMap.set(c.id, c));
          remoteClientes.forEach(c => mergedMap.set(c.id, c));

          const merged = Array.from(mergedMap.values());
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          notifyClientesUpdated(merged);
          if (onUpdate) onUpdate(merged);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'clientes');
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'clientes');
    }
  };

  const authUnsub = subscribeToAuth((user) => {
    if (user) {
      attachFirestoreListener(user.uid);
    } else {
      if (activeListener) {
        activeListener();
        activeListener = null;
      }
    }
  });
  unsubs.push(authUnsub);

  if (typeof window !== 'undefined') {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && onUpdate) {
            onUpdate(parsed);
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    unsubs.push(() => window.removeEventListener('storage', handleStorage));

    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent<Cliente[]>;
      if (customEvent.detail && onUpdate) {
        onUpdate(customEvent.detail);
      }
    };
    window.addEventListener('clientesUpdated', handleCustom);
    unsubs.push(() => window.removeEventListener('clientesUpdated', handleCustom));
  }

  return () => {
    unsubs.forEach(fn => fn());
    if (activeListener) {
      activeListener();
      activeListener = null;
    }
  };
}
