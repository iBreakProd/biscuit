# Biscuit

**Biscuit** is a chat-based AI backend that lets users talk to a ReAct-style agent that knows their Google Drive. Users connect their Drive, index their documents, and then query them via Retrieval-Augmented Generation — the agent handles planning, tool selection, observation, and final answer generation in a streaming loop backed by Redis Streams and served over SSE.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=flat&logo=turborepo&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Neon_Postgres-00E5A0?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![Qdrant](https://img.shields.io/badge/Qdrant-FF3366?style=flat)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)
![Google Drive](https://img.shields.io/badge/Google_Drive-4285F4?style=flat&logo=googledrive&logoColor=white)
![Kubernetes](https://img.shields.io/badge/k3s-FFC61C?style=flat&logo=kubernetes&logoColor=white)

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Agent Architecture (Deep Dive)](#agent-architecture-deep-dive)
5. [Tools](#tools)
6. [Google Drive Integration](#google-drive-integration)
7. [Vector Database & Embeddings](#vector-database--embeddings)
8. [Real-Time Streaming (SSE)](#real-time-streaming-sse)
9. [Background Job System](#background-job-system)
10. [Rate Limiting](#rate-limiting)
11. [Caching](#caching)
12. [Authentication](#authentication)
13. [Database Schema](#database-schema)
14. [API Reference](#api-reference)
15. [Frontend Architecture](#frontend-architecture)
16. [Getting Started](#getting-started)
17. [Environment Variables](#environment-variables)
18. [Available Scripts](#available-scripts)

---

## High-Level Architecture

```mermaid
graph LR
    subgraph Client
        FE[Next.js Frontend]
    end

    subgraph apps/server
        API[Express API]
        AGENT[ReAct Agent Loop]
        TOOLS[Tools: drive_retrieve / web_search / web_scrape]
        SSE[SSE Endpoint<br>/sse/agent/:taskId]
    end

    subgraph Workers
        WF[worker-drive-fetch]
        WV[worker-drive-vectorize]
    end

    subgraph Data Stores
        PG[(Neon Postgres)]
        RD[(Redis Streams)]
        QD[(Qdrant<br>drive_vectors)]
    end

    subgraph External
        GDRIVE[Google Drive API]
        OAI[OpenAI<br>gpt-4o-mini / text-embedding-3-small]
        TAV[Tavily Search API]
    end

    FE -->|POST /chats/:id/messages| API
    FE -->|GET /sse/agent/:taskId| SSE
    API --> PG
    API -->|XADD agent_events:taskId| RD
    API -->|runAgentTask async| AGENT
    AGENT --> TOOLS
    TOOLS -->|embed + search| QD
    TOOLS -->|Tavily| TAV
    SSE -->|XREAD agent_events:taskId| RD
    API -->|XADD drive_fetch:shard| RD
    RD -->|XREAD drive_fetch:shard| WF
    WF --> GDRIVE
    WF --> PG
    WF -->|XADD drive_vectorize:shard| RD
    RD -->|XREAD drive_vectorize:shard| WV
    WV --> OAI
    WV --> QD
    WV --> PG
    AGENT --> OAI
```

### End-to-End Data Flows

**Chat message → streamed answer:**
```
User input
  → POST /chats/:chatId/messages
  → DB: insert chat_messages (role=user) + agent_tasks (status=pending)
  → runAgentTask() [async, not awaited]
  → ReAct loop: Plan → Execute tools → Observe → Finalize
      → XADD agent_events:{taskId}  (per event)
  → GET /sse/agent/:taskId
      → XREAD agent_events:{taskId}
      → SSE push to browser
  → Frontend renders plan checklist + thought log + final answer + citations
```

**Drive sync → indexed chunks:**
```
POST /drive/sync  [rate-limited: 1 per user per 60s]
  → Google Drive API: list files
  → DB: upsert drive_files
  → XADD drive_fetch:{shard}
  → worker-drive-fetch:
      → Download file → extract text
      → DB: upsert raw_documents
      → XADD drive_vectorize:{shard}
  → worker-drive-vectorize:
      → Chunk text (800 tokens / 100 overlap)
      → OpenAI: embed each chunk (text-embedding-3-small)
      → Qdrant: upsert points into drive_vectors
      → DB: insert chunks, update drive_files.ingestion_phase=indexed
  → drive_retrieve tool: embed query → Qdrant search → return citations + snippets
```

---

## Tech Stack

| Technology | Role |
|---|---|
| **Next.js 15 (App Router)** | Frontend — SSR, chat UI, Drive management |
| **Express.js** | API server (`apps/server`) |
| **Turborepo + pnpm** | Monorepo build orchestration |
| **Neon (serverless Postgres)** | Primary database via Drizzle ORM |
| **Drizzle ORM** | Type-safe SQL queries and migrations |
| **Redis** | Stream-based event bus, job queues, rate limiting |
| **Qdrant Cloud** | Vector similarity search (`drive_vectors` collection) |
| **OpenAI gpt-4o-mini** | Agent reasoning, planning, final answer generation |
| **OpenAI text-embedding-3-small** | Chunk + query embeddings (1536 dimensions) |
| **Tavily** | Web search in agent tool loop |
| **Google Drive API + OAuth2** | User Drive access and file ingestion |
| **KEDA** | Autoscaling workers based on Redis stream lag |
| **k3s** | Lightweight Kubernetes for deployment |
| **GitHub Actions** | CI/CD: build → push Docker images → deploy via kubectl |

---

## Project Structure

```
biscuit/
├── apps/
│   ├── server/                    # Express API + ReAct agent
│   │   └── src/
│   │       ├── agent/             # runAgentTask.ts, loop.ts (ReAct loop)
│   │       ├── tools/             # driveRetrieve.ts, web_search.ts, web_scrape.ts
│   │       ├── drive/             # Google Drive API client + route handlers
│   │       ├── auth/              # Google OAuth handlers
│   │       ├── chat/              # Chat room and message logic
│   │       ├── llm/               # openai.ts (callPlannerLLM, getEmbedding)
│   │       └── routes/            # Express router bindings
│   ├── web/                       # Next.js 15 frontend
│   │   └── src/
│   │       ├── app/chat/[id]/     # Chat room page (SSE consumer, AgentThoughtLoader)
│   │       ├── components/chat/   # MessageList, AgentThoughtLoader, CitationModal
│   │       └── components/drive/  # DriveSyncModal, IndexedDocsModal
│   ├── worker-drive-fetch/        # Fetch & text-extract worker
│   └── worker-drive-vectorize/    # Chunk, embed, upsert Qdrant worker
│
├── packages/
│   ├── db/                        # Drizzle schema, migrations, typed db client
│   ├── redis/                     # XADD/XREAD helpers, consumer group helpers
│   ├── qdrant/                    # ensureDriveVectorsCollection, searchDriveVectors
│   └── zod-schemas/               # All shared Zod schemas and inferred types
│
├── k8s/                           # Kubernetes manifests (redis, server, workers, KEDA)
└── .github/workflows/deploy.yml   # CI/CD pipeline
```

---

## Agent Architecture (Deep Dive)

The agent is a **ReAct loop** implemented in `apps/server/src/agent/loop.ts`, orchestrated by `runAgentTask.ts`. It runs entirely in-process on `apps/server`.

### Loop Overview

```mermaid
graph TD
    A[POST /chats/:id/messages] --> B[Insert user message + agent_task]
    B --> C[runAgentTask async]
    C --> D[Emit: start]
    D --> E[LLM: Plan<br>action=plan, plan_steps array]
    E --> F[Emit: step_complete with plan array]
    F --> G{Loop: step ≤ 7 and time ≤ 120s}
    G -->|next step| H[Emit: reflecting + thought]
    H --> I[LLM: call_tool or final_answer]
    I -->|call_tool| J[Execute tool inline]
    J --> K[Feed observation back to LLM]
    K --> L[Emit: step_complete]
    L --> G
    I -->|final_answer| M[Emit: finish with markdown + citations]
    M --> N[DB: update agent_tasks, insert assistant message]
    G -->|timeout or max_steps| M
```

### Planning

The first LLM call must return `action: "plan"` with a `plan_steps` string array. The agent emits a `plan` event carrying the full array so the frontend can render the complete plan checklist before execution begins.

### Execution Loop

Each iteration:
1. Emits `reflecting` with `thought_for_next_step`.
2. Calls LLM → expects `action: "call_tool"` with `tool` and `tool_query`.
3. Executes tool inline (no subprocess, no queue).
4. Injects `Tool {toolName} Execution Result:\n{observation}` into the trajectory.
5. Emits `step_complete` with `observationSummary`.

### JSON Output Contract

The LLM is constrained to exactly three valid JSON shapes — no markdown wrapping, no prose:

```jsonc
// OPTION 1: plan (step 1 only)
{ "action": "plan", "plan_steps": ["...", "..."], "thought_for_next_step": "..." }

// OPTION 2: tool call
{ "action": "call_tool", "tool": "drive_retrieve|web_search|web_scrape", "tool_query": "...", "thought_for_next_step": "..." }

// OPTION 3: finish
{ "action": "final_answer", "final_answer_markdown": "...", "thought": "..." }
```

Invalid JSON triggers a corrective re-prompt before the step counter increments.

### Constraints

| Constraint | Value |
|---|---|
| Max steps | 7 |
| Max wall-clock time | 120 seconds |
| `runAgentTask` | Async, not awaited by HTTP handler |
| In-process concurrency cap | `MAX_CONCURRENT_TASKS` (configurable, default 10) |
| Over-limit behavior | Fail-fast — new task requests beyond the cap are rejected |

---

## Tools

All tools are implemented inline in `apps/server/src/tools/`.

### `drive_retrieve`

| Field | Detail |
|---|---|
| **File** | `src/tools/driveRetrieve.ts` |
| **Input schema** | `DriveRetrieveInputSchema`: `{ query: string, userId: string, topK?: number }` |
| **Steps** | Embed query → Qdrant search on `drive_vectors` filtered by `user_id` → fetch `chunks` rows from Postgres → group by `file_id` (top 2 chunks/file) → cap at 5 files |
| **Output** | `{ formattedSnippet: string, citations: DriveCitation[] }` |
| **Score cutoff** | Hits below 0.2 cosine similarity are dropped |

### `web_search`

| Field | Detail |
|---|---|
| **File** | `src/tools/web_search.ts` |
| **Input schema** | `WebSearchInputSchema`: `{ query: string, topK?: number }` |
| **Steps** | Call Tavily Search API → format results as `WebCitation[]` |
| **When used** | After `drive_retrieve` if Drive results are insufficient, or for queries requiring current / general knowledge. Irrelevant results are discarded by the agent. |

### `web_scrape`

| Field | Detail |
|---|---|
| **File** | `src/tools/web_scrape.ts` |
| **Input** | `{ url: string }` — must be a valid HTTP/HTTPS URL |
| **Steps** | Fetch URL → extract main text → truncate to ~2 000 chars |
| **When used** | After `web_search` to read full page content from a specific result URL |

---

## Google Drive Integration

### OAuth Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Server
    participant Google

    User->>Frontend: Click "Connect Drive"
    Frontend->>Server: GET /auth/google
    Server->>Google: Redirect to OAuth consent screen
    Google-->>Server: GET /auth/google/callback?code=...
    Server->>Google: Exchange code for tokens
    Server->>Server: Upsert users row, store encrypted tokens
    Server-->>Frontend: JSON response { token: JWT }
    Frontend->>Frontend: Store JWT in localStorage (biscuit_auth_token)
```

### Sync Pipeline

```mermaid
sequenceDiagram
    participant User
    participant Server
    participant Redis
    participant WorkerFetch
    participant WorkerVectorize
    participant Qdrant

    User->>Server: POST /drive/sync
    Note over Server: Rate-limited: 1 per user per 60s → 429 if exceeded
    Server->>Server: Drive API: list files
    Server->>Server: Upsert drive_files (discovered/stale detection)
    Server->>Redis: XADD drive_fetch:{shard} for new/stale files

    Redis-->>WorkerFetch: XREAD (consumer group: drive-fetch-workers)
    WorkerFetch->>WorkerFetch: Download file, extract text
    WorkerFetch->>Server: DB upsert raw_documents + update drive_files hash
    WorkerFetch->>Redis: XADD drive_vectorize:{shard}

    Redis-->>WorkerVectorize: XREAD (consumer group: drive-vectorize-workers)
    WorkerVectorize->>WorkerVectorize: Chunk text (800 tokens / 100 overlap)
    WorkerVectorize->>WorkerVectorize: OpenAI: embed each chunk (text-embedding-3-small)
    WorkerVectorize->>Qdrant: Upsert points into drive_vectors
    WorkerVectorize->>Server: DB insert chunks, drive_files.ingestion_phase=indexed
```

### Ingestion Phases

| Phase | Meaning |
|---|---|
| `discovered` | File found in Drive, waiting for fetch job |
| `fetching` | `worker-drive-fetch` is downloading |
| `chunk_pending` | Raw text stored, waiting for vectorize job |
| `vectorizing` | `worker-drive-vectorize` is embedding |
| `indexed` | Fully embedded and searchable in Qdrant |
| `failed` | Retry count exceeded (max 2 retries) |

---

## Vector Database & Embeddings

**Collection:** `drive_vectors` (Qdrant Cloud)
**Distance metric:** Cosine similarity
**Embedding model:** `text-embedding-3-small` (1536 dimensions)

### Point Payload

```json
{
  "user_id":     "uuid",
  "file_id":     "drive-file-id",
  "file_name":   "Report.pdf",
  "chunk_index": 3,
  "mime_type":   "application/pdf",
  "hash":        "sha256..."
}
```

### Chunking Strategy

| Parameter | Value |
|---|---|
| Chunk size | ~800 tokens |
| Overlap | ~100 tokens |
| Point ID | `chunks.id` (UUID, doubles as Qdrant point ID) |

### Per-User Isolation

All Qdrant searches apply a `must` filter on `user_id` — users can only retrieve their own documents.

### Retrieval Post-Processing

1. Drop hits below score threshold (0.2 cosine similarity).
2. Fetch `chunks` Postgres rows for all hits.
3. Group by `file_id`, take top 2 chunks per file.
4. Fetch neighbor chunks (`chunk_index ± 1`) for context enrichment.
5. Cap at 5 unique files returned to the agent.

---

## Real-Time Streaming (SSE)

**Endpoint:** `GET /sse/agent/:taskId?since={lastEventId}`

The agent emits all intermediate events to the Redis stream `agent_events:{taskId}` via `XADD`. The SSE endpoint reads with `XREAD` and pushes each entry as an SSE `data:` frame, using the Redis stream ID as the SSE `id:` field.

```
agent loop --XADD--> agent_events:{taskId} --XREAD--> /sse/agent/:taskId --SSE--> browser
```

### Resumability

Clients can resume a dropped connection by passing the last received Redis stream ID as either:
- `?since={lastEventId}` query parameter
- `Last-Event-ID` request header

The server issues a `XREAD COUNT 100 STREAMS agent_events:{taskId} {since}` to replay missed events from that cursor.

### Retention Policy

`agent_events:{taskId}` streams are kept for approximately **10 minutes** after the task completes (Redis TTL). After expiry, the polling endpoint (`GET /tasks/:taskId/events`) falls back to the final state stored in Postgres (`agent_tasks.result_json`, `final_answer_markdown`, `step_summaries`).

### Event Types

| Event Type | When emitted | Key fields |
|---|---|---|
| `start` | Task begins | `taskId` |
| `plan` | Planning complete | `plan: string[]`, `thought_for_next_step` |
| `step_executing` | Tool about to be called | `thought` |
| `reflecting` | LLM thinking | `thought` |
| `step_complete` | Tool result observed | `observationSummary`, `progress` |
| `finish` | Final answer ready | `finalAnswerMarkdown`, `citations[]` |

### nginx Requirements

nginx must be configured with `proxy_buffering off` and `proxy_read_timeout 300s`. Without these, nginx buffers the SSE stream and events are not delivered in real time.

---

## Background Job System

Two independent worker apps process Drive ingestion jobs via Redis Streams consumer groups.

| Stream Key | Consumer Group | Worker |
|---|---|---|
| `drive_fetch:{shard}` | `drive-fetch-workers` | `apps/worker-drive-fetch` |
| `drive_vectorize:{shard}` | `drive-vectorize-workers` | `apps/worker-drive-vectorize` |

Workers are scaled to zero when queues are empty (KEDA `minReplicaCount: 0`) and scale up to 5 replicas when pending entry count exceeds 5.

`agent_events:{taskId}` is **not** a consumer group stream — every SSE client reads from its own position independently.

### Worker Retry Policy

When a downstream call fails (Google Drive API 429/5xx or OpenAI rate limit):

1. Increment `drive_files.retry_count`.
2. If `retry_count ≤ 2`: re-enqueue the job after a delay (exponential backoff), update `last_retry_at`.
3. If `retry_count > 2`: set `ingestion_phase = "failed"`, write `ingestion_error`, stop retrying.

The `/drive/files/:fileId/retry` endpoint resets the counter and re-enqueues for manual recovery.

---

## Rate Limiting

### Drive Sync

`POST /drive/sync` is rate-limited to **1 request per user per 60 seconds**. Exceeding this limit returns:

```
HTTP 429 Too Many Requests
{ "error": "Rate limit exceeded. Try again in a minute." }
```

The frontend should surface this as a user-friendly "try again in a minute" message rather than a generic error.

### Agent Task Concurrency

The server enforces a global in-process limit of `MAX_CONCURRENT_TASKS` concurrent agent runs (configured via an environment variable, default 10). When this ceiling is reached, new task start requests fail fast — the HTTP response for `POST /chats/:chatId/messages` will indicate the server is busy and the client should retry.

### External API Quotas

External provider calls (Google Drive API, OpenAI, Tavily) are subject to their own provider rate limits. Workers follow the retry policy above (up to 2 retries with exponential backoff) before marking a job as `failed`.

---

## Caching

> **Planned: Response Caching** — not yet implemented; the following describes the intended design.

Redis-based read-through caching is planned for two scenarios:

| Target | Cache Key | Approximate TTL |
|---|---|---|
| `GET /drive/progress` response | `cache:drive_progress:{userId}` | 15 seconds |
| `GET /drive/files` listing | `cache:drive_files:{userId}` | 30 seconds |
| Agent final answers (repeated identical prompts) | `cache:agent_answer:{userId}:{hash(normalizedPrompt)}` | 5 minutes |

**Approach:** On a cache hit the API returns the cached JSON directly without a Postgres query. On a miss it queries Postgres, writes the result to Redis with the specified TTL, then returns. The cache is invalidated on write operations (e.g. after a sync or ingestion state change).

Agent answer caching uses a hash of the lowercased, whitespace-normalised prompt keyed per-user. This is safe because answers are personalized by `userId`.

---

## Authentication

- **OAuth flow:** `GET /auth/google` → Google consent screen → `GET /auth/google/callback`.
- Google tokens are stored encrypted per-user in Postgres.
- On callback: upsert `users` row, issue a signed **JWT**, return it in the JSON response body as `{ token }`.
- The frontend stores the token in `localStorage` under `biscuit_auth_token`.
- All authenticated endpoints verify the JWT via `Authorization: Bearer <token>`, handled by `fetchWithAuth` in `src/lib/apiClient.ts`.
- 401/403 responses automatically clear the stored token and redirect to `/login`.

---

## Database Schema

```mermaid
erDiagram
    users {
        uuid id PK
        string google_id
        string email
        string name
        timestamp created_at
        timestamp updated_at
    }

    chat_rooms {
        uuid id PK
        uuid user_id FK
        string title
        timestamp created_at
        timestamp updated_at
    }

    chat_messages {
        uuid id PK
        uuid chat_id FK
        uuid user_id FK
        string role
        text content
        int sequence
        uuid agent_task_id FK
        timestamp created_at
    }

    agent_tasks {
        uuid id PK
        uuid user_id FK
        uuid chat_id FK
        uuid chat_message_id FK
        text input_prompt
        string status
        text final_answer_markdown
        jsonb result_json
        jsonb step_summaries
        jsonb used_chunk_ids
        timestamp created_at
        timestamp completed_at
    }

    drive_files {
        uuid id PK
        uuid user_id FK
        string file_id
        string name
        string mime_type
        string hash
        timestamp last_modified_at
        timestamp last_ingested_at
        boolean supported
        string ingestion_phase
        text ingestion_error
        int retry_count
        timestamp last_retry_at
        timestamp created_at
        timestamp updated_at
    }

    raw_documents {
        uuid id PK
        uuid user_id FK
        string file_id
        string mime_type
        text text
        string hash
        timestamp created_at
        timestamp updated_at
    }

    chunks {
        uuid id PK
        uuid user_id FK
        string file_id
        int chunk_index
        text text
        string hash
        boolean vectorized
        string qdrant_point_id
        timestamp created_at
        timestamp updated_at
    }

    users ||--o{ chat_rooms : owns
    users ||--o{ chat_messages : writes
    users ||--o{ agent_tasks : runs
    users ||--o{ drive_files : syncs
    users ||--o{ raw_documents : stores
    users ||--o{ chunks : indexes
    chat_rooms ||--o{ chat_messages : contains
    chat_messages ||--o| agent_tasks : triggers
    agent_tasks ||--o{ chat_messages : produces
```

---

## API Reference

### Auth

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/google` | Redirect to Google OAuth consent screen |
| `GET` | `/auth/google/callback` | Exchange code, upsert user, return `{ token: JWT }` |

### Chat

| Method | Path | Body / Params | Description |
|---|---|---|---|
| `POST` | `/chats` | `{}` | Create a new chat room |
| `GET` | `/chats/:chatId` | — | Fetch chat + last N messages ordered by `sequence ASC` |
| `POST` | `/chats/:chatId/messages` | `{ content }` | Send message, start agent task async, return `{ taskId }` |

### Agent / Tasks

| Method | Path | Description |
|---|---|---|
| `GET` | `/tasks/:taskId` | Task status, final answer, step summaries |
| `GET` | `/sse/agent/:taskId?since=` | SSE stream of `AgentEvent`s (resumable via `since` or `Last-Event-ID`) |
| `GET` | `/tasks/:taskId/events?since=` | Polling endpoint, returns `AgentProgressResponse` |

### Drive

| Method | Path | Description |
|---|---|---|
| `POST` | `/drive/sync` | List Drive files, upsert metadata, enqueue fetch jobs. **Rate-limited: 1/user/60s → 429 if exceeded** |
| `GET` | `/drive/progress` | Per-file ingestion progress + totals |
| `POST` | `/drive/files/:fileId/retry` | Retry a failed file (resets retry count, re-enqueues) |
| `GET` | `/drive/chunk/:chunkId` | Fetch chunk + neighbors (`chunk_index ± 1`) + file metadata |

---

## Frontend Architecture

**Framework:** Next.js 15 (App Router), all client components.

| Path | Purpose |
|---|---|
| `app/page.tsx` | Landing / root redirect |
| `app/login/page.tsx` | Google OAuth entry point |
| `app/chat/page.tsx` | New chat creation, redirects to `chat/[id]` |
| `app/chat/[id]/page.tsx` | Chat room: message list, SSE consumer, `AgentThoughtLoader` |
| `app/chat/layout.tsx` | Sidebar + nav shell |
| `components/chat/AgentThoughtLoader.tsx` | Real-time plan checklist + scrolling thought log |
| `components/chat/MessageList.tsx` | Renders user and assistant messages + citation chips |
| `components/drive/DriveSyncModal.tsx` | Trigger sync, display per-file progress, handle 429 |
| `components/drive/IndexedDocsModal.tsx` | Browse indexed Drive files |
| `components/auth/AuthContext.tsx` | JWT auth state, `/me` fetch on mount |
| `lib/apiClient.ts` | `fetchWithAuth` — injects `Authorization` header, handles 401 redirect |

### State Management (Chat Page)

```ts
const [messages, setMessages]           // Rendered chat messages
const [agentPlan, setAgentPlan]         // string[] from plan event
const [agentThoughts, setAgentThoughts] // { id, text }[] — append-only, deduplicated log
const [currentStepIndex, setCurrentStepIndex] // Drives checklist strikethrough
const [isGenerating, setIsGenerating]   // Shows AgentThoughtLoader
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 22
- pnpm ≥ 9
- Neon Postgres database
- Redis (self-hosted or managed)
- Qdrant Cloud account
- OpenAI API key (`gpt-4o-mini` + `text-embedding-3-small`)
- Google OAuth application credentials
- Tavily API key (web search)

### Installation

```bash
git clone https://github.com/iBreakProd/biscuit.git
cd biscuit
pnpm install
```

### Database Setup

```bash
pnpm --filter @repo/db db:migrate
```

### Development

```bash
# Run all apps concurrently
pnpm dev

# Or individually
pnpm --filter server dev
pnpm --filter web dev
pnpm --filter worker-drive-fetch dev
pnpm --filter worker-drive-vectorize dev
```

### Production Build

```bash
pnpm build
```

---

## Environment Variables

### `apps/server`

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `QDRANT_URL` | Qdrant Cloud cluster URL |
| `QDRANT_API_KEY` | Qdrant API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `PLANNING_MODEL` | Chat model name (e.g. `gpt-4o-mini`) |
| `EMBEDDING_MODEL` | Embedding model name (e.g. `text-embedding-3-small`) |
| `TAVILY_API_KEY` | Tavily web search API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `JWT_SECRET` | Secret for signing JWTs |
| `FRONTEND_URL` | Frontend origin (CORS) |
| `PORT` | HTTP port (default `3001`) |

### `apps/worker-drive-fetch`

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

### `apps/worker-drive-vectorize`

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `QDRANT_URL` | Qdrant Cloud cluster URL |
| `QDRANT_API_KEY` | Qdrant API key |
| `OPENAI_API_KEY` | OpenAI API key (for embeddings) |

### `apps/web`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the deployed API server (e.g. `https://apibiscuit.hrsht.me`) |

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `pnpm dev` | Run all apps in watch mode |
| `build` | `pnpm build` | Compile all packages and apps |
| `migrate` | `pnpm --filter @repo/db db:migrate` | Run Drizzle migrations against Neon |
| `typecheck` | `pnpm tsc --noEmit` | Type-check all packages |
| `test` | `bash scripts/test.sh` | Integration tests across all phases |
