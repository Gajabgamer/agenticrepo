# agenticrepo
AgenticRepo is an autonomous GitHub-native engineering agent that connects to a GitHub repository, listens to engineering signals, builds operational memory, investigates CI/CD failures, and generates safe automated fix pull requests. It provides a suite of APIs for managing repository connections, investigating incidents, and automating recoveries.

The system is designed to solve the problem of manual intervention in CI/CD pipelines, providing a scalable and automated solution for engineering teams. It achieves this by integrating with GitHub workflows, listening to webhook events, and leveraging AI-powered reasoning to investigate and resolve incidents. The main features of AgenticRepo include automated incident investigation, workflow recovery, and pull request review.

At its core, AgenticRepo is composed of several key modules, including `src/lib`, `src/app`, and `prisma`. The `src/lib` module provides the HTTP/API boundary, GitHub workflow integration, and data persistence layer, while the `src/app` module handles the frontend application surface and authentication. The `prisma` module is responsible for data persistence, using the Prisma ORM to interact with the database.

## Core Features
* Automated incident investigation via the `/api/investigations` endpoint
* Workflow recovery via the `/api/recoveries` endpoint
* Pull request review via the `/api/pull-request-reviews` endpoint
* Repository connection management via the `/api/github/setup` endpoint
* Webhook event processing via the `/api/github/webhook` endpoint

## Architecture
The system's architecture is designed around a modular, microservices-based approach. The `src/lib` module provides a set of reusable functions and utilities, while the `src/app` module handles the frontend application logic. The `prisma` module interacts with the database, using the Prisma ORM to define the data models. The system also integrates with external services, such as GitHub and Vercel, using APIs and webhooks.

## Tech Stack
| Technology | Description |
| --- | --- |
| Next.js | App Router and Pages Router |
| TypeScript | Programming language |
| Prisma ORM | Data persistence layer |
| Turso / libSQL | Database dependency |
| Auth.js / NextAuth | Authentication and authorization |
| Vercel | Deployment configuration |

## Project Structure
The project is organized into several directories, including:
* `src/lib`: HTTP/API boundary, GitHub workflow integration, and data persistence layer
* `src/app`: Frontend application surface and authentication
* `prisma`: Data persistence layer
* `scripts`: CI/CD orchestration
* `src/types`: Authentication and authorization

## API Reference
The system provides several API endpoints, including:
* `/api/activity`: Returns a list of recent activity events
* `/api/github/setup`: Handles GitHub repository setup and connection
* `/api/health`: Returns the system's health status
* `/api/investigations`: Handles automated incident investigation
* `/api/recoveries`: Handles workflow recovery
* `/api/pull-request-reviews`: Handles pull request review

## Database
The system uses a Prisma ORM-defined database, with models including:
* `activityEvent`
* `connectedRepository`
* `incident`
* `investigation`
* `pullRequestReview`
* `workflowRecovery`

## Environment Variables
The system requires several environment variables, including:
* `GITHUB_WEBHOOK_SECRET`: HMAC secret for validating GitHub webhook payloads
* `GROQ_API_KEY`: Groq API key for AI reasoning
* `BOB_API_KEY`: IBM Bob API key for AI reasoning

## Getting Started
To get started with AgenticRepo, follow these steps:
1. Clone the repository
2. Install dependencies using `npm install`
3. Set environment variables, including `GITHUB_WEBHOOK_SECRET`, `GROQ_API_KEY`, and `BOB_API_KEY`
4. Start the system using `npm run dev`

## Deployment
The system is designed to be deployed to Vercel, using the `vercel` command. Follow these steps to deploy:
1. Install the Vercel CLI using `npm install -g vercel`
2. Link your Vercel account using `vercel login`
3. Deploy the system using `vercel deploy`