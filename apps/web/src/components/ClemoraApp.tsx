import { useMemo, useState } from "react"
import type { SubmitEvent } from "react"

type Role = "Administrator" | "Manager" | "Coordinator" | "Staff"
type View = "public" | "login" | "customer" | "app"
type NavKey = "Overview" | "Bookings" | "Calendar" | "Packages" | "Inventory" | "Operations" | "Team" | "Reports" | "Administration"

const photos = {
  hero: "https://images.unsplash.com/photo-1562050344-f7ad946cee35?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=85&w=1600",
  wedding:
    "https://images.unsplash.com/photo-1769812343590-485512e27838?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=900",
  dinner:
    "https://images.unsplash.com/photo-1536392706976-e486e2ba97af?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=900",
  dessert:
    "https://images.unsplash.com/photo-1744421460450-80702774eb9e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=900",
}

const roles: Role[] = ["Administrator", "Manager", "Coordinator", "Staff"]

const demoAccounts = [
  {
    role: "Customer",
    name: "Elena Mendoza",
    email: "customer@clemora.demo",
    password: "demo123",
    initials: "EM",
    description: "Bookings, quotations, notifications, and messages.",
  },
  {
    role: "Administrator",
    name: "Marin Alvarez",
    email: "admin@clemora.demo",
    password: "demo123",
    initials: "MA",
    description: "System access, reporting, AI, security, and audit controls.",
  },
  {
    role: "Manager",
    name: "Priya Raman",
    email: "manager@clemora.demo",
    password: "demo123",
    initials: "PR",
    description: "Packages, quotations, bookings, team, and inventory.",
  },
  {
    role: "Coordinator",
    name: "Amina Santos",
    email: "coordinator@clemora.demo",
    password: "demo123",
    initials: "AS",
    description: "Preparation, timelines, incidents, and assignments.",
  },
  {
    role: "Staff",
    name: "Devon Price",
    email: "staff@clemora.demo",
    password: "demo123",
    initials: "DP",
    description: "Assigned events, work schedules, tasks, and updates.",
  },
] as const

const roleNav: Record<Role, NavKey[]> = {
  Administrator: [
    "Overview",
    "Bookings",
    "Calendar",
    "Reports",
    "Administration",
  ],
  Manager: [
    "Overview",
    "Bookings",
    "Calendar",
    "Packages",
    "Inventory",
    "Team",
    "Reports",
  ],
  Coordinator: ["Overview", "Calendar", "Operations", "Team", "Inventory"],
  Staff: ["Overview", "Calendar", "Operations"],
}

