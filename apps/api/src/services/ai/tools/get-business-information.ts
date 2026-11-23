import type { BusinessInformation } from "@event-management/contracts/business-information";
import { tool } from "ai";
import { z } from "zod";
import { finishToolCallData } from "../../../data/ai/finish-tool-call.js";
import { startToolCallData } from "../../../data/ai/start-tool-call.js";
import { getBusinessInformationService } from "../../business-information/get-business-information.js";
import type { AssistantToolContext } from "./assistant-tool-context.js";

function publicProfileFields({
  about,
  contact,
  location,
  hours,
}: BusinessInformation) {
  // The stored document also retains fields outside the public footer and editor.
  const fields = {
    name: about.name,
    introduction: about.introduction,
    phone: contact.phone,
    email: contact.email,
    facebook: contact.facebook,
    instagram: contact.instagram,
    address: location.address,
    mapUrl: location.mapUrl,
    serviceAreas: location.serviceAreas,
    openingHours: hours.supportHours,
  };

  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== ""),
  );
}

export function createGetBusinessInformationTool({
  db,
  customerMessageId,
  turnId,
  assertActive,
  onPersistenceFailure,
  consumeResultCharacters,
  canRecord = () => true,
  canExecute = () => true,
}: AssistantToolContext & {
  consumeResultCharacters: (characters: number) => boolean;
}) {
  async function persist<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch {
      onPersistenceFailure();
      throw new Error("Business information tracking is unavailable");
    }
  }

  return tool({
    description:
      "Read AMAC’s current public business profile for its name, introduction, contact details, social links, address, map, service areas, or opening hours. Takes no arguments. Returns the saved details shown in the public footer.",
    inputSchema: z.strictObject({}),
    execute: async (input, { toolCallId, abortSignal }) => {
      if (!canRecord()) {
        onPersistenceFailure();
        throw new Error("The business information call budget was exceeded");
      }

      const call = await persist(
        startToolCallData(db, {
          turnId,
          toolCallId,
          toolName: "getBusinessInformation",
          customerMessageId,
          input,
        }),
      );
      let errorCode = "turn_inactive";

      try {
        if (!canExecute()) {
          errorCode = "call_limit";
          throw new Error("Business information call limit reached");
        }

        await assertActive();
        abortSignal?.throwIfAborted();
        errorCode = "business_information_unavailable";
        const profile = await getBusinessInformationService(db);
        const information = publicProfileFields(profile.information);
        const fields = Object.keys(information);
        const status = fields.length ? "found" : "not_configured";
        const result = { status, information };

        if (!consumeResultCharacters(JSON.stringify(result).length)) {
          errorCode = "business_information_too_large";
          throw new Error(
            "Business information exceeds the remaining turn input budget",
          );
        }

        errorCode = "turn_inactive";
        await assertActive();
        abortSignal?.throwIfAborted();
        await persist(
          finishToolCallData(db, {
            id: call.id,
            status: "succeeded",
            output: { status, fields },
          }),
        );

        return result;
      } catch {
        await persist(
          finishToolCallData(db, {
            id: call.id,
            status: "failed",
            errorCode: abortSignal?.aborted ? "cancelled" : errorCode,
          }),
        );
        throw new Error(
          "Could not verify current business information. The lookup failed.",
        );
      }
    },
  });
}
