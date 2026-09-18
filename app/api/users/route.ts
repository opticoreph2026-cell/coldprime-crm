import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/branch";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await requireRole(["HEAD_ADMIN", "BRANCH_ADMIN"]);

    const where: any = {};
    if (session.user.role === "BRANCH_ADMIN") {
      where.branchId = session.user.branchId;
    }

    const users = await prisma.user.findMany({
      where,
      include: { branch: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });

    const safe = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      branch: u.branch,
      createdAt: u.createdAt,
    }));

    return NextResponse.json({ data: safe });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(["HEAD_ADMIN", "BRANCH_ADMIN"]);
    const body = await request.json();
    const { email, name, password, role, branchId } = body;

    if (!email || !name || !password) {
      return NextResponse.json({ error: "Email, name, and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // BRANCH_ADMIN can only create STAFF users in their own branch
    const userRole = session.user.role === "HEAD_ADMIN" ? (role || "STAFF") : "STAFF";
    const userBranchId = session.user.role === "HEAD_ADMIN"
      ? (branchId || session.user.branchId)
      : session.user.branchId;

    if (!userBranchId) {
      return NextResponse.json({ error: "Branch is required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.trim(),
        name: name.trim(),
        password: passwordHash,
        role: userRole,
        branchId: userBranchId,
      },
      include: { branch: { select: { id: true, name: true, slug: true } } },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branch: user.branch,
      createdAt: user.createdAt,
    }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
