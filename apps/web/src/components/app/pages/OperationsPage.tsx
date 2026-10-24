import { useState } from "react"
import { Avatar, Badge, Button, Icon, Panel } from "@event-management/ui"

export function OperationsPage() {
  const [checked, setChecked] = useState([true, true, false, false])
  return (
    <div className="content-stack">
      <div className="breadcrumb">
        Operations <span>›</span> Northstar Annual Dinner
      </div>
      <div className="ops-title">
        <div>
          <div className="title-line">
            <div className="page-title">Northstar Annual Dinner</div>
            <Badge tone="info">In preparation</Badge>
          </div>
          <p>Tuesday, June 24 · Orchid Hall · 240 guests</p>
        </div>
        <div>
          <Button variant="secondary">Generate report</Button>
          <Button icon="alert">Report incident</Button>
        </div>
      </div>
      <div className="ops-alert">
        <Icon name="alert" />
        <div>
          <strong>Timeline risk detected</strong>
          <span>
            Floral installation is 25 minutes behind plan and may affect table
            setup.
          </span>
        </div>
        <button>Review timeline</button>
      </div>
      <div className="ops-layout">
        <div className="ops-main">
          <Panel
            className="progress-panel"
            title="Preparation progress"
            description="17 of 24 tasks complete"
            action={<strong>71%</strong>}
          >
            <div className="progress-track">
              <span></span>
            </div>
            <div className="phase-row">
              <span className="complete">
                <Icon name="check" />
                Planning
              </span>
              <i></i>
              <span className="complete">
                <Icon name="check" />
                Procurement
              </span>
              <i></i>
              <span className="active">Preparation</span>
              <i></i>
              <span>Event day</span>
            </div>
          </Panel>
          <Panel
            title="Event timeline"
            description="Scheduled versus actual activity"
            action={
              <div className="legend">
                <span>
                  <i className="on-time"></i>On time
                </span>
                <span>
                  <i className="delayed"></i>Delayed
                </span>
              </div>
            }
          >
            <div className="timeline-list">
              {[
                ["8:00 AM", "Kitchen production begins", "8:03 AM", "On time"],
                ["12:30 PM", "Equipment dispatch", "12:42 PM", "12 min late"],
                ["2:00 PM", "Venue access & unloading", "2:01 PM", "On time"],
                ["2:30 PM", "Floral installation", "2:55 PM", "25 min late"],
                ["3:30 PM", "Team briefing", "—", "Upcoming"],
              ].map((row, index) => (
                <div
                  className={`timeline-row ${index === 3 ? "delayed" : ""}`}
                  key={row[1]}
                >
                  <span>{row[0]}</span>
                  <i>
                    <b></b>
                  </i>
                  <div>
                    <strong>{row[1]}</strong>
                    <small>Actual: {row[2]}</small>
                  </div>
                  <Badge
                    tone={
                      index === 3
                        ? "danger"
                        : index === 4
                          ? "neutral"
                          : "success"
                    }
                  >
                    {row[3]}
                  </Badge>
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="Priority tasks"
            description="Items due before team briefing"
            action={<button className="inline-link">View all 24 tasks</button>}
          >
            <div className="task-list">
              {[
                "Confirm table linen placement",
                "Test AV and presentation microphones",
                "Complete dietary meal labels",
                "Brief service captains on table zones",
              ].map((task, index) => (
                <label className="task-row" key={task}>
                  <input
                    type="checkbox"
                    checked={checked[index]}
                    onChange={() =>
                      setChecked(
                        checked.map((item, i) => (i === index ? !item : item)),
                      )
                    }
                  />
                  <span>
                    <strong>{task}</strong>
                    <small>
                      {index % 2
                        ? "Assigned to Devon Price"
                        : "Assigned to Venue team"}
                    </small>
                  </span>
                  <Badge tone={index === 2 ? "danger" : "neutral"}>
                    {index === 2
                      ? "Overdue"
                      : index < 2
                        ? "Complete"
                        : "3:15 PM"}
                  </Badge>
                </label>
              ))}
            </div>
          </Panel>
        </div>
        <div className="ops-side">
          <Panel>
            <div className="panel-title">Event lead</div>
            <div className="lead-person">
              <Avatar size="lg" initials="AS" />
              <span>
                <strong>Amina Santos</strong>
                <small>Lead coordinator</small>
              </span>
              <button>•••</button>
            </div>
            <div className="contact-row">
              <button>Message</button>
              <button>Call</button>
            </div>
          </Panel>
          <Panel
            title="Team readiness"
            action={<strong>18 / 20</strong>}
          >
            <div className="readiness">
              <div>
                <span>Kitchen</span>
                <strong>6 / 6 ready</strong>
              </div>
              <div>
                <span>Service</span>
                <strong>8 / 9 ready</strong>
              </div>
              <div>
                <span>Logistics</span>
                <strong>4 / 5 ready</strong>
              </div>
            </div>
            <Button variant="secondary" className="full-button">
              View team assignments
            </Button>
          </Panel>
          <Panel
            className="incident-card"
            title="Incidents"
            action={<Badge tone="warning">1 open</Badge>}
          >
            <div>
              <span className="attention-icon warning">
                <Icon name="alert" />
              </span>
              <span>
                <strong>Service cart wheel damaged</strong>
                <small>Reported 1:12 PM · Replacement dispatched</small>
              </span>
            </div>
            <button className="inline-link">
              Open incident record <Icon name="arrow" size={14} />
            </button>
          </Panel>
          <Panel>
            <div className="panel-title">Resources</div>
            <div className="resource-list">
              <span>
                <Icon name="box" />
                Equipment<strong>32 / 34 ready</strong>
              </span>
              <span>
                <Icon name="box" />
                Consumables<strong>100% packed</strong>
              </span>
              <span>
                <Icon name="users" />
                Vehicles<strong>2 assigned</strong>
              </span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

