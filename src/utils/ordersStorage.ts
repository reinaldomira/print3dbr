import { Pedido, PedidoStatus } from '../types';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  writeBatch,
  query,
  where,
  getDocs
} from 'firebase/firestore';

const STORAGE_KEY = 'print3dbr_pedidos';
const SEEDED_KEY = 'print3dbr_has_seeded';
const PEDIDOS_COLLECTION = 'pedidos';

// Map of order.id -> docSnap.id
const docIdMap: Record<string, string> = {};

export const INITIAL_ORDERS: Pedido[] = [
  { 
    id: '#000042', 
    cliente: 'Ricardo Mendes da Silva', 
    telefone: '(47) 99912-4455',
    data: '22 de Outubro, 2023 - 14:30', 
    total: 302.50,
    metodoPagamento: 'pix',
    status: 'aprovado',
    observacoes: 'Peças produzidas com precisão de 0.12mm. Recomendado evitar exposição solar direta prolongada para o item em PETG.',
    itens: [
      { id: '1', descricao: 'Suporte Articulado para Câmera', qtd: 2, valorUnitario: 45.00 },
      { id: '2', descricao: 'Engrenagem V2 - Projeto Mecânico', qtd: 1, valorUnitario: 120.00 },
      { id: '3', descricao: 'Capa Protetora Sensor Industrial', qtd: 5, valorUnitario: 18.50 }
    ]
  },
  { 
    id: '#10041', 
    cliente: 'Engenharia 360', 
    telefone: '(11) 98765-4321',
    data: '23 de Outubro, 2023 - 10:15', 
    total: 450.50,
    metodoPagamento: 'cartao',
    status: 'aprovado',
    observacoes: 'Entrega via Sedex.',
    itens: [
      { id: '1', descricao: 'Protótipo Caixa Eletrônica', qtd: 1, valorUnitario: 450.50 }
    ]
  },
  { 
    id: '#10040', 
    cliente: 'Carlos Almeida Design', 
    telefone: '(21) 97123-8899',
    data: '21 de Outubro, 2023 - 16:45', 
    total: 89.90,
    metodoPagamento: 'pix',
    status: 'aprovado',
    observacoes: 'Filamento Silk Gold',
    itens: [
      { id: '1', descricao: 'Vaso Decorativo Espiral', qtd: 1, valorUnitario: 89.90 }
    ]
  },
  { 
    id: '#10039', 
    cliente: 'Mecânica Alfa', 
    telefone: '(41) 99112-0033',
    data: '19 de Outubro, 2023 - 11:20', 
    total: 3150.00,
    metodoPagamento: 'pix',
    status: 'aprovado',
    observacoes: 'Lote de 50 buchas de Nylon CF.',
    itens: [
      { id: '1', descricao: 'Bucha Industrial Nylon CF', qtd: 50, valorUnitario: 63.00 }
    ]
  },
  { 
    id: '#10038', 
    cliente: 'Studio Creativo 3D', 
    telefone: '(19) 98221-7744',
    data: '15 de Outubro, 2023 - 09:10', 
    total: 620.00,
    metodoPagamento: 'dinheiro',
    status: 'aprovado',
    observacoes: 'Impressão em ABS Vermelho com acabamento acetona.',
    itens: [
      { id: '1', descricao: 'Maquete Arquitetônica Bloco A', qtd: 2, valorUnitario: 310.00 }
    ]
  },
  { 
    id: '#10037', 
    cliente: 'Tech Labs Innovations', 
    telefone: '(31) 99344-2211',
    data: '12 de Outubro, 2023 - 18:00', 
    total: 185.00,
    metodoPagamento: 'pix',
    status: 'aprovado',
    observacoes: 'Suportes para placas de desenvolvimento IoT.',
    itens: [
      { id: '1', descricao: 'Case ESP32 Din Rail', qtd: 5, valorUnitario: 37.00 }
    ]
  }
];

