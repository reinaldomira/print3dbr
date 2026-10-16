import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  FileText, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  AlertTriangle,
  PackageCheck,
  DollarSign,
  ShoppingBag,
  FilterX,
  Download,
  Clock,
  CheckCircle2,
  Check,
  ChevronDown,
  PieChart,
  BarChart3,
  Pencil
} from 'lucide-react';
import { Pedido, PedidoStatus, Tab } from '../types';
import { ComprovanteView } from './ComprovanteView';
import { getStoredPedidos, deletePedido, updatePedidoStatus } from '../utils/ordersStorage';
import { generatePedidoPDF } from '../utils/pdfGenerator';
import { STATUS_LIST, getStatusConfig, isFaturadoStatus } from '../utils/statusUtils';
import { PeriodFilterType, isOrderInPeriod, calculateConsolidatedReport, ConsolidatedReportData } from '../utils/dateUtils';
import { RelatorioModal } from './RelatorioModal';
import { EditPedidoModal } from './EditPedidoModal';

interface PedidosProps {
  onNavigate?: (tab: Tab) => void;
}

export function Pedidos({ onNavigate }: PedidosProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [pedidoToDelete, setPedidoToDelete] = useState<Pedido | null>(null);
  
  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | PedidoStatus>('todos');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('todos');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Consolidated Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Load orders on mount and listen to updates
  useEffect(() => {
    const handleUpdate = () => {
      const data = getStoredPedidos();
      setPedidos(data);
    };
    handleUpdate();

    window.addEventListener('ordersUpdated', handleUpdate);
    return () => window.removeEventListener('ordersUpdated', handleUpdate);
  }, []);

  // Filtered orders logic
  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      const pStatus = p.status || 'na_fila';
      const normStatus = pStatus === 'aprovado' ? 'na_fila' : pStatus;

      // Status tab filter
      if (statusFilter !== 'todos' && normStatus !== statusFilter) return false;

      // Text search in ID, Client Name, Phone or Items description
      const searchLower = searchTerm.toLowerCase().trim();
      const matchId = p.id.toLowerCase().includes(searchLower);
      const matchCliente = p.cliente.toLowerCase().includes(searchLower);
      const matchTelefone = p.telefone ? p.telefone.toLowerCase().includes(searchLower) : false;
      const matchItens = p.itens.some(i => i.descricao.toLowerCase().includes(searchLower));
      
      const matchesSearch = !searchLower || matchId || matchCliente || matchTelefone || matchItens;

      // Period filtering
      const matchesPeriod = isOrderInPeriod(p.data, periodFilter, customStartDate, customEndDate);

      return matchesSearch && matchesPeriod;
    });
  }, [pedidos, searchTerm, statusFilter, periodFilter, customStartDate, customEndDate]);

  // Counts by status (based on filtered orders by period)
  const statusCounts = useMemo(() => {
    const counts: { [key: string]: number } = { todos: filteredPedidos.length };
    STATUS_LIST.forEach(s => counts[s.key] = 0);
    filteredPedidos.forEach(p => {
      const sKey = p.status || 'na_fila';
      const normKey = sKey === 'aprovado' ? 'na_fila' : sKey;
      if (counts[normKey] !== undefined) {
        counts[normKey]++;
      }
    });
    return counts;
  }, [filteredPedidos]);

  const pendentesCount = statusCounts['pendente'] || 0;
  const faturadosCount = useMemo(() => filteredPedidos.filter(p => isFaturadoStatus(p.status)).length, [filteredPedidos]);
  
  const faturamentoPendente = useMemo(() => {
    return filteredPedidos
      .filter(p => p.status === 'pendente')
      .reduce((acc, p) => acc + p.total, 0);
  }, [filteredPedidos]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredPedidos.length / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const currentPedidos = filteredPedidos.slice(startIndex, startIndex + itemsPerPage);

  // Summary Metrics (based on current period)
  const totalFaturado = useMemo(() => {
    return filteredPedidos
      .filter(p => isFaturadoStatus(p.status))
      .reduce((acc, p) => acc + p.total, 0);
  }, [filteredPedidos]);

  const ticketMedio = useMemo(() => {
    return faturadosCount > 0 ? totalFaturado / faturadosCount : 0;
  }, [faturadosCount, totalFaturado]);

  // Computed period label for the report
  const periodLabel = useMemo(() => {
    switch (periodFilter) {
      case 'hoje': return 'Hoje';
      case 'semana': return 'Esta Semana';
      case 'mes': return 'Este Mês';
      case 'mes_passado': return 'Mês Passado';
      case 'custom': 
        if (customStartDate || customEndDate) {
          return `Período (${customStartDate || 'Início'} até ${customEndDate || 'Fim'})`;
        }
        return 'Período Personalizado';
      default: return 'Todas as Datas';
    }
  }, [periodFilter, customStartDate, customEndDate]);

  const reportData = useMemo(() => {
    return calculateConsolidatedReport(filteredPedidos, periodLabel);
  }, [filteredPedidos, periodLabel]);

  const handleStatusChange = (id: string, newStatus: PedidoStatus, e?: React.ChangeEvent<HTMLSelectElement>) => {
    if (e) e.stopPropagation();
    const updated = updatePedidoStatus(id, newStatus);
    setPedidos(updated);
  };

  const handleDeleteConfirm = () => {
    if (!pedidoToDelete) return;
    const updated = deletePedido(pedidoToDelete.id);
    setPedidos(updated);
    setPedidoToDelete(null);
    if ((validCurrentPage - 1) * itemsPerPage >= updated.length && validCurrentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setPeriodFilter('todos');
    setCustomStartDate('');
    setCustomEndDate('');
    setStatusFilter('todos');
    setCurrentPage(1);
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-outline-variant pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-on-surface">Histórico de Vendas & Orçamentos</h1>
          <p className="text-on-surface-variant mt-1 text-sm">Gerencie pedidos, aprove orçamentos pendentes e fature vendas.</p>
        </div>
        
        {onNavigate && (
          <button 
            onClick={() => onNavigate('nova-nota')}
            className="bg-primary-container hover:bg-primary-fixed text-on-primary-container px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 text-sm transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>NOVA VENDA</span>
          </button>
        )}
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-on-surface-variant uppercase tracking-wider block">Total de Vendas</span>
            <span className="text-2xl font-bold text-on-surface mt-1 block">{pedidos.length}</span>
          </div>
          <div className="p-3 bg-surface-container rounded-lg border border-outline-variant text-primary">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-on-surface-variant uppercase tracking-wider block">Faturamento (Faturado)</span>
            <span className="text-2xl font-bold text-secondary-container mt-1 block">R$ {formatCurrency(totalFaturado)}</span>
          </div>
          <div className="p-3 bg-surface-container rounded-lg border border-outline-variant text-secondary-container">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className={`border rounded-lg p-4 flex items-center justify-between ${pendentesCount > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-surface-container-low border-outline-variant'}`}>
          <div>
            <span className="text-xs font-mono uppercase tracking-wider block text-amber-300">Aguardando Aprovação</span>
            <span className="text-2xl font-bold mt-1 block text-amber-200">{pendentesCount} ({`R$ ${formatCurrency(faturamentoPendente)}`})</span>
          </div>
          <div className="p-3 bg-amber-500/20 rounded-lg text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-on-surface-variant uppercase tracking-wider block">Ticket Médio</span>
            <span className="text-2xl font-bold text-on-surface mt-1 block">R$ {formatCurrency(ticketMedio)}</span>
          </div>
          <div className="p-3 bg-surface-container rounded-lg border border-outline-variant text-tertiary">
            <PackageCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-outline-variant pb-2 overflow-x-auto">
          <button
            onClick={() => { setStatusFilter('todos'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'todos'
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            TODOS OS PEDIDOS ({pedidos.length})
          </button>
          {STATUS_LIST.map((st) => {
            const isSelected = statusFilter === st.key;
            const count = statusCounts[st.key] || 0;
            return (
              <button
                key={st.key}
                onClick={() => { setStatusFilter(st.key); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                  isSelected
                    ? `${st.badgeClass} ring-1 ring-primary font-extrabold`
                    : 'bg-surface-container-high/60 text-on-surface-variant border border-transparent hover:border-outline-variant'
                }`}
              >
                <span>{st.emoji}</span>
                <span>{st.shortLabel.toUpperCase()} ({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Pesquisar por cliente, pedido # ou item..." 
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-9 pr-8 py-2 text-sm text-on-surface focus:border-primary-container focus:ring-1 focus:ring-primary-container placeholder-on-surface-variant transition-colors"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-0.5 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Select Period Filter */}
            <div className="relative w-full sm:w-[180px]">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4 pointer-events-none" />
              <select
                value={periodFilter}
                onChange={(e) => {
                  setPeriodFilter(e.target.value as PeriodFilterType);
                  setCurrentPage(1);
                }}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-9 pr-7 py-2 text-xs font-mono font-bold text-on-surface focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors appearance-none cursor-pointer"
              >
                <option value="todos" className="bg-[#191c1e] text-on-surface">TODAS AS DATAS</option>
                <option value="hoje" className="bg-[#191c1e] text-on-surface">HOJE</option>
                <option value="semana" className="bg-[#191c1e] text-on-surface">ESTA SEMANA</option>
                <option value="mes" className="bg-[#191c1e] text-on-surface">ESTE MÊS</option>
                <option value="mes_passado" className="bg-[#191c1e] text-on-surface">MÊS PASSADO</option>
                <option value="custom" className="bg-[#191c1e] text-on-surface">PERSONALIZADO</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
            </div>

            {/* Custom Date Inputs if Custom Selected */}
            {periodFilter === 'custom' && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:border-primary-container focus:ring-1 focus:ring-primary-container [color-scheme:dark]"
                  title="Data Inicial"
                />
                <span className="text-xs text-on-surface-variant font-mono">até</span>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:border-primary-container focus:ring-1 focus:ring-primary-container [color-scheme:dark]"
                  title="Data Final"
                />
              </div>
            )}

            {/* Clear Filters Button */}
            {(searchTerm || periodFilter !== 'todos' || statusFilter !== 'todos') && (
              <button 
                onClick={handleClearFilters}
                className="px-3 py-2 text-xs font-mono border border-outline-variant rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FilterX className="w-3.5 h-3.5" />
                <span>LIMPAR</span>
              </button>
            )}
          </div>

          {/* Consolidated Report Modal Trigger */}
          <button
            onClick={() => setShowReportModal(true)}
            className="px-4 py-2 bg-primary-container hover:bg-primary-fixed text-on-primary-container border border-primary/30 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shrink-0"
          >
            <PieChart className="w-4 h-4 text-primary" />
            <span>📊 RELATÓRIO CONSOLIDADO</span>
          </button>
        </div>
      </div>
      {/* Main Table */}
      <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-sm">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-[100px_1fr_140px_140px_110px_220px] gap-3 bg-surface-container-high px-6 py-3 border-b border-outline-variant text-xs font-mono uppercase tracking-wider text-on-surface-variant">
          <div>ID VENDA</div>
          <div>CLIENTE</div>
          <div>STATUS</div>
          <div>DATA</div>
          <div className="text-right">VALOR</div>
          <div className="text-right">AÇÕES</div>
        </div>

        {/* Table Content */}
        {currentPedidos.length > 0 ? (
          <div className="flex flex-col divide-y divide-outline-variant">
            {currentPedidos.map((venda) => {
              const isPendente = venda.status === 'pendente';
              return (
                <div 
                  key={venda.id} 
                  className="grid grid-cols-1 md:grid-cols-[100px_1fr_140px_140px_110px_220px] gap-2 md:gap-3 px-6 py-4 hover:bg-surface-container-high/60 transition-colors items-center"
                >
                  {/* ID */}
                  <div className="flex justify-between md:block text-sm font-mono font-bold text-primary">
                    <span className="md:hidden text-xs text-on-surface-variant font-normal">ID Venda:</span>
                    {venda.id}
                  </div>

                  {/* Cliente */}
                  <div className="flex justify-between md:block">
                    <span className="md:hidden text-xs text-on-surface-variant">Cliente:</span>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-primary-container text-on-primary-container shrink-0">
                        {venda.cliente.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-sm text-on-surface truncate">{venda.cliente}</div>
                        {venda.telefone && (
                          <div className="text-xs text-on-surface-variant font-mono">{venda.telefone}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex justify-between md:block">
                    <span className="md:hidden text-xs text-on-surface-variant">Status:</span>
                    {(() => {
                      const stCfg = getStatusConfig(venda.status);
                      const currentVal = (venda.status === 'aprovado' ? 'na_fila' : (venda.status || 'na_fila'));
                      return (
                        <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={currentVal}
                            onChange={(e) => handleStatusChange(venda.id, e.target.value as PedidoStatus, e)}
                            className={`appearance-none px-2.5 py-1 pr-6 rounded-lg text-xs font-bold font-mono border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary ${stCfg.badgeClass}`}
                          >
                            {STATUS_LIST.map((s) => (
                              <option key={s.key} value={s.key} className="bg-[#191c1e] text-on-surface font-sans py-1">
                                {s.emoji} {s.shortLabel}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-70" />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Data */}
                  <div className="flex justify-between md:block text-xs text-on-surface-variant">
                    <span className="md:hidden font-medium">Data:</span> 
                    <span className="truncate block">{venda.data}</span>
                  </div>

                  {/* Valor Total */}
                  <div className="flex justify-between md:justify-end md:block text-sm font-mono font-bold text-on-surface md:text-right">
                    <span className="md:hidden text-xs text-on-surface-variant font-normal">Valor:</span>
                    <div>R$ {formatCurrency(venda.total)}</div>
                    {venda.desconto && venda.desconto > 0 ? (
                      <div className="text-[10px] text-emerald-400 font-mono font-normal">
                        -R$ {formatCurrency(venda.desconto)} {venda.descontoPercentual ? `(${venda.descontoPercentual}%)` : 'desc.'}
                      </div>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end items-center gap-1.5 mt-2 md:mt-0 flex-wrap md:flex-nowrap">
                    {isPendente && (
                      <button 
                        onClick={(e) => handleStatusChange(venda.id, 'na_fila', e as any)}
                        title="Aprovar Orçamento e Avançar para Fila de Impressão"
                        className="flex items-center gap-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>APROVAR</span>
                      </button>
                    )}
                    <button 
                      onClick={() => setEditingPedido(venda)}
                      title="Editar Informações do Pedido"
                      className="flex items-center gap-1 px-2 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-md text-xs font-semibold hover:bg-amber-500/25 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>EDITAR</span>
                    </button>
                    <button 
                      onClick={() => setSelectedPedido(venda)}
                      title="Visualizar Comprovante / Orçamento"
                      className="flex items-center gap-1 px-2 py-1.5 bg-surface-container-high border border-outline-variant rounded-md text-xs font-semibold hover:bg-surface-bright transition-colors text-on-surface cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span>VER</span>
                    </button>
                    <button 
                      onClick={() => generatePedidoPDF(venda)}
                      title="Baixar PDF Directamente"
                      className="flex items-center gap-1 px-2 py-1.5 bg-primary-container text-on-primary-container rounded-md text-xs font-bold hover:bg-primary-fixed transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                    <button 
                      onClick={() => setPedidoToDelete(venda)}
                      title="Excluir Venda"
                      className="flex items-center justify-center w-7 h-7 border border-outline-variant rounded-md hover:bg-error-container hover:text-on-error-container hover:border-error transition-colors text-on-surface-variant cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-4 border border-outline-variant">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-on-surface">
              {searchTerm || periodFilter !== 'todos' || statusFilter !== 'todos'
                ? 'Nenhum pedido encontrado'
                : 'Nenhum pedido registrado ainda'}
            </h3>
            <p className="text-sm text-on-surface-variant max-w-md mt-1 mb-6">
              {searchTerm || periodFilter !== 'todos' || statusFilter !== 'todos'
                ? 'Nenhum resultado corresponde aos seus filtros de busca. Tente ajustar os termos ou limpar os filtros.'
                : 'Você ainda não registrou nenhuma venda ou orçamento. Clique no botão abaixo para criar seu primeiro pedido 3D.'}
            </p>
            {searchTerm || periodFilter !== 'todos' || statusFilter !== 'todos' ? (
              <button 
                onClick={handleClearFilters}
                className="px-4 py-2 bg-surface-container-high border border-outline-variant rounded-lg text-sm font-medium text-on-surface hover:bg-surface-bright transition-colors cursor-pointer"
              >
                Limpar Filtros
              </button>
            ) : (
              onNavigate && (
                <button 
                  onClick={() => onNavigate('nova-nota')}
                  className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-fixed transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Primeiro Pedido</span>
                </button>
              )
            )}
          </div>
        )}

        {/* Footer / Pagination */}
        {filteredPedidos.length > 0 && (
          <div className="bg-surface-container-low px-6 py-3 border-t border-outline-variant flex flex-col sm:flex-row justify-between items-center gap-2 text-on-surface-variant text-xs font-mono">
            <span>
              Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredPedidos.length)} de {filteredPedidos.length} pedidos
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-on-surface-variant mr-2">
                Página {validCurrentPage} de {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={validCurrentPage === 1}
                className="w-8 h-8 flex items-center justify-center border border-outline-variant rounded-md hover:bg-surface-bright transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={validCurrentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center border border-outline-variant rounded-md hover:bg-surface-bright transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PDF View Modal */}
      {selectedPedido && (
        <ComprovanteView 
          pedido={selectedPedido} 
          onClose={() => setSelectedPedido(null)}
          onOrderUpdated={(updated) => setSelectedPedido(updated)}
        />
      )}

      {/* Edit Order Modal */}
      {editingPedido && (
        <EditPedidoModal
          pedido={editingPedido}
          onClose={() => setEditingPedido(null)}
          onSave={(updated) => {
            if (selectedPedido?.id === updated.id) {
              setSelectedPedido(updated);
            }
          }}
        />
      )}

      {/* Consolidated Report Modal */}
      {showReportModal && (
        <RelatorioModal 
          report={reportData}
          pedidos={filteredPedidos}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {pedidoToDelete && (
        <div className="fixed inset-0 z-50 bg-[#0b0f12]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-error">
              <div className="p-3 bg-error-container/20 border border-error/30 rounded-lg text-error">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Confirmar Exclusão</h3>
                <p className="text-xs text-on-surface-variant">Esta ação não poderá ser desfeita.</p>
              </div>
            </div>

            <p className="text-sm text-on-surface-variant leading-relaxed">
              Deseja realmente remover o pedido <strong className="text-on-surface font-mono">{pedidoToDelete.id}</strong> do cliente <strong className="text-on-surface">{pedidoToDelete.cliente}</strong> no valor de <strong className="text-on-surface font-mono">R$ {formatCurrency(pedidoToDelete.total)}</strong>?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPedidoToDelete(null)}
                className="px-4 py-2 border border-outline-variant rounded-lg text-sm font-medium hover:bg-surface-container-high transition-colors text-on-surface cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-error text-on-error rounded-lg text-sm font-bold hover:bg-error/90 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
