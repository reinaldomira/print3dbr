import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  Package, 
  AlignLeft, 
  CreditCard, 
  Plus, 
  Trash2, 
  FileText, 
  Eraser, 
  RotateCcw, 
  ListFilter, 
  Camera, 
  X, 
  Percent, 
  Calculator, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  TrendingUp, 
  SlidersHorizontal, 
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Pedido, PedidoItem, PedidoStatus, Tab, FinancialConfig, PricingBreakdown } from '../types';
import { ComprovanteView } from './ComprovanteView';
import { savePedido } from '../utils/ordersStorage';
import { getStoredSettings } from '../utils/settingsStorage';
import { STATUS_LIST } from '../utils/statusUtils';
import { calculateSalePrice, sanitizeNumeric } from '../utils/pricingCalculator';

interface NovaNotaProps {
  onNavigate?: (tab: Tab) => void;
}

export function NovaNota({ onNavigate }: NovaNotaProps) {
  const [cliente, setCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState<'pix' | 'cartao' | 'dinheiro' | 'outro'>('pix');
  const [statusInicial, setStatusInicial] = useState<PedidoStatus>('na_fila');
  
  // Desconto
  const [tipoDesconto, setTipoDesconto] = useState<'porcentagem' | 'valor'>('porcentagem');
  const [descontoPercentual, setDescontoPercentual] = useState<number>(0);
  const [descontoValorFixo, setDescontoValorFixo] = useState<number>(0);
  
  // Configurações Financeiras do Orçamento Atual (não alteram as globais)
  const [imposto, setImposto] = useState<number>(0);
  const [taxaPagamento, setTaxaPagamento] = useState<number>(0);
  const [comissaoMarketplace, setComissaoMarketplace] = useState<number>(0);
  const [embalagem, setEmbalagem] = useState<number>(0);
  const [outrosCustos, setOutrosCustos] = useState<number>(0);
  const [margemLucro, setMargemLucro] = useState<number>(40);

  // Estados Visuais
  const [secaoCustosAberta, setSecaoCustosAberta] = useState<boolean>(true);
  const [modalSimulacaoAberto, setModalSimulacaoAberto] = useState<boolean>(false);
  const [pedidoGerado, setPedidoGerado] = useState<Pedido | null>(null);

  // Carrega configurações globais como valores iniciais
  const loadSettings = () => {
    const settings = getStoredSettings();
    if (!observacoes) {
      setObservacoes(settings.observacoesPadrao || 'Peças produzidas com precisão de 0.12mm. Recomendado evitar exposição solar direta prolongada.');
    }
    setImposto(typeof settings.impostoPadrao === 'number' ? settings.impostoPadrao : 0);
    setTaxaPagamento(typeof settings.taxaPagamentoPadrao === 'number' ? settings.taxaPagamentoPadrao : 0);
    setComissaoMarketplace(typeof settings.comissaoMarketplacePadrao === 'number' ? settings.comissaoMarketplacePadrao : 0);
    setEmbalagem(typeof settings.embalagemPadrao === 'number' ? settings.embalagemPadrao : 0);
    setOutrosCustos(typeof settings.outrosCustosPadrao === 'number' ? settings.outrosCustosPadrao : 0);
    setMargemLucro(typeof settings.margemLucroPadrao === 'number' ? settings.margemLucroPadrao : 40);
  };

  useEffect(() => {
    loadSettings();
    window.addEventListener('settingsUpdated', loadSettings);
    return () => window.removeEventListener('settingsUpdated', loadSettings);
  }, []);

  // Itens do Pedido começam sem dados fictícios
  const [itens, setItens] = useState<PedidoItem[]>([
    { id: crypto.randomUUID(), descricao: '', qtd: 1, valorUnitario: 0.00 }
  ]);

  // Custo de produção = soma dos itens
  const custoProducao = itens.reduce((acc, item) => acc + (item.qtd * item.valorUnitario), 0);
  const totalPecas = itens.reduce((acc, item) => acc + (Number(item.qtd) || 1), 0);

  // Executa o cálculo central de precificação integrando formação de preço e desconto comercial
  const pricing = useMemo(() => {
    return calculateSalePrice({
      custoProducao,
      embalagem,
      outrosCustos,
      imposto,
      taxaPagamento,
      comissaoMarketplace,
      margemLucro,
      tipoDesconto,
      descontoPercentual,
      descontoValorFixo
    });
  }, [custoProducao, embalagem, outrosCustos, imposto, taxaPagamento, comissaoMarketplace, margemLucro, tipoDesconto, descontoPercentual, descontoValorFixo]);

  const totalTaxas = pricing.totalTaxasPercentual;
  const isTaxError = totalTaxas >= 100;

  // Preço de venda base antes do desconto comercial
  const precoBaseVenda = pricing.precoBaseVenda;

  // Desconto comercial calculado pelo motor
  const valorDesconto = pricing.descontoValor;

  // Preço final cobrado do cliente
  const totalFinal = pricing.totalFinal;
  const precoUnitarioMedio = totalPecas > 0 ? (totalFinal / totalPecas) : 0;

  // Lucro líquido real (sem limitação a zero: reflete prejuízo se o desconto for excessivo)
  const lucroLiquidoReal = pricing.lucroLiquido;
  // Margem efetiva sobre a venda (base: total final cobrado)
  const margemEfetivaReal = pricing.margemEfetiva;

  const handleAddItem = () => {
    setItens([...itens, { id: crypto.randomUUID(), descricao: '', qtd: 1, valorUnitario: 0.00 }]);
  };

  const handleRemoveItem = (id: string) => {
    if (itens.length === 1) return;
    setItens(itens.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof PedidoItem, value: string | number) => {
    setItens(itens.map(item => {
      if (item.id === id) {
        if (field === 'qtd') {
          const parsed = parseInt(value as string);
          return { ...item, [field]: isNaN(parsed) ? 1 : Math.max(1, parsed) };
        }
        if (field === 'valorUnitario') {
          const strValue = String(value).replace(',', '.');
          const numValue = parseFloat(strValue);
          return { ...item, [field]: isNaN(numValue) ? 0 : Math.max(0, numValue) };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleImageUpload = (id: string, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          handleItemChange(id, 'imagemUrl', compressed);
        } else {
          handleItemChange(id, 'imagemUrl', e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleRestaurarPadroesOrcamento = () => {
    const settings = getStoredSettings();
    setImposto(typeof settings.impostoPadrao === 'number' ? settings.impostoPadrao : 0);
    setTaxaPagamento(typeof settings.taxaPagamentoPadrao === 'number' ? settings.taxaPagamentoPadrao : 0);
    setComissaoMarketplace(typeof settings.comissaoMarketplacePadrao === 'number' ? settings.comissaoMarketplacePadrao : 0);
    setEmbalagem(typeof settings.embalagemPadrao === 'number' ? settings.embalagemPadrao : 0);
    setOutrosCustos(typeof settings.outrosCustosPadrao === 'number' ? settings.outrosCustosPadrao : 0);
    setMargemLucro(typeof settings.margemLucroPadrao === 'number' ? settings.margemLucroPadrao : 40);
  };

  const handleLimpar = () => {
    setCliente('');
    setTelefone('');
    setObservacoes('');
    setMetodoPagamento('pix');
    setTipoDesconto('porcentagem');
    setDescontoPercentual(0);
    setDescontoValorFixo(0);
    handleRestaurarPadroesOrcamento();
    setItens([{ id: crypto.randomUUID(), descricao: '', qtd: 1, valorUnitario: 0.00 }]);
  };

  const handleGerarPDF = () => {
    if (isTaxError) {
      alert('As taxas somadas não podem ser iguais ou superiores a 100%. Por favor, corrija os valores antes de gerar.');
      return;
    }

    const hoje = new Date();
    const dataFormatada = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) + ' - ' + hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    const pct = pricing.descontoPercentual;

    // Ajusta o valor unitário dos itens para o valor de venda de tabela ao cliente no comprovante (antes do desconto comercial)
    const fatorVenda = custoProducao > 0 ? (pricing.precoBaseVenda / custoProducao) : 1;
    const itensComPrecoVenda = itens.map(item => ({
      ...item,
      valorUnitario: Number((item.valorUnitario * fatorVenda).toFixed(2))
    }));

    const custosFinanceiros: FinancialConfig = {
      imposto,
      taxaPagamento,
      comissaoMarketplace,
      embalagem,
      outrosCustos,
      margemLucro
    };

    const detalhesPrecificacao: PricingBreakdown = {
      ...pricing,
      lucroLiquido: pricing.lucroLiquido,
      margemEfetiva: pricing.margemEfetiva,
      precoVenda: pricing.totalFinal,
      precoBaseVenda: pricing.precoBaseVenda,
      descontoValor: pricing.descontoValor,
      descontoPercentual: pricing.descontoPercentual,
      totalTaxasValor: pricing.totalTaxasValor
    };

    const novoPedido: Pedido = {
      id: `#${Math.floor(100000 + Math.random() * 900000)}`,
      cliente: cliente.trim() || 'Cliente',
      telefone: telefone.trim(),
      itens: itensComPrecoVenda,
      observacoes,
      metodoPagamento,
      status: statusInicial,
      data: dataFormatada,
      desconto: pricing.descontoValor > 0 ? pricing.descontoValor : undefined,
      descontoPercentual: pct > 0 ? pct : undefined,
      total: pricing.totalFinal,
      custosFinanceiros,
      detalhesPrecificacao
    };

    savePedido(novoPedido);
    setPedidoGerado(novoPedido);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 border-b border-outline-variant pb-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-on-surface">Novo Orçamento / Venda</h2>
          <p className="text-on-surface-variant mt-1 text-sm">
            Calcule o preço ideal de venda considerando custos de produção, impostos, taxas e lucro líquido garantido.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => setModalSimulacaoAberto(true)}
            className="px-3.5 py-2 bg-primary/10 border border-primary/30 hover:bg-primary/20 text-primary rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>SIMULAR PREÇO</span>
          </button>

          {onNavigate && (
            <button 
              onClick={() => onNavigate('pedidos')}
              className="px-4 py-2 bg-surface-container-high border border-outline-variant rounded-lg text-xs font-mono font-bold text-on-surface hover:bg-surface-bright flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ListFilter className="w-4 h-4 text-primary" />
              <span>HISTÓRICO</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Formulário Principal */}
        <div className="lg:col-span-8 space-y-5">
          {/* Dados do Cliente */}
          <section className="bg-surface border border-outline-variant rounded-lg p-6">
            <h3 className="text-sm font-medium text-primary mb-4 flex items-center uppercase tracking-wider">
              <User className="mr-2 w-5 h-5" />
              Dados do Cliente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-mono text-on-surface-variant mb-1">NOME DO CLIENTE</label>
                <input 
                  className="rounded px-3 py-2 bg-surface-container-highest border border-outline-variant text-sm text-on-surface focus:border-primary-container focus:ring-1 focus:ring-primary-container" 
                  placeholder="Ex: João da Silva" 
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-mono text-on-surface-variant mb-1">TELEFONE</label>
                <input 
                  className="rounded px-3 py-2 bg-surface-container-highest border border-outline-variant text-sm text-on-surface focus:border-primary-container focus:ring-1 focus:ring-primary-container font-mono" 
                  placeholder="(00) 00000-0000" 
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Itens do Pedido (Custos de Produção) */}
          <section className="bg-surface border border-outline-variant rounded-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container/50">
              <div>
                <h3 className="text-sm font-medium text-primary flex items-center uppercase tracking-wider">
                  <Package className="mr-2 w-5 h-5" />
                  Peças & Custos de Produção
                </h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Informe o custo direto de fabricação da peça (filamento, energia e tempo de máquina)
                </p>
              </div>
              <button 
                onClick={handleAddItem}
                className="bg-primary-container hover:bg-primary-fixed text-on-primary-container px-3 py-1.5 rounded flex items-center text-sm font-medium transition-colors cursor-pointer"
              >
                <Plus className="mr-1 w-4 h-4" />
                Adicionar Peça
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high border-b border-outline-variant">
                    <th className="text-xs font-mono text-on-surface-variant py-2.5 px-3 font-normal w-16 text-center">FOTO</th>
                    <th className="text-xs font-mono text-on-surface-variant py-2.5 px-4 font-normal">PEÇA / DESCRIÇÃO</th>
                    <th className="text-xs font-mono text-on-surface-variant py-2.5 px-4 font-normal w-24">QTD</th>
                    <th className="text-xs font-mono text-on-surface-variant py-2.5 px-4 font-normal w-32">CUSTO UNIT (R$)</th>
                    <th className="text-xs font-mono text-on-surface-variant py-2.5 px-4 font-normal w-32">SUBTOTAL (R$)</th>
                    <th className="text-xs font-mono text-on-surface-variant py-2.5 px-4 font-normal w-12 text-center">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => (
                    <tr key={item.id} className="border-b border-outline-variant hover:bg-surface-container-lowest transition-colors">
                      <td className="py-2 px-3 text-center align-middle">
                        {item.imagemUrl ? (
                          <div className="relative group w-12 h-12 mx-auto rounded border border-outline-variant overflow-hidden bg-surface-container shrink-0">
                            <img src={item.imagemUrl} alt="Foto do produto" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleItemChange(item.id, 'imagemUrl', '')}
                              className="absolute inset-0 bg-black/70 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
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
                      <td className="py-3 px-4">
                        <input 
                          className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium text-on-surface" 
                          type="text" 
                          placeholder="Nome da peça..."
                          value={item.descricao}
                          onChange={(e) => handleItemChange(item.id, 'descricao', e.target.value)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input 
                          className="w-full bg-surface-container-highest/60 border border-outline-variant rounded px-2 py-1 text-xs font-mono font-bold text-on-surface focus:ring-1 focus:ring-primary-container" 
                          min="1" 
                          type="number" 
                          value={item.qtd}
                          onChange={(e) => handleItemChange(item.id, 'qtd', e.target.value)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input 
                          className="w-full bg-surface-container-highest/60 border border-outline-variant rounded px-2 py-1 text-xs font-mono font-bold text-on-surface focus:ring-1 focus:ring-primary-container" 
                          type="text" 
                          placeholder="0,00"
                          value={item.valorUnitario === 0 ? '' : item.valorUnitario}
                          onChange={(e) => handleItemChange(item.id, 'valorUnitario', e.target.value)}
                        />
                      </td>
                      <td className="py-3 px-4 text-on-surface font-mono text-sm font-semibold">
                        R$ {formatCurrency(item.qtd * item.valorUnitario)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={itens.length === 1}
                          className="text-on-surface-variant hover:text-error transition-colors disabled:opacity-30 cursor-pointer"
                          title="Remover peça"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totalizador de Custo de Produção */}
            <div className="bg-surface-container-high/60 px-6 py-3 border-t border-outline-variant flex justify-between items-center text-xs font-mono">
              <span className="text-on-surface-variant uppercase font-medium">
                Total de peças: <strong className="text-on-surface">{totalPecas} {totalPecas === 1 ? 'unidade' : 'unidades'}</strong>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant uppercase">Custo Total de Produção:</span>
                <span className="text-sm font-bold text-on-surface">R$ {formatCurrency(custoProducao)}</span>
              </div>
            </div>
          </section>

          {/* NOVA SEÇÃO: Custos adicionais (Recolhível para visual limpo) */}
          <section className="bg-surface border border-outline-variant rounded-lg overflow-hidden transition-all shadow-sm">
            <div 
              onClick={() => setSecaoCustosAberta(!secaoCustosAberta)}
              className="px-6 py-4 bg-surface-container/70 border-b border-outline-variant flex items-center justify-between cursor-pointer hover:bg-surface-container transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <Calculator className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                    Custos adicionais
                    <span className="text-[10px] font-mono font-normal normal-case px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      Imposto: {imposto}% | Taxa: {taxaPagamento}% | Mkt: {comissaoMarketplace}% | Emb: R$ {embalagem.toFixed(2)}
                    </span>
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Personalize para este orçamento. Alterar aqui NÃO modifica as configurações padrão.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestaurarPadroesOrcamento();
                  }}
                  title="Restaurar valores padrão definidos nos Ajustes"
                  className="px-2.5 py-1 text-[11px] font-mono text-on-surface-variant hover:text-on-surface border border-outline-variant hover:bg-surface-container-highest rounded flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar Padrões</span>
                </button>

                {secaoCustosAberta ? (
                  <ChevronUp className="w-5 h-5 text-on-surface-variant" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-on-surface-variant" />
                )}
              </div>
            </div>

            {secaoCustosAberta && (
              <div className="p-6 space-y-5 animate-in fade-in duration-200">
                {/* 6 Campos Principais */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Imposto */}
                  <div className="flex flex-col gap-1 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-mono font-bold text-on-surface">Imposto</label>
                      <span className="text-[10px] text-primary font-mono font-bold">% venda</span>
                    </div>
                    <div className="relative mt-1">
                      <input 
                        type="number"
                        min="0"
                        max="99"
                        step="0.1"
                        value={imposto === 0 ? '' : imposto}
                        onChange={(e) => setImposto(sanitizeNumeric(e.target.value))}
                        placeholder="0"
                        className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface pr-7 focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">%</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant mt-0.5">Imposto sobre a venda</span>
                  </div>

                  {/* Taxa de Pagamento */}
                  <div className="flex flex-col gap-1 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-mono font-bold text-on-surface">Taxa de pagamento</label>
                      <span className="text-[10px] text-primary font-mono font-bold">% canal</span>
                    </div>
                    <div className="relative mt-1">
                      <input 
                        type="number"
                        min="0"
                        max="99"
                        step="0.01"
                        value={taxaPagamento === 0 ? '' : taxaPagamento}
                        onChange={(e) => setTaxaPagamento(sanitizeNumeric(e.target.value))}
                        placeholder="0"
                        className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface pr-7 focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">%</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant mt-0.5">Taxa de cartão, Pix ou intermediador</span>
                  </div>

                  {/* Marketplace */}
                  <div className="flex flex-col gap-1 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-mono font-bold text-on-surface">Marketplace</label>
                      <span className="text-[10px] text-primary font-mono font-bold">% comissão</span>
                    </div>
                    <div className="relative mt-1">
                      <input 
                        type="number"
                        min="0"
                        max="99"
                        step="0.5"
                        value={comissaoMarketplace === 0 ? '' : comissaoMarketplace}
                        onChange={(e) => setComissaoMarketplace(sanitizeNumeric(e.target.value))}
                        placeholder="0"
                        className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface pr-7 focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">%</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant mt-0.5">Shopee, Mercado Livre, etc.</span>
                  </div>

                  {/* Embalagem */}
                  <div className="flex flex-col gap-1 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-mono font-bold text-on-surface">Embalagem</label>
                      <span className="text-[10px] text-secondary font-mono font-bold">R$ fixo</span>
                    </div>
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">R$</span>
                      <input 
                        type="number"
                        min="0"
                        step="0.50"
                        value={embalagem === 0 ? '' : embalagem}
                        onChange={(e) => setEmbalagem(sanitizeNumeric(e.target.value))}
                        placeholder="0,00"
                        className="w-full bg-surface-container border border-outline-variant rounded pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <span className="text-[10px] text-on-surface-variant mt-0.5">Caixas, plástico bolha, fitas</span>
                  </div>

                  {/* Outros custos */}
                  <div className="flex flex-col gap-1 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-mono font-bold text-on-surface">Outros custos</label>
                      <span className="text-[10px] text-secondary font-mono font-bold">R$ fixo</span>
                    </div>
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">R$</span>
                      <input 
                        type="number"
                        min="0"
                        step="0.50"
                        value={outrosCustos === 0 ? '' : outrosCustos}
                        onChange={(e) => setOutrosCustos(sanitizeNumeric(e.target.value))}
                        placeholder="0,00"
                        className="w-full bg-surface-container border border-outline-variant rounded pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <span className="text-[10px] text-on-surface-variant mt-0.5">Custos extras deste pedido</span>
                  </div>

                  {/* Lucro sobre o custo (markup) */}
                  <div className="flex flex-col gap-1 bg-primary/5 p-3 rounded-lg border border-primary/30">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-mono font-bold text-primary">Lucro sobre o custo</label>
                      <span className="text-[10px] text-primary font-mono font-bold">% sobre custo</span>
                    </div>
                    <div className="relative mt-1">
                      <input 
                        type="number"
                        min="0"
                        max="1000"
                        step="1"
                        value={margemLucro === 0 ? '' : margemLucro}
                        onChange={(e) => setMargemLucro(sanitizeNumeric(e.target.value, 40))}
                        placeholder="40"
                        className="w-full bg-surface-container border border-primary/40 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface pr-7 focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-primary font-bold">%</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant mt-0.5">Percentual aplicado sobre os custos para formar o preço</span>
                  </div>
                </div>

                {/* Validação de Taxas >= 100% */}
                {isTaxError && (
                  <div className="p-3.5 rounded-lg bg-error/15 border border-error/40 text-error flex items-center gap-3 text-xs font-mono">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                      <strong className="block text-sm">Erro no cálculo:</strong>
                      As taxas não podem ser iguais ou superiores a 100%. (Soma atual: {totalTaxas}%)
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Observações */}
          <section className="bg-surface border border-outline-variant rounded-lg p-6">
            <h3 className="text-sm font-medium text-primary mb-4 flex items-center uppercase tracking-wider">
              <AlignLeft className="mr-2 w-5 h-5" />
              Observações do Documento
            </h3>
            <textarea 
              className="w-full rounded p-3 h-24 resize-none bg-surface-container-highest border border-outline-variant text-sm text-on-surface focus:border-primary-container focus:ring-1 focus:ring-primary-container" 
              placeholder="Detalhes adicionais, prazo de entrega, cor do filamento..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            ></textarea>
          </section>
        </div>

        {/* Coluna Direita: Resumo do Orçamento e Pagamento */}
        <div className="lg:col-span-4 space-y-5">
          <section className="bg-surface border border-outline-variant rounded-lg p-6 flex flex-col h-full shadow-sm">
            <div className="flex items-center justify-between border-b border-outline-variant pb-4 mb-4">
              <h3 className="text-sm font-medium text-primary flex items-center uppercase tracking-wider">
                <CreditCard className="mr-2 w-5 h-5" />
                Pagamento & Resumo
              </h3>
              <button 
                type="button"
                onClick={() => setModalSimulacaoAberto(true)}
                className="text-[11px] font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Simular
              </button>
            </div>

            {/* Método de Pagamento */}
            <div className="mb-4">
              <label className="text-xs font-mono text-on-surface-variant mb-2 block uppercase tracking-wider">
                MÉTODO DE PAGAMENTO
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'pix', label: 'PIX' },
                  { id: 'cartao', label: 'Cartão' },
                  { id: 'dinheiro', label: 'Dinheiro' },
                  { id: 'outro', label: 'Outro' }
                ].map((method) => (
                  <label key={method.id} className="flex items-center p-2 border border-outline-variant rounded cursor-pointer hover:bg-surface-container-high transition-colors">
                    <input 
                      type="radio" 
                      name="pagamento" 
                      checked={metodoPagamento === method.id}
                      onChange={() => setMetodoPagamento(method.id as any)}
                      className="text-primary-container bg-surface-container-highest border-outline-variant" 
                    />
                    <span className="ml-2 text-sm font-medium text-on-surface">{method.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status Inicial da Oficina */}
            <div className="mb-4">
              <label className="text-xs font-mono text-on-surface-variant mb-2 block uppercase tracking-wider">
                STATUS INICIAL DO PEDIDO
              </label>
              <select
                value={statusInicial}
                onChange={(e) => setStatusInicial(e.target.value as PedidoStatus)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface font-semibold focus:border-primary-container focus:ring-1 focus:ring-primary-container"
              >
                {STATUS_LIST.filter(s => s.key !== 'cancelado').map(s => (
                  <option key={s.key} value={s.key} className="bg-[#191c1e] text-on-surface">
                    {s.emoji} {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* SEÇÃO 6: RESUMO DO ORÇAMENTO (Composição Completa e Detalhada) */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 mb-4 space-y-2">
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
                <span className="text-xs font-mono font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-primary" />
                  RESUMO DO ORÇAMENTO
                </span>
                <span className="text-[10px] font-mono text-on-surface-variant">
                  {totalTaxas > 0 ? `Taxas: ${totalTaxas}%` : 'Sem taxas adicionais'}
                </span>
              </div>

              <div className="text-xs space-y-1.5 pt-1 text-on-surface-variant">
                <div className="flex justify-between items-center">
                  <span>Custo de produção:</span>
                  <span className="font-mono text-on-surface">R$ {formatCurrency(pricing.custoProducao)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span>Embalagem:</span>
                  <span className="font-mono text-on-surface">R$ {formatCurrency(pricing.embalagem)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span>Outros custos:</span>
                  <span className="font-mono text-on-surface">R$ {formatCurrency(pricing.outrosCustos)}</span>
                </div>

                <div className="flex justify-between items-center font-bold text-on-surface pt-1 border-t border-outline-variant/40">
                  <span>Custo total:</span>
                  <span className="font-mono">R$ {formatCurrency(pricing.custoBase)}</span>
                </div>

                <div className="flex justify-between items-center text-primary pt-0.5">
                  <span>Lucro desejado ({pricing.margemLucro}%):</span>
                  <span className="font-mono font-semibold">+ R$ {formatCurrency(pricing.lucroDesejado)}</span>
                </div>

                {pricing.impostoPercentual > 0 && (
                  <div className="flex justify-between items-center text-amber-400 text-[11px]">
                    <span>Imposto ({pricing.impostoPercentual}%):</span>
                    <span className="font-mono">R$ {formatCurrency(pricing.impostoValor)}</span>
                  </div>
                )}

                {pricing.taxaPagamentoPercentual > 0 && (
                  <div className="flex justify-between items-center text-amber-400 text-[11px]">
                    <span>Taxa de pagamento ({pricing.taxaPagamentoPercentual}%):</span>
                    <span className="font-mono">R$ {formatCurrency(pricing.taxaPagamentoValor)}</span>
                  </div>
                )}

                {pricing.marketplacePercentual > 0 && (
                  <div className="flex justify-between items-center text-amber-400 text-[11px]">
                    <span>Marketplace ({pricing.marketplacePercentual}%):</span>
                    <span className="font-mono">R$ {formatCurrency(pricing.marketplaceValor)}</span>
                  </div>
                )}
              </div>

              {/* SEÇÃO 7: QUANTIDADE DE PEÇAS (quando > 1) */}
              {totalPecas > 1 && (
                <div className="mt-3 pt-2.5 border-t border-outline-variant/60 bg-surface-container/50 -mx-4 -mb-4 p-3 rounded-b-lg">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-on-surface-variant">Quantidade:</span>
                    <span className="font-mono font-bold text-on-surface">{totalPecas} peças</span>
                  </div>
                  <div className="flex justify-between items-center text-xs mt-1">
                    <span className="font-mono text-on-surface-variant">Preço unitário médio:</span>
                    <span className="font-mono font-bold text-primary">R$ {formatCurrency(precoUnitarioMedio)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs mt-1">
                    <span className="font-mono text-on-surface-variant">Total:</span>
                    <span className="font-mono font-bold text-secondary-container">R$ {formatCurrency(totalFinal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* SEÇÃO 11: INDICADOR DE LUCRO LÍQUIDO OU PREJUÍZO REAL */}
            {lucroLiquidoReal < 0 && (
              <div className="p-2.5 mb-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  <strong>Atenção:</strong> O desconto aplicado gera prejuízo real de <strong>R$ {formatCurrency(Math.abs(lucroLiquidoReal))}</strong>.
                </span>
              </div>
            )}

            <div className={`rounded-lg p-3.5 mb-4 flex items-center justify-between border ${
              lucroLiquidoReal < 0 
                ? 'bg-red-500/10 border-red-500/40 text-red-400' 
                : 'bg-primary/10 border-primary/30 text-primary'
            }`}>
              <div>
                <span className={`text-[11px] font-mono uppercase tracking-wider block ${
                  lucroLiquidoReal < 0 ? 'text-red-400 font-bold' : 'text-on-surface-variant'
                }`}>
                  {lucroLiquidoReal < 0 ? 'Prejuízo líquido real' : 'Lucro líquido estimado'}
                </span>
                <span className={`text-xl font-bold font-mono ${lucroLiquidoReal < 0 ? 'text-red-400' : 'text-primary'}`}>
                  R$ {formatCurrency(lucroLiquidoReal)}
                </span>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-mono uppercase tracking-wider block ${
                  lucroLiquidoReal < 0 ? 'text-red-400 font-bold' : 'text-on-surface-variant'
                }`}>
                  {lucroLiquidoReal < 0 ? 'Margem negativa' : 'Margem sobre venda'}
                </span>
                <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded border inline-block ${
                  lucroLiquidoReal < 0 
                    ? 'bg-red-500/20 text-red-300 border-red-500/40' 
                    : 'bg-primary/20 text-primary border-primary/30'
                }`}>
                  Margem: {margemEfetivaReal}%
                </span>
              </div>
            </div>

            {/* Total e Desconto Comercial */}
            <div className="mt-auto pt-3 border-t border-outline-variant mb-6 space-y-3">
              {/* Bloco de Desconto */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-on-surface">
                    <Percent className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-mono font-medium uppercase">Desconto Comercial</span>
                  </div>

                  <div className="flex bg-surface-container rounded p-0.5 border border-outline-variant text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => {
                        setTipoDesconto('porcentagem');
                        if (descontoValorFixo > 0 && precoBaseVenda > 0) {
                          setDescontoPercentual(Number(((descontoValorFixo / precoBaseVenda) * 100).toFixed(1)));
                        }
                      }}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
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
                          setDescontoValorFixo(Number(((precoBaseVenda * descontoPercentual) / 100).toFixed(2)));
                        }
                      }}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                        tipoDesconto === 'valor'
                          ? 'bg-primary text-on-primary font-bold shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      R$ Reais
                    </button>
                  </div>
                </div>

                {tipoDesconto === 'porcentagem' ? (
                  <>
                    <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                      {[5, 10, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDescontoPercentual(pct)}
                          className={`py-1 px-1 rounded text-xs font-mono font-bold border transition-colors cursor-pointer text-center ${
                            descontoPercentual === pct
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-surface-container border-outline-variant text-on-surface hover:bg-surface-bright'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-xs text-on-surface-variant">Outra %:</span>
                      <div className="relative w-28">
                        <input
                          id="desconto-percentual-input"
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
                          className="w-full bg-surface-container border border-outline-variant rounded pl-2.5 pr-6 py-1 text-right text-xs font-mono font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-on-surface-variant">Valor em R$:</span>
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">R$</span>
                      <input
                        id="desconto-valor-input"
                        type="number"
                        min="0"
                        step="0.50"
                        value={descontoValorFixo === 0 ? '' : descontoValorFixo}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setDescontoValorFixo(isNaN(val) || val < 0 ? 0 : val);
                        }}
                        placeholder="0,00"
                        className="w-full bg-surface-container border border-outline-variant rounded pl-8 pr-2 py-1 text-right text-xs font-mono font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}

                {valorDesconto > 0 && (
                  <div className="flex justify-between items-baseline text-emerald-400 text-xs font-mono pt-1 border-t border-outline-variant/60">
                    <span>Desconto ({tipoDesconto === 'porcentagem' ? `${descontoPercentual}%` : `${precoBaseVenda > 0 ? ((descontoValorFixo / precoBaseVenda) * 100).toFixed(1) : 0}%`}):</span>
                    <span className="font-bold">- R$ {formatCurrency(valorDesconto)}</span>
                  </div>
                )}
              </div>

              {/* PREÇO DE VENDA FINAL */}
              <div className="flex justify-between items-end pt-3 border-t border-outline-variant">
                <div>
                  <span className="text-xs font-mono text-on-surface-variant uppercase tracking-wider block">PREÇO DE VENDA</span>
                  <span className="text-2xl font-bold text-on-surface">TOTAL</span>
                </div>
                <span className="text-4xl font-bold text-secondary-container tracking-tight font-mono">
                  R$ {formatCurrency(totalFinal)}
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="space-y-3">
              <button 
                onClick={handleGerarPDF}
                disabled={isTaxError}
                className="w-full bg-primary-container hover:bg-primary-fixed text-on-primary-container text-xl font-bold py-4 rounded-lg flex justify-center items-center transition-colors shadow-[0_0_15px_rgba(0,102,255,0.2)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="mr-2 w-6 h-6" />
                GERAR PDF
              </button>
              
              <div className="flex space-x-3">
                <button 
                  onClick={handleLimpar}
                  className="flex-1 border border-outline-variant hover:bg-surface-container-high text-on-surface text-sm font-medium py-3 rounded flex justify-center items-center transition-colors cursor-pointer"
                >
                  <Eraser className="mr-2 w-4 h-4" />
                  Limpar
                </button>
                <button 
                  onClick={handleLimpar}
                  className="flex-1 border border-outline-variant hover:bg-surface-container-high text-on-surface text-sm font-medium py-3 rounded flex justify-center items-center transition-colors cursor-pointer"
                >
                  <RotateCcw className="mr-2 w-4 h-4" />
                  Novo
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* SEÇÃO 12: MODAL DE SIMULAÇÃO ("Simular preço") */}
      {modalSimulacaoAberto && (
        <ModalSimularPreco 
          custoProducaoAtual={custoProducao}
          embalagemAtual={embalagem}
          outrosCustosAtual={outrosCustos}
          impostoAtual={imposto}
          taxaPagamentoAtual={taxaPagamento}
          marketplaceAtual={comissaoMarketplace}
          margemLucroAtual={margemLucro}
          onClose={() => setModalSimulacaoAberto(false)}
          onApply={(sim) => {
            setImposto(sim.imposto);
            setTaxaPagamento(sim.taxaPagamento);
            setComissaoMarketplace(sim.comissaoMarketplace);
            setMargemLucro(sim.margemLucro);
            setModalSimulacaoAberto(false);
          }}
        />
      )}

      {/* Modal Comprovante */}
      {pedidoGerado && (
        <ComprovanteView pedido={pedidoGerado} onClose={() => setPedidoGerado(null)} />
      )}
    </div>
  );
}

/**
 * Modal Interativo de Simulação de Preço de Venda
 */
interface ModalSimularPrecoProps {
  custoProducaoAtual: number;
  embalagemAtual: number;
  outrosCustosAtual: number;
  impostoAtual: number;
  taxaPagamentoAtual: number;
  marketplaceAtual: number;
  margemLucroAtual: number;
  onClose: () => void;
  onApply: (sim: { imposto: number; taxaPagamento: number; comissaoMarketplace: number; margemLucro: number }) => void;
}

function ModalSimularPreco({
  custoProducaoAtual,
  embalagemAtual,
  outrosCustosAtual,
  impostoAtual,
  taxaPagamentoAtual,
  marketplaceAtual,
  margemLucroAtual,
  onClose,
  onApply
}: ModalSimularPrecoProps) {
  const [simImposto, setSimImposto] = useState<number>(impostoAtual);
  const [simTaxa, setSimTaxa] = useState<number>(taxaPagamentoAtual);
  const [simMarketplace, setSimMarketplace] = useState<number>(marketplaceAtual);
  const [simMargem, setSimMargem] = useState<number>(margemLucroAtual);

  const baseCusto = custoProducaoAtual > 0 ? custoProducaoAtual : 20;

  const result = useMemo(() => {
    return calculateSalePrice({
      custoProducao: baseCusto,
      embalagem: embalagemAtual,
      outrosCustos: outrosCustosAtual,
      imposto: simImposto,
      taxaPagamento: simTaxa,
      comissaoMarketplace: simMarketplace,
      margemLucro: simMargem
    });
  }, [baseCusto, embalagemAtual, outrosCustosAtual, simImposto, simTaxa, simMarketplace, simMargem]);

  const totalSimTaxas = Number((simImposto + simTaxa + simMarketplace).toFixed(2));
  const hasError = totalSimTaxas >= 100;

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-low border border-outline-variant rounded-xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">Simulador de Preço de Venda</h3>
              <p className="text-xs text-on-surface-variant">
                Altere os valores para ver em tempo real o preço de venda e o lucro preservado.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 text-on-surface-variant hover:text-on-surface rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inputs de Simulação */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 bg-surface-container p-3 rounded-lg border border-outline-variant">
            <label className="text-xs font-mono font-bold text-on-surface">Imposto (%)</label>
            <input 
              type="number"
              min="0"
              max="99"
              step="0.5"
              value={simImposto}
              onChange={(e) => setSimImposto(sanitizeNumeric(e.target.value))}
              className="bg-surface-container-highest border border-outline-variant rounded px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface"
            />
            <span className="text-[10px] text-on-surface-variant">Sobre a venda</span>
          </div>

          <div className="flex flex-col gap-1 bg-surface-container p-3 rounded-lg border border-outline-variant">
            <label className="text-xs font-mono font-bold text-on-surface">Taxa Pagamento (%)</label>
            <input 
              type="number"
              min="0"
              max="99"
              step="0.1"
              value={simTaxa}
              onChange={(e) => setSimTaxa(sanitizeNumeric(e.target.value))}
              className="bg-surface-container-highest border border-outline-variant rounded px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface"
            />
            <span className="text-[10px] text-on-surface-variant">Cartão / Pix</span>
          </div>

          <div className="flex flex-col gap-1 bg-surface-container p-3 rounded-lg border border-outline-variant">
            <label className="text-xs font-mono font-bold text-on-surface">Marketplace (%)</label>
            <input 
              type="number"
              min="0"
              max="99"
              step="0.5"
              value={simMarketplace}
              onChange={(e) => setSimMarketplace(sanitizeNumeric(e.target.value))}
              className="bg-surface-container-highest border border-outline-variant rounded px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface"
            />
            <span className="text-[10px] text-on-surface-variant">Comissão</span>
          </div>

          <div className="flex flex-col gap-1 bg-primary/10 p-3 rounded-lg border border-primary/30">
            <label className="text-xs font-mono font-bold text-primary">Lucro sobre o custo (%)</label>
            <input 
              type="number"
              min="1"
              max="500"
              step="5"
              value={simMargem}
              onChange={(e) => setSimMargem(sanitizeNumeric(e.target.value, 40))}
              className="bg-surface-container-highest border border-primary/40 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface"
            />
            <span className="text-[10px] text-primary font-mono">Markup sobre custos</span>
          </div>
        </div>

        {/* Mensagem de Erro de Taxas */}
        {hasError ? (
          <div className="p-3 bg-error/15 border border-error/30 text-error rounded-lg text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>As taxas não podem ser iguais ou superiores a 100%.</span>
          </div>
        ) : (
          /* Resultado Imediato da Simulação */
          <div className="bg-surface-container-highest/60 border border-outline-variant rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono">
              <span>Custo de Produção Base:</span>
              <span className="font-bold text-on-surface">R$ {formatCurrency(result.custoProducao)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono">
              <span>Embalagem + Outros Custos:</span>
              <span className="font-bold text-on-surface">R$ {formatCurrency(result.embalagem + result.outrosCustos)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono">
              <span>Taxas Totais ({result.totalTaxasPercentual}%):</span>
              <span className="font-bold text-amber-400">R$ {formatCurrency(result.impostoValor + result.taxaPagamentoValor + result.marketplaceValor)}</span>
            </div>

            <div className="pt-2 border-t border-outline-variant flex justify-between items-end">
              <div>
                <span className="text-[10px] font-mono text-on-surface-variant block uppercase">PREÇO DE VENDA NECESSÁRIO</span>
                <span className="text-2xl font-bold font-mono text-secondary-container">
                  R$ {formatCurrency(result.precoVenda)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-on-surface-variant block uppercase">LUCRO LÍQUIDO REAL</span>
                <span className="text-base font-bold font-mono text-primary">
                  R$ {formatCurrency(result.lucroLiquido)}
                </span>
                <span className="text-[10px] font-mono text-on-surface-variant block">
                  Margem sobre a venda: <strong>{result.margemEfetiva}%</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="text-[11px] text-on-surface-variant font-mono text-center">
          * Esta simulação não altera as configurações padrão do sistema.
        </div>

        {/* Botões do Modal */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-mono font-bold text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
          >
            FECHAR
          </button>
          <button 
            type="button"
            disabled={hasError}
            onClick={() => onApply({
              imposto: simImposto,
              taxaPagamento: simTaxa,
              comissaoMarketplace: simMarketplace,
              margemLucro: simMargem
            })}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-mono font-bold hover:bg-primary/90 cursor-pointer transition-colors disabled:opacity-50"
          >
            APLICAR AO ORÇAMENTO
          </button>
        </div>
      </div>
    </div>
  );
}
