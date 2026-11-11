# Clemora fishbone diagrams

## Plain fishbone for discussion

[Problems and solutions](problems-and-solutions.drawio) is the plain diagram for the three agreed problem labels. Open it in [diagrams.net](https://app.diagrams.net/). Each page has one problem at the right. The bold label at the outer end of a bone is a contributing factor. The lighter labels inward are possible solutions in Clemora's intended response.

The file has no interview codes, category boxes, or fish outline. A solution on the diagram is the intended response. It is not evidence that the response is already live, or that lost sales, quotation effort, or coordination effort have been measured.

Checked on 11 November 2026: the uncompressed file opened in the diagrams.net editor through its supported R import. All three pages showed the problem, factors, and solutions without overlapping or clipped labels.

## Cause analysis

The diagrams in this section analyse the three agreed problems for Prevail Events Management. They describe candidate causes of the process discussed in the interview, not defects in Clemora or proof of measured business losses. Solutions stay off these branches.

Open [all three pages](clemora-three-problems.drawio) in [diagrams.net](https://app.diagrams.net/), or use the individual files:

1. [Customer inquiry response](01-customer-inquiries.drawio)
2. [Quotations and changing requirements](02-quotations-and-requirements.drawio)
3. [Staff coordination and event progress](03-staff-and-event-progress.drawio)

All labels, category boxes, and connectors are native draw.io elements. The individual pages match their counterparts in the combined file.

## How to read the cause analysis

- The right-hand box states the effect to investigate. Potential lost sales are a possible consequence of delayed responses, not an established loss figure.
- `[E#]` identifies an interview-backed condition. `[H#]` identifies a proposed causal mechanism that still needs validation. Numbering restarts on each page.
- A smaller branch connects the supporting condition to its proposed mechanism; the mechanism joins the category rib, which meets the main spine. The links remain hypotheses even when a connected condition has interview evidence.
- Categories organise causes, not solutions. Planned AI support and other system responses appear below, outside the fishbone branches.
- The inquiry page covers ongoing inquiry handling, including clarification after an offer; it does not attribute every exchange to a delayed first reply.

## Evidence for each page

All timestamps below refer to Video 1 in the preserved [full interview transcription](../../../transcriptions/full-transcription.md). The [interview summary](../../PREVAIL_INTERVIEW_SUMMARY.md) distinguishes client evidence from later scope decisions.

| Page | Label | Interview-backed condition | Timestamp |
| --- | --- | --- | --- |
| Customer inquiry response | E1 | Two people handle the page and quotations. | 16:05 |
| Customer inquiry response | E2 | Staff gather event type, guest count, dates, venue, and requested services. | 07:47–08:07 |
| Customer inquiry response | E3 | Rates are common questions, and quotation preparation follows requirement collection. | 07:26–08:07 |
| Customer inquiry response | E4 | Interested customers ask for clarification after an offer. | 08:36–09:07 |
| Quotations | E1 | Event requirements and schedule are gathered before quotation preparation. | 07:47–08:07 |
| Quotations | E2 | Customers sometimes ask for additional items after the initial discussion. | 25:47–26:12 |
| Quotations | E3 | Prevail's attempted automatic quotations sometimes do not match the intended result. This refers to its interview-described attempt, not Clemora's planned AI inquiry assistant. | 17:25–17:51 |
| Quotations | E4 | The same two people handle the page and quotations. | 16:05 |
| Staff and progress | E1 | Staff are mostly on call and selected according to availability for the event date. | 02:29–04:03 |
| Staff and progress | E2 | Some events are scheduled; others arise suddenly. | 02:29 |
| Staff and progress | E3 | Status and task completion are repeatedly requested through messages. | 27:41–28:05 |
| Staff and progress | E4 | Events have assigned coordinators and group chats for sharing details. | 16:05; 27:17–27:41 |

The interview also establishes existing intake questions (22:01; 23:55) and an Excel master file shared with clients (14:00–15:05). These diagrams do not claim that Prevail has no process or records. They do not establish response-time baselines, lost-sales totals, quotation-error rates, staffing-failure rates, or the frequency of missed tasks.

## Clemora's response, separate from cause analysis

The root [product scope and implementation status](../../../README.md#product-scope) remain authoritative. Status below reflects the repository on 11 November 2026; intended benefits require evaluation.

| Problem | Intended response | Implementation boundary |
| --- | --- | --- |
| Delayed inquiry responses and potential lost sales | AI-assisted factual answers from approved business information, initial requirement collection, and human handoff. Aim to keep prospective customers engaged and reduce repetitive inquiry work. Admins retain quotation and commitment decisions. | AI replies and handoff remain planned. Reduced delay or lost sales has not been demonstrated. |
| Difficulty managing quotations and changing requirements | Request-linked conversations, private package proposals, versioned financial offers, and customer acceptance or revision requests. Admins review prices and explicitly revise offers when needed. | Core quotation and conversation workflows are implemented. Requirements-first inquiry submission remains planned. Saved quotations preserve financial offers, not full historical package or event terms. |
| Difficulty coordinating staff and tracking event progress | Operational event days, availability responses, admin-selected teams, and coordinator assignments; timed checklists and progress updates for delivery. | Event-day scheduling, availability, and assignments are implemented. Timed checklists, progress monitoring, and notifications remain planned. |

A request, quotation acceptance, or staff assignment does not by itself confirm the customer's booking or reserve a date. Payments, inventory, and supplier management remain outside scope. The staff delivery platform is undecided.

## Fishbone method and validation

The diagrams follow the emphasis on one scoped effect, possible causes, deeper process questions, knowledgeable participants, and categories suited to the work in [ASQ's fishbone procedure](https://asq.org/quality-resources/fishbone) and [CMS's fishbone guidance](https://www.cms.gov/medicare/provider-enrollment-and-certification/qapi/downloads/fishbonerevised.pdf). They avoid blame, invented statistics, feature names as causes, and defining the problem as a missing system.

Before presenting any hypothesis as a confirmed root cause, examine actual inquiry timelines, quotation revisions, availability checks, and event status messages with the people who perform the work. A diagram does not establish causal strength or demonstrate that a proposed intervention works.

The files use uncompressed XML and were checked against the official [draw.io XML schema](https://github.com/jgraph/drawio-mcp/blob/main/shared/mxfile.xsd), using draw.io's [generation reference](https://www.drawio.com/docs/reference/diagram-generation/).

Verification completed on 11 November 2026:

- All four `.drawio` files passed XML schema validation. Each individual file has one page; the combined file has three.
- Each individual page matches its counterpart in the combined file. Cell IDs are unique within each page; every vertex has bounds and every connector has endpoint geometry.
- The exact saved XML of the combined file was loaded in the live diagrams.net editor using its supported [`R` data-import format](https://www.drawio.com/docs/reference/supported-location-hash-properties/). All three pages were selected and visually inspected, including the corrected staff-status wording. The editor reports 21 shapes and 14 connectors per page.
- Complete page layouts, cause connections, effect boxes, legends, and source footers rendered without visible clipping or overlap. Native device-picker opening was unavailable in the browser tooling; this check verified the saved XML through the editor's data import rather than the operating-system file chooser.
- A separate Terra agent reviewed the cause labels against the interview and the fishbone rules. The review led to removing an unsupported attribution of status messages to the admin role.

These checks establish file structure, native diagram elements, and browser rendering. They do not establish the causal hypotheses or demonstrate business improvement.
