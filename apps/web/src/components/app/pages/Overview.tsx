import {
  Avatar,
  Badge,
  Button,
  Icon,
  PageHeader,
  Panel,
  StatCard,
} from "@event-management/ui"

import { bookings } from "../data"
import type { NavKey } from "../types"

export function Overview({
  firstName,
  onNavigate,
}: {
  firstName: string
  onNavigate: (key: NavKey) => void
}) {
  return (
    <div className="content-stack">
      <PageHeader
        className="welcome-row"
        eyebrow="Monday, June 16"
        title={`Good morning, ${firstName}`}
        description="Here’s what’s happening across Clemora this week."
        actions={
          <div className="welcome-actions">
            <Button
              variant="secondary"
              icon="calendar"
              onClick={() => onNavigate("Calendar")}
            >
              View calendar
            </Button>
            <Button
              icon="clipboard"
              onClick={() => onNavigate("Bookings")}
            >
              New booking
            </Button>
          </div>
        }
      />

      <div className="stats-grid">
        <StatCard
          label="Events this week"
          value="12"
          change="+8.2%"
          detail="vs last week"
        />
        <StatCard
          label="Confirmed revenue"
          value="$84.6k"
          change="+12.4%"
          detail="this month"
        />
        <StatCard
          label="Pending actions"
          value="7"
          detail="3 need attention today"
          tone="attention"
        />
        <StatCard
          label="Guest satisfaction"
          value="4.9"
          change="↑ 0.2"
          detail="from 68 reviews"
        />
      </div>

      <div className="dashboard-grid">
        <Panel
          className="schedule-panel"
          title="Upcoming events"
          description="Next 7 days · 12 scheduled"
          action={
            <button
              className="inline-link"
              onClick={() => onNavigate("Calendar")}
            >
              View calendar <Icon name="arrow" size={15} />
            </button>
          }
        >
          <div className="event-list">
            {bookings.slice(0, 3).map((booking, index) => (
              <button
                className="event-row"
                key={booking.id}
                onClick={() => onNavigate("Bookings")}
              >
                <div className={`event-date date-${index}`}>
                  <strong>{booking.date.split(" ")[1].replace(",", "")}</strong>
                  <span>JUN</span>
                </div>
                <div className="event-main">
                  <strong>{booking.event}</strong>
                  <span>
                    {booking.venue} · {booking.guests} guests
                  </span>
                </div>
                <div className="event-team">
                  <Avatar size="sm" initials="AS" />
                  <Avatar size="sm" className="second" initials={index === 0 ? "JB" : "MK"} />
                </div>
                <Badge tone={index === 1 ? "warning" : "success"}>
                  {booking.status}
                </Badge>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          className="attention-panel"
          title="Needs attention"
          description="Items requiring a decision"
          action={<Badge tone="danger">3 urgent</Badge>}
        >
          <div className="attention-list">
            <button>
              <span className="attention-icon danger">
                <Icon name="alert" />
              </span>
              <span>
                <strong>New booking request</strong>
                <small>Arc & Co. Product Launch needs review</small>
              </span>
              <Icon name="chevron" />
            </button>
            <button>
              <span className="attention-icon warning">
                <Icon name="box" />
              </span>
              <span>
                <strong>Customer record incomplete</strong>
                <small>Mei Harlow has no contact phone number</small>
              </span>
              <Icon name="chevron" />
            </button>
            <button>
              <span className="attention-icon info">
                <Icon name="clipboard" />
              </span>
              <span>
                <strong>Quotation expiring</strong>
                <small>Harlow Birthday · expires tomorrow</small>
              </span>
              <Icon name="chevron" />
            </button>
          </div>
        </Panel>
      </div>

      <div className="dashboard-grid lower">
        <Panel
          title="Booking activity"
          description="Confirmed bookings · Last 6 months"
          action={
            <select>
              <option>Last 6 months</option>
              <option>Last 12 months</option>
            </select>
          }
        >
          <div className="chart">
            {[42, 54, 47, 70, 62, 86, 68, 78, 91, 82, 96, 88].map(
              (height, index) => (
                <span key={index} style={{ height: `${height}%` }}></span>
              ),
            )}
          </div>
          <div className="chart-labels">
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
          </div>
        </Panel>
        <Panel className="ai-card">
          <div className="ai-card-head">
            <span className="ai-icon">
              <Icon name="users" />
            </span>
            <Badge tone="info">New customer</Badge>
          </div>
          <div className="panel-title">Recent customer activity</div>
          <p>
            Mei Harlow submitted a Garden Social booking request for August 10.
          </p>
          <div className="suggestion-person">
            <Avatar initials="MH" />
            <span>
              <strong>Mei Harlow</strong>
              <small>1 request · 60 guests · Under review</small>
            </span>
            <Badge tone="warning">New</Badge>
          </div>
          <div className="reason">
            Preferred date: August 10, 2025 · Harlow Residence
          </div>
          <div className="row-actions">
            <Button variant="secondary">View customer</Button>
            <Button onClick={() => onNavigate("Bookings")}>Review booking</Button>
          </div>
        </Panel>
      </div>
    </div>
  )
}

