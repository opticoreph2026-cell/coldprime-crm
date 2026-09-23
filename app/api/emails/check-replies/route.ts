import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/branch";
import { checkReplies } from "@/lib/reply-check";

export const maxDuration = 60;

async function handle(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
  if (!isCron) {
    try {
      await requireAuth();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await checkReplies();
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Reply check failed";
    console.error("Reply check error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
