# Mesa Virtual de RPG

Sistema web completo de mesa virtual (VTT) para RPG, com mapas, tokens, neblina de guerra (Fog of War), grade configurável, chat em tempo real com sussurros privados, rastreador de iniciativa, fichas de personagem e sistema de permissões.

## Tecnologias

- **Backend**: Node.js + Express + Prisma + PostgreSQL + Socket.IO
- **Frontend**: React 18 + Vite + react-konva (canvas) + react-router-dom
- **Auth**: JWT + bcryptjs (+ rate limiting e helmet)
- **Uploads**: multer (imagens e vídeos até 50MB)
- **Deploy**: Docker Compose ou Render.com (`render.yaml` incluído)

## Funcionalidades

### Mesa
- Múltiplos mapas por mesa, com troca de mapa sincronizada em tempo real
- Mapas por **imagem (URL ou upload de arquivo)** ou **vídeo** (MP4/WebM)
- Tokens com imagem própria (upload ou URL), nome, tipo, tamanho, camada (mestre/jogador), bloqueio e **raio de luz**
- Movimentação de tokens com snap opcional à grade, presos aos limites do mapa
- **Fog of War** com pincel (revelar/ocultar), revelar tudo e ocultar tudo
- **Raio de luz**: tokens iluminam a neblina ao redor (quando Masquerade está OFF)
- Grade configurável (tamanho da célula, escala em pés, opacidade, snap)
- Ferramenta de **medição** (pixels, células e pés)
- Desenhos (com cor), **anotações de texto (criar, editar e apagar)** e borracha
- **Masquerade**: modo Vampiro — jogadores veem "???" nos tokens e sem HP/luz
- Spotlight: mestre centra a visão de todos em um jogador/token

### Social
- Chat em tempo real com histórico (últimas 100 mensagens), sussurros privados (`/w usuario mensagem`), narração do mestre, rolagem de dados no chat (`/r 2d6+3`) e animação de rolagem
- Indicador de mensagens não lidas com o chat fechado
- Sussurro rápido: botão ✉ no membro preenche o comando
- Mute de jogadores pelo mestre (aplicado no servidor)
- Lista de membros com indicador de online

### Combate
- Rastreador de iniciativa com sincronização em tempo real
- Adicionar combatentes do mapa ou manualmente, rolagem individual (d20) ou de todos
- Contador de **rodadas** com avanço/volta automático
- Reordenar por arrastar

### Fichas e Permissões
- Fichas de personagem com HP, atributos, combate e notas
- Retrato do personagem por upload
- Tokens podem ser vinculados a fichas (HP visível na barra do token)
- Permissões granulares por token (ver, mover, redimensionar, excluir)
- **Backup**: exportação/importação JSON de toda a mesa (mapas, tokens, neblina, desenhos, anotações, personagens) — somente mestre

## Estrutura do Projeto

```
rpg-virtual-table/
├── backend/                 # API REST + WebSocket
│   ├── prisma/              # schema.prisma + seed
│   ├── src/
│   │   ├── index.js         # Servidor Express
│   │   ├── socket/          # Socket.IO (salas por mesa/usuário)
│   │   ├── config/          # Conexão do banco
│   │   ├── controllers/     # Lógica de cada recurso
│   │   ├── middleware/      # Auth (JWT) e permissões
│   │   ├── routes/          # Definição das rotas
│   │   └── utils/           # Upload de arquivos (multer)
│   ├── uploads/             # Arquivos enviados
│   └── Dockerfile
├── frontend/                # Interface React
│   ├── src/
│   │   ├── pages/           # Login, Register, Dashboard, TablePage
│   │   ├── components/      # MapCanvas, ChatPanel, InitiativeTracker, etc.
│   │   ├── contexts/        # AuthContext
│   │   └── services/        # api.js (axios) + socket.js
│   ├── e2e-test.cjs         # Teste E2E (Playwright)
│   ├── socket-test.cjs      # Teste de sincronização em tempo real
│   ├── whisper-test.cjs     # Teste de privacidade dos sussurros
│   ├── pagination-test.cjs  # Teste de paginação do chat
│   ├── nginx.conf           # Proxy reverso (produção Docker)
│   └── Dockerfile
├── docker-compose.yml       # Postgres + backend + frontend (nginx)
├── render.yaml              # Deploy no Render.com
└── README.md
```