// Helper to convert order ID to valid Firestore document ID
function getDocId(orderId: string): string {
  return orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Recursively removes undefined fields and cleans objects/arrays for Firestore.
 * Firestore throws an immediate synchronous error if any property value is undefined.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

let isInitialized = false;

// Subscribe to Firestore changes in real-time
function initFirestoreListener() {
  if (isInitialized) return;
  isInitialized = true;

  try {
    const colRef = collection(db, PEDIDOS_COLLECTION);
    onSnapshot(colRef, (snapshot) => {
      const hasSeeded = localStorage.getItem(SEEDED_KEY) === 'true';

      if (snapshot.empty) {
        if (!hasSeeded) {
          localStorage.setItem(SEEDED_KEY, 'true');
          seedInitialOrders();
          return;
        } else {
          // Intentionally empty state
          localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
          window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: [] }));
          return;
        }
      }

      // Mark as seeded since collection is not empty
      localStorage.setItem(SEEDED_KEY, 'true');

      const pedidosFromDb: Pedido[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Pedido;
        const orderId = data.id || docSnap.id;
        docIdMap[orderId] = docSnap.id;

        pedidosFromDb.push({
          ...data,
          id: orderId,
          status: data.status || 'aprovado'
        });
      });

      // Update localStorage cache and emit update event
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidosFromDb));
      window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: pedidosFromDb }));
    }, (error) => {
      console.error('Firestore listener error:', error);
    });
  } catch (err) {
    console.error('Error starting Firestore listener:', err);
  }
}

async function seedInitialOrders() {
  try {
    const batch = writeBatch(db);
    INITIAL_ORDERS.forEach(order => {
      const targetId = getDocId(order.id);
      docIdMap[order.id] = targetId;
      const docRef = doc(db, PEDIDOS_COLLECTION, targetId);
      batch.set(docRef, order);
    });
    await batch.commit();
  } catch (err) {
    console.error('Error seeding initial orders to Firestore:', err);
  }
}

// Start listener immediately
initFirestoreListener();

export function getStoredPedidos(): Pedido[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const hasSeeded = localStorage.getItem(SEEDED_KEY) === 'true';
      if (!hasSeeded) {
        localStorage.setItem(SEEDED_KEY, 'true');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ORDERS));
        return INITIAL_ORDERS;
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        return [];
      }
    }
    const parsed: Pedido[] = JSON.parse(raw);
    return parsed.map(p => ({
      ...p,
      status: p.status || 'aprovado'
    }));
  } catch (err) {
    console.error('Erro ao ler pedidos do localStorage:', err);
    return [];
  }
}

export function savePedido(novoPedido: Pedido): Pedido[] {
  const pedidoComStatus: Pedido = {
    ...novoPedido,
    cliente: novoPedido.cliente || 'Cliente',
    telefone: novoPedido.telefone || '',
    observacoes: novoPedido.observacoes || '',
    status: novoPedido.status || 'pendente',
    desconto: Number(novoPedido.desconto) >= 0 ? Number(novoPedido.desconto) : 0,
    descontoPercentual: Number(novoPedido.descontoPercentual) >= 0 ? Number(novoPedido.descontoPercentual) : 0,
    itens: (novoPedido.itens || []).map(item => ({
      id: item.id,
      descricao: item.descricao || '',
      qtd: Number(item.qtd) > 0 ? Number(item.qtd) : 1,
      valorUnitario: Number(item.valorUnitario) >= 0 ? Number(item.valorUnitario) : 0,
      ...(item.imagemUrl ? { imagemUrl: item.imagemUrl } : {})
    }))
  };

  localStorage.setItem(SEEDED_KEY, 'true');
  const atuais = getStoredPedidos();
  const atualizados = [pedidoComStatus, ...atuais];

  // Optimistic update
  localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados));
  window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: atualizados }));

  // Firestore update
  try {
    const sanitized = sanitizeForFirestore(pedidoComStatus);
    const targetDocId = getDocId(pedidoComStatus.id);
    docIdMap[pedidoComStatus.id] = targetDocId;
    const docRef = doc(db, PEDIDOS_COLLECTION, targetDocId);
    setDoc(docRef, sanitized).catch(err => {
      console.error('Error saving order to Firestore:', err);
    });
  } catch (err) {
    console.error('Synchronous error saving order to Firestore:', err);
  }

  return atualizados;
}

