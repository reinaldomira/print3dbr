import { calculateSalePrice } from './pricingCalculator';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('--- EXECUTANDO TESTES FINANCEIROS ---');

// Teste 1: Orçamento sem desconto
console.log('\nTeste 1: Orçamento sem desconto');
const r1 = calculateSalePrice({
  custoProducao: 100,
  embalagem: 0,
  outrosCustos: 0,
  imposto: 0,
  taxaPagamento: 0,
  comissaoMarketplace: 0,
  margemLucro: 40 // 40% de lucro sobre o custo
});
assert(r1.custoBase === 100, `Custo base esperado 100, obtido ${r1.custoBase}`);
assert(r1.lucroDesejado === 40, `Lucro desejado esperado 40, obtido ${r1.lucroDesejado}`);
assert(r1.precoBaseVenda === 140, `Preço base de venda esperado 140, obtido ${r1.precoBaseVenda}`);
assert(r1.totalFinal === 140, `Total final esperado 140, obtido ${r1.totalFinal}`);
assert(r1.lucroLiquido === 40, `Lucro líquido esperado 40, obtido ${r1.lucroLiquido}`);
// Margem efetiva sobre a venda: 40 / 140 = 28.57% -> 28.6%
assert(r1.margemEfetiva === 28.6, `Margem sobre a venda esperada 28.6%, obtida ${r1.margemEfetiva}%`);

// Teste 2: Orçamento com desconto percentual
console.log('\nTeste 2: Orçamento com desconto percentual (10%)');
const r2 = calculateSalePrice({
  custoProducao: 100,
  embalagem: 0,
  outrosCustos: 0,
  imposto: 6,
  taxaPagamento: 4,
  comissaoMarketplace: 10, // Total taxas = 20%
  margemLucro: 40,
  tipoDesconto: 'porcentagem',
  descontoPercentual: 10
});
// Sem desconto: subtotal = 140, taxas = 20% -> precoBase = 140 / 0.8 = 175
assert(r2.precoBaseVenda === 175, `Preço base esperado 175, obtido ${r2.precoBaseVenda}`);
// Desconto 10% = 17.50 -> totalFinal = 157.50
assert(r2.descontoValor === 17.50, `Desconto esperado 17.50, obtido ${r2.descontoValor}`);
assert(r2.totalFinal === 157.50, `Total final esperado 157.50, obtido ${r2.totalFinal}`);
// Taxas sobre 157.50: 20% = 31.50 (imposto 9.45, taxa 6.30, mkt 15.75)
assert(r2.impostoValor === 9.45, `Imposto esperado 9.45, obtido ${r2.impostoValor}`);
assert(r2.taxaPagamentoValor === 6.30, `Taxa pagamento esperada 6.30, obtida ${r2.taxaPagamentoValor}`);
assert(r2.marketplaceValor === 15.75, `Marketplace esperado 15.75, obtido ${r2.marketplaceValor}`);
assert(r2.totalTaxasValor === 31.50, `Total taxas esperado 31.50, obtido ${r2.totalTaxasValor}`);
// Lucro líquido: 157.50 - (100 + 31.50) = 26.00
assert(r2.lucroLiquido === 26.00, `Lucro líquido esperado 26.00, obtido ${r2.lucroLiquido}`);
// Margem efetiva sobre a venda: 26 / 157.50 = 16.51% -> 16.5%
assert(r2.margemEfetiva === 16.5, `Margem efetiva esperada 16.5%, obtida ${r2.margemEfetiva}%`);

