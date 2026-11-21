import type { Notification } from "@event-management/contracts/notifications";

// The first page seeds the session; pagination only records seen rows.
// Notifications are not deleted or filtered by read state, so new inserts do
// not reveal older history at the head of the feed.
export function createArrivalTracker() {
  const seen = new Set<string>();
  let initialized = false;

  return {
    observe(
      rows: Notification[],
      firstPage: boolean,
    ): Notification | undefined {
      let arrival: Notification | undefined;

      if (firstPage && initialized) {
        arrival = rows.find((row) => !row.readAt && !seen.has(row.id));
      }

      for (const row of rows) seen.add(row.id);

      if (firstPage && !initialized) {
        initialized = true;
      }

      return arrival;
    },
  };
}
