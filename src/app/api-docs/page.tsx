const endpoints = [
  ['GET', '/api/health', 'Global service health and deployment heartbeat.'],
  ['GET', '/api/repositories', 'Authenticated GitHub repository listing.'],
  ['GET', '/api/incidents', 'Persisted incidents and incident history.'],
  ['GET', '/api/investigations', 'Autonomous investigation runs and execution stages.'],
  ['GET', '/api/workflows', 'Workflow events, recovery records, and workflow-linked incidents.'],
  ['GET', '/api/activity', 'Operational activity timeline.'],
  ['GET', '/api/memory', 'Engineering memory and knowledge graph snapshot.'],
  ['GET', '/api/context', 'Optimized AI context sources and token budget statistics.'],
  ['POST', '/api/terminal', 'Controlled engineering terminal command execution.'],
  ['POST', '/api/github/webhook', 'GitHub webhook receiver for repository events.'],
];

export default function ApiDocsPage() {
  return (
    <main className="app-shell min-h-screen p-4">
      {/* // made by bob */}
      <section className="agent-panel-strong mx-auto max-w-5xl rounded-[2rem] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">agenticrepo public api</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em]">Operational API Reference</h1>
        <p className="agent-muted mt-4 max-w-3xl leading-7">
          AgenticRepo exposes lightweight operational endpoints for repository health, incidents, workflows,
          investigations, memory, context optimization, and controlled terminal execution.
        </p>
        <div className="mt-8 grid gap-3">
          {endpoints.map(([method, path, description]) => (
            <div key={path} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[5rem_18rem_1fr]" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
              <span className="font-mono text-sm font-semibold text-sky-300">{method}</span>
              <span className="font-mono text-sm">{path}</span>
              <span className="agent-muted text-sm">{description}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-signal-amber">
          Some endpoints require an authenticated session because they expose connected repository or user-specific operational data.
        </div>
      </section>
    </main>
  );
}

// Made with Bob
// made by bob
