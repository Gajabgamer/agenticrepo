# AgenticRepo

Autonomous GitHub-native engineering agent for repository intelligence, workflow monitoring, regression investigation, and safe automated fix pull requests.

AgenticRepo connects to a GitHub repository, listens to engineering signals, builds operational memory, investigates CI/CD failures, and helps teams understand what changed, why it matters, and what can be safely fixed.

## What It Does

- Monitors GitHub webhook events for pull requests, workflow runs, and issue comments.
- Analyzes failed workflows and parses CI/CD failure signals.
- Correlates suspicious commits with affected files and modules.
- Tracks incidents, repository health, workflow recovery, and investigation history.
- Builds lightweight engineering memory and optimized AI context without vector database overhead.
- Supports IBM Bob and Groq provider configuration.
- Runs controlled terminal commands for repository operations without exposing raw shell access.
- Generates deterministic safe fixes only for narrow, reviewable changes.

## Tech Stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Prisma ORM
- Turso/libSQL
- Auth.js / NextAuth
- GitHub OAuth and GitHub App webhooks
- xterm.js for the controlled engineering console

## Core Workflows

1. Sign in with GitHub.
2. Connect one repository.
3. Configure IBM Bob or Groq.
4. Configure the GitHub webhook secret.
5. Monitor workflow and pull request activity.
6. Investigate failures and regressions.
7. Review operational memory, incident history, and repository health.
8. Generate safe, reviewable fix pull requests when eligible.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run db:push
npm run dev
```

Open `http://localhost:3000`.

## Required Environment Variables

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
GITHUB_TOKEN=

DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=

BOB_API_KEY=
GROQ_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Do not commit real secrets. Use `.env.local` locally and Vercel environment variables in production.

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run test:workflow
npm run db:migrate:deploy
```

## Controlled Terminal Commands

The in-app terminal does not execute arbitrary operating system commands. It routes only approved AgenticRepo operations, including:

```text
analyze-repo
generate-docs
scan-regressions
investigate-failure
run-autofix
memory-status
optimize-context
show-agents
coordination-status
recover-workflow
repo-map
review-pr <id>
```

## Deployment Notes

AgenticRepo is designed for Vercel serverless deployment with Turso/libSQL. API routes that use GitHub, Prisma, or webhook verification run in the Node.js runtime.

Production callback and webhook URLs normally look like:

```text
https://your-domain.vercel.app/api/auth/callback/github
https://your-domain.vercel.app/api/github/webhook
```

## Security Model

- Webhook signatures are verified with the configured GitHub webhook secret.
- GitHub and AI provider tokens stay server-side.
- The terminal is command-routed and does not expose raw shell access.
- Auto-fix behavior is intentionally constrained to deterministic safe edits.
- Repository actions should produce pull requests for review rather than silent direct changes.

## Project Status

AgenticRepo is an active autonomous engineering platform prototype focused on operational credibility, repository intelligence, and safe automation.

See [ROADMAP.md](./ROADMAP.md) for planned work and [SECURITY.md](./SECURITY.md) for vulnerability reporting.

## License

MIT. See [LICENSE](./LICENSE).
