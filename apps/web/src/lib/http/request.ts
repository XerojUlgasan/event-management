import { env } from "../env/env";

const configuredApiUrl = env.PUBLIC_API_URL;

export function apiBase() {
  const trimmed = configuredApiUrl.replace(/\/$/, "");
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  if (typeof window === "undefined") return trimmed;
  return new URL(
    trimmed.replace(/^\//, ""),
    `${window.location.origin}/`,
  ).href.replace(/\/$/, "");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  body?: unknown,
  idToken?: string,
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    credentials: "include",
    headers: {
      ...(body !== undefined && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    ...(body !== undefined
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  if (!response.ok) {
    // A 401 on a data request may mean the cookie expired. Authentication
    // endpoints also use 401 for bad credentials, so they are excluded.
    if (
      response.status === 401 &&
      !path.startsWith("/auth/") &&
      path !== "/me" &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(new Event("clemora:session-check"));
    }
    const result = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      code?: string;
      error?:
        | string
        | { issues?: { path?: (string | number)[]; message?: string }[] };
    };
    throw new ApiError(
      typeof result.error === "string"
        ? result.error
        : typeof result.error === "object" && result.error?.issues?.length
          ? result.error.issues
              .map(
                (issue) =>
                  `${issue.path?.join(".") || "Field"}: ${issue.message || "invalid value"}`,
              )
              .join("; ")
          : "Please check the form and try again.",
      response.status,
      result.code,
    );
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
