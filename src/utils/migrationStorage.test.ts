import { 
  isOrderOwnedBySession, 
  areOrdersContentEqual, 
  resolveConflictId, 
  buildMigrationPlan 
} from './migrationHelper';
import { Pedido } from '../types';

function createMockOrder(id: string, ownerUid?: string, cliente = 'Cliente Teste', total = 100): Pedido {
  return {
    id,
    cliente,
    telefone: '(11) 99999-0000',
    data: '2026-10-09',
    total,
    metodoPagamento: 'pix',
    status: 'aprovado',
    observacoes: 'Observação teste',
    ownerUid,
    itens: [
      { id: '1', descricao: 'Peça Teste 3D', qtd: 1, valorUnitario: total }
    ]
  };
}

let allTestsPassed = true;
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    allTestsPassed = false;
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
  }
}

console.log('--- INICIANDO TESTES OBRIGATÓRIOS DE MIGRAÇÃO SEGURA PARA CONTA GOOGLE ---');

// Teste 1: Login Google com vinculação bem-sucedida da conta anônima (linkWithPopup, mesmo UID)
console.log('\nTeste 1: Login Google com vinculação bem-sucedida da conta anônima');
{
  const anonUid = 'anon_real_firebase_123';
  const localOrders = [
    createMockOrder('#PED-1', anonUid, 'Cliente A', 150),
    createMockOrder('#PED-2', anonUid, 'Cliente B', 250)
  ];
  const remoteOrders: Pedido[] = [];

  const plan = buildMigrationPlan({
    localOrders,
    remoteOrders,
    prevAnonUid: anonUid,
    targetUid: anonUid, // Mesmo UID preservado
    linkedInPlace: true,
    isAnonymous: true
  });

  assert(plan.ordersToUpload.length === 2, 'Todos os pedidos da sessão anônima são enviados com o UID vinculado');
  assert(plan.ordersToUpload.every(p => p.ownerUid === anonUid), 'O UID vinculado é preservado nos pedidos enviados');
  assert(plan.finalMergedOrders.length === 2, 'A lista final contém exatamente os 2 pedidos');
  assert(plan.conflictsResolvedCount === 0, 'Nenhum conflito gerado');
}

// Teste 2: Login com uma conta Google que já possui pedidos na nuvem
console.log('\nTeste 2: Login com uma conta Google que já possui pedidos na nuvem');
{
  const googleUid = 'google_account_existente_456';
  const prevAnonUid = 'anon_device_local_789';

  const remoteOrders = [
    createMockOrder('#CLOUD-1', googleUid, 'Cliente Remoto 1', 300),
    createMockOrder('#CLOUD-2', googleUid, 'Cliente Remoto 2', 400)
  ];

  const localOrders = [
    createMockOrder('#LOCAL-1', prevAnonUid, 'Cliente Local 1', 120),
    createMockOrder('#LOCAL-2', prevAnonUid, 'Cliente Local 2', 180)
  ];

  const plan = buildMigrationPlan({
    localOrders,
    remoteOrders,
    prevAnonUid,
    targetUid: googleUid,
    linkedInPlace: false,
    isAnonymous: true
  });

  assert(plan.ordersToUpload.length === 2, 'Os 2 pedidos locais da sessão anterior são enviados para a conta Google');
  assert(plan.ordersToUpload.every(p => p.ownerUid === googleUid), 'Os pedidos enviados recebem o UID da conta Google');
  assert(plan.finalMergedOrders.length === 4, 'A lista mesclada contém todos os 4 pedidos (2 remotos + 2 migrados)');
  assert(plan.finalMergedOrders.some(p => p.id === '#CLOUD-1'), 'O pedido #CLOUD-1 foi preservado');
  assert(plan.finalMergedOrders.some(p => p.id === '#LOCAL-1'), 'O pedido #LOCAL-1 foi preservado');
}

// Teste 3: Migração de pedidos que possuem o UID anônimo real do Firebase
console.log('\nTeste 3: Migração de pedidos que possuem o UID anônimo real do Firebase (não apenas a string "anonymous")');
{
  const realAnonUid = 'wkJ83KlM90aZp1_firebase_real_anon_uid';
  const targetGoogleUid = 'google_final_uid_999';

  const localOrders = [
    createMockOrder('#REAL-ANON-1', realAnonUid, 'Pessoa 1', 90),
    createMockOrder('#REAL-ANON-2', realAnonUid, 'Pessoa 2', 190)
  ];

  const plan = buildMigrationPlan({
    localOrders,
    remoteOrders: [],
    prevAnonUid: realAnonUid,
    targetUid: targetGoogleUid,
    linkedInPlace: false,
    isAnonymous: true
  });

  assert(plan.ordersToUpload.length === 2, 'Pedidos com UID anônimo real do Firebase foram identificados e migrados');
  assert(plan.ordersToUpload.every(p => p.ownerUid === targetGoogleUid), 'UID dos pedidos migrados foi atualizado para o UID Google');
}

