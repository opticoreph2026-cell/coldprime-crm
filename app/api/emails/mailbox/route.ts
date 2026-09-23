import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/branch";
import { listMail, getMailDetail, getMailByLogId } from "@/lib/mailbox";

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    try {
      await requireAuth();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") === "sent" ? "sent" : "inbox";

    const logId = searchParams.get("logId");
    if (logId) {
      const detail = await getMailByLogId(logId);
      return NextResponse.json({ data: detail });
    }

    const uid = searchParams.get("uid");
    if (uid) {
      const detail = await getMailDetail({ folder, uid: parseInt(uid, 10) });
      return NextResponse.json({ data: detail });
    }

    const days = parseInt(searchParams.get("days") || "30", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const messages = await listMail({ folder, days, limit });
    return NextResponse.json({ data: messages, folder });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Mailbox request failed";
    console.error("Mailbox error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
