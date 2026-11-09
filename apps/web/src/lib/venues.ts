import { useEffect, useState } from "react";
import { getAdminVenues, getVenues, type Venue } from "./api";

export type VenueOption = { value: string; label: string };

export function venueOptionLabel(venue: Pick<Venue, "name" | "location">) {
  const name = venue.name.trim();
  const location = venue.location.trim();
  return location ? `${name} — ${location}` : name;
}

const toOption = (venue: Venue): VenueOption => ({
  value: venueOptionLabel(venue),
  label: venueOptionLabel(venue),
});

const usable = (venue: Venue) => !venue.archivedAt && venue.name.trim().length > 0;

export async function listVenueOptions(admin = false): Promise<VenueOption[]> {
  const venues: Venue[] = [];
  if (admin) {
    venues.push(...(await getAdminVenues()).venues);
  } else {
    let offset: number | undefined = 0;
    while (offset !== undefined) {
      const page = await getVenues({ limit: 15, offset });
      venues.push(...page.venues);
      offset = page.nextOffset ?? undefined;
    }
  }
  const unique = new Map<string, VenueOption>();
  for (const venue of venues.filter(usable)) {
    const option = toOption(venue);
    unique.set(option.value, option);
  }
  return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function useVenueOptions(admin = false) {
  const [options, setOptions] = useState<VenueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listVenueOptions(admin)
      .then((next) => {
        if (active) setOptions(next);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Unable to load venues.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [admin]);

  return { options, loading, error };
}
