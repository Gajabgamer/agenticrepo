export default function Loading() {
  return (
    <main className="app-shell grid min-h-screen place-items-center px-6">
      {/* // made by bob */}
      <div className="agent-panel-strong w-full max-w-md rounded-3xl p-6">
        <div className="mb-5 flex items-center gap-2">
          <span className="h-3 w-3 animate-pulse rounded-full bg-sky-300" />
          <span className="h-3 w-3 animate-pulse rounded-full bg-amber-300 [animation-delay:120ms]" />
          <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-300 [animation-delay:240ms]" />
        </div>
        <p className="agent-muted font-mono text-xs uppercase tracking-[0.2em]">auth.session</p>
        <h1 className="mt-3 text-2xl font-semibold">Preparing engineering console</h1>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-400/20">
          <div className="h-full w-1/2 animate-[agentScan_1.6s_ease-in-out_infinite] rounded-full bg-sky-300" />
        </div>
      </div>
    </main>
  );
}

// Made with Bob
// made by bob
