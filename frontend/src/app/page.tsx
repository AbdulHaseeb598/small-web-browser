import { publicApiUrl } from "@/lib/api";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16 sm:px-12">
      <p className="mb-8 text-xs font-semibold tracking-[0.2em] text-slate-500">
        STEP 01 / INITIALIZATION
      </p>
      <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-7xl">
        Small Web Browser
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
        A simulated web browser for exploring fictional websites. This first
        step establishes the foundation for browsing, search, and HTML publishing.
      </p>
      <section
        aria-labelledby="project-status"
        className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
      >
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-600" />
          <h2 id="project-status" className="font-semibold text-slate-950">
            Project initialized
          </h2>
        </div>
        <p className="mt-3 max-w-xl leading-7 text-slate-600">
          The frontend, backend, and Docker development configuration are in
          place. Browser features will be added in later steps.
        </p>
        <dl className="mt-8 grid gap-6 border-t border-slate-100 pt-6 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Frontend</dt>
            <dd className="mt-1 font-medium">Next.js &amp; TypeScript</dd>
          </div>
          <div>
            <dt className="text-slate-500">Backend</dt>
            <dd className="mt-1 font-medium">NestJS &amp; TypeScript</dd>
          </div>
          <div>
            <dt className="text-slate-500">Persistence</dt>
            <dd className="mt-1 font-medium">MongoDB &amp; Mongoose</dd>
          </div>
        </dl>
        <a
          href={publicApiUrl + "/health"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900"
        >
          View API health
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </section>
      <p className="mt-8 text-sm text-slate-500">Development foundation · Step 1</p>
    </main>
  );
}
