// Approved email template library (master instructions Phase 3).
// Used by prisma/seed.ts and scripts/seed-email-templates.ts.
export interface ApprovedTemplate {
  name: string;
  subject: string;
  body: string;
  category: string;
}

export const APPROVED_TEMPLATES: ApprovedTemplate[] = [
  {
    name: "GC Accreditation",
    category: "Accreditation",
    subject: "Accreditation partnership with {{companyName}}",
    body: "Good day {{contactName}},\n\nWe would like to request accreditation with {{companyName}} as your HVAC and IAQ solutions partner. Coldprime Enterprises Corporation supplies, installs and maintains HVAC systems for general contractors across the region.\n\nPlease let us know the requirements for your contractor accreditation and we will submit them promptly.\n\nThank you,\n{{senderName}}\n{{senderTitle}}",
  },
  {
    name: "Architect Design Partnership",
    category: "Design Partnership",
    subject: "Design partnership proposal for {{companyName}}",
    body: "Dear {{contactName}},\n\nWe work with architects to size and specify HVAC and indoor air quality systems early in the design phase, so drawings carry through to installation without rework.\n\nMay we schedule a short meeting to walk through our design-assist approach for {{companyName}}?\n\nBest regards,\n{{senderName}}\n{{senderTitle}}",
  },
  {
    name: "Facility Manager Preventive Maintenance",
    category: "Maintenance",
    subject: "Preventive maintenance program for {{companyName}}",
    body: "Hello {{contactName}},\n\nIs your equipment due for preventive maintenance? We offer scheduled PM visits covering filter replacement, coil cleaning, refrigerant checks and performance reporting - to keep {{companyName}} systems running and avoid breakdowns.\n\nWould you like a quote based on your equipment list?\n\nRegards,\n{{senderName}}\n{{senderTitle}}",
  },
  {
    name: "Healthcare IAQ",
    category: "IAQ",
    subject: "Indoor air quality solutions for {{companyName}}",
    body: "Dear {{contactName}},\n\nHospitals and clinics need dependable indoor air quality for patient safety and compliance. We supply HEPA filtration, air purification and monitoring systems designed for healthcare environments.\n\nMay we share how {{companyName}} can improve air quality in critical areas?\n\nSincerely,\n{{senderName}}\n{{senderTitle}}",
  },
  {
    name: "No-response follow-up",
    category: "Follow-Up",
    subject: "Following up - {{companyName}}",
    body: "Hi {{contactName}},\n\nJust following up on my earlier message. If now is not a good time, let me know and I will close the loop.\n\nIf this isn't relevant, just reply and I won't email you again.\n\nThank you,\n{{senderName}}\n{{senderTitle}}",
  },
  {
    name: "Meeting request",
    category: "General",
    subject: "Quick meeting about your HVAC needs",
    body: "Good day {{contactName}},\n\nI would appreciate 20 minutes of your time to understand {{companyName}}'s current HVAC and IAQ needs and how we can help.\n\nAre you available for a brief call or site visit this week?\n\nWarm regards,\n{{senderName}}\n{{senderTitle}}",
  },
];
