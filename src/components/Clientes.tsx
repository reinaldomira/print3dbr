import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  MessageCircle, 
  FileText, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Plus,
  ShoppingBag,
  ExternalLink,
  UserCheck
} from 'lucide-react';
import { Cliente, Tab, Pedido } from '../types';
import { getStoredClientes, saveCliente, updateCliente, deleteCliente } from '../utils/clientesStorage';
import { getStoredPedidos } from '../utils/ordersStorage';

interface ClientesProps {
  onNavigate: (tab: Tab) => void;
  onSelectClienteForNota?: (cliente: { nome: string; telefone: string }) => void;
}

export function Clientes({ onNavigate, onSelectClienteForNota }: ClientesProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [busca, setBusca] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states
  const [formNome, setFormNome] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCidade, setFormCidade] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [formError, setFormError] = useState('');

  // Load data
  useEffect(() => {
    const carregar = () => {
      setClientes(getStoredClientes());
      setPedidos(getStoredPedidos());
    };

    carregar();

    const handleClientesUpdate = () => {
      setClientes(getStoredClientes());
    };
    const handleOrdersUpdate = () => {
      setPedidos(getStoredPedidos());
    };

    window.addEventListener('clientesUpdated', handleClientesUpdate);
    window.addEventListener('ordersUpdated', handleOrdersUpdate);

    return () => {
      window.removeEventListener('clientesUpdated', handleClientesUpdate);
      window.removeEventListener('ordersUpdated', handleOrdersUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Helper de máscara de telefone
  const formatarTelefone = (valor: string) => {
    const apenasDigitos = valor.replace(/\D/g, '').slice(0, 11);
    if (apenasDigitos.length <= 2) {
      return apenasDigitos.length > 0 ? `(${apenasDigitos}` : '';
    }
    if (apenasDigitos.length <= 6) {
      return `(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2)}`;
    }
    if (apenasDigitos.length <= 10) {
      return `(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2, 6)}-${apenasDigitos.slice(6)}`;
    }
    return `(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2, 7)}-${apenasDigitos.slice(7, 11)}`;
  };

  // Estatísticas por cliente baseadas no histórico de pedidos
  const statsPorCliente = useMemo(() => {
    const map = new Map<string, { totalGasto: number; qtdPedidos: number }>();
    
    pedidos.forEach(p => {
      const nomeLower = (p.cliente || '').trim().toLowerCase();
      if (!nomeLower) return;

      const current = map.get(nomeLower) || { totalGasto: 0, qtdPedidos: 0 };
      current.totalGasto += (p.total || 0);
      current.qtdPedidos += 1;
      map.set(nomeLower, current);
    });

    return map;
  }, [pedidos]);

  // Filtragem
  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;

    return clientes.filter(c => 
      c.nome.toLowerCase().includes(termo) ||
      c.telefone.includes(termo) ||
      (c.email && c.email.toLowerCase().includes(termo)) ||
      (c.cidade && c.cidade.toLowerCase().includes(termo))
    );
  }, [clientes, busca]);

  // Abrir modal de criação
  const handleOpenCreateModal = () => {
    setEditingCliente(null);
    setFormNome('');
    setFormTelefone('');
    setFormEmail('');
    setFormCidade('');
    setFormObservacoes('');
    setFormError('');
    setIsModalOpen(true);
  };

  // Abrir modal de edição
  const handleOpenEditModal = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormNome(cliente.nome);
    setFormTelefone(cliente.telefone);
    setFormEmail(cliente.email || '');
    setFormCidade(cliente.cidade || '');
    setFormObservacoes(cliente.observacoes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  // Salvar formulário
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = formNome.trim();
    const telLimpo = formTelefone.trim();

    if (!nomeLimpo) {
      setFormError('O nome do cliente é obrigatório.');
      return;
    }
    if (!telLimpo || telLimpo.replace(/\D/g, '').length < 8) {
      setFormError('Informe um telefone ou WhatsApp válido com DDD.');
      return;
    }

    try {
      if (editingCliente) {
        await updateCliente(editingCliente.id, {
          nome: nomeLimpo,
          telefone: telLimpo,
          email: formEmail.trim() || undefined,
          cidade: formCidade.trim() || undefined,
          observacoes: formObservacoes.trim() || undefined
        });
        showToast(`Cliente "${nomeLimpo}" atualizado com sucesso!`);
      } else {
        const novo: Cliente = {
          id: crypto.randomUUID(),
          nome: nomeLimpo,
          telefone: telLimpo,
          email: formEmail.trim() || undefined,
          cidade: formCidade.trim() || undefined,
          observacoes: formObservacoes.trim() || undefined,
          criadoEm: new Date().toISOString()
        };
        await saveCliente(novo);
        showToast(`Cliente "${nomeLimpo}" cadastrado com sucesso!`);
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
      setFormError('Erro ao gravar os dados. Tente novamente.');
    }
  };

  // Confirmar exclusão
  const handleConfirmDelete = async () => {
    if (!clienteToDelete) return;
    try {
      await deleteCliente(clienteToDelete.id);
      showToast(`Cliente "${clienteToDelete.nome}" removido.`);
      setClienteToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir cliente:', err);
    }
  };

  // Gerar link do WhatsApp
  const getWhatsAppLink = (telefone: string, nome: string) => {
    const digitos = telefone.replace(/\D/g, '');
    const numeroComDDI = digitos.length <= 11 ? `55${digitos}` : digitos;
    const saudacao = encodeURIComponent(`Olá ${nome.split(' ')[0]}, tudo bem? Falamos da impressão 3D.`);
    return `https://wa.me/${numeroComDDI}?text=${saudacao}`;
  };

  // Iniciar novo orçamento para este cliente
  const handleCriarOrcamento = (cliente: Cliente) => {
    if (onSelectClienteForNota) {
      onSelectClienteForNota({
        nome: cliente.nome,
        telefone: cliente.telefone
      });
    } else {
      onNavigate('nova-nota');
    }
  };

  // Iniciais para o avatar
  const getIniciais = (nome: string) => {
    const partes = nome.trim().split(' ').filter(Boolean);
    if (partes.length === 0) return 'CL';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Toast de notificação */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-xl text-sm font-medium animate-fadeIn">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2.5">
            <Users className="w-7 h-7 text-primary" />
            Cadastro de Clientes
          </h1>
          <p className="text-sm text-outline mt-1">
            Gerencie contatos, histórico de atendimento e dados básicos para orçamentos rápidos.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-medium text-sm rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-outline-variant rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-outline uppercase tracking-wider">Total de Clientes</p>
            <p className="text-2xl font-bold text-on-surface mt-1">{clientes.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface border border-outline-variant rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-outline uppercase tracking-wider">Com Pedidos Registrados</p>
            <p className="text-2xl font-bold text-on-surface mt-1">
              {clientes.filter(c => (statsPorCliente.get(c.nome.trim().toLowerCase())?.qtdPedidos || 0) > 0).length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface border border-outline-variant rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-outline uppercase tracking-wider">Total de Pedidos Gerados</p>
            <p className="text-2xl font-bold text-on-surface mt-1">{pedidos.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Busca */}
      <div className="bg-surface border border-outline-variant rounded-lg p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, email ou cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:border-primary transition-colors"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface text-xs"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Lista de Clientes */}
      {clientesFiltrados.length === 0 ? (
        <div className="bg-surface border border-outline-variant rounded-lg p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-outline mx-auto mb-3">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-on-surface">
            {busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </h3>
          <p className="text-sm text-outline mt-1 max-w-sm mx-auto">
            {busca 
              ? 'Tente pesquisar com outros termos ou limpe o campo de busca.'
              : 'Cadastre seus clientes com nome e telefone para preencher orçamentos com apenas um clique.'}
          </p>
          {!busca && (
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Primeiro Cliente
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientesFiltrados.map((cliente) => {
            const stats = statsPorCliente.get(cliente.nome.trim().toLowerCase()) || { totalGasto: 0, qtdPedidos: 0 };

            return (
              <div 
                key={cliente.id}
                className="bg-surface border border-outline-variant hover:border-outline/50 rounded-lg p-5 flex flex-col justify-between transition-all shadow-xs"
              >
                <div>
                  {/* Topo do card */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                        {getIniciais(cliente.nome)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-on-surface text-base truncate" title={cliente.nome}>
                          {cliente.nome}
                        </h3>
                        {cliente.cidade && (
                          <p className="text-xs text-outline flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {cliente.cidade}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditModal(cliente)}
                        className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container rounded-md transition-colors cursor-pointer"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setClienteToDelete(cliente)}
                        className="p-1.5 text-outline hover:text-red-400 hover:bg-surface-container rounded-md transition-colors cursor-pointer"
                        title="Excluir cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Informações de Contato */}
                  <div className="space-y-1.5 text-xs text-on-surface-variant my-3 pt-2 border-t border-outline-variant/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-outline">
                        <Phone className="w-3.5 h-3.5" />
                        {cliente.telefone}
                      </span>
                      {cliente.telefone && (
                        <a
                          href={getWhatsAppLink(cliente.telefone, cliente.nome)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded transition-colors"
                          title="Abrir WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3" />
                          WhatsApp
                        </a>
                      )}
                    </div>

                    {cliente.email && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-outline truncate" title={cliente.email}>
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          {cliente.email}
                        </span>
                        <a
                          href={`mailto:${cliente.email}`}
                          className="text-primary hover:underline text-[11px] shrink-0"
                        >
                          Enviar
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Observações */}
                  {cliente.observacoes && (
                    <div className="mt-2 text-xs bg-surface-container/60 text-outline p-2.5 rounded border border-outline-variant/40 line-clamp-2">
                      {cliente.observacoes}
                    </div>
                  )}
                </div>

                {/* Rodapé do card com estatísticas e botão de ação */}
                <div className="mt-4 pt-3 border-t border-outline-variant/50">
                  <div className="flex items-center justify-between text-xs mb-3 text-outline">
                    <span>
                      {stats.qtdPedidos} {stats.qtdPedidos === 1 ? 'pedido' : 'pedidos'}
                    </span>
                    <span className="font-medium text-on-surface">
                      R$ {stats.totalGasto.toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCriarOrcamento(cliente)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface hover:text-primary rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Criar Orçamento
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-surface border border-outline-variant rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-outline-variant">
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-outline hover:text-on-surface p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg">
                  {formError}
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-outline mb-1">
                  Nome Completo <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: João Silva ou Metalúrgica Delta"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              {/* Telefone */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-outline mb-1">
                  Telefone / WhatsApp <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="(00) 00000-0000"
                  value={formTelefone}
                  onChange={(e) => setFormTelefone(formatarTelefone(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-outline mb-1">
                  E-mail <span className="text-outline/60 lowercase">(opcional)</span>
                </label>
                <input
                  type="email"
                  placeholder="cliente@exemplo.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              {/* Cidade / UF */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-outline mb-1">
                  Cidade / UF <span className="text-outline/60 lowercase">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: São Paulo/SP"
                  value={formCidade}
                  onChange={(e) => setFormCidade(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-outline mb-1">
                  Observações <span className="text-outline/60 lowercase">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Preferência de filamento, regras de entrega, detalhes técnicos..."
                  value={formObservacoes}
                  onChange={(e) => setFormObservacoes(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-outline hover:text-on-surface rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-on-primary font-medium text-sm rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {editingCliente ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {clienteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-surface border border-outline-variant rounded-xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-on-surface">Excluir Cliente?</h3>
            <p className="text-sm text-outline mt-2">
              Deseja realmente remover <strong>{clienteToDelete.nome}</strong>? Os orçamentos existentes no histórico não serão apagados.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setClienteToDelete(null)}
                className="px-4 py-2 text-sm text-outline hover:text-on-surface rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
