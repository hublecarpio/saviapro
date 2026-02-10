#!/bin/bash
set -e

# =============================================================================
# Script de despliegue para Docker Swarm
# =============================================================================

STACK_NAME="${1:-cyrano}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Desplegando stack: $STACK_NAME"

# Verificar que existe .env
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "❌ Error: No se encontró $SCRIPT_DIR/.env"
  echo "   Copia .env.example a .env y configura los valores"
  exit 1
fi

# Cargar variables
export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)

# Inicializar Swarm si no está activo
if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -q "active"; then
  echo "📦 Inicializando Docker Swarm..."
  docker swarm init
fi

# Construir imagen del frontend
echo "🔨 Construyendo imagen del frontend..."
docker build \
  --build-arg VITE_SUPABASE_URL="$SUPABASE_PUBLIC_URL" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_ANON_KEY" \
  --build-arg VITE_SUPABASE_PROJECT_ID="$SUPABASE_PROJECT_ID" \
  -t cyrano-frontend:latest \
  -f "$SCRIPT_DIR/Dockerfile" \
  "$SCRIPT_DIR/.."

# Desplegar stack
echo "📦 Desplegando servicios..."
docker stack deploy -c "$SCRIPT_DIR/docker-compose.yml" "$STACK_NAME"

echo ""
echo "✅ Stack '$STACK_NAME' desplegado!"
echo ""
echo "📋 Servicios:"
echo "   Frontend:  http://localhost:3000"
echo "   API:       http://localhost:8000"
echo "   DB:        localhost:5432"
echo ""
echo "📊 Ver estado: docker stack services $STACK_NAME"
echo "📝 Ver logs:   docker service logs ${STACK_NAME}_frontend"
echo "🗑️  Eliminar:   docker stack rm $STACK_NAME"
