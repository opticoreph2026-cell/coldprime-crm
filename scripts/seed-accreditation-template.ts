import "dotenv/config";

const raw = process.env.DATABASE_URL!;
const url = new URL(raw);
url.searchParams.delete("sslmode");
process.env.DATABASE_URL = url.toString();

const SUBJECT = "Application for Accreditation as HVAC & IAQ Vendor – Coldprime Enterprises Corporation";

const BODY = `Good day,

I hope this email finds you well. My name is [Your Name], Sales Engineer at Coldprime Enterprises Corporation, an HVAC and Indoor Air Quality contractor with our main office in Makati and a branch office in Cebu.

I'm reaching out to inquire about the possibility of Coldprime being accredited as an HVAC/IAQ vendor or subcontractor for [Company Name]. We specialize in HVAC system design, supply, and installation, along with IAQ compliance solutions for commercial, industrial, and institutional developments.

If you're not the right point of contact for vendor accreditation, I'd greatly appreciate it if you could forward this email to your procurement or purchasing department. Please let us know if there are specific requirements or forms we should complete, and we'll gladly send over our company profile and supporting documents.

Would it also be alright if I gave you a call to briefly discuss this further? Please let me know a convenient time, or feel free to reach me directly at [Phone].

Thank you for your time, and I look forward to hearing from you.

Best regards,
[Your Name]
Sales Engineer, Coldprime Enterprises Corporation
[Phone] | [Email]`;

async function main() {
  const { prisma } = await import("../lib/prisma");

  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  if (branches.length === 0) throw new Error("No branches found");

  for (const branch of branches) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { branchId: branch.id, name: "Vendor Accreditation" },
    });
    if (existing) {
      console.log(`Already exists for ${branch.name}: ${existing.id}`);
      continue;
    }
    const tpl = await prisma.emailTemplate.create({
      data: {
        branchId: branch.id,
        name: "Vendor Accreditation",
        subject: SUBJECT,
        body: BODY,
        category: "HVAC",
      },
    });
    console.log(`Created for ${branch.name}: ${tpl.id}`);
  }

  await prisma.$disconnect();
  console.log("DONE");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
