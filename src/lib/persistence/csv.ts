import type { LeadListItem } from "./types";

function escapeCsv(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const headers = ["Company","Website","Domain","ICP Branch","Investment Offer","Grade","Score","Primary Decision Maker","Primary Role","Primary Email","Primary Email Verification","Primary Phone","Primary WhatsApp","Secondary Decision Maker","Secondary Role","Best Route Type","Best Route Value","Source Platform","Source URL","Last Enriched"];

export function leadsToCsv(items: LeadListItem[]) {
  const rows = items.map((lead) => [lead.companyName,lead.website,lead.domain,lead.investmentBranch,lead.offerSummary,lead.grade,lead.totalScore,lead.primaryContactName,lead.primaryContactRole,lead.primaryEmail,lead.primaryEmailVerification,lead.primaryPhone,lead.primaryWhatsapp,lead.secondaryContactName,lead.secondaryContactRole,lead.bestRouteType,lead.bestRouteValue,lead.sourcePlatform,lead.sourceUrl,lead.lastEnrichedAt]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n")}\r\n`;
}
