import "dotenv/config";
import nodemailer from "nodemailer";

async function main() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.error("GMAIL_USER / GMAIL_APP_PASSWORD not set in .env");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  await transporter.verify();
  console.log("SMTP OK — Gmail auth verified for", user);
}

main().catch((e) => {
  console.error("SMTP FAILED:", e.message);
  process.exit(1);
});
