import { Pedido } from '../types';

/**
 * Verifica se um pedido local pertence à sessão atual a ser migrada.
 * Regra de segurança: pedidos com ownerUid de outros usuários NUNCA são considerados da sessão atual.
 */
export function isOrderOwnedBySession(
  order: Pedido, 
  prevAnonUid: string | null, 
  isAnonymous: boolean
): boolean {
  // Se o pedido tem exatamente o UID anônimo prévio
  if (prevAnonUid && order.ownerUid === prevAnonUid) {
    return true;
  }
  
  // Se o pedido está sem UID ou com a flag 'anonymous' e a sessão atual era anônima
  if ((!order.ownerUid || order.ownerUid === 'anonymous') && isAnonymous) {
    return true;
  }

  // Pedidos que pertencem a outro usuário específico NÃO pertencem a esta sessão
  return false;
}

/**
 * Compara se o conteúdo essencial de dois pedidos é igual para detectar duplicatas reais.
 */
export function areOrdersContentEqual(a: Pedido, b: Pedido): boolean {
  if (a.id !== b.id) return false;
  if (Number(a.total) !== Number(b.total)) return false;
  if ((a.cliente || '').trim() !== (b.cliente || '').trim()) return false;
  
  const itensA = a.itens || [];
  const itensB = b.itens || [];
  if (itensA.length !== itensB.length) return false;

  return true;
}

/**
 * Gera um ID que não colida com os IDs existentes quando houver conflito de dados com a nuvem.
 */
export function resolveConflictId(baseId: string, existingIds: Set<string>): string {
  let candidate = `${baseId}-local`;
  let counter = 2;
  while (existingIds.has(candidate)) {
    candidate = `${baseId}-local-${counter}`;
    counter++;
  }
  return candidate;
}

export interface MigrationPlanInput {
  localOrders: Pedido[];
  remoteOrders: Pedido[];
  prevAnonUid: string | null;
  targetUid: string;
  linkedInPlace: boolean;
  isAnonymous: boolean;
}

export interface MigrationPlanResult {
  ordersToUpload: Pedido[];
  finalMergedOrders: Pedido[];
  migratedCount: number;
  conflictsResolvedCount: number;
  otherUsersOrdersKeptCount: number;
}

/**
 * Constrói o plano de migração seguro:
 * 1. Isola pedidos de outros usuários para não tocá-los.
 * 2. Identifica pedidos da sessão que precisam subir para o targetUid.
 * 3. Previne duplicações se o pedido já existir de forma idêntica na nuvem.
 * 4. Resolve conflitos de ID sem sobrescrever dados da nuvem nem perder dados locais.
 */
export function buildMigrationPlan(input: MigrationPlanInput): MigrationPlanResult {
  const { localOrders, remoteOrders, prevAnonUid, targetUid, linkedInPlace, isAnonymous } = input;

  const sessionOrders: Pedido[] = [];
  const otherUsersOrders: Pedido[] = [];

  for (const order of localOrders) {
    if (isOrderOwnedBySession(order, prevAnonUid, isAnonymous)) {
      sessionOrders.push(order);
    } else {
      otherUsersOrders.push(order);
    }
  }

  const existingRemoteMap = new Map<string, Pedido>();
  const usedIds = new Set<string>();

  for (const r of remoteOrders) {
    existingRemoteMap.set(r.id, r);
    usedIds.add(r.id);
  }

  const ordersToUpload: Pedido[] = [];
  let conflictsResolvedCount = 0;

  for (const localOrder of sessionOrders) {
    const remoteMatch = existingRemoteMap.get(localOrder.id);

    if (remoteMatch) {
      // Pedido já existe na nuvem com o mesmo ID
      if (areOrdersContentEqual(localOrder, remoteMatch)) {
        // Dados idênticos: já preservado na nuvem, não precisa reenviar
        continue;
      } else {
        // CONFLITO: IDs iguais mas dados diferentes!
        // Não sobrescrever silenciosamente: gera ID não conflitante e preserva ambos
        const resolvedId = resolveConflictId(localOrder.id, usedIds);
        usedIds.add(resolvedId);
        conflictsResolvedCount++;

        const resolvedOrder: Pedido = {
          ...localOrder,
          id: resolvedId,
          ownerUid: targetUid,
          observacoes: (localOrder.observacoes ? localOrder.observacoes + ' ' : '') + 
            `[Importado da sessão local - ID original preservado: ${localOrder.id}]`
        };

        ordersToUpload.push(resolvedOrder);
      }
    } else {
      // Pedido novo para a conta: migra com targetUid
      usedIds.add(localOrder.id);
      const migratedOrder: Pedido = {
        ...localOrder,
        ownerUid: targetUid
      };
      ordersToUpload.push(migratedOrder);
    }
  }

  // Monta a lista consolidada final
  // 1. Todos os pedidos remotos existentes
  // 2. Todos os pedidos enviados/migrados
  // 3. Todos os pedidos de outros usuários locais (mantidos intactos)
  const finalMergedMap = new Map<string, Pedido>();

  for (const r of remoteOrders) {
    finalMergedMap.set(r.id, r);
  }

  for (const up of ordersToUpload) {
    finalMergedMap.set(up.id, up);
  }

  for (const o of otherUsersOrders) {
    // Se não houver colisão de ID, preserva
    if (!finalMergedMap.has(o.id)) {
      finalMergedMap.set(o.id, o);
    }
  }

  const finalMergedOrders = Array.from(finalMergedMap.values());

  return {
    ordersToUpload,
    finalMergedOrders,
    migratedCount: ordersToUpload.length,
    conflictsResolvedCount,
    otherUsersOrdersKeptCount: otherUsersOrders.length
  };
}
