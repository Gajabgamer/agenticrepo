import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      githubUsername: string;
      avatarUrl?: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    githubUsername?: string;
    avatarUrl?: string | null;
  }
}

// Made with Bob
// made by bob
