import React, { forwardRef, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Phone, 
  Instagram, 
  Mail, 
  QrCode, 
  CreditCard, 
  Banknote, 
  Copy,
  Check,
  Package
} from 'lucide-react';
import { Pedido } from '../types';
import { SystemSettings } from '../utils/settingsStorage';
import { getStatusConfig } from '../utils/statusUtils';
import { formatCompactDate } from '../utils/dateUtils';

interface DocumentoOrcamentoProps {
  pedido: Pedido;
  settings: SystemSettings;
  className?: string;
}

export const DocumentoOrcamento = forwardRef<HTMLDivElement, DocumentoOrcamentoProps>(
  ({ pedido, settings, className = '' }, ref) => {
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [copiedPix, setCopiedPix] = useState(false);

    const chavePix = settings.chavePix || settings.whatsapp || settings.email || '';
    const isPendente = (pedido.status || 'na_fila') === 'pendente';
    const statusCfg = getStatusConfig(pedido.status || 'na_fila');

    // Generate high-resolution QR Code for PIX key
    useEffect(() => {
      let isMounted = true;
      if (chavePix) {
        QRCode.toDataURL(chavePix, {
          width: 280,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        })
          .then(url => {
            if (isMounted) setQrCodeUrl(url);
          })
          .catch(err => {
            console.warn('Erro ao gerar QR Code PIX:', err);
          });
      }
      return () => {
        isMounted = false;
      };
    }, [chavePix]);

    const formatCurrency = (val: number) => {
      return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Calculate proposal expiration date (10 days after order date or emission)
    const calculateExpiration = () => {
      try {
        const d = new Date();
        d.setDate(d.getDate() + 10);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `10 dias (${day}/${month}/${year})`;
      } catch {
        return '10 dias após emissão';
      }
    };

    const totalItensQtd = (pedido.itens || []).reduce((acc, it) => acc + (Number(it.qtd) || 0), 0);
    const subtotalItens = (pedido.itens || []).reduce(
      (acc, it) => acc + (Number(it.qtd) || 0) * (Number(it.valorUnitario) || 0),
      0
    );
    const valorDesconto = Number(pedido.desconto) > 0 ? Number(pedido.desconto) : 0;

    const handleCopyPix = () => {
      if (chavePix && typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(chavePix);
        setCopiedPix(true);
        setTimeout(() => setCopiedPix(false), 2000);
      }
    };

    const primaryColor = settings.corPrincipal || '#0066ff';
    const nomeEmpresa = settings.nomeEmpresa?.trim() || 'Impressão 3D';

    return (
      <div
        ref={ref}
        data-documento-orcamento="true"
        className={`w-full max-w-[820px] bg-white text-[#0f172a] p-8 md:p-10 rounded-xl shadow-xl relative overflow-hidden font-sans border border-slate-200 print:shadow-none print:p-6 print:border-none print:rounded-none print:max-w-none ${className}`}
        style={{
          backgroundColor: '#ffffff',
          color: '#0f172a'
        }}
      >
        {/* 1. Header: Empresa, Logo & Contatos */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b-2 border-slate-900 mb-6">
          {/* Brand Left */}
          <div className="flex items-center gap-4">
            {settings.logotipoUrl ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                <img
                  src={settings.logotipoUrl}
                  alt={nomeEmpresa}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center shrink-0 shadow-xs text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <Package className="w-9 h-9" />
              </div>
            )}

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0f172a]">
                {nomeEmpresa}
              </h1>
              {settings.subtituloEmpresa && (
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase mt-0.5">
                  {settings.subtituloEmpresa}
                </p>
              )}
            </div>
          </div>

          {/* Contact Right */}
          <div className="text-left sm:text-right text-xs space-y-1.5 shrink-0 font-medium text-slate-700">
            {settings.whatsapp && (
              <div className="flex items-center sm:justify-end gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{settings.whatsapp}</span>
              </div>
            )}
            {settings.email && (
              <div className="flex items-center sm:justify-end gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{settings.email}</span>
              </div>
            )}
            {settings.instagram && (
              <div className="flex items-center sm:justify-end gap-1.5">
                <Instagram className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{settings.instagram}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Document Title & Metadata */}
        <div className="flex flex-row justify-between items-center gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="min-w-0">
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 block mb-0.5 font-mono">
              DOCUMENTO DE ATENDIMENTO
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase truncate">
              {isPendente ? 'ORÇAMENTO' : 'COMPROVANTE DE PEDIDO'}
            </h2>
          </div>

          <div className="flex flex-row items-center gap-3 shrink-0">
            <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-center shadow-2xs min-w-[110px]">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase block leading-none">
                {isPendente ? 'Nº ORÇAMENTO' : 'Nº PEDIDO'}
              </span>
              <span className="font-mono font-black text-sm sm:text-base text-slate-900 block mt-1.5 leading-none">
                {pedido.id}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-center shadow-2xs min-w-[95px]">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase block leading-none">
                EMISSÃO
              </span>
              <span className="font-mono font-bold text-xs sm:text-sm text-slate-800 block mt-1.5 leading-none whitespace-nowrap">
                {formatCompactDate(pedido.data)}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Cliente & Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Card Cliente */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs border-l-4" style={{ borderLeftColor: primaryColor }}>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 font-mono">
              CLIENTE
            </span>
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              {pedido.cliente || 'Cliente não identificado'}
            </h3>
            {pedido.telefone && (
              <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{pedido.telefone}</span>
              </div>
            )}
          </div>

          {/* Card Status */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 font-mono">
              SITUAÇÃO DO PEDIDO
            </span>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold font-mono border"
              style={{
                backgroundColor: isPendente ? '#fefce8' : '#f0fdf4',
                borderColor: isPendente ? '#fde047' : '#bbf7d0',
                color: isPendente ? '#854d0e' : '#166534'
              }}
            >
              <span 
                className="w-2 h-2 rounded-full shrink-0" 
                style={{ backgroundColor: isPendente ? '#eab308' : '#22c55e' }}
              />
              <span>{statusCfg.label.toUpperCase()}</span>
            </div>
            {isPendente && (
              <p className="text-[11px] text-slate-500 mt-2 font-medium">
                Validade da proposta: <strong className="text-slate-800">{calculateExpiration()}</strong>
              </p>
            )}
          </div>
        </div>

        {/* 4. Tabela de Itens (Utiliza <table> real com larguras fixas para impedir sobreposição de foto e texto) */}
        <div className="mb-6 overflow-hidden border border-slate-300 rounded-xl shadow-xs">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '44px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                <th className="py-3 px-2 text-center">#</th>
                <th className="py-3 px-3 text-center">FOTO</th>
                <th className="py-3 px-3">PRODUTO / SERVIÇO</th>
                <th className="py-3 px-2 text-center">QTD.</th>
                <th className="py-3 px-3 text-right">UNITÁRIO</th>
                <th className="py-3 px-3 text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {pedido.itens && pedido.itens.length > 0 ? (
                pedido.itens.map((item, idx) => {
                  const itemTotal = (Number(item.qtd) || 0) * (Number(item.valorUnitario) || 0);

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Index */}
                      <td className="py-3 px-2 text-center font-mono font-bold text-slate-400 text-xs align-middle">
                        {String(idx + 1).padStart(2, '0')}
                      </td>

                      {/* 2. Coluna dedicada e ampla para a Imagem do Produto */}
                      <td className="py-3 px-3 text-center align-middle">
                        <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-xl border border-slate-200 bg-white p-1.5 overflow-hidden flex items-center justify-center shadow-xs">
                          {item.imagemUrl ? (
                            <img
                              src={item.imagemUrl}
                              alt={item.descricao || 'Produto'}
                              className="w-full h-full object-contain rounded-lg"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-300 gap-1">
                              <Package className="w-8 h-8" />
                              <span className="text-[9px] font-mono text-slate-400">Sem Foto</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Coluna dedicada para Nome do Produto (NUNCA fica em cima da foto) */}
                      <td className="py-3 px-3 align-middle">
                        <div className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                          {item.descricao || 'Item sem descrição'}
                        </div>
                      </td>

                      {/* 4. Quantidade */}
                      <td className="py-3 px-2 text-center font-mono font-bold text-slate-900 text-xs sm:text-sm align-middle">
                        {item.qtd} <span className="text-[10px] text-slate-500 font-normal">un</span>
                      </td>

                      {/* 5. Unitário */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700 text-xs sm:text-sm align-middle whitespace-nowrap">
                        R$ {formatCurrency(Number(item.valorUnitario) || 0)}
                      </td>

                      {/* 6. Total */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-xs sm:text-sm align-middle whitespace-nowrap">
                        R$ {formatCurrency(itemTotal)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500 font-mono">
                    Nenhum item adicionado ao orçamento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagamento & Observações | Resumo Financeiro */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-6">
          {/* Coluna Esquerda: Pagamento e Observações */}
          <div className="md:col-span-7 flex flex-col gap-4">
            {/* Box Pagamento */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900 font-mono">
                  {pedido.metodoPagamento === 'cartao' ? (
                    <CreditCard className="w-4 h-4 text-blue-600" />
                  ) : pedido.metodoPagamento === 'dinheiro' ? (
                    <Banknote className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <QrCode className="w-4 h-4 text-blue-600" />
                  )}
                  <span>
                    PAGAMENTO VIA {(pedido.metodoPagamento || 'PIX').toUpperCase()}
                  </span>
                </div>
              </div>

              {pedido.metodoPagamento === 'pix' || !pedido.metodoPagamento ? (
                <div className="flex items-center gap-4">
                  {/* QR Code PIX */}
                  <div className="w-20 h-20 sm:w-22 sm:h-22 bg-white border border-slate-200 p-1 rounded-lg shrink-0 flex items-center justify-center shadow-xs">
                    {qrCodeUrl ? (
                      <img
                        src={qrCodeUrl}
                        alt="QR Code PIX"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <QrCode className="w-12 h-12 text-slate-700" />
                    )}
                  </div>

                  {/* Dados Chave PIX */}
                  <div className="min-w-0 text-xs flex-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block font-mono">
                      Chave PIX:
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 break-all">
                        {chavePix || 'A combinar'}
                      </span>
                      {chavePix && (
                        <button
                          onClick={handleCopyPix}
                          type="button"
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors print:hidden cursor-pointer shrink-0"
                          title="Copiar Chave PIX"
                        >
                          {copiedPix ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                    {nomeEmpresa && (
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Beneficiário: <strong className="text-slate-800">{nomeEmpresa}</strong>
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-600 font-medium py-1">
                  Condições de pagamento combinadas diretamente com o cliente via {(pedido.metodoPagamento || 'outro').toUpperCase()}.
                </div>
              )}
            </div>

            {/* Observações Reais */}
            {(pedido.observacoes || settings.observacoesPadrao) && (
              <div className="border-l-4 border-l-slate-400 pl-3 py-1 space-y-1 bg-slate-50/50 rounded-r-lg">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block font-mono">
                  OBSERVAÇÕES
                </span>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {pedido.observacoes || settings.observacoesPadrao}
                </p>
              </div>
            )}
          </div>

          {/* Coluna Direita: Resumo Financeiro */}
          <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-600 tracking-wider block mb-3 pb-2 border-b border-slate-200 font-mono">
                RESUMO FINANCEIRO
              </span>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({totalItensQtd} un)</span>
                  <span className="text-slate-900 font-medium">
                    R$ {formatCurrency(subtotalItens)}
                  </span>
                </div>

                {valorDesconto > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>
                      Desconto
                      {pedido.descontoPercentual ? ` (${pedido.descontoPercentual}%)` : ''}
                    </span>
                    <span>- R$ {formatCurrency(valorDesconto)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Total Geral Destacado */}
            <div className="mt-4">
              <div className="bg-slate-900 text-white rounded-xl p-4 flex justify-between items-center shadow-md">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 tracking-widest font-bold block">
                    TOTAL GERAL
                  </span>
                  <span className="text-xs text-slate-300 mt-0.5 block">
                    {(pedido.metodoPagamento || 'PIX').toUpperCase()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-bold mr-1">R$</span>
                  <span className="font-mono font-black text-2xl sm:text-3xl text-white">
                    {formatCurrency(pedido.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Rodapé */}
        <div className="border-t border-slate-200 pt-4 text-center">
          <p className="text-xs font-medium text-slate-600">
            {settings.mensagemRodape || 'Agradecemos a preferência!'}
          </p>
          <p className="text-[10px] font-mono text-slate-400 mt-1">
            Documento emitido eletronicamente por {nomeEmpresa}
          </p>
        </div>
      </div>
    );
  }
);

DocumentoOrcamento.displayName = 'DocumentoOrcamento';
