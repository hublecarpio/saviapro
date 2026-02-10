# 🐳 Despliegue con Docker Swarm

## Requisitos
- Docker Engine 20+ con Swarm mode
- Al menos 4GB de RAM
- 20GB de disco

## Pasos rápidos

```bash
# 1. Configurar variables
cp docker/.env.example docker/.env
nano docker/.env  # Editar con tus valores

# 2. Generar JWT secret
openssl rand -base64 32  # Copiar a JWT_SECRET en .env

# 3. Generar API keys de Supabase
# Usa: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
# Necesitas el JWT_SECRET para generar SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY

# 4. Desplegar
chmod +x docker/deploy.sh
./docker/deploy.sh
```

## Estructura

```
docker/
├── Dockerfile           # Build multi-stage del frontend
├── nginx.conf           # Configuración de Nginx (SPA)
├── docker-compose.yml   # Stack completo para Swarm
├── kong.yml             # API Gateway config
├── .env.example         # Variables de entorno template
├── deploy.sh            # Script de despliegue
└── README.md            # Este archivo
```

## Servicios

| Servicio   | Puerto | Descripción                    |
|------------|--------|--------------------------------|
| frontend   | 3000   | App React (Nginx)              |
| kong       | 8000   | API Gateway                    |
| db         | 5432   | PostgreSQL 15 + pgvector       |
| auth       | -      | GoTrue (autenticación)         |
| rest       | -      | PostgREST (API REST)           |
| storage    | -      | Supabase Storage               |
| functions  | -      | Edge Functions (Deno Runtime)  |

## Comandos útiles

```bash
# Ver servicios
docker stack services cyrano

# Escalar frontend
docker service scale cyrano_frontend=3

# Ver logs
docker service logs -f cyrano_frontend
docker service logs -f cyrano_db

# Actualizar frontend (después de rebuild)
docker service update --image cyrano-frontend:latest cyrano_frontend

# Eliminar stack
docker stack rm cyrano
```

## Migrar datos de producción

```bash
# Exportar de Supabase Cloud
pg_dump -h db.hxvjibdsldkvnaccfgah.supabase.co -U postgres -d postgres > backup.sql

# Importar al self-hosted
docker exec -i $(docker ps -q -f name=cyrano_db) psql -U postgres < backup.sql
```

## Notas importantes

- **LOVABLE_API_KEY**: Las Edge Functions usan la API de Lovable AI. En un entorno self-hosted, necesitarás reemplazar las llamadas a `ai.gateway.lovable.dev` por tu propio proveedor de AI (OpenAI, Google AI, etc.) o mantener la key si tienes acceso.
- **SMTP**: Configura un servidor SMTP real para que funcionen los emails de verificación y recuperación de contraseña.
- **SSL**: Para producción, agrega un reverse proxy (Traefik/Caddy) con certificados SSL.
