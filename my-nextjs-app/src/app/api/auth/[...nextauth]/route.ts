import NextAuth, { NextAuthOptions, User, Account } from 'next-auth'; // For v4
import { JWT } from 'next-auth/jwt'; // For v4 JWT type
// import GithubProvider from 'next-auth/providers/github'; // Keep commented
import CredentialsProvider from 'next-auth/providers/credentials';
import logger from '@/lib/logging'; 

// const GITHUB_ID = process.env.GITHUB_CLIENT_ID;
// const GITHUB_SECRET = process.env.GITHUB_CLIENT_SECRET;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

if (!NEXTAUTH_SECRET) {
  logger.error('FATAL ERROR: NEXTAUTH_SECRET is not defined. NextAuth will not function securely.');
}

export const authOptions: NextAuthOptions = {
  providers: [
    // GithubProvider({ clientId: GITHUB_ID, clientSecret: GITHUB_SECRET }), // Keep commented
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        try {
          logger.info({ email: credentials?.email, stage: 'v4_authorize_invoked' }, 'Attempting credentials authorization (v4).');
          if (credentials?.email === "user@example.com" && credentials?.password === "password") {
            const user: User = { 
              id: "1", 
              name: "Test User", 
              email: "user@example.com",
              image: "https://via.placeholder.com/150/0000FF/808080?Text=User"
            };
            logger.info({ userId: user.id, stage: 'v4_authorize_success' }, 'Credentials authorization successful (v4).');
            return user;
          } else {
            logger.warn({ email: credentials?.email, stage: 'v4_authorize_failed' }, 'Credentials authorization failed (v4).');
            return null;
          }
        } catch (error: any) {
          logger.error({ error: error.message, stack: error.stack, stage: 'v4_authorize_error' }, 'Error in authorize callback (v4).');
          return null;
        }
      }
    })
  ],
  secret: NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      try {
        logger.info({ stage: 'v4_jwt_start', tokenId: token?.sub || token?.id, userId: user?.id, accountProvider: account?.provider }, 'JWT callback invoked (v4).');
        if (user) { // This is true on initial sign-in
          token.id = user.id; // For v4, often directly add to token
          token.name = user.name;
          token.email = user.email;
          token.picture = user.image;
        }
        if (account?.provider && account.provider !== "credentials") { // Example for OAuth
             token.accessToken = account.access_token;
        }
        logger.info({ stage: 'v4_jwt_end', finalTokenId: token?.id }, 'JWT callback returning (v4).');
        return token;
      } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, stage: 'v4_jwt_error' }, 'Error in JWT callback (v4).');
        return { ...token, error: "JWTProcessingError" }; 
      }
    },
    async session({ session, token, user: sessionUserParam }) { // user param here is from session strategy, token is from jwt callback
      try {
        logger.info({ stage: 'v4_session_start', sessionUserId: session?.user?.id, tokenId: token?.id }, 'Session callback invoked (v4).');
        if (token?.id && session.user) {
          session.user.id = token.id as string;
        }
        if (token?.name && session.user) {
            session.user.name = token.name;
        }
        if (token?.email && session.user) {
            session.user.email = token.email;
        }
        if (token?.picture && session.user) {
            session.user.image = token.picture as string | null | undefined;
        }
        // If you added accessToken to token in jwt callback, pass it to session
        // if (token?.accessToken && session.user) {
        //   (session as any).accessToken = token.accessToken;
        // }
        logger.info({ stage: 'v4_session_end', finalSessionUserId: session?.user?.id }, 'Session callback returning (v4).');
        return session;
      } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, stage: 'v4_session_error' }, 'Error in session callback (v4).');
        return { ...session, error: "SessionProcessingError" } as any;
      }
    },
    async redirect({ url, baseUrl }) {
      try {
        logger.info({ currentFullUrl: url, baseUrlFromNextAuth: baseUrl, stage: 'v4_redirect_invoked' }, 'Redirect callback invoked (v4).');
        if (url.startsWith('/')) {
          const finalRedirectUrl = `${baseUrl}${url}`;
          logger.info({ finalRedirectUrl, stage: 'v4_redirect_returning_relative_prefixed' }, 'Redirect callback returning relative URL prefixed with baseUrl (v4).');
          return finalRedirectUrl;
        }
        logger.info({ finalRedirectUrl: url, stage: 'v4_redirect_returning_absolute_or_external' }, 'Redirect callback returning absolute or external URL (v4).');
        return url; 
      } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, stage: 'v4_redirect_error' }, 'Error in redirect callback (v4).');
        return baseUrl;
      }
    }
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      try {
        logger.info({ userId: user?.id, accountProvider: account?.provider, isNewUser, stage: 'v4_event_signIn' }, 'signIn event triggered (v4)');
      } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, stage: 'v4_event_signIn_error' }, 'Error in signIn event (v4).');
      }
    },
    async signOut({ session, token }) {
      try {
        logger.info({ sessionUserId: (session?.user as any)?.id, tokenId: token?.id, stage: 'v4_event_signOut' }, 'signOut event triggered (v4)');
      } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, stage: 'v4_event_signOut_error' }, 'Error in signOut event (v4).');
      }
    },
  },
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(code, metadata) {
      const errorDetails = metadata instanceof Error ? { name: metadata.name, message: metadata.message, stack: metadata.stack } : metadata;
      logger.error({ code, metadata: errorDetails, source: 'NextAuth_v4' }, `NextAuth v4 Error: ${code}`);
    },
    warn(code: string, metadata?: any) { // v4 warn can take metadata
      logger.warn({ code, metadata, source: 'NextAuth_v4' }, `NextAuth v4 Warning: ${code}`);
    },
    debug(code, metadata) {
      if (logger.level === 'debug' || process.env.NODE_ENV === 'development') { 
        logger.debug({ code, metadata, source: 'NextAuth_v4' }, `NextAuth v4 Debug: ${code}`);
      }
    }
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };