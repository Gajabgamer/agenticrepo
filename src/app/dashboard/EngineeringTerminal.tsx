'use client';

import { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

type TerminalLine = {
  tone: 'info' | 'success' | 'warning' | 'danger' | 'muted';
  badge?: string;
  text: string;
  timestamp?: string;
};

const prompt = '\x1b[38;2;125;211;252magenticrepo\x1b[0m > ';
const commands = [
  'help',
  'clear',
  'analyze-repo',
  'repo-summary',
  'generate-docs',
  'scan-regressions',
  'show-workflows',
  'inspect-pr <id>',
  'review-pr <id>',
  'analyze-pr-risk',
  'workflow-impact',
  'explain-pr',
  'investigate-failure',
  'analyze-incident',
  'deep-scan',
  'repo-investigation',
  'repo-map',
  'explain-module',
  'architecture-summary',
  'detect-hotspots',
  'generate-architecture-docs',
  'correlate-commits',
  'engineering-summary',
  'run-autofix',
  'show-incidents',
  'ai-analyze',
  'recover-workflow',
  'stabilize-repo',
  'rerun-analysis',
  'show-recovery-plan',
  'self-heal',
  'validate-fix',
  'memory-status',
  'context-sources',
  'optimize-context',
  'recent-investigations',
  'repo-memory',
  'token-usage',
  'similar-incidents',
  'repo-history',
  'incident-patterns',
  'workflow-memory',
  'engineering-insights',
  'show-agents',
  'active-investigations',
  'coordination-status',
  'assign-analysis',
  'engineering-network',
  'investigation-flow',
];

const executableCommandNames = commands.map((command) => command.split(' ')[0]);
const suggestedCommands = ['analyze-repo', 'optimize-context', 'scan-regressions', 'show-agents', 'recover-workflow', 'repo-map'];

const toneColor: Record<TerminalLine['tone'], string> = {
  info: '\x1b[38;2;125;211;252m',
  success: '\x1b[38;2;110;231;183m',
  warning: '\x1b[38;2;252;211;77m',
  danger: '\x1b[38;2;252;165;165m',
  muted: '\x1b[38;2;148;163;184m',
};

function bootTerminal(terminal: Terminal) {
  terminal.writeln('\x1b[38;2;125;211;252mAgenticRepo engineering operations console\x1b[0m');
  terminal.writeln('\x1b[38;2;148;163;184mControlled commands only. No shell access. Run help.\x1b[0m');
  terminal.writeln('');
  terminal.write(prompt);
}

// made by bob
export function EngineeringTerminal({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<'ready' | 'running' | 'blocked'>('ready');
  const [expanded, setExpanded] = useState(!compact);
  const [minimized, setMinimized] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const inputRef = useRef('');
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!hostRef.current || terminalRef.current) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
      fontSize: compact ? 12 : 13,
      lineHeight: 1.35,
      scrollback: 1000,
      theme: {
        background: '#05080d',
        foreground: '#dbeafe',
        cursor: '#7dd3fc',
        selectionBackground: '#1d4ed866',
        black: '#020617',
        blue: '#60a5fa',
        brightBlue: '#93c5fd',
        cyan: '#67e8f9',
        green: '#6ee7b7',
        red: '#fca5a5',
        yellow: '#fde68a',
        magenta: '#c4b5fd',
        white: '#f8fafc',
      },
    });
    const fit = new FitAddon();

    terminal.loadAddon(fit);
    terminal.open(hostRef.current);
    fit.fit();
    terminalRef.current = terminal;
    fitRef.current = fit;
    historyRef.current = readStoredHistory();
    historyIndexRef.current = historyRef.current.length;

    bootTerminal(terminal);

    const writePrompt = () => {
      terminal.write(prompt);
    };

    const streamLines = async (lines: TerminalLine[]) => {
      for (const line of lines) {
        const stamp = formatTimestamp(line.timestamp);
        const badge = line.badge ? ` [${line.badge}]` : '';
        terminal.writeln(`${toneColor[line.tone]}${stamp}${badge} ${line.text}\x1b[0m`);
        await new Promise((resolve) => window.setTimeout(resolve, compact ? 70 : 120));
      }
    };

    const recallHistory = (direction: -1 | 1) => {
      if (historyRef.current.length === 0) {
        return;
      }

      historyIndexRef.current = Math.max(
        0,
        Math.min(historyRef.current.length, historyIndexRef.current + direction)
      );
      const nextCommand = historyRef.current[historyIndexRef.current] || '';
      terminal.write('\x1b[2K\r');
      inputRef.current = nextCommand;
      writePrompt();
      terminal.write(nextCommand);
    };

    const autocompleteCommand = () => {
      const prefix = inputRef.current.trim().split(/\s+/)[0] || '';
      const suggestion = executableCommandNames.find((command) => command.startsWith(prefix));

      if (!suggestion || suggestion === prefix) {
        return;
      }

      terminal.write('\x1b[2K\r');
      inputRef.current = suggestion;
      writePrompt();
      terminal.write(suggestion);
    };

    const runCommand = async (command: string) => {
      if (!command) {
        writePrompt();
        return;
      }

      if (command === 'clear') {
        terminal.clear();
        writePrompt();
        return;
      }

      if (command === 'help') {
        await streamLines(commands.map((item) => ({ tone: 'info' as const, badge: 'AgenticRepo', text: item })));
        writePrompt();
        return;
      }

      busyRef.current = true;
      setStatus('running');
      terminal.writeln(`${toneColor.muted}${formatTimestamp()} [AgenticRepo] executing controlled workflow command...\x1b[0m`);

      try {
        const response = await fetch('/api/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command }),
        });
        const data = await response.json() as { error?: string; lines?: TerminalLine[] };

        if (!response.ok) {
          setStatus('blocked');
          await streamLines([{ tone: 'danger', badge: 'AgenticRepo', text: data.error || 'Command failed.' }]);
        } else {
          setStatus('ready');
          await streamLines(data.lines || []);
        }
      } catch (error) {
        setStatus('blocked');
        await streamLines([
          {
            tone: 'danger',
            badge: 'AgenticRepo',
            text: error instanceof Error ? error.message : 'Network error while running command.',
          },
        ]);
      } finally {
        busyRef.current = false;
        writePrompt();
      }
    };

    const handleInput = async (data: string) => {
      if (busyRef.current) {
        return;
      }

      if (data === '\r') {
        const command = inputRef.current.trim();
        terminal.write('\r\n');
        inputRef.current = '';

        if (command) {
          historyRef.current = [...historyRef.current, command].slice(-30);
          historyIndexRef.current = historyRef.current.length;
          window.sessionStorage.setItem('agentic-terminal-history', JSON.stringify(historyRef.current));
        }

        await runCommand(command);
        return;
      }

      if (data === '\u007F') {
        if (inputRef.current.length > 0) {
          inputRef.current = inputRef.current.slice(0, -1);
          terminal.write('\b \b');
        }
        return;
      }

      if (data === '\x1b[A' || data === '\x1b[B') {
        recallHistory(data === '\x1b[A' ? -1 : 1);
        return;
      }

      if (data === '\t') {
        autocompleteCommand();
        return;
      }

      if (/^[\x20-\x7E]$/.test(data)) {
        inputRef.current += data;
        terminal.write(data);
      }
    };

    const disposeData = terminal.onData((data) => {
      void handleInput(data);
    });
    const onResize = () => fit.fit();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      disposeData.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    if (minimized) {
      return;
    }

    const timer = window.setTimeout(() => fitRef.current?.fit(), 80);
    return () => window.clearTimeout(timer);
  }, [expanded, minimized]);

  const statusTone =
    status === 'running'
      ? 'text-signal-sky'
      : status === 'blocked'
        ? 'text-signal-red'
        : 'text-signal-green';

  return (
    <div className="agent-terminal relative overflow-hidden rounded-3xl border border-sky-300/15 shadow-[0_0_50px_rgba(37,99,235,0.18)]">
      {/* // made by bob */}
      <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">safe ops terminal</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">Repository Intelligence Console</p>
          <p className="agent-muted mt-1 text-xs">Tab autocomplete, arrow-key history, grouped timestamps, controlled commands only.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className={`font-semibold ${statusTone}`}>{status}</span>
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.9)]" />
          <span>controlled</span>
          <button
            type="button"
            onClick={() => setMinimized(!minimized)}
            className="rounded-lg border border-white/10 px-2 py-1 transition hover:bg-white/10"
          >
            {minimized ? 'open' : 'minimize'}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg border border-white/10 px-2 py-1 transition hover:bg-white/10"
          >
            {expanded ? 'compact' : 'expand'}
          </button>
        </div>
      </div>
      {/* // made by bob */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 bg-white/[0.025] px-4 py-3">
        {suggestedCommands.map((command) => (
          <button
            key={command}
            type="button"
            onClick={() => {
              if (busyRef.current || !terminalRef.current) return;
              terminalRef.current.write(command);
              inputRef.current = command;
              terminalRef.current.focus();
            }}
            className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[0.7rem] text-sky-200 transition hover:border-sky-300/40 hover:bg-sky-400/10"
            title={`Type ${command} into the controlled terminal`}
          >
            {command}
          </button>
        ))}
      </div>
      <div
        ref={hostRef}
        className={`${minimized ? 'hidden' : ''} ${
          expanded ? 'h-[520px] p-3 sm:h-[620px]' : 'h-[320px] p-3 sm:h-[360px]'
        }`}
      />
    </div>
  );
}

function formatTimestamp(value?: string): string {
  const date = value ? new Date(value) : new Date();
  return `[${date.toLocaleTimeString('en-US', { hour12: false })}]`;
}

function readStoredHistory(): string[] {
  try {
    const value = window.sessionStorage.getItem('agentic-terminal-history');
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

// Made with Bob
// made by bob
