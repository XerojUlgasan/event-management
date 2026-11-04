// Mockup data for staff workspace UI preview.
// Replace with real API calls when the events backend is available.

export type EventStatus = "tentative" | "confirmed" | "cancelled" | "rescheduled"
export type AvailabilityResponse = "available" | "unavailable" | null
export type TeamStatus = "pending" | "published"
export type ChecklistStatus = "todo" | "done" | "blocked"

export type StaffEvent = {
  id: string
  title: string
  date: string
  time: string
  location: string
  deadline: string
  status: EventStatus
  myResponse: AvailabilityResponse
  teamStatus: TeamStatus
  /** Only present after team is published */
  teamResult?: "selected" | "not-selected"
  coordinator?: string
  teamCount?: number
  /** Optional brief event description shown in the expandable details panel */
  description?: string
}

export type ChecklistItem = {
  id: string
  stage: string
  activity: string
  plannedTime?: string
  actualTime?: string
  status: ChecklistStatus
  blockerNote?: string
  notes?: string
  photoCount?: number
}

export const mockEvents: StaffEvent[] = [
  {
    id: "EVT-001",
    title: "Mendoza–Reyes Wedding",
    date: "Sat, Jun 22, 2025",
    time: "7:00 AM – 11:00 PM",
    location: "The Glass Garden, Quezon City",
    deadline: "Jun 14, 2025",
    status: "confirmed",
    myResponse: null,
    teamStatus: "pending",
    description: "Full-day garden wedding reception for 180 guests. Includes cocktail hour, sit-down dinner, and late-night dancing. Formal attire required for all staff.",
  },
  {
    id: "EVT-002",
    title: "Northstar Annual Dinner",
    date: "Mon, Jun 24, 2025",
    time: "4:00 PM – 10:00 PM",
    location: "Orchid Hall, BGC",
    deadline: "Jun 16, 2025",
    status: "tentative",
    myResponse: null,
    teamStatus: "pending",
    description: "Corporate gala dinner for Northstar Technologies. Approximately 220 attendees. Includes awards ceremony and keynote between courses.",
  },
  {
    id: "EVT-003",
    title: "Harlow Garden Birthday",
    date: "Fri, Jun 27, 2025",
    time: "3:00 PM – 9:00 PM",
    location: "Harlow Residence, Antipolo",
    deadline: "Jun 19, 2025",
    status: "confirmed",
    myResponse: "available",
    teamStatus: "published",
    teamResult: "selected",
    coordinator: "Amina Santos",
    teamCount: 8,
    description: "Intimate birthday celebration for 50 guests at a private residence. Garden setup with al fresco dining. Setup starts at 1:00 PM.",
  },
  {
    id: "EVT-004",
    title: "Arc & Co. Product Launch",
    date: "Sun, Jun 29, 2025",
    time: "2:00 PM – 7:00 PM",
    location: "Foundry Loft, Makati",
    deadline: "Jun 20, 2025",
    status: "tentative",
    myResponse: "unavailable",
    teamStatus: "pending",
    description: "Brand product launch event with press and industry guests. Cocktail-style standing reception for 120 attendees. AV and presentation setup required.",
  },
]

export const mockChecklist: ChecklistItem[] = [
  // Preparation
  {
    id: "ck-001",
    stage: "Preparation & packing",
    activity: "Review the event brief",
    plannedTime: "6:00 AM",
    status: "done",
    actualTime: "5:55 AM",
    notes: "Confirmed 180 pax, dietary needs noted for 12 guests.",
  },
  {
    id: "ck-002",
    stage: "Preparation & packing",
    activity: "Check team attendance",
    plannedTime: "6:15 AM",
    status: "done",
    actualTime: "6:10 AM",
  },
  {
    id: "ck-003",
    stage: "Preparation & packing",
    activity: "Brief team responsibilities",
    plannedTime: "6:20 AM",
    status: "done",
    actualTime: "6:22 AM",
  },
  {
    id: "ck-004",
    stage: "Preparation & packing",
    activity: "Confirm supplies packed",
    plannedTime: "6:30 AM",
    status: "blocked",
    blockerNote: "Missing 2 folding tables — coordinating with supplier.",
  },
  {
    id: "ck-005",
    stage: "Preparation & packing",
    activity: "Departure check",
    plannedTime: "6:45 AM",
    status: "todo",
  },
  // Travel & arrival
  {
    id: "ck-006",
    stage: "Travel & arrival",
    activity: "Record departure",
    plannedTime: "7:00 AM",
    status: "todo",
  },
  {
    id: "ck-007",
    stage: "Travel & arrival",
    activity: "Record arrival",
    status: "todo",
  },
  {
    id: "ck-008",
    stage: "Travel & arrival",
    activity: "Check setup area",
    status: "todo",
  },
  // Venue setup
  {
    id: "ck-009",
    stage: "Venue setup",
    activity: "Arrange tables and chairs",
    plannedTime: "8:30 AM",
    status: "todo",
  },
  {
    id: "ck-010",
    stage: "Venue setup",
    activity: "Place linens and decorations",
    plannedTime: "9:00 AM",
    status: "todo",
  },
  {
    id: "ck-011",
    stage: "Venue setup",
    activity: "Prepare service areas",
    plannedTime: "9:30 AM",
    status: "todo",
  },
  {
    id: "ck-012",
    stage: "Venue setup",
    activity: "Clear walkways and setup waste",
    plannedTime: "10:30 AM",
    status: "todo",
  },
  // Final readiness
  {
    id: "ck-013",
    stage: "Final readiness",
    activity: "Check setup against approved plan",
    plannedTime: "11:00 AM",
    status: "todo",
  },
  {
    id: "ck-014",
    stage: "Final readiness",
    activity: "Confirm cleanliness and staff readiness",
    plannedTime: "11:30 AM",
    status: "todo",
  },
]
