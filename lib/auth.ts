import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { branch: true },
        });

        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(credentials.password as string, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
          branchName: user.branch?.name || null,
          branchSlug: user.branch?.slug || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as any).role;
        token.branchId = (user as any).branchId;
        token.branchName = (user as any).branchName;
        token.branchSlug = (user as any).branchSlug;
        token.activeBranchId = (user as any).branchId;
      }
      return token;
    },
    async session({ session, token }) {
      const user = await prisma.user.findUnique({
        where: { id: token.userId as string },
        select: {
          activeBranchId: true,
          role: true,
          branchId: true,
          isActive: true,
          branch: { select: { name: true, slug: true } },
        },
      });
      session.user.id = token.userId as string;
      // Re-read role/branch from DB every request so demotions/role changes
      // take effect immediately instead of lasting until the JWT expires.
      session.user.role = (user?.role ?? token.role) as string;
      session.user.branchId = (user?.branchId ?? token.branchId) as string | null;
      session.user.branchName = (user?.branch?.name ?? token.branchName) as string | null;
      session.user.branchSlug = (user?.branch?.slug ?? token.branchSlug) as string | null;
      session.user.activeBranchId = (user?.activeBranchId || token.activeBranchId) as string | null;
      session.user.isActive = user?.isActive ?? false;
      return session;
    },
  },
});
