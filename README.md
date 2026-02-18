# SaviaPro (BIEX)

Plataforma educativa con IA para tutores y estudiantes.

## Stack

- **Frontend**: React + Vite + TypeScript + shadcn-ui + Tailwind CSS
- **Backend**: Supabase (self-hosted) — PostgreSQL, Auth, Storage, Edge Functions
- **IA**: Google Gemini, DeepSeek, webhooks n8n
- **Infraestructura**: EasyPanel (App + Supabase compose)

## Desarrollo local

```sh
git clone https://github.com/hublecarpio/saviapro.git
cd saviapro
npm install
npm run dev
```

Requisito: Node.js y npm ([instalar con nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

## Despliegue

La app se despliega en **EasyPanel** con dos servicios:

1. **App** (frontend) — Usa `docker/Dockerfile` para build
2. **Supabase** (compose) — Contiene DB, Kong, Auth, Edge Functions, Storage

### Variables de entorno

**App (frontend):**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

**Supabase compose → servicio `functions`:**

- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`

- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `GLOBAL_S3_ENDPOINT`

## Estructura del proyecto

```
├── src/                  # Frontend React
├── supabase/functions/   # Edge Functions (Deno)
├── docker/
│   ├── Dockerfile        # Build del frontend
│   └── nginx.conf        # Servidor para SPA
└── public/               # Assets estáticos
```
