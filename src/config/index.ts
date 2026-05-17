export const config = {
  github: {
    token: process.env.GITHUB_TOKEN || '',
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
    apiUrl: 'https://api.github.com',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },
  },
  app: {
    env: process.env.NODE_ENV || 'development',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
} as const;

export default config;

// Made with Bob
