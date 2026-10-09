import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Inicio } from './components/Inicio';
import { NovaNota } from './components/NovaNota';
import { Pedidos } from './components/Pedidos';
import { Ajustes } from './components/Ajustes';
import { Tab } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('inicio');

  return (
    <div className="min-h-screen flex flex-col md:flex-row pb-[72px] md:pb-0 pt-[64px] md:pt-0">
      <Sidebar currentTab={currentTab} setTab={setCurrentTab} />
      
      <main className="flex-1 md:ml-64 p-4 md:p-10 w-full max-w-[1440px] mx-auto">
        {currentTab === 'inicio' && <Inicio onNavigate={setCurrentTab} />}
        {currentTab === 'nova-nota' && <NovaNota onNavigate={setCurrentTab} />}
        {currentTab === 'pedidos' && <Pedidos onNavigate={setCurrentTab} />}
        {currentTab === 'ajustes' && <Ajustes />}
      </main>
    </div>
  );
}