export function updatePedido(pedidoAtualizado: Pedido): Pedido[] {
  const pedidoLimpo: Pedido = {
    ...pedidoAtualizado,
    cliente: pedidoAtualizado.cliente || 'Cliente',
    telefone: pedidoAtualizado.telefone || '',
    observacoes: pedidoAtualizado.observacoes || '',
    status: pedidoAtualizado.status || 'na_fila',
    desconto: Number(pedidoAtualizado.desconto) >= 0 ? Number(pedidoAtualizado.desconto) : 0,
    descontoPercentual: Number(pedidoAtualizado.descontoPercentual) >= 0 ? Number(pedidoAtualizado.descontoPercentual) : 0,
    itens: (pedidoAtualizado.itens || []).map(item => ({
      id: item.id,
      descricao: item.descricao || '',
      qtd: Number(item.qtd) > 0 ? Number(item.qtd) : 1,
      valorUnitario: Number(item.valorUnitario) >= 0 ? Number(item.valorUnitario) : 0,
      ...(item.imagemUrl ? { imagemUrl: item.imagemUrl } : {})
    }))
  };

  const atuais = getStoredPedidos();
  const atualizados = atuais.map(p => {
    if (p.id === pedidoLimpo.id) {
      return { ...pedidoLimpo };
    }
    return p;
  });

  // Optimistic update
  localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados));
  window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: atualizados }));

  // Firestore update
  try {
    const sanitized = sanitizeForFirestore(pedidoLimpo);
    const targetDocId = docIdMap[pedidoLimpo.id] || getDocId(pedidoLimpo.id);
    const docRef = doc(db, PEDIDOS_COLLECTION, targetDocId);
    setDoc(docRef, sanitized, { merge: true }).catch(err => {
      console.error('Error updating order in Firestore:', err);
    });

    // Also query by id field in case of alternate document ID
    const q = query(collection(db, PEDIDOS_COLLECTION), where('id', '==', pedidoLimpo.id));
    getDocs(q).then((querySnapshot) => {
      querySnapshot.forEach((d) => {
        setDoc(d.ref, sanitized, { merge: true }).catch(console.error);
      });
    }).catch(console.error);
  } catch (err) {
    console.error('Synchronous error updating order in Firestore:', err);
  }

  return atualizados;
}

export function updatePedidoStatus(id: string, newStatus: PedidoStatus): Pedido[] {
  const atuais = getStoredPedidos();
  const atualizados = atuais.map(p => {
    if (p.id === id) {
      return { ...p, status: newStatus };
    }
    return p;
  });

  // Optimistic update
  localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados));
  window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: atualizados }));

  // Firestore update
  const targetDocId = docIdMap[id] || getDocId(id);
  const docRef = doc(db, PEDIDOS_COLLECTION, targetDocId);
  updateDoc(docRef, { status: newStatus }).catch(err => {
    console.error('Error updating status in Firestore:', err);
  });

  // Also query by id field in case of alternate document ID
  const q = query(collection(db, PEDIDOS_COLLECTION), where('id', '==', id));
  getDocs(q).then((querySnapshot) => {
    querySnapshot.forEach((d) => {
      updateDoc(d.ref, { status: newStatus }).catch(console.error);
    });
  }).catch(console.error);

  return atualizados;
}

export function deletePedido(id: string): Pedido[] {
  const atuais = getStoredPedidos();
  const atualizados = atuais.filter(p => p.id !== id);

  localStorage.setItem(SEEDED_KEY, 'true');

  // Optimistic update
  localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados));
  window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: atualizados }));

  // Firestore delete by mapped/derived doc ID
  const targetDocId = docIdMap[id] || getDocId(id);
  delete docIdMap[id];
  const docRef = doc(db, PEDIDOS_COLLECTION, targetDocId);
  deleteDoc(docRef).catch(err => {
    console.error('Error deleting order from Firestore:', err);
  });

  // Also query by 'id' field in case of alternate document ID
  const q = query(collection(db, PEDIDOS_COLLECTION), where('id', '==', id));
  getDocs(q).then((querySnapshot) => {
    querySnapshot.forEach((d) => {
      deleteDoc(d.ref).catch(console.error);
    });
  }).catch(console.error);

  return atualizados;
}

