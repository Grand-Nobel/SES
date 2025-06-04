// pages/api/auth/[...nextauth]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import NextAuth, { NextAuthOptions, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import logger from '@/lib/logging';
import { PrismaClient } from '@prisma/client';
import { PrismaAdapter } from '@next-auth/prisma-adapter'; // Added for Prisma adapter
import { compare } from 'bcrypt';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { createHash } from 'crypto';

// Singleton PrismaClient to prevent "too many connections" in dev
const prisma = (globalThis as any).prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') (globalThis as any).prisma = prisma;

// Rate limiter to prevent brute force attacks
const rateLimiter = new RateLimiterMemory({
  points: 5, // 5 attempts
  duration: 60, // Per minute
});

// Environment variables validation
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!NEXTAUTH_SECRET) {
  logger.error('FATAL ERROR: NEXTAUTH_SECRET is not defined. NextAuth will not function securely.');
  throw new Error('NEXTAUTH_SECRET is not defined');
}

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  logger.warn('Google OAuth credentials not found. Google provider will be disabled.');
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma), // Use Prisma adapter for session/account persistence
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        try {
          // Rate limiting
          const forwardedFor = req.headers?.['x-forwarded-for'];
          const ip = typeof forwardedFor === 'string' ? forwardedFor.split(',')[0]?.trim() : (req.headers?.['remoteAddress'] || 'unknown');
          const key = `auth:${ip}:${credentials?.email}`;
          await rateLimiter.consume(key).catch(() => {
            logger.warn({ ip, email: credentials?.email, stage: 'auth_rate_limit_exceeded' }, 'Rate limit exceeded for authentication attempt.');
            throw new Error('Too many login attempts. Please try again later.');
          });

          logger.info({ email: credentials?.email, stage: 'v4_authorize_invoked' }, 'Attempting credentials authorization.');

          if (!credentials?.email || !credentials?.password) {
            logger.warn({ stage: 'v4_authorize_failed', reason: 'missing_credentials' }, 'Missing email or password.');
            throw new Error('Email and password are required.');
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user || !user.password) {
            logger.warn({ email: credentials.email, stage: 'v4_authorize_failed' }, 'User not found or password not set.');
            return null;
          }

          const isValid = await compare(credentials.password, user.password);
          if (!isValid) {
            logger.warn({ email: credentials.email, stage: 'v4_authorize_failed' }, 'Invalid password.');
            return null;
          }

          const authUser: User = {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image || "https://via.placeholder.com/150/0000FF/808080?Text=User",
            tenantId: user.tenantId,
            role: user.profile?.role, // Include the role from the profile
          };

          logger.info({ userId: user.id, stage: 'v4_authorize_success' }, 'Credentials authorization successful.');
          return authUser;
        } catch (error: any) {
          logger.error({ error: error.message, stack: error.stack, stage: 'v4_authorize_error' }, 'Error in authorize callback.');
          throw error;
        }
      },
    }),
    ...(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: "consent",
                access_type: "offline",
                response_type: "code",
              },
            },
          }),
        ]
      : []),
  ],
  secret: NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      try {
        logger.info({ stage: 'v4_jwt_start', tokenId: token.sub, userId: user?.id, accountProvider: account?.provider }, 'JWT callback invoked.');

        if (user) {
          token.id = user.id;
          token.name = user.name;
          token.email = user.email;
          token.picture = user.image;
          token.tenantId = user.tenantId;
          token.role = user.role; // Propagate role to JWT
        }

        if (account?.provider && account.provider !== "credentials") {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.expiresAt = account.expires_at;
        }

        logger.info({ stage: 'v4_jwt_end', finalTokenId: token.id }, 'JWT callback returning.');
        return token;
      } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, stage: 'v4_jwt_error' }, 'Error in JWT callback.');
        return { ...token, error: "JWTProcessingError" };
      }
    },
    async session({ session, token }) {
      try {
        logger.info({ stage: 'v4_session_start', sessionUserId: session?.user?.id, tokenId: token.id }, 'Session callback invoked.');

        if (session.user) {
          session.user.id = token.id as string;
          session.user.name = token.name;
          session.user.email = token.email;
          session.user.image = token.picture;
          session.user.tenantId = token.tenantId;
          session.user.role = token.role as string | undefined | null; // Propagate role to session
          if (token.accessToken) {
            (session as any).accessToken = token.accessToken;
            (session as any).expiresAt = token.expiresAt;
          }
        }

        logger.info({ stage: 'v4_session_end', finalSessionUserId: session?.user?.id }, 'Session callback returning.');
        return session;
      } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, stage: 'v4_session_error' }, 'Error in session callback.');
        return { ...session, error: "SessionProcessingError" };
      }
    },
    async redirect({ url, baseUrl }) {
      try {
        logger.info({ currentFullUrl: url, baseUrlFromNextAuth: baseUrl, stage: 'v4_redirect_invoked' }, 'Redirect callback invoked.');

        if (url.startsWith('/')) {
          const finalRedirectUrl = `${baseUrl}${url}`;
          logger.info({ finalRedirectUrl, stage: 'v4_redirect_returning_relative_prefixed' }, 'Redirect callback returning relative URL prefixed with baseUrl.');
          return finalRedirectUrl;
        }

        logger.info({ finalRedirectUrl: url, stage: 'v4_redirect_returning_absolute_or_external' }, 'Redirect callback returning absolute or external URL.');
        return url;
      } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, stage: 'v4_redirect_error' }, 'Error in redirect callback.');
        return baseUrl;
      }
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      try {
        const anonymizedUserId = createHash('sha256').update(user.id).digest('hex');
        logger.info(
          { userId: anonymizedUserId, accountProvider: account?.provider, isNewUser, stage: 'v4_event_signIn' },
          'signIn event triggered.'
        );
      } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, stage: 'v4_event_signIn_error' }, 'Error in signIn event.');
      }
    },
    async signOut({ session, token }) {
      try {
        const anonymizedUserId = token?.id ? createHash('sha256').update(token.id).digest('hex') : 'unknown';
        logger.info(
          { sessionUserId: anonymizedUserId, stage: 'v4_event_signOut' },
          'signOut event triggered.'
        );
      } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, stage: 'v4_event_signOut_error' }, 'Error in signOut event.');
      }
    },
  },
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(code, metadata) {
      const errorDetails = metadata instanceof Error ? { name: metadata.name, message: metadata.message, stack: metadata.stack } : metadata;
      logger.error({ code, metadata: errorDetails, source: 'NextAuth_v4' }, `NextAuth v4 Error: ${code}`);
    },
    warn(code: string, metadata?: any) {
      logger.warn({ code, metadata, source: 'NextAuth_v4' }, `NextAuth v4 Warning: ${code}`);
    },
    debug(code, metadata) {
      if (logger.level === 'debug' || process.env.NODE_ENV === 'development') {
        logger.debug({ code, metadata, source: 'NextAuth_v4' }, `NextAuth v4 Debug: ${code}`);
      }
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
