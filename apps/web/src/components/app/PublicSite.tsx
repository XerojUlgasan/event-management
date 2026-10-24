import { useState } from "react"
import type { SubmitEvent } from "react"
import { Badge, Brand, Button, Dialog, FormField, Icon } from "@event-management/ui"

import { packages } from "./data"

export function PublicSite({ onEnterCustomer }: { onEnterCustomer: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const submitQuote = (event: SubmitEvent<HTMLFormElement>) => {
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
          <Button onClick={onEnterCustomer}>Get started</Button>
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
            <Badge tone="cream">Events, beautifully managed</Badge>
            <div className="display-title">
              Gather well.
              <br />
              We’ll handle the rest.
            </div>
            <p>
              Plan celebrations, team gatherings, and milestone occasions with
              clear packages, shared updates, and seamless coordination.
            </p>
            <div className="hero-actions">
              <Button
                variant="light"
                onClick={() => setQuoteOpen(true)}
                icon="arrow"
              >
                Explore planning
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
              More than a checklist.
              <br />One place for every event detail.
            </div>
          </div>
          <div className="intro-copy">
            <p>
              Clemora connects package discovery, booking requests, schedules,
              team updates, and event progress in one simple experience.
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
          Thoughtful event planning and calm coordination, from first idea to
          final update.
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
        <Dialog onClose={() => setQuoteOpen(false)}>
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
                    <FormField label="Event type">
                      <select required defaultValue="">
                        <option value="" disabled>
                          Select an event
                        </option>
                        <option>Wedding</option>
                        <option>Corporate dinner</option>
                        <option>Birthday</option>
                        <option>Other</option>
                      </select>
                    </FormField>
                    <FormField label="Preferred date">
                      <input type="date" required />
                    </FormField>
                    <FormField label="Guest count">
                      <input
                        type="number"
                        placeholder="e.g. 120"
                        min="10"
                        required
                      />
                    </FormField>
                    <FormField label="Estimated budget">
                      <select defaultValue="">
                        <option value="" disabled>
                          Select a range
                        </option>
                        <option>$2,000–$5,000</option>
                        <option>$5,000–$10,000</option>
                        <option>$10,000+</option>
                      </select>
                    </FormField>
                    <FormField className="full" label="Venue or area">
                      <input placeholder="Venue name or neighborhood" />
                    </FormField>
                    <FormField className="full" label="What matters most?">
                      <textarea placeholder="Tell us about your menu preferences, atmosphere, or special requirements"></textarea>
                    </FormField>
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
        </Dialog>
      )}
    </div>
  )
}
