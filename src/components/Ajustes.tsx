import React, { useState, useEffect, useRef } from 'react';
import { Store, Upload, Contact, MessageCircle, Camera, Mail, Palette, Check, Save, QrCode, RotateCcw, CheckCircle2, Trash2, DollarSign, Percent, TrendingUp, Calculator, AlertTriangle, ShieldCheck, Tag, Lock, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { getStoredSettings, saveStoredSettings, DEFAULT_SETTINGS, SystemSettings } from '../utils/settingsStorage';
import { calculateSalePrice } from '../utils/pricingCalculator';
import { auth, subscribeToAuth, connectWithGoogle, logoutUser, setGlobalMigrationInProgress } from '../lib/firebase';
import { executeGoogleMigration } from '../utils/ordersStorage';
import { compressImage } from '../utils/imageUtils';
import { User } from 'firebase/auth';

export function Ajustes() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [logoError, setLogoError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loaded = getStoredSettings();
    setSettings(loaded);

    const unsub = subscribeToAuth((u) => {
      setCurrentUser(u);
    });
    return () => unsub();
  }, []);

  const handleChange = (field: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLogoError(null);
      const compressed = await compressImage(file, { maxDim: 256, maxBytes: 100 * 1024 });
      handleChange('logotipoUrl', compressed);
      setToastMessage('Logotipo carregado e otimizado com sucesso!');
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3500);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao processar imagem do logotipo.';
      setLogoError(msg);
      setToastMessage(msg);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 4500);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    setLogoError(null);
    handleChange('logotipoUrl', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    const result = saveStoredSettings(settings);
    if (result.logoDiscarded) {
      const msg = 'Atenção: As configurações foram salvas, mas o logotipo excedeu o limite máximo (400 KB) e não pôde ser gravado na nuvem.';
      setToastMessage(msg);
      setLogoError('O logotipo atual excede o limite máximo permitido (400 KB) para sincronização na nuvem.');
    } else {
      setToastMessage('Configurações salvas com sucesso!');
    }
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 4000);
  };

  const handleReset = () => {
    if (confirm('Deseja realmente restaurar as configurações padrão do sistema?')) {
      setSettings(DEFAULT_SETTINGS);
      saveStoredSettings(DEFAULT_SETTINGS);
      setToastMessage('Configurações restauradas para o padrão!');
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3500);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsAuthenticating(true);
      setGlobalMigrationInProgress(true);
      const authResult = await connectWithGoogle();
      const migrationRes = await executeGoogleMigration(authResult);
      
      const userName = authResult.user.displayName || authResult.user.email || 'Usuário';
      if (migrationRes.migratedCount > 0) {
        setToastMessage(`Conectado como ${userName}! ${migrationRes.migratedCount} pedido(s) sincronizado(s).`);
      } else {
        setToastMessage(`Conectado com sucesso como ${userName}!`);
      }
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 4000);
    } catch (err: any) {
      setGlobalMigrationInProgress(false);
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('cancelado')
      ) {
        setToastMessage('Conexão com Google cancelada.');
      } else {
        console.error('Erro ao conectar com Google:', err);
        setToastMessage(err?.message || 'Falha ao autenticar com Google.');
      }
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 4000);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Deseja desconectar sua conta? Os dados permanecerão salvos com segurança.')) {
      try {
        await logoutUser();
        setSettings(DEFAULT_SETTINGS);
        setToastMessage('Conta desconectada com sucesso.');
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 3500);
      } catch (err: any) {
        console.error('Erro ao desconectar:', err);
        setToastMessage('Erro ao desconectar conta.');
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 3500);
      }
    }
  };

  const colorPresets = [
    { name: 'Azul Elétrico', hex: '#0066ff' },
    { name: 'Rosa Vibrante', hex: '#ff3366' },
    { name: 'Verde Esmeralda', hex: '#00cc99' },
    { name: 'Roxo Moderno', hex: '#8b5cf6' },
    { name: 'Laranja Impressão', hex: '#f97316' },
    { name: 'Cinza Grafite', hex: '#333333' }
  ];

  return (
    <div className="w-full flex flex-col gap-6 relative">
      {/* Toast Notification */}
      {showSavedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-secondary-container text-on-secondary-container px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 border border-secondary/30 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-secondary" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-outline-variant pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-on-surface">Ajustes do Sistema</h1>
          <p className="text-on-surface-variant mt-1 text-sm">Configure os dados da sua empresa para geração de comprovantes e documentos em PDF.</p>
        </div>

        <button 
          onClick={handleReset}
          className="px-3.5 py-2 border border-outline-variant hover:bg-surface-container-high rounded-lg text-xs font-mono font-medium text-on-surface-variant hover:text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>RESTAURAR PADRÕES</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: Configurações Principais */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Configurações Financeiras */}
          <section className="bg-surface-container-low border border-primary/30 rounded-lg overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calculator className="text-primary w-5 h-5" />
                <div>
                  <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Configurações Financeiras</h3>
                  <p className="text-xs text-on-surface-variant">Valores padrão aplicados automaticamente nos novos orçamentos</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-primary/20 text-primary border border-primary/30 font-bold">
                PADRÕES
              </span>
            </div>

            <div className="p-6 flex flex-col gap-6">
              {/* Grid de Taxas e Impostos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Imposto */}
                <div className="flex flex-col gap-1.5 bg-surface-container p-3.5 rounded-lg border border-outline-variant">
                  <div className="flex justify-between items-center">
                    <label htmlFor="fin_imposto" className="text-xs font-mono font-bold text-on-surface uppercase tracking-wider">
                      Imposto
                    </label>
                    <span className="text-[10px] text-primary font-mono font-bold">% sobre venda</span>
                  </div>
                  <div className="relative">
                    <input 
                      id="fin_imposto" 
                      type="number" 
                      min="0" 
                      max="99" 
                      step="0.1"
                      value={settings.impostoPadrao === 0 ? '' : settings.impostoPadrao}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(',', '.'));
                        handleChange('impostoPadrao', isNaN(val) || val < 0 ? 0 : val);
                      }}
                      placeholder="0"
                      className="rounded-lg pl-3 pr-8 py-2 w-full focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm font-mono font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">%</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">Imposto sobre a venda</p>
                </div>

                {/* Taxa de pagamento */}
                <div className="flex flex-col gap-1.5 bg-surface-container p-3.5 rounded-lg border border-outline-variant">
                  <div className="flex justify-between items-center">
                    <label htmlFor="fin_taxa" className="text-xs font-mono font-bold text-on-surface uppercase tracking-wider">
                      Taxa de Pagamento
                    </label>
                    <span className="text-[10px] text-primary font-mono font-bold">% intermediador</span>
                  </div>
                  <div className="relative">
                    <input 
                      id="fin_taxa" 
                      type="number" 
                      min="0" 
                      max="99" 
                      step="0.01"
                      value={settings.taxaPagamentoPadrao === 0 ? '' : settings.taxaPagamentoPadrao}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(',', '.'));
                        handleChange('taxaPagamentoPadrao', isNaN(val) || val < 0 ? 0 : val);
                      }}
                      placeholder="0"
                      className="rounded-lg pl-3 pr-8 py-2 w-full focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm font-mono font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">%</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">Taxa de cartão, Pix ou intermediador</p>
                </div>

                {/* Marketplace */}
                <div className="flex flex-col gap-1.5 bg-surface-container p-3.5 rounded-lg border border-outline-variant">
                  <div className="flex justify-between items-center">
                    <label htmlFor="fin_marketplace" className="text-xs font-mono font-bold text-on-surface uppercase tracking-wider">
                      Comissão Marketplace
                    </label>
                    <span className="text-[10px] text-primary font-mono font-bold">% canal</span>
                  </div>
                  <div className="relative">
                    <input 
                      id="fin_marketplace" 
                      type="number" 
                      min="0" 
                      max="99" 
                      step="0.5"
                      value={settings.comissaoMarketplacePadrao === 0 ? '' : settings.comissaoMarketplacePadrao}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(',', '.'));
                        handleChange('comissaoMarketplacePadrao', isNaN(val) || val < 0 ? 0 : val);
                      }}
                      placeholder="0"
                      className="rounded-lg pl-3 pr-8 py-2 w-full focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm font-mono font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">%</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">Comissão de Shopee, Mercado Livre ou outro marketplace</p>
                </div>
              </div>

              {/* Grid de Custos em Reais e Margem */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Embalagem */}
                <div className="flex flex-col gap-1.5 bg-surface-container p-3.5 rounded-lg border border-outline-variant">
                  <div className="flex justify-between items-center">
                    <label htmlFor="fin_embalagem" className="text-xs font-mono font-bold text-on-surface uppercase tracking-wider">
                      Custo Padrão Embalagem
                    </label>
                    <span className="text-[10px] text-secondary font-mono font-bold">R$ por pedido</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">R$</span>
                    <input 
                      id="fin_embalagem" 
                      type="number" 
                      min="0" 
                      step="0.25"
                      value={settings.embalagemPadrao === 0 ? '' : settings.embalagemPadrao}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(',', '.'));
                        handleChange('embalagemPadrao', isNaN(val) || val < 0 ? 0 : val);
                      }}
                      placeholder="0,00"
                      className="rounded-lg pl-9 pr-3 py-2 w-full focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm font-mono font-bold"
                    />
                  </div>
                  <p className="text-[11px] text-on-surface-variant">Caixas, plástico bolha, fitas e etiquetas</p>
                </div>

                {/* Outros custos */}
                <div className="flex flex-col gap-1.5 bg-surface-container p-3.5 rounded-lg border border-outline-variant">
                  <div className="flex justify-between items-center">
                    <label htmlFor="fin_outros" className="text-xs font-mono font-bold text-on-surface uppercase tracking-wider">
                      Outros Custos
                    </label>
                    <span className="text-[10px] text-secondary font-mono font-bold">R$ fixo</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant font-bold">R$</span>
                    <input 
                      id="fin_outros" 
                      type="number" 
                      min="0" 
                      step="0.25"
                      value={settings.outrosCustosPadrao === 0 ? '' : settings.outrosCustosPadrao}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(',', '.'));
                        handleChange('outrosCustosPadrao', isNaN(val) || val < 0 ? 0 : val);
                      }}
                      placeholder="0,00"
                      className="rounded-lg pl-9 pr-3 py-2 w-full focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm font-mono font-bold"
                    />
                  </div>
                  <p className="text-[11px] text-on-surface-variant">Custos operacionais e fixos rateados</p>
                </div>

                {/* Lucro sobre o custo (Markup desejado) */}
                <div className="flex flex-col gap-1.5 bg-surface-container p-3.5 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="fin_margem" className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
                      Lucro sobre o custo
                    </label>
                    <span className="text-[10px] text-primary font-mono font-bold">% sobre custo (Markup)</span>
                  </div>
                  <div className="relative">
                    <input 
                      id="fin_margem" 
                      type="number" 
                      min="1" 
                      max="1000" 
                      step="1"
                      value={settings.margemLucroPadrao === 0 ? '' : settings.margemLucroPadrao}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(',', '.'));
                        handleChange('margemLucroPadrao', isNaN(val) || val < 0 ? 0 : val);
                      }}
                      placeholder="40"
                      className="rounded-lg pl-3 pr-8 py-2 w-full focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-primary/40 text-on-surface text-sm font-mono font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-primary font-bold">%</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">Percentual aplicado ao custo base para compor o preço (distinto da margem sobre a venda)</p>
                </div>
              </div>

              {/* Card de Simulação e Validação em Tempo Real */}
              {(() => {
                const totalTaxas = (settings.impostoPadrao || 0) + (settings.taxaPagamentoPadrao || 0) + (settings.comissaoMarketplacePadrao || 0);
                const isTaxError = totalTaxas >= 100;
                const preview = calculateSalePrice({
                  custoProducao: 20,
                  embalagem: settings.embalagemPadrao,
                  outrosCustos: settings.outrosCustosPadrao,
                  imposto: settings.impostoPadrao,
                  taxaPagamento: settings.taxaPagamentoPadrao,
                  comissaoMarketplace: settings.comissaoMarketplacePadrao,
                  margemLucro: settings.margemLucroPadrao
                });

                if (isTaxError) {
                  return (
                    <div className="p-4 rounded-lg bg-error/15 border border-error/30 text-error flex items-center gap-3 text-xs font-mono">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <span><strong>Atenção:</strong> As taxas somadas ({totalTaxas}%) não podem ser iguais ou superiores a 100%.</span>
                    </div>
                  );
                }

                return (
                  <div className="bg-surface-container-highest/60 border border-outline-variant rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-mono text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 font-bold">
                        <TrendingUp className="w-3.5 h-3.5 text-secondary" />
                        Exemplo de Cálculo Automático (Custo de R$ 20,00):
                      </span>
                      <span className="text-xs text-on-surface">
                        Custo Base: <strong>R$ {preview.custoBase.toFixed(2)}</strong> | Taxas Totais: <strong>{preview.totalTaxasPercentual}%</strong>
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-mono">
                        Lucro sobre custo: <strong>{settings.margemLucroPadrao || 40}%</strong> ➔ Margem sobre o preço de venda: <strong>{preview.margemEfetiva}%</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="text-right">
                        <span className="text-[10px] text-on-surface-variant block uppercase">Preço de Venda</span>
                        <span className="text-sm font-bold text-secondary font-mono">R$ {preview.precoVenda.toFixed(2)}</span>
                      </div>
                      <div className="h-6 w-px bg-outline-variant"></div>
                      <div className="text-right">
                        <span className="text-[10px] text-on-surface-variant block uppercase">Lucro Líquido Real</span>
                        <span className="text-sm font-bold text-primary font-mono">R$ {preview.lucroLiquido.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Botão de salvar configurações no próprio bloco */}
              <div className="flex justify-end pt-2 border-t border-outline-variant/60">
                <button 
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2.5 rounded-lg font-bold bg-primary text-on-primary hover:bg-primary/90 transition-all flex items-center gap-2 text-xs shadow cursor-pointer uppercase tracking-wider"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar configurações</span>
                </button>
              </div>
            </div>
          </section>

          {/* Identidade da Empresa */}
          <section className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-surface-container border-b border-outline-variant flex items-center gap-3">
              <Store className="text-primary w-5 h-5" />
              <h3 className="text-sm font-medium text-on-surface uppercase tracking-wider">Identidade da Empresa</h3>
            </div>
            
            <div className="p-6 flex flex-col md:flex-row gap-8 items-start">
              {/* Logo Upload */}
              <div className="flex-shrink-0 flex flex-col gap-2">
                <label className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">Logotipo da Empresa</label>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                />
                
                {settings.logotipoUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-36 h-36 rounded-lg border border-outline-variant bg-white p-2 flex items-center justify-center cursor-pointer hover:border-primary transition-all relative group overflow-hidden shadow-sm"
                    >
                      <img 
                        src={settings.logotipoUrl} 
                        alt="Logo Empresa" 
                        className="max-h-full max-w-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                        Alterar Logo
                      </div>
                    </div>
                    <button 
                      onClick={handleRemoveLogo}
                      className="text-xs text-error hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Removê-lo
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-36 h-36 rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-lowest flex flex-col items-center justify-center cursor-pointer hover:border-primary-container transition-all group p-4 text-center"
                  >
                    <Upload className="text-outline group-hover:text-primary transition-colors w-7 h-7 mb-2" />
                    <span className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors">Carregar Logo</span>
                    <span className="text-[10px] font-mono text-outline-variant mt-1">PNG, JPG, WebP (Max 10MB)</span>
                  </div>
                )}

                {logoError && (
                  <span className="text-[11px] text-error font-mono font-medium max-w-[160px] text-center mt-1">
                    ⚠️ {logoError}
                  </span>
                )}
              </div>

              {/* Info Form */}
              <div className="flex-grow flex flex-col gap-4 w-full">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="company_name" className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">Nome da Empresa</label>
                  <input 
                    id="company_name" 
                    type="text" 
                    value={settings.nomeEmpresa}
                    onChange={(e) => handleChange('nomeEmpresa', e.target.value)}
                    placeholder="Ex: Print_3dbr"
                    className="rounded-lg px-4 py-2.5 w-full focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="company_subtitle" className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">Subtítulo / Especialidade</label>
                  <input 
                    id="company_subtitle" 
                    type="text" 
                    value={settings.subtituloEmpresa}
                    onChange={(e) => handleChange('subtituloEmpresa', e.target.value)}
                    placeholder="Ex: Laboratório de Impressão 3D"
                    className="rounded-lg px-4 py-2.5 w-full focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pix_key" className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">Chave PIX Preferencial</label>
                  <div className="relative">
                    <QrCode className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline-variant w-4 h-4" />
                    <input 
                      id="pix_key" 
                      type="text" 
                      value={settings.chavePix}
                      onChange={(e) => handleChange('chavePix', e.target.value)}
                      placeholder="Ex: 47 988512351 ou CNPJ"
                      className="rounded-lg pl-10 pr-4 py-2.5 w-full focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Contatos */}
          <section className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-surface-container border-b border-outline-variant flex items-center gap-3">
              <Contact className="text-primary w-5 h-5" />
              <h3 className="text-sm font-medium text-on-surface uppercase tracking-wider">Informações de Contato</h3>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="whatsapp" className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">WhatsApp Oficial</label>
                <div className="relative">
                  <MessageCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline-variant w-4 h-4" />
                  <input 
                    id="whatsapp" 
                    type="text" 
                    value={settings.whatsapp}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                    placeholder="Ex: 47 988512351"
                    className="rounded-lg pl-10 pr-4 py-2.5 w-full focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="instagram" className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">Instagram</label>
                <div className="relative">
                  <Camera className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline-variant w-4 h-4" />
                  <input 
                    id="instagram" 
                    type="text" 
                    value={settings.instagram}
                    onChange={(e) => handleChange('instagram', e.target.value)}
                    placeholder="Ex: @print_3dbr"
                    className="rounded-lg pl-10 pr-4 py-2.5 w-full focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label htmlFor="email" className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">E-mail Profissional</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline-variant w-4 h-4" />
                  <input 
                    id="email" 
                    type="email" 
                    value={settings.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="contato@print3dbr.com"
                    className="rounded-lg pl-10 pr-4 py-2.5 w-full focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Observações Padrão */}
          <section className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-surface-container border-b border-outline-variant flex items-center gap-3">
              <Store className="text-primary w-5 h-5" />
              <h3 className="text-sm font-medium text-on-surface uppercase tracking-wider">Observações Padrão das Notas</h3>
            </div>
            
            <div className="p-6 flex flex-col gap-2">
              <label htmlFor="default_notes" className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">Texto de Observação Padrão</label>
              <textarea 
                id="default_notes" 
                value={settings.observacoesPadrao}
                onChange={(e) => handleChange('observacoesPadrao', e.target.value)}
                rows={3}
                placeholder="Ex: Peças produzidas com precisão de 0.12mm..."
                className="rounded-lg px-4 py-2.5 w-full resize-none focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm leading-relaxed"
              ></textarea>
              <span className="text-[11px] text-on-surface-variant">Este texto será carregado automaticamente ao abrir o formulário de Nova Nota.</span>
            </div>
          </section>

        </div>

        {/* Coluna Direita: Personalização PDF & Botões */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <section className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-surface-container border-b border-outline-variant flex items-center gap-3">
              <Palette className="text-primary w-5 h-5" />
              <h3 className="text-sm font-medium text-on-surface uppercase tracking-wider">Personalização PDF</h3>
            </div>
            
            <div className="p-6 flex flex-col gap-6">
              {/* Cor Principal */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">Cor de Destaque do Documento</label>
                <div className="grid grid-cols-3 gap-3">
                  {colorPresets.map((preset) => {
                    const isSelected = settings.corPrincipal.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button 
                        key={preset.hex}
                        type="button"
                        onClick={() => handleChange('corPrincipal', preset.hex)}
                        title={preset.name}
                        className={`h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer relative border ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface border-transparent scale-105' : 'border-outline-variant hover:scale-102'}`}
                        style={{ backgroundColor: preset.hex }}
                      >
                        {isSelected && <Check className="text-white w-5 h-5 drop-shadow-md" />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Color Picker */}
                <div className="flex items-center gap-3 mt-1 pt-2 border-t border-outline-variant/60">
                  <input 
                    type="color" 
                    value={settings.corPrincipal}
                    onChange={(e) => handleChange('corPrincipal', e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-mono font-bold text-on-surface">{settings.corPrincipal.toUpperCase()}</span>
                    <span className="text-[10px] text-on-surface-variant">Selecione uma cor customizada</span>
                  </div>
                </div>
              </div>

              <div className="w-full h-px bg-outline-variant"></div>

              {/* Mensagem de Rodapé */}
              <div className="flex flex-col gap-2">
                <label htmlFor="thanks_message" className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">Mensagem de Rodapé do PDF</label>
                <textarea 
                  id="thanks_message" 
                  value={settings.mensagemRodape}
                  onChange={(e) => handleChange('mensagemRodape', e.target.value)}
                  placeholder="Ex: Obrigado pela preferência!" 
                  rows={4}
                  className="rounded-lg px-4 py-2.5 w-full resize-none focus:border-primary-container focus:ring-1 focus:ring-primary-container bg-surface-container-highest border border-outline-variant text-on-surface text-sm"
                ></textarea>
                <span className="text-[11px] font-mono text-on-surface-variant text-right">Exibido na área inferior do comprovante</span>
              </div>
            </div>
          </section>

          {/* Segurança & Sincronização (Firebase) */}
          <section className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-surface-container border-b border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="text-primary w-5 h-5" />
                <h3 className="text-sm font-medium text-on-surface uppercase tracking-wider">Segurança & Nuvem</h3>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                REGRAS ATIVAS
              </span>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs text-on-surface-variant leading-relaxed">
                Seus orçamentos e ajustes possuem proteção por proprietário (<code className="text-primary font-mono font-bold">ownerUid</code>). Somente o seu usuário possui permissão de leitura e edição.
              </div>

              {currentUser && !currentUser.isAnonymous ? (
                <div className="bg-surface-container p-3.5 rounded-lg border border-outline-variant space-y-3">
                  <div className="flex items-center gap-2.5">
                    {currentUser.photoURL ? (
                      <img src={currentUser.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-outline-variant" />
                    ) : (
                      <UserIcon className="w-8 h-8 text-primary p-1 bg-primary/10 rounded-full" />
                    )}
                    <div className="overflow-hidden">
                      <span className="text-xs font-bold text-on-surface block truncate">{currentUser.displayName || 'Usuário Conectado'}</span>
                      <span className="text-[11px] text-on-surface-variant font-mono truncate block">{currentUser.email}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-outline-variant flex justify-between items-center text-[11px] font-mono">
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <Lock className="w-3.5 h-3.5" /> Sincronização ativa
                    </span>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="text-on-surface-variant hover:text-error flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" /> Desconectar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-container p-3.5 rounded-lg border border-outline-variant space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-on-surface-variant">Modo atual:</span>
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> Sessão Local Isolada
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    Para sincronizar seus orçamentos entre diferentes computadores e celulares, conecte sua conta Google:
                  </p>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isAuthenticating}
                    className="w-full py-2.5 px-3 bg-surface-container-highest hover:bg-surface-bright border border-outline-variant rounded-lg text-xs font-semibold text-on-surface flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <LogIn className="w-4 h-4 text-primary" />
                    <span>{isAuthenticating ? 'Conectando...' : 'Conectar com Google'}</span>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
            <button 
              onClick={handleSave}
              className="w-full py-3.5 px-6 rounded-lg font-bold bg-primary-container text-on-primary-container hover:bg-primary-fixed transition-all flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
            >
              <Save className="w-5 h-5" />
              <span>SALVAR ALTERAÇÕES</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

