import { Cliente } from '../types';
import { db, auth, subscribeToAuth, handleFirestoreError, OperationType } from '../lib/firebase';
import { sanitizeForFirestore } from './ordersStorage';
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

export function getStoredClientes(): Cliente[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return [];
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    const currentUid = auth?.currentUser?.uid;
    const filtered = parsed.filter(c => {
      // Itens locais ainda sem ownerUid devem ser exibidos
      if (!c.ownerUid) return true;
      // Se houver usuário autenticado, apenas clientes do usuário ativo
      if (currentUid) {
        return c.ownerUid === currentUid;
      }
      return c.ownerUid === 'anonymous';
    });

    return filtered;
  } catch (err) {
    console.error('Erro ao ler clientes do localStorage:', err);
    return [];
  }
}

function notifyClientesUpdated(clientes: Cliente[]) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('clientesUpdated', { detail: clientes }));
  }
}

// Map of cliente.id -> docSnap.id para compatibilidade com documentos legados
const clienteDocIdMap: Record<string, string> = {};

export function makeClienteDocId(uid: string, clienteId: string): string {
  return `${uid}_${clienteId}`;
}

export async function saveCliente(cliente: Cliente): Promise<void> {
  const currentUid = auth?.currentUser?.uid;
  const clienteComUid: Cliente = {
    ...cliente,
    criadoEm: cliente.criadoEm || new Date().toISOString(),
    ...(currentUid ? { ownerUid: cliente.ownerUid || currentUid } : {})
  };
  const current = getStoredClientes();
  const existingIndex = current.findIndex(c => c.id === clienteComUid.id);
  
  let updated: Cliente[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = clienteComUid;
  } else {
    updated = [clienteComUid, ...current];
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyClientesUpdated(updated);

  // Firestore sync if user is authenticated
  if (currentUid && db) {
    try {
      const targetDocId = clienteDocIdMap[clienteComUid.id] || makeClienteDocId(currentUid, clienteComUid.id);
      clienteDocIdMap[clienteComUid.id] = targetDocId;
      const clienteDocRef = doc(db, CLIENTES_COLLECTION, targetDocId);
      await setDoc(clienteDocRef, sanitizeForFirestore({
        ...clienteComUid,
        ownerUid: currentUid
      }), { merge: true });
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
      const ownerUid = auth.currentUser.uid;
      const targetDocId = clienteDocIdMap[id] || makeClienteDocId(ownerUid, id);
      clienteDocIdMap[id] = targetDocId;
      const clienteDocRef = doc(db, CLIENTES_COLLECTION, targetDocId);
      const { id: _, ...fieldsToUpdate } = updates;
      await updateDoc(clienteDocRef, sanitizeForFirestore(fieldsToUpdate));
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
      const ownerUid = auth.currentUser.uid;
      const targetDocId = clienteDocIdMap[id] || makeClienteDocId(ownerUid, id);
      delete clienteDocIdMap[id];
      const clienteDocRef = doc(db, CLIENTES_COLLECTION, targetDocId);
      await deleteDoc(clienteDocRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'clientes');
    }
  } else {
    delete clienteDocIdMap[id];
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
          // Preserva o campo id interno do documento quando existir, em vez de sobrescrever com docSnap.id
          const clienteId = data.id || docSnap.id;
          clienteDocIdMap[clienteId] = docSnap.id;
          remoteClientes.push({
            ...data,
            id: clienteId
          });
        });

        if (remoteClientes.length > 0) {
          const currentLocal = getStoredClientes();
          const unsyncedLocal = currentLocal.filter(c => !c.ownerUid || c.ownerUid === uid);
          const remoteIds = new Set(remoteClientes.map(c => c.id));
          const unsyncedOnly = unsyncedLocal.filter(c => !remoteIds.has(c.id));
          const merged = [...remoteClientes, ...unsyncedOnly];

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
