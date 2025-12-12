# Documentación Técnica - Sofía AI Tutor

## Índice
1. [Arquitectura General](#arquitectura-general)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Base de Datos](#base-de-datos)
4. [Edge Functions](#edge-functions)
5. [Flujos Principales](#flujos-principales)
6. [Componentes Clave](#componentes-clave)
7. [Autenticación y Roles](#autenticación-y-roles)

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Auth      │  │   Chat      │  │   Tutor     │              │
│  │   Pages     │  │   Interface │  │   Dashboard │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Lovable Cloud)                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     Edge Functions                          ││
│  │  • chat           • daily-reports    • upload-to-s3        ││
│  │  • create-student • generar-fichas   • transcribe-audio    ││
│  │  • delete-user    • generate-media   • get-starter-profile ││
│  │  • send-password-reset • get-system-prompt                 ││
│  │  • update-invited-user • webhook-integration               ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      Database (PostgreSQL)                  ││
│  │  • profiles       • conversations    • messages            ││
│  │  • user_roles     • tutor_students   • tutor_reports       ││
│  │  • starter_profiles • fichas_didacticas • quiz_results     ││
│  │  • invited_users  • uploaded_documents • mind_maps         ││
│  │  • system_config                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      Storage                                ││
│  │  • chat-files (bucket privado)                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICIOS EXTERNOS                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   n8n       │  │   S3        │  │   DeepSeek  │              │
│  │   Webhooks  │  │   Storage   │  │   API       │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estructura del Proyecto

```
src/
├── assets/                    # Imágenes y assets estáticos
│   ├── cyrano-logo.png
│   ├── sofi_piensa.png
│   └── sofi_sin_piensa.png
│
├── components/
│   ├── admin/                 # Componentes de administrador
│   │   └── AdminConversationHistory.tsx
│   │
│   ├── tutor/                 # Componentes de tutor
│   │   ├── TutorAvance.tsx
│   │   ├── TutorEstadisticas.tsx
│   │   ├── TutorReportes.tsx
│   │   ├── TutorResumen.tsx
│   │   └── TutorTabs.tsx
│   │
│   ├── user/                  # Componentes de usuario/auth
│   │   ├── AdminOptions.tsx
│   │   ├── ListUser.tsx
│   │   ├── Login.tsx
│   │   ├── Prompt.tsx
│   │   ├── Register.tsx
│   │   ├── RegisterUser.tsx
│   │   └── TutorOptions.tsx
│   │
│   ├── ui/                    # Componentes shadcn/ui
│   │   └── [múltiples componentes]
│   │
│   ├── data/
│   │   └── starterSchema.ts   # Esquema del cuestionario inicial
│   │
│   ├── AppSidebar.tsx         # Sidebar principal del chat
│   ├── AppSidebarBeta.tsx     # Sidebar beta
│   ├── ChatToolsSidebar.tsx   # Sidebar de herramientas del chat
│   ├── DocumentsList.tsx      # Lista de documentos subidos
│   ├── FichasDidacticas.tsx   # Componente de fichas/quiz
│   ├── FileUploader.tsx       # Subidor de archivos
│   ├── MindMapDisplay.tsx     # Visualizador de mapas mentales
│   ├── MindMapProgressBar.tsx # Barra de progreso de mapas
│   ├── MobileChatToolsFAB.tsx # FAB móvil para herramientas
│   ├── NavBarUser.tsx         # Barra de navegación
│   ├── SofiaThinking.tsx      # Animación de Sofía pensando
│   └── StarterProfileEditor.tsx # Editor de perfil inicial
│
├── hooks/
│   ├── use-mobile.tsx         # Hook para detectar móvil
│   ├── use-toast.ts           # Hook para toasts
│   ├── useAudioRecorder.ts    # Hook para grabar audio
│   ├── useAuth.tsx            # Hook de autenticación
│   └── useLogout.ts           # Hook de logout
│
├── integrations/supabase/
│   ├── client.ts              # Cliente Supabase (auto-generado)
│   └── types.ts               # Tipos TypeScript (auto-generado)
│
├── layout/
│   ├── DashboardLayout.tsx    # Layout del dashboard
│   └── ProtectedLayout.tsx    # Layout protegido
│
├── lib/
│   ├── types.ts               # Tipos globales
│   ├── utils.ts               # Utilidades (cn, etc.)
│   └── validation.ts          # Validaciones
│
├── pages/
│   ├── AdminBeta.tsx          # Panel admin beta
│   ├── Auth.tsx               # Página de autenticación
│   ├── Chat.tsx               # Página principal del chat
│   ├── Index.tsx              # Página índice
│   ├── InviteRegister.tsx     # Registro por invitación
│   ├── MindMap.tsx            # Página de mapa mental
│   ├── NotFound.tsx           # Página 404
│   ├── ResetPassword.tsx      # Reseteo de contraseña
│   ├── Starter.tsx            # Cuestionario inicial
│   ├── Tutor.tsx              # Panel de tutor
│   └── TutorDashboard.tsx     # Dashboard del tutor
│
├── providers/
│   └── AuthProvider.tsx       # Proveedor de autenticación
│
├── routes/
│   ├── App.tsx                # Definición de rutas
│   └── ProtectedRoute.tsx     # Componente de ruta protegida
│
├── services/
│   └── auth.ts                # Servicios de autenticación
│
├── store/
│   └── useUserStore.ts        # Store de usuario (Zustand)
│
├── index.css                  # Estilos globales + Design System
└── main.tsx                   # Entry point

supabase/
├── config.toml                # Configuración de Supabase
├── functions/
│   ├── chat/                  # Chat con IA
│   ├── create-student/        # Crear estudiante
│   ├── daily-reports/         # Reportes diarios automáticos
│   ├── delete-user/           # Eliminar usuario
│   ├── generar-fichas/        # Generar fichas didácticas
│   ├── generate-media/        # Generar video/podcast
│   ├── get-starter-profile/   # Obtener perfil inicial
│   ├── get-system-prompt/     # Obtener prompt del sistema
│   ├── send-password-reset/   # Enviar reset de contraseña
│   ├── transcribe-audio/      # Transcribir audio
│   ├── update-invited-user/   # Actualizar usuario invitado
│   ├── upload-to-s3/          # Subir archivos a S3
│   └── webhook-integration/   # Integración con webhooks
└── migrations/                # Migraciones de base de datos
```

---

## Base de Datos

### Tablas Principales

#### `profiles`
Información básica del usuario.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK, referencia a auth.users |
| email | text | Email del usuario |
| name | text | Nombre del usuario |
| starter_completed | boolean | Si completó el cuestionario inicial |
| created_at | timestamp | Fecha de creación |

#### `user_roles`
Roles de los usuarios (admin, tutor, student).
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK a profiles |
| role | app_role | 'admin', 'tutor', 'student' |
| created_at | timestamp | Fecha de creación |

#### `tutor_students`
Relación tutor-estudiante.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| tutor_id | uuid | FK al tutor |
| student_id | uuid | FK al estudiante |
| created_at | timestamp | Fecha de creación |

#### `conversations`
Conversaciones de chat.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK a profiles |
| title | text | Título de la conversación |
| created_at | timestamp | Fecha de creación |
| updated_at | timestamp | Última actualización |

#### `messages`
Mensajes del chat.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| conversation_id | uuid | FK a conversations |
| user_id | uuid | FK a profiles |
| role | text | 'user' o 'assistant' |
| message | text | Contenido del mensaje |
| created_at | timestamp | Fecha de creación |

#### `starter_profiles`
Respuestas del cuestionario inicial.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK a profiles |
| age | integer | Edad |
| age_group | text | Grupo de edad |
| profile_data | jsonb | Datos completos del perfil |
| created_at | timestamp | Fecha de creación |
| updated_at | timestamp | Última actualización |

#### `fichas_didacticas`
Fichas de estudio/quiz generadas.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK a profiles |
| conversation_id | uuid | FK a conversations |
| pregunta | text | Pregunta |
| respuesta | text | Respuesta correcta |
| opciones | jsonb | Opciones múltiples |
| respuesta_correcta | integer | Índice de respuesta correcta |
| orden | integer | Orden de la ficha |
| created_at | timestamp | Fecha de creación |

#### `quiz_results`
Resultados de quizzes.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK a profiles |
| conversation_id | uuid | FK a conversations |
| ficha_id | uuid | FK a fichas_didacticas |
| selected_option | integer | Opción seleccionada |
| is_correct | boolean | Si fue correcta |
| created_at | timestamp | Fecha de creación |

#### `mind_maps`
Mapas mentales generados.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK a profiles |
| conversation_id | uuid | FK a conversations |
| tema | text | Tema del mapa |
| html_content | text | Contenido HTML del mapa |
| created_at | timestamp | Fecha de creación |

#### `tutor_reports`
Reportes de tutores sobre estudiantes.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| tutor_id | uuid | FK al tutor |
| student_id | uuid | FK al estudiante |
| conversation_id | uuid | FK a conversations |
| topic | text | Tema de la sesión |
| progress_summary | text | Resumen del progreso |
| difficulties | text | Dificultades identificadas |
| recommendations | text | Recomendaciones |
| emotional_state | text | Estado emocional |
| daily_observation | text | Observación diaria |
| created_at | timestamp | Fecha de creación |

#### `invited_users`
Usuarios invitados pendientes de registro.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| email | text | Email del invitado |
| token | text | Token de invitación |
| intended_role | app_role | Rol pretendido |
| created_by | uuid | Quien creó la invitación |
| used | boolean | Si ya fue usada |
| used_at | timestamp | Cuando fue usada |
| created_at | timestamp | Fecha de creación |

#### `uploaded_documents`
Documentos subidos.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| uploaded_by | uuid | FK a profiles |
| file_name | text | Nombre del archivo |
| file_type | text | Tipo MIME |
| upload_mode | text | Modo de subida |
| created_at | timestamp | Fecha de creación |

#### `system_config`
Configuración del sistema (prompts, etc.).
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| key | text | Clave de configuración |
| value | text | Valor |
| updated_by | uuid | Quien actualizó |
| updated_at | timestamp | Última actualización |

### Funciones de Base de Datos

- `has_role(user_id, role)` - Verifica si un usuario tiene un rol
- `user_was_invited_by_tutor(user_id, tutor_id)` - Verifica si un usuario fue invitado por un tutor
- `assign_role_from_invitation(user_id, email)` - Asigna rol basado en invitación
- `mark_invited_user_used(email)` - Marca invitación como usada
- `handle_new_user()` - Trigger para crear perfil en registro
- `update_conversation_timestamp()` - Trigger para actualizar timestamp de conversación

---

## Edge Functions

### `chat`
**Propósito**: Procesa mensajes del chat y genera respuestas de IA.
**Flujo**:
1. Recibe mensaje del usuario
2. Detecta tipo de respuesta (informativa, socratic, etc.)
3. Obtiene contexto del estudiante (perfil, documentos)
4. Llama a webhook de n8n para respuesta de IA
5. Guarda mensaje y respuesta en BD
6. Soporta generación de: mapas mentales, fichas, informes, video, podcast

### `daily-reports`
**Propósito**: Genera reportes diarios automáticos para tutores.
**Flujo**:
1. Obtiene todos los tutores y sus estudiantes
2. Para cada estudiante, analiza conversaciones del día
3. Genera resumen con IA
4. Guarda en `tutor_reports`
5. Envía a webhook externo

### `upload-to-s3`
**Propósito**: Sube archivos a almacenamiento S3 externo.
**Flujo**:
1. Recibe archivo en base64
2. Genera nombre único
3. Sube a bucket S3
4. Retorna URL pública

### `generar-fichas`
**Propósito**: Genera fichas didácticas/quiz de una conversación.
**Flujo**:
1. Obtiene mensajes de conversación
2. Llama a IA para generar preguntas
3. Guarda fichas en BD

### `generate-media`
**Propósito**: Genera video o podcast de una conversación.
**Flujo**:
1. Obtiene contenido de conversación
2. Llama a servicio externo de generación
3. Retorna URL del media

### `transcribe-audio`
**Propósito**: Transcribe audio a texto.
**Flujo**:
1. Recibe audio en base64
2. Llama a API de transcripción (Google Cloud)
3. Retorna texto transcrito

### `get-starter-profile`
**Propósito**: Obtiene perfil inicial del estudiante para contexto.

### `get-system-prompt`
**Propósito**: Obtiene prompt del sistema desde configuración.

### `send-password-reset`
**Propósito**: Envía email de reset de contraseña.

### `create-student` / `delete-user` / `update-invited-user`
**Propósito**: Gestión de usuarios.

---

## Flujos Principales

### 1. Flujo de Autenticación

```
Usuario → Auth.tsx → Login/Register
    │
    ├── Si registro por invitación → InviteRegister.tsx
    │       └── Valida token → Crea usuario → Asigna rol
    │
    ├── Si login normal → useAuth.tsx
    │       └── Verifica credenciales → Carga roles → Redirige
    │
    └── Redirección según rol:
            ├── admin → /admin
            ├── tutor → /tutor/dashboard
            └── student → /starter (si no completó) → /chat
```

### 2. Flujo del Chat

```
Chat.tsx
    │
    ├── Cargar conversación existente o crear nueva
    │
    ├── Usuario envía mensaje
    │       └── Guardar mensaje → Llamar edge function 'chat'
    │               └── n8n webhook → IA → Respuesta
    │
    ├── Herramientas disponibles:
    │       ├── Generar Fichas → generar-fichas → FichasDidacticas
    │       ├── Generar Mapa Mental → chat (action_type: mind_map)
    │       ├── Generar Video → generate-media
    │       ├── Generar Podcast → generate-media
    │       ├── Generar Informe → chat (action_type: report)
    │       └── Subir Documento → upload-to-s3
    │
    └── Audio → transcribe-audio → Mensaje de texto
```

### 3. Flujo del Tutor

```
TutorDashboard.tsx
    │
    ├── Ver lista de estudiantes asignados
    │
    ├── TutorTabs:
    │       ├── Resumen → TutorResumen (overview general)
    │       ├── Avance → TutorAvance (progreso por estudiante)
    │       ├── Reportes → TutorReportes (informes diarios)
    │       └── Estadísticas → TutorEstadisticas
    │
    └── Invitar estudiante → RegisterUser → invited_users
```

### 4. Flujo del Admin

```
/admin → DashboardLayout
    │
    ├── /admin (Prompt) → Editar system prompt
    ├── /admin/userlist → Invitar usuarios (tutores/admins)
    ├── /admin/users → Ver/gestionar usuarios
    └── /admin/history → Ver historial de conversaciones
```

---

## Componentes Clave

### Chat.tsx
Componente principal del chat. Maneja:
- Estado de la conversación actual
- Envío/recepción de mensajes
- Generación de herramientas (fichas, mapas, etc.)
- Subida de archivos
- Grabación de audio

### AppSidebar.tsx
Sidebar izquierdo con lista de conversaciones. Permite:
- Ver conversaciones anteriores
- Crear nueva conversación
- Navegar entre conversaciones

### ChatToolsSidebar.tsx
Sidebar derecho con herramientas. Botones para:
- Generar fichas
- Generar mapa mental
- Generar video
- Generar podcast
- Generar informe
- Ver documentos

### FichasDidacticas.tsx
Componente de quiz interactivo. Muestra:
- Preguntas con opciones múltiples
- Navegación entre fichas
- Resultados y respuestas correctas

### TutorTabs.tsx
Tabs del dashboard de tutor con vistas de:
- Resumen general
- Avance de estudiantes
- Reportes diarios
- Estadísticas

---

## Autenticación y Roles

### Roles del Sistema

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| `admin` | Administrador del sistema | Todo el sistema, gestión de usuarios, configuración |
| `tutor` | Tutor/profesor | Dashboard de tutor, ver estudiantes, reportes |
| `student` | Estudiante | Chat, cuestionario inicial, herramientas de estudio |

### Políticas RLS

Todas las tablas tienen Row Level Security habilitado:
- **profiles**: Usuarios ven su perfil, admins ven todos, tutores ven sus estudiantes
- **conversations/messages**: Solo el propietario puede ver/editar
- **tutor_students**: Tutores ven sus estudiantes, estudiantes ven sus tutores
- **tutor_reports**: Tutores ven reportes de sus estudiantes
- **user_roles**: Usuarios ven su rol, admins gestionan todos
- **starter_profiles**: Similar a profiles con permisos de tutor

### Flujo de Invitación

1. Admin/Tutor crea invitación en `invited_users` con `intended_role`
2. Se envía email con token único
3. Usuario accede a `/register/:token`
4. Al registrar, trigger asigna rol automáticamente
5. Si invitó tutor, se crea relación en `tutor_students`

---

## Variables de Entorno

### Frontend (Vite)
```
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[anon-key]
VITE_SUPABASE_PROJECT_ID=[project-id]
```

### Edge Functions (Secrets)
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
GLOBAL_S3_ENDPOINT
DEEPSEEK_API_KEY
GOOGLE_CLOUD_API_KEY
LOVABLE_API_KEY
```

---

## Stack Tecnológico

| Categoría | Tecnología |
|-----------|------------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| State | Zustand, TanStack Query |
| Routing | React Router v6 |
| Backend | Supabase (Lovable Cloud) |
| Database | PostgreSQL |
| Auth | Supabase Auth |
| Functions | Supabase Edge Functions (Deno) |
| Storage | Supabase Storage + S3 externo |
| AI | n8n webhooks + DeepSeek |

---

## Notas de Desarrollo

### Convenciones
- Componentes en PascalCase
- Hooks con prefijo `use`
- Edge functions en kebab-case
- Tablas en snake_case

### Design System
- Colores definidos en `index.css` con variables CSS
- Componentes base de shadcn/ui personalizados
- Tokens semánticos para theming

### Debugging
- Edge functions tienen logging extensivo
- Console logs en frontend para desarrollo
- Supabase Analytics para monitoreo

---

*Última actualización: Diciembre 2024*
