/**
 * Motor central de precificação e formação de preço para pedidos e orçamentos 3D.
 *
 * ESCLARECIMENTO DE CONCEITOS FINANCEIROS:
 * 1. "Lucro sobre o custo" (Markup sobre o custo base):
 *    Percentual aplicado diretamente sobre o custo total (produção + embalagem + outros custos)
 *    para formar o subtotal necessário antes dos tributos e taxas de venda.
 *    Fórmula: Lucro Desejado = Custo Base × (Lucro sobre o Custo % / 100)
 *    Exemplo: Custo de R$ 100 com 40% de lucro sobre o custo gera R$ 40 de lucro bruto pretendido.
 *
 * 2. "Margem de lucro sobre a venda" (Margem líquida efetiva):
 *    Percentual do preço final cobrado do cliente que efetivamente corresponde ao lucro líquido:
 *    Fórmula: Margem Efetiva (%) = (Lucro Líquido / Total Final Cobrado) × 100
 *    Exemplo: Se o preço cobrado for R$ 140 e o lucro for R$ 40, a margem sobre a venda é 28,57%.
 *
 * FÓRMULA DE FORMAÇÃO DO PREÇO BASE (ANTES DE DESCONTO):
 * Custo Base = Custo de Produção + Embalagem + Outros Custos
 * Lucro Desejado = Custo Base × (Lucro sobre o Custo % / 100)
 * Subtotal Necessário = Custo Base + Lucro Desejado
 * Taxas Percentuais = Imposto (%) + Taxa de Pagamento (%) + Marketplace (%)
 * Preço Base de Venda = Subtotal Necessário ÷ (1 - Taxas Percentuais / 100)
 *
 * CÁLCULO POSTERIOR AO DESCONTO (VALOR EFETIVAMENTE COBRADO):
 * Se houver desconto comercial concedido (% ou R$):
 * Preço Final Cobrado (Total Final) = Math.max(0, Preço Base de Venda - Desconto)
 * (O desconto nunca gera total negativo)
 *
 * Base de Incidência de Impostos e Taxas:
 * As taxas percentuais incidem sobre o valor EFETIVAMENTE COBRADO (Total Final),
 * refletindo o faturamento real e as taxas de meios de pagamento e marketplaces:
 * Imposto (R$) = Total Final × (Imposto % / 100)
 * Taxa Pagamento (R$) = Total Final × (Taxa Pagamento % / 100)
 * Marketplace (R$) = Total Final × (Marketplace % / 100)
 * Total Taxas (R$) = Imposto (R$) + Taxa Pagamento (R$) + Marketplace (R$)
 *
 * Lucro Líquido Real:
 * Total Deduções = Custo Base + Total Taxas (R$)
 * Lucro Líquido = Total Final - Total Deduções
 * (NÃO limitado a zero: se o desconto gerar prejuízo, o prejuízo real é exibido com precisão)
 *
 * Margem Efetiva sobre a Venda:
 * Se Total Final > 0: Margem Efetiva = (Lucro Líquido / Total Final) × 100
 * Se Total Final == 0: Margem Efetiva = Custo Base > 0 ? -100% : 0%
 */

export interface PricingInput {
  custoProducao: number;
  embalagem?: number;
  outrosCustos?: number;
  imposto?: number; // % sobre o valor faturado
  taxaPagamento?: number; // % sobre o valor recebido
  comissaoMarketplace?: number; // % sobre o valor vendido
  margemLucro?: number; // % de lucro sobre o custo base (markup)
  arredondamentoComercial?: boolean; // Opção de arredondamento comercial (ex: .90)
  // Desconto comercial
  tipoDesconto?: 'porcentagem' | 'valor';
  descontoPercentual?: number;
  descontoValorFixo?: number;
  desconto?: number; // Valor monetário de desconto direto
}

