import { serviceError } from "../../utils/service-result.js";

export const error = (message: string, status: 400 | 404 | 409) =>
  serviceError(message, status);