// Teste 3: Orçamento com desconto em valor fixo
console.log('\nTeste 3: Orçamento com desconto em valor fixo (R$ 20,00)');
const r3 = calculateSalePrice({
  custoProducao: 100,
  imposto: 6,
  taxaPagamento: 4,
  comissaoMarketplace: 10,
  margemLucro: 40,
  tipoDesconto: 'valor',
  descontoValorFixo: 20
});
// precoBase = 175, desconto = 20 -> totalFinal = 155
assert(r3.totalFinal === 155.00, `Total final esperado 155, obtido ${r3.totalFinal}`);
// Taxas 20% sobre 155 = 31.00 (imposto 9.30, taxa 6.20, mkt 15.50)
assert(r3.totalTaxasValor === 31.00, `Total taxas esperado 31.00, obtido ${r3.totalTaxasValor}`);
// Lucro líquido: 155 - (100 + 31) = 24.00
assert(r3.lucroLiquido === 24.00, `Lucro líquido esperado 24.00, obtido ${r3.lucroLiquido}`);
// Margem efetiva: 24 / 155 = 15.48% -> 15.5%
assert(r3.margemEfetiva === 15.5, `Margem efetiva esperada 15.5%, obtida ${r3.margemEfetiva}%`);

// Teste 4: Orçamento em que o desconto gera prejuízo (NÃO pode limitar lucro a zero)
console.log('\nTeste 4: Orçamento com desconto gerando prejuízo real');
const r4 = calculateSalePrice({
  custoProducao: 100,
  imposto: 6,
  taxaPagamento: 4,
  comissaoMarketplace: 10,
  margemLucro: 40,
  tipoDesconto: 'valor',
  descontoValorFixo: 80
});
// precoBase = 175, desconto = 80 -> totalFinal = 95
assert(r4.totalFinal === 95.00, `Total final esperado 95, obtido ${r4.totalFinal}`);
// Taxas 20% sobre 95 = 19.00
assert(r4.totalTaxasValor === 19.00, `Total taxas esperado 19.00, obtido ${r4.totalTaxasValor}`);
// Deduções = 100 + 19 = 119.00 -> Lucro líquido = 95 - 119 = -24.00
assert(r4.lucroLiquido === -24.00, `Lucro líquido com prejuízo esperado -24.00, obtido ${r4.lucroLiquido}`);
// Margem efetiva: (-24 / 95) * 100 = -25.26% -> -25.3%
assert(r4.margemEfetiva === -25.3, `Margem negativa esperada -25.3%, obtida ${r4.margemEfetiva}%`);

// Teste 5: Orçamento com imposto e comissão configurados (Exemplo do enunciado)
console.log('\nTeste 5: Orçamento com imposto e taxas configuradas (Exemplo da especificação)');
const r5 = calculateSalePrice({
  custoProducao: 20,
  embalagem: 1.5,
  outrosCustos: 0,
  margemLucro: 40,
  imposto: 6,
  taxaPagamento: 3.99,
  comissaoMarketplace: 0
});
assert(r5.custoBase === 21.50, `Custo base esperado 21.50, obtido ${r5.custoBase}`);
assert(r5.lucroDesejado === 8.60, `Lucro desejado esperado 8.60, obtido ${r5.lucroDesejado}`);
assert(r5.subtotalNecessario === 30.10, `Subtotal necessário esperado 30.10, obtido ${r5.subtotalNecessario}`);
assert(r5.totalTaxasPercentual === 9.99, `Total de taxas esperado 9.99%, obtido ${r5.totalTaxasPercentual}%`);
assert(r5.precoBaseVenda === 33.44 || r5.precoBaseVenda === 33.43, `Preço de venda esperado ~33.44, obtido ${r5.precoBaseVenda}`);
assert(Math.abs(r5.lucroLiquido - 8.60) < 0.05, `Lucro líquido esperado ~8.60, obtido ${r5.lucroLiquido}`);

// Teste 6: Desconto extremo nunca produz total negativo
console.log('\nTeste 6: Desconto extremo não produz total negativo');
const r6 = calculateSalePrice({
  custoProducao: 100,
  margemLucro: 40,
  tipoDesconto: 'valor',
  descontoValorFixo: 500
});
assert(r6.totalFinal === 0, `Total final não pode ser negativo, obtido ${r6.totalFinal}`);
assert(r6.descontoValor === 140, `Desconto efetivo não deve ultrapassar o preço base (140), obtido ${r6.descontoValor}`);
assert(r6.lucroLiquido === -100, `Lucro líquido esperado -100 (perda total do custo), obtido ${r6.lucroLiquido}`);

console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!\n');
