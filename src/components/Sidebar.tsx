import React, { useState, useEffect } from 'react';
import { LayoutDashboard, PlusCircle, FileText, Users, Settings, Bell, UserCircle, Box } from 'lucide-react';
import { Tab } from '../types';
import { getStoredSettings, SystemSettings } from '../utils/settingsStorage';

interface SidebarProps {
  currentTab: Tab;
  setTab: (tab: Tab) => void;
}

export function Sidebar({ currentTab, setTab }: SidebarProps) {
  const [settings, setSettings] = useState<SystemSettings>(getStoredSettings());

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSettings(getStoredSettings());
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  const navItems = [
    { id: 'inicio', label: 'Início', icon: LayoutDashboard },
    { id: 'nova-nota', label: 'Nova Nota', icon: PlusCircle },
    { id: 'pedidos', label: 'Pedidos', icon: FileText },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'ajustes', label: 'Ajustes', icon: Settings },
  ] as const;

  return (
    <>
      {/* Mobile Top App Bar */}
      <header className="md:hidden bg-surface border-b border-outline-variant fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 py-2 h-16">
        <div className="flex items-center gap-2">
          {settings.logotipoUrl ? (
            <img src={settings.logotipoUrl} alt="Logo" className="w-8 h-8 object-contain rounded bg-white p-0.5" />
          ) : (
            <Box className="w-6 h-6 text-primary" />
          )}
          <span className="font-bold text-primary text-lg truncate max-w-[180px]">{settings.nomeEmpresa}</span>
        </div>
        <div className="flex space-x-4">
          <Bell className="text-primary w-6 h-6" />
          <UserCircle className="text-primary w-6 h-6" />
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-surface-container flex-col border-r border-outline-variant h-screen fixed top-0 left-0 z-40">
        <div className="p-6 border-b border-outline-variant flex items-center gap-3">
          {settings.logotipoUrl ? (
            <div className="w-10 h-10 rounded bg-white p-1 border border-outline-variant shrink-0 flex items-center justify-center">
              <img src={settings.logotipoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded bg-primary-container text-on-primary-container shrink-0 flex items-center justify-center">
              <Box className="w-6 h-6 text-primary" />
            </div>
          )}
          <div className="overflow-hidden">
            <h1 className="text-xl text-primary font-bold truncate" title={settings.nomeEmpresa}>{settings.nomeEmpresa}</h1>
            <p className="text-xs text-on-surface-variant truncate" title={settings.subtituloEmpresa}>{settings.subtituloEmpresa}</p>
          </div>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm transition-colors cursor-pointer ${
                currentTab === item.id
                  ? 'bg-primary-container text-on-primary-container font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              } ${item.id === 'ajustes' ? 'mt-auto' : ''}`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden bg-surface-container fixed bottom-0 left-0 w-full z-50 border-t border-outline-variant flex justify-around items-center px-4 pb-4 pt-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex flex-col items-center justify-center p-2 transition-transform active:scale-90 cursor-pointer ${
              currentTab === item.id
                ? 'bg-primary-container text-on-primary-container rounded-full px-4 py-1 font-bold'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <item.icon className="w-6 h-6 mb-1" />
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
