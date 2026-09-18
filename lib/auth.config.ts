import type { JWT } from "next-auth";
import type { Session } from "next-auth";

export default {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user: any }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.branchId = user.branchId;
        token.branchName = user.branchName;
        token.branchSlug = user.branchSlug;
        token.activeBranchId = user.branchId;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      (session.user as any).id = token.userId;
      (session.user as any).role = token.role;
      (session.user as any).branchId = token.branchId;
      (session.user as any).branchName = token.branchName;
      (session.user as any).branchSlug = token.branchSlug;
      (session.user as any).activeBranchId = token.activeBranchId;
      return session;
    },
  },
};
