// Legacy weekly accomplishment endpoint (was: single-period inline PDF).
// Kept for back-compat: redirects to /api/reports/weekly with the current week.
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/branch";
import { currentWeekRange } from "@/lib/dates";

export async function GET(request: Request) {
  try {
    try {
      await requireAuth();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const current = currentWeekRange();
    const url = new URL("/api/reports/weekly", request.url);
    url.searchParams.set("from", searchParams.get("from") || current.from);
    url.searchParams.set("to", searchParams.get("to") || current.to);
    url.searchParams.set("format", "pdf");
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("Error redirecting report:", error);
    return NextResponse.json({ error: "Failed to build report" }, { status: 500 });
  }
}