const bookings = [
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

const packages = [
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

import { Badge, Brand, Button, Icon } from "@event-management/ui";

function PublicSite({ onEnterCustomer }: { onEnterCustomer: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const submitQuote = (event: SubmitEvent) => {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="public-site">
      <header className="public-header">
        <Brand />
        <nav className={`public-nav ${mobileOpen ? "open" : ""}`}>
          <a href="#services">Services</a>
          <a href="#packages">Packages</a>
          <a href="#events">Past events</a>
          <a href="#about">About us</a>
        </nav>
        <div className="header-actions">
          <button className="text-button" onClick={onEnterCustomer}>
            Sign in
          </button>
          <Button onClick={() => setQuoteOpen(true)}>Plan your event</Button>
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Open navigation"
          >
            <Icon name={mobileOpen ? "close" : "menu"} />
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div
            className="hero-image"
            aria-label="Elegant outdoor catered dinner table"
          ></div>
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <Badge tone="cream">Thoughtful catering, beautifully managed</Badge>
            <div className="display-title">
              Gather well.
              <br />
              We’ll handle the rest.
            </div>
            <p>
              From intimate celebrations to landmark occasions, Clemora brings
              thoughtful menus, warm service, and seamless coordination to every
              table.
            </p>
            <div className="hero-actions">
              <Button
                variant="light"
                onClick={() => setQuoteOpen(true)}
                icon="arrow"
              >
                Start planning
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  document
                    .querySelector("#packages")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Explore packages
              </Button>
            </div>
          </div>
          <div className="hero-trust">
            <div>
              <strong>4.9</strong>
              <span>average guest rating</span>
            </div>
            <div>
              <strong>420+</strong>
              <span>events served with care</span>
            </div>
            <div>
              <strong>12 yrs</strong>
              <span>of trusted experience</span>
            </div>
          </div>
        </section>

        <section className="intro section" id="services">
          <div>
            <span className="eyebrow">Your occasion, considered</span>
            <div className="section-title">
              More than a menu.
              <br />A complete event experience.
            </div>
          </div>
          <div className="intro-copy">
            <p>
              We bring your vision together through seasonal food, polished
              service, and clear planning from first conversation to final
              toast.
            </p>
            <a className="inline-link" href="#packages">
              How Clemora works <Icon name="arrow" size={16} />
            </a>
          </div>
        </section>

        <section className="packages section" id="packages">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Curated experiences</span>
              <div className="section-title small">
                A thoughtful place to begin
              </div>
            </div>
            <p>
              Every package can be tailored to your menu, setting, guest count,
              and service needs.
            </p>
          </div>
          <div className="package-grid">
            {packages.map((item) => (
              <article className="package-card" key={item.name}>
                <div className="package-image">
                  <img src={item.image} alt={item.kind} />
                  <Badge tone="light">{item.tag}</Badge>
                </div>
                <div className="package-body">
                  <div className="package-kind">{item.kind}</div>
                  <div className="card-title">{item.name}</div>
                  <p>{item.description}</p>
                  <div className="package-meta">
                    <span>{item.price}</span>
                    <span>{item.guests}</span>
                  </div>
                  <button
                    className="card-link"
                    onClick={() => setQuoteOpen(true)}
                  >
                    View package <Icon name="arrow" size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="recommendation section" id="events">
          <div className="recommendation-copy">
            <Badge tone="gold">
              <Icon name="spark" size={14} /> Clemora AI
            </Badge>
            <div className="section-title small">Not sure where to start?</div>
            <p>
              Tell us about your occasion, guest count, and what matters most.
              We’ll suggest a starting package—with clear reasons—then your
              catering manager can refine it with you.
            </p>
            <Button onClick={() => setChatOpen(true)}>Find my best fit</Button>
          </div>
          <div className="recommendation-card">
            <div className="rec-top">
              <div className="ai-icon">
                <Icon name="spark" />
              </div>
              <div>
                <span className="muted-label">Recommended for you</span>
                <div className="card-title">Garden Social</div>
              </div>
              <Badge tone="success">94% match</Badge>
            </div>
            <div className="rec-reasons">
              <div>
                <Icon name="check" />
                <span>
                  <strong>Fits your $4,500 budget</strong>
                  <small>Estimated at $3,920 for 70 guests</small>
                </span>
              </div>
              <div>
                <Icon name="check" />
                <span>
                  <strong>Designed for relaxed celebrations</strong>
                  <small>Flexible stations and garden-ready service</small>
                </span>
              </div>
              <div>
                <Icon name="check" />
                <span>
                  <strong>Vegetarian-friendly menu</strong>
                  <small>12 included dishes meet your preferences</small>
                </span>
              </div>
            </div>
            <div className="rec-note">
              Suggestions require review and do not reserve availability.
            </div>
          </div>
        </section>

        <section className="cta section" id="about">
          <div>
            <span className="eyebrow light">
              Let’s create something memorable
            </span>
            <div className="section-title">Your table is waiting.</div>
          </div>
          <Button
            variant="light"
            onClick={() => setQuoteOpen(true)}
            icon="arrow"
          >
            Tell us about your event
          </Button>
        </section>
      </main>

      <footer className="public-footer">
        <Brand light />
        <p>
          Thoughtful catering and calm event coordination, from first idea to
          final toast.
        </p>
        <div>
          <a href="#packages">Packages</a>
          <a href="#events">Past events</a>
          <a href="#about">Contact</a>
        </div>
        <span>© 2025 Clemora Catering</span>
      </footer>

      <button className="chat-launcher" onClick={() => setChatOpen(!chatOpen)}>
        <Icon name={chatOpen ? "close" : "spark"} />
        <span>{chatOpen ? "Close" : "Ask Clemora"}</span>
      </button>

      {chatOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <div className="ai-icon">
              <Icon name="spark" />
            </div>
            <div>
              <strong>Clemora assistant</strong>
              <small>Online · Answers from our service guide</small>
            </div>
          </div>
          <div className="chat-body">
            <span className="chat-time">Today, 10:42 AM</span>
            <div className="message bot">
              Hi, I’m here to help you explore packages, menus, pricing, and our
              booking process. What are you planning?
            </div>
            <div className="quick-replies">
              <button>Recommend a package</button>
              <button>View sample menus</button>
              <button>Booking process</button>
            </div>
          </div>
          <div className="handover">
            <span>Need a person?</span>
            <button>Request human assistance</button>
          </div>
          <div className="chat-input">
            <input placeholder="Ask about your event..." />
            <button aria-label="Send">
              <Icon name="arrow" />
            </button>
          </div>
        </div>
      )}

      {quoteOpen && (
        <div className="modal-backdrop" onMouseDown={() => setQuoteOpen(false)}>
          <div
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setQuoteOpen(false)}>
              <Icon name="close" />
            </button>
            {submitted ? (
              <div className="success-state">
                <div className="success-icon">
                  <Icon name="check" size={30} />
                </div>
                <div className="modal-title">Your request is on its way</div>
                <p>
                  We’ve saved your event details. A catering manager will review
                  your request and follow up within one business day.
                </p>
                <div className="reference">
                  Request reference <strong>QR-5821</strong>
                </div>
                <Button onClick={() => setQuoteOpen(false)}>Done</Button>
              </div>
            ) : (
              <>
                <span className="eyebrow">Quotation request</span>
                <div className="modal-title">Tell us about your event</div>
                <p className="modal-intro">
                  Share the essentials now. You can refine every detail with
                  your catering manager later.
                </p>
                <form onSubmit={submitQuote}>
                  <div className="form-grid">
                    <label>
                      <span>Event type</span>
                      <select required defaultValue="">
                        <option value="" disabled>
                          Select an event
                        </option>
                        <option>Wedding</option>
                        <option>Corporate dinner</option>
                        <option>Birthday</option>
                        <option>Other</option>
                      </select>
                    </label>
                    <label>
                      <span>Preferred date</span>
                      <input type="date" required />
                    </label>
                    <label>
                      <span>Guest count</span>
                      <input
                        type="number"
                        placeholder="e.g. 120"
                        min="10"
                        required
                      />
                    </label>
                    <label>
                      <span>Estimated budget</span>
                      <select defaultValue="">
                        <option value="" disabled>
                          Select a range
                        </option>
                        <option>$2,000–$5,000</option>
                        <option>$5,000–$10,000</option>
                        <option>$10,000+</option>
                      </select>
                    </label>
                    <label className="full">
                      <span>Venue or area</span>
                      <input placeholder="Venue name or neighborhood" />
                    </label>
                    <label className="full">
                      <span>What matters most?</span>
                      <textarea placeholder="Tell us about your menu preferences, atmosphere, or special requirements"></textarea>
                    </label>
                  </div>
                  <div className="form-actions">
                    <Button
                      variant="secondary"
                      onClick={() => setQuoteOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Send request</Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DemoLogin({
  onBack,
  onLogin,
}: {
  onBack: () => void
  onLogin: (role: "Customer" | Role) => void
}) {
  const [selected, setSelected] = useState<(typeof demoAccounts)[number]>(
    demoAccounts[0],
  )
  const [email, setEmail] = useState<string>(demoAccounts[0].email)
  const [password, setPassword] = useState<string>(demoAccounts[0].password)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const selectAccount = (account: (typeof demoAccounts)[number]) => {
    setSelected(account)
    setEmail(account.email)
    setPassword(account.password)
    setError("")
  }

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    const account = demoAccounts.find(
      (item) => item.email === email && item.password === password,
    )
    if (!account) {
      setError(
        "These credentials do not match a demo account. Choose an account below to autofill its details.",
      )
      return
    }
    onLogin(account.role)
  }

  return (
    <div className="login-page">
      <div className="login-visual">
        <div className="login-photo"></div>
        <div className="login-photo-overlay"></div>
        <button className="login-back" onClick={onBack}>
          <Icon name="arrow" size={16} /> Back to customer site
        </button>
        <div className="login-visual-content">
          <Brand light />
          <div className="login-quote">
            One connected workspace, from first inquiry to final service.
          </div>
          <p>
            Explore Clemora through realistic role-based demo accounts. All
            records are mock data and remain inside this frontend prototype.
          </p>
          <div className="login-security-note">
            <Icon name="check" />
            Frontend demonstration · No real customer or business data
          </div>
        </div>
      </div>

      <main className="login-main">
        <div className="login-form-wrap">
          <span className="eyebrow">Clemora demonstration</span>
          <div className="login-title">Welcome back</div>
          <p className="login-intro">
            Sign in with a demo account or choose a role for instant access.
          </p>

          <form className="login-form" onSubmit={submit}>
            <label>
              <span>Email address</span>
              <div className="login-input">
                <Icon name="users" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setError("")
                  }}
                  required
                />
              </div>
            </label>
            <label>
              <span>Password</span>
              <div className="login-input">
                <Icon name="settings" size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError("")
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <div className="login-options">
              <label>
                <input type="checkbox" defaultChecked />
                <span>Keep me signed in for this demo</span>
              </label>
              <button type="button">Forgot password?</button>
            </div>
            {error && (
              <div className="login-error">
                <Icon name="alert" size={16} />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" className="login-submit">
              Sign in as {selected.role}
            </Button>
          </form>

          <div className="demo-divider">
            <span>Or choose a demo account</span>
          </div>

          <div className="demo-account-grid">
            {demoAccounts.map((account) => (
              <button
                className={selected.role === account.role ? "active" : ""}
                onClick={() => selectAccount(account)}
                key={account.role}
              >
                <span
                  className={`demo-avatar demo-${account.role.toLowerCase()}`}
                >
                  {account.initials}
                </span>
                <span>
                  <strong>{account.role}</strong>
                  <small>{account.name}</small>
                </span>
                {selected.role === account.role && (
                  <i><Icon name="check" size={12} /></i>
                )}
              </button>
            ))}
          </div>

          <div className="selected-demo-account">
            <div>
              <span
                className={`demo-avatar demo-${selected.role.toLowerCase()}`}
              >
                {selected.initials}
              </span>
              <span>
                <strong>{selected.name}</strong>
                <small>{selected.description}</small>
              </span>
            </div>
            <dl>
              <div><dt>Email</dt><dd>{selected.email}</dd></div>
              <div><dt>Password</dt><dd>{selected.password}</dd></div>
            </dl>
            <Button
              variant="secondary"
              onClick={() => onLogin(selected.role)}
              icon="arrow"
            >
              Enter {selected.role} demo
            </Button>
          </div>

          <p className="login-disclaimer">
            Demo accounts use mock data and simulated interactions. No backend,
            external authentication, or persistent storage is connected.
          </p>
        </div>
      </main>
    </div>
  )
}

function Sidebar({
  role,
  active,
  onNavigate,
  collapsed,
  onClose,
}: {
  role: Role
  active: NavKey
  onNavigate: (key: NavKey) => void
  collapsed: boolean
  onClose: () => void
}) {
  const iconFor: Record<NavKey, string> = {
    Overview: "grid",
    Bookings: "clipboard",
    Calendar: "calendar",
    Packages: "box",
    Inventory: "box",
    Operations: "clipboard",
    Team: "users",
    Reports: "chart",
    Administration: "settings",
  }
  return (
    <aside className={`sidebar ${collapsed ? "" : "sidebar-open"}`}>
      <div className="sidebar-top">
        <Brand light />
        <button className="sidebar-close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="workspace-label">Workspace</div>
      <nav className="side-nav">
        {roleNav[role].map((item) => (
          <button
            key={item}
            className={active === item ? "active" : ""}
            onClick={() => {
              onNavigate(item)
              onClose()
            }}
          >
            <Icon name={iconFor[item]} />
            <span>{item}</span>
            {item === "Operations" && <b>3</b>}
          </button>
        ))}
      </nav>
      <div className="side-help">
        <div className="help-icon">?</div>
        <strong>Need help?</strong>
        <span>View the team guide or contact support.</span>
        <button>Open help center</button>
      </div>
      <div className="sidebar-user">
        <div className="avatar">MA</div>
        <div>
          <strong>Marin Alvarez</strong>
          <span>{role}</span>
        </div>
        <Icon name="chevron" size={16} />
      </div>
    </aside>
  )
}

function StatCard({
  label,
  value,
  change,
  detail,
  tone = "",
}: {
  label: string
  value: string
  change?: string
  detail: string
  tone?: string
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-label">
        {label}
        <button aria-label={`More about ${label}`}>•••</button>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">
        {change && <Badge tone="success">{change}</Badge>}
        <span>{detail}</span>
      </div>
    </div>
  )
}

function Overview({
  role,
  onNavigate,
}: {
  role: Role
  onNavigate: (key: NavKey) => void
}) {
  if (role === "Staff") {
    return (
      <div className="content-stack">
        <div className="welcome-row">
          <div>
            <span className="eyebrow">Monday, June 16</span>
            <div className="page-title">Good morning, Marin</div>
            <p>You have 2 assigned events and 5 tasks this week.</p>
          </div>
          <Button icon="calendar">View my schedule</Button>
        </div>
        <div className="stats-grid three">
          <StatCard label="Tasks today" value="5" detail="2 due before noon" />
          <StatCard
            label="Events this week"
            value="2"
            detail="Next: Northstar Dinner"
          />
          <StatCard label="Announcements" value="3" detail="1 unread update" />
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Today’s assignments</div>
              <p>Monday, June 16</p>
            </div>
            <Badge tone="info">On shift · 9:00 AM–6:00 PM</Badge>
          </div>
          <div className="task-list">
            {[
              "Check linen dispatch against inventory list",
              "Confirm warming cabinets are labeled",
              "Load service kits for Northstar dinner",
              "Attend pre-event team briefing",
            ].map((task, index) => (
              <label className="task-row" key={task}>
                <input type="checkbox" defaultChecked={index === 0} />
                <span>
                  <strong>{task}</strong>
                  <small>
                    {index < 2
                      ? "Orchid Hall preparation"
                      : "Warehouse · Operations"}
                  </small>
                </span>
                <Badge tone={index === 0 ? "success" : "neutral"}>
                  {index === 0 ? "Complete" : index === 3 ? "3:30 PM" : "Today"}
                </Badge>
              </label>
            ))}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="content-stack">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">Monday, June 16</span>
          <div className="page-title">
            {role === "Coordinator"
              ? "Operations overview"
              : "Good morning, Marin"}
          </div>
          <p>
            {role === "Coordinator"
              ? "Monitor preparation, timing, and team readiness across active events."
              : "Here’s what’s happening across Clemora this week."}
          </p>
        </div>
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
            onClick={() =>
              onNavigate(role === "Coordinator" ? "Operations" : "Bookings")
            }
          >
            {role === "Coordinator" ? "Open operations" : "New booking"}
          </Button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Events this week"
          value="12"
          change="+8.2%"
          detail="vs last week"
        />
        <StatCard
          label={
            role === "Coordinator" ? "Tasks in progress" : "Confirmed revenue"
          }
          value={role === "Coordinator" ? "38" : "$84.6k"}
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
          label={
            role === "Coordinator" ? "Team availability" : "Guest satisfaction"
          }
          value={role === "Coordinator" ? "86%" : "4.9"}
          change="↑ 0.2"
          detail={
            role === "Coordinator" ? "32 team members" : "from 68 reviews"
          }
        />
      </div>

      <div className="dashboard-grid">
        <div className="panel schedule-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Upcoming events</div>
              <p>Next 7 days · 12 scheduled</p>
            </div>
            <button
              className="inline-link"
              onClick={() => onNavigate("Calendar")}
            >
              View calendar <Icon name="arrow" size={15} />
            </button>
          </div>
          <div className="event-list">
            {bookings.slice(0, 3).map((booking, index) => (
              <button
                className="event-row"
                key={booking.id}
                onClick={() =>
                  onNavigate(role === "Coordinator" ? "Operations" : "Bookings")
                }
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
                  <span className="avatar small">AS</span>
                  <span className="avatar small second">
                    {index === 0 ? "JB" : "MK"}
                  </span>
                </div>
                <Badge tone={index === 1 ? "warning" : "success"}>
                  {booking.status}
                </Badge>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </div>
        </div>

        <div className="panel attention-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Needs attention</div>
              <p>Items requiring a decision</p>
            </div>
            <Badge tone="danger">3 urgent</Badge>
          </div>
          <div className="attention-list">
            <button>
              <span className="attention-icon danger">
                <Icon name="alert" />
              </span>
              <span>
                <strong>Scheduling conflict</strong>
                <small>2 service captains overlap on Jun 24</small>
              </span>
              <Icon name="chevron" />
            </button>
            <button>
              <span className="attention-icon warning">
                <Icon name="box" />
              </span>
              <span>
                <strong>Low stock warning</strong>
                <small>Ivory linen napkins · 36 remaining</small>
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
        </div>
      </div>

      <div className="dashboard-grid lower">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Booking activity</div>
              <p>Confirmed bookings · Last 6 months</p>
            </div>
            <select>
              <option>Last 6 months</option>
              <option>Last 12 months</option>
            </select>
          </div>
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
        </div>
        <div className="panel ai-card">
          <div className="ai-card-head">
            <span className="ai-icon">
              <Icon name="spark" />
            </span>
            <Badge tone="gold">AI suggestion</Badge>
          </div>
          <div className="panel-title">Staffing recommendation</div>
          <p>
            For the Northstar Annual Dinner, add one service captain with
            plated-service experience.
          </p>
          <div className="suggestion-person">
            <span className="avatar">DP</span>
            <span>
              <strong>Devon Price</strong>
              <small>Available · 8 similar events · 12h this week</small>
            </span>
            <Badge tone="success">Strong fit</Badge>
          </div>
          <div className="reason">
            Suggested from recorded skills, current availability, workload, and
            event requirements. Requires manager review.
          </div>
          <div className="row-actions">
            <Button variant="secondary">Dismiss</Button>
            <Button>Review suggestion</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BookingsPage() {
  const [filter, setFilter] = useState("All bookings")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<typeof bookings[0] | null>(null)
  const filtered = bookings.filter(
    (item) =>
      `${item.event} ${item.customer} ${item.id}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "All bookings" || item.status === filter),
  )
  return (
    <div className="content-stack">
      <div className="page-head">
        <div>
          <div className="page-title">Bookings</div>
          <p>Manage every confirmed and prospective event in one place.</p>
        </div>
        <Button icon="clipboard">Create booking</Button>
      </div>
      <div className="tab-row">
        <button className="active">
          All bookings <span>28</span>
        </button>
        <button>
          Needs action <span>7</span>
        </button>
        <button>Upcoming</button>
        <button>Completed</button>
        <button>Cancelled</button>
      </div>
      <div className="panel table-panel">
        <div className="table-tools">
          <div className="search-field">
            <Icon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search event, customer, or ID"
            />
          </div>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option>All bookings</option>
            <option>Confirmed</option>
            <option>In preparation</option>
            <option>Under review</option>
          </select>
          <select>
            <option>All coordinators</option>
            <option>Amina Santos</option>
            <option>Jon Bell</option>
          </select>
          <Button variant="secondary">More filters</Button>
        </div>
        <div className="data-table">
          <div className="table-row table-header">
            <span>Event</span>
            <span>Date & venue</span>
            <span>Guests</span>
            <span>Coordinator</span>
            <span>Status</span>
            <span></span>
          </div>
          {filtered.map((booking) => (
            <button
              className="table-row"
              key={booking.id}
              onClick={() => setSelected(booking)}
            >
              <span>
                <strong>{booking.event}</strong>
                <small>
                  {booking.id} · {booking.customer}
                </small>
              </span>
              <span>
                <strong>{booking.date}</strong>
                <small>{booking.venue}</small>
              </span>
              <span>{booking.guests}</span>
              <span>{booking.coordinator}</span>
              <span>
                <Badge
                  tone={
                    booking.status === "Confirmed"
                      ? "success"
                      : booking.status === "In preparation"
                        ? "info"
                        : "warning"
                  }
                >
                  {booking.status}
                </Badge>
              </span>
              <span>
                <Icon name="chevron" size={16} />
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="empty-state">
              <Icon name="search" size={28} />
              <strong>No matching bookings</strong>
              <span>Try adjusting your search or filters.</span>
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("")
                  setFilter("All bookings")
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
        <div className="pagination">
          <span>Showing {filtered.length} of 28 bookings</span>
          <div>
            <button>‹</button>
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <button>›</button>
          </div>
        </div>
      </div>
      {selected && (
        <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}>
          <aside
            className="detail-drawer"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setSelected(null)}>
              <Icon name="close" />
            </button>
            <Badge tone="success">{selected.status}</Badge>
            <div className="drawer-title">{selected.event}</div>
            <p>{selected.id} · Created June 2, 2025</p>
            <div className="detail-grid">
              <div>
                <span>Customer</span>
                <strong>{selected.customer}</strong>
              </div>
              <div>
                <span>Event date</span>
                <strong>{selected.date}</strong>
              </div>
              <div>
                <span>Venue</span>
                <strong>{selected.venue}</strong>
              </div>
              <div>
                <span>Guest count</span>
                <strong>{selected.guests}</strong>
              </div>
            </div>
            <div className="subheading">Booking progress</div>
            <div className="vertical-timeline">
              {[
                "Request submitted",
                "Quotation approved",
                "Booking confirmed",
                "In preparation",
                "Event completed",
              ].map((step, index) => (
                <div
                  className={
                    index < 3 ? "complete" : index === 3 ? "current" : ""
                  }
                  key={step}
                >
                  <span>
                    <Icon name={index < 3 ? "check" : "grid"} size={13} />
                  </span>
                  <div>
                    <strong>{step}</strong>
                    <small>
                      {index < 3
                        ? `June ${index * 3 + 2}, 2025`
                        : index === 3
                          ? "Current stage"
                          : "Pending"}
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <div className="drawer-actions">
              <Button variant="secondary">View quotation</Button>
              <Button>Open full record</Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function OperationsPage() {
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
          <div className="panel progress-panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Preparation progress</div>
                <p>17 of 24 tasks complete</p>
              </div>
              <strong>71%</strong>
            </div>
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
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Event timeline</div>
                <p>Scheduled versus actual activity</p>
              </div>
              <div className="legend">
                <span>
                  <i className="on-time"></i>On time
                </span>
                <span>
                  <i className="delayed"></i>Delayed
                </span>
              </div>
            </div>
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
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Priority tasks</div>
                <p>Items due before team briefing</p>
              </div>
              <button className="inline-link">View all 24 tasks</button>
            </div>
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
          </div>
        </div>
        <div className="ops-side">
          <div className="panel">
            <div className="panel-title">Event lead</div>
            <div className="lead-person">
              <span className="avatar large">AS</span>
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
          </div>
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Team readiness</div>
              <strong>18 / 20</strong>
            </div>
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
          </div>
          <div className="panel incident-card">
            <div className="panel-head">
              <div className="panel-title">Incidents</div>
              <Badge tone="warning">1 open</Badge>
            </div>
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
          </div>
          <div className="panel">
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
          </div>
        </div>
      </div>
    </div>
  )
}

function CalendarPage() {
  const [mode, setMode] = useState<"Month" | "Week" | "Day">("Month")
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [conflictOpen, setConflictOpen] = useState(false)
  const days = [
    { day: 26, muted: true },
    { day: 27, muted: true },
    { day: 28, muted: true },
    { day: 29, muted: true },
    { day: 30, muted: true },
    { day: 31, muted: true },
    { day: 1 },
    { day: 2 },
    { day: 3, events: [["Tasting · Mendoza", "tasting"]] },
    { day: 4 },
    { day: 5, events: [["Team training", "internal"]] },
    { day: 6 },
    { day: 7, events: [["Bennett Anniversary", "confirmed"]] },
    { day: 8 },
    { day: 9 },
    { day: 10, events: [["Venue walkthrough", "tasting"]] },
    { day: 11 },
    { day: 12, events: [["Reed Graduation", "confirmed"]] },
    { day: 13 },
    { day: 14, events: [["Garden Social", "preparation"]] },
    { day: 15 },
    { day: 16, today: true },
    { day: 17 },
    { day: 18, events: [["Final guest count", "attention"]] },
    { day: 19, events: [["Menu tasting", "tasting"]] },
    { day: 20 },
    {
      day: 21,
      events: [
        ["Kitchen production", "preparation"],
        ["Equipment dispatch", "internal"],
      ],
    },
    {
      day: 22,
      events: [["Mendoza–Reyes Wedding", "confirmed"]],
    },
    { day: 23 },
    {
      day: 24,
      conflict: true,
      events: [
        ["Northstar Dinner", "preparation"],
        ["Captain assignment conflict", "attention"],
      ],
    },
    { day: 25 },
    { day: 26 },
    { day: 27, events: [["Harlow Birthday", "pending"]] },
    { day: 28 },
    { day: 29, events: [["Arc & Co. Launch", "pending"]] },
    { day: 30 },
    { day: 1, muted: true },
    { day: 2, muted: true },
    { day: 3, muted: true },
    { day: 4, muted: true },
    { day: 5, muted: true },
    { day: 6, muted: true },
  ]

  return (
    <div className="content-stack calendar-page">
      <div className="page-head">
        <div>
          <div className="page-title">Schedule</div>
          <p>
            Coordinate events, staff, transport, preparation, and equipment.
          </p>
        </div>
        <div className="welcome-actions">
          <Button variant="secondary">Check availability</Button>
          <Button icon="calendar">Schedule event</Button>
        </div>
      </div>

      <div className="schedule-summary">
        <div>
          <span className="schedule-dot confirmed"></span>
          <span><strong>12</strong> Events this month</span>
        </div>
        <div>
          <span className="schedule-dot preparation"></span>
          <span><strong>4</strong> In preparation</span>
        </div>
        <div>
          <span className="schedule-dot attention"></span>
          <span><strong>2</strong> Conflicts to resolve</span>
        </div>
        <button onClick={() => setConflictOpen(true)}>
          Review conflicts <Icon name="arrow" size={14} />
        </button>
      </div>

      <div className="calendar-layout">
        <div className="panel calendar-panel">
          <div className="calendar-toolbar">
            <div className="month-selector">
              <button aria-label="Previous month">‹</button>
              <strong>June 2025</strong>
              <button aria-label="Next month">›</button>
              <button className="today-button">Today</button>
            </div>
            <div className="calendar-modes">
              {(["Month", "Week", "Day"] as const).map((item) => (
                <button
                  className={mode === item ? "active" : ""}
                  onClick={() => setMode(item)}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {mode === "Month" ? (
            <div className="month-calendar">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day) => (
                  <div className="weekday" key={day}>{day}</div>
                ),
              )}
              {days.map((day, index) => (
                <div
                  className={`calendar-day ${day.muted ? "muted" : ""} ${day.today ? "today" : ""} ${day.conflict ? "has-conflict" : ""}`}
                  key={`${day.day}-${index}`}
                >
                  <span className="day-number">{day.day}</span>
                  {day.conflict && (
                    <button
                      className="conflict-indicator"
                      onClick={() => setConflictOpen(true)}
                      aria-label="View scheduling conflict"
                    >
                      <Icon name="alert" size={12} />
                    </button>
                  )}
                  <div className="calendar-events">
                    {day.events?.map((event) => (
                      <button
                        className={`calendar-event ${event[1]}`}
                        key={event[0]}
                        onClick={() => setSelectedEvent(event[0])}
                      >
                        <i></i>
                        <span>{event[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="agenda-view">
              <div className="agenda-hours">
                {["8 AM", "10 AM", "12 PM", "2 PM", "4 PM", "6 PM"].map(
                  (hour) => <span key={hour}>{hour}</span>,
                )}
              </div>
              <div className="agenda-columns">
                {(mode === "Week"
                  ? ["Mon 16", "Tue 17", "Wed 18", "Thu 19", "Fri 20"]
                  : ["Monday, June 16"]
                ).map((day, index) => (
                  <div key={day}>
                    <strong>{day}</strong>
                    {index === 0 && (
                      <>
                        <button
                          className="agenda-event event-one"
                          onClick={() => setSelectedEvent("Kitchen briefing")}
                        >
                          <span>9:00 AM</span>
                          <strong>Kitchen briefing</strong>
                          <small>Production kitchen</small>
                        </button>
                        <button
                          className="agenda-event event-two"
                          onClick={() => setSelectedEvent("Venue walkthrough")}
                        >
                          <span>2:00 PM</span>
                          <strong>Venue walkthrough</strong>
                          <small>The Glass Garden</small>
                        </button>
                      </>
                    )}
                    {index === 2 && (
                      <button
                        className="agenda-event event-three"
                        onClick={() => setConflictOpen(true)}
                      >
                        <span>3:30 PM</span>
                        <strong>Assignment conflict</strong>
                        <small>2 service captains</small>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="calendar-side">
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Monday, June 16</div>
                <p>3 scheduled activities</p>
              </div>
            </div>
            <div className="day-agenda-list">
              <button onClick={() => setSelectedEvent("Kitchen briefing")}>
                <span className="agenda-time">9:00</span>
                <span>
                  <strong>Kitchen briefing</strong>
                  <small>Production kitchen · 8 staff</small>
                </span>
                <Badge tone="neutral">Internal</Badge>
              </button>
              <button onClick={() => setSelectedEvent("Venue walkthrough")}>
                <span className="agenda-time">2:00</span>
                <span>
                  <strong>Venue walkthrough</strong>
                  <small>The Glass Garden · Amina Santos</small>
                </span>
                <Badge tone="info">Visit</Badge>
              </button>
              <button onClick={() => setSelectedEvent("Supplier delivery")}>
                <span className="agenda-time">4:30</span>
                <span>
                  <strong>Supplier delivery</strong>
                  <small>Warehouse · Fresh produce</small>
                </span>
                <Badge tone="success">Confirmed</Badge>
              </button>
            </div>
          </div>
          <div className="panel availability-card">
            <div className="panel-head">
              <div className="panel-title">Team availability</div>
              <strong>86%</strong>
            </div>
            <div className="availability-bar">
              <span></span>
            </div>
            <div className="availability-lines">
              <span><i className="available"></i>32 available</span>
              <span><i className="assigned"></i>11 assigned</span>
              <span><i className="away"></i>5 unavailable</span>
            </div>
          </div>
          <div className="panel resource-calendar-card">
            <div className="panel-title">Resource pressure</div>
            <p>June 21–24 is your busiest allocation window.</p>
            <div>
              <span>Service kits <strong>92% reserved</strong></span>
              <span>Transport <strong>80% reserved</strong></span>
              <span>Warming units <strong>100% reserved</strong></span>
            </div>
            <button className="inline-link">
              Review resource schedule <Icon name="arrow" size={14} />
            </button>
          </div>
        </aside>
      </div>

      {selectedEvent && (
        <div className="drawer-backdrop" onMouseDown={() => setSelectedEvent(null)}>
          <aside
            className="detail-drawer schedule-drawer"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setSelectedEvent(null)}>
              <Icon name="close" />
            </button>
            <Badge tone="info">Scheduled activity</Badge>
            <div className="drawer-title">{selectedEvent}</div>
            <p>Monday, June 16, 2025</p>
            <div className="schedule-detail-time">
              <Icon name="calendar" />
              <span><strong>2:00–3:00 PM</strong><small>1 hour</small></span>
            </div>
            <div className="detail-grid">
              <div><span>Location</span><strong>The Glass Garden</strong></div>
              <div><span>Owner</span><strong>Amina Santos</strong></div>
              <div><span>Related event</span><strong>CLM-2048</strong></div>
              <div><span>Attendees</span><strong>4 people</strong></div>
            </div>
            <div className="subheading">Preparation notes</div>
            <div className="schedule-note">
              Confirm loading entrance, service station placement, kitchen
              access, and guest arrival route with the venue coordinator.
            </div>
            <div className="drawer-actions">
              <Button variant="secondary">Reschedule</Button>
              <Button>Open related event</Button>
            </div>
          </aside>
        </div>
      )}

      {conflictOpen && (
        <div className="modal-backdrop" onMouseDown={() => setConflictOpen(false)}>
          <div
            className="modal conflict-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setConflictOpen(false)}>
              <Icon name="close" />
            </button>
            <span className="eyebrow">Scheduling conflict</span>
            <div className="modal-title">Two assignments overlap</div>
            <p className="modal-intro">
              Devon Price and Mia Chen are assigned to events with overlapping
              travel and preparation windows on June 24.
            </p>
            <div className="conflict-comparison">
              <div>
                <Badge tone="info">Northstar Dinner</Badge>
                <strong>Orchid Hall</strong>
                <span>2:00–11:00 PM · Lead service captain</span>
                <small>Travel buffer required: 45 min</small>
              </div>
              <span>overlaps</span>
              <div>
                <Badge tone="warning">Private tasting</Badge>
                <strong>Clemora Studio</strong>
                <span>1:30–3:30 PM · Tasting lead</span>
                <small>Current end time leaves no travel buffer</small>
              </div>
            </div>
            <div className="recommended-fix">
              <span className="ai-icon"><Icon name="spark" /></span>
              <span>
                <strong>Suggested resolution</strong>
                <small>
                  Reassign the tasting to Sofia King, who is available and has
                  the required dietary consultation skill.
                </small>
              </span>
              <Badge tone="success">Strong fit</Badge>
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setConflictOpen(false)}>
                Decide later
              </Button>
              <Button onClick={() => setConflictOpen(false)}>
                Review reassignment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PackagesPage() {
  const [tab, setTab] = useState<"Packages" | "Quotations" | "Menus">("Packages")
  const [quotation, setQuotation] = useState(false)
  const [toast, setToast] = useState("")
  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 2600)
  }

  return (
    <div className="content-stack packages-page">
      <div className="page-head">
        <div>
          <div className="page-title">Packages & quotations</div>
          <p>
            Manage offers, menus, pricing, add-ons, and customer quotations.
          </p>
        </div>
        <Button icon="box">
          {tab === "Packages"
            ? "Create package"
            : tab === "Quotations"
              ? "Create quotation"
              : "Add menu item"}
        </Button>
      </div>
      <div className="tab-row package-tabs">
        {(["Packages", "Quotations", "Menus"] as const).map((item) => (
          <button
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
            key={item}
          >
            {item}
            <span>{item === "Packages" ? 11 : item === "Quotations" ? 18 : 126}</span>
          </button>
        ))}
      </div>

      {tab === "Packages" && (
        <>
          <div className="package-admin-summary">
            <div>
              <span>Published</span><strong>8</strong><small>Visible to customers</small>
            </div>
            <div>
              <span>Drafts</span><strong>3</strong><small>1 needs review</small>
            </div>
            <div>
              <span>Average value</span><strong>$62</strong><small>Per guest</small>
            </div>
            <div>
              <span>Most requested</span><strong>Signature</strong><small>42% of inquiries</small>
            </div>
          </div>
          <div className="table-tools package-tools">
            <div className="search-field">
              <Icon name="search" />
              <input placeholder="Search packages" />
            </div>
            <select><option>All statuses</option><option>Published</option><option>Draft</option><option>Archived</option></select>
            <select><option>All event types</option><option>Wedding</option><option>Corporate</option><option>Social</option></select>
            <Button variant="secondary">More filters</Button>
          </div>
          <div className="admin-package-grid">
            {packages.map((item, index) => (
              <article className="admin-package-card" key={item.name}>
                <div className="admin-package-image">
                  <img src={item.image} alt="" />
                  <Badge tone={index === 2 ? "warning" : "success"}>
                    {index === 2 ? "Draft" : "Published"}
                  </Badge>
                  <button aria-label="Package options">•••</button>
                </div>
                <div className="admin-package-body">
                  <span className="package-kind">{item.kind}</span>
                  <div className="card-title">{item.name}</div>
                  <p>{item.description}</p>
                  <div className="admin-package-data">
                    <span><small>Price</small><strong>{item.price.replace("From ", "")}</strong></span>
                    <span><small>Capacity</small><strong>{item.guests}</strong></span>
                    <span><small>Menu items</small><strong>{index === 0 ? 24 : index === 1 ? 18 : 16}</strong></span>
                  </div>
                  <div className="admin-package-actions">
                    <Button variant="secondary">Preview</Button>
                    <Button
                      variant={index === 2 ? "primary" : "secondary"}
                      onClick={() =>
                        showToast(
                          index === 2
                            ? `${item.name} is ready for publishing review`
                            : `Editing ${item.name}`,
                        )
                      }
                    >
                      {index === 2 ? "Review & publish" : "Edit package"}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
            <button className="new-package-card">
              <span><Icon name="box" /></span>
              <strong>Create a new package</strong>
              <small>Build from scratch or duplicate an existing offer.</small>
            </button>
          </div>
        </>
      )}

      {tab === "Quotations" && (
        <div className="panel quotation-panel">
          <div className="table-tools">
            <div className="search-field">
              <Icon name="search" />
              <input placeholder="Search quotation or customer" />
            </div>
            <select><option>All statuses</option><option>Draft</option><option>Sent</option><option>Approved</option><option>Expiring</option></select>
            <select><option>All managers</option><option>Amina Santos</option><option>Jon Bell</option></select>
          </div>
          <div className="quotation-table">
            <div className="quotation-row quotation-header">
              <span>Quotation</span><span>Event</span><span>Total</span><span>Valid until</span><span>Status</span><span></span>
            </div>
            {[
              ["Q-2058", "Sofia Laurent", "Arc & Co. Product Launch", "$8,740", "Jun 20", "Draft"],
              ["Q-2055", "Mei Harlow", "Harlow Garden Birthday", "$4,280", "Jun 17", "Expiring"],
              ["Q-2051", "Noah Williams", "Northstar Annual Dinner", "$18,920", "Jun 24", "Approved"],
              ["Q-2048", "Elena Mendoza", "Mendoza–Reyes Wedding", "$14,860", "Jun 18", "Approved"],
              ["Q-2043", "Lena Park", "Park Family Anniversary", "$6,420", "Jun 14", "Revision requested"],
            ].map((row) => (
              <button
                className="quotation-row"
                key={row[0]}
                onClick={() => setQuotation(true)}
              >
                <span><strong>{row[0]}</strong><small>{row[1]}</small></span>
                <span><strong>{row[2]}</strong><small>Created Jun 10, 2025</small></span>
                <span><strong>{row[3]}</strong></span>
                <span>{row[4]}</span>
                <span>
                  <Badge
                    tone={
                      row[5] === "Approved"
                        ? "success"
                        : row[5] === "Expiring"
                          ? "danger"
                          : row[5] === "Draft"
                            ? "neutral"
                            : "warning"
                    }
                  >
                    {row[5]}
                  </Badge>
                </span>
                <Icon name="chevron" size={15} />
              </button>
            ))}
          </div>
          <div className="pagination">
            <span>Showing 5 of 18 quotations</span>
            <div><button>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div>
          </div>
        </div>
      )}

      {tab === "Menus" && (
        <div className="menu-management">
          <aside className="panel menu-categories">
            <div className="panel-title">Menu categories</div>
            {["All items", "Canapés", "Starters", "Main courses", "Sides", "Desserts", "Beverages"].map((item, index) => (
              <button className={index === 0 ? "active" : ""} key={item}>
                <span>{item}</span><small>{[126, 18, 16, 32, 21, 24, 15][index]}</small>
              </button>
            ))}
          </aside>
          <div className="panel menu-items-panel">
            <div className="table-tools">
              <div className="search-field">
                <Icon name="search" /><input placeholder="Search menu items" />
              </div>
              <select><option>All dietary types</option><option>Vegetarian</option><option>Vegan</option><option>Gluten-free</option></select>
              <Button variant="secondary">Filter</Button>
            </div>
            <div className="menu-item-list">
              {[
                ["Herb-crusted salmon", "Main course", "$24", ["Gluten-free"]],
                ["Wild mushroom risotto", "Main course", "$18", ["Vegetarian", "Gluten-free"]],
                ["Slow-braised beef short rib", "Main course", "$28", []],
                ["Citrus garden salad", "Starter", "$12", ["Vegan", "Gluten-free"]],
                ["Vanilla bean panna cotta", "Dessert", "$11", ["Vegetarian"]],
              ].map((item) => (
                <button key={item[0] as string}>
                  <span className="menu-thumb"><Icon name="box" /></span>
                  <span><strong>{item[0] as string}</strong><small>{item[1] as string}</small></span>
                  <span className="dietary-tags">
                    {(item[3] as string[]).map((tag) => <Badge tone="neutral" key={tag}>{tag}</Badge>)}
                  </span>
                  <strong>{item[2] as string}</strong>
                  <Badge tone="success">Available</Badge>
                  <Icon name="chevron" size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {quotation && (
        <div className="drawer-backdrop" onMouseDown={() => setQuotation(false)}>
          <aside
            className="detail-drawer quotation-drawer"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setQuotation(false)}>
              <Icon name="close" />
            </button>
            <div className="drawer-label">QUOTATION Q-2055</div>
            <div className="drawer-title">Harlow Garden Birthday</div>
            <p>Prepared for Mei Harlow · Valid until June 17, 2025</p>
            <div className="quotation-warning">
              <Icon name="alert" />
              <span><strong>Expires tomorrow</strong><small>Send a reminder or extend the validity date.</small></span>
            </div>
            <div className="subheading">Quotation items</div>
            <div className="drawer-quote-lines">
              <span><span><strong>Garden Social</strong><small>65 guests × $48</small></span><strong>$3,120</strong></span>
              <span><span><strong>Garden beverage station</strong><small>1 package</small></span><strong>$580</strong></span>
              <span><span><strong>Canopy & ambient lighting</strong><small>Optional add-on</small></span><strong>$420</strong></span>
              <span><span><strong>Service extension</strong><small>2 additional hours</small></span><strong>$160</strong></span>
            </div>
            <div className="drawer-quote-total">
              <span>Total</span><strong>$4,280.00</strong>
            </div>
            <div className="subheading">History</div>
            <div className="quote-history">
              <span><i></i><span><strong>Quotation sent</strong><small>June 10 · 2:42 PM by Amina Santos</small></span></span>
              <span><i></i><span><strong>Customer viewed</strong><small>June 11 · 9:18 AM</small></span></span>
              <span><i></i><span><strong>Reminder scheduled</strong><small>June 16 · 10:00 AM</small></span></span>
            </div>
            <div className="drawer-actions quotation-actions">
              <Button variant="secondary">Extend validity</Button>
              <Button
                onClick={() => {
                  setQuotation(false)
                  showToast("Reminder sent to Mei Harlow")
                }}
              >
                Send reminder
              </Button>
            </div>
          </aside>
        </div>
      )}
      {toast && <div className="toast-message"><Icon name="check" />{toast}</div>}
    </div>
  )
}

function InventoryPage() {
  const [tab, setTab] = useState<"Inventory" | "Allocations" | "Dispatches">(
    "Inventory",
  )
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [allocationOpen, setAllocationOpen] = useState(false)
  const [toast, setToast] = useState("")

  const inventory = [
    {
      name: "Ivory linen napkins",
      sku: "LIN-NAP-IVY",
      category: "Table linens",
      available: 36,
      total: 320,
      reserved: 248,
      status: "Low stock",
      event: "Northstar Dinner · 180 units",
    },
    {
      name: "Chafing dish sets",
      sku: "EQP-CHD-008",
      category: "Service equipment",
      available: 42,
      total: 64,
      reserved: 18,
      status: "Available",
      event: "Mendoza Wedding · 12 sets",
    },
    {
      name: "Portable warming cabinets",
      sku: "EQP-WRM-003",
      category: "Kitchen equipment",
      available: 0,
      total: 8,
      reserved: 4,
      status: "Fully allocated",
      event: "Northstar Dinner · 4 units",
    },
    {
      name: "Stemmed water glasses",
      sku: "GLS-WTR-012",
      category: "Glassware",
      available: 320,
      total: 600,
      reserved: 240,
      status: "Available",
      event: "Mendoza Wedding · 200 units",
    },
    {
      name: "Service carts",
      sku: "EQP-CRT-005",
      category: "Service equipment",
      available: 11,
      total: 16,
      reserved: 3,
      status: "Damaged item",
      event: "Arc & Co. Launch · 2 units",
    },
    {
      name: "Compostable dinner plates",
      sku: "CON-PLT-010",
      category: "Consumables",
      available: 840,
      total: 1200,
      reserved: 240,
      status: "Available",
      event: "Harlow Birthday · 80 units",
    },
  ]

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 2400)
  }

  return (
    <div className="content-stack inventory-page">
      <div className="page-head">
        <div>
          <div className="page-title">Inventory & resources</div>
          <p>
            Track stock, equipment condition, event allocation, dispatch, and
            returns.
          </p>
        </div>
        <div className="welcome-actions">
          <Button variant="secondary">Import inventory</Button>
          <Button icon="box">Add item</Button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Inventory value" value="$184k" detail="1,284 tracked items" />
        <StatCard label="Currently reserved" value="248" detail="Across 9 upcoming events" />
        <StatCard label="Low stock" value="7" detail="3 require action today" tone="attention" />
        <StatCard label="Utilization" value="74%" change="+6.2%" detail="this quarter" />
      </div>

      <div className="tab-row">
        {(["Inventory", "Allocations", "Dispatches"] as const).map((item) => (
          <button
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
            key={item}
          >
            {item}
            <span>{item === "Inventory" ? 1284 : item === "Allocations" ? 42 : 16}</span>
          </button>
        ))}
      </div>

      {tab === "Inventory" && (
        <div className="panel inventory-panel">
          <div className="table-tools">
            <div className="search-field">
              <Icon name="search" />
              <input placeholder="Search item, SKU, or category" />
            </div>
            <select><option>All categories</option><option>Equipment</option><option>Linens</option><option>Consumables</option><option>Glassware</option></select>
            <select><option>All availability</option><option>Available</option><option>Reserved</option><option>Unavailable</option></select>
            <select><option>All conditions</option><option>Good</option><option>Damaged</option><option>Maintenance</option></select>
          </div>
          <div className="inventory-table">
            <div className="inventory-row inventory-header">
              <span>Item</span><span>Stock</span><span>Reserved</span><span>Next allocation</span><span>Status</span><span></span>
            </div>
            {inventory.map((item) => (
              <button
                className="inventory-row"
                key={item.sku}
                onClick={() => setSelectedItem(item.name)}
              >
                <span>
                  <i className="inventory-item-icon"><Icon name="box" /></i>
                  <span><strong>{item.name}</strong><small>{item.sku} · {item.category}</small></span>
                </span>
                <span>
                  <strong>{item.available} / {item.total}</strong>
                  <i className="stock-meter"><b className={`stock-${item.status === "Low stock" ? "low" : item.status === "Fully allocated" ? "none" : "good"}`}></b></i>
                </span>
                <span>{item.reserved}</span>
                <span><strong>{item.event.split(" · ")[0]}</strong><small>{item.event.split(" · ")[1]}</small></span>
                <span>
                  <Badge
                    tone={
                      item.status === "Available"
                        ? "success"
                        : item.status === "Low stock" ||
                            item.status === "Damaged item"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {item.status}
                  </Badge>
                </span>
                <Icon name="chevron" size={15} />
              </button>
            ))}
          </div>
          <div className="pagination">
            <span>Showing 6 of 1,284 inventory items</span>
            <div><button>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div>
          </div>
        </div>
      )}

      {tab === "Allocations" && (
        <div className="allocation-layout">
          <div className="panel allocation-events">
            <div className="panel-head">
              <div><div className="panel-title">Upcoming event allocations</div><p>Next 14 days</p></div>
              <Button variant="secondary" onClick={() => setAllocationOpen(true)}>New allocation</Button>
            </div>
            {[
              ["Mendoza–Reyes Wedding", "Jun 22 · The Glass Garden", "32 / 34 ready", "94%", "success"],
              ["Northstar Annual Dinner", "Jun 24 · Orchid Hall", "28 / 32 ready", "88%", "warning"],
              ["Harlow Garden Birthday", "Jun 27 · Harlow Residence", "14 / 18 ready", "78%", "warning"],
              ["Arc & Co. Product Launch", "Jun 29 · Foundry Loft", "8 / 24 ready", "33%", "danger"],
            ].map((row) => (
              <button key={row[0]}>
                <span className="allocation-date"><Icon name="calendar" /></span>
                <span><strong>{row[0]}</strong><small>{row[1]}</small></span>
                <span className="allocation-progress">
                  <span><small>{row[2]}</small><strong>{row[3]}</strong></span>
                  <i><b className={`allocation-${row[4]}`}></b></i>
                </span>
                <Icon name="chevron" size={15} />
              </button>
            ))}
          </div>
          <aside className="allocation-side">
            <div className="panel allocation-warning">
              <span className="attention-icon danger"><Icon name="alert" /></span>
              <div className="panel-title">Double allocation prevented</div>
              <p>
                4 warming cabinets requested for Arc & Co. are already reserved
                for Northstar Dinner.
              </p>
              <button className="inline-link">Review alternatives <Icon name="arrow" size={14} /></button>
            </div>
            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">High utilization</div>
                <Badge tone="warning">3 categories</Badge>
              </div>
              <div className="utilization-list">
                <span><span><strong>Warming equipment</strong><small>June 21–25</small></span><b>100%</b></span>
                <span><span><strong>Ivory table linens</strong><small>June 22–24</small></span><b>92%</b></span>
                <span><span><strong>Service vehicles</strong><small>June 24</small></span><b>80%</b></span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {tab === "Dispatches" && (
        <div className="panel dispatch-panel">
          <div className="panel-head dispatch-head">
            <div><div className="panel-title">Dispatch & return board</div><p>Track items leaving and returning to the warehouse</p></div>
            <div className="legend"><span><i className="on-time"></i>On schedule</span><span><i className="delayed"></i>Attention</span></div>
          </div>
          <div className="dispatch-columns">
            {[
              {
                title: "Ready for dispatch",
                count: 4,
                items: [
                  ["Mendoza–Reyes Wedding", "Jun 21 · 10:00 AM", "34 item groups"],
                  ["Northstar Dinner", "Jun 23 · 12:30 PM", "32 item groups"],
                ],
              },
              {
                title: "Dispatched",
                count: 3,
                items: [
                  ["Garden Social", "Vehicle CL-04", "ETA 2:10 PM"],
                  ["Reed Graduation", "Vehicle CL-02", "Delivered 11:42 AM"],
                ],
              },
              {
                title: "Awaiting return",
                count: 2,
                items: [
                  ["Bennett Anniversary", "Due today · 5:00 PM", "2 items pending"],
                  ["Private Chef Dinner", "Overdue by 1 day", "1 service kit"],
                ],
              },
              {
                title: "Returned",
                count: 7,
                items: [
                  ["Oak & Ivy Reception", "Checked 9:15 AM", "All items returned"],
                  ["Carter Birthday", "Checked yesterday", "1 damaged item"],
                ],
              },
            ].map((column, columnIndex) => (
              <div className="dispatch-column" key={column.title}>
                <div><strong>{column.title}</strong><span>{column.count}</span></div>
                {column.items.map((item, index) => (
                  <button key={item[0]}>
                    <Badge tone={columnIndex === 2 && index === 1 ? "danger" : columnIndex === 3 ? "success" : "info"}>
                      {columnIndex === 0 ? "Packed" : columnIndex === 1 ? "In transit" : columnIndex === 2 ? "Return due" : "Checked"}
                    </Badge>
                    <strong>{item[0]}</strong>
                    <span>{item[1]}</span>
                    <small>{item[2]}</small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedItem && (
        <div className="drawer-backdrop" onMouseDown={() => setSelectedItem(null)}>
          <aside
            className="detail-drawer inventory-drawer"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setSelectedItem(null)}><Icon name="close" /></button>
            <Badge tone={selectedItem === "Ivory linen napkins" ? "danger" : "success"}>
              {selectedItem === "Ivory linen napkins" ? "Low stock" : "Available"}
            </Badge>
            <div className="drawer-title">{selectedItem}</div>
            <p>LIN-NAP-IVY · Table linens</p>
            <div className="inventory-balance">
              <div><span>Available</span><strong>36</strong></div>
              <div><span>Reserved</span><strong>248</strong></div>
              <div><span>In laundry</span><strong>36</strong></div>
              <div><span>Total</span><strong>320</strong></div>
            </div>
            <div className="subheading">Upcoming allocations</div>
            <div className="item-allocation-list">
              <span><i>22</i><span><strong>Mendoza–Reyes Wedding</strong><small>180 units · Jun 22</small></span><Badge tone="success">Packed</Badge></span>
              <span><i>24</i><span><strong>Northstar Annual Dinner</strong><small>120 units · Jun 24</small></span><Badge tone="warning">Preparing</Badge></span>
            </div>
            <div className="stock-alert-detail">
              <Icon name="alert" />
              <span><strong>Reorder recommended</strong><small>At current reservations, stock will fall 24 units below the preferred buffer.</small></span>
            </div>
            <div className="subheading">Recent activity</div>
            <div className="quote-history">
              <span><i></i><span><strong>36 units returned from laundry</strong><small>Today · 9:22 AM by Jamie Cole</small></span></span>
              <span><i></i><span><strong>120 units reserved</strong><small>Yesterday · Northstar Annual Dinner</small></span></span>
              <span><i></i><span><strong>180 units packed</strong><small>June 14 · Mendoza–Reyes Wedding</small></span></span>
            </div>
            <div className="drawer-actions">
              <Button variant="secondary">Adjust stock</Button>
              <Button onClick={() => { setSelectedItem(null); setAllocationOpen(true) }}>Allocate item</Button>
            </div>
          </aside>
        </div>
      )}

      {allocationOpen && (
        <div className="modal-backdrop" onMouseDown={() => setAllocationOpen(false)}>
          <div className="modal allocation-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setAllocationOpen(false)}><Icon name="close" /></button>
            <span className="eyebrow">Resource allocation</span>
            <div className="modal-title">Allocate inventory</div>
            <p className="modal-intro">
              Availability is checked against existing event reservations and
              dispatch windows.
            </p>
            <div className="form-grid">
              <label className="full"><span>Event</span><select defaultValue="Northstar Annual Dinner"><option>Northstar Annual Dinner</option><option>Mendoza–Reyes Wedding</option><option>Harlow Garden Birthday</option></select></label>
              <label><span>Inventory item</span><select defaultValue="Ivory linen napkins"><option>Ivory linen napkins</option><option>Chafing dish sets</option><option>Stemmed water glasses</option></select></label>
              <label><span>Quantity</span><input type="number" defaultValue="24" min="1" /></label>
              <label><span>Dispatch date</span><input type="date" defaultValue="2025-06-23" /></label>
              <label><span>Return date</span><input type="date" defaultValue="2025-06-25" /></label>
            </div>
            <div className="availability-result">
              <Icon name="check" />
              <span><strong>24 units are available</strong><small>36 available during the selected reservation window.</small></span>
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setAllocationOpen(false)}>Cancel</Button>
              <Button onClick={() => { setAllocationOpen(false); notify("24 items allocated to Northstar Annual Dinner") }}>Confirm allocation</Button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast-message"><Icon name="check" />{toast}</div>}
    </div>
  )
}

function ReportsPage() {
  const [period, setPeriod] = useState("Last 6 months")
  const [reportOpen, setReportOpen] = useState(false)

  return (
    <div className="content-stack reports-page">
      <div className="page-head">
        <div>
          <div className="page-title">Reports & performance</div>
          <p>
            Monitor booking health, event delivery, resources, feedback, and
            recorded team performance.
          </p>
        </div>
        <div className="welcome-actions">
          <select className="date-range-select" value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option>Last 30 days</option><option>Last 3 months</option><option>Last 6 months</option><option>This year</option>
          </select>
          <Button icon="chart" onClick={() => setReportOpen(true)}>Export report</Button>
        </div>
      </div>

      <div className="report-filter-note">
        <Icon name="calendar" />
        <span>Showing business activity from <strong>January 1–June 30, 2025</strong></span>
        <button>Compare period</button>
      </div>

      <div className="stats-grid">
        <StatCard label="Confirmed bookings" value="148" change="+12.4%" detail="vs previous period" />
        <StatCard label="Quoted value" value="$284k" change="+8.7%" detail="68% conversion rate" />
        <StatCard label="Events completed" value="96" change="+6.2%" detail="96% on-time completion" />
        <StatCard label="Average rating" value="4.9" change="+0.2" detail="from 68 verified reviews" />
      </div>

      <div className="report-grid">
        <div className="panel revenue-chart-card">
          <div className="panel-head">
            <div><div className="panel-title">Bookings & quoted value</div><p>Monthly confirmed bookings and quotation value</p></div>
            <div className="report-legend"><span><i></i>Confirmed bookings</span><span><i></i>Quoted value</span></div>
          </div>
          <div className="combo-chart">
            {[48, 61, 55, 72, 83, 94].map((_height, index) => (
              <div key={index}>
                <i className={`bar-height-${index + 1}`}></i>
                <b className={`line-point point-${index + 1}`}></b>
              </div>
            ))}
            <svg viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden="true">
              <polyline points="48,125 148,110 248,104 348,78 448,62 548,38" />
            </svg>
          </div>
          <div className="chart-labels"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div>
        </div>
        <div className="panel event-mix-card">
          <div className="panel-head">
            <div><div className="panel-title">Event mix</div><p>By confirmed booking type</p></div>
          </div>
          <div className="donut-wrap">
            <div className="report-donut"><span><strong>148</strong><small>bookings</small></span></div>
            <div className="donut-legend">
              <span><i className="weddings"></i><span>Weddings<small>42% · 62</small></span></span>
              <span><i className="corporate"></i><span>Corporate<small>28% · 41</small></span></span>
              <span><i className="social"></i><span>Social<small>21% · 31</small></span></span>
              <span><i className="other"></i><span>Other<small>9% · 14</small></span></span>
            </div>
          </div>
        </div>
      </div>

      <div className="report-grid lower">
        <div className="panel performance-table-card">
          <div className="panel-head">
            <div><div className="panel-title">Event delivery performance</div><p>Based on recorded schedules, tasks, and incidents</p></div>
            <button className="inline-link">View full report <Icon name="arrow" size={14} /></button>
          </div>
          <div className="performance-table">
            <div className="performance-row header"><span>Metric</span><span>Current</span><span>Target</span><span>Trend</span></div>
            <div className="performance-row"><span><strong>On-time setup</strong><small>92 of 96 completed events</small></span><span>95.8%</span><span>≥ 95%</span><Badge tone="success">+2.1%</Badge></div>
            <div className="performance-row"><span><strong>Tasks completed by deadline</strong><small>2,184 of 2,296 recorded tasks</small></span><span>95.1%</span><span>≥ 93%</span><Badge tone="success">+1.4%</Badge></div>
            <div className="performance-row"><span><strong>Incidents resolved same day</strong><small>18 of 21 recorded incidents</small></span><span>85.7%</span><span>≥ 90%</span><Badge tone="warning">-3.2%</Badge></div>
            <div className="performance-row"><span><strong>Equipment returned on time</strong><small>84 of 91 dispatches</small></span><span>92.3%</span><span>≥ 95%</span><Badge tone="danger">-1.8%</Badge></div>
          </div>
        </div>
        <div className="panel satisfaction-card">
          <div className="panel-head">
            <div><div className="panel-title">Customer feedback</div><p>Verified completed events</p></div>
            <strong>4.9</strong>
          </div>
          <div className="rating-bars">
            {[["5", 88], ["4", 9], ["3", 3], ["2", 0], ["1", 0]].map((rating) => (
              <span key={rating[0]}><small>{rating[0]} ★</small><i><b className={`rating-${rating[0]}`}></b></i><em>{rating[1]}%</em></span>
            ))}
          </div>
          <div className="feedback-quote">
            <p>“The team was calm, attentive, and perfectly on schedule. Every dietary detail was handled beautifully.”</p>
            <span><strong>Elena Mendoza</strong><small>Mendoza–Reyes Wedding · Verified booking</small></span>
          </div>
        </div>
      </div>

      <div className="panel report-library">
        <div className="panel-head">
          <div><div className="panel-title">Report library</div><p>Detailed operational and business reports</p></div>
          <div className="search-field compact"><Icon name="search" /><input placeholder="Search reports" /></div>
        </div>
        <div className="report-library-grid">
          {[
            ["Booking & quotation report", "Conversion, value, expiration, and sales activity", "chart", "Updated today"],
            ["Event completion report", "Delivery timing, tasks, delays, and completion", "clipboard", "Updated today"],
            ["Incident report", "Incident type, action, status, and resolution", "alert", "3 open incidents"],
            ["Resource utilization", "Allocation, availability, and equipment usage", "box", "Updated 2 hr ago"],
            ["Staff performance", "Recorded assignments and task completion only", "users", "Updated yesterday"],
            ["Customer feedback", "Ratings, published reviews, and recurring themes", "spark", "68 responses"],
          ].map((report) => (
            <button key={report[0]} onClick={() => setReportOpen(true)}>
              <span className="report-icon"><Icon name={report[2]} /></span>
              <span><strong>{report[0]}</strong><small>{report[1]}</small><em>{report[3]}</em></span>
              <Icon name="chevron" size={15} />
            </button>
          ))}
        </div>
      </div>

      {reportOpen && (
        <div className="modal-backdrop" onMouseDown={() => setReportOpen(false)}>
          <div className="modal report-export-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setReportOpen(false)}><Icon name="close" /></button>
            <span className="eyebrow">Export report</span>
            <div className="modal-title">Prepare business report</div>
            <p className="modal-intro">Choose the included sections and output format. Only data you have permission to view will be exported.</p>
            <div className="report-section-options">
              {["Executive summary", "Bookings & quotations", "Event completion", "Resource utilization", "Customer feedback", "Staff performance"].map((item, index) => (
                <label key={item}><input type="checkbox" defaultChecked={index < 4} /><span><strong>{item}</strong><small>{index === 5 ? "Uses recorded assignments and task completion data" : "Include current filtered period"}</small></span></label>
              ))}
            </div>
            <div className="form-grid export-options">
              <label><span>Format</span><select><option>PDF document</option><option>CSV spreadsheet</option></select></label>
              <label><span>Date range</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>Last 30 days</option><option>Last 3 months</option><option>Last 6 months</option><option>This year</option></select></label>
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setReportOpen(false)}>Cancel</Button>
              <Button icon="chart" onClick={() => setReportOpen(false)}>Generate report</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GenericPage({ page }: { page: NavKey }) {
  const content: Record<string, {
    intro: string
    cards: [string, string, string][]
  }> = {
    Calendar: {
      intro:
        "Coordinate events, staffing, transport, and resources across one shared schedule.",
      cards: [
        ["This week", "12 events", "2 scheduling conflicts"],
        ["Team coverage", "86%", "4 people unavailable"],
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
    Team: {
      intro:
        "Manage staff availability, skills, assignments, and recorded performance.",
      cards: [
        ["Active staff", "48", "42 available this week"],
        ["Assigned this week", "36", "Across 12 events"],
        ["Open shifts", "5", "2 need urgent cover"],
      ],
    },
    Reports: {
      intro:
        "Understand bookings, event performance, resources, feedback, and team delivery.",
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
        ["AI conversations", "1,248", "42 handed to a person"],
        ["Audit events", "3,904", "No critical alerts"],
      ],
    },
  }
  const info = content[page] || content.Calendar
  const adminRows =
    page === "Administration"
      ? [
          "User & role management",
          "AI knowledge base",
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
          ]
  return (
    <div className="content-stack">
      <div className="page-head">
        <div>
          <div className="page-title">{page}</div>
          <p>{info.intro}</p>
        </div>
        <Button icon={page === "Reports" ? "chart" : "clipboard"}>
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
      </div>
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
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">
              {page === "Administration"
                ? "Administration areas"
                : page === "Reports"
                  ? "Recent reports"
                  : `${page} overview`}
            </div>
            <p>Connected records and current status</p>
          </div>
          <div className="search-field compact">
            <Icon name="search" />
            <input placeholder="Search..." />
          </div>
        </div>
        <div className="management-list">
          {adminRows.map((item, index) => (
            <button key={item}>
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
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

type CustomerTab = "Home" | "My events" | "Quotations" | "Messages"

function CustomerDashboard({
  onPublic,
  onTeamPortal,
}: {
  onPublic: () => void
  onTeamPortal: () => void
}) {
  const [tab, setTab] = useState<CustomerTab>("Home")
  const [notifications, setNotifications] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)

  const customerTabs: { label: CustomerTab; icon: string }[] = [
    { label: "Home", icon: "grid" },
    { label: "My events", icon: "calendar" },
    { label: "Quotations", icon: "clipboard" },
    { label: "Messages", icon: "users" },
  ]

  return (
    <div className="customer-shell">
      <header className="customer-header">
        <button className="customer-brand-button" onClick={onPublic}>
          <Brand />
        </button>
        <nav className="customer-nav">
          {customerTabs.map((item) => (
            <button
              className={tab === item.label ? "active" : ""}
              key={item.label}
              onClick={() => setTab(item.label)}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
              {item.label === "Messages" && <b>2</b>}
            </button>
          ))}
        </nav>
        <div className="customer-header-actions">
          <button className="team-portal-link" onClick={onTeamPortal}>
            Team portal
          </button>
          <button
            className="notification-button"
            onClick={() => setNotifications(!notifications)}
            aria-label="Open notifications"
          >
            <Icon name="bell" />
            <b>2</b>
          </button>
          <div className="customer-profile">
            <span className="avatar">EM</span>
            <span>
              <strong>Elena Mendoza</strong>
              <small>Customer</small>
            </span>
            <Icon name="chevron" size={14} />
          </div>
        </div>
        {notifications && (
          <div className="notification-popover customer-notifications">
            <div className="panel-head">
              <div className="panel-title">Notifications</div>
              <button>Mark all read</button>
            </div>
            <button>
              <i></i>
              <span>
                <strong>Your booking is confirmed</strong>
                <small>
                  The Mendoza–Reyes Wedding is now confirmed for June 22.
                </small>
                <em>12 min ago</em>
              </span>
            </button>
            <button>
              <i></i>
              <span>
                <strong>New message from Amina</strong>
                <small>Your tasting appointment details are ready.</small>
                <em>1 hr ago</em>
              </span>
            </button>
            <a>View all notifications</a>
          </div>
        )}
      </header>

      <main className="customer-main">
        {tab === "Home" && (
          <div className="customer-content">
            <section className="customer-welcome">
              <div>
                <span className="eyebrow">Monday, June 16</span>
                <div className="page-title">Welcome back, Elena</div>
                <p>
                  Your celebration is coming together beautifully. Here’s the
                  latest.
                </p>
              </div>
              <Button icon="spark">Ask Clemora</Button>
            </section>

            <section className="customer-event-hero">
              <div className="customer-event-photo">
                <img src={photos.wedding} alt="Elegant wedding table setting" />
                <Badge tone="light">Confirmed</Badge>
              </div>
              <div className="customer-event-summary">
                <div className="event-kicker">Your upcoming event</div>
                <div className="customer-event-title">
                  Mendoza–Reyes Wedding
                </div>
                <div className="customer-event-meta">
                  <span>
                    <Icon name="calendar" /> Sunday, June 22, 2025
                  </span>
                  <span>
                    <Icon name="users" /> 180 guests
                  </span>
                  <span>
                    <Icon name="grid" /> The Glass Garden
                  </span>
                </div>
                <div className="days-countdown">
                  <strong>6</strong>
                  <span>days until your event</span>
                </div>
                <div className="customer-event-actions">
                  <Button onClick={() => setTab("My events")}>
                    View event details
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setMessageOpen(true)}
                  >
                    Message your manager
                  </Button>
                </div>
              </div>
            </section>

            <section className="customer-grid">
              <div className="panel customer-progress-card">
                <div className="panel-head">
                  <div>
                    <div className="panel-title">Booking progress</div>
                    <p>Everything is on track</p>
                  </div>
                  <Badge tone="success">Confirmed</Badge>
                </div>
                <div className="horizontal-steps">
                  {[
                    "Request",
                    "Quotation",
                    "Confirmed",
                    "Preparation",
                    "Event day",
                  ].map((step, index) => (
                    <div
                      className={
                        index < 2
                          ? "complete"
                          : index === 2
                            ? "current"
                            : ""
                      }
                      key={step}
                    >
                      <span>
                        {index < 2 ? (
                          <Icon name="check" size={13} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <small>{step}</small>
                    </div>
                  ))}
                </div>
                <div className="progress-update">
                  <span className="attention-icon info">
                    <Icon name="clipboard" />
                  </span>
                  <span>
                    <strong>Final guest count due June 18</strong>
                    <small>
                      Confirm your final attendance and dietary requirements.
                    </small>
                  </span>
                  <button>Review</button>
                </div>
              </div>

              <div className="panel customer-manager-card">
                <div className="panel-title">Your catering manager</div>
                <div className="manager-profile">
                  <span className="manager-avatar">AS</span>
                  <span>
                    <strong>Amina Santos</strong>
                    <small>Usually replies within 2 hours</small>
                  </span>
                  <Badge tone="success">Online</Badge>
                </div>
                <p>
                  “Hi Elena, everything is on track. I’ve sent your tasting
                  appointment details—let me know if you need anything.”
                </p>
                <Button
                  variant="secondary"
                  className="full-button"
                  onClick={() => setMessageOpen(true)}
                >
                  Continue conversation
                </Button>
              </div>
            </section>

            <section className="customer-grid lower">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-title">Next steps</div>
                    <p>Two items need your attention</p>
                  </div>
                </div>
                <div className="customer-action-list">
                  <button>
                    <span className="action-date">
                      <strong>18</strong>
                      <small>JUN</small>
                    </span>
                    <span>
                      <strong>Confirm final guest count</strong>
                      <small>
                        Currently 180 guests · Dietary details incomplete
                      </small>
                    </span>
                    <Badge tone="warning">Due in 2 days</Badge>
                    <Icon name="chevron" />
                  </button>
                  <button>
                    <span className="action-date soft">
                      <strong>19</strong>
                      <small>JUN</small>
                    </span>
                    <span>
                      <strong>Menu tasting appointment</strong>
                      <small>Clemora Studio · 3:30 PM</small>
                    </span>
                    <Badge tone="info">Scheduled</Badge>
                    <Icon name="chevron" />
                  </button>
                </div>
              </div>
              <div className="panel quote-summary-card">
                <div className="panel-head">
                  <div className="panel-title">Approved quotation</div>
                  <Badge tone="success">Approved</Badge>
                </div>
                <div className="quote-package">
                  <span>The Signature Table</span>
                  <strong>$14,860.00</strong>
                </div>
                <div className="quote-lines">
                  <span>
                    Package · 180 guests <strong>$12,960</strong>
                  </span>
                  <span>
                    Styling & equipment <strong>$1,480</strong>
                  </span>
                  <span>
                    Dietary menu additions <strong>$420</strong>
                  </span>
                </div>
                <button
                  className="inline-link"
                  onClick={() => setTab("Quotations")}
                >
                  View quotation details <Icon name="arrow" size={14} />
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === "My events" && (
          <div className="customer-content">
            <div className="page-head">
              <div>
                <div className="page-title">My events</div>
                <p>Track upcoming and completed catering bookings.</p>
              </div>
              <Button icon="calendar">Plan another event</Button>
            </div>
            <div className="tab-row">
              <button className="active">Upcoming <span>1</span></button>
              <button>Requests <span>1</span></button>
              <button>Completed <span>2</span></button>
              <button>Cancelled</button>
            </div>
            <div className="customer-event-record panel">
              <div className="event-record-top">
                <div>
                  <Badge tone="success">Confirmed</Badge>
                  <div className="customer-event-title">
                    Mendoza–Reyes Wedding
                  </div>
                  <p>Booking CLM-2048 · The Signature Table</p>
                </div>
                <div className="record-date">
                  <strong>22</strong>
                  <span>JUN 2025</span>
                </div>
              </div>
              <div className="event-record-details">
                <span><small>Venue</small><strong>The Glass Garden</strong></span>
                <span><small>Guests</small><strong>180 confirmed</strong></span>
                <span><small>Event time</small><strong>4:30–11:00 PM</strong></span>
                <span><small>Manager</small><strong>Amina Santos</strong></span>
              </div>
              <div className="event-record-footer">
                <span>
                  <Icon name="check" /> Preparation underway · 71% complete
                </span>
                <Button>Open event</Button>
              </div>
            </div>
            <div className="customer-event-record panel muted-record">
              <div className="event-record-top">
                <div>
                  <Badge tone="warning">Under review</Badge>
                  <div className="customer-event-title">
                    Mendoza Family Brunch
                  </div>
                  <p>Request QR-5821 · Submitted June 15</p>
                </div>
                <div className="record-date">
                  <strong>10</strong>
                  <span>AUG 2025</span>
                </div>
              </div>
              <div className="event-record-footer">
                <span>
                  Your catering manager is reviewing availability and menu
                  options.
                </span>
                <Button variant="secondary">View request</Button>
              </div>
            </div>
          </div>
        )}

        {tab === "Quotations" && (
          <div className="customer-content">
            <div className="page-head">
              <div>
                <div className="page-title">Quotations</div>
                <p>Review pricing, revisions, approvals, and expiration dates.</p>
              </div>
              <Button icon="clipboard">Request a quotation</Button>
            </div>
            <div className="customer-quote panel">
              <div className="customer-quote-head">
                <span>
                  <small>QUOTATION Q-2048 · REVISION 2</small>
                  <strong>Mendoza–Reyes Wedding</strong>
                  <p>Prepared by Amina Santos · Approved June 8, 2025</p>
                </span>
                <span>
                  <Badge tone="success">Approved</Badge>
                  <strong>$14,860.00</strong>
                </span>
              </div>
              <div className="customer-quote-table">
                <div><span>Item</span><span>Qty</span><span>Amount</span></div>
                <div><strong>The Signature Table</strong><span>180</span><span>$12,960.00</span></div>
                <div><strong>Classic linen & table styling</strong><span>18</span><span>$1,080.00</span></div>
                <div><strong>Wireless microphone set</strong><span>2</span><span>$400.00</span></div>
                <div><strong>Dietary menu additions</strong><span>12</span><span>$420.00</span></div>
              </div>
              <div className="customer-quote-total">
                <span>Approved total</span><strong>$14,860.00</strong>
              </div>
              <div className="event-record-footer">
                <span>Approved quotations remain visible in your event record.</span>
                <div><Button variant="secondary">Download PDF</Button><Button>View full quotation</Button></div>
              </div>
            </div>
          </div>
        )}

        {tab === "Messages" && (
          <div className="customer-content">
            <div className="page-head">
              <div>
                <div className="page-title">Messages</div>
                <p>Your conversations with the Clemora catering team.</p>
              </div>
            </div>
            <div className="customer-messages panel">
              <aside>
                <button className="active">
                  <span className="manager-avatar small">AS</span>
                  <span><strong>Amina Santos</strong><small>Your tasting appointment details...</small></span>
                  <em>10:32</em>
                </button>
                <button>
                  <span className="ai-icon"><Icon name="spark" size={15} /></span>
                  <span><strong>Clemora assistant</strong><small>Package recommendation saved</small></span>
                  <em>Jun 14</em>
                </button>
              </aside>
              <section>
                <div className="message-thread-head">
                  <span className="manager-avatar small">AS</span>
                  <span><strong>Amina Santos</strong><small>Online · Catering manager</small></span>
                  <Badge tone="success">Human support</Badge>
                </div>
                <div className="message-thread">
                  <span className="chat-time">Today</span>
                  <div className="message bot">
                    Hi Elena, everything is on track. Your tasting is confirmed
                    for Thursday at 3:30 PM at our studio.
                  </div>
                  <div className="message customer-message">
                    Wonderful, thank you. Can we review the vegetarian options
                    during the tasting?
                  </div>
                  <div className="message bot">
                    Absolutely. I’ve added that to your tasting notes and asked
                    the chef to prepare three options.
                  </div>
                </div>
                <div className="thread-input">
                  <input placeholder="Write a message to Amina..." />
                  <Button icon="arrow">Send</Button>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {messageOpen && (
        <div className="modal-backdrop" onMouseDown={() => setMessageOpen(false)}>
          <div
            className="modal compact-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setMessageOpen(false)}
            >
              <Icon name="close" />
            </button>
            <span className="eyebrow">Message your manager</span>
            <div className="modal-title">How can Amina help?</div>
            <p className="modal-intro">
              Your event context and booking reference will be included.
            </p>
            <label className="message-compose">
              <span>Message</span>
              <textarea
                defaultValue="Hi Amina, I have a question about our upcoming event."
                autoFocus
              />
            </label>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setMessageOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => { setMessageOpen(false); setTab("Messages") }}>
                Send message
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AppShell({
  onPublic,
  initialRole,
}: {
  onPublic: () => void
  initialRole: Role
}) {
  const [role, setRole] = useState<Role>(initialRole)
  const [active, setActive] = useState<NavKey>("Overview")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState(false)

  const changeRole = (nextRole: Role) => {
    setRole(nextRole)
    setActive("Overview")
  }
  const body = useMemo(() => {
    if (active === "Overview")
      return <Overview role={role} onNavigate={setActive} />
    if (active === "Bookings") return <BookingsPage />
    if (active === "Calendar") return <CalendarPage />
    if (active === "Packages") return <PackagesPage />
    if (active === "Inventory") return <InventoryPage />
    if (active === "Operations") return <OperationsPage />
    if (active === "Reports") return <ReportsPage />
    return <GenericPage page={active} />
  }, [active, role])

  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        active={active}
        onNavigate={setActive}
        collapsed={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        ></button>
      )}
      <div className="app-area">
        <header className="app-header">
          <button
            className="icon-button app-menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="global-search">
            <Icon name="search" />
            <input placeholder="Search events, customers, or bookings" />
            <span>⌘ K</span>
          </div>
          <div className="app-header-actions">
            <button className="back-site" onClick={onPublic}>
              Customer site
            </button>
            <div className="role-switcher">
              <span>Viewing as</span>
              <select
                value={role}
                onChange={(event) => changeRole(event.target.value as Role)}
              >
                {roles.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <button
              className="notification-button"
              onClick={() => setNotifications(!notifications)}
            >
              <Icon name="bell" />
              <b>3</b>
            </button>
            <div className="avatar">MA</div>
          </div>
          {notifications && (
            <div className="notification-popover">
              <div className="panel-head">
                <div className="panel-title">Notifications</div>
                <button>Mark all read</button>
              </div>
              <button>
                <i></i>
                <span>
                  <strong>Quotation approved</strong>
                  <small>Elena Mendoza approved quotation Q-2048.</small>
                  <em>8 min ago</em>
                </span>
              </button>
              <button>
                <i></i>
                <span>
                  <strong>Schedule conflict</strong>
                  <small>Two staff assignments overlap on June 24.</small>
                  <em>34 min ago</em>
                </span>
              </button>
              <button>
                <span>
                  <strong>Inventory returned</strong>
                  <small>Garden Social equipment return completed.</small>
                  <em>2 hr ago</em>
                </span>
              </button>
              <a>View notification center</a>
            </div>
          )}
        </header>
        <main className="app-content">{body}</main>
      </div>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>("public")
  const [demoRole, setDemoRole] = useState<Role>("Manager")

  const login = (role: "Customer" | Role) => {
    if (role === "Customer") {
      setView("customer")
      return
    }
    setDemoRole(role)
    setView("app")
  }

  if (view === "public") {
    return <PublicSite onEnterCustomer={() => setView("login")} />
  }
  if (view === "login") {
    return <DemoLogin onBack={() => setView("public")} onLogin={login} />
  }
  if (view === "customer") {
    return (
      <CustomerDashboard
        onPublic={() => setView("public")}
        onTeamPortal={() => setView("login")}
      />
    )
  }
  return (
    <AppShell
      onPublic={() => setView("public")}
      initialRole={demoRole}
      key={demoRole}
    />
  )
}
