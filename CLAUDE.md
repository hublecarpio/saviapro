# CLAUDE.md

Este archivo da guía a Claude Code (claude.ai/code) para trabajar en este repositorio.

## Proyecto

SaviaPro (BIEX) — plataforma educativa con tutora IA ("Sofía") para estudiantes y tutores. Frontend React/Vite + backend Supabase self-hosted (Postgres, Auth, Storage, Edge Functions) + webhooks n8n para orquestación de IA (Gemini, DeepSeek).

El schema completo de la DB, los flujos de las edge functions y los detalles de auth/RLS están en `DOCUMENTATION.md` — leerlo antes de tocar el backend; este archivo solo cubre lo que ese doc no cubre.

## Comandos

```sh
npm run dev        # servidor de dev de Vite en el puerto 8080
npm run build       # build de producción
npm run build:dev  # build con env de modo development
npm run lint        # ESLint sobre todo el repo
npm run preview     # preview de un build de producción
```

No hay test runner configurado en este repo (ni vitest/jest, ni archivos `*.test.*`) — no asumir que existe uno.

Las edge functions son Deno y se deployan vía Supabase CLI contra el proyecto self-hosted (`project_id = hxvjibdsldkvnaccfgah` en `supabase/config.toml`), no a través de este proyecto npm.

## Arquitectura

### Frontend (`src/`)

- Alias de path `@/*` → `src/*` (configurado tanto en `vite.config.ts` como en `tsconfig.json`).
- El routing vive en `src/routes/App.tsx` (todas las rutas definidas planas ahí, envueltas en `ProtectedRoute` para páginas autenticadas). El archivo del guard se llama en realidad `ProtetectedRoute.tsx` (typo preexistente) — importar con ese nombre exacto.
- El estado de auth es global vía Zustand (`src/store/useUserStore.ts`, persistido en localStorage como `biex-user`), poblado por `src/hooks/useAuth.tsx`. `AuthProvider` (`src/providers/AuthProvider.tsx`) solo llama `initializeAuth()` una vez al montar; envuelve `<Routes>` en `App.tsx`.
- La lógica de redirección por rol (admin → `/admin`, tutor → `/tutor`, estudiante → `/starter` o `/chat`) vive dentro de `redirectBasedOnRole` en `useAuth.tsx`, guiada por filas en `user_roles` — no hay guard de rol a nivel de ruta, las redirecciones son el mecanismo de enforcement del lado cliente (la autorización real es vía RLS de Postgres).
- `src/integrations/supabase/client.ts` y `types.ts` son generados por Supabase — no editar `types.ts` a mano, regenerarlo después de cambios de schema.
- Los componentes de UI son shadcn/ui (`src/components/ui/`) configurados vía `components.json`; los componentes de feature están agrupados por rol bajo `src/components/{admin,tutor,user}/`.
- `Chat.tsx` es la página más grande y central: maneja el estado de la conversación, envío/recepción de mensajes y todas las "herramientas" de IA (mapas mentales, fichas/quiz, generación de video/podcast, informes, subida de archivos, grabación de audio) — la mayoría de los otros componentes de chat (`ChatToolsSidebar`, `FichasDidacticas`, `MindMapDisplay`, `FileUploader`, `SofiaThinking`) son consumidos por ella.

### Backend (`supabase/`)

- `supabase/functions/*/index.ts` — una edge function Deno por carpeta, cada una autocontenida (no hay módulo `_shared/`: los headers CORS y el setup del cliente Supabase están duplicados por función en vez de importados).
- `supabase/config.toml` define `verify_jwt` por función — la mayoría son `false` (llamadas desde el anon key del frontend o desde webhooks de n8n sin JWT de usuario) excepto `generar-fichas`. Al agregar una función nueva, agregar también su entrada `verify_jwt` acá.
- No existe carpeta `supabase/migrations/` en este repo — los cambios de schema en la DB self-hosted no están trackeados como archivos de migración localmente. Revisar el schema actual vía las tools MCP de Supabase o `DOCUMENTATION.md`, no asumir que existe una carpeta de migraciones.
- Las respuestas de IA no llaman a Gemini/DeepSeek directo desde la mayoría de las funciones — la función `chat` postea a webhooks de n8n (las URLs vienen de env vars `VITE_WEBHOOK_*` en el frontend, o están hardcodeadas por función en el backend) que orquestan las llamadas reales al modelo.
- Todas las tablas tienen RLS habilitado; las funciones de Postgres `has_role()` y `user_was_invited_by_tutor()` son los primitivos sobre los que se arma la mayoría de las políticas (ver `DOCUMENTATION.md` para la lista completa de políticas).

### Deployment

- Dos servicios en EasyPanel: **App** (build desde `docker/Dockerfile`, build de Vite en dos etapas → nginx sirviendo `docker/nginx.conf`) y **Supabase** (compose stack: DB, Kong, Auth, Edge Functions, Storage).
- Las env vars de build-time del frontend (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_URL`, `VITE_WEBHOOK_*`) se pasan como `ARG` de Docker — ver `docker/Dockerfile`. Los secrets de backend (`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, credenciales AWS/S3) viven en el servicio `functions` del compose stack de Supabase, no en este repo.

### No tocar

- `supabase-backup/` y `n8n-backup/` son dumps locales gitignored con datos/credenciales reales de producción (un `.dump` de Postgres, JSONs exportados de workflows de n8n, archivos `.env` reales). Nunca leerlos hacia un commit ni asumir que su contenido es seguro para compartir.
