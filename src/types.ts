export type Tab = 'inicio' | 'nova-nota' | 'pedidos' | 'ajustes';

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
  lucroLiquido: number;
  margemEfetiva: number;
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
}

