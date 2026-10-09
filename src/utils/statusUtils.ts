import { PedidoStatus } from '../types';

export interface StatusConfig {
  key: PedidoStatus;
  label: string;
  shortLabel: string;
  emoji: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  badgeClass: string;
  description: string;
  isFaturado: boolean;
  stepOrder: number;
}

export const STATUS_LIST: StatusConfig[] = [
  {
    key: 'pendente',
    label: 'Aguardando Aprovação',
    shortLabel: 'Aguardando',
    emoji: '🟡',
    bgColor: 'bg-amber-500/15',
    textColor: 'text-amber-300',
    borderColor: 'border-amber-500/30',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    description: 'Orçamento enviado, aguardando aprovação do cliente.',
    isFaturado: false,
    stepOrder: 1,
  },
  {
    key: 'na_fila',
    label: 'Na Fila de Impressão',
    shortLabel: 'Na Fila',
    emoji: '🔵',
    bgColor: 'bg-blue-500/15',
    textColor: 'text-blue-300',
    borderColor: 'border-blue-500/30',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    description: 'Pedido aprovado e na fila de fatiamento/impressão.',
    isFaturado: true,
    stepOrder: 2,
  },
  {
    key: 'imprimindo',
    label: 'Imprimindo',
    shortLabel: 'Imprimindo',
    emoji: '⚙️',
    bgColor: 'bg-cyan-500/15',
    textColor: 'text-cyan-300',
    borderColor: 'border-cyan-500/30',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    description: 'Peças sendo produzidas na impressora 3D.',
    isFaturado: true,
    stepOrder: 3,
  },
  {
    key: 'acabamento',
    label: 'Em Acabamento / Pós-processamento',
    shortLabel: 'Acabamento',
    emoji: '🛠️',
    bgColor: 'bg-orange-500/15',
    textColor: 'text-orange-300',
    borderColor: 'border-orange-500/30',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    description: 'Remoção de suportes, lixamento ou pintura.',
    isFaturado: true,
    stepOrder: 4,
  },
  {
    key: 'pronto',
    label: 'Pronto para Envio / Retirada',
    shortLabel: 'Pronto',
    emoji: '📦',
    bgColor: 'bg-teal-500/15',
    textColor: 'text-teal-300',
    borderColor: 'border-teal-500/30',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    description: 'Peça embalada e pronta para retirada ou envio.',
    isFaturado: true,
    stepOrder: 5,
  },
  {
    key: 'entregue',
    label: 'Entregue',
    shortLabel: 'Entregue',
    emoji: '✅',
    bgColor: 'bg-emerald-500/15',
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-500/30',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    description: 'Pedido finalizado e entregue ao cliente.',
    isFaturado: true,
    stepOrder: 6,
  },
  {
    key: 'cancelado',
    label: 'Cancelado',
    shortLabel: 'Cancelado',
    emoji: '❌',
    bgColor: 'bg-red-500/15',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
    description: 'Pedido cancelado.',
    isFaturado: false,
    stepOrder: 99,
  }
];

export function getStatusConfig(status?: PedidoStatus | string): StatusConfig {
  if (!status || status === 'aprovado') {
    return {
      key: 'na_fila',
      label: 'Na Fila de Impressão',
      shortLabel: 'Aprovado',
      emoji: '🔵',
      bgColor: 'bg-blue-500/15',
      textColor: 'text-blue-300',
      borderColor: 'border-blue-500/30',
      badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      description: 'Pedido aprovado no sistema.',
      isFaturado: true,
      stepOrder: 2,
    };
  }

  const found = STATUS_LIST.find(s => s.key === status);
  if (found) return found;

  return STATUS_LIST[0];
}

export function isFaturadoStatus(status?: PedidoStatus | string): boolean {
  if (!status) return true;
  return status !== 'pendente' && status !== 'cancelado';
}
