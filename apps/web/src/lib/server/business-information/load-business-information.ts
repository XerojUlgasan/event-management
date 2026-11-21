import {
  businessInformationResponseSchema,
  type BusinessInformationResponse,
} from "@event-management/contracts/business-information";
import { env } from "../config/env";

export async function loadBusinessInformation(): Promise<BusinessInformationResponse> {
  const response = await fetch(`${env.SERVER_API_URL}/business-information`, {
    cache: "no-store",
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok)
    throw new Error(`Business information request failed (${response.status})`);

  const json: unknown = await response.json();

  return businessInformationResponseSchema.parse(json);
}
