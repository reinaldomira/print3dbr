import React, { useRef, useState, useEffect } from 'react';
import { Download, Printer, Share2, Send, ArrowLeft, Box, QrCode, Phone, Instagram, CheckCircle2, Loader2, Mail, Clock, Check, ChevronRight, Pencil } from 'lucide-react';
import { Pedido, PedidoStatus } from '../types';
import { getStoredSettings, SystemSettings } from '../utils/settingsStorage';
import { generatePedidoPDF, generatePedidoPDFFromElement } from '../utils/pdfGenerator';
import { updatePedidoStatus } from '../utils/ordersStorage';
import { STATUS_LIST, getStatusConfig } from '../utils/statusUtils';
import { EditPedidoModal } from './EditPedidoModal';

interface ComprovanteViewProps {
  pedido: Pedido;
  onClose: () => void;
  onOrderUpdated?: (updated: Pedido) => void;
}

export function ComprovanteView({ pedido, onClose, onOrderUpdated }: ComprovanteViewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [activePedido, setActivePedido] = useState<Pedido>(pedido);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [currentStatus, setCurrentStatus] = useState<PedidoStatus>(pedido.status || 'na_fila');

  useEffect(() => {
    setActivePedido(pedido);
    setSettings(getStoredSettings());
    setCurrentStatus(pedido.status || 'na_fila');
  }, [pedido]);

  const currentSettings = settings || getStoredSettings();
  const accentColor = currentSettings.corPrincipal || '#0066ff';

  const handleStatusChange = (newStatus: PedidoStatus) => {
    updatePedidoStatus(activePedido.id, newStatus);
    setCurrentStatus(newStatus);
    const updated = { ...activePedido, status: newStatus };
    setActivePedido(updated);
    if (onOrderUpdated) {
      onOrderUpdated(updated);
    }
  };

  const handleApproveSale = () => {
    const updatedStatus: PedidoStatus = 'aprovado';
    updatePedidoStatus(activePedido.id, updatedStatus);
    setCurrentStatus(updatedStatus);
    const updated = { ...activePedido, status: updatedStatus };
    setActivePedido(updated);
    if (onOrderUpdated) {
      onOrderUpdated(updated);
    }
  };

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const pedidoComStatusAtualizado = { ...activePedido, status: currentStatus };
      generatePedidoPDF(pedidoComStatusAtualizado);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    } finally {
      setTimeout(() => setIsExporting(false), 500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const statusTxt = currentStatus === 'pendente' ? 'ORÇAMENTO (Aguardando Aprovação)' : 'COMPROVANTE DE VENDA FATURADA';
    const subtotalCalc = activePedido.itens.reduce((acc, i) => acc + (i.qtd * i.valorUnitario), 0);
    const pctLabel = activePedido.descontoPercentual ? ` (${activePedido.descontoPercentual}%)` : '';
    const descTxt = activePedido.desconto && activePedido.desconto > 0
      ? `*Subtotal:* R$ ${subtotalCalc.toFixed(2)}\n*Desconto${pctLabel}:* -R$ ${activePedido.desconto.toFixed(2)}\n`
      : '';

    const texto = `*${currentSettings.nomeEmpresa} - ${statusTxt} ${activePedido.id}*\n\n` +
      `*Cliente:* ${activePedido.cliente}\n` +
      `*Data:* ${activePedido.data}\n` +
      `*Status:* ${currentStatus === 'pendente' ? 'Aguardando Aprovação' : 'Faturado / Aprovado'}\n\n` +
      `*Itens:*\n` +
      activePedido.itens.map(i => `- ${i.qtd}x ${i.descricao}: R$ ${(i.qtd * i.valorUnitario).toFixed(2)}`).join('\n') +
      `\n\n${descTxt}*Total:* R$ ${activePedido.total.toFixed(2)}\n` +
      `*Pagamento:* ${activePedido.metodoPagamento.toUpperCase()}\n\n` +
      `${currentSettings.mensagemRodape}`;

    const encoded = encodeURIComponent(texto);
    const cleanPhone = activePedido.telefone ? activePedido.telefone.replace(/\D/g, '') : '';
    const url = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0f12]/90 backdrop-blur-sm overflow-y-auto flex flex-col items-center py-6 px-4 print:p-0 print:bg-white print:static">
      
      {/* Top Bar for Modal */}
      <div className="w-full max-w-[1000px] flex justify-between items-center mb-6 print:hidden">
        <div className="flex items-center text-sm text-on-surface-variant gap-2">
          <button onClick={onClose} className="hover:text-primary flex items-center gap-1 transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <span>/</span>
          <span>Pedidos</span>
          <span>/</span>
          <span className="text-on-surface font-semibold">{activePedido.id}</span>
        </div>

        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-amber-300 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shadow-sm"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>EDITAR PEDIDO</span>
        </button>
      </div>

      {/* Production Pipeline Selector */}
      <div className="w-full max-w-[1000px] mb-6 bg-surface-container border border-outline-variant rounded-lg p-4 print:hidden shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-outline-variant pb-2">
          <span className="text-xs font-mono font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
            <span>⚙️ FLUXO DE PRODUÇÃO DA OFICINA</span>
          </span>
          <span className="text-xs text-on-surface-variant font-mono">
            Clique no status para atualizar o pedido
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {STATUS_LIST.filter(s => s.key !== 'cancelado').map((st) => {
            const isActive = currentStatus === st.key;
            return (
              <button
                key={st.key}
                onClick={() => handleStatusChange(st.key)}
                className={`px-3 py-2 rounded-lg border text-xs font-bold font-mono transition-all flex flex-col items-center justify-center gap-1 cursor-pointer text-center ${
                  isActive 
                    ? `${st.badgeClass} ring-2 ring-primary scale-[1.02] shadow-md` 
                    : 'bg-surface-container-high/60 border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-bright'
                }`}
              >
                <span className="text-base">{st.emoji}</span>
                <span className="truncate w-full">{st.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full max-w-[1000px] flex flex-col md:flex-row gap-6 relative print:block print:w-full print:max-w-none">
        
        {/* Action Sidebar Left */}
        <div className="flex md:flex-col gap-3 print:hidden">
          <button
            onClick={() => setIsEditing(true)}
            className="flex-1 md:flex-initial flex flex-col items-center justify-center p-4 bg-surface-container border border-outline-variant hover:bg-surface-container-high rounded-lg text-amber-300 hover:text-amber-200 transition-all w-full md:w-28 group cursor-pointer"
          >
            <Pencil className="w-6 h-6 mb-2 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-mono tracking-wider text-center font-semibold">EDITAR</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex-1 md:flex-initial flex flex-col items-center justify-center p-4 bg-surface-container border border-outline-variant hover:bg-surface-container-high rounded-lg text-on-surface hover:text-primary transition-all w-full md:w-28 group disabled:opacity-50 cursor-pointer"
          >
            {isExporting ? (
              <Loader2 className="w-6 h-6 mb-2 text-primary animate-spin" />
            ) : (
              <Download className="w-6 h-6 mb-2 text-outline group-hover:text-primary transition-colors" />
            )}
            <span className="text-[11px] font-mono tracking-wider text-center font-semibold">
              {isExporting ? 'GERANDO...' : 'EXPORT PDF'}
            </span>
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 md:flex-initial flex flex-col items-center justify-center p-4 bg-surface-container border border-outline-variant hover:bg-surface-container-high rounded-lg text-on-surface hover:text-primary transition-all w-full md:w-28 group cursor-pointer"
          >
            <Printer className="w-6 h-6 mb-2 text-outline group-hover:text-primary transition-colors" />
            <span className="text-[11px] font-mono tracking-wider text-center font-semibold">IMPRIMIR</span>
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="flex-1 md:flex-initial flex flex-col items-center justify-center p-4 bg-surface-container border border-outline-variant hover:bg-surface-container-high rounded-lg text-on-surface hover:text-primary transition-all w-full md:w-28 group cursor-pointer"
          >
            <Share2 className="w-6 h-6 mb-2 text-outline group-hover:text-primary transition-colors" />
            <span className="text-[11px] font-mono tracking-wider text-center font-semibold">WHATSAPP</span>
          </button>
        </div>

        {/* Paper Document / Receipt View */}
        <div className="flex-1 relative">
          <div 
            ref={receiptRef}
            className="bg-white text-[#101417] p-8 md:p-12 rounded-lg shadow-2xl relative overflow-hidden font-sans border border-gray-200 print:shadow-none print:p-6 print:border-none print:rounded-none"
            style={{ color: '#101417' }}
          >
            {/* Background Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
              <span className="text-[100px] md:text-[120px] font-bold tracking-tighter text-black rotate-[-25deg] uppercase">
                {currentSettings.nomeEmpresa}
              </span>
            </div>

            {/* Header */}
            <div className="flex justify-between items-start pb-6 border-b-2 border-gray-900 mb-6">
              <div className="flex items-center gap-4">
                {currentSettings.logotipoUrl ? (
                  <div className="w-16 h-16 bg-white border border-gray-200 rounded p-1 flex items-center justify-center overflow-hidden shrink-0">
                    <img src={currentSettings.logotipoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="w-14 h-14 bg-[#101417] text-white rounded flex items-center justify-center shrink-0">
                    <Box className="w-8 h-8" style={{ color: accentColor }} />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">{currentSettings.nomeEmpresa}</h1>
                  <p className="text-xs font-mono tracking-wider text-gray-500 uppercase">{currentSettings.subtituloEmpresa}</p>
                </div>
              </div>

              <div className="text-right text-xs text-gray-600 font-mono space-y-1">
                {currentSettings.whatsapp && (
                  <div className="flex items-center justify-end gap-1">
                    <QrCode className="w-3.5 h-3.5 text-gray-400" />
                    <span>{currentSettings.whatsapp}</span>
                  </div>
                )}
                {currentSettings.instagram && (
                  <div className="flex items-center justify-end gap-1">
                    <Instagram className="w-3.5 h-3.5 text-gray-400" />
                    <span>{currentSettings.instagram}</span>
                  </div>
                )}
                {currentSettings.email && (
                  <div className="flex items-center justify-end gap-1">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span>{currentSettings.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Receipt Title */}
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-gray-900 border-b-2 border-gray-900 pb-1 inline-block uppercase">
                  {currentStatus === 'pendente' ? 'ORÇAMENTO DE VENDA' : 'COMPROVANTE DE VENDA'}
                </h2>
              </div>
              <div className="text-right">
                <span className="text-lg font-mono font-bold text-gray-900">{activePedido.id}</span>
                <p className="text-xs text-gray-500">{activePedido.data}</p>
              </div>
            </div>

            {/* Customer & Order Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Cliente */}
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  CLIENTE
                </span>
                <h3 className="text-base font-bold text-gray-900">{activePedido.cliente || 'Cliente não identificado'}</h3>
                <p className="text-xs text-gray-600 font-mono mt-0.5">{activePedido.telefone || '-'}</p>
              </div>

              {/* Status */}
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  STATUS DO PEDIDO
                </span>
                {(() => {
                  const statusInfo = getStatusConfig(currentStatus);
                  return (
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-sm text-gray-900">
                        <span>{statusInfo.emoji}</span>
                        <span>{statusInfo.label.toUpperCase()}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{statusInfo.description}</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-6 overflow-hidden border border-gray-200 rounded">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#101417] text-white font-mono uppercase text-[11px]">
                    <th className="py-3 px-4 font-semibold">DESCRIÇÃO</th>
                    <th className="py-3 px-4 font-semibold text-center w-16">QTD</th>
                    <th className="py-3 px-4 font-semibold text-right w-28">UNITÁRIO</th>
                    <th className="py-3 px-4 font-semibold text-right w-28">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {activePedido.itens.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/80">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {item.imagemUrl && (
                            <div className="w-12 h-12 rounded border border-gray-200 overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center">
                              <img src={item.imagemUrl} alt={item.descricao} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{item.descricao || 'Item impresso 3D'}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5 font-mono">
                              Impressão 3D Personalizada
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-gray-700">
                        {String(item.qtd).padStart(2, '0')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">
                        R$ {formatCurrency(item.valorUnitario)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        R$ {formatCurrency(item.qtd * item.valorUnitario)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Payment & Totals */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8 pt-2">
              {/* Left Column: Payment & Notes */}
              <div className="md:col-span-7 space-y-4">
                <div>
                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    MÉTODO DE PAGAMENTO
                  </span>
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                    <QrCode className="w-4 h-4 text-gray-600" />
                    <span>{activePedido.metodoPagamento.toUpperCase()} {currentSettings.chavePix && activePedido.metodoPagamento === 'pix' ? `(Chave: ${currentSettings.chavePix})` : ''}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    OBSERVAÇÕES
                  </span>
                  <p className="text-xs text-gray-600 leading-relaxed italic">
                    {activePedido.observacoes || currentSettings.observacoesPadrao}
                  </p>
                </div>
              </div>

              {/* Right Column: Totals */}
              <div className="md:col-span-5 flex flex-col justify-end space-y-2 text-xs">
                {(() => {
                  const subtotalItens = activePedido.itens.reduce((acc, it) => acc + (it.qtd * it.valorUnitario), 0);
                  const valorDesc = activePedido.desconto && activePedido.desconto > 0 ? activePedido.desconto : 0;
                  return (
                    <>
                      <div className="flex justify-between text-gray-600 font-mono">
                        <span>Subtotal</span>
                        <span>R$ {formatCurrency(subtotalItens)}</span>
                      </div>
                      {valorDesc > 0 && (
                        <div className="flex justify-between text-emerald-600 font-mono font-semibold">
                          <span>
                            Desconto{activePedido.descontoPercentual ? ` (${activePedido.descontoPercentual}%)` : ''}
                          </span>
                          <span>- R$ {formatCurrency(valorDesc)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-600 font-mono">
                        <span>Frete / Entrega</span>
                        <span>R$ 0,00</span>
                      </div>
                      <div 
                        className="text-white p-3 rounded flex justify-between items-center mt-2"
                        style={{ backgroundColor: '#101417', borderLeft: `4px solid ${accentColor}` }}
                      >
                        <span className="font-mono uppercase font-bold text-xs tracking-wider">TOTAL GERAL</span>
                        <span className="text-lg font-mono font-bold">R$ {formatCurrency(activePedido.total)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-gray-200 text-center space-y-2">
              <h4 className="text-sm font-bold text-gray-900">{currentSettings.mensagemRodape}</h4>
              <p className="text-[10px] text-gray-400 font-mono">
                Documento emitido por {currentSettings.nomeEmpresa}. É um recibo de prestação de serviços de impressão 3D.
              </p>
            </div>

          </div>

          {/* Floating Action Button "ENVIAR PARA CLIENTE" */}
          <div className="absolute bottom-6 right-6 print:hidden z-10">
            <button
              onClick={handleWhatsAppShare}
              className="bg-[#b3c5ff] hover:bg-[#dae1ff] text-[#001849] font-bold px-6 py-3.5 rounded-xl shadow-xl flex items-center gap-2 text-sm transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>ENVIAR PARA CLIENTE</span>
            </button>
          </div>

        </div>

      </div>

      {/* Edit Order Modal */}
      {isEditing && (
        <EditPedidoModal
          pedido={activePedido}
          onClose={() => setIsEditing(false)}
          onSave={(updated) => {
            setActivePedido(updated);
            setCurrentStatus(updated.status || 'na_fila');
            if (onOrderUpdated) {
              onOrderUpdated(updated);
            }
          }}
        />
      )}
    </div>
  );
}

