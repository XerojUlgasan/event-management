import { config } from "../../env";

export function apiBase() {
  const base = config.PUBLIC_API_URL;

  if (/^https?:\/\//.test(base)) return base;

  if (typeof window === "undefined") return base;

  return new URL(
    base.replace(/^\//, ""),
    `${window.location.origin}/`,
  ).href.replace(/\/$/, "");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public resourceId?: string,
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
      resourceId?: string;
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
          : response.status === 400 || response.status === 422
            ? "Please check the form and try again."
            : "Unable to complete the request. Please try again.",
      response.status,
      result.code,
      typeof result.resourceId === "string" ? result.resourceId : undefined,
    );
  }

  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
