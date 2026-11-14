import { useState } from "react";
import {
  Input,
  Select,
  Badge,
  Button,
  Dialog,
  FormField,
  Icon,
  type IconName,
  PageHeader,
  Panel,
  useNotifications,
  SearchField,
  StatCard,
} from "@event-management/ui";

export function ReportsPage() {
  const { notify } = useNotifications();
  const [period, setPeriod] = useState("Last 6 months");
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="content-stack reports-page">
      <PageHeader
        title="Reports & performance"
        description="Monitor booking health, event delivery, resources and feedback."
        actions={
          <div className="welcome-actions">
            <Select
              className="date-range-select"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option>Last 30 days</option>
              <option>Last 3 months</option>
              <option>Last 6 months</option>
              <option>This year</option>
            </Select>
            <Button icon="chart" onClick={() => setReportOpen(true)}>
              Export report
            </Button>
          </div>
        }
      />

      <div className="report-filter-note">
        <Icon name="calendar" />
        <span>
          Showing business activity from{" "}
          <strong>January 1–June 30, 2025</strong>
        </span>
        <Button
          variant="secondary"
          size="small"
          onClick={() =>
            notify("Demo only: period comparison is unavailable.", "info")
          }
        >
          Compare period
        </Button>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Confirmed bookings"
          value="148"
          change="+12.4%"
          detail="vs previous period"
        />
        <StatCard
          label="Quoted value"
          value="₱284k"
          change="+8.7%"
          detail="68% conversion rate"
        />
        <StatCard
          label="Events completed"
          value="96"
          change="+6.2%"
          detail="96% on-time completion"
        />
        <StatCard
          label="Average rating"
          value="4.9"
          change="+0.2"
          detail="from 68 verified reviews"
        />
      </div>

      <div className="report-grid">
        <Panel
          className="revenue-chart-card"
          title="Bookings & quoted value"
          description="Monthly confirmed bookings and quotation value"
          action={
            <div className="report-legend">
              <span>
                <i></i>Confirmed bookings
              </span>
              <span>
                <i></i>Quoted value
              </span>
            </div>
          }
        >
          <div className="combo-chart">
            {[48, 61, 55, 72, 83, 94].map((_height, index) => (
              <div key={index}>
                <i className={`bar-height-${index + 1}`}></i>
                <b className={`line-point point-${index + 1}`}></b>
              </div>
            ))}
            <svg
              viewBox="0 0 600 160"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline points="48,125 148,110 248,104 348,78 448,62 548,38" />
            </svg>
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
        <Panel
          className="event-mix-card"
          title="Event mix"
          description="By confirmed booking type"
        >
          <div className="donut-wrap">
            <div className="report-donut">
              <span>
                <strong>148</strong>
                <small>bookings</small>
              </span>
            </div>
            <div className="donut-legend">
              <span>
                <i className="weddings"></i>
                <span>
                  Weddings<small>42% · 62</small>
                </span>
              </span>
              <span>
                <i className="corporate"></i>
                <span>
                  Corporate<small>28% · 41</small>
                </span>
              </span>
              <span>
                <i className="social"></i>
                <span>
                  Social<small>21% · 31</small>
                </span>
              </span>
              <span>
                <i className="other"></i>
                <span>
                  Other<small>9% · 14</small>
                </span>
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="report-grid lower">
        <Panel
          className="performance-table-card"
          title="Event delivery performance"
          description="Based on recorded schedules and incidents"
          action={
            <Button
              variant="link"
              size="small"
              onClick={() =>
                notify("Demo only: the full report is unavailable.", "info")
              }
            >
              View full report <Icon name="arrow" size={14} />
            </Button>
          }
        >
          <div className="performance-table">
            <div className="performance-row header">
              <span>Metric</span>
              <span>Current</span>
              <span>Target</span>
              <span>Trend</span>
            </div>
            <div className="performance-row">
              <span>
                <strong>On-time setup</strong>
                <small>92 of 96 completed events</small>
              </span>
              <span>95.8%</span>
              <span>≥ 95%</span>
              <Badge tone="success">+2.1%</Badge>
            </div>
            <div className="performance-row">
              <span>
                <strong>Incidents resolved same day</strong>
                <small>18 of 21 recorded incidents</small>
              </span>
              <span>85.7%</span>
              <span>≥ 90%</span>
              <Badge tone="warning">-3.2%</Badge>
            </div>
            <div className="performance-row">
              <span>
                <strong>Equipment returned on time</strong>
                <small>84 of 91 dispatches</small>
              </span>
              <span>92.3%</span>
              <span>≥ 95%</span>
              <Badge tone="danger">-1.8%</Badge>
            </div>
          </div>
        </Panel>
        <Panel
          className="satisfaction-card"
          title="Customer feedback"
          description="Verified completed events"
          action={<strong>4.9</strong>}
        >
          <div className="rating-bars">
            {[
              ["5", 88],
              ["4", 9],
              ["3", 3],
              ["2", 0],
              ["1", 0],
            ].map((rating) => (
              <span key={rating[0]}>
                <small>{rating[0]} ★</small>
                <i>
                  <b className={`rating-${rating[0]}`}></b>
                </i>
                <em>{rating[1]}%</em>
              </span>
            ))}
          </div>
          <div className="feedback-quote">
            <p>
              “The team was calm, attentive, and perfectly on schedule. Every
              dietary detail was handled beautifully.”
            </p>
            <span>
              <strong>Elena Mendoza</strong>
              <small>Mendoza–Reyes Wedding · Verified booking</small>
            </span>
          </div>
        </Panel>
      </div>

      <Panel
        className="report-library"
        title="Report library"
        description="Detailed operational and business reports"
        action={<SearchField compact placeholder="Search reports" />}
      >
        <div className="report-library-grid">
          {(
            [
              [
                "Booking & quotation report",
                "Conversion, value, expiration, and sales activity",
                "chart",
                "Updated today",
              ],
              [
                "Event completion report",
                "Delivery timing, delays, and completion",
                "clipboard",
                "Updated today",
              ],
              [
                "Incident report",
                "Incident type, action, status, and resolution",
                "alert",
                "3 open incidents",
              ],
              [
                "Resource utilization",
                "Allocation, availability, and equipment usage",
                "box",
                "Updated 2 hr ago",
              ],
              [
                "Customer feedback",
                "Ratings, published reviews, and recurring themes",
                "spark",
                "68 responses",
              ],
            ] satisfies [string, string, IconName, string][]
          ).map((report) => (
            <Button
              variant="plain"
              key={report[0]}
              onClick={() => setReportOpen(true)}
            >
              <span className="report-icon">
                <Icon name={report[2]} />
              </span>
              <span>
                <strong>{report[0]}</strong>
                <small>{report[1]}</small>
                <em>{report[3]}</em>
              </span>
              <Icon name="chevron" size={15} />
            </Button>
          ))}
        </div>
      </Panel>

      {reportOpen && (
        <Dialog
          onClose={() => setReportOpen(false)}
          className="report-export-modal"
          eyebrow="Export report"
          title="Prepare business report"
          intro="Choose the included sections and output format. Only data you have permission to view will be exported."
          actions={
            <>
              <Button variant="secondary" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button
                icon="chart"
                onClick={() => {
                  setReportOpen(false);
                  notify("Demo only: no report was generated.", "info");
                }}
              >
                Generate report
              </Button>
            </>
          }
        >
          <div className="report-section-options">
            {[
              "Executive summary",
              "Bookings & quotations",
              "Event completion",
              "Resource utilization",
              "Customer feedback",
            ].map((item, index) => (
              <label key={item}>
                <Input
                  variant="plain"
                  type="checkbox"
                  defaultChecked={index < 4}
                />
                <span>
                  <strong>{item}</strong>
                  <small>{"Include current filtered period"}</small>
                </span>
              </label>
            ))}
          </div>
          <div className="form-grid export-options">
            <FormField label="Format">
              <Select>
                <option>PDF document</option>
                <option>CSV spreadsheet</option>
              </Select>
            </FormField>
            <FormField label="Date range">
              <Select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                <option>Last 30 days</option>
                <option>Last 3 months</option>
                <option>Last 6 months</option>
                <option>This year</option>
              </Select>
            </FormField>
          </div>
        </Dialog>
      )}
    </div>
  );
}
