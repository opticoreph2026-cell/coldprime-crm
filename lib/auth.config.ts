export default {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }: { token: Record<string, any>; user: Record<string, any> }) {
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
    async session({ session, token }: { session: Record<string, any>; token: Record<string, any> }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.branchId = token.branchId;
      session.user.branchName = token.branchName;
      session.user.branchSlug = token.branchSlug;
      session.user.activeBranchId = token.activeBranchId;
      return session;
    },
  },
};
