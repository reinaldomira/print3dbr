import { Pedido, PedidoStatus } from '../types';
import { 
  db, 
  auth, 
  subscribeToAuth, 
  handleFirestoreError, 
  OperationType, 
  GoogleAuthResult,
  setGlobalMigrationInProgress,
  getGlobalMigrationInProgress
} from '../lib/firebase';
import { buildMigrationPlan } from './migrationHelper';
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
  getDocs,
  Unsubscribe
} from 'firebase/firestore';

const STORAGE_KEY = 'print3dbr_pedidos';
const SEEDED_KEY = 'print3dbr_has_seeded';
const PEDIDOS_COLLECTION = 'pedidos';

// Map of order.id -> docSnap.id
const docIdMap: Record<string, string> = {};

// Helper to convert order ID to valid Firestore document ID
function getDocId(orderId: string): string {
  return orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Gera um ID de documento único por usuário para evitar colisões no Firestore.
 */
export function makeDocId(uid: string, orderId: string): string {
  return `${uid}_${getDocId(orderId)}`;
}

/**
 * Retorna o UID do proprietário ativo (autenticado no Firebase ou fallback temporário).
 */
export function getCurrentOwnerUid(): string {
  return auth.currentUser?.uid || 'anonymous';
}

/**
 * Remove recursivamente propriedades undefined e higieniza dados para o Firestore.
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

let activeUnsubscribe: Unsubscribe | null = null;
let currentSubscribedUid: string | null = null;
let isMigrationInProgress = false;

/**
 * Executa a migração segura dos pedidos locais para a conta Google autenticada.
 * Implementa todas as etapas do protocolo de tolerância a falhas:
 * 1. Backup do estado local antes de qualquer modificação.
 * 2. Consulta dos pedidos existentes na conta Google remota.
 * 3. Planejamento com isolamento de outros usuários e resolução de conflitos sem perdas.
 * 4. Gravação atômica em lote no Firestore confirmando sucesso.
 * 5. Atualização do cache local somente após confirmação da nuvem.
 * 6. Rollback total imediato do estado local em caso de qualquer falha.
 */
export async function executeGoogleMigration(authResult: GoogleAuthResult): Promise<{
  migratedCount: number;
  conflictsResolvedCount: number;
  totalCount: number;
}> {
  isMigrationInProgress = true;
  setGlobalMigrationInProgress(true);
  const backupLocalPedidos = [...getStoredPedidos()];
  const targetUid = authResult.user.uid;
  const prevAnonUid = authResult.prevAnonUid;
  const isAnonymous = prevAnonUid !== null;

  try {
    // 1. Busca pedidos já existentes na nuvem pertencentes à conta Google
    const q = query(
      collection(db, PEDIDOS_COLLECTION),
      where('ownerUid', '==', targetUid)
    );
    const remoteSnapshot = await getDocs(q);
    const remotePedidos: Pedido[] = [];
    remoteSnapshot.forEach(docSnap => {
      const data = docSnap.data() as Pedido;
      const orderId = data.id || docSnap.id;
      docIdMap[orderId] = docSnap.id;
      remotePedidos.push({
        ...data,
        id: orderId,
        ownerUid: targetUid,
        status: data.status || 'aprovado'
      });
    });

    // 2. Constrói o plano de migração com isolamento e preservação
    const plan = buildMigrationPlan({
      localOrders: backupLocalPedidos,
      remoteOrders: remotePedidos,
      prevAnonUid,
      targetUid,
      linkedInPlace: authResult.linkedInPlace,
      isAnonymous
    });

    // 3. Grava no Firestore os pedidos novos ou com conflito resolvido
    if (plan.ordersToUpload.length > 0) {
      const batch = writeBatch(db);
      for (const order of plan.ordersToUpload) {
        const targetDocId = docIdMap[order.id] || makeDocId(targetUid, order.id);
        docIdMap[order.id] = targetDocId;
        const docRef = doc(db, PEDIDOS_COLLECTION, targetDocId);
        batch.set(docRef, sanitizeForFirestore(order), { merge: true });
      }
      // Confirmação obrigatória: se a rede cair ou o Firestore falhar, dispara o catch
      await batch.commit();
    }

    // 4. Confirmação obtida: atualiza o estado local consolidado
    localStorage.setItem(SEEDED_KEY, 'true');
    localStorage.setItem('print3dbr_last_uid', targetUid);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan.finalMergedOrders));
    window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: plan.finalMergedOrders }));

    // 5. Atualiza o listener em tempo real para a conta Google ativa
    setupFirestoreListener(targetUid);

    console.log(`[Print3DBR] Migração concluída com sucesso: ${plan.migratedCount} pedidos enviados, ${plan.conflictsResolvedCount} conflitos preservados.`);

    return {
      migratedCount: plan.migratedCount,
      conflictsResolvedCount: plan.conflictsResolvedCount,
      totalCount: plan.finalMergedOrders.length
    };
  } catch (error) {
    // Tolerância a falhas: restaura os pedidos locais exatamente como estavam antes
    console.error('[Print3DBR] Erro durante a migração. Restaurando dados locais intactos:', error);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(backupLocalPedidos));
    window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: backupLocalPedidos }));
    throw error;
  } finally {
    isMigrationInProgress = false;
    setGlobalMigrationInProgress(false);
  }
}

