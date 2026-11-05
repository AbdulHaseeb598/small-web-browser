# Small Web Browser

A technical assessment project for a simulated web browser. Steps 1 and 2
provide development infrastructure and backend persistence for people, published
sites, and navigation events. The browser interface, navigation engine, search,
and safe HTML rendering are not implemented yet.

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
│   ├── src/people/       # Person schema, DTO, service, and controller
│   ├── src/sites/        # Site publishing and retrieval
│   ├── src/visits/       # Append-only navigation history
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
docker compose run --rm --no-deps backend npm run test:integration
docker compose run --rm --no-deps backend npm run build
```

The frontend build command overrides the development service's `NODE_ENV` so
Next.js and React both use production mode during prerendering.

Unit tests cover configuration, readiness failures, and address validation. The
existing health HTTP tests substitute the database connection. Integration tests
build the backend and launch it in a separate native Node process, exercising
real DTO metadata, HTTP routes, Mongoose persistence, indexes, and duplicate races.
They use the existing MongoDB service; no extra service or seed command is needed.

Each integration run creates a random `small_web_browser_test_<uuid>` database
and removes only that database afterward. Development collections and the Docker
volume are untouched. Outside Docker, set `TEST_MONGODB_URI` to a reachable MongoDB
server before `npm run test:integration`; its database name is replaced with the
isolated test name. `MONGODB_URI` is the fallback inside Compose. Index creation
and test-database cleanup require suitable permissions on the test server.

Optional host development requires Node.js 24 and separate `npm ci` commands
inside each application directory. Export `MONGODB_URI`, `FRONTEND_ORIGIN`, and
`PORT` for the backend (or provide `backend/.env`), then run `npm run start:dev`.
The URI must point to a host-accessible MongoDB instance; Docker DNS is only
resolvable inside Compose. Set frontend API URLs in `frontend/.env.local` and
run `npm run dev`.

## Domain models

| Collection | Fields | Additional indexes |
| --- | --- | --- |
| `people` | ObjectId `_id`, trimmed `name`, `createdAt` | None |
| `sites` | ObjectId `_id`, normalized `address`, trimmed `title`, original `html`, Person `authorId`, `createdAt`, `updatedAt` | Unique `{ address: 1 }` |
| `visits` | ObjectId `_id`, Person `personId`, normalized attempted `address`, server-assigned `visitedAt`, `method` | `{ personId: 1, visitedAt: -1, _id: -1 }` |

Every collection also has MongoDB's unique `_id` index. Person references are
checked by the service before publishing or recording a visit. There are no
accounts, passwords, roles, or authentication. Visits have immutable Mongoose
fields and no update/delete endpoints. Their addresses do not reference Site:
a request for a nonexistent address still produces a navigation event.

## API

| Method | Endpoint | Response |
| --- | --- | --- |
| GET | `/api/people` | People, oldest first (`createdAt`, then `_id`) |
| POST | `/api/people` | Created person, HTTP 201 |
| GET | `/api/sites` | Metadata only, newest first (`createdAt`, then `_id`); excludes HTML |
| GET | `/api/sites/:address` | Site including authored HTML, returned as JSON |
| POST | `/api/sites` | Published site, HTTP 201 |
| GET | `/api/people/:personId/visits` | `{ items, total, page, limit }`, newest first |
| POST | `/api/visits` | Recorded navigation attempt, HTTP 201 |

History sorts by `visitedAt` descending, then `_id` descending for timestamp ties.
Query parameters are `page` (default 1, range 1–1,000,000) and `limit` (default 20,
range 1–100). These are live offset-based pages, not a frozen history snapshot;
new concurrent visits can shift page boundaries. People and sites listings are
currently unpaginated. Read queries use lean results where appropriate.

DTO validation rejects missing fields, malformed ObjectIds, invalid addresses,
and unexpected body/history-query fields with HTTP 400. Unknown people or sites
return 404; duplicate normalized addresses return 409, backed by MongoDB's unique
index rather than only a pre-insert lookup. Domain errors use Nest's standard
`{ statusCode, error, message }` envelope; validation messages are arrays. The
health endpoint retains its existing readiness response format.

Names are limited to 120 characters, titles to 200, and nonempty HTML strings
to 100,000 characters, subject also to the server's JSON request-size limit.
HTML is stored without trimming, rewriting, or sanitizing, including leading
and trailing whitespace. This step does not render it or fetch external pages.

### Fictional addresses

Addresses are application identifiers ending in `.zz`, for example `tidepool.zz`
or `help.tidepool.zz`. Trim surrounding whitespace and lowercase before storage
and lookup. Each dot-separated ASCII label has 1–63 letters/digits, with hyphens
allowed only inside a label; the total address is at most 253 characters. Schemes,
ports, slashes, queries, fragments, internal whitespace, Unicode, and other
suffixes are rejected. No DNS resolution or network browsing takes place.

### Example requests

```bash
curl -X POST http://localhost:4000/api/people \
  -H 'Content-Type: application/json' -d '{"name":"Ada"}'
curl http://localhost:4000/api/people
```

Replace `PERSON_ID` below with the returned person's `_id`:

```bash
curl -X POST http://localhost:4000/api/sites \
  -H 'Content-Type: application/json' \
  -d '{"address":"TidePool.ZZ","title":"Tidepool","html":"<h1>Hello</h1>","authorId":"PERSON_ID"}'
curl http://localhost:4000/api/sites
curl http://localhost:4000/api/sites/tidepool.zz
curl -X POST http://localhost:4000/api/visits \
  -H 'Content-Type: application/json' \
  -d '{"personId":"PERSON_ID","address":"missing.zz","method":"link"}'
curl 'http://localhost:4000/api/people/PERSON_ID/visits?page=1&limit=20'
```

Visit methods are `typed`, `link`, `back`, `forward`, `history`, and `search`.
Timestamps are assigned by the server; clients cannot supply `visitedAt`.

## Navigation architecture (planned)

Persistent Visit records are an append-only audit of navigation attempts, not
the browser's back/forward stack. A browser session should use an array of
entries plus a current index: back decrements the index, forward increments it,
and a new navigation after going back discards entries after that index before
appending its destination. This keeps ordering and boundaries straightforward.

Before leaving an entry, capture a page snapshot (or an equivalent versioned
restoration reference), including relevant scroll/form state. Back and forward
can then restore the page that was left even if its published content changes.
A missing address should have an error-page entry in that session and a normal
Visit record containing the attempted address. Do not discard the event merely
because no Site exists. Record the navigation method for each actual attempt.

Session entries and snapshots are not persisted by this backend. There is no
session navigation engine yet, and persistent history should not be used to
reconstruct one automatically.

## Current status

The backend models, publishing/retrieval APIs, and persistent visit history are
implemented. The existing frontend remains an initialization page. There is no
browser UI, navigation engine, full-text search, seed data, HTML rendering,
authentication, bookmarks, or tabs.
