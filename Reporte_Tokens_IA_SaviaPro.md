# 🤖 Uso de Modelos de IA — SaviaPro

> **Fecha:** Marzo 2026 · **Objetivo:** Mapear los modelos de IA activos en la app, su rol y proyectar el costo en escenarios de uso real.

---

## 1. Mapa de Modelos por Función

| Modelo                   | Categoría                  | Función en SaviaPro                                                             | Invocado desde                                |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| `gemini-embedding-001`   | Embeddings (vectores 768D) | Indexar documentos subidos + buscar contexto RAG en cada chat                   | `process-document`, `query-knowledge`, `chat` |
| `gemini-3.1-pro-preview` | Visión multimodal          | Detectar y describir elementos visuales (gráficos, diagramas, fórmulas) en PDFs | `extract-pdf-text`                            |
| `gemini-2.5-flash`       | Razonamiento ágil          | Generar quiz de 7 preguntas personalizadas tras la sesión de estudio            | `generar-fichas`                              |
| `gemini-2.5-flash-lite`  | Micro-tareas               | Auto-titular cada nueva conversación (2-3 palabras)                             | `chat`                                        |
| **n8n Webhook (agente)** | Orquestación               | Respuesta pedagógica principal del chat + Mapas Mentales + Informes PDF         | `chat`                                        |

---

## 2. Precios Actuales de API (Google Gemini)

| Modelo                               | Input (por 1M tokens) | Output (por 1M tokens) |
| ------------------------------------ | --------------------- | ---------------------- |
| `gemini-embedding-001`               | **$0.15**             | — _(solo input)_       |
| `gemini-3.1-pro-preview` (≤200K ctx) | **$2.00**             | **$12.00**             |
| `gemini-3.1-pro-preview` (>200K ctx) | **$4.00**             | **$18.00**             |
| `gemini-2.5-flash`                   | **$0.30**             | **$2.50**              |
| `gemini-embedding-001`               | **$0.15**             | — _(solo input)_       |
| `gemini-3.1-pro-preview` (≤200K ctx) | **$2.00**             | **$12.00**             |
| `gemini-3.1-pro-preview` (>200K ctx) | **$4.00**             | **$18.00**             |
| `gemini-2.5-flash`                   | **$0.30**             | **$2.50**              |
| `gemini-2.5-flash-lite`              | **$0.10**             | **$0.40**              |

> _Precios en USD vía Google AI API (Gemini Developer Platform). Fuente: Google AI, Marzo 2026._

---

## 3. Consumo por Operación — Referencia Rápida

| Operación                                   | Modelo                   | Tokens Input | Tokens Output |  Costo est.   |
| ------------------------------------------- | ------------------------ | :----------: | :-----------: | :-----------: |
| Subir PDF 10p — Detección de imágenes       | `gemini-3.1-pro-preview` |    ~2,500    |      ~0       |  **$0.005**   |
| Subir PDF 10p — Describir gráficos (2 imgs) | `gemini-3.1-pro-preview` |     ~800     |     ~400      |  **$0.007**   |
| Subir PDF 10p — Embeddings (~15 chunks)     | `gemini-embedding-001`   |    ~7,000    |       —       |  **$0.001**   |
| **Subida PDF promedio (end-to-end)**        | varios                   | **~10,300**  |   **~400**    |  **~$0.013**  |
| Embedding por mensaje de chat (RAG)         | `gemini-embedding-001`   |     ~80      |       —       |   $0.000012   |
| Auto-titular conversación                   | `gemini-2.5-flash-lite`  |     ~150     |      ~10      | **$0.000019** |
| **Sesión chat de 10 mensajes**              | varios                   | **~16,000**  |  **~3,000**   |  **~$0.002**  |
| Generar Ficha Didáctica (quiz 7 preguntas)  | `gemini-2.5-flash`       |    ~4,800    |     ~650      |  **~$0.003**  |

---

## 4. Ejemplos Concretos por Caso de Uso

### � Subida de Documentos — Por Tamaño

Cada PDF pasa por un pipeline en 3 pasos: **(1)** extracción de texto base, **(2)** detección y descripción de imágenes con `gemini-3.1-pro-preview`, y **(3)** generación de embeddings con `gemini-embedding-001`. Este costo se paga **una sola vez** al subir el archivo.

| Caso                  | Descripción                                    | Págs | Chunks | Imágenes | Tokens Input | Tokens Output |  **Costo**   |
| --------------------- | ---------------------------------------------- | :--: | :----: | :------: | :----------: | :-----------: | :----------: |
| 🟢 **PDF Chico**      | Apunte de 2 páginas, solo texto                |  2   |   3    |    0     |    ~2,000    |       0       | **~$0.0003** |
| 🟡 **PDF Promedio**   | Guía de estudio de 10 páginas, 2 gráficos      |  10  |   15   |    2     |   ~10,300    |     ~400      | **~$0.013**  |
| 🟠 **PDF Grande**     | Capítulo de libro, 40 páginas, 8 diagramas     |  40  |   55   |    8     |   ~38,000    |    ~1,600     | **~$0.053**  |
| 🔴 **PDF Muy Grande** | Libro completo, 150 páginas, 30 imágenes       | 150  |  210   |    30    |   ~140,000   |    ~6,000     | **~$0.196**  |
| 🔴 **PPT Exportado**  | Presentación de 50 páginas, casi todo imágenes |  50  |   30   |    45    |   ~62,000    |    ~9,000     | **~$0.236**  |

