import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Package, 
  DollarSign, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Eye,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { 
  AreaChart,
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Tab, Pedido } from '../types';
import { getStoredPedidos } from '../utils/ordersStorage';
import { ComprovanteView } from './ComprovanteView';
import { isFaturadoStatus } from '../utils/statusUtils';

interface InicioProps {
  onNavigate?: (tab: Tab) => void;
}

export function Inicio({ onNavigate }: InicioProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);

  const reloadData = () => {
    const data = getStoredPedidos();
    setPedidos(data);
  };

  useEffect(() => {
    reloadData();
    window.addEventListener('ordersUpdated', reloadData);
    return () => window.removeEventListener('ordersUpdated', reloadData);
  }, []);

  const recentes = useMemo(() => pedidos.slice(0, 5), [pedidos]);

  // Faturamento e métricas considerando apenas pedidos FATURADOS / ATIVOS
  const faturamentoTotal = useMemo(() => {
    return pedidos
      .filter(p => isFaturadoStatus(p.status))
      .reduce((acc, p) => acc + p.total, 0);
  }, [pedidos]);

  const faturamentoPendente = useMemo(() => {
    return pedidos
      .filter(p => p.status === 'pendente')
      .reduce((acc, p) => acc + p.total, 0);
  }, [pedidos]);

  const pedidosPendentesCount = useMemo(() => {
    return pedidos.filter(p => p.status === 'pendente').length;
  }, [pedidos]);

  const vendasAprovadasCount = useMemo(() => {
    return pedidos.filter(p => isFaturadoStatus(p.status)).length;
  }, [pedidos]);

  const totalPedidosCount = pedidos.length;

  const ticketMedio = useMemo(() => {
    return vendasAprovadasCount > 0 ? faturamentoTotal / vendasAprovadasCount : 0;
  }, [faturamentoTotal, vendasAprovadasCount]);

  // Dynamic Chart Data generation based on real Pedidos
  const chartData = useMemo(() => {
    if (pedidos.length === 0) {
      return [
        { name: 'Seg', faturado: 0, pendente: 0 },
        { name: 'Ter', faturado: 0, pendente: 0 },
        { name: 'Qua', faturado: 0, pendente: 0 },
        { name: 'Qui', faturado: 0, pendente: 0 },
        { name: 'Sex', faturado: 0, pendente: 0 },
        { name: 'Sáb', faturado: 0, pendente: 0 },
        { name: 'Dom', faturado: 0, pendente: 0 },
      ];
    }

    // Group pedidos by date label or extract dates
    const grouped: { [key: string]: { label: string; faturado: number; pendente: number } } = {};

    pedidos.slice().reverse().forEach(p => {
      const isAprovado = (p.status || 'aprovado') === 'aprovado';
      let label = p.data ? p.data.split('-')[0].trim() : p.id;
      
      // Simplify label if too long e.g. "22 de Outubro, 2023" -> "22 Out"
      const match = label.match(/(\d{1,2})\s+de\s+([A-Za-zç]+)/i);
      if (match) {
        label = `${match[1]} ${match[2].substring(0, 3)}`;
      }

      if (!grouped[label]) {
        grouped[label] = { label, faturado: 0, pendente: 0 };
      }

      if (isAprovado) {
        grouped[label].faturado += p.total;
      } else {
        grouped[label].pendente += p.total;
      }
    });

    return Object.values(grouped).map(item => ({
      name: item.label,
      faturado: Number(item.faturado.toFixed(2)),
      pendente: Number(item.pendente.toFixed(2)),
    }));
  }, [pedidos]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-on-surface">Dashboard</h2>
          <p className="text-on-surface-variant mt-1 text-sm">Visão geral em tempo real do seu negócio de impressão 3D.</p>
        </div>

        {onNavigate && (
          <button 
            onClick={() => onNavigate('nova-nota')}
            className="bg-primary-container hover:bg-primary-fixed text-on-primary-container px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 text-sm transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>NOVA VENDA</span>
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Faturamento Faturado" 
          value={`R$ ${formatCurrency(faturamentoTotal)}`} 
          trend={`${vendasAprovadasCount} vendas concluídas`} 
          isPositive={true} 
          icon={DollarSign} 
        />
        <MetricCard 
          title="Aguardando Aprovação" 
          value={`${pedidosPendentesCount} (${pedidosPendentesCount === 1 ? '1 pedido' : `${pedidosPendentesCount} pedidos`})`} 
          subtitle={`R$ ${formatCurrency(faturamentoPendente)} em orçamentos`}
          trend="Pendente" 
          isWarning={pedidosPendentesCount > 0}
          isPositive={false} 
          icon={Clock} 
        />
        <MetricCard 
          title="Total de Pedidos" 
          value={totalPedidosCount.toString()} 
          trend={`${vendasAprovadasCount} faturados / ${pedidosPendentesCount} pendentes`} 
          isPositive={true} 
          icon={Package} 
        />
        <MetricCard 
          title="Ticket Médio (Faturado)" 
          value={`R$ ${formatCurrency(ticketMedio)}`} 
          trend="Calculado por venda faturada" 
          isPositive={true} 
          icon={TrendingUp} 
        />
      </div>

      {/* Main Revenue Chart (Full Width) */}
      <div className="bg-surface-container-low border border-outline-variant rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 border-b border-outline-variant pb-4">
          <div>
            <h3 className="text-base font-semibold text-on-surface uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Evolução do Faturamento por Período
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Valores contabilizados em reais (R$) com base nas vendas cadastradas no sistema.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
              <span className="text-on-surface">Faturado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              <span className="text-on-surface">Orçamentos</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFaturado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0066ff" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#0066ff" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorPendente" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2D35" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#8c90a1" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                stroke="#8c90a1" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(value) => `R$${value}`} 
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-surface-container-highest border border-outline-variant p-3 rounded-lg shadow-xl text-xs font-mono">
                        <p className="font-bold text-on-surface mb-1 text-sm">{label}</p>
                        {payload.map((entry: any, index: number) => (
                          <div key={index} className="flex justify-between gap-4 py-0.5" style={{ color: entry.color }}>
                            <span>{entry.name === 'faturado' ? 'Faturado:' : 'Orçamentos:'}</span>
                            <span className="font-bold">R$ {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="faturado" 
                name="faturado"
                stroke="#0066ff" 
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorFaturado)"
              />
              <Area 
                type="monotone" 
                dataKey="pendente" 
                name="pendente"
                stroke="#f59e0b" 
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#colorPendente)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Orders Table preview */}
      <div className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-sm">
         <div className="px-6 py-4 bg-surface-container border-b border-outline-variant flex items-center justify-between">
           <div className="flex items-center gap-2">
             <ShoppingBag className="w-4 h-4 text-primary" />
             <h3 className="text-sm font-medium text-on-surface uppercase tracking-wider">Últimas Vendas Realizadas</h3>
           </div>
           {onNavigate && (
             <button 
               onClick={() => onNavigate('pedidos')}
               className="text-xs font-bold text-primary hover:text-primary-fixed-dim transition-colors uppercase tracking-wider cursor-pointer"
             >
               Ver Histórico Completo &rarr;
             </button>
           )}
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high border-b border-outline-variant text-xs text-on-surface-variant font-mono">
                  <th className="py-3 px-6 font-normal">ID</th>
                  <th className="py-3 px-6 font-normal">CLIENTE</th>
                  <th className="py-3 px-6 font-normal">STATUS</th>
                  <th className="py-3 px-6 font-normal">DATA</th>
                  <th className="py-3 px-6 font-normal text-right">VALOR</th>
                  <th className="py-3 px-6 font-normal text-center">AÇÃO</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-outline-variant">
                 {recentes.length > 0 ? (
                   recentes.map((p) => {
                     const isPendente = p.status === 'pendente';
                     return (
                       <tr 
                         key={p.id} 
                         onClick={() => setSelectedPedido(p)}
                         className="border-b border-outline-variant hover:bg-surface-container-highest transition-colors cursor-pointer group"
                       >
                         <td className="py-3.5 px-6 font-mono text-primary font-bold group-hover:underline">{p.id}</td>
                         <td className="py-3.5 px-6 font-semibold text-on-surface">{p.cliente}</td>
                         <td className="py-3.5 px-6">
                           {isPendente ? (
                             <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                               <Clock className="w-3 h-3" /> Pendente
                             </span>
                           ) : (
                             <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                               <CheckCircle2 className="w-3 h-3" /> Faturado
                             </span>
                           )}
                         </td>
                         <td className="py-3.5 px-6 text-on-surface-variant text-xs">{p.data}</td>
                         <td className="py-3.5 px-6 text-right font-mono font-bold text-secondary-container">R$ {formatCurrency(p.total)}</td>
                         <td className="py-3.5 px-6 text-center">
                           <span className="inline-flex items-center gap-1 text-xs font-mono text-primary group-hover:underline">
                             <Eye className="w-3.5 h-3.5" /> Ver PDF
                           </span>
                         </td>
                       </tr>
                     );
                   })
                 ) : (
                   <tr>
                     <td colSpan={6} className="py-12 px-6 text-center">
                       <div className="flex flex-col items-center justify-center gap-3">
                         <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant border border-outline-variant">
                           <ShoppingBag className="w-6 h-6 text-primary" />
                         </div>
                         <div>
                           <div className="font-semibold text-on-surface text-base">Nenhum pedido registrado ainda</div>
                           <div className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto">
                             Crie seu primeiro orçamento ou pedido 3D para acompanhar faturamento, métricas e histórico em tempo real.
                           </div>
                         </div>
                         {onNavigate && (
                           <button
                             onClick={() => onNavigate('nova-nota')}
                             className="mt-2 px-4 py-2 bg-primary-container text-on-primary-container hover:bg-primary-fixed rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                           >
                             <Plus className="w-3.5 h-3.5" />
                             <span>CRIAR PRIMEIRO PEDIDO</span>
                           </button>
                         )}
                       </div>
                     </td>
                   </tr>
                 )}
              </tbody>
            </table>
         </div>
      </div>

      {/* Modal preview order directly from Inicio */}
      {selectedPedido && (
        <ComprovanteView 
          pedido={selectedPedido}
          onClose={() => setSelectedPedido(null)}
        />
      )}

    </div>
  );
}

function MetricCard({ title, value, subtitle, trend, isPositive, isWarning, icon: Icon }: any) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg p-5 flex flex-col justify-between gap-4 shadow-sm">
      <div className="flex justify-between items-start">
        <h4 className="text-xs font-mono text-on-surface-variant uppercase tracking-wider">{title}</h4>
        <div className={`p-2 rounded border ${isWarning ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-surface-container border-outline-variant text-primary'}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-on-surface mb-1">{value}</div>
        {subtitle && (
          <div className="text-xs font-mono text-amber-400/90 mb-1">{subtitle}</div>
        )}
        <div className={`flex items-center text-xs font-medium ${isWarning ? 'text-amber-400 font-semibold' : isPositive ? 'text-secondary-container' : 'text-on-surface-variant'}`}>
          {isWarning ? <Clock className="w-3 h-3 mr-1" /> : isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {trend}
        </div>
      </div>
    </div>
  );
}
