import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Inicio } from './components/Inicio';
import { NovaNota } from './components/NovaNota';
import { Pedidos } from './components/Pedidos';
import { Clientes } from './components/Clientes';
import { Ajustes } from './components/Ajustes';
import { Tab } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('inicio');
  const [clientePreSelecionado, setClientePreSelecionado] = useState<{ nome: string; telefone: string } | null>(null);

  const handleSelectClienteForNota = (cliente: { nome: string; telefone: string }) => {
    setClientePreSelecionado(cliente);
    setCurrentTab('nova-nota');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row pb-[72px] md:pb-0 pt-[64px] md:pt-0">
      <Sidebar currentTab={currentTab} setTab={setCurrentTab} />
      
      <main className="flex-1 md:ml-64 p-4 md:p-10 w-full max-w-[1440px] mx-auto">
        {currentTab === 'inicio' && <Inicio onNavigate={setCurrentTab} />}
        {currentTab === 'nova-nota' && (
          <NovaNota 
            onNavigate={setCurrentTab} 
            initialCliente={clientePreSelecionado} 
          />
        )}
        {currentTab === 'pedidos' && <Pedidos onNavigate={setCurrentTab} />}
        {currentTab === 'clientes' && (
          <Clientes 
            onNavigate={setCurrentTab} 
            onSelectClienteForNota={handleSelectClienteForNota} 
          />
        )}
        {currentTab === 'ajustes' && <Ajustes />}
      </main>
    </div>
  );
}
