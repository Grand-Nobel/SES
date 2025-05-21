import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session extends DefaultSession {
    user: {
      id?: string | null; // Add your custom property id
    } & DefaultSession["user"]; // Keep original properties like name, email, image
    accessToken?: string | null; // Example: if you store access token in session
    provider?: string | null; // Example: to know which provider was used
    error?: string | null; // For potential auth errors
  }

  /** The OAuth profile returned from your provider */
  interface Profile {
    // Add any provider-specific profile properties if needed
    // e.g. for GitHub:
    // login?: string;
  }
  
  interface User extends DefaultUser {
    // Add any custom properties to the User object returned by an authorize function or OAuth profile
    // id is already part of DefaultUser, but ensure it's consistently string
    id: string; 
    // role?: string; // Example custom property
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends DefaultJWT {
    id?: string | null;
    accessToken?: string | null;
    provider?: string | null;
    // role?: string; // Example custom property
  }
}