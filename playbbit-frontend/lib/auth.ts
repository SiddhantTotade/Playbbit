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
          const res = await fetch("http://localhost:8080/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
            }),
          });

          const data = await res.json();

          console.log("8080 Backend Status:", res.status);
          console.log("8080 Backend Data:", data);

          if (res.ok && data.token) {
            return {
              id: data.user.id.toString(),
              name: data.user.name,
              email: data.user.email,
              accessToken: data.token,
            };
          }

          return null;
        } catch (error) {
          console.error("8080 Connection Error:", error);
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
      if (session.user) {
        (session.user as any).accessToken = token.accessToken;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  session: { strategy: "jwt" as const },
  pages: { signIn: "/login" },
};
