import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const statuses = await prisma.statusDefinition.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(statuses);
  } catch (error) {
    console.error("Error fetching status definitions:", error);
    return NextResponse.json(
      { error: "Failed to fetch status definitions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    const status = await prisma.statusDefinition.create({
      data: {
        name,
        type,
        isActive: true,
      },
    });

    return NextResponse.json(status, { status: 201 });
  } catch (error) {
    console.error("Error creating status definition:", error);
    return NextResponse.json(
      { error: "Failed to create status definition" },
      { status: 500 }
    );
  }
}