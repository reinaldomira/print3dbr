import React, { useRef } from 'react';
import { X, Printer, DollarSign, Package, CreditCard, TrendingUp, PieChart, Layers, CheckCircle2 } from 'lucide-react';
import { ConsolidatedReportData } from '../utils/dateUtils';
import { Pedido } from '../types';
import { STATUS_LIST, getStatusConfig } from '../utils/statusUtils';
import { getStoredSettings } from '../utils/settingsStorage';

interface RelatorioModalProps {
  report: ConsolidatedReportData;
  pedidos: Pedido[];
  onClose: () => void;
}

export function RelatorioModal({ report, pedidos, onClose }: RelatorioModalProps) {
  const settings = getStoredSettings();
  const printRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePrint = () => {
    window.print();
  };

  // Status breakdown for filtered orders
  const statusBreakdown = STATUS_LIST.map((st) => {
    const count = pedidos.filter((p) => {
      const pStatus = p.status === 'aprovado' ? 'na_fila' : p.status || 'na_fila';
      return pStatus === st.key;
    }).length;

    return {
      ...st,
      count,
      percentage: pedidos.length > 0 ? (count / pedidos.length) * 100 : 0,
    };
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div 
        ref={printRef}
        className="bg-surface-container border border-outline-variant rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col print:border-none print:shadow-none print:max-h-none print:bg-white print:text-black print:w-full"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-outline-variant flex items-center justify-between sticky top-0 bg-surface-container/95 backdrop-blur z-10 print:static print:bg-white print:border-b-2 print:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-container text-on-primary-container rounded-xl shrink-0 print:hidden">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-mono font-bold text-on-surface print:text-black">
                  RELATÓRIO CONSOLIDADO
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary/20 text-primary border border-primary/30 print:border-gray-400 print:text-black">
                  {report.periodLabel.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-mono mt-0.5 print:text-gray-600">
                {settings.nomeEmpresa || 'Print_3dbr'} • Resumo financeiro e operacional de impressão 3D
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>IMPRIMIR / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-bright rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 print:p-0 print:mt-4">
          
          {/* Main KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Faturamento Total */}
            <div className="bg-surface-container-high border border-outline-variant p-4 rounded-xl print:border-gray-300 print:bg-gray-50">
              <div className="flex items-center justify-between text-on-surface-variant mb-2">
                <span className="text-xs font-mono uppercase font-bold text-on-surface-variant print:text-gray-700">Faturamento Total</span>
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg print:hidden">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-mono font-bold text-emerald-400 print:text-emerald-700">
                R$ {formatCurrency(report.faturamentoTotal)}
              </div>
              <div className="text-[11px] text-on-surface-variant font-mono mt-1">
                {report.totalFaturados} pedido(s) faturado(s)
              </div>
            </div>

            {/* Card 2: Peças Impressas */}
            <div className="bg-surface-container-high border border-outline-variant p-4 rounded-xl print:border-gray-300 print:bg-gray-50">
              <div className="flex items-center justify-between text-on-surface-variant mb-2">
                <span className="text-xs font-mono uppercase font-bold text-on-surface-variant print:text-gray-700">Itens / Peças 3D</span>
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg print:hidden">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-mono font-bold text-blue-400 print:text-blue-700">
                {report.totalPecasImpressas} <span className="text-sm font-normal text-on-surface-variant">unid.</span>
              </div>
              <div className="text-[11px] text-on-surface-variant font-mono mt-1">
                Produção total no período
              </div>
            </div>

            {/* Card 3: Ticket Médio */}
            <div className="bg-surface-container-high border border-outline-variant p-4 rounded-xl print:border-gray-300 print:bg-gray-50">
              <div className="flex items-center justify-between text-on-surface-variant mb-2">
                <span className="text-xs font-mono uppercase font-bold text-on-surface-variant print:text-gray-700">Ticket Médio</span>
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg print:hidden">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-mono font-bold text-cyan-400 print:text-cyan-700">
                R$ {formatCurrency(report.ticketMedio)}
              </div>
              <div className="text-[11px] text-on-surface-variant font-mono mt-1">
                Por venda faturada
              </div>
            </div>

            {/* Card 4: Pagamento Principal */}
            <div className="bg-surface-container-high border border-outline-variant p-4 rounded-xl print:border-gray-300 print:bg-gray-50">
              <div className="flex items-center justify-between text-on-surface-variant mb-2">
                <span className="text-xs font-mono uppercase font-bold text-on-surface-variant print:text-gray-700">Pagamento Principal</span>
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg print:hidden">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-mono font-bold text-purple-300 print:text-purple-800 truncate">
                {report.formaPagamentoMaisUsada ? report.formaPagamentoMaisUsada.label : 'N/A'}
              </div>
              <div className="text-[11px] text-on-surface-variant font-mono mt-1">
                {report.formaPagamentoMaisUsada ? `${report.formaPagamentoMaisUsada.percentage.toFixed(0)}% do faturamento` : 'Sem vendas'}
              </div>
            </div>
          </div>

          {/* Detailed Section Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Formas de Pagamento Breakdown */}
            <div className="bg-surface-container-high/60 border border-outline-variant rounded-xl p-5 print:border-gray-300 print:bg-white">
              <h4 className="text-sm font-mono font-bold text-on-surface uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-outline-variant pb-2 print:text-black">
                <CreditCard className="w-4 h-4 text-primary shrink-0" />
                <span>FORMAS DE PAGAMENTO UTILIZADAS</span>
              </h4>

              {report.paymentBreakdown.length === 0 ? (
                <p className="text-xs font-mono text-on-surface-variant py-4 text-center">Nenhuma venda registrada no período.</p>
              ) : (
                <div className="space-y-3">
                  {report.paymentBreakdown.map((item) => (
                    <div key={item.metodo} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="font-bold text-on-surface print:text-black">{item.label} ({item.count} pedido{item.count > 1 ? 's' : ''})</span>
                        <span className="font-bold text-emerald-400 print:text-emerald-800">
                          R$ {formatCurrency(item.total)} ({item.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden print:bg-gray-200">
                        <div 
                          className="bg-primary h-full rounded-full transition-all print:bg-blue-600" 
                          style={{ width: `${Math.max(4, item.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pipeline de Status de Produção */}
            <div className="bg-surface-container-high/60 border border-outline-variant rounded-xl p-5 print:border-gray-300 print:bg-white">
              <h4 className="text-sm font-mono font-bold text-on-surface uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-outline-variant pb-2 print:text-black">
                <Layers className="w-4 h-4 text-primary shrink-0" />
                <span>FLUXO DE PRODUÇÃO DO PERÍODO</span>
              </h4>

              <div className="grid grid-cols-2 gap-2">
                {statusBreakdown.map((st) => (
                  <div 
                    key={st.key}
                    className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between ${st.badgeClass}`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span>{st.emoji}</span>
                      <span className="truncate">{st.shortLabel}</span>
                    </div>
                    <span className="font-bold shrink-0">{st.count}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Top Peças Impressas */}
          {report.topItems.length > 0 && (
            <div className="bg-surface-container-high/60 border border-outline-variant rounded-xl p-5 print:border-gray-300 print:bg-white">
              <h4 className="text-sm font-mono font-bold text-on-surface uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-outline-variant pb-2 print:text-black">
                <Package className="w-4 h-4 text-primary shrink-0" />
                <span>MAIORES ITENS E PEÇAS FABRICADAS</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant uppercase text-[10px] print:border-gray-400">
                      <th className="py-2 px-2">Descrição da Peça</th>
                      <th className="py-2 px-2 text-center">Qtde Impressa</th>
                      <th className="py-2 px-2 text-right">Valor Total Gerado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40 print:divide-gray-200">
                    {report.topItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-bright/40">
                        <td className="py-2.5 px-2 font-medium text-on-surface print:text-black">{item.descricao}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-primary print:text-blue-800">{item.qtdTotal} un.</td>
                        <td className="py-2.5 px-2 text-right font-bold text-emerald-400 print:text-emerald-800">R$ {formatCurrency(item.valorTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="border-t border-outline-variant pt-4 flex justify-between items-center text-[11px] font-mono text-on-surface-variant print:text-gray-500">
            <span>Relatório gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span>{settings.nomeEmpresa || 'Print_3dbr'} - Sistema de Impressão 3D</span>
          </div>

        </div>
      </div>
    </div>
  );
}
