export type Profile = {
  id: string;
  firebaseUid: string | null;
  hasPassword: boolean;
  email: string;
  displayName: string | null;
  role: "admin" | "customer";
  createdAt: string;
  updatedAt: string;
};

const apiUrl = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  body?: unknown,
  idToken?: string,
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      success?: boolean;
    };
    throw new ApiError(
      typeof result.error === "string"
        ? result.error
        : "Please check the form and try again.",
      response.status,
    );
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

export const syncSession = (idToken: string) =>
  request<Profile>("/auth/sync", {}, idToken);
export const getMe = () => request<Profile>("/me");
export const endSession = () => request<void>("/auth/logout", {});
export const login = (email: string, password: string) =>
  request<Profile>("/auth/login", { email, password });
export const register = (
  displayName: string,
  email: string,
  password: string,
) => request<Profile>("/auth/register", { displayName, email, password });
export const linkFirebase = (idToken: string, currentPassword: string) =>
  request<Profile>("/auth/link/firebase", { currentPassword }, idToken);
export const addPassword = (idToken: string, password: string) =>
  request<Profile>("/auth/password", { password }, idToken);