> ⚠️ **Mayor riesgo:** El PDF visual intensivo (tipo PPT o libro técnico) es el caso más costoso porque `gemini-3.1-pro-preview` procesa cada imagen individualmente. Un libro técnico de 150 páginas puede costar ~$0.20 solo en la subida.

---

### � Conversaciones de Chat — Por Extensión

El costo directo de Gemini en el chat viene del **embedding de la pregunta del usuario** (para buscar contexto RAG) y del **auto-titulado** (una sola vez por chat). La respuesta del tutor principal se genera en n8n y no está incluida aquí.

| Caso                     | Descripción                                               | Mensajes | Tokens RAG | Auto-título | **Costo Gemini directo** |
| ------------------------ | --------------------------------------------------------- | :------: | :--------: | :---------: | :----------------------: |
| 🟢 **Consulta Rápida**   | 1 pregunta puntual, respuesta inmediata                   |    2     |    ~160    |     No      |      **~$0.000024**      |
| 🟡 **Sesión Normal**     | Estudio de un tema con ida y vuelta                       |    10    |    ~800    |  ✅ 1 vez   |      **~$0.00014**       |
| 🟠 **Sesión Extensa**    | Una tarde completa explorando un tema a fondo             |    30    |   ~2,400   |  ✅ 1 vez   |      **~$0.00038**       |
| 🔴 **Repaso Pre-Examen** | Sesión intensiva de 60+ intercambios, historial al límite |    60    |   ~4,800   |  ✅ 1 vez   |      **~$0.00074**       |

> 💡 Para conversaciones extensas, el mayor costo **no es Gemini** sino el historial que se envía a n8n. Una sesión de 60 mensajes arrastra ~15,000 tokens de contexto por cada turno al LLM del agente.

---

### 🃏 Generación de Fichas Didácticas — Por Contexto

El quiz se genera en 2 llamadas a `gemini-2.5-flash`: primero resume el tema de la conversación, luego genera las 7 preguntas. El costo varía según el largo del historial analizado.

| Caso                             | Historial analizado | Tokens Input | Tokens Output |  **Costo**  |
| -------------------------------- | ------------------- | :----------: | :-----------: | :---------: |
| 🟢 **Chat corto** (≤5 mensajes)  | ~1,200 tokens       |    ~2,000    |     ~650      | **~$0.002** |
| 🟡 **Chat normal** (10 mensajes) | ~3,000 tokens       |    ~4,800    |     ~650      | **~$0.003** |
| 🟠 **Chat largo** (20+ mensajes) | ~6,000 tokens       |    ~8,000    |     ~650      | **~$0.005** |

---

## 5. Proyección de Costos Mensuales

Mix asumido: cada usuario activo sube **2 docs/mes**, tiene **5 sesiones de chat** de 10 mensajes, y genera **1 quiz/mes**.

| Escenario            | Usuarios | Docs subidos | Sesiones chat | Quizzes | **Costo Gemini/mes** |
| -------------------- | :------: | :----------: | :-----------: | :-----: | :------------------: |
| 🟢 **Early Stage**   |   100    |     200      |      500      |   100   |     **≈ $4.90**      |
| 🟡 **Crecimiento**   |  1,000   |    2,000     |     5,000     |  1,000  |      **≈ $49**       |
| 🟠 **Escala media**  |  5,000   |    8,000     |    25,000     |  4,000  |      **≈ $218**      |
| 🔴 **Escala máxima** |  10,000  |    12,000    |    60,000     |  8,000  |    **≈ $435–520**    |

> **Período de exámenes:** El chat se multiplica x2.5 y los quizzes x4. El costo mensual puede duplicarse en ese período.

---

## 6. Consideraciones de Optimización

| Palanca                             | Impacto                                                                                                         | Estado             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| 🟢 **Embeddings reutilizables**     | Documentos indexados 1 sola vez; búsqueda en chat es mínima                                                     | ✅ Implementado    |
| 🟢 **Flash-Lite para micro-tareas** | ~67% más barato que Flash para auto-titulado                                                                    | ✅ Implementado    |
| 🟡 **Caché del prompt del sistema** | Reutilizar el prompt de "Sofía tutora" entre requests reduce Input tokens                                       | ⏳ Por implementar |
| 🟡 **Límite de historial del chat** | Limitado a 20 mensajes; reducir a 10 en picos bajaría costos de n8n                                             | ✅ Parcial         |
| 🔴 **PDFs visuales muy grandes**    | Pasar por `gemini-3.1-pro-preview` por cada página imagenizada es caro; considerar límite de páginas analizadas | ⚠️ Riesgo latente  |

---

> **Nota:** Los costos del agente principal de chat (n8n + LLM interno) **no están incluidos** aquí ya que dependen del proveedor configurado en n8n. Deben sumarse a este presupuesto según el plan contratado.