export interface PricingResult {
  custoProducao: number;
  embalagem: number;
  outrosCustos: number;
  custoBase: number;
  margemLucro: number; // Percentual de lucro sobre o custo configurado (%)
  lucroDesejado: number; // Valor nominal do lucro desejado sobre o custo (R$)
  subtotalNecessario: number;
  totalTaxasPercentual: number;
  impostoPercentual: number;
  impostoValor: number;
  taxaPagamentoPercentual: number;
  taxaPagamentoValor: number;
  marketplacePercentual: number;
  marketplaceValor: number;
  totalTaxasValor: number;
  precoBaseVenda: number; // Preço de tabela antes do desconto
  precoVendaSemArredondamento: number;
  descontoValor: number; // Valor do desconto aplicado em R$
  descontoPercentual: number; // Percentual do desconto em relação ao preço base
  totalFinal: number; // Valor final cobrado do cliente (>= 0)
  precoVenda: number; // Alias para totalFinal (garante compatibilidade)
  lucroLiquido: number; // Lucro líquido real (pode ser negativo em caso de prejuízo)
  margemEfetiva: number; // Margem de lucro real sobre a venda (%) usando totalFinal como base
  lucroSobreCustoEfetivo: number; // Lucro real sobre o custo base (%)
  erro?: string;
}

/**
 * Sanitiza entradas numéricas para evitar NaN, strings vazias ou valores infinitos.
 */
export function sanitizeNumeric(value: number | string | undefined | null, defaultValue = 0): number {
  if (value === undefined || value === null || value === '') return defaultValue;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (isNaN(parsed) || !isFinite(parsed)) return defaultValue;
  return Math.max(0, parsed);
}

/**
 * Aplica arredondamento comercial opcional para .90 caso ativado.
 */
export function applyCommercialRounding(price: number, enabled: boolean): number {
  if (!enabled || price <= 0) {
    return Number(price.toFixed(2));
  }
  const floorVal = Math.floor(price);
  const candidate = floorVal + 0.90;
  return candidate >= price ? candidate : candidate + 1.0;
}

/**
 * Função central para cálculo do preço de venda, desconto e lucro líquido real.
 */
