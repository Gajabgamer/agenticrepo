import { ThemeToggle } from './ui/ThemeToggle';

const githubAppInstallUrl = 'https://github.com/apps/agentic-repo/installations/new';

const features = [
  ['Workflow Intelligence', 'Analyze CI/CD failures in real time and surface the exact failing stage.'],
  ['Regression Detection', 'Correlate suspicious commits with failing workflows and affected modules.'],
  ['Automated Fixes', 'Generate safe pull requests for missing imports, null checks, and simple fixes.'],
  ['Documentation AI', 'Turn repository architecture into readable engineering documentation.'],
  ['Engineering Insights', 'Produce root-cause summaries, reviewer notes, and recommended actions.'],
  ['GitHub Native', 'Stay inside GitHub with webhooks, issues, workflow runs, and pull requests.'],
] as const;

const storySteps = [
  ['01', 'Listen', 'GitHub webhooks stream pull requests, issue comments, and workflow failures.'],
  ['02', 'Reason', 'The agent parses logs, maps modules, and connects failures to suspicious commits.'],
  ['03', 'Act', 'Bob or Groq generates concise summaries, docs, and deterministic safe fixes.'],
  ['04', 'Ship', 'The platform creates issues and pull requests for engineer review.'],
] as const;

const activity = [
  ['webhook', 'workflow_run.failed received from payment-service', 'danger'],
  ['analysis', 'parsed failing step: npm test -- payments', 'info'],
  ['commit', 'ranked 9f3a2b1 as suspicious dependency update', 'warning'],
  ['summary', 'generated engineering brief with rollback guidance', 'healthy'],
  ['fix', 'prepared safe import patch branch for review', 'healthy'],
] as const;

export default function Home() {
  return (
    <main className="app-shell relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,0.22),transparent_26%),radial-gradient(circle_at_80%_92%,rgba(124,58,237,0.18),transparent_28%)]" />

      {/* // made by bob */}
      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-7 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="hidden rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 sm:inline-flex"
              style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
            >
              Open control center
            </a>
            <ThemeToggle />
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" />
              Autonomous GitHub Engineering Agent
            </div>

            <h1 className="mt-8 text-5xl font-bold tracking-[-0.065em] sm:text-6xl lg:text-7xl">
              Your engineering agent that sees the break before your team does.
            </h1>

            <p className="agent-muted mt-7 max-w-2xl text-lg leading-8">
              AgenticRepo monitors repositories, analyzes CI/CD workflows, detects regressions,
              correlates suspicious commits, generates engineering summaries, and opens safe
              automated fix pull requests.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <a
                href="/dashboard"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-7 py-4 text-center font-semibold text-white shadow-[0_0_35px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5"
              >
                Connect GitHub Account
              </a>
              <a
                href={githubAppInstallUrl}
                className="rounded-xl border px-7 py-4 text-center font-semibold transition hover:-translate-y-0.5"
                style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
              >
                Install GitHub App
              </a>
            </div>
          </div>

          {/* // made by bob */}
          <div className="agent-panel-strong relative overflow-hidden rounded-[2rem] p-5 lg:p-6">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="relative grid gap-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">agent runtime</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em]">Live repository intelligence</h2>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Operational
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ['3', 'repos watched'],
                  ['27', 'workflow runs'],
                  ['5', 'failures parsed'],
                  ['2', 'fix PRs'],
                ].map(([value, label]) => (
                  <div key={label} className="agent-soft rounded-2xl p-4">
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="agent-muted mt-1 text-xs">{label}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="agent-soft rounded-2xl p-4">
                  <p className="text-sm font-semibold">Regression risk</p>
                  <div className="mt-5 grid place-items-center">
                    <div className="grid h-36 w-36 place-items-center rounded-full bg-[conic-gradient(#ef4444_0_34%,#f59e0b_34%_62%,rgba(148,163,184,0.22)_62%)]">
                      <div className="grid h-24 w-24 place-items-center rounded-full" style={{ background: 'var(--panel-strong)' }}>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-amber-400">Medium</p>
                          <p className="agent-muted text-xs">2 repos</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="agent-terminal rounded-2xl p-4">
                  <div className="mb-4 flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="grid gap-3 font-mono text-xs">
                    {activity.map(([label, text, tone]) => (
                      <div key={text} className="flex gap-3">
                        <span className="text-slate-500">{label}</span>
                        <span
                          className={
                            tone === 'danger'
                              ? 'text-red-300'
                              : tone === 'warning'
                                ? 'text-amber-200'
                                : tone === 'healthy'
                                  ? 'text-emerald-300'
                                  : 'text-sky-300'
                          }
                        >
                          {text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* // made by bob */}
      <section className="relative mx-auto grid max-w-7xl gap-5 px-5 pb-20 sm:px-8 lg:grid-cols-4">
        {storySteps.map(([step, title, description]) => (
          <div key={title} className="agent-panel rounded-3xl p-5">
            <p className="font-mono text-xs text-sky-400">{step}</p>
            <h2 className="mt-3 text-xl font-bold">{title}</h2>
            <p className="agent-muted mt-3 text-sm leading-6">{description}</p>
          </div>
        ))}
      </section>

      <section className="relative mx-auto grid max-w-7xl gap-5 px-5 pb-24 sm:px-8 md:grid-cols-2 lg:grid-cols-3">
        {features.map(([title, description], index) => (
          <div key={title} className="agent-soft rounded-3xl p-5">
            <div
              className={`grid h-11 w-11 place-items-center rounded-2xl ${
                index % 3 === 0
                  ? 'bg-blue-500/10 text-blue-400'
                  : index % 3 === 1
                    ? 'bg-emerald-400/10 text-emerald-400'
                    : 'bg-amber-400/10 text-amber-400'
              }`}
            >
              {index + 1}
            </div>
            <h2 className="mt-5 text-lg font-bold">{title}</h2>
            <p className="agent-muted mt-2 text-sm leading-6">{description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-4">
      <div className="grid h-13 w-13 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-xl font-black text-white shadow-[0_0_30px_rgba(37,99,235,0.35)]">
        A
      </div>
      <div>
        <p className="text-2xl font-bold tracking-[-0.04em]">
          Agentic<span className="agent-blue">Repo</span>
        </p>
        <p className="agent-muted mt-1 text-sm">Autonomous GitHub Engineering Agent</p>
      </div>
    </div>
  );
}

// Made with Bob
// made by bob
