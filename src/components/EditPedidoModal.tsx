import React, { useState } from 'react';
import { X, Save, User, Phone, Calendar, CreditCard, Plus, Trash2, Camera, FileText, Check, AlertCircle, Tag, Percent } from 'lucide-react';
import { Pedido, PedidoItem, PedidoStatus, PricingBreakdown } from '../types';
import { STATUS_LIST } from '../utils/statusUtils';
import { updatePedido } from '../utils/ordersStorage';
import { calculateSalePrice } from '../utils/pricingCalculator';
import { compressImage } from '../utils/imageUtils';

interface EditPedidoModalProps {
  pedido: Pedido;
  onClose: () => void;
  onSave?: (pedidoAtualizado: Pedido) => void;
}

export function EditPedidoModal({ pedido, onClose, onSave }: EditPedidoModalProps) {
  const [cliente, setCliente] = useState(pedido.cliente || '');
  const [telefone, setTelefone] = useState(pedido.telefone || '');
  const [data, setData] = useState(pedido.data || '');
  const [metodoPagamento, setMetodoPagamento] = useState(pedido.metodoPagamento || 'pix');
  const [status, setStatus] = useState<PedidoStatus>(pedido.status || 'na_fila');
  const [observacoes, setObservacoes] = useState(pedido.observacoes || '');
  
  const subtotalInicial = (pedido.itens || []).reduce((acc, it) => acc + (Number(it.qtd) || 0) * (Number(it.valorUnitario) || 0), 0);
  const initialPct = pedido.descontoPercentual !== undefined && pedido.descontoPercentual !== null
    ? Number(pedido.descontoPercentual)
    : (pedido.desconto && subtotalInicial > 0 ? Number(((pedido.desconto / subtotalInicial) * 100).toFixed(1)) : 0);

  const [tipoDesconto, setTipoDesconto] = useState<'porcentagem' | 'valor'>('porcentagem');
  const [descontoPercentual, setDescontoPercentual] = useState<number>(initialPct);
  const [descontoValorFixo, setDescontoValorFixo] = useState<number>(pedido.desconto || 0);
  
  const [itens, setItens] = useState<PedidoItem[]>(
    pedido.itens && pedido.itens.length > 0
      ? pedido.itens.map((it, idx) => ({ ...it, id: it.id || String(idx + 1) }))
      : [{ id: '1', descricao: '', qtd: 1, valorUnitario: 0 }]
  );

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddItem = () => {
    setItens(prev => [
      ...prev,
      {
        id: String(Date.now()),
        descricao: '',
        qtd: 1,
        valorUnitario: 0
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (itens.length <= 1) {
      setErrorMsg('O pedido deve conter pelo menos uma peça ou item.');
      return;
    }
    setErrorMsg(null);
    setItens(prev => prev.filter(i => i.id !== id));
  };

  const handleItemChange = (id: string, field: keyof PedidoItem, value: any) => {
    setItens(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleImageUpload = async (id: string, file: File) => {
    if (!file) return;
    try {
      setErrorMsg(null);
      const compressed = await compressImage(file, { maxDim: 800, maxBytes: 150 * 1024 });
      handleItemChange(id, 'imagemUrl', compressed);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao processar imagem da peça.');
    }
  };

  const subtotalCalculado = itens.reduce((acc, item) => {
    const q = Number(item.qtd) || 0;
    const v = Number(item.valorUnitario) || 0;
    return acc + (q * v);
  }, 0);

  const valorDescontoCalculado = tipoDesconto === 'porcentagem'
    ? (subtotalCalculado * (descontoPercentual || 0)) / 100
    : (descontoValorFixo || 0);

  const totalCalculado = Math.max(0, subtotalCalculado - valorDescontoCalculado);

  const totalPecas = itens.reduce((acc, item) => acc + (Number(item.qtd) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente.trim()) {
      setErrorMsg('Por favor, informe o nome do cliente.');
      return;
    }

    const itensValidos = itens.filter(i => i.descricao.trim().length > 0);
    if (itensValidos.length === 0) {
      setErrorMsg('Adicione a descrição de pelo menos um item.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const pct = tipoDesconto === 'porcentagem'
      ? Number(descontoPercentual) || 0
      : (subtotalCalculado > 0 ? Number(((descontoValorFixo / subtotalCalculado) * 100).toFixed(1)) : 0);

    let detalhesPrecificacao: PricingBreakdown | undefined = pedido.detalhesPrecificacao;
    if (pedido.custosFinanceiros) {
      const breakdown = calculateSalePrice({
        custoProducao: itensValidos.reduce((acc, it) => acc + (Number(it.qtd) || 0) * (Number(it.valorUnitario) || 0), 0),
        embalagem: pedido.custosFinanceiros.embalagem,
        outrosCustos: pedido.custosFinanceiros.outrosCustos,
        imposto: pedido.custosFinanceiros.imposto,
        taxaPagamento: pedido.custosFinanceiros.taxaPagamento,
        comissaoMarketplace: pedido.custosFinanceiros.comissaoMarketplace,
        margemLucro: pedido.custosFinanceiros.margemLucro,
        tipoDesconto,
        descontoPercentual: tipoDesconto === 'porcentagem' ? (Number(descontoPercentual) || 0) : undefined,
        descontoValorFixo: tipoDesconto === 'valor' ? (Number(descontoValorFixo) || 0) : undefined
      });
      detalhesPrecificacao = {
        ...breakdown,
        lucroLiquido: breakdown.lucroLiquido,
        margemEfetiva: breakdown.margemEfetiva,
        precoVenda: totalCalculado,
        precoBaseVenda: subtotalCalculado,
        descontoValor: Number(valorDescontoCalculado.toFixed(2)),
        descontoPercentual: pct,
        totalTaxasValor: breakdown.totalTaxasValor
      };
    }

    const pedidoAtualizado: Pedido = {
      ...pedido,
      cliente: cliente.trim(),
      telefone: telefone.trim(),
      data: data.trim() || pedido.data,
      metodoPagamento,
      status,
      observacoes: observacoes.trim(),
      desconto: valorDescontoCalculado > 0 ? Number(valorDescontoCalculado.toFixed(2)) : undefined,
      descontoPercentual: pct > 0 ? pct : undefined,
      itens: itensValidos.map(i => {
        const item: PedidoItem = {
          id: i.id,
          descricao: i.descricao.trim(),
          qtd: Number(i.qtd) > 0 ? Number(i.qtd) : 1,
          valorUnitario: Number(i.valorUnitario) >= 0 ? Number(i.valorUnitario) : 0
        };
        if (i.imagemUrl && i.imagemUrl.trim().length > 0) {
          item.imagemUrl = i.imagemUrl;
        }
        return item;
      }),
      total: totalCalculado,
      detalhesPrecificacao
    };

    try {
      updatePedido(pedidoAtualizado);
      if (onSave) {
        onSave(pedidoAtualizado);
      }
      onClose();
    } catch (err) {
      console.error('Erro ao atualizar pedido:', err);
      setErrorMsg('Erro ao salvar as alterações do pedido. Tente novamente.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0f12]/85 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-3 sm:p-4">
      <div className="bg-surface-container border border-outline-variant rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-high shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center font-mono font-bold text-sm">
              ✏️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-on-surface">Editar Pedido</h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-container-lowest text-primary border border-outline-variant">
                  {pedido.id}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Altere os dados do cliente, status, método de pagamento, itens ou fotos da peça.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          
          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg flex items-center gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Customer and Order Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            
            {/* Cliente */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono text-on-surface-variant mb-1.5 uppercase">
                Nome do Cliente / Empresa *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  type="text"
                  required
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            {/* Telefone */}
            <div>
              <label className="block text-xs font-mono text-on-surface-variant mb-1.5 uppercase">
                Telefone / WhatsApp
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            {/* Data e Hora */}
            <div>
              <label className="block text-xs font-mono text-on-surface-variant mb-1.5 uppercase">
                Data do Registro
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  type="text"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  placeholder="Ex: 25 de Outubro, 2023 - 14:30"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-mono text-xs"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-mono text-on-surface-variant mb-1.5 uppercase">
                Status Atual do Pedido
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PedidoStatus)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-mono text-xs"
              >
                {STATUS_LIST.map((s) => (
                  <option key={s.key} value={s.key} className="bg-[#191c1e] text-on-surface">
                    {s.emoji} {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Forma de Pagamento */}
            <div>
              <label className="block text-xs font-mono text-on-surface-variant mb-1.5 uppercase">
                Forma de Pagamento
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <select
                  value={metodoPagamento}
                  onChange={(e) => setMetodoPagamento(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-mono text-xs"
                >
                  <option value="pix" className="bg-[#191c1e] text-on-surface">PIX</option>
                  <option value="cartao" className="bg-[#191c1e] text-on-surface">Cartão de Crédito / Débito</option>
                  <option value="dinheiro" className="bg-[#191c1e] text-on-surface">Dinheiro</option>
                  <option value="boleto" className="bg-[#191c1e] text-on-surface">Boleto Bancário</option>
                  <option value="transferencia" className="bg-[#191c1e] text-on-surface">Transferência TED</option>
                </select>
              </div>
            </div>

          </div>

          {/* Section 2: Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono font-bold text-on-surface uppercase tracking-wider">
                  Itens e Peças de Impressão 3D
                </label>
                <span className="text-xs font-mono text-on-surface-variant">
                  ({itens.length} {itens.length === 1 ? 'item' : 'itens'} / {totalPecas} {totalPecas === 1 ? 'peça' : 'peças'})
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-surface-container-highest hover:bg-surface-bright text-primary border border-outline-variant rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADICIONAR PEÇA</span>
              </button>
            </div>

            <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface-container-low">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high border-b border-outline-variant">
                    <th className="text-[11px] font-mono text-on-surface-variant py-2.5 px-3 font-normal w-16 text-center">FOTO</th>
                    <th className="text-[11px] font-mono text-on-surface-variant py-2.5 px-4 font-normal">DESCRIÇÃO DA PEÇA / ARQUIVO</th>
                    <th className="text-[11px] font-mono text-on-surface-variant py-2.5 px-3 font-normal w-24 text-center">QTD</th>
                    <th className="text-[11px] font-mono text-on-surface-variant py-2.5 px-3 font-normal w-32 text-right">V. UNIT (R$)</th>
                    <th className="text-[11px] font-mono text-on-surface-variant py-2.5 px-3 font-normal w-28 text-right">SUBTOTAL</th>
                    <th className="text-[11px] font-mono text-on-surface-variant py-2.5 px-3 font-normal w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {itens.map((item) => {
                    const subtotal = (Number(item.qtd) || 0) * (Number(item.valorUnitario) || 0);
                    return (
                      <tr key={item.id} className="hover:bg-surface-container-high/40 transition-colors">
                        
                        {/* Foto */}
                        <td className="py-2.5 px-3 text-center align-middle">
                          {item.imagemUrl ? (
                            <div className="relative group w-12 h-12 mx-auto rounded border border-outline-variant overflow-hidden bg-surface-container shrink-0">
                              <img src={item.imagemUrl} alt="Foto do produto" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handleItemChange(item.id, 'imagemUrl', '')}
                                className="absolute inset-0 bg-black/75 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                title="Remover foto"
                              >
                                <X className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          ) : (
                            <label className="w-12 h-12 mx-auto rounded border border-dashed border-outline-variant hover:border-primary flex flex-col items-center justify-center cursor-pointer bg-surface-container-lowest hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-primary group">
                              <Camera className="w-4 h-4 text-on-surface-variant group-hover:text-primary" />
                              <span className="text-[9px] font-mono mt-0.5">+Foto</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleImageUpload(item.id, e.target.files[0]);
                                  }
                                }}
                              />
                            </label>
                          )}
                        </td>

                        {/* Descrição */}
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            required
                            value={item.descricao}
                            onChange={(e) => handleItemChange(item.id, 'descricao', e.target.value)}
                            placeholder="Ex: Suporte Articulado Câmera - PLA Preto"
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </td>

                        {/* Quantidade */}
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="1"
                            value={item.qtd}
                            onChange={(e) => handleItemChange(item.id, 'qtd', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1.5 text-sm text-center font-mono text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </td>

                        {/* Valor Unitário */}
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.valorUnitario}
                            onChange={(e) => handleItemChange(item.id, 'valorUnitario', parseFloat(e.target.value) || 0)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1.5 text-sm text-right font-mono text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </td>

                        {/* Subtotal */}
                        <td className="py-2.5 px-3 text-right font-mono text-sm font-bold text-on-surface">
                          R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Remove */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-on-surface-variant hover:text-red-400 p-1.5 rounded transition-colors cursor-pointer"
                            title="Excluir Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2.5: Resumo Financeiro & Desconto */}
          <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono font-bold uppercase text-on-surface">Desconto & Ajuste Financeiro</span>
              </div>

              {/* Alternador % ou R$ */}
              <div className="flex bg-surface-container-lowest rounded p-0.5 border border-outline-variant text-[11px] font-mono self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setTipoDesconto('porcentagem');
                    if (descontoValorFixo > 0 && subtotalCalculado > 0) {
                      setDescontoPercentual(Number(((descontoValorFixo / subtotalCalculado) * 100).toFixed(1)));
                    }
                  }}
                  className={`px-2.5 py-0.5 rounded cursor-pointer transition-colors ${
                    tipoDesconto === 'porcentagem'
                      ? 'bg-primary text-on-primary font-bold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  % Porcentagem
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipoDesconto('valor');
                    if (descontoPercentual > 0) {
                      setDescontoValorFixo(Number(((subtotalCalculado * descontoPercentual) / 100).toFixed(2)));
                    }
                  }}
                  className={`px-2.5 py-0.5 rounded cursor-pointer transition-colors ${
                    tipoDesconto === 'valor'
                      ? 'bg-primary text-on-primary font-bold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  R$ Reais
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div>
                <span className="block text-[11px] font-mono text-on-surface-variant uppercase">Subtotal dos Itens</span>
                <span className="text-base font-mono font-bold text-on-surface">
                  R$ {subtotalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="block text-[10px] text-on-surface-variant mt-0.5">{totalPecas} peça(s) no total</span>
              </div>

              <div className="space-y-1.5">
                {tipoDesconto === 'porcentagem' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <label htmlFor="desconto-percent-edit" className="text-[11px] font-mono text-on-surface-variant uppercase">
                        Desconto em %:
                      </label>
                      <div className="relative w-28">
                        <input
                          id="desconto-percent-edit"
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={descontoPercentual === 0 ? '' : descontoPercentual}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setDescontoPercentual(isNaN(val) || val < 0 ? 0 : Math.min(100, val));
                          }}
                          placeholder="0"
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-2 pr-6 py-1 text-right text-xs font-mono font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">%</span>
                      </div>
                    </div>

                    {/* Botões Rápidos */}
                    <div className="grid grid-cols-4 gap-1">
                      {[5, 10, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDescontoPercentual(pct)}
                          className={`py-0.5 px-1 rounded text-[11px] font-mono font-bold border transition-colors cursor-pointer text-center ${
                            descontoPercentual === pct
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-surface-container-lowest border-outline-variant text-on-surface hover:bg-surface-bright'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <label htmlFor="desconto-valor-edit" className="text-[11px] font-mono text-on-surface-variant uppercase">
                      Desconto em R$:
                    </label>
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-on-surface-variant">R$</span>
                      <input
                        id="desconto-valor-edit"
                        type="number"
                        min="0"
                        step="0.50"
                        value={descontoValorFixo === 0 ? '' : descontoValorFixo}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setDescontoValorFixo(isNaN(val) || val < 0 ? 0 : val);
                        }}
                        placeholder="0,00"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-8 pr-2.5 py-1 text-right text-xs font-mono font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-outline-variant">
                <span className="block text-[11px] font-mono text-on-surface-variant uppercase">Total Líquido Recalculado</span>
                <span className="text-xl font-mono font-bold text-primary">
                  R$ {totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {valorDescontoCalculado > 0 && (
                  <span className="block text-[11px] font-mono text-emerald-400">
                    - R$ {valorDescontoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({tipoDesconto === 'porcentagem' ? `${descontoPercentual}%` : `${subtotalCalculado > 0 ? ((descontoValorFixo / subtotalCalculado) * 100).toFixed(1) : 0}%`})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Observações */}
          <div>
            <label className="block text-xs font-mono text-on-surface-variant mb-1.5 uppercase">
              Observações Técnicas / Detalhes de Impressão
            </label>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Material PETG, resolução 0.16mm, 4 perímetros, preenchimento 30% giroide. Entrega agendada para sexta-feira."
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
            />
          </div>

        </form>

        {/* Footer with Total and Save Actions */}
        <div className="px-6 py-4 bg-surface-container-high border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-on-surface-variant uppercase">VALOR TOTAL RECALCULADO:</span>
            <span className="text-xl font-mono font-bold text-primary">
              R$ {totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {valorDescontoCalculado > 0 && (
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                -R$ {valorDescontoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({tipoDesconto === 'porcentagem' ? `${descontoPercentual}%` : `${subtotalCalculado > 0 ? ((descontoValorFixo / subtotalCalculado) * 100).toFixed(1) : 0}%`})
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-surface-container border border-outline-variant hover:bg-surface-bright text-on-surface rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer"
            >
              CANCELAR
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 sm:flex-none px-6 py-2 bg-primary hover:bg-primary-fixed text-on-primary font-mono text-xs font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
