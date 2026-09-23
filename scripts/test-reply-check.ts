import "dotenv/config";

const raw = process.env.DATABASE_URL!;
const url = new URL(raw);
url.searchParams.delete("sslmode");
process.env.DATABASE_URL = url.toString();

async function main() {
  const { checkReplies } = await import("../lib/reply-check");
  const result = await checkReplies();
  console.log("checked:", result.checked, "repliesFound:", result.repliesFound, "companies:", result.companies);
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
