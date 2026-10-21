# Print3DBR - Notas e Orçamentos para Impressão 3D

Sistema completo e profissional de emissão e gestão de pedidos, orçamentos, notas de serviço e comprovantes de venda especialmente projetado para oficinas, ateliês e prestadores de serviços de impressão 3D (FDM e Resina).

O aplicativo oferece precificação detalhada (custos de produção, embalagem, comissões de marketplace, taxas de pagamento e margem de lucro), geração de documentos em PDF vetorial A4 de alta definição, compartilhamento direto via WhatsApp com mensagem formatada e sincronização em tempo real com o Firebase (armazenamento local com suporte a nuvem e migração automática de dados anônimos para contas Google).

---

## 🚀 Tecnologias e Stack

- **Frontend**: [React 19](https://react.dev/) com [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Geração de Documentos**:
  - [jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) (PDF vetorial nativo em milímetros)
  - [html2canvas](https://html2canvas.hertzen.com/) (captura fiel de layout A4)
  - [qrcode](https://github.com/soldair/node-qrcode) (geração de QR Code dinâmico para pagamentos PIX)
  - Gráficos com [Recharts](https://recharts.org/)
- **Banco de Dados & Autenticação**: [Firebase](https://firebase.google.com/) (Cloud Firestore e Firebase Authentication)

---

## 💻 Como Rodar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior
- [npm](https://www.npmjs.com/) (ou yarn / bun)

### 1. Instalação das Dependências
```bash
npm install
```

### 2. Executar em Modo de Desenvolvimento
```bash
npm run dev
```
O servidor de desenvolvimento iniciará em `http://localhost:3000`.

### 3. Compilação para Produção
```bash
npm run build
```
Os arquivos otimizados e prontos para distribuição serão gerados no diretório `dist/`.

### 4. Verificação de Tipos / Linter
```bash
npm run lint
```

---

## 🔒 Configuração do Firebase

O Print3DBR funciona perfeitamente tanto no modo local (offline/anônimo) quanto sincronizado com a nuvem via Firebase.

### 1. Criar Projeto no Firebase
1. Acesse o [Firebase Console](https://console.firebase.google.com/).
2. Crie um novo projeto (ex: `print3dbr-app`).
3. Adicione um **Web App** e obtenha as chaves de configuração.

### 2. Ativar Métodos de Autenticação (Firebase Auth)
No menu **Authentication > Sign-in method**:
1. Ative o provedor **Google**: configure o ID do cliente e o consentimento OAuth.
2. Ative o provedor **Anônimo (Anonymous)**: permite que novos visitantes usem o app imediatamente sem login forçado. Quando o usuário fizer login com a conta Google, seus pedidos anônimos serão automaticamente migrados e vinculados ao seu UID definitivo.

### 3. Ativar o Cloud Firestore
1. No menu **Firestore Database**, clique em **Criar banco de dados**.
2. Selecione a região desejada e inicie no modo de produção.

### 4. Configurar as Credenciais no Projeto
Crie ou atualize o arquivo `firebase-applet-config.json` na raiz do projeto com o seguinte formato:
```json
{
  "apiKey": "SUA_API_KEY",
  "authDomain": "SEU_PROJETO.firebaseapp.com",
  "projectId": "SEU_PROJETO_ID",
  "storageBucket": "SEU_PROJETO.appspot.com",
  "messagingSenderId": "SEU_SENDER_ID",
  "appId": "SEU_APP_ID"
}
```

### 5. Deploy das Regras de Segurança do Firestore
O arquivo `firestore.rules` já está na raiz do projeto, endurecido com isolamento estrito por `ownerUid` e validação de esquemas.

Para publicar as regras no seu projeto:
```bash
# Certifique-se de ter o Firebase CLI instalado: npm install -g firebase-tools
firebase login
firebase use SEU_PROJETO_ID
firebase deploy --only firestore:rules
```

---

## 📁 Estrutura de Pastas

```text
├── assets/                     # Recursos visuais estáticos
├── firebase-applet-config.json # Credenciais de conexão com o Firebase
├── firebase-blueprint.json     # Metadados de esquemas e entidades do Firestore
├── firebase.json               # Configurações do Firebase (regras e Hosting)
├── firestore.rules             # Regras de segurança e validação do Cloud Firestore
├── index.html                  # Ponto de entrada HTML (metadados e SEO)
├── metadata.json               # Metadados e permissões da plataforma
├── package.json                # Dependências e scripts do projeto
├── tsconfig.json               # Configuração do TypeScript
├── vite.config.ts              # Configuração do Vite e plugins Tailwind/React
└── src/
    ├── main.tsx                # Ponto de entrada da aplicação React
    ├── App.tsx                 # Componente raiz, roteador de abas e layout
    ├── index.css               # Estilos globais Tailwind CSS
    ├── types.ts                # Definições de tipos TypeScript (Pedido, Cliente, etc.)
    ├── components/
    │   ├── Inicio.tsx          # Dashboard, métricas de faturamento e status da produção
    │   ├── NovaNota.tsx        # Criador de pedidos/orçamentos com precificação e upload de fotos
    │   ├── Pedidos.tsx         # Gestão de histórico, filtros de status, edição e exclusão
    │   ├── Clientes.tsx        # Cadastro, busca e gerenciamento da base de clientes
    │   ├── Ajustes.tsx         # Configurações da empresa, logotipo, PIX, taxas e autenticação
    │   ├── ComprovanteView.tsx # Visualização em modal e compartilhamento via WhatsApp
    │   ├── DocumentoOrcamento.tsx # Modelo do documento A4 impresso/visualizado
    │   ├── EditPedidoModal.tsx # Modal de edição completa de pedidos existentes
    │   └── RelatorioModal.tsx  # Relatório analítico de vendas e exportação de dados
    ├── lib/
    │   └── firebase.ts         # Inicialização do Firebase SDK, Auth e observadores
    └── utils/
        ├── clientesStorage.ts  # Gerenciamento de persistência de clientes (Local + Firestore)
        ├── dateUtils.ts        # Utilitários de formatação e análise de datas
        ├── imageUtils.ts       # Compressão progressiva de imagens em Canvas (max 150KB/100KB)
        ├── migrationHelper.ts  # Algoritmo de resolução de conflitos e união de pedidos
        ├── ordersStorage.ts    # Persistência de pedidos, listeners e sincronização em tempo real
        ├── pdfGenerator.ts     # Geração de PDF vetorial via jsPDF e captura html2canvas
        ├── pricingCalculator.ts# Cálculo de formação de preços, markup e impostos
        ├── sanitizeUtils.ts    # Higienização de strings para nomes de arquivo seguros
        ├── settingsStorage.ts  # Persistência das configurações da oficina/empresa
        └── statusUtils.ts      # Cores, rótulos e fluxo de status da produção 3D
```

---

## 📄 Licença

Uso interno e comercial para oficinas e estúdios de impressão 3D.