## Pré-requisitos

- Node.js 18+
- PostgreSQL 14+
- npm

## Instalação Local

### 1. Variáveis de ambiente

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env`:

```env
DATABASE_URL="postgresql://seu_usuario:sua_senha@localhost:5432/rpg_virtual_table?schema=public"
JWT_SECRET="uma-chave-secreta-bem-segura"   # obrigatoria (o servidor nao inicia sem ela)
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=development
UPLOAD_DIR=./uploads
FRONTEND_URL=http://localhost:5173

# Cloudinary (opcional - deixe em branco para salvar no disco local)
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=
```

> **Uploads na nuvem (opcional):** preenchendo as 3 variáveis do Cloudinary
> (Dashboard → Settings → Access Keys: *Cloud name*, *API key*, *API secret*),
> mapas, retratos e imagens de token vão direto para a nuvem — recomendado em
> hospedagens com disco efêmero como o Render. Sem elas, tudo continua
> funcionando salvo no disco local.

### 2. Instalar e configurar

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
node prisma/seed.js   # cria o administrador

cd ../frontend
npm install
```

Credenciais padrão do admin: `admin@rpgtable.com` / `admin123` — **altere em produção**.

### 3. Rodar

```bash
# Terminal 1
cd backend && npm run dev        # porta 3001

# Terminal 2
cd frontend && npm run dev       # porta 5173
```

Acesse: http://localhost:5173

## Testes

Com backend (3001) e frontend (5173) rodando:

```bash
cd frontend
node socket-test.cjs      # sincronização em tempo real (5 testes)
node whisper-test.cjs     # privacidade dos sussurros (3 testes)
node pagination-test.cjs  # paginação do chat (envia 105 mensagens)
node e2e-test.cjs         # fluxo completo no navegador (Playwright, 8 testes)
```

## Deploy com Docker

```bash
JWT_SECRET="troque-esta-chave" DB_PASSWORD="troque-esta-senha" docker compose up -d --build
```

- Frontend: `http://localhost:8080` (nginx com proxy para `/api`, `/uploads` e WebSocket)
- Postgres com volume persistente; backend roda `prisma db push` ao iniciar e expõe `/api/health` (com checagem de banco) para o healthcheck
- Configure `APP_PORT`, `DB_PASSWORD`, `JWT_SECRET` e `FRONTEND_URL` conforme o ambiente

## Deploy no Render.com

O arquivo `render.yaml` descreve os três serviços (banco, API, frontend estático). Destaques:

- A API executa `npx prisma db push && npm start` (cria as tabelas em banco novo) e usa `/api/health` como health check
- `JWT_SECRET` e `FRONTEND_URL` devem ser preenchidos no dashboard do Render
- **Uploads**: o sistema de arquivos do Render não persiste entre deploys. Para produção séria, mova os uploads para S3/Cloudinary ou use um disco persistente pago

### Backup entre servidores

O JSON de backup **não inclui** os arquivos de imagem enviados (referencia apenas as URLs `/uploads/...`). Para migrar de servidor, copie também o diretório `uploads/`.

## Notas de Segurança

- Senhas com bcrypt; tokens JWT com expiração configurável
- Rate limiting: 1000 req/15min na API, 30 req/15min em `/api/auth`
- Sussurros filtrados no servidor (nunca enviados a terceiros)
- Tokens de mestre (camada 5) e tokens sem permissão nunca chegam ao cliente do jogador
- Mute aplicado no servidor; uploads com whitelist de tipo e limite de 50MB

## Licença

MIT
