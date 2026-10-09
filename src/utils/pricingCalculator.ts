/**
 * Central pricing engine for 3D printing orders and quotes.
 * 
 * Formula:
 * Custo base = custo de produção + embalagem + outros custos fixos
 * Lucro desejado = Custo base × (margem de lucro / 100)
 * Subtotal necessário = Custo base + lucro desejado
 * Taxas percentuais = imposto + taxaPagamento + marketplace
 * Preço de venda = Subtotal necessário ÷ (1 - taxas / 100)
 */

export interface PricingInput {
  custoProducao: number;
  embalagem?: number;
  outrosCustos?: number;
  imposto?: number; // %
  taxaPagamento?: number; // %
  comissaoMarketplace?: number; // %
  margemLucro?: number; // %
  arredondamentoComercial?: boolean; // Opção futura para arredondamento (ex: .90)
}

export interface PricingResult {
  custoProducao: number;
  embalagem: number;
  outrosCustos: number;
  custoBase: number;
  margemLucro: number;
  lucroDesejado: number;
  subtotalNecessario: number;
  totalTaxasPercentual: number;
  impostoPercentual: number;
  impostoValor: number;
  taxaPagamentoPercentual: number;
  taxaPagamentoValor: number;
  marketplacePercentual: number;
  marketplaceValor: number;
  precoVenda: number;
  precoVendaSemArredondamento: number;
  lucroLiquido: number;
  margemEfetiva: number;
  erro?: string;
}

/**
 * Sanitizes any numeric input to avoid NaN, negative numbers, or invalid values.
 */
export function sanitizeNumeric(value: number | string | undefined | null, defaultValue = 0): number {
  if (value === undefined || value === null || value === '') return defaultValue;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (isNaN(parsed) || !isFinite(parsed)) return defaultValue;
  return Math.max(0, parsed);
}

/**
 * Applies optional commercial rounding prepared for future use (e.g., R$ 33,43 -> R$ 34,90).
 * By default returns the raw standard 2-decimal rounded price.
 */
export function applyCommercialRounding(price: number, enabled: boolean): number {
  if (!enabled || price <= 0) {
    return Number(price.toFixed(2));
  }
  // Exemplo de arredondamento comercial para .90
  const floorVal = Math.floor(price);
  const candidate = floorVal + 0.90;
  return candidate >= price ? candidate : candidate + 1.0;
}

/**
 * Central function to calculate sale price preserving the desired profit margin.
 */
export function calculateSalePrice(input: PricingInput): PricingResult {
  const custoProducao = sanitizeNumeric(input.custoProducao);
  const embalagem = sanitizeNumeric(input.embalagem);
  const outrosCustos = sanitizeNumeric(input.outrosCustos);
  const imposto = sanitizeNumeric(input.imposto);
  const taxaPagamento = sanitizeNumeric(input.taxaPagamento);
  const comissaoMarketplace = sanitizeNumeric(input.comissaoMarketplace);
  const margemLucro = sanitizeNumeric(input.margemLucro, 40);

  // Custo base = custo de produção + embalagem + outros custos
  const custoBase = Number((custoProducao + embalagem + outrosCustos).toFixed(4));

  // Lucro desejado = Custo base × margem de lucro
  const lucroDesejado = Number((custoBase * (margemLucro / 100)).toFixed(4));

  // Subtotal necessário = Custo base + lucro desejado
  const subtotalNecessario = Number((custoBase + lucroDesejado).toFixed(4));

  // Taxas percentuais somadas
  const totalTaxasPercentual = Number((imposto + taxaPagamento + comissaoMarketplace).toFixed(4));

  // Validação: taxas não podem ser iguais ou superiores a 100%
  if (totalTaxasPercentual >= 100) {
    return {
      custoProducao,
      embalagem,
      outrosCustos,
      custoBase,
      margemLucro,
      lucroDesejado,
      subtotalNecessario,
      totalTaxasPercentual,
      impostoPercentual: imposto,
      impostoValor: 0,
      taxaPagamentoPercentual: taxaPagamento,
      taxaPagamentoValor: 0,
      marketplacePercentual: comissaoMarketplace,
      marketplaceValor: 0,
      precoVenda: 0,
      precoVendaSemArredondamento: 0,
      lucroLiquido: 0,
      margemEfetiva: 0,
      erro: 'As taxas não podem ser iguais ou superiores a 100%.'
    };
  }

  // Preço de venda = Subtotal necessário ÷ (1 - taxas / 100)
  const fatorTaxas = 1 - (totalTaxasPercentual / 100);
  const precoVendaCalculado = fatorTaxas > 0 ? (subtotalNecessario / fatorTaxas) : 0;

  const precoVendaSemArredondamento = Number(precoVendaCalculado.toFixed(2));
  const precoVendaFinal = applyCommercialRounding(precoVendaCalculado, !!input.arredondamentoComercial);

  // Valores nominais das taxas deduzidas sobre o preço de venda final
  const impostoValor = Number((precoVendaFinal * (imposto / 100)).toFixed(2));
  const taxaPagamentoValor = Number((precoVendaFinal * (taxaPagamento / 100)).toFixed(2));
  const marketplaceValor = Number((precoVendaFinal * (comissaoMarketplace / 100)).toFixed(2));

  const totalDeducoes = custoBase + impostoValor + taxaPagamentoValor + marketplaceValor;
  const lucroLiquido = Number(Math.max(0, precoVendaFinal - totalDeducoes).toFixed(2));
  const margemEfetiva = custoBase > 0 ? Number(((lucroLiquido / custoBase) * 100).toFixed(1)) : margemLucro;

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
    precoVenda: precoVendaFinal,
    precoVendaSemArredondamento,
    lucroLiquido,
    margemEfetiva
  };
}
