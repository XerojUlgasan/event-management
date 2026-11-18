import { z } from "zod";
import type { Kysely } from "kysely";
import type { CatalogPackage } from "@event-management/contracts/catalog";
import type { DB } from "../../db/types.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { getBookingPackageService } from "../booking-requests/get-booking-package.js";

export const getMyProposalInputSchema = z.strictObject({});

type Proposal = Pick<
  CatalogPackage,
  | "packageType"
  | "name"
  | "description"
  | "maxGuests"
  | "price"
  | "updatedAt"
  | "sections"
>;

export type MyProposalResult =
  | { status: "found"; proposal: Proposal }
  | {
      status: "no_linked_request" | "proposal_not_prepared";
      proposal: null;
    };

export class ProposalAccessDenied extends Error {
  constructor() {
    super("Proposal is unavailable");
  }
}

export async function getMyProposalService({
  db,
  customerId,
  conversationId,
  abortSignal,
}: {
  db: Kysely<DB>;
  customerId: string;
  conversationId: string;
  abortSignal?: AbortSignal;
}): Promise<MyProposalResult> {
  abortSignal?.throwIfAborted();
  const conversation = await findConversationData(db, conversationId);
  if (
    !conversation ||
    conversation.customer_id !== customerId ||
    conversation.guest_identity_id
  )
    throw new ProposalAccessDenied();
  if (!conversation.booking_request_id)
    return { status: "no_linked_request", proposal: null };

  // The domain service rechecks request ownership and resolves custom proposals
  // before falling back to the original catalog choice in a consistent snapshot.
  const result = await getBookingPackageService(
    db,
    conversation.booking_request_id,
    customerId,
  );
  abortSignal?.throwIfAborted();
  if (!result) throw new ProposalAccessDenied();
  if (!result.package)
    return { status: "proposal_not_prepared", proposal: null };
  const pkg = result.package;
  return {
    status: "found",
    proposal: {
      packageType: pkg.packageType,
      name: pkg.name,
      description: pkg.description,
      maxGuests: pkg.maxGuests,
      price: pkg.price,
      updatedAt: pkg.updatedAt,
      // Preserve the complete sections/widgets, including each original Markdown
      // string. Do not summarize, flatten, truncate, or recursively expand them.
      sections: pkg.sections,
    },
  };
}
