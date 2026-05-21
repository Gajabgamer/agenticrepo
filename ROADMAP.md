# AgenticRepo Roadmap

AgenticRepo is moving toward a focused open-source autonomous engineering operations platform.

## Current Focus

- GitHub repository connection and webhook processing.
- Workflow failure analysis and regression detection.
- Incident tracking and repository health scoring.
- Controlled engineering terminal.
- Context engineering and operational memory.
- Multi-agent coordination for engineering workflows.
- Safe deterministic fix pull request generation.

## Near-Term Roadmap

- Improve GitHub App installation diagnostics.
- Add richer workflow log ingestion from GitHub Actions.
- Expand safe fix categories while preserving review-first behavior.
- Improve incident linking between PRs, workflows, and recovery attempts.
- Add stronger local fixtures for end-to-end workflow testing.
- Improve command palette coverage and keyboard-first operations.

## Later Roadmap

- Better repository architecture mapping from real repository content.
- More granular confidence scoring for auto-fix eligibility.
- Deployment verification workflows after fix PR creation.
- Optional provider-specific prompt templates for Bob and Groq.
- More complete public documentation for operators and contributors.

## Non-Goals

- Arbitrary shell execution in the browser.
- Vector database dependency.
- Billing, teams, or SaaS organization systems.
- Unreviewed direct writes to production repositories.
- Fake chat agents or simulated AI conversations.
