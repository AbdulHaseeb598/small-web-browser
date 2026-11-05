# Small Web Browser

A technical assessment project for a simulated web browser. Step 1 sets up the
applications and reproducible development infrastructure. Fictional websites,
navigation history, full-content search, publishing, and safe HTML rendering
are planned; none of these business features are implemented yet.

## Stack and structure

Next.js with TypeScript, App Router, ESLint, and Tailwind CSS; NestJS with
TypeScript, environment configuration, and Mongoose; MongoDB 8; Docker Compose
with Node.js 24 images. Each application has independent dependencies and an
npm lockfile. No root dependency installation is needed.

```text
small-web-browser/
├── frontend/
│   ├── src/app/          # Minimal landing page and layout
│   ├── src/lib/          # Environment-based API configuration
│   ├── public/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── package-lock.json
├── backend/
│   ├── src/config/       # Validated environment configuration
│   ├── src/health/       # MongoDB readiness endpoint
│   ├── test/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── package-lock.json
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Run with Docker

Install Git and Docker Desktop (Linux containers), or Docker Engine with the
Compose plugin. Local Node.js and MongoDB installations are not required.
From `small-web-browser`, run:

```bash
cp .env.example .env
docker compose up --build
```

In PowerShell, use `Copy-Item .env.example .env` for the first command. Defaults
also work without a `.env` file. Keep `.env` files untracked.

| Service | Local URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend health | http://localhost:4000/api/health |

MongoDB is accessible only on the Compose network as `mongodb:27017`; its port
is not published on the host. Backend startup waits for MongoDB health, and
frontend startup waits for backend readiness. Initial downloads and first
compilation can take a few minutes.

Source directories are bind mounted for hot reload. Anonymous volumes isolate
container dependencies and build output from host `node_modules`, `.next`, and
`dist`. After changing a package manifest or lockfile, refresh these volumes:

```bash
docker compose up --build --renew-anon-volumes
```

This is a local development setup: MongoDB has no authentication or host port,
and application ports bind to loopback only. Production deployment requires
separate authentication, secrets, and deployment configuration.

## Environment

Compose reads the root `.env` for interpolation; `.env.example` documents the
defaults, which also apply when `.env` is absent.

| Variable | Default | Purpose |
| --- | --- | --- |
| `FRONTEND_PORT` | `3000` | Frontend host port |
| `BACKEND_PORT` | `4000` | Backend host port |
| `MONGODB_URI` | `mongodb://mongodb:27017/small_web_browser` | Database connection |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Allowed browser origin for CORS |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | Browser-accessible API base URL |

When changing host ports, update `FRONTEND_ORIGIN` and `NEXT_PUBLIC_API_URL` to
match. Container ports remain fixed. Compose sets the frontend server-only
`API_URL` to `http://backend:4000/api` for internal Docker networking. API URL
selection lives in `frontend/src/lib/api.ts`. The landing page links to the
public health endpoint without polling service status. Public variables must
never contain secrets.

The backend validates configuration at startup, enables CORS for the configured
origin, and prefixes routes with `/api`. It listens on `PORT` (Compose sets
`4000`) and connects to MongoDB before accepting requests.

## Health endpoint

```bash
curl http://localhost:4000/api/health
```

HTTP 200 response:

```json
{
  "status": "ok",
  "service": "small-web-browser-api",
  "database": "up",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

The timestamp is generated per request. The endpoint pings MongoDB. A lost
connection or failed ping returns HTTP 503 with `status: "error"` and
`database: "down"`, without connection details.

## Container lifecycle

```bash
docker compose up -d --build    # Start in the background
docker compose logs -f         # Follow logs
docker compose ps              # Inspect health
docker compose stop           # Stop without removing containers
docker compose start          # Start stopped containers
docker compose restart        # Restart existing containers
docker compose down           # Remove containers/network; keep database data
```

The named `mongodb_data` volume persists database data across recreation.
`docker compose down --volumes` deletes that data; use it only for an intentional
reset. Environment or Dockerfile changes require `docker compose up -d --build`;
`restart` does not apply new container configuration.

## Docker troubleshooting

If a service exits during startup, inspect `docker compose ps -a` and
`docker compose logs --tail=200 backend` before restarting it.

The backend mounts `/app/dist` as an isolated build-output volume. Keep Nest's
`compilerOptions.deleteOutDir` disabled: deleting the volume's mount point
causes `EBUSY: resource busy or locked, rmdir '/app/dist'` before compilation.
The TypeScript incremental cache is also stored inside `dist`, so a host cache
cannot cause JavaScript emission to be skipped in a separate container volume.
After updating the configuration, run `docker compose up --build -d` again.
There is no need to remove containers' volumes or reset MongoDB data.

Host filesystem events may not reach Docker Desktop bind mounts. The backend
uses TypeScript's `PriorityPollingInterval` watcher, and Next.js polls source
changes every second so edits on Windows trigger development reloads.
The backend's watch command uses `--no-shell` so Nest stops the Node process
directly on reload; a leftover process would otherwise keep port 4000 occupied
in the slim image, which does not include `ps` for process-tree discovery.

## Checks

```bash
docker compose config --quiet
docker compose run --rm --no-deps frontend npm run lint
docker compose run --rm --no-deps -e NODE_ENV=production frontend npm run build
docker compose run --rm --no-deps backend npm run lint
docker compose run --rm --no-deps backend npm test
docker compose run --rm --no-deps backend npm run test:e2e
docker compose run --rm --no-deps backend npm run build
```

The frontend build command overrides the development service's `NODE_ENV` so
Next.js and React both use production mode during prerendering.

Backend tests cover configuration validation, database readiness and failure,
API routing, and CORS. HTTP tests substitute the database connection. Running
Compose health checks verify the real MongoDB connection.

Optional host development requires Node.js 24 and separate `npm ci` commands
inside each application directory. Export `MONGODB_URI`, `FRONTEND_ORIGIN`, and
`PORT` for the backend (or provide `backend/.env`), then run `npm run start:dev`.
The URI must point to a host-accessible MongoDB instance; Docker DNS is only
resolvable inside Compose. Set frontend API URLs in `frontend/.env.local` and
run `npm run dev`.

## Current status

Only initialization and development infrastructure are implemented. There are
no domain schemas, seed data, browser controls, authentication, bookmarks,
tabs, search, publishing, or user-authored HTML rendering yet.
