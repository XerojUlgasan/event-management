export type JobRetryPolicies = Readonly<Record<string, readonly number[]>>;

export type QueueJob = {
  id: string;
  type: string;
  payload: unknown;
  dedupe_key: string | null;
  attempts: number;
  lease_token: string;
};
