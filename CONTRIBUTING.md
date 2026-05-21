# Contributing to AgenticRepo

Thanks for helping improve AgenticRepo. This project is focused on believable, safe, GitHub-native engineering automation.

## Development Principles

- Preserve the current backend architecture and application flow.
- Keep automation safe, deterministic, and reviewable.
- Do not add unrestricted shell execution.
- Do not send entire repositories into AI prompts.
- Prefer small, operational improvements over broad rewrites.
- Preserve all existing Bob attribution comments.

## Local Development

```bash
npm install
cp .env.example .env.local
npm run db:push
npm run dev
```

Before opening a pull request, run:

```bash
npm run lint
npm run build
npm run test:workflow
```

## Pull Request Checklist

- The change is scoped to one clear problem.
- TypeScript passes.
- The production build passes.
- Workflow simulation still passes.
- New UI has useful empty, loading, and error states.
- Secrets are not logged, committed, or exposed to the client.
- New automation remains controlled and reviewable.

## Code Style

- Use TypeScript types for route payloads and workflow data.
- Keep UI components readable and operational, not decorative for its own sake.
- Reuse existing workflow engines and database models where possible.
- Add `// made by bob` to major new logic blocks where appropriate.

## Reporting Issues

Include:

- What you expected to happen.
- What happened instead.
- Relevant logs or screenshots.
- Whether the issue is local, Vercel, GitHub OAuth, webhook, Turso, or terminal related.
