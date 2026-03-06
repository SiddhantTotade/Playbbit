import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Playbbit",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      // lib/auth.ts
      async authorize(credentials) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api";
          const res = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
            }),
          });

          const data = await res.json();

          console.log(`Login attempt for ${credentials?.email} to ${baseUrl}/auth/login`);
          console.log("Backend response status:", res.status);
          console.log("Backend response data:", data);

          if (res.ok && data.token) {
            console.log("Login successful, token received");
            return {
              id: data.user.id.toString(),
              name: data.user.name,
              email: data.user.email,
              accessToken: data.token,
            };
          }

          console.warn("Login failed: Backend returned non-ok status or no token");
          return null;
        } catch (error) {
          console.error("Login authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session) {
        (session as any).accessToken = token.accessToken;
        if (session.user) {
          (session.user as any).id = token.id;
        }
      }
      return session;
    },
  },
  session: { strategy: "jwt" as const },
  pages: { signIn: "/login" },
};
