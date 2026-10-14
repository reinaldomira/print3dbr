export type Tab = 'inicio' | 'nova-nota' | 'pedidos' | 'clientes' | 'ajustes';

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  cidade?: string;
  observacoes?: string;
  criadoEm: string;
  ownerUid?: string;
}

export type PedidoStatus = 
  | 'pendente' 
  | 'na_fila' 
  | 'imprimindo' 
  | 'acabamento' 
  | 'pronto' 
  | 'entregue' 
  | 'aprovado' 
  | 'cancelado';

export interface PedidoItem {
  id: string;
  descricao: string;
  qtd: number;
  valorUnitario: number;
  imagemUrl?: string;
}

export interface FinancialConfig {
  imposto: number; // % (ex: 6)
  taxaPagamento: number; // % (ex: 3.99)
  comissaoMarketplace: number; // % (ex: 20)
  embalagem: number; // R$ (ex: 1.50)
  outrosCustos: number; // R$ (ex: 0)
  margemLucro: number; // % (ex: 40)
  arredondamentoComercial?: boolean;
}

export interface PricingBreakdown {
  custoProducao: number;
  embalagem: number;
  outrosCustos: number;
  custoBase: number;
  margemLucro: number; // % sobre o custo (markup)
  lucroDesejado: number;
  subtotalNecessario: number;
  totalTaxasPercentual: number;
  impostoPercentual: number;
  impostoValor: number;
  taxaPagamentoPercentual: number;
  taxaPagamentoValor: number;
  marketplacePercentual: number;
  marketplaceValor: number;
  totalTaxasValor?: number;
  precoBaseVenda?: number;
  descontoValor?: number;
  descontoPercentual?: number;
  precoVenda: number; // Preço final cobrado
  lucroLiquido: number; // Real, pode ser negativo se houver prejuízo
  margemEfetiva: number; // % sobre o valor final cobrado (venda)
  lucroSobreCustoEfetivo?: number; // % sobre o custo base
  erro?: string;
}

export interface Pedido {
  id: string;
  cliente: string;
  telefone: string;
  itens: PedidoItem[];
  observacoes: string;
  metodoPagamento: 'pix' | 'cartao' | 'dinheiro' | 'outro';
  data: string;
  total: number;
  desconto?: number;
  descontoPercentual?: number;
  status?: PedidoStatus;
  custosFinanceiros?: FinancialConfig;
  detalhesPrecificacao?: PricingBreakdown;
  ownerUid?: string; // UID do usuário autenticado no Firebase
}