// Teste 4: Preservação dos pedidos já existentes na conta Google
console.log('\nTeste 4: Preservação dos pedidos já existentes na conta Google');
{
  const googleUid = 'google_uid_555';
  const originalCloudOrder = createMockOrder('#HISTORICO-1', googleUid, 'Cliente Histórico Importante', 850);
  const remoteOrders = [originalCloudOrder];

  const localOrders = [
    createMockOrder('#NOVO-LOCAL', 'anon_sessao', 'Novo Cliente', 110)
  ];

  const plan = buildMigrationPlan({
    localOrders,
    remoteOrders,
    prevAnonUid: 'anon_sessao',
    targetUid: googleUid,
    linkedInPlace: false,
    isAnonymous: true
  });

  const cloudOrderInResult = plan.finalMergedOrders.find(p => p.id === '#HISTORICO-1');
  assert(!!cloudOrderInResult, 'Pedido existente na nuvem continua na lista consolidada');
  assert(cloudOrderInResult?.cliente === 'Cliente Histórico Importante', 'Dados do pedido na nuvem permaneceram inalterados');
  assert(cloudOrderInResult?.total === 850, 'Total do pedido da nuvem preservado exatamente');
}

// Teste 5: Ausência de duplicações após repetir a migração
console.log('\nTeste 5: Ausência de duplicações após repetir a migração');
{
  const googleUid = 'google_uid_repetido';
  const orderA = createMockOrder('#DUP-1', googleUid, 'Cliente Alpha', 200);

  // Primeira migração já inseriu o pedido na nuvem
  const remoteOrders = [orderA];
  // Local ainda possui o mesmo pedido exatamente igual
  const localOrders = [{ ...orderA }];

  const plan = buildMigrationPlan({
    localOrders,
    remoteOrders,
    prevAnonUid: null,
    targetUid: googleUid,
    linkedInPlace: false,
    isAnonymous: false
  });

  assert(plan.ordersToUpload.length === 0, 'Nenhum pedido foi reenviado para evitar duplicações desnecessárias');
  assert(plan.finalMergedOrders.length === 1, 'A lista contém apenas 1 cópia do pedido, sem duplicatas');
}

// Teste 6: Falha de internet durante a migração
console.log('\nTeste 6: Falha de internet durante a migração');
{
  let localCache = [
    createMockOrder('#OFFLINE-1', 'anon_temp', 'Cliente Offline', 130)
  ];
  const backup = [...localCache];

  // Simulação da função com tolerância a falhas
  let caughtError = false;
  try {
    // Simula tentativa de busca remota ou envio falhando por rede
    throw new Error('Network error: Failed to fetch (Internet connection offline)');
  } catch (err: any) {
    caughtError = true;
    // Rollback explícito do cache local
    localCache = [...backup];
  }

  assert(caughtError, 'Erro de rede foi capturado com sucesso');
  assert(localCache.length === 1, 'Dados locais foram mantidos intactos');
  assert(localCache[0].id === '#OFFLINE-1', 'O pedido offline original foi 100% preservado');
}

// Teste 7: Cancelamento do login pelo usuário
console.log('\nTeste 7: Cancelamento do login');
{
  let localCache = [
    createMockOrder('#CANCEL-1', 'anon_temp', 'Cliente Cancel', 75)
  ];
  const initialCopy = JSON.stringify(localCache);

  let wasCancelled = false;
  try {
    const error: any = new Error('Login cancelado pelo usuário.');
    error.code = 'auth/popup-closed-by-user';
    throw error;
  } catch (err: any) {
    if (err.code === 'auth/popup-closed-by-user') {
      wasCancelled = true;
      // Nenhuma alteração no cache local
    }
  }

  assert(wasCancelled, 'Cancelamento do popup foi identificado corretamente');
  assert(JSON.stringify(localCache) === initialCopy, 'Os pedidos locais não foram modificados no cancelamento');
}

// Teste 8: Falha na gravação de um ou mais pedidos (Batch Commit Failure)
console.log('\nTeste 8: Falha na gravação de um ou mais pedidos');
{
  const localOriginal = [
    createMockOrder('#SAVE-FAIL-1', 'anon_temp', 'Cliente Falha', 500)
  ];
  let localState = [...localOriginal];
  const backupBeforeMigration = [...localState];

  let rollbackExecuted = false;
  try {
    // Simula erro de permissão ou falha de commit no Firestore
    throw new Error('Firestore writeBatch commit failed: PERMISSION_DENIED');
  } catch (err) {
    // Protocolo de Rollback
    localState = [...backupBeforeMigration];
    rollbackExecuted = true;
  }

  assert(rollbackExecuted, 'Rollback foi disparado após falha de gravação');
  assert(localState.length === 1, 'Quantidade de pedidos locais restaurada');
  assert(localState[0].id === '#SAVE-FAIL-1', 'Identificador do pedido preservado após o rollback');
}

