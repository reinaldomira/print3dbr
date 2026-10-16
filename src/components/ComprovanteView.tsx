import React, { useRef, useState, useEffect } from 'react';
import { Download, Printer, Share2, Send, ArrowLeft, Box, QrCode, Phone, Instagram, CheckCircle2, Loader2, Mail, Clock, Check, ChevronRight, Pencil } from 'lucide-react';
import { Pedido, PedidoStatus } from '../types';
import { getStoredSettings, SystemSettings } from '../utils/settingsStorage';
import { generatePedidoPDF, generatePedidoPDFFromElement } from '../utils/pdfGenerator';
import { updatePedidoStatus } from '../utils/ordersStorage';
import { STATUS_LIST, getStatusConfig } from '../utils/statusUtils';
import { EditPedidoModal } from './EditPedidoModal';
import { DocumentoOrcamento } from './DocumentoOrcamento';

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
      if (receiptRef.current) {
        await generatePedidoPDFFromElement(receiptRef.current, pedidoComStatusAtualizado);
      } else {
        await generatePedidoPDF(pedidoComStatusAtualizado);
      }
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
        <div className="flex-1 relative flex justify-center">
          <DocumentoOrcamento
            ref={receiptRef}
            pedido={{ ...activePedido, status: currentStatus }}
            settings={currentSettings}
          />

          {/* Floating Action Button "ENVIAR PARA CLIENTE" */}
          <div className="absolute bottom-6 right-6 print:hidden z-10">
            <button
              onClick={handleWhatsAppShare}
              className="bg-[#0066ff] hover:bg-[#0052cc] text-white font-bold px-6 py-3.5 rounded-xl shadow-xl flex items-center gap-2 text-sm transition-all transform hover:scale-105 active:scale-95 cursor-pointer font-mono"
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

