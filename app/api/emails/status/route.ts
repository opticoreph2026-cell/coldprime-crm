// GET /api/emails/status - sender/limit info for the Emails page banners
// (free-mail domain warning, daily cap progress, owner action checklist).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/branch";
import { dailyEmailCap } from "@/lib/email/guard";
import { freeMailWarning } from "@/lib/email/guard";
import { startOfDayPH, todayPH } from "@/lib/dates";

export async function GET() {
  try {
    let session;
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

    const senderEmail = process.env.GMAIL_USER || null;
    const todayStart = startOfDayPH(todayPH());
    const sentToday = await prisma.emailLog.count({
      where: { fromUserId: session.user.id!, status: "SENT", sentAt: { gte: todayStart } },
    });
    const cap = dailyEmailCap();

    return NextResponse.json({
      senderEmail,
      freeMailWarning: freeMailWarning(senderEmail),
      dailyCap: cap,
      sentToday,
      remaining: Math.max(0, cap - sentToday),
    });
  } catch (error) {
    console.error("Error fetching email status:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
