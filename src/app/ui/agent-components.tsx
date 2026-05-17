import type { ReactNode } from 'react';

type StatusTone = 'healthy' | 'warning' | 'danger' | 'neutral' | 'info';

const toneClasses: Record<StatusTone, string> = {
  healthy: 'border-emerald-400/30 bg-emerald-400/10 text-signal-green shadow-emerald-500/10',
  warning: 'border-amber-400/30 bg-amber-400/10 text-signal-amber shadow-amber-500/10',
  danger: 'border-red-400/30 bg-red-400/10 text-signal-red shadow-red-500/10',
  neutral: 'border-slate-500/30 bg-slate-500/10 text-slate-200 shadow-slate-500/10',
  info: 'border-sky-400/30 bg-sky-400/10 text-signal-sky shadow-sky-500/10',
};

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] shadow-lg ${toneClasses[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_14px_currentColor]" />
      {children}
    </span>
  );
}

export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`agent-panel rounded-3xl p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        {title}
      </h2>
      {description ? <p className="agent-muted mt-2 text-sm leading-6">{description}</p> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: StatusTone;
}) {
  return (
    <div className="agent-soft rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <span className={`h-2 w-2 rounded-full ${tone === 'healthy' ? 'bg-emerald-400' : tone === 'danger' ? 'bg-red-400' : tone === 'warning' ? 'bg-amber-400' : tone === 'info' ? 'bg-sky-400' : 'bg-slate-500'}`} />
      </div>
      <p className="mt-3 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
        {value}
      </p>
      <p className="agent-muted mt-1 text-xs">{hint}</p>
    </div>
  );
}

export function TerminalBlock({
  title,
  lines,
}: {
  title: string;
  lines: Array<{ label: string; text: string; tone?: StatusTone }>;
}) {
  return (
    <div className="agent-terminal overflow-hidden rounded-2xl shadow-inner shadow-black/40">
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--terminal-border)' }}>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">{title}</p>
      </div>
      <div className="space-y-3 p-4 font-mono text-xs leading-6 text-slate-300">
        {lines.map((line) => (
          <p key={`${line.label}-${line.text}`} className="flex gap-3">
            <span className="text-slate-600">{line.label}</span>
            <span
              className={
                line.tone === 'danger'
                  ? 'text-red-300'
                  : line.tone === 'warning'
                    ? 'text-amber-200'
                    : line.tone === 'healthy'
                      ? 'text-emerald-300'
                      : line.tone === 'info'
                        ? 'text-sky-300'
                        : 'text-slate-300'
              }
            >
              {line.text}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

export function ConfidenceRing({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, score));

  return (
    <div
      className="grid h-28 w-28 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#38bdf8 ${safeScore * 3.6}deg, rgba(30, 41, 59, 0.95) 0deg)`,
      }}
    >
      <div className="grid h-20 w-20 place-items-center rounded-full border border-white/10 bg-slate-950">
        <div className="text-center">
          <p className="text-2xl font-semibold text-white">{safeScore}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">score</p>
        </div>
      </div>
    </div>
  );
}

export function RiskIndicator({
  score,
  label = 'Risk',
}: {
  score: number;
  label?: string;
}) {
  const safeScore = Math.max(0, Math.min(100, score));
  const tone = safeScore > 72 ? 'danger' : safeScore > 42 ? 'warning' : 'healthy';

  return (
    <div className="agent-soft rounded-2xl p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <StatusBadge tone={tone}>{safeScore}%</StatusBadge>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-400/20">
        <div
          className={`h-full rounded-full ${
            tone === 'danger'
              ? 'bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.55)]'
              : tone === 'warning'
                ? 'bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.45)]'
                : 'bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.45)]'
          }`}
          style={{ width: `${safeScore}%` }}
        />
      </div>
    </div>
  );
}

export function AnalysisPanel({
  title,
  eyebrow,
  children,
  tone = 'info',
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  tone?: StatusTone;
}) {
  return (
    <div className="agent-soft group rounded-2xl p-4 transition hover:-translate-y-0.5 hover:border-sky-300/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          <h3 className="mt-2 font-semibold" style={{ color: 'var(--foreground)' }}>
            {title}
          </h3>
        </div>
        <StatusBadge tone={tone}>{tone}</StatusBadge>
      </div>
      <div className="agent-muted mt-4 text-sm leading-6">{children}</div>
    </div>
  );
}

export function EngineeringSummaryCard({
  title,
  summary,
  items,
}: {
  title: string;
  summary: string;
  items: string[];
}) {
  return (
    <div className="rounded-3xl border border-sky-300/20 bg-sky-400/10 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Engineering summary</p>
      <h3 className="mt-2 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
        {title}
      </h3>
      <p className="agent-muted mt-3 text-sm leading-6">{summary}</p>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex gap-3 rounded-2xl bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.9)]" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Made with Bob
// made by bob