/**
 * Inicia ou atualiza o listener do Firestore filtrando estritamente pelos pedidos do proprietário autenticado.
 * Não sobrescreve o cache local caso uma migração esteja em andamento.
 */
export function setupFirestoreListener(ownerUid: string | null) {
  if (activeUnsubscribe && currentSubscribedUid === ownerUid) {
    return;
  }

  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }

  currentSubscribedUid = ownerUid;

  if (!ownerUid) {
    return;
  }

  try {
    const q = query(
      collection(db, PEDIDOS_COLLECTION),
      where('ownerUid', '==', ownerUid)
    );

    activeUnsubscribe = onSnapshot(q, (snapshot) => {
      // Se houver uma migração em curso, o listener não pode atropelar o estado local
      if (isMigrationInProgress || getGlobalMigrationInProgress()) {
        return;
      }

      const pedidosFromDb: Pedido[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Pedido;
        const orderId = data.id || docSnap.id;
        docIdMap[orderId] = docSnap.id;

        pedidosFromDb.push({
          ...data,
          id: orderId,
          ownerUid,
          status: data.status || 'aprovado'
        });
      });

      // Se a nuvem retornou documentos, atualiza o cache local apenas com os pedidos do usuário autenticado
      if (!snapshot.empty) {
        localStorage.setItem(SEEDED_KEY, 'true');
        const local = getStoredPedidos();
        // Preserva pedidos locais recém-criados ainda não sincronizados do usuário ativo ou sem ownerUid
        const unsyncedLocal = local.filter(p => !p.ownerUid || p.ownerUid === ownerUid);
        const remoteIds = new Set(pedidosFromDb.map(p => p.id));
        const unsyncedOnly = unsyncedLocal.filter(p => !remoteIds.has(p.id));
        const combined = [...pedidosFromDb, ...unsyncedOnly];

        localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
        window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: combined }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `${PEDIDOS_COLLECTION}?ownerUid=${ownerUid}`);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, PEDIDOS_COLLECTION);
  }
}

// Observa mudanças de autenticação mantendo o listener sincronizado sem interferir em migrações manuais
subscribeToAuth((user) => {
  if (isMigrationInProgress || getGlobalMigrationInProgress()) {
    return;
  }
  if (user) {
    setupFirestoreListener(user.uid);
  } else {
    setupFirestoreListener(null);
  }
});

