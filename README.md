# GitHub Engineering Agent

A Next.js 15 backend-oriented application for GitHub automation, analysis, and webhook processing.

## 🚀 Features

- **GitHub Integration**: Full GitHub API integration with webhook support
- **AI Analysis**: Code review, security scanning, and performance analysis
- **Webhook Processing**: Handle GitHub events in real-time
- **Database Layer**: Persistent storage for events and analysis
- **Scalable Architecture**: Clean separation of concerns with modular design

## 📁 Project Structure

```
github-agent/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   └── health/        # Health check endpoint
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Homepage
│   ├── lib/                   # Core business logic
│   │   ├── ai/               # AI analysis services
│   │   │   └── analyzer.ts   # AI analyzer implementation
│   │   ├── database/         # Database layer
│   │   │   └── client.ts     # Database client
│   │   ├── github/           # GitHub integrations
│   │   │   └── client.ts     # GitHub API client
│   │   ├── services/         # Service orchestration
│   │   │   └── orchestrator.ts
│   │   ├── utils/            # Utility functions
│   │   │   └── index.ts
│   │   └── webhooks/         # Webhook handlers
│   │       └── handler.ts
│   ├── types/                # TypeScript type definitions
│   │   └── index.ts
│   └── config/               # Configuration
│       └── index.ts
├── public/                   # Static assets
├── .env.local               # Environment variables (local)
├── .env.example             # Environment variables template
├── next.config.ts           # Next.js configuration
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.ts       # Tailwind CSS configuration
└── package.json             # Dependencies

```

## 🛠️ Setup Commands

### 1. Install Dependencies

```bash
cd github-agent
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# GitHub Configuration
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/github_agent

# AI Configuration
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Application Configuration
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
npm start
```

## 📡 API Endpoints

### Health Check

```
GET /api/health
```

Returns the health status of the application.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-17T08:00:00.000Z",
  "service": "GitHub Engineering Agent",
  "version": "1.0.0"
}
```

## 🏗️ Architecture

### Layers

1. **API Layer** (`src/app/api/`): Next.js API routes for HTTP endpoints
2. **Service Layer** (`src/lib/services/`): Business logic orchestration
3. **Integration Layer** (`src/lib/github/`, `src/lib/ai/`): External service integrations
4. **Data Layer** (`src/lib/database/`): Database operations
5. **Webhook Layer** (`src/lib/webhooks/`): GitHub webhook processing

### Import Aliases

The project uses TypeScript path aliases for clean imports:

```typescript
import { githubClient } from '@/lib/github/client';
import { ServiceResponse } from '@/types';
import config from '@/config';
```

## 🔧 Development

### Adding New Services

1. Create service file in appropriate `src/lib/` subdirectory
2. Export service instance
3. Import and use in orchestrator or API routes

### Adding New API Routes

1. Create route file in `src/app/api/[route-name]/route.ts`
2. Export HTTP method handlers (GET, POST, etc.)
3. Use service layer for business logic

### Type Safety

All types are defined in `src/types/index.ts`. Import and use throughout the application for full TypeScript support.

## 📦 Key Dependencies

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type safety
- **TailwindCSS**: Utility-first CSS
- **ESLint**: Code linting

## 🚦 Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
```

## 🔐 Security

- Store sensitive credentials in `.env.local` (never commit)
- Use webhook signature verification for GitHub webhooks
- Implement rate limiting for API endpoints
- Validate all incoming data

## 📝 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