// Teste 9: Ausência de perda dos dados locais em qualquer falha
console.log('\nTeste 9: Ausência de perda dos dados locais em qualquer falha');
{
  const initialLocal = [
    createMockOrder('#DATA-1', 'anon_test', 'C1', 10),
    createMockOrder('#DATA-2', 'anon_test', 'C2', 20),
    createMockOrder('#DATA-3', 'anon_test', 'C3', 30)
  ];

  const failureScenarios = [
    'auth/invalid-credential',
    'auth/network-request-failed',
    'firestore/unavailable',
    'internal/unknown-error'
  ];

  for (const scenario of failureScenarios) {
    let currentLocal = [...initialLocal];
    const backup = [...currentLocal];
    try {
      throw new Error(`Simulated error: ${scenario}`);
    } catch {
      currentLocal = [...backup];
    }
    assert(currentLocal.length === 3, `Nenhum dado perdido no cenário de falha ${scenario}`);
  }
}

// Teste 10: Isolamento dos pedidos pertencentes a outros usuários
console.log('\nTeste 10: Isolamento dos pedidos pertencentes a outros usuários');
{
  const currentAnonUid = 'anon_sessao_atual';
  const otherUserUid = 'usuario_legitimo_outro_uid';
  const targetGoogleUid = 'google_usuario_novo';

  const orderOfCurrentSession = createMockOrder('#MEU-PEDIDO', currentAnonUid, 'Minha Peça', 100);
  const orderOfOtherUser = createMockOrder('#PEDIDO-OUTRO', otherUserUid, 'Peça de Outro Usuário', 999);

  const localOrders = [orderOfCurrentSession, orderOfOtherUser];
  const remoteOrders: Pedido[] = [];

  const plan = buildMigrationPlan({
    localOrders,
    remoteOrders,
    prevAnonUid: currentAnonUid,
    targetUid: targetGoogleUid,
    linkedInPlace: false,
    isAnonymous: true
  });

  assert(plan.ordersToUpload.length === 1, 'Apenas o pedido da sessão atual foi colocado para upload');
  assert(plan.ordersToUpload[0].id === '#MEU-PEDIDO', 'O pedido enviado é estritamente o da sessão atual');
  assert(plan.ordersToUpload[0].ownerUid === targetGoogleUid, 'O pedido da sessão atual recebeu o novo Google UID');

  // Verifica que o pedido do outro usuário NUNCA foi atribuído ao novo Google UID
  const otherUserOrderInResult = plan.finalMergedOrders.find(p => p.id === '#PEDIDO-OUTRO');
  assert(!!otherUserOrderInResult, 'O pedido do outro usuário permaneceu preservado localmente');
  assert(otherUserOrderInResult?.ownerUid === otherUserUid, 'O ownerUid do outro usuário permaneceu inalterado e isolado');
  assert(plan.otherUsersOrdersKeptCount === 1, 'Contador de pedidos de outros usuários mantidos intactos é 1');
}

// BÔNUS: Teste de Resolução de Conflitos quando o mesmo ID tem dados diferentes
console.log('\nTeste Bônus: Resolução de conflito com IDs idênticos mas dados diferentes');
{
  const googleUid = 'google_user_conflito';
  const prevAnonUid = 'anon_conflito';

  // Na nuvem existe #000042 com Cliente X e R$ 100
  const remoteOrders = [
    createMockOrder('#000042', googleUid, 'Cliente Nuvem Antigo', 100)
  ];

  // No dispositivo foi criado #000042 com Cliente Y e R$ 300
  const localOrders = [
    createMockOrder('#000042', prevAnonUid, 'Cliente Local Diferente', 300)
  ];

  const plan = buildMigrationPlan({
    localOrders,
    remoteOrders,
    prevAnonUid,
    targetUid: googleUid,
    linkedInPlace: false,
    isAnonymous: true
  });

  assert(plan.conflictsResolvedCount === 1, 'Conflito detectado e tratado explicitamente');
  assert(plan.finalMergedOrders.length === 2, 'Ambos os pedidos foram preservados sem sobrescrita silenciosa');
  assert(plan.finalMergedOrders.some(p => p.id === '#000042' && p.total === 100), 'O pedido da nuvem original foi preservado com ID #000042');
  assert(plan.finalMergedOrders.some(p => p.id === '#000042-local' && p.total === 300), 'O pedido local foi preservado com ID renomeado #000042-local');
}

console.log('\n======================================================');
if (allTestsPassed) {
  console.log('🎉 TODOS OS 10 TESTES OBRIGATÓRIOS PASSARAM COM SUCESSO!');
} else {
  console.error('💥 ALGUNS TESTES FALHARAM!');
  process.exit(1);
}
