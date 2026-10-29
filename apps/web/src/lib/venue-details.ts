export function venueDetailsFromSelection(venue: { name: string; location: string; description: string }): string {
  const prefix = `${venue.name} — ${venue.location}. `
  const remaining = 4000 - prefix.length
  if (venue.description.length <= remaining) return prefix + venue.description
  return prefix + venue.description.slice(0, remaining - 1).trimEnd() + "…"
}
