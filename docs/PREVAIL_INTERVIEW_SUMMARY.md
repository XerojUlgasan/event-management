# Prevail Events Management interview summary

Recorded: 2026-10-28. Source: [full transcription](../transcriptions/full-transcription.md) of two Taglish recordings ([Video 1](https://drive.google.com/file/d/1x_fuphoWiaI8RzbCqP9tvwJaAGR7wP1a/view?usp=drive_link), 35:18; [Video 2](https://drive.google.com/file/d/1LwBLv_4ysFUNDktVQoF3eg1ue7UIBPpM/view?usp=drive_link), 12:28). Times below refer to the individual videos. Some speech is marked inaudible and some speakers are unidentified, so uncertain statements are not treated as business decisions.

This note records what the interview established, what the students proposed, and what still needs confirmation. It does **not** change Clemora's approved [feature scope](FEATURES.md) or [roadmap](ROADMAP.md). The interview names **Prevail Events Management**; whether Prevail is the beneficiary for this workspace must be confirmed before using its answers as Clemora requirements.

## Important conclusions

- Prevail is an event-management company using multiple partner venues, caterers, production providers, and other suppliers. It offers all-in and narrower arrangements for many event types, including corporate events, birthdays, weddings, and seminars. Its services include venue, catering, lights and sounds, stage/LED wall, hosts, photo and video, booths, bars, food carts, and coordination. (Video 1, 04:49–06:33; 10:18–13:17)
- The immediate operational pain is preparing accurate quotations for changing customer requirements. Prevail previously offered fixed-price packages but now prefers collecting requirements first. A fixed price for a defined number of guests could coexist with custom quotations. (Video 1, 16:55–17:51; 23:28–26:12)
- The business wants a person to take over when the AI cannot answer or when the customer is ready to arrange payment. Payment itself remains a personal, outside-system process in the interview. (Video 2, 00:22–01:47; Video 1, 00:51–01:58)
- The interviewee welcomed event-team assignment and a staff mobile checklist/timeline. Detailed assignment, status, and notification rules were not agreed. (Video 1, 03:16–04:49; 27:41–28:32)
- Detailed equipment inventory is a low priority because equipment generally comes from partners. The business still coordinates with those suppliers. (Video 1, 04:49–06:33; 13:40–15:05)

## Current business flow

1. **Inquiry:** Customers commonly ask about rates or location through the business page. Staff ask for event type, date and time, guest count, preferred area or venue, whether the customer has a venue, and the requested scope (for example, all-in, catering-only, or venue-only). Two people handle the page and quotations. (Video 1, 07:06–08:36; 15:31–16:34; 21:18–22:01)
2. **Quotation and discussion:** Staff select a suitable arrangement and venue capacity, prepare and send a tailored quotation, answer clarifications, and may arrange a virtual meeting. Customer additions can require a revised arrangement and price. (Video 1, 08:07–09:07; 23:28–26:12)
3. **Site visit and payment:** After an agreement in principle, the team may conduct an ocular venue visit. If the customer proceeds, staff arrange the down payment personally and issue an official receipt. The interview does not define the payment amount, deadline, confirmation rule, or later balance handling. (Video 1, 09:07–09:44)
4. **Event planning and delivery:** Each event has a client-accessible Excel “master file” with its details, including outside suppliers the client booked independently. The coordination team contacts those suppliers. One coordinator handles each event; event details and updates are shared through a Messenger group chat. Viber is commonly used to coordinate with staff. Staff are usually on-call and selected according to date availability; there is no formal staff-assignment system. (Video 1, 02:29–04:29; 13:40–16:34; 26:54–27:41; 31:32–31:52)

The recording does not describe every step from down payment through event completion or post-event follow-up.

## Proposed system flow for validation

This is a **recommendation assembled from the interview**, not a signed-off specification:

1. A website inquiry or assistant gathers missing event details and saves one structured request.
2. The assistant reads staff-maintained package, service, pricing, policy, and availability information. It explains eligible options and records custom needs without inventing a final price or promising a date.
3. It prepares a draft quotation or a concise handoff. Authorized staff check capacity, supplier constraints, custom prices, and terms before sending a quotation. Changes create a reviewable revision.
4. Staff continue the customer conversation, meeting, and venue visit as needed. They handle payment and the official receipt outside the proposed payment gateway; any internal payment-status record requires a separate decision.
5. For an agreed event, staff maintain the event plan and supplier contacts, assign an on-call team and coordinator, and track a timeline/checklist. Customer-facing booking status and the exact point of confirmation need explicit rules.

## Feature status and boundaries

| Item | What the interview supports |
| --- | --- |
| AI answers and human handoff | The students proposed AI answers for packages, menus, prices, services, and availability. The interviewee explicitly confirmed handoff to a person when AI cannot handle a question. Answers still require an approved, maintained data source. (Video 2, 00:00–01:47) |
| Package recommendation and customization | The students proposed recommendations by budget, guests, preferences, and requirements. The interviewee explained how guest count, capacity, event details, and later changes affect real quotations and welcomed custom packages. Exact recommendation and pricing rules remain undefined. (Video 2, 01:50–02:24; Video 1, 23:28–26:12) |
| Website, management system, staff app | The students described all three and received a positive general response. This was not detailed acceptance of every screen or workflow. (Video 1, 20:33–21:18) |
| Staff assignment and event checklist | The interviewee liked manager-selected teams, staff availability responses, and task/timeline updates that reduce repeated status messages. (Video 1, 03:16–04:49; 27:41–28:32) |
| Equipment, transport, and returns | These appeared in the students' objectives, but the interviewee later said equipment tracking should not be a focus because partners supply it. Do not treat a detailed inventory module as approved. (Video 2, 02:26–02:53; Video 1, 04:49–06:33) |
| Customer booking submission and status tracking | Presented as objectives by the students; the interview does not establish the states, permissions, or point when an inquiry becomes a confirmed booking. (Video 2, 02:08–02:24) |
| Meta Business Suite integration | Prevail currently uses Business Suite, including auto replies, but its records are incomplete. The students were unsure about access and described a separate website system. The interviewee raised confidentiality and reliability concerns; no Meta access or integration was approved. (Video 2, 04:56–09:53) |
| Marketing and Telegram | Search visibility was suggested and received positively; Prevail also discussed Facebook and a new TikTok account. A Telegram bot was accepted as a possible *future* feature, while Viber and Messenger are current channels. (Video 1, 18:20–20:33; 31:32–32:15) |

Branding mentioned in the interview is **gold and black**, using Prevail's logo as the reference. (Video 1, 28:52–29:21)

## What to do and what to avoid

- **Do** obtain the sample intake questions, current packages/menus/prices, terms and conditions, and a recent real quotation with its revisions before defining assistant answers or pricing rules. The interviewee offered sample questions and terms, but the recording does not show that they were delivered. (Video 1, 22:01–23:28; 29:21–29:42)
- **Do** define who maintains business data, who approves custom quotes, how staff take over conversations, what date or resource availability means, and what constitutes a confirmed booking. Preserve an operator-controlled process if the website is unavailable.
- **Do** specify onboarding, access, backups, and support ownership. The interviewee was concerned about confidential information and becoming dependent on a system they could not operate. The students promised one year of support and fixes, but no service terms or handover process were established. (Video 2, 07:43–10:23)
- **Avoid** automated payment processing, automatic booking confirmation, invented AI prices or availability, and a detailed owned-equipment inventory as assumed requirements. Staff payment handling and partner-supplied equipment are the clearer interview boundaries. (Video 1, 00:51–01:58; 04:49–06:33)
- **Avoid** treating access to Meta Business Suite, Telegram, SEO results, or every student objective as an approved deliverable. Confirm each before dependent implementation. (Video 2, 00:00–03:47; 06:52–09:53; Video 1, 18:20–20:33; 31:32–32:15)

The early comment about lacking a BIR certificate has uncertain speaker attribution; later the interviewee says the business is BIR-registered. Do not claim Prevail lacks BIR registration from this transcript. (Video 1, 00:51–01:14; 33:41–34:02)

## Decisions needed before changing this workspace's product scope

1. Is Prevail the same beneficiary as Clemora, a replacement beneficiary, or a separate project? Clemora's [current scope](FEATURES.md) has fixed PHP packages with a configurable maximum guest count, while this interview discusses wider event types, custom prices, and a 500-guest example. (Video 1, 23:28–26:12)
2. Which parts of the proposed website, assistant, customer portal, management system, and staff app are actually in the first release? Prevail is also building its own AI setup, so define how the new assistant would fit alongside it. (Video 2, 10:23–11:12)
3. What are the approved intake fields, package rules, quotation format and revisions, availability checks, venue holds, booking states, down-payment terms, receipt process, cancellation/change rules, and supplier responsibilities?
4. Will the system remain standalone, exchange data with Meta Business Suite, or simply support staff who continue using Meta? Obtain explicit permission and a data-access plan before any integration.

Until these decisions are recorded, this document is interview evidence and a planning input. It is not proof that the proposed features are implemented or approved for Clemora.