export function calculateSalePrice(input: PricingInput): PricingResult {
  const custoProducao = sanitizeNumeric(input.custoProducao);
  const embalagem = sanitizeNumeric(input.embalagem);
  const outrosCustos = sanitizeNumeric(input.outrosCustos);
  const imposto = sanitizeNumeric(input.imposto);
  const taxaPagamento = sanitizeNumeric(input.taxaPagamento);
  const comissaoMarketplace = sanitizeNumeric(input.comissaoMarketplace);
  const margemLucro = sanitizeNumeric(input.margemLucro, 40);

  // 1. Custo base total = produção + embalagem + outros custos
  const custoBase = Number((custoProducao + embalagem + outrosCustos).toFixed(4));

  // 2. Lucro desejado sobre o custo (markup)
  const lucroDesejado = Number((custoBase * (margemLucro / 100)).toFixed(4));

  // 3. Subtotal necessário (custo + lucro) antes das taxas de venda
  const subtotalNecessario = Number((custoBase + lucroDesejado).toFixed(4));

  // 4. Soma das taxas percentuais sobre a venda
  const totalTaxasPercentual = Number((imposto + taxaPagamento + comissaoMarketplace).toFixed(4));

  // Validação: taxas não podem ser iguais ou superiores a 100%
  if (totalTaxasPercentual >= 100) {
    return {
      custoProducao,
      embalagem,
      outrosCustos,
      custoBase: Number(custoBase.toFixed(2)),
      margemLucro,
      lucroDesejado: Number(lucroDesejado.toFixed(2)),
      subtotalNecessario: Number(subtotalNecessario.toFixed(2)),
      totalTaxasPercentual,
      impostoPercentual: imposto,
      impostoValor: 0,
      taxaPagamentoPercentual: taxaPagamento,
      taxaPagamentoValor: 0,
      marketplacePercentual: comissaoMarketplace,
      marketplaceValor: 0,
      totalTaxasValor: 0,
      precoBaseVenda: 0,
      precoVendaSemArredondamento: 0,
      descontoValor: 0,
      descontoPercentual: 0,
      totalFinal: 0,
      precoVenda: 0,
      lucroLiquido: 0,
      margemEfetiva: 0,
      lucroSobreCustoEfetivo: 0,
      erro: 'As taxas não podem ser iguais ou superiores a 100%.'
    };
  }

  // 5. Preço base de venda (antes do desconto)
  const fatorTaxas = 1 - (totalTaxasPercentual / 100);
  const precoVendaCalculado = fatorTaxas > 0 ? (subtotalNecessario / fatorTaxas) : 0;
  const precoVendaSemArredondamento = Number(precoVendaCalculado.toFixed(2));
  const precoBaseVenda = applyCommercialRounding(precoVendaCalculado, !!input.arredondamentoComercial);

  // 6. Determinação do desconto comercial
  let descontoCalculado = 0;
  let descontoPercentualCalc = 0;

  if (input.tipoDesconto === 'porcentagem' && typeof input.descontoPercentual === 'number') {
    const pct = sanitizeNumeric(input.descontoPercentual);
    descontoCalculado = (precoBaseVenda * pct) / 100;
    descontoPercentualCalc = pct;
  } else if (input.tipoDesconto === 'valor' && typeof input.descontoValorFixo === 'number') {
    descontoCalculado = sanitizeNumeric(input.descontoValorFixo);
    descontoPercentualCalc = precoBaseVenda > 0 ? (descontoCalculado / precoBaseVenda) * 100 : 0;
  } else if (typeof input.desconto === 'number' && input.desconto > 0) {
    descontoCalculado = sanitizeNumeric(input.desconto);
    descontoPercentualCalc = precoBaseVenda > 0 ? (descontoCalculado / precoBaseVenda) * 100 : 0;
  }

  // Restrição estrita: o desconto nunca pode produzir um total negativo
  const totalFinalSemTruncar = Math.max(0, precoBaseVenda - descontoCalculado);
  const totalFinal = Number(totalFinalSemTruncar.toFixed(2));
  const descontoValorReal = Number(Math.max(0, precoBaseVenda - totalFinal).toFixed(2));
  const descontoPercentualReal = Number(descontoPercentualCalc.toFixed(1));

  // 7. Base correta de incidência de taxas: incidem sobre o valor EFETIVAMENTE COBRADO (totalFinal)
  const impostoValor = Number(((totalFinal * imposto) / 100).toFixed(2));
  const taxaPagamentoValor = Number(((totalFinal * taxaPagamento) / 100).toFixed(2));
  const marketplaceValor = Number(((totalFinal * comissaoMarketplace) / 100).toFixed(2));
  const totalTaxasValor = Number((impostoValor + taxaPagamentoValor + marketplaceValor).toFixed(2));

  // 8. Lucro líquido real:
  // Total deduções = Custo Base (produção + embalagem + outros) + Impostos + Taxas
  // NÃO limitado a zero: se o desconto gerar prejuízo, o valor negativo real é exibido
  const totalDeducoes = Number((custoBase + totalTaxasValor).toFixed(2));
  const lucroLiquido = Number((totalFinal - totalDeducoes).toFixed(2));

  // 9. Margem efetiva sobre a venda: usando o total final do orçamento como base
  let margemEfetiva = 0;
  if (totalFinal > 0) {
    margemEfetiva = Number(((lucroLiquido / totalFinal) * 100).toFixed(1));
  } else if (custoBase > 0) {
    margemEfetiva = -100;
  }

  // 10. Lucro efetivo sobre o custo base (markup real)
  const lucroSobreCustoEfetivo = custoBase > 0
    ? Number(((lucroLiquido / custoBase) * 100).toFixed(1))
    : (lucroLiquido >= 0 ? margemLucro : -100);

  return {
    custoProducao: Number(custoProducao.toFixed(2)),
    embalagem: Number(embalagem.toFixed(2)),
    outrosCustos: Number(outrosCustos.toFixed(2)),
    custoBase: Number(custoBase.toFixed(2)),
    margemLucro: Number(margemLucro.toFixed(2)),
    lucroDesejado: Number(lucroDesejado.toFixed(2)),
    subtotalNecessario: Number(subtotalNecessario.toFixed(2)),
    totalTaxasPercentual: Number(totalTaxasPercentual.toFixed(2)),
    impostoPercentual: Number(imposto.toFixed(2)),
    impostoValor,
    taxaPagamentoPercentual: Number(taxaPagamento.toFixed(2)),
    taxaPagamentoValor,
    marketplacePercentual: Number(comissaoMarketplace.toFixed(2)),
    marketplaceValor,
    totalTaxasValor,
    precoBaseVenda: Number(precoBaseVenda.toFixed(2)),
    precoVendaSemArredondamento,
    descontoValor: descontoValorReal,
    descontoPercentual: descontoPercentualReal,
    totalFinal,
    precoVenda: totalFinal,
    lucroLiquido,
    margemEfetiva,
    lucroSobreCustoEfetivo
  };
}
