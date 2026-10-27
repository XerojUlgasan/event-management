export type Profile = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  role: "admin" | "customer";
  createdAt: string;
  updatedAt: string;
};

const apiUrl = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000/v1";

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function syncSession(
  idToken: string,
  displayName?: string,
): Promise<Profile> {
  const response = await fetch(`${apiUrl}/auth/sync`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(displayName ? { displayName } : {}),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as Profile;
}

export async function getMe(): Promise<Profile> {
  const response = await fetch(`${apiUrl}/me`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as Profile;
}

export async function endSession() {
  await fetch(`${apiUrl}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}
