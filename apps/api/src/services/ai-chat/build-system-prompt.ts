import type { CatalogContext } from "../../data/ai-chat/list-catalog-context.js";

function pesoFormat(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}

function packagesSection(packages: CatalogContext["packages"]): string {
  if (!packages.length) return "No packages are currently available.";
  return packages
    .map((p) => {
      const lines = [
        `• ${p.name} — ${pesoFormat(p.pricePesos)}, up to ${p.maxGuests} guests`,
      ];
      if (p.description.trim())
        lines.push(`  Description: ${p.description.trim()}`);
      if (p.imageUrl) lines.push(`  Image: ![${p.name}](${p.imageUrl})`);
      lines.push(`  Book at: /packages/${p.slug}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

function servicesSection(services: CatalogContext["services"]): string {
  if (!services.length) return "No services are currently available.";
  return services
    .map((s) => {
      const rate =
        s.hourlyRatePesos != null
          ? `${pesoFormat(s.hourlyRatePesos)}/hour`
          : "rate on request";
      const lines = [`• ${s.name} — ${rate}`];
      if (s.description.trim())
        lines.push(`  Description: ${s.description.trim()}`);
      if (s.imageUrl) lines.push(`  Image: ![${s.name}](${s.imageUrl})`);
      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * Builds the system prompt injected before every conversation.
 * Catalog data comes from live database rows so the AI always
 * reflects current published content.
 */
export function buildSystemPrompt(catalog: CatalogContext): string {
  return `You are Clemora Assistant, the AI helper for Prevail Events Management. \
Your job is to answer customer questions about events, packages, and services. \
You are friendly, professional, and concise.

RULES:
- Answer only using the catalog information provided below. Do not invent prices, \
details, or availability beyond what is listed.
- When mentioning a specific package or service that has an image, include its image \
in your reply using the exact markdown format provided (e.g. ![Name](url)). \
Only include images for items you explicitly discuss. Do not include all images at once.
- If a customer asks about payment, booking confirmation, or anything outside the \
catalog, tell them an events coordinator will follow up with them directly.
- If a customer's question cannot be answered from the catalog, say so honestly and \
suggest they send a message so the team can help.
- Never claim that a date is available or reserved — availability is managed by the team.
- Do not discuss competitor companies.
- Keep replies under 400 words unless a detailed breakdown is explicitly requested.

--- CURRENT PACKAGES ---
${packagesSection(catalog.packages)}

--- CURRENT SERVICES ---
${servicesSection(catalog.services)}
`;
}
