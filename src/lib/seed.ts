import type { Application, Status } from "./types";

const COMPANIES: [string, string][] = [
  ["STRIPE","US"],["NOTION","US"],["AIRBNB","US"],["FIGMA","US"],["MICROSOFT","US"],
  ["ADOBE","US"],["SALESFORCE","US"],["LINEAR","CA"],["CANVA","AU"],["SPOTIFY","SE"],
  ["DATADOG","US"],["COINBASE","US"],["RIPPLING","US"],["OPENAI","US"],["ATLASSIAN","AU"],
  ["DEEL","NL"],["INSTAGRAM","US"],["YOUTUBE","US"],["AMAZON","US"],["TIKTOK","SG"],
  ["PINTEREST","US"],["DISCORD","US"],["DROPBOX","US"],["SHOPIFY","CA"],["UBER","US"],
  ["AIRTABLE","US"],["GITHUB","US"],["PLAID","US"],
];
const ROLES = [
  "SENIOR PRODUCT DESIGNER","PRODUCT DESIGNER","PRODUCT DESIGNER","SENIOR PRODUCT DESIGNER",
  "UX DESIGNER","SENIOR UX DESIGNER","UX DESIGNER","PRODUCT DESIGNER","PRODUCT DESIGNER","UX DESIGNER",
  "SENIOR PRODUCT DESIGNER","PRODUCT DESIGNER","PRODUCT DESIGNER","PRODUCT DESIGNER",
  "SENIOR PRODUCT DESIGNER","PRODUCT DESIGNER","UX DESIGNER","PRODUCT DESIGNER","UX DESIGNER","PRODUCT DESIGNER",
  "PRODUCT DESIGNER","UX DESIGNER","PRODUCT DESIGNER","SENIOR UX DESIGNER","PRODUCT DESIGNER",
  "PRODUCT DESIGNER","SENIOR PRODUCT DESIGNER","UX DESIGNER",
];
const STATUSES: Status[] = [
  "INTERVIEW","APPLIED","APPLIED","FOLLOW-UP","ASSESSMENT","INTERVIEW","OFFER","SAVED","FOLLOW-UP","INTERVIEW",
  "FOLLOW-UP","APPLIED","WAITING","INTERVIEW","FOLLOW-UP","APPLIED","INTERVIEW","SAVED","ASSESSMENT","APPLIED",
  "FOLLOW-UP","WAITING","SAVED","INTERVIEW","APPLIED","FOLLOW-UP","APPLIED","OFFER",
];

export function buildSeed(): Application[] {
  const now = Date.now();
  return COMPANIES.map(([company, country], i) => {
    const id = `seed-${i}`;
    const created = new Date(now - (28 - i) * 86400000 * 0.7).toISOString();
    const pinned = i === 2 || i === 6 || i === 16; // Airbnb, Salesforce, Instagram
    const status = STATUSES[i];
    return {
      id,
      company,
      country,
      role: ROLES[i],
      status,
      pinned,
      archived: false,
      salary: i % 3 === 0 ? "$160k–$200k" : undefined,
      recruiter: i % 4 === 0 ? "Alex Morgan" : undefined,
      notes: "",
      link: "",
      tags: [],
      stages: [],
      reminders: [],
      docs: [],
      createdAt: created,
      updatedAt: created,
      appliedAt: ["APPLIED","INTERVIEW","FOLLOW-UP","OFFER","REJECTED","ASSESSMENT","WAITING"].includes(status) ? created : undefined,
    } satisfies Application;
  });
}
