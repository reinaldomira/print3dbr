import { getStoredClientes, saveCliente, updateCliente, deleteCliente } from './clientesStorage';
import { Cliente } from '../types';

// Mock localStorage and window in Node/tsx environment
const store: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach(k => delete store[k]);
  }
};
(global as any).localStorage = mockStorage;
(global as any).window = {
  localStorage: mockStorage,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {}
};
(global as any).CustomEvent = class CustomEvent {
  detail: any;
  constructor(type: string, params: any) {
    this.detail = params?.detail;
  }
};

async function runTests() {
  console.log('--- Iniciando Testes do Módulo de Clientes ---');

  // Test 1: Primeiro uso sem dados de demonstração (deve retornar array vazio)
  const initial = getStoredClientes();
  if (!Array.isArray(initial) || initial.length !== 0) {
    throw new Error('Falha no Teste 1: Primeiro uso de clientes deve iniciar como array vazio.');
  }
  console.log('✓ Teste 1: Primeiro uso sem dados de demonstração validado com sucesso.');

  // Test 2: Salvar novo cliente
  const novo: Cliente = {
    id: 'teste-cli-1',
    nome: 'Empresa Teste 3D',
    telefone: '(11) 99887-6655',
    email: 'teste@3d.com',
    cidade: 'Campinas/SP',
    observacoes: 'Orçamento prioritário',
    criadoEm: new Date().toISOString()
  };

  await saveCliente(novo);
  const aposSalvar = getStoredClientes();
  const encontrado = aposSalvar.find(c => c.id === 'teste-cli-1');
  if (!encontrado || encontrado.nome !== 'Empresa Teste 3D') {
    throw new Error('Falha no Teste 2: Cliente não foi salvo no storage.');
  }
  console.log('✓ Teste 2: Novo cliente salvo com sucesso.');

  // Test 3: Atualizar cliente existente
  await updateCliente('teste-cli-1', {
    telefone: '(11) 91111-2222',
    cidade: 'Valinhos/SP'
  });
  const aposUpdate = getStoredClientes();
  const atualizado = aposUpdate.find(c => c.id === 'teste-cli-1');
  if (!atualizado || atualizado.telefone !== '(11) 91111-2222' || atualizado.cidade !== 'Valinhos/SP') {
    throw new Error('Falha no Teste 3: Atualização de cliente falhou.');
  }
  console.log('✓ Teste 3: Atualização de cliente validada com sucesso.');

  // Test 4: Excluir cliente
  await deleteCliente('teste-cli-1');
  const aposDelete = getStoredClientes();
  if (aposDelete.some(c => c.id === 'teste-cli-1')) {
    throw new Error('Falha no Teste 4: Cliente não foi removido do storage.');
  }
  console.log('✓ Teste 4: Exclusão de cliente confirmada.');

  // Test 5: Validação do formato único de IDs makeClienteDocId e makeDocId
  const { makeClienteDocId } = await import('./clientesStorage');
  const { makeDocId, getStoredPedidos } = await import('./ordersStorage');
  const { clearLocalUserData } = await import('../lib/firebase');

  const cliDocId = makeClienteDocId('user_abc_123', 'cli-001');
  if (cliDocId !== 'user_abc_123_cli-001') {
    throw new Error(`Falha no Teste 5: makeClienteDocId retornou ${cliDocId}, esperado user_abc_123_cli-001`);
  }
  console.log('✓ Teste 5: makeClienteDocId validado com isolamento de UID:', cliDocId);

  const orderDocId = makeDocId('user_abc_123', '#000042');
  if (orderDocId !== 'user_abc_123__000042') {
    throw new Error(`Falha no Teste 6: makeDocId retornou ${orderDocId}, esperado user_abc_123__000042`);
  }
  console.log('✓ Teste 6: makeDocId validado com isolamento de UID e higienização:', orderDocId);

  // Test 7: Isolamento contra vazamento entre contas de UIDs diferentes
  store['print3dbr_pedidos'] = JSON.stringify([
    { id: '#OTHER-1', cliente: 'Outro Usuario', total: 100, data: '2026-10-10', itens: [], ownerUid: 'outro_uid_999' }
  ]);
  store['print3dbr_clientes'] = JSON.stringify([
    { id: 'cli-other', nome: 'Cliente Outro', telefone: '123', criadoEm: '2026-10-10', ownerUid: 'outro_uid_999' }
  ]);
  const pedidosOutroUid = getStoredPedidos();
  const clientesOutroUid = getStoredClientes();
  if (pedidosOutroUid.length !== 0 || clientesOutroUid.length !== 0) {
    throw new Error('Falha no Teste 7: Itens de outro UID não podem vazar para a sessão ativa.');
  }
  console.log('✓ Teste 7: Isolamento estrito de UID validado (zero vazamento de dados de outros usuários).');

  // Test 8: Validação do clearLocalUserData
  clearLocalUserData();
  if (store['print3dbr_pedidos'] || store['print3dbr_clientes'] || store['print3dbr_settings']) {
    throw new Error('Falha no Teste 8: clearLocalUserData não limpou todas as chaves do localStorage.');
  }
  console.log('✓ Teste 8: Limpeza de cache local (logout/troca de conta) validada com sucesso.');

  console.log('--- TODOS OS TESTES DE CLIENTES E IDs FORAM APROVADOS! ---');
}

runTests().catch((err) => {
  console.error('Erro nos testes de clientes:', err);
  process.exit(1);
});
