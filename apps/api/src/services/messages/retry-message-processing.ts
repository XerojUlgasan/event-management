import { HTTPException } from "hono/http-exception";
import {
  retryMessageProcessingData,
  RetryMessageProcessingError,
} from "../../data/messages/retry-message-processing.js";
import { messageDto } from "./message-response.js";

export async function retryMessageProcessingService(
  ...args: Parameters<typeof retryMessageProcessingData>
) {
  try {
    return { message: messageDto(await retryMessageProcessingData(...args)) };
  } catch (error) {
    if (error instanceof RetryMessageProcessingError)
      throw new HTTPException(error.status, { message: error.message });

    throw error;
  }
}
