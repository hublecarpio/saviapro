# Despliegue Supabase Self-Hosted (EasyPanel)

> Copia local de la página de Notion "Documentación Técnica — Despliegue Supabase Self-Hosted (EasyPanel)". Puede tener errores, pero sirve como base general.
> Fuente: https://app.notion.com/p/Documentaci-n-T-cnica-Despliegue-Supabase-Self-Hosted-EasyPanel-32b7f9fe9bd780079f87effff2d0e7d4
> Los valores reales de secrets/env vars están en `docs/credenciales/credenciales.local.md` (gitignored), no acá.

## 0. Identificación del entorno

- **Host:** `srv1359727`
- **Virtualización:** KVM (QEMU)
- **OS:** Ubuntu 24.04.4 LTS (Noble)
- **Kernel:** `6.8.0-100-generic`
- **Docker Engine:** `29.2.1` / **Compose:** `v2.31.0`
- **EasyPanel:** v2.26.2 (gestiona compose y proxy)
- **Reverse proxy:** Traefik `3.6.7` (servicio Swarm)
- **Fecha de referencia del estado:** 2026-02-14

## 1. Objetivo del despliegue

Supabase self-hosted expuesto públicamente vía Traefik con dos dominios:

- **Studio (UI):** `dbstudio.biexedu.com`
- **API Gateway (Kong):** `dbapi.biexedu.com`

## 2. Topología de tráfico

1. Cliente (Internet) → **Traefik** (puertos host 80/443)
2. Traefik enruta por `Host()`:
   - `dbapi.biexedu.com` → service `biex_supabase-0` → `http://biex_supabase_kong:8000/`
   - `dbstudio.biexedu.com` → service `biex_supabase-1` → `http://biex_supabase_studio:3000/`
3. Kong enruta internamente por path (`/auth/v1`, `/rest/v1`, etc.)

## 3. Traefik — dominios, routers, middlewares

Config en `/etc/easypanel/traefik/config/main.yaml` (host) / `/data` (container). Certs en `/etc/easypanel/traefik/dump/{dbapi,dbstudio,panel}.biexedu.com/`.

- Router `dbapi.biexedu.com`: HTTP (redirect-to-https, bad-gateway-error-page) + HTTPS (TLS letsencrypt, bad-gateway-error-page)
- Router `dbstudio.biexedu.com`: igual + middleware `studio-auth` (BasicAuth sobre el dashboard Studio)

Middlewares: `redirect-to-https`, `bad-gateway-error-page` (502 vía servicio easypanel), `studio-auth`. Kong maneja auth/ACL de rutas internas; los middlewares de Traefik son solo de borde.

## 4. Redes Docker

### 4.1 Red externa (Swarm overlay) — `easypanel`

- Driver: overlay, subnet `10.11.0.0/16`, gateway `10.11.0.1`, attachable
- Contenedores: `traefik.1.*` (10.11.0.3), `easypanel.1.*` (10.11.0.4), `biex_supabase-studio-1` (10.11.0.10), `biex_supabase-kong-1` (10.11.0.12)

### 4.2 Red interna del stack (bridge compose) — `biex_supabase_default`

- `kong`: 172.19.0.3, `studio`: 172.19.0.8 (IPs de referencia, pueden variar al recrear containers)

### 4.3 Aliases (override EasyPanel)

EasyPanel inyecta `docker-compose.override.yml` para exponer `kong`/`studio` también en la red `easypanel` con aliases `biex_supabase_kong` / `biex_supabase_studio`, que es lo que resuelve Traefik.

## 5. Ubicación del proyecto en el host

`/etc/easypanel/projects/biex/supabase/code/` — `docker-compose.yml`, `docker-compose.override.yml`, `.env`.

## 6. Servicios del stack (estado de referencia, 2026-02-14)

| Container | Imagen | Estado (ref.) |
|---|---|---|
| `biex_supabase-auth-1` | `supabase/gotrue:v2.185.0` | healthy |
| `biex_supabase-studio-1` | `supabase/studio:2026.01.27-sha-6aa59ff` | healthy |
| `biex_supabase-db-1` | `supabase/postgres:15.8.1.085` | healthy |
| `biex_supabase-imgproxy-1` | `darthsim/imgproxy:v3.30.1` | healthy |
| `biex_supabase-functions-1` | `supabase/edge-runtime:v1.70.0` | **restarting** (ver § 15) |
| `biex_supabase-realtime-1` | `supabase/realtime:v2.72.0` | healthy |
| `biex_supabase-storage-1` | `supabase/storage-api:v1.37.1` | healthy |
| `biex_supabase-rest-1` | `postgrest/postgrest:v14.3` | running |
| `biex_supabase-meta-1` | `supabase/postgres-meta:v0.95.2` | healthy |
| `biex_supabase-supavisor-1` | `supabase/supavisor:2.7.4` | healthy |
| `biex_supabase-analytics-1` | `supabase/logflare:1.30.3` | healthy |
| `biex_supabase-vector-1` | `timberio/vector:0.28.1-alpine` | healthy |
| `biex_supabase-kong-1` | `kong:2.8.1` | healthy |

