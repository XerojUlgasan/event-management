import {
  businessInformationResponseSchema,
  saveBusinessInformationSchema,
  type SaveBusinessInformation,
} from "@event-management/contracts/business-information";
import { request } from "../../http/request";

export async function getAdminBusinessInformation() {
  const result = await request<unknown>("/admin/business-information");

  return businessInformationResponseSchema.parse(result);
}

export async function saveAdminBusinessInformation(body: SaveBusinessInformation) {
  saveBusinessInformationSchema.parse(body);
  const result = await request<unknown>(
    "/admin/business-information",
    body,
    undefined,
    "PUT",
  );

  return businessInformationResponseSchema.parse(result);
}