export function getStoredPedidos(): Pedido[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: Pedido[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Se uma migração para conta Google estiver em curso, retorna os pedidos locais para planejar o upload
    if (isMigrationInProgress || getGlobalMigrationInProgress()) {
      return parsed.map(p => ({
        ...p,
        status: p.status || 'aprovado'
      }));
    }

    const currentUid = auth.currentUser?.uid;
    const filtered = parsed.filter(p => {
      // Itens locais ainda sem ownerUid devem ser exibidos
      if (!p.ownerUid) return true;
      // Se houver usuário autenticado, apenas itens do usuário ativo
      if (currentUid) {
        return p.ownerUid === currentUid;
      }
      return p.ownerUid === 'anonymous';
    });

    return filtered.map(p => ({
      ...p,
      status: p.status || 'aprovado'
    }));
  } catch (err) {
    console.error('Erro ao ler pedidos do localStorage:', err);
    return [];
  }
}

export function savePedido(novoPedido: Pedido): Pedido[] {
  const currentUid = getCurrentOwnerUid();
  const pedidoComStatus: Pedido = {
    ...novoPedido,
    ownerUid: novoPedido.ownerUid || currentUid,
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

  // Atualização otimista no estado local
  localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados));
  window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: atualizados }));

  // Gravação no Firestore apenas se houver usuário autenticado
  if (auth.currentUser) {
    try {
      const sanitized = sanitizeForFirestore(pedidoComStatus);
      const targetDocId = docIdMap[pedidoComStatus.id] || makeDocId(auth.currentUser.uid, pedidoComStatus.id);
      docIdMap[pedidoComStatus.id] = targetDocId;
      const docRef = doc(db, PEDIDOS_COLLECTION, targetDocId);
      
      setDoc(docRef, sanitized).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, `${PEDIDOS_COLLECTION}/${targetDocId}`);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, PEDIDOS_COLLECTION);
    }
  }

  return atualizados;
}

export function updatePedido(pedidoAtualizado: Pedido): Pedido[] {
  const currentUid = getCurrentOwnerUid();
  const pedidoLimpo: Pedido = {
    ...pedidoAtualizado,
    ownerUid: pedidoAtualizado.ownerUid || currentUid,
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

  // Atualização otimista
  localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados));
  window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: atualizados }));

  // Atualização no Firestore apenas se houver usuário autenticado
  if (auth.currentUser) {
    try {
      const sanitized = sanitizeForFirestore(pedidoLimpo);
      const targetDocId = docIdMap[pedidoLimpo.id] || makeDocId(auth.currentUser.uid, pedidoLimpo.id);
      docIdMap[pedidoLimpo.id] = targetDocId;
      const docRef = doc(db, PEDIDOS_COLLECTION, targetDocId);
      
      setDoc(docRef, sanitized, { merge: true }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `${PEDIDOS_COLLECTION}/${targetDocId}`);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, PEDIDOS_COLLECTION);
    }
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

  // Atualização otimista
  localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados));
  window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: atualizados }));

  // Atualização no Firestore apenas se houver usuário autenticado
  if (auth.currentUser) {
    try {
      const targetDocId = docIdMap[id] || makeDocId(auth.currentUser.uid, id);
      docIdMap[id] = targetDocId;
      const docRef = doc(db, PEDIDOS_COLLECTION, targetDocId);
      updateDoc(docRef, { status: newStatus }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `${PEDIDOS_COLLECTION}/${targetDocId}`);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, PEDIDOS_COLLECTION);
    }
  }

  return atualizados;
}

export function deletePedido(id: string): Pedido[] {
  const atuais = getStoredPedidos();
  const atualizados = atuais.filter(p => p.id !== id);

  localStorage.setItem(SEEDED_KEY, 'true');

  // Atualização otimista
  localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados));
  window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: atualizados }));

  // Exclusão no Firestore apenas se houver usuário autenticado
  if (auth.currentUser) {
    try {
      const targetDocId = docIdMap[id] || makeDocId(auth.currentUser.uid, id);
      delete docIdMap[id];
      const docRef = doc(db, PEDIDOS_COLLECTION, targetDocId);
      deleteDoc(docRef).catch(err => {
        handleFirestoreError(err, OperationType.DELETE, `${PEDIDOS_COLLECTION}/${targetDocId}`);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, PEDIDOS_COLLECTION);
    }
  } else {
    delete docIdMap[id];
  }

  return atualizados;
}
