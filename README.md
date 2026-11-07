# Small Web Browser

A technical assessment project for a simulated web browser. Steps 1 through 7
provide Docker development infrastructure, persistent people/sites/visits,
deterministic demonstration data, and a responsive browser with per-person
navigation, history, full-content search, website publishing, and hardened HTML
containment, with unit, MongoDB integration, and Chrome regression coverage.

## Quick Start — Windows PowerShell

Install Git and Docker Desktop, then start Docker Desktop in Linux containers
mode before running these commands in Windows PowerShell:

```powershell
git clone https://github.com/AbdulHaseeb598/small-web-browser.git
cd small-web-browser
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
docker compose exec backend npm run seed
```

The first build can take a few minutes. Check `docker compose ps` and wait for
all three services to become healthy. The seed command is safe to rerun: it
inserts missing demonstration records without overwriting existing data and
reports conflicting records explicitly.

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend health: [http://localhost:4000/api/health](http://localhost:4000/api/health)

Useful commands (run individually as needed):

```powershell
docker compose logs --tail=100 backend
docker compose stop
docker compose start
docker compose down
```

`docker compose down` preserves the named MongoDB database volume.
`docker compose down -v` deletes that volume and its data; do not use it for
normal shutdown.


## Stack and structure

Next.js with TypeScript, App Router, ESLint, and Tailwind CSS; NestJS with
TypeScript, environment configuration, and Mongoose; MongoDB 8; Docker Compose
with Node.js 24 images. Each application has independent dependencies and an
npm lockfile. No root dependency installation is needed.

```text
small-web-browser/
├── frontend/
│   ├── src/app/          # Browser page, layout, and responsive styling
│   ├── src/components/   # Toolbar, iframe, results, and history presentation
│   ├── src/lib/          # Navigation engine, typed API, containment, native history
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
│   ├── src/seed/         # Deterministic content and insert-only seed command
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
selection lives in `frontend/src/lib/api.ts`. Public variables must
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
docker compose run --rm --no-deps frontend npm test
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

## Deterministic seed data

With MongoDB and the backend running, execute:

```bash
docker compose exec backend npm run seed
```

The command builds TypeScript, loads the same validated environment and Mongoose
models as the backend, and connects without starting another HTTP server. It
prints inserted, updated, and existing counts per collection, closes its
connection, and exits. Failures return a nonzero exit code. No extra dependencies
or infrastructure services are needed.

The dataset contains **5 people, 10 sites, and 60 visits**. Each author owns two
sites with distinct, original multi-paragraph HTML about coastal ecology, local
history, maps, gardening, astronomy, electronics, and cooking. Documents contain
only self-contained markup and fictional `.zz` hyperlinks; there are no external
images, scripts, stylesheets, or other network resources.

Examples include `tidepool.zz`, `kelp-lab.zz`, `night-garden.zz`, `map-room.zz`,
`observatory.zz`, and `bread-journal.zz`. Connected paths span at least four pages.
Links to `moon-pier.zz`, `glasshouse.zz`, `comet-ledger.zz`, and `weather-buoy.zz`
intentionally have no Site document, and their attempted visits remain in history.

Browsing events span **2026-01-15 09:00–10:00 UTC**, independent of the current
clock. They include every navigation method, repeated visits, and different
personal trails. Mira Solis has 20 events covering 9 of the 10 existing sites.
People/site timestamps are fixed at `2026-01-01T00:00:00.000Z`.

### Repeated execution and conflicts

Fixed ObjectIds are defined in `backend/src/seed/seed-data.ts` using the
`5eed2026` namespace. IDs, ownership, content, and timestamps do not change on
reruns. Writes use only `$setOnInsert`: an unchanged second execution reports
0 inserted, 0 updated, and 5/10/60 existing people/sites/visits. `updated` is
always zero because existing records are never rewritten.

The command validates the complete dataset against the existing schemas and
preflights reserved IDs and addresses before inserting. Exact existing records
are accepted. A different record at a reserved ID, an occupied seed site address,
or an edit to previously seeded content causes an explicit conflict and exit 1.
Resolve that conflict manually; the seed command does not replace someone's data.
Person names are not unique identities: a user-created person with the same name
and a different ID is preserved.

Author/person references now use actual Mongoose ObjectId schema types. History
reads also accept legacy string references from earlier API writes without
rewriting those documents, so both forms remain accessible.

Parents are inserted before sites and visits. Unique indexes and post-write
verification make concurrent seed runs safe. Writes are atomic per document,
not a cross-collection transaction: interruptions or racing conflicts can leave
partial inserts. Retrying fills missing records without duplicating or changing
completed ones. No collections, unrelated documents, or Docker volumes are deleted.

### Verify content and run seed tests

```bash
curl http://localhost:4000/api/people
curl http://localhost:4000/api/sites
curl http://localhost:4000/api/sites/tidepool.zz
curl 'http://localhost:4000/api/people/5eed20260100000000000001/visits?limit=100'
docker compose exec backend npm test -- seed-data
docker compose exec backend npm run test:integration
```

For just the seed integration suite, build first and filter Vitest explicitly:

```bash
docker compose exec backend npm run build
docker compose exec backend npx vitest run --config vitest.config.integration.ts seed
```

The full `npm run test:integration` suite also includes seed tests. Each seed
integration run uses its own random `small_web_browser_seed_test_<uuid>` database
and removes only that database afterward. Coverage includes repeated and concurrent
CLI runs, unrelated-data preservation, reserved-identity conflicts, edited content,
and recovery from partial people, sites, and visits phases.

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
| GET | `/api/search?q=photodiode` | `{ query, items, total, limit }`; title/address/excerpt only |
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
to 100,000 characters, subject also to the server's 100 KiB JSON request-size
limit (UTF-8 bytes, including metadata and JSON escaping). Whitespace-only HTML
is rejected. Oversized requests return 413; field validation returns 400.
HTML is stored without trimming, rewriting, or sanitizing, including leading
and trailing whitespace. Rendering applies a separate restrictive boundary;
the stored original is preserved. External pages are never fetched.

### Fictional addresses

Addresses are application identifiers ending in `.zz`, for example `tidepool.zz`
or `help.tidepool.zz`. Trim surrounding whitespace and lowercase before storage
and lookup. Each dot-separated ASCII label has 1–63 letters/digits, with hyphens
allowed only inside a label; the total address is at most 253 characters. Schemes,
ports, slashes, queries, fragments, internal whitespace, Unicode, and other
suffixes are rejected. No DNS resolution or network browsing takes place.

### Example requests

The following `curl` examples use Bash syntax, including `\` line continuation;
run them in Bash (for example, Git Bash), rather than copying them unchanged
into Windows PowerShell. Other `curl` snippets in this README are also Bash
examples; the Quick Start above uses PowerShell.

```bash
curl -X POST http://localhost:4000/api/people \
  -H 'Content-Type: application/json' -d '{"name":"Ada"}'
curl http://localhost:4000/api/people
```

Replace `PERSON_ID` below with the returned person's `_id`. Site addresses must
be unique: `fresh-demo.zz` is not part of the seed dataset. If it has already
been published in your database, choose another unused `.zz` address; duplicate
addresses return HTTP 409.

```bash
curl -X POST http://localhost:4000/api/sites \
  -H 'Content-Type: application/json' \
  -d '{"address":"fresh-demo.zz","title":"Fresh demo","html":"<h1>Hello</h1>","authorId":"PERSON_ID"}'
curl http://localhost:4000/api/sites
curl http://localhost:4000/api/sites/fresh-demo.zz
curl -X POST http://localhost:4000/api/visits \
  -H 'Content-Type: application/json' \
  -d '{"personId":"PERSON_ID","address":"missing.zz","method":"link"}'
curl 'http://localhost:4000/api/people/PERSON_ID/visits?page=1&limit=20'
```

Visit methods are `typed`, `link`, `back`, `forward`, `history`, and `search`.
Timestamps are assigned by the server; clients cannot supply `visitedAt`.

## Browser navigation and restoration

`NavigationEngine` owns a Map of person IDs to sessions. Each session uses an
ordered entry array and integer cursor; discriminated entries represent home,
website, missing address, or search results. React subscribes using
`useSyncExternalStore`; presentation and typed API calls remain separate.
New destinations truncate the forward stack. Genuine repeated visits remain
distinct. Failed fetches preserve the previous stack; aborted/stale responses
cannot replace a newer navigation or another person's view.

Entries capture original HTML, site metadata, or query/results and scroll position.
Back/Forward restore those snapshots without another site/search request, even
if a site changed. A fresh explicit visit fetches current content. Native browser
history markers restore known entries within the current document, including
person context. Sessions are memory-only: reloads, leaving the document, and
development remounts reset them. Home, results, missing-page, and website views
capture their main-pane scroll position. Arbitrary interactive DOM state is not
captured; forms and page scripts are deliberately unavailable.

The homepage renders the complete catalog without a six-card cap or pagination:
two columns on wider screens and one below 700px. Newly published sites join the
same list. `PageView` owns the main scrollbar for every view, including an iframe
expanded to its sanitized content height. The trusted bridge reports only bounded
integer heights; parent scroll capture/restoration stays outside the opaque frame.
History remains independently scrollable. Wheel/trackpad scrolling over the main
content, keyboard paging, and mobile touch scrolling use native browser behavior;
there are no global wheel handlers. The toolbar stays outside the scrolling pane.

Memory is bounded to the most recent 50 entries per person (including home
when retained), 10 most recently selected people, and 500 native-history lookup
markers. Older snapshots/sessions are evicted; persistent Visit history is not
deleted. Native history can restore only entries retained in the current document.

Only explicit successful navigation actions and missing-address responses submit
Visits. Returning to a website records back/forward; search views, initial loads,
person selection, and passive rerenders do not. A failed Visit POST displays a
warning without rolling back the page or silently retrying a possibly saved event.

The history panel loads 20 records at a time, newest timestamp then descending
ObjectId, deduplicates by ID, refreshes after saved visits, and isolates requests
by person. The API computes `exists` using one indexed address lookup per page;
it does not alter immutable Visits. Missing labels describe current site existence.
Live offset pagination can shift under concurrent writes; Refresh reloads page one.

## Search strategy

`GET /api/search?q=...` accepts 1–100 characters after whitespace normalization,
up to 10 keywords/quoted phrases, and requires every term to match title,
address, or visible body text. Empty/malformed queries return 400; no matches
return an empty list. Matches are case-insensitive substrings. Each term scores
12 in the title, 8 in the address, and 3 in the body, with a 30-point exact-title
bonus. Ties sort by address. Results include at most 20 entries and a total count;
body excerpts use 200-character text windows with ellipses. Search results never include HTML.
Excerpt offsets map back to the original text when Unicode lowercasing expands a
character, keeping late body matches visible without changing ranking.

Results highlight literal query terms/quoted phrases using React text nodes and
semantic `<mark>` elements, preserving original capitalization. Matching follows
the API's intentional substring semantics (`garden` also matches `Gardening`),
without treating query text as a regular expression. Opening a result captures its
query with the website snapshot. Sanitized visible text nodes receive the same
highlights before iframe serialization; attributes, visible URLs, hidden subtrees,
and generated bridge code are excluded. Back/Forward restore the captured query,
marks, content, and scroll. Typed/history/link navigation does not inherit a search
query. In-page phrases split across separate HTML text nodes may not be marked;
the result title/excerpt still highlights a phrase contained in its plain text.

parse5 extracts text while excluding scripts, styles, head content, embedded
documents, and explicitly hidden subtrees. A bounded 128-entry cache compares
the exact source HTML before reusing parsed text. This small-dataset strategy
scans site projections on each query without a new MongoDB index or service:
the existing unique address index serves page/history lookups, while MongoDB's
token/stemming text search would have different substring/phrase semantics.
A larger corpus should move extraction to publication time and use a suitable
indexed search strategy. CSS layout, external styles, and full browser visibility
are intentionally not evaluated by the extractor.

## Publish a website

1. Start Docker, run `docker compose exec backend npm run seed`, and open
   http://localhost:3000. Choose a browsing identity.
2. Select **Publish**, then choose a publisher, `.zz` address, title, and HTML.
   Publisher selection does not switch the browsing identity.
3. Submit **Publish website**. The dialog blocks concurrent submissions and
   preserves failed drafts. Duplicate addresses receive a clear 409 message.
4. Select **Open published site** to browse as the original browsing identity,
   or close the dialog to keep the current page. Publishing alone creates no Visit.

New sites appear in the local discovery catalog and server search immediately.
Existing page/search snapshots stay unchanged until an explicit new request.
HTML is stored exactly, including whitespace; it is never silently truncated.
Drafts live only in the current React mount and are lost on reload. A network
failure can occur after a save: check the address before retrying. There is no
editing, deletion, preview execution, authentication, or ownership enforcement.
Oversized HTML remains in the editor with a validation error rather than being
cut off by a textarea character limit.

For a first manual page, use a unique address and this HTML:

```html
<h1>My small web page</h1>
<p>A searchable body word: ferncompass.</p>
<ul>
  <li><a href="tidepool.zz">Explore the tidepool</a></li>
  <li><a href="unpublished-demo.zz">Try a missing page</a></li>
</ul>
```

Search `ferncompass`, follow both links, use Back/Forward, then switch people
and verify each person's history. Manual navigation intentionally adds Visits;
automated tests use a disposable database instead.

## HTML containment

DOMPurify allows basic document text, lists, tables, and internal `.zz` links.
Authored scripts, event handlers, styles, media, forms, embeds, and external links
are removed or disabled. HTML is rendered only in an opaque-origin `srcDoc`
iframe with `sandbox="allow-scripts"`; there is no same-origin, popup, form, or
top-navigation permission. CSP denies network resources and connections.
Only a nonce-authorized, application-owned script captures internal links and
reports layout height; arbitrary authored JavaScript is never allowed. Parent message
handling checks a browser-generated message event, iframe window, opaque origin,
per-mount token, exact payload shape, and a destination declared by that rendered
page. `origin === "null"` alone is never accepted as authentication. The bridge
uses captured link targets and accepts only trusted user clicks, including
keyboard activation. It exposes only link navigation and bounded layout heights.
Oversized imported HTML gets a safe placeholder before sanitization.

Supported content includes headings, paragraphs, lists, emphasis, code, quotes,
tables, and normalized internal links. Authored CSS, scripts, forms, images,
SVG/MathML, embeds, metadata, `id`/`name`, event handlers, and external,
`javascript:`, `data:`, and `blob:` URLs are intentionally unavailable. Malformed
markup may lose content. The sanitizer and browser sandbox are separate layers;
future changes must preserve both. See the [DOMPurify threat model](https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model)
and [iframe sandbox specification](https://html.spec.whatwg.org/dev/iframe-embed-object.html).

Residual risks: this is a local assessment without authentication, rate limiting,
or production controls. Published text can still be misleading. Bounded input and
snapshot retention reduce memory exposure but do not guarantee availability
under sustained load. Search scans the small corpus, and people/site metadata
listings remain unpaginated. Keep DOMPurify and browsers updated; automated attack
cases are regression evidence, not proof against every future browser vulnerability.

## Browser interaction tests

Frontend Vitest covers the engine independently, component interaction, history
pagination, publishing errors, and malicious markup. Backend integration tests
exercise search, publication validation/size limits, exact HTML persistence,
unique-address races, deeply nested HTML extraction, history, and seed regressions
against isolated databases. Search text extraction uses an explicit work stack
so deeply nested, size-valid pages cannot overflow recursive traversal.
Playwright uses a separate frontend and seeded API fixture on ports 3001/4010;
it refuses writes unless the API identifies its isolated test database.

Chrome scenarios cover four linked pages, native/application traversal, forward
truncation, repeats, missing pages, snapshots, page/search scroll, person switching,
reload reset, stale responses, failures, publishing, retry/409 recovery, keyboard
access, responsive layouts, and malicious publication. Security probes verify
opaque-origin parent/storage/cookie isolation, blocked fetch/top navigation,
zero external resource requests, disabled unsafe markup, forged messages, and
working safe links. DevTools evaluation deliberately probes browser restrictions;
it is separate from checks that authored scripts never execute.

UI regressions also cover the full seeded catalog, more than ten sites, newly
published cards, the two-/one-column grid, main-pane wheel and keyboard scrolling,
independent History scrolling, mobile touch gestures, search highlighting,
literal/XSS-like query strings, relevant late-body excerpts, and scroll restoration.

Run browser tests and backend integration checks sequentially on constrained
machines; cold Node CLI launches can exceed the seed suite's 10-second timeout
when Docker and Chrome compete for CPU. Do not raise timeouts to hide assertions.

Start the existing stack, then run these in separate terminals from the root:

```bash
docker compose run --rm --no-deps --name small-web-browser-browser-api -p 127.0.0.1:4010:4000 backend sh -c 'npm run build && exec node test/browser-test-server.mjs'
docker compose run --rm --no-deps --name small-web-browser-browser-ui -p 127.0.0.1:3001:3000 -e NEXT_PUBLIC_API_URL=http://localhost:4010/api frontend npm run dev -- --hostname 0.0.0.0 --port 3000
```

Wait for `BROWSER_TEST_READY` and Next's ready message. In `frontend`, run
`npm ci`, `npx playwright install chromium`, then `npm run test:browser` with
Node.js 24. Alternatively set `CHROME_PATH` to an installed Chrome executable.
`BROWSER_TEST_URL` and `BROWSER_TEST_API_URL` override the default fixture URLs.
Stop only the fixtures afterward:

```bash
docker stop small-web-browser-browser-ui small-web-browser-browser-api
```

The API fixture removes only its own randomly named test database on graceful
shutdown. Abrupt termination can leave that test database; never reset the
development database or remove Docker volumes for browser testing.
