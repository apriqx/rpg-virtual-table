# Mesa Virtual de RPG

Sistema web de mesa virtual de RPG com camadas independentes, Fog of War, grid configurável e sistema de permissões.

## Tecnologias

- **Backend**: Node.js + Express + Prisma + PostgreSQL
- **Frontend**: React 18 + Vite + react-konva + react-router-dom
- **Auth**: JWT + bcryptjs
- **Deploy**: Render.com

## Estrutura do Projeto

```
rpg-virtual-table/
├── backend/                 # API REST
│   ├── prisma/
│   │   └── schema.prisma   # Modelo do banco de dados
│   ├── src/
│   │   ├── index.js        # Servidor Express
│   │   ├── config/         # Configuração do banco
│   │   ├── controllers/    # Lógica de cada recurso
│   │   ├── middleware/      # Auth e permissões
│   │   ├── routes/         # Definição das rotas
│   │   └── utils/          # Upload de arquivos
│   └── uploads/            # Imagens enviadas
├── frontend/                # Interface React
│   └── src/
│       ├── pages/          # Páginas (Login, Dashboard, TablePage)
│       ├── components/     # Componentes (MapCanvas, Toolbar, etc.)
│       ├── contexts/       # Context API (Auth)
│       └── services/       # Cliente API (axios)
├── render.yaml             # Configuração de deploy no Render
└── README.md
```

## Pré-requisitos

- Node.js 18+
- PostgreSQL 14+
- npm ou yarn

## Instalação Local

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/rpg-virtual-table.git
cd rpg-virtual-table
```

### 2. Configurar variáveis de ambiente

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env` com suas configurações:

```env
DATABASE_URL="postgresql://seu_usuario:sua_senha@localhost:5432/rpg_virtual_table?schema=public"
JWT_SECRET="uma-chave-secreta-bem-segura"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=development
UPLOAD_DIR=./uploads
```

### 3. Instalar dependências

```bash
# Backend
cd backend
npm install

# Frontend (em outro terminal)
cd frontend
npm install
```

### 4. Configurar o banco de dados

```bash
cd backend

# Gerar o cliente Prisma
npx prisma generate

# Criar as tabelas no banco
npx prisma db push
```

### 5. Criar o primeiro administrador

```bash
cd backend
node prisma/seed.js
```

Credenciais padrão:
- **Email**: admin@rpgtable.com
- **Senha**: admin123

**IMPORTANTE**: Altere a senha após o primeiro login em produção.

### 6. Executar o projeto

```bash
# Terminal 1 - Backend (porta 3001)
cd backend
npm run dev

# Terminal 2 - Frontend (porta 5173)
cd frontend
npm run dev
```

Acesse: http://localhost:5173

## Deploy no Render.com

### Banco de Dados

1. No Render Dashboard, crie um **PostgreSQL** (Free tier)
2. Copie a `Internal Database URL` ou `External Database URL`

### Backend

1. Crie um novo **Web Service** no Render
2. Conecte ao repositório GitHub
3. Configure:
   - **Build Command**: `cd backend && npm install && npx prisma generate`
   - **Start Command**: `cd backend && npm start`
   - **Environment**: Node
4. Adicione as variáveis de ambiente:
   - `DATABASE_URL` = (a URL do PostgreSQL do Render)
   - `JWT_SECRET` = (uma chave segura aleatória)
   - `JWT_EXPIRES_IN` = `7d`
   - `PORT` = `3001`
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = (URL do frontend)
   - `UPLOAD_DIR` = `./uploads`

### Frontend

1. Crie um novo **Static Site** no Render
2. Conecte ao mesmo repositório GitHub
3. Configure:
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`
4. Adicione a variável de ambiente:
   - `VITE_API_URL` = (URL do backend, ex: `https://seu-backend.onrender.com`)

### Ajuste do Frontend para Produção

No arquivo `frontend/vite.config.js`, o proxy só funciona em desenvolvimento. Para produção, o frontend precisa chamar o backend diretamente. Configure a variável `VITE_API_URL` no build do frontend.

No arquivo `frontend/src/services/api.js`, altere o baseURL para:
```javascript
baseURL: import.meta.env.VITE_API_URL || '/api'
```

### Alternativa com render.yaml

O arquivo `render.yaml` na raiz do projeto permite deploy automático. Basta conectar o repositório e o Render detecta a configuração.

## Notas sobre Uploads em Produção

O Render não persiste arquivos locais entre deploys. Para armazenamento permanente de imagens de mapas e tokens, recomenda-se:

- Usar um serviço como **AWS S3**, **Cloudinary** ou **Backblaze B2**
- Ou usar o disco persistente do Render (pago)

## Migrações do Banco de Dados

O projeto usa `prisma db push` para sincronização direta. Para projetos em produção, use migrações formais:

```bash
cd backend
npx prisma migrate dev --name nome-da-migracao
npx prisma migrate deploy  # Para produção
```

## Licença

MIT