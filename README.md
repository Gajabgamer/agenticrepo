# agenticrepo
Autonomous GitHub-native engineering agent for repository intelligence.

AgenticRepo is a Next.js application that connects to a GitHub repository, listens to engineering signals, and provides operational memory. It utilizes Prisma ORM for data persistence and Turso/libSQL for database operations. The application is built with TypeScript and utilizes Auth.js/NextAuth for authentication.

## Core Capabilities
* Monitors GitHub webhook events
* Analyzes failed workflows and parses CI/CD failure signals
* Correlates suspicious commits with affected workflows
* Provides operational memory and context management

## Architecture
AgenticRepo is built using a modular architecture, with the following components:
* `src/lib`: HTTP/API boundary, GitHub workflow integration, CI/CD orchestration, Data persistence layer, Quality and regression coverage, Authentication and authorization, Webhook event processing, AI/LLM integration layer, Engineering memory and context management
* `src/app`: HTTP/API boundary, Frontend application surface, GitHub workflow integration, CI/CD orchestration, Authentication and authorization, Webhook event processing, Engineering memory and context management
* `prisma`: Data persistence layer

## Tech Stack
| Technology | Description |
| --- | --- |
| Next.js | App Router and Pages Router |
| TypeScript | Programming language |
| Prisma ORM | Data persistence layer |
| Turso/libSQL | Database operations |
| Auth.js/NextAuth | Authentication and authorization |
| Vercel | Deployment configuration |

## Repository Structure
The repository is organized into the following modules:
* `src/lib`: 50 files, medium risk
* `src/app`: 41 files, medium risk
* `bob_sessions`: 3 files, low risk
* `prisma`: 2 files, low risk
* `scripts`: 2 files, low risk
* `src/types`: 2 files, low risk
* `.env.example`: 1 file, low risk
* `AGENTS.md`: 1 file, low risk

## Local Development
To set up the application for local development, run the following commands:
1. `npm install`
2. `npm run dev`

## Environment Variables
The following environment variable is detected:
* `VERCEL_URL`: Vercel deployment URL (auto-set) (optional)

## API Structure
The API structure is not explicitly defined, but the application uses Next.js App Router and Pages Router.

## Database Layer
The database layer is managed by Prisma ORM, with the following models:
* `GithubEvent`
* `ActivityEvent`
* `Incident`

## Deployment
The application is deployed using Vercel, with the deployment configuration defined in the `vercel` directory.

## Engineering Notes
The application has a recorded incident history, with 1 incident recorded. The application also has a medium risk level for the `src/lib` and `src/app` modules.

## License
The license for this repository is not explicitly defined.