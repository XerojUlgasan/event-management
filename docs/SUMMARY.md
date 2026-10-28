## Summary

The interviews describe **Prevail Events Management’s** workflow and a proposed website, AI assistant, management system, and staff mobile app. The strongest needs are accurate customized quotations, a clear handoff from AI to staff, and better coordination for each event. The interviewee welcomed those ideas, but did not approve every feature presented in the students’ objectives. Source: [full transcription](/home/zxero/Downloads/full-transcription.md).

### How the business currently works

1. A customer usually asks about rates or location through the business page. Staff ask for the event type, date and time, guest count, preferred area or venue, and requested services. **Two people** handle the page and quotations. (Video 1, 07:06–08:36; 15:31–16:34)
2. Staff prepare a tailored quotation. Interested customers ask questions and may have a virtual meeting, followed by a venue visit. Once they agree, the customer makes a down payment and the business issues an official receipt. (Video 1, 08:36–09:44)
3. Each event has a client-accessible Excel “master file” containing event details, including outside suppliers. A coordinator is assigned to each event; the coordination team contacts suppliers even when the customer hired them separately. Event updates go through a Messenger group chat, while Viber is commonly used with staff. (Video 1, 13:40–16:34; 26:54–27:41; 31:32–31:52)
4. Staff are largely **on call** and selected according to availability. The business has no formal staff-assignment system. Equipment usually comes from partner venues, caterers, and other suppliers. (Video 1, 02:29–06:33)

The recording does **not** describe the full process after down payment through event completion.

### What to build around

| Priority                                        | Interview evidence                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accurate inquiry and quotation support**      | Customers change requirements. The business now prefers gathering details before pricing; a fixed package may still work for a defined guest count, with customization afterward. Its current attempt at automatic quotations is a challenge. (Video 1, 16:55–17:51; 23:28–26:12) |
| **Human handoff**                               | The interviewee confirmed that questions the AI cannot answer should reach a designated person. Payment readiness should also lead to a personal conversation with a representative. (Video 2, 00:22–01:47; Video 1, 01:14–01:58)                                                 |
| **Event team and task tracking**                | The interviewee liked manager-assigned event teams, staff availability responses, and a mobile checklist or timeline for coordinators. These need detailed rules before implementation. (Video 1, 03:16–04:49; 27:41–28:32)                                                       |
| **A website with business-managed information** | A website, management system, and staff app were discussed positively. The proposed AI would answer from information entered into that system; its data ownership and upkeep still need agreement. (Video 1, 20:33–21:18; Video 2, 04:23–04:53; 06:52–07:43)                      |

**Recommended system flow:** website inquiry → collect missing event details → check maintained packages, services, prices, terms, and availability → suggest suitable options or record a custom request → prepare a **draft** quote → staff review and send it → meeting and venue visit where needed → staff handle down payment and receipt → maintain the event plan, supplier contacts, team assignments, and checklist. This is a proposed flow assembled from the interview, **not** a fully approved specification.

### What not to assume or prioritize

- **Do not build payment processing as an agreed requirement.** The interviewee preferred handling payments personally outside the system because amounts can change. Whether staff should record payment _status_ inside the system remains to be defined. (Video 1, 00:51–01:58)
- **Do not make owned-equipment inventory a focus.** It appeared in the students’ stated objectives, but the interviewee said partner-provided equipment makes it a lower priority. Supplier coordination still matters. (Video 2, 02:26–02:53; Video 1, 04:49–06:33)
- **Do not present a suggested package as a guaranteed final price or confirmed booking.** Guest count, venue capacity, additions, and client changes affect the quote. Customer booking submission and status tracking were presented as objectives, without detailed agreement on when a booking becomes confirmed. (Video 1, 23:28–26:12; Video 2, 01:50–02:24)
- **Do not assume access to Meta Business Suite.** The business uses it, but raised confidentiality concerns; the students were unsure about integration and described a standalone website system. No access or integration decision was settled. (Video 2, 04:56–08:53)

The early remark about lacking a BIR certificate has uncertain speaker attribution. Later, the interviewee says the business **is BIR-registered**; the transcript should not be used to claim Prevail lacks registration. (Video 1, 00:51–01:14; 33:41–34:02)

### Additional ideas and decisions to settle

The interviewee was receptive to website search visibility, a staff app, and possibly a **future** Telegram bot. Gold and black are the stated brand colors. SEO, social posting, and Telegram were discussed as opportunities, not detailed delivery commitments. The business is also building its own AI setup, so the proposed assistant’s role alongside it needs clarification. (Video 1, 18:20–21:18; 28:52–29:21; 31:32–32:15; Video 2, 10:23–11:12)

Before finalizing requirements, obtain the promised sample intake questions and terms and conditions; confirm who maintains prices and policies, who approves quotes, what each booking status means, how staff accept assignments, and what happens when the system is unavailable. The students promised **one year of support**, but its responsibilities, access, training, and response arrangements were not defined. (Video 1, 22:01–23:28; 29:21–29:42; Video 2, 07:43–10:23)

**Repository scope needs a separate decision.** This interview names Prevail and includes highly customized events, including a 500-guest example. The current [Clemora feature scope](/home/zxero/Documents/projects/event_management_v2/docs/FEATURES.md) describes fixed-price packages for 30–100 guests, and the [README](/home/zxero/Documents/projects/event_management_v2/README.md) says booking, quote, and payment screens still use sample data. Treat the interview as new stakeholder evidence; first confirm whether it changes Clemora’s product scope or describes a different beneficiary. No repository files were changed.

A Luna subagent extracted the full transcript; I checked the key passages and the current scope documents before consolidating this summary.
