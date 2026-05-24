# agenticrepo
AgenticRepo is an autonomous GitHub-native engineering agent that connects to a GitHub repository, listens to engineering signals, builds operational memory, investigates CI/CD failures, and generates safe automated fix pull requests. It provides a suite of APIs for managing repository health, investigating incidents, and automating recovery workflows.

AgenticRepo solves the problem of manual intervention in CI/CD pipelines by providing an autonomous agent that can investigate failures, identify root causes, and generate fixes. It integrates with GitHub webhooks to receive notifications about repository events and uses AI-powered engines to analyze and respond to these events. The system consists of several core modules, including `src/lib`, `src/app`, and `prisma`, which handle tasks such as data persistence, authentication, and webhook event processing.

The `src/lib` module contains functions like `assembleOptimizedContext` and `runWorkflowRecovery`, which are used to assemble optimized context for engineering tasks and recover from workflow failures. The `src/app` module contains API routes such as `/api/activity`, `/api/incidents`, and `/api/recoveries`, which provide endpoints for retrieving activity events, incident reports, and recovery workflows. The `prisma` module handles data persistence using Prisma ORM and defines models such as `activityEvent`, `incident`, and `workflowRecovery`.

## Core Features
* Autonomous investigation of CI/CD failures
* Automated generation of safe fix pull requests
* Repository health monitoring and reporting
* Incident management and tracking
* Integration with GitHub webhooks and APIs
* Support for multiple AI providers, including Groq and IBM Bob

## Architecture
AgenticRepo's architecture consists of several modules that work together to provide its core features. The `src/lib` module handles data persistence, authentication, and webhook event processing, while the `src/app` module contains API routes for managing repository health, investigating incidents, and automating recovery workflows. The `prisma` module defines the data models used by the system, including `activityEvent`, `incident`, and `workflowRecovery`.

## Tech Stack
| Technology | Description |
| --- | --- |
| Next.js | App Router and Pages Router |
| TypeScript | Programming language |
| Prisma ORM | Data persistence layer |
| Turso / libSQL | Database dependency |
| Auth.js / NextAuth | Authentication and authorization |
| Vercel | Deployment platform |

## Project Structure
The project is organized into several directories, including `src/lib`, `src/app`, `prisma`, and `scripts`. The `src/lib` directory contains functions and utilities used throughout the system, while the `src/app` directory contains API routes and frontend code. The `prisma` directory defines the data models used by the system, and the `scripts` directory contains scripts for building and deploying the application.

## API Reference
The following API routes are available:
* `/api/activity`: Retrieves activity events for the connected repository
* `/api/incidents`: Retrieves incident reports for the connected repository
* `/api/recoveries`: Retrieves recovery workflows for the connected repository
* `/api/context`: Retrieves optimized context for engineering tasks
* `/api/health/repository`: Retrieves repository health reports

## Database
The system uses Prisma ORM to define its data models, including:
* `activityEvent`
* `incident`
* `workflowRecovery`
* `connectedRepository`
* `githubEvent`

## Environment Variables
The following environment variables are required:
* `GROQ_API_KEY`: Groq API key for AI reasoning
* `BOB_API_KEY`: IBM Bob API key for AI reasoning
* `GITHUB_WEBHOOK_SECRET`: HMAC secret for validating GitHub webhook payloads

## Getting Started
To get started with AgenticRepo, follow these steps:
1. Clone the repository and install dependencies using `npm install`
2. Set up environment variables for Groq API key, IBM Bob API key, and GitHub webhook secret
3. Start the development server using `npm run dev`
4. Connect to a GitHub repository using the `/api/github/setup` endpoint
5. Use the API routes to retrieve activity events, incident reports, and recovery workflows

## Deployment
AgenticRepo can be deployed to Vercel using the `vercel` command. Make sure to set up environment variables for Groq API key, IBM Bob API key, and GitHub webhook secret before deploying.