import "dotenv/config";
import { sendEmail } from "../lib/email";

async function main() {
  const to = process.env.GMAIL_USER!;
  const result = await sendEmail({
    to,
    subject: "Coldprime CRM — SMTP test",
    body: `<p style="font-family:sans-serif;">✅ Gmail SMTP is working. You can delete this email.</p>
           <p>Sent at ${new Date().toISOString()}</p>`,
    fromName: "Coldprime CRM",
  });
  console.log("SENT OK — messageId:", result.id);
}

main().catch((e) => {
  console.error("SEND FAILED:", e.message);
  process.exit(1);
});
