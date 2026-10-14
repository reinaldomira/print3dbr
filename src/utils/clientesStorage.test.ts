import { getStoredClientes, saveCliente, updateCliente, deleteCliente } from './clientesStorage';
import { Cliente } from '../types';

// Mock localStorage in Node/tsx environment
const store: Record<string, string> = {};
(global as any).localStorage = {
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

async function runTests() {
  console.log('--- Iniciando Testes do Módulo de Clientes ---');

  // Test 1: Leitura inicial com fallback para INITIAL_CLIENTES
  const initial = getStoredClientes();
  if (!Array.isArray(initial) || initial.length === 0) {
    throw new Error('Falha no Teste 1: Clientes iniciais não foram carregados corretamente.');
  }
  console.log('✓ Teste 1: Clientes padrão carregados com sucesso. Total inicial:', initial.length);

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

  console.log('--- TODOS OS TESTES DE CLIENTES FORAM APROVADOS! ---');
}

runTests().catch((err) => {
  console.error('Erro nos testes de clientes:', err);
  process.exit(1);
});
