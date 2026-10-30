# Runbook: MCP con Supabase Self-Hosted

Este documento resume lo que se configuró, qué partes son persistentes y cómo conectarse en el día a día sin volver a reconfigurar todo.

## Estado actual (confirmado)

- El endpoint MCP en Kong está habilitado en el archivo persistente del host:
  - `/opt/supabase/volumes_official/api/kong.yml`
- El bloque `mcp` también aparece dentro del contenedor Kong en:
  - `/home/kong/temp.yml`
  - `/home/kong/kong.yml`
- Se actualizó el password de `supabase_read_only_user` en Postgres para que Studio/Meta puedan responder correctamente al MCP.
- El servidor MCP quedó operativo (se pudo listar tablas vía `list_tables`).

## Cambios aplicados (persistentes)

### 1) Kong: ruta MCP con restricción IP

Se agregó este bloque al final de `/opt/supabase/volumes_official/api/kong.yml`:

```yaml
  ## MCP endpoint - local access
  - name: mcp
    _comment: 'MCP: /mcp -> http://studio:3000/api/mcp (local access)'
    url: http://studio:3000/api/mcp
    routes:
      - name: mcp
        strip_path: true
        paths:
          - /mcp
    plugins:
      - name: cors
      - name: ip-restriction
        config:
          allow:
            - 127.0.0.1
            - ::1
            - 172.19.0.1
          deny: []
```

Notas:
- `172.19.0.1` es el gateway de Docker detectado para este stack.
- `deny: []` se mantiene (requisito de la configuración de Supabase/Kong).

### 2) Password de rol de solo lectura

Se ejecutó:

```sql
ALTER ROLE supabase_read_only_user WITH PASSWORD '<POSTGRES_PASSWORD>';
```

Esto evita errores de autenticación del tipo:
- `password authentication failed for user "supabase_read_only_user"`

## Configuración local de Cursor (cliente MCP)

Archivo local en Windows:
- `C:\Users\escud\.cursor\mcp.json`

Contenido:

```json
{
  "mcpServers": {
    "supabase-self-hosted": {
      "url": "http://127.0.0.1:8080/mcp"
    }
  }
}
```

## Flujo diario para conectarte (lo único que tenés que hacer)

1. Abrir Bitvise con tu perfil habitual.
2. Verificar túnel C2S activo:
   - Listen: `127.0.0.1:8080`
   - Destination: `127.0.0.1:8000`
3. Iniciar sesión (Log in) y dejar la sesión abierta.
4. Abrir Cursor (o reiniciarlo si ya estaba abierto).
5. Usar el servidor MCP `supabase-self-hosted`.

Opcional de chequeo rápido:

```powershell
curl.exe http://127.0.0.1:8080/mcp
```

Si responde `Method GET Not Allowed`, está bien: el endpoint está alcanzable y espera `POST`.

## Verificación rápida en este repo

Pedir en chat:
- "dame todas las tablas que esten en supabase"
- o "listame tablas de public por MCP"

Si responde con tablas, conexión OK.

## Troubleshooting corto

- `Not connected` en Cursor:
  - revisar que Bitvise siga conectado y el túnel esté activo.
  - reiniciar Cursor.
- `An invalid response was received from the upstream server`:
  - reiniciar `studio` y `kong`.
  - validar que el bloque `mcp` siga en `/opt/supabase/volumes_official/api/kong.yml`.
- Errores de auth de `supabase_read_only_user`:
  - volver a alinear password del rol con `POSTGRES_PASSWORD`.

## Comandos útiles (servidor)

Ver gateway de red en Kong:

```bash
docker inspect biex_supabase-kong-1 --format '{{range .NetworkSettings.Networks}}{{println .Gateway}}{{end}}'
```

Confirmar bloque MCP en archivos runtime:

```bash
docker exec -it biex_supabase-kong-1 sh -lc "grep -n 'name: mcp' /home/kong/kong.yml /home/kong/temp.yml"
```

Reiniciar servicios clave:

```bash
docker restart biex_supabase-kong-1 biex_supabase-studio-1 biex_supabase-meta-1
```

## Seguridad recomendada

Durante esta sesión se compartieron credenciales en texto plano. Se recomienda rotar:

- `ANON_KEY`
- `SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `DASHBOARD_PASSWORD`
- y cualquier password expuesto en terminal/chat

