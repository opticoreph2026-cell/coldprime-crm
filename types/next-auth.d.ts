import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      branchId: string | null;
      branchName: string | null;
      branchSlug: string | null;
      activeBranchId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: string;
    branchId: string | null;
    branchName: string | null;
    branchSlug: string | null;
    activeBranchId: string | null;
  }
}
