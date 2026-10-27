import type { NavKey } from "./types"

export const photos = {
  hero: "/images/hero.jpg",
  wedding: "/images/wedding.jpg",
  dinner: "/images/dinner.jpg",
  dessert: "/images/dessert.jpg",
}

export const adminNav: NavKey[] = [
  "Overview",
  "Bookings",
  "Customers",
  "Packages",
]

export const bookings = [
  {
    id: "CLM-2048",
    event: "Mendoza–Reyes Wedding",
    customer: "Elena Mendoza",
    date: "Jun 22, 2025",
    venue: "The Glass Garden",
    guests: 180,
    status: "Confirmed",
    coordinator: "Amina Santos",
  },
  {
    id: "CLM-2051",
    event: "Northstar Annual Dinner",
    customer: "Noah Williams",
    date: "Jun 24, 2025",
    venue: "Orchid Hall",
    guests: 240,
    status: "In preparation",
    coordinator: "Jon Bell",
  },
  {
    id: "CLM-2055",
    event: "Harlow Garden Birthday",
    customer: "Mei Harlow",
    date: "Jun 27, 2025",
    venue: "Harlow Residence",
    guests: 65,
    status: "Awaiting confirmation",
    coordinator: "Amina Santos",
  },
  {
    id: "CLM-2058",
    event: "Arc & Co. Product Launch",
    customer: "Sofia Laurent",
    date: "Jun 29, 2025",
    venue: "Foundry Loft",
    guests: 120,
    status: "Under review",
    coordinator: "Unassigned",
  },
]

export const packages = [
  {
    name: "The Signature Table",
    kind: "Weddings & milestone events",
    price: "From $72 / guest",
    guests: "80–240 guests",
    description:
      "A refined three-course experience with styled buffet service and a dedicated event captain.",
    image: photos.wedding,
    tag: "Most requested",
  },
  {
    name: "Garden Social",
    kind: "Birthdays & intimate gatherings",
    price: "From $48 / guest",
    guests: "30–100 guests",
    description:
      "Seasonal sharing plates, grazing stations, beverages, and relaxed garden-ready service.",
    image: photos.dinner,
    tag: "Flexible menu",
  },
  {
    name: "Executive Dinner",
    kind: "Corporate events",
    price: "From $58 / guest",
    guests: "40–300 guests",
    description:
      "Polished service, thoughtfully plated menus, and efficient coordination for business occasions.",
    image: photos.dessert,
    tag: "Corporate favorite",
  },
]

export type EditablePackage = (typeof packages)[number] & {
  inclusions: string
  status: string
}
