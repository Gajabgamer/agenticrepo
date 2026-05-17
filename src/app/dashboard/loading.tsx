export default function DashboardLoading() {
  return (
    <main className="app-shell min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      {/* // made by bob */}
      <div className="mx-auto grid max-w-7xl gap-5">
        <div className="agent-panel h-32 animate-pulse rounded-[2rem]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="agent-soft h-32 animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="agent-panel h-96 animate-pulse rounded-3xl" />
          <div className="agent-panel h-96 animate-pulse rounded-3xl" />
        </div>
      </div>
    </main>
  );
}

// Made with Bob
// made by bob
