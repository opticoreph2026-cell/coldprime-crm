const authConfig = {
  session: { strategy: "jwt" as const },
  pages: {
    signIn: "/login",
  },
};

export default authConfig;
