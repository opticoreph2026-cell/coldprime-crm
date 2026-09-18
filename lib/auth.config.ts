export default {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
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
      session.user.id = token.userId as string;
      session.user.role = token.role as string;
      session.user.branchId = token.branchId as string | null;
      session.user.branchName = token.branchName as string | null;
      session.user.branchSlug = token.branchSlug as string | null;
      session.user.activeBranchId = token.activeBranchId as string | null;
      return session;
    },
  },
};