Orden de dependencia (`depends_on: condition: service_healthy`): `vector` → `db` → `analytics` → (`auth`, `rest`, `realtime`, `storage`, `meta`, `functions`, `kong`, `supavisor`) → `studio`.

## 7. Puertos publicados en el host

| Puerto | Servicio | Container |
|---|---|---|
| 80/tcp, 443/tcp | Traefik | `traefik.1.*` |
| 8000/tcp, 8443/tcp | Kong (HTTP/HTTPS proxy) | `biex_supabase-kong-1` |
| 4000/tcp | Logflare | `biex_supabase-analytics-1` |
| 5432/tcp | Supavisor (DB proxy) | `biex_supabase-supavisor-1` |
| 6543/tcp | Supavisor (transaction pooler) | `biex_supabase-supavisor-1` |

Studio no expone puerto host — se publica solo vía Traefik → `biex_supabase_studio:3000`.

## 8. Persistencia en disco (host)

Raíz: `/opt/supabase/volumes_official/` — subcarpetas `api/`, `db/`, `functions/`, `logs/`, `pooler/`, `snippets/`, `storage/`.

- **Kong:** `api/kong.yml`, `api/kong-nginx-http.conf` (+ backups timestamped)
- **Vector:** `logs/vector.yml`
- **Supavisor:** `pooler/pooler.exs`
- **Postgres:** datos en `db/data` (bind mount — sobrevive a recrear el container); init scripts `_supabase.sql`, `jwt.sql`, `roles.sql`, `logs.sql`, `pooler.sql`, `realtime.sql`, `webhooks.sql` (solo corren en un data dir vacío, no en cada arranque)
- **Storage:** `storage/`
- **Edge Functions:** `functions/main/index.ts`
- **Snippets:** `snippets/` (montado en Studio)

## 9. Kong

- Resolver DNS interno vía `api/kong-nginx-http.conf`: DNS Docker `127.0.0.11`, `ipv6=off`, `valid=30s` (evita fallas de resolución dentro de Kong/Nginx).
- Declarativo (`api/kong.yml`, `_format_version: '2.1'`): consumers `DASHBOARD` (BasicAuth), `anon`/`service_role` (KeyAuth); ACLs `anon`→group `anon`, `service_role`→group `admin`.
- Plugins globales: request-transformer, cors, key-auth, acl, basic-auth, request-termination, ip-restriction.
- Rutas: `/auth/v1/*` → `auth:9999`, `/rest/v1/*` → `rest:3000`, `/graphql/v1` → `rest:3000/rpc/graphql`, `/realtime/v1/*` → `realtime-dev.supabase-realtime:4000` (ws + REST), `/storage/v1/*` → `storage:5000`, `/functions/v1/*` → `functions:9000`, `/analytics/v1/*` → `analytics:4000`.

## 10. Postgres — bootstrap

- Imagen `supabase/postgres:15.8.1.085`, healthcheck `pg_isready -U postgres -h localhost`.
- Init scripts (solo corren si el data dir está vacío): `_supabase.sql` crea DB `_supabase`; `jwt.sql` setea `app.settings.jwt_secret`/`jwt_exp`; `roles.sql` setea passwords de roles internos (`authenticator`, `pgbouncer`, `supabase_auth_admin`, `supabase_functions_admin`, `supabase_storage_admin`); `realtime.sql` crea schema `_realtime`; `logs.sql` crea schema `_analytics` en `_supabase`; `pooler.sql` crea schema `_supavisor` en `_supabase`; `webhooks.sql` instala `pg_net` y `supabase_functions.http_request()`.

## 11. Supavisor (pooler)

Puertos 5432 (proxy principal) y 6543 (transaction pooler). Config en `pooler/pooler.exs`: crea tenant si no existe, `auth_query` vía `pgbouncer.get_auth($1)`, `pool_mode: transaction`, `POOLER_TENANT_ID` como external_id.

## 12. Observabilidad (Vector + Logflare)

- **Vector** (`timberio/vector:0.28.1-alpine`): API en `0.0.0.0:9001`, fuente `docker_logs`, ruteo por nombre de container (kong, auth, rest, realtime, storage, functions, db). Sinks a Logflare: `gotrue.logs.prod`, `realtime.logs.prod`, `postgREST.logs.prod`, `postgres.logs` (vía Kong), `deno-relay-logs`, `storage.logs.prod.2`, `cloudflare.logs.prod`. Config en `logs/vector.yml`.
- **Logflare** (`supabase/logflare:1.30.3`): puerto 4000, backend Postgres DB `_supabase` schema `_analytics`, healthcheck `curl http://localhost:4000/health`.

