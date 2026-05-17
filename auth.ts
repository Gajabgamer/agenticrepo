import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { getPrisma } from '@/lib/database/prisma';
import { encryptSecret } from '@/lib/security/secrets';

const githubOAuthClientId = process.env.GITHUB_OAUTH_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
const githubOAuthClientSecret =
  process.env.GITHUB_OAUTH_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;
const githubOAuthScope = process.env.GITHUB_OAUTH_CLIENT_ID ? 'read:user user:email repo' : '';

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    'development-only-nextauth-secret-change-me',
  trustHost: true,
  session: {
    strategy: 'jwt',
  },
  providers: [
    GitHub({
      clientId: githubOAuthClientId,
      clientSecret: githubOAuthClientSecret,
      authorization: {
        params: {
          // made by bob
          // OAuth Apps need explicit scopes, while the older GitHub App fallback keeps scope empty.
          scope: githubOAuthScope,
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === 'github' && account.access_token && profile) {
        const githubId = String(profile.id);
        const githubUsername =
          typeof profile.login === 'string'
            ? profile.login
            : token.name || 'github-user';
        const avatarUrl =
          typeof profile.avatar_url === 'string'
            ? profile.avatar_url
            : typeof token.picture === 'string'
              ? token.picture
              : null;

        const user = await getPrisma().user.upsert({
          where: { githubId },
          create: {
            githubId,
            githubUsername,
            githubAccessToken: encryptSecret(account.access_token),
            avatarUrl,
          },
          update: {
            githubUsername,
            githubAccessToken: encryptSecret(account.access_token),
            avatarUrl,
          },
        });

        token.userId = user.id;
        token.githubUsername = user.githubUsername;
        token.avatarUrl = user.avatarUrl;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === 'string' ? token.userId : '';
        session.user.githubUsername =
          typeof token.githubUsername === 'string' ? token.githubUsername : '';
        session.user.avatarUrl =
          typeof token.avatarUrl === 'string' ? token.avatarUrl : null;
      }

      return session;
    },
  },
});

// Made with Bob
// made by bob
