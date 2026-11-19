import {
  Badge,
  Button,
  Icon,
  PageHeader,
  Panel,
  SearchField,
  StatCard,
  useNotifications,
} from "@event-management/ui";

import type { NavKey } from "../../../app/navigation-types";

export function GenericPage({ page }: { page: NavKey }) {
  const { notify } = useNotifications();

  const unavailable = () =>
    notify("Demo only: this action is unavailable.", "info");

  const content: Record<
    string,
    {
      intro: string;
      cards: [string, string, string][];
    }
  > = {
    Calendar: {
      intro: "Review events and preparation across one shared schedule.",
      cards: [
        ["This week", "12 events", "2 scheduling conflicts"],
        ["Upcoming", "4 events", "Scheduled this week"],
        ["Resources reserved", "74%", "8 items need review"],
      ],
    },
    Packages: {
      intro:
        "Create, price, publish, and archive catering experiences and menu options.",
      cards: [
        ["Published", "8", "3 featured packages"],
        ["Drafts", "3", "1 awaiting review"],
        ["Menu items", "126", "14 seasonal"],
      ],
    },
    Inventory: {
      intro:
        "Track equipment, consumables, dispatches, returns, and event allocation.",
      cards: [
        ["Available items", "1,284", "82% of inventory"],
        ["Reserved", "248", "Across 9 events"],
        ["Low stock", "7", "3 require action"],
      ],
    },
    Reports: {
      intro: "Understand bookings, event performance, resources, and feedback.",
      cards: [
        ["Event completion", "96%", "Last 90 days"],
        ["Avg. guest rating", "4.9", "From 68 reviews"],
        ["Resource utilization", "74%", "Up 6% this quarter"],
      ],
    },
    Administration: {
      intro:
        "Manage access, knowledge, security controls, conversations, and audit activity.",
      cards: [
        ["Active users", "86", "5 roles configured"],
        ["Conversations", "1,248", "Customer messages"],
        ["Audit events", "3,904", "No critical alerts"],
      ],
    },
  };
  const info = content[page] || content.Calendar;
  const adminRows =
    page === "Administration"
      ? [
          "User & role management",
          "Resources",
          "Conversation monitoring",
          "Security & data access",
          "Audit logs",
          "System configuration",
        ]
      : page === "Inventory"
        ? [
            "Ivory linen napkins",
            "Chafing dish sets",
            "Service carts",
            "Glassware — stemmed",
            "Portable warming cabinets",
          ]
        : [
            "Mendoza–Reyes Wedding",
            "Northstar Annual Dinner",
            "Harlow Garden Birthday",
            "Arc & Co. Product Launch",
          ];

  return (
    <div className="content-stack">
      <PageHeader
        title={page}
        description={info.intro}
        actions={
          <Button
            icon={page === "Reports" ? "chart" : "clipboard"}
            onClick={unavailable}
          >
            {page === "Reports"
              ? "Export report"
              : `Add ${
                  page === "Inventory"
                    ? "item"
                    : page === "Packages"
                      ? "package"
                      : "new"
                }`}
          </Button>
        }
      />
      <div className="stats-grid three">
        {info.cards.map((card) => (
          <StatCard
            key={card[0]}
            label={card[0]}
            value={card[1]}
            detail={card[2]}
          />
        ))}
      </div>
      <Panel
        title={
          page === "Administration"
            ? "Administration areas"
            : page === "Reports"
              ? "Recent reports"
              : `${page} overview`
        }
        description="Connected records and current status"
        action={<SearchField compact placeholder="Search..." />}
      >
        <div className="management-list">
          {adminRows.map((item, index) => (
            <Button variant="plain" key={item} onClick={unavailable}>
              <span className="management-icon">
                <Icon
                  name={
                    page === "Administration"
                      ? "settings"
                      : page === "Inventory"
                        ? "box"
                        : "calendar"
                  }
                />
              </span>
              <span>
                <strong>{item}</strong>
                <small>
                  {page === "Administration"
                    ? [
                        "86 users · 5 roles",
                        "124 articles · Updated today",
                        "18 active · 3 flagged",
                        "Permissions reviewed Jun 12",
                        "Marin Alvarez · 8 min ago",
                        "Business-wide settings",
                      ][index]
                    : page === "Inventory"
                      ? [
                          "36 available · Low stock",
                          "42 available · 8 reserved",
                          "11 available · 1 damaged",
                          "320 available · 120 reserved",
                          "8 available · 4 dispatched",
                        ][index]
                      : `Updated ${index + 1} hour${index ? "s" : ""} ago`}
                </small>
              </span>
              {page === "Inventory" && (
                <Badge
                  tone={
                    index === 0 ? "danger" : index === 2 ? "warning" : "success"
                  }
                >
                  {index === 0
                    ? "Low stock"
                    : index === 2
                      ? "Damaged item"
                      : "Available"}
                </Badge>
              )}
              <Icon name="chevron" />
            </Button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
