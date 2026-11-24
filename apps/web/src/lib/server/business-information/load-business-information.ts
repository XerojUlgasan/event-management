import {
  businessInformationResponseSchema,
  type BusinessInformationResponse,
} from "@event-management/contracts/business-information";
import { serverApiUrl } from "../http/api-url";

export async function loadBusinessInformation(): Promise<BusinessInformationResponse> {
  const response = await fetch(`${serverApiUrl()}/business-information`, {
    cache: "no-store",
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok)
    throw new Error(`Business information request failed (${response.status})`);

  const json: unknown = await response.json();

  return businessInformationResponseSchema.parse(json);
}