## 13. Studio

Imagen `supabase/studio:2026.01.27-sha-6aa59ff`, puerto interno 3000, publicado solo vía Traefik. Monta `snippets` → `/app/snippets` y `functions` → `/app/edge-functions`. Depende de `analytics` healthy. Auth adicional de borde: middleware Traefik `studio-auth`.

## 14. Auth / REST / Realtime / Storage / Meta / Imgproxy

- **Auth (GoTrue)** `v2.185.0`, puerto 9999, DB URL `postgres://supabase_auth_admin@db:5432/postgres`, publicado solo vía Kong `/auth/v1/*`.
- **REST (PostgREST)** `v14.3`, puerto 3000, publicado solo vía Kong `/rest/v1/*`, schemas `public,storage,graphql_public`.
- **Realtime** `v2.72.0`, puerto 4000, vía Kong `/realtime/v1/*`.
- **Storage** `v1.37.1`, puerto 5000, persistencia en `storage/`, vía Kong `/storage/v1/*`.
- **Postgres Meta** `v0.95.2`, puerto 8080 (Studio apunta a `http://meta:8080`).
- **Imgproxy** `v3.30.1`, bind `:5001`, FS root `/var/lib/storage` (mismo volumen que storage).

## 15. Edge Functions

Imagen `supabase/edge-runtime:v1.70.0`, monta host `functions/` → container `/home/deno/functions`, comando `start --main-service /home/deno/functions/main/index.ts` (`main/index.ts` responde `"ok"`). Arranca estable (`main function started`), sin healthcheck definido en el compose.

## 16. Compose y override

### 16.1 Variables de entorno

Los valores reales (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `PG_META_CRYPTO_KEY`, `LOGFLARE_*_ACCESS_TOKEN`, `DASHBOARD_PASSWORD`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, webhooks, etc.) están en `docs/credenciales/credenciales.local.md` (gitignored) — no se repiten acá.

Estructura de variables que consume el compose (nombres, sin valores): `POSTGRES_HOST/PORT/DB/PASSWORD`, `JWT_SECRET/EXPIRY`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `PG_META_CRYPTO_KEY`, `PGRST_DB_SCHEMAS`, `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`, `ADDITIONAL_REDIRECT_URLS`, `DISABLE_SIGNUP`, `MAILER_URLPATHS_*`, `ENABLE_EMAIL_SIGNUP/AUTOCONFIRM`, `ENABLE_PHONE_SIGNUP/AUTOCONFIRM`, `ENABLE_ANONYMOUS_USERS`, `SMTP_*` (Mailpit dummy — SMTP no está realmente configurado), `STUDIO_DEFAULT_ORGANIZATION/PROJECT`, `DASHBOARD_USERNAME/PASSWORD`, `KONG_HTTP_PORT/HTTPS_PORT`, `DOCKER_SOCKET_LOCATION`, `FILE_SIZE_LIMIT_BYTES`, `LOGFLARE_PUBLIC/PRIVATE_ACCESS_TOKEN`, `POOLER_*`, `IMGPROXY_AUTO_WEBP`, `FUNCTIONS_VERIFY_JWT`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `APP_URL`, `WEBHOOK_*`.

### 16.2 Docker Compose (servicios, sin valores resueltos)

Servicios definidos: `studio`, `kong`, `auth`, `rest`, `realtime`, `storage`, `imgproxy`, `meta`, `functions`, `analytics`, `db`, `vector`, `supavisor`. Volumen nombrado: `db-config`.

Puntos notables:

- `kong` entrypoint custom: `bash -c 'eval "echo \"$(cat ~/temp.yml)\"" > ~/kong.yml && /docker-entrypoint.sh kong docker-start'` (interpola env vars dentro del `kong.yml` declarativo antes de arrancar).
- `realtime` se conecta a la red `default` con alias `realtime-dev.supabase-realtime` (así lo referencia Kong).
- `db` depende de `vector` healthy; `analytics` depende de `db` healthy; casi todo el resto depende de `analytics` healthy — si `analytics` no levanta, todo el stack de arriba queda bloqueado.
- `supavisor` corre `/app/bin/migrate && /app/bin/supavisor eval "$(cat /etc/pooler/pooler.exs)" && /app/bin/server` como comando.

### 16.3 Override de EasyPanel

Inyecta en `kong` y `studio` una conexión adicional a la red externa `easypanel` (`external: true`) con los aliases `biex_supabase_kong` / `biex_supabase_studio`, y remueve la red `default` de esas dos entradas de `networks` a nivel Compose (`"default": null` — no afecta la red bridge en sí, es solo cómo el override las declara).
