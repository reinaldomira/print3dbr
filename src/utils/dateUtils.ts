import { Pedido } from '../types';
import { isFaturadoStatus } from './statusUtils';

const MONTH_MAP: Record<string, number> = {
  janeiro: 0, jan: 0,
  fevereiro: 1, fev: 1,
  março: 2, marco: 2, mar: 2,
  abril: 3, abr: 3,
  maio: 4, mai: 4,
  junho: 5, jun: 5,
  julho: 6, jul: 6,
  agosto: 7, ago: 7,
  setembro: 8, set: 8,
  outubro: 9, out: 9,
  novembro: 10, nov: 10,
  dezembro: 11, dez: 11,
};

export function parsePedidoDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const str = dateStr.trim();

  // Pattern 1: ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  // Pattern 2: DD/MM/YYYY or DD/MM/YY
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  // Pattern 3: "22 de Outubro, 2023 - 14:30" or "22 de Outubro de 2023"
  const ptMatch = str.toLowerCase().match(/(\d{1,2})\s+de\s+([a-zç]+),?\s+(\d{4})/);
  if (ptMatch) {
    const day = parseInt(ptMatch[1], 10);
    const monthName = ptMatch[2];
    const year = parseInt(ptMatch[3], 10);
    const month = MONTH_MAP[monthName] ?? 0;
    return new Date(year, month, day);
  }

  // Fallback Native Date parse
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export type PeriodFilterType = 'todos' | 'hoje' | 'semana' | 'mes' | 'mes_passado' | 'custom';

export function isOrderInPeriod(
  dateStr: string,
  period: PeriodFilterType,
  startDate?: string,
  endDate?: string
): boolean {
  if (period === 'todos') return true;

  const orderDate = parsePedidoDate(dateStr);
  if (!orderDate) return true;

  const now = new Date();

  if (period === 'hoje') {
    return (
      orderDate.getFullYear() === now.getFullYear() &&
      orderDate.getMonth() === now.getMonth() &&
      orderDate.getDate() === now.getDate()
    );
  }

  if (period === 'semana') {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    return orderDate >= sevenDaysAgo;
  }

  if (period === 'mes') {
    return (
      orderDate.getFullYear() === now.getFullYear() &&
      orderDate.getMonth() === now.getMonth()
    );
  }

  if (period === 'mes_passado') {
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return (
      orderDate.getFullYear() === lastMonthDate.getFullYear() &&
      orderDate.getMonth() === lastMonthDate.getMonth()
    );
  }

  if (period === 'custom') {
    if (startDate) {
      const start = new Date(startDate + 'T00:00:00');
      if (orderDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate + 'T23:59:59');
      if (orderDate > end) return false;
    }
    return true;
  }

  return true;
}

export interface PaymentBreakdown {
  metodo: string;
  label: string;
  count: number;
  total: number;
  percentage: number;
}

export interface ItemBreakdown {
  descricao: string;
  qtdTotal: number;
  valorTotal: number;
}

export interface ConsolidatedReportData {
  periodLabel: string;
  totalPedidos: number;
  totalFaturados: number;
  totalPendentes: number;
  faturamentoTotal: number;
  valorPendente: number;
  ticketMedio: number;
  totalPecasImpressas: number;
  formaPagamentoMaisUsada: PaymentBreakdown | null;
  paymentBreakdown: PaymentBreakdown[];
  topItems: ItemBreakdown[];
}

export function calculateConsolidatedReport(
  pedidos: Pedido[],
  periodLabel: string
): ConsolidatedReportData {
  const faturados = pedidos.filter((p) => isFaturadoStatus(p.status));
  const pendentes = pedidos.filter((p) => p.status === 'pendente');

  const faturamentoTotal = faturados.reduce((acc, p) => acc + p.total, 0);
  const valorPendente = pendentes.reduce((acc, p) => acc + p.total, 0);
  const ticketMedio = faturados.length > 0 ? faturamentoTotal / faturados.length : 0;

  // Total items / 3D printed pieces count
  let totalPecasImpressas = 0;
  const itemMap: Record<string, ItemBreakdown> = {};

  pedidos.forEach((p) => {
    // Count pieces only for active non-canceled orders
    if (p.status !== 'cancelado') {
      p.itens.forEach((item) => {
        const qty = item.qtd || (item as any).quantidade || 1;
        totalPecasImpressas += qty;

        const descKey = item.descricao.trim().toLowerCase();
        if (!itemMap[descKey]) {
          itemMap[descKey] = {
            descricao: item.descricao,
            qtdTotal: 0,
            valorTotal: 0,
          };
        }
        itemMap[descKey].qtdTotal += qty;
        itemMap[descKey].valorTotal += qty * (item.valorUnitario || 0);
      });
    }
  });

  const topItems = Object.values(itemMap)
    .sort((a, b) => b.qtdTotal - a.qtdTotal)
    .slice(0, 5);

  // Payment method breakdown
  const paymentStats: Record<string, { label: string; count: number; total: number }> = {
    pix: { label: 'Pix', count: 0, total: 0 },
    cartao: { label: 'Cartão de Crédito/Débito', count: 0, total: 0 },
    dinheiro: { label: 'Dinheiro', count: 0, total: 0 },
    outro: { label: 'Outro', count: 0, total: 0 },
  };

  faturados.forEach((p) => {
    const method = p.metodoPagamento || 'pix';
    if (!paymentStats[method]) {
      paymentStats[method] = { label: method.toUpperCase(), count: 0, total: 0 };
    }
    paymentStats[method].count += 1;
    paymentStats[method].total += p.total;
  });

  const paymentBreakdown: PaymentBreakdown[] = Object.entries(paymentStats)
    .map(([metodo, stat]) => ({
      metodo,
      label: stat.label,
      count: stat.count,
      total: stat.total,
      percentage: faturamentoTotal > 0 ? (stat.total / faturamentoTotal) * 100 : 0,
    }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.total - a.total);

  const formaPagamentoMaisUsada = paymentBreakdown.length > 0 ? paymentBreakdown[0] : null;

  return {
    periodLabel,
    totalPedidos: pedidos.length,
    totalFaturados: faturados.length,
    totalPendentes: pendentes.length,
    faturamentoTotal,
    valorPendente,
    ticketMedio,
    totalPecasImpressas,
    formaPagamentoMaisUsada,
    paymentBreakdown,
    topItems,
  };
}
