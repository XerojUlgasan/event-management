type PackageEditorial = {
  intro: string;
  sections: Array<{ title: string; markdown: string }>;
};

// Fictional demonstration copy; prices and capacities remain on the package records.
export const packageEditorial: Record<string, PackageEditorial> = {
  "Civil Vows and Merienda": {
    intro:
      "A small civil wedding deserves a table where everyone can share the same conversation. Civil Vows and Merienda frames a three-hour gathering for up to 30 relatives and friends in cream, blush and soft greenery. The focus is the dining table and an easy transition from portraits to afternoon refreshments, with day-of coordination keeping the short program moving without making it feel hurried.",
    sections: [
      {
        title: "A table for thirty",
        markdown: `## The dining-table brief

One styled dining setup brings up to 30 guests together. Join venue-provided tables into a long table where the room allows, or form a close group of tables when a single line would obstruct service. Cream, blush and low greenery leave space for merienda dishes and for relatives to see one another.

| Design decision | Practical choice |
| --- | --- |
| Seating | Keep the couple close to family |
| Center details | Low enough for conversation |
| Service | Leave a clear path and table space |
| Access | Seat older guests near an easy route |

Share table dimensions and a seating sketch before planning the final arrangement.`,
      },
      {
        title: "Questions couples often ask",
        markdown: `## Choosing this celebration

**Can we come straight from the civil ceremony?** Yes. Treat travel between the ceremony and the gathering as separate time; the three-hour coordinated program is for the gathering itself.

**Will there be a stage or a second styled area?** The focus is one dining-table setup. A stage or additional installation requires a different arrangement.

**Can we change the table treatment?** Discuss the palette and layout with the administrator. Filipiniana Decor Accents is a separately linked optional service and is not automatically included.`,
      },
      {
        title: "An unhurried merienda",
        markdown: `## Give the afternoon room to breathe

Begin with arrival and family portraits, then settle into merienda. Reserve a short interval for a toast or a few family messages before the group photograph and farewells. In a three-hour gathering, a concise speech list protects the meal and conversation time; the coordinator follows the agreed sequence.

The layout works especially well when everyone wants to visit around a shared table. A large room or a long formal program may call for a broader package.`,
      },
      {
        title: "What to arrange",
        markdown: `## Venue and scope

Arrange the venue, food and civil ceremony fees separately. Ask the venue about a setup window, step-free access, table coverings and candle restrictions; if outdoors, identify a sheltered alternative. Discuss dietary needs with the food provider.

The package covers one dining-table styling setup and coordination for a three-hour gathering. Venue furniture is provided by the venue, not sold or rented as part of this styling package.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Industry Conference Forum": {
    intro:
      "Industry Conference Forum is a structured eight-hour conference setting for up to 200 delegates, designed around a legible arrival point and a focused plenary stage. Navy and white styling keeps the room professional while allowing the organizer's approved event identity to lead. The package combines registration and stage backdrop styling with day-of coordination for a keynote, panel, breaks and networking.",
    sections: [
      {
        title: "The delegate journey",
        markdown: `## Arrive, attend, connect

For up to 200 delegates, a clearly marked registration area gives arrivals an immediate destination. Separate the approach and exit lanes so a queue does not cross the room entrance. The navy-and-white stage backdrop anchors the plenary; an adjacent networking area can use the venue's furniture without narrowing accessible aisles.

This plan prioritizes one main room. Multiple fully styled breakout rooms need a different scope, and seating should provide clear sightlines for wheelchair users as well as the rest of the audience.`,
      },
      {
        title: "Who prepares what",
        markdown: `## Responsibility matrix

| Element | Responsibility |
| --- | --- |
| Registration styling | Package scope |
| Stage backdrop styling | Package scope |
| Eight-hour coordination | Package scope |
| Speakers and session content | Organizer |
| Venue, meals and technical equipment | Arranged separately |

Share approved branding, stage dimensions and the program order before setup. The coordinator manages the agreed event sequence; the organizer retains responsibility for the substance of the sessions.`,
      },
      {
        title: "An eight-hour working day",
        markdown: `## Program landmarks

A useful day opens with registration and a keynote, moves to a panel and lunch, then returns to afternoon sessions before a closing and networking interval. For example, allow the first 45 minutes for arrival, roughly an hour for the keynote and a full hour for lunch. Keep breaks visible in the program so 200 people can move without delaying the next session.

The exact speakers and timetable are the organizer's choices; this is a coordinated conference layout rather than a promise of a particular program.`,
      },
      {
        title: "Production and access brief",
        markdown: `## Before delegates arrive

- Check venue internet capacity, stage power, audio and projection with the parties providing them.
- Agree loading-dock access, backdrop rules and a setup window.
- Provide a floor plan showing accessible entry, registration lanes and seating.
- Place the networking zone where conversation will not compete with the stage.

Venue, catering and speakers are excluded. Additional stage construction and technical production require separate arrangements.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Garden Filipiniana Wedding": {
    intro:
      "Gather up to 120 guests for a five-hour wedding program that pairs a leafy ceremony focal point with a warm Filipino-inspired reception. Ivory, sage and woven textures bring the garden setting together without overwhelming it. Ceremony backdrop and reception-table styling are paired with day-of coordination, giving the couple a clear path from vows and family portraits to dinner and dancing.",
    sections: [
      {
        title: "A garden with Filipino detail",
        markdown: `## Ceremony and reception

A freestanding ceremony backdrop frames the vows; sampaguita-inspired accents and greenery carry the palette into the reception. For 120 guests, plan approximately twelve venue-provided tables of ten, with low arrangements that allow conversation and enough clear space for service. Woven textures introduce a Filipiniana influence without reproducing formal cultural garments or motifs.

Garden Floral Styling is a separately linked optional service, not an automatic inclusion.`,
      },
      {
        title: "A five-hour celebration",
        markdown: `## Sample sequence

| Time | Moment |
| --- | --- |
| 0:00–0:45 | Arrival and ceremony |
| 0:45–1:30 | Family portraits and transition |
| 1:30–3:00 | Seated dinner |
| 3:00–4:00 | Speeches and first dance |
| 4:00–5:00 | Dancing and farewell |

This sequence leaves the couple a useful portrait interval without asking guests to wait through an extended room reset.`,
      },
      {
        title: "Garden preparation",
        markdown: `## A comfortable outdoor setting

- Share the ceremony and dining layout, table measurements and access route before styling is planned.
- Arrange a covered indoor alternative for rain, along with safe power for evening light.
- Check venue rules for freestanding structures, ground protection and setup hours; leave accessible paths to restrooms and dining.

Furniture belongs to the venue. Consider how midday heat, insects and uneven ground affect older guests and formal clothing.`,
      },
      {
        title: "Included and separate",
        markdown: `## Planning boundaries

The package includes a ceremony backdrop, reception-table styling and coordination for five program hours. Venue hire, catering and attire are excluded. It suits a garden ceremony with a seated family reception; a fully enclosed weather structure or extensive installations beyond these focal areas requires discussion.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Coastal Sunset Wedding": {
    intro:
      "A beach ceremony and reception for up to 100 guests unfolds over five hours, with sand, pale blue and white bringing a coastal palette to the shoreline. The design pairs a ceremony backdrop with reception-table styling and coordination through vows, portraits, dinner and an evening close. It suits couples who want an open-air setting and are prepared to plan around weather and access.",
    sections: [
      {
        title: "Coastal design brief",
        markdown: `## A shoreline for 100 guests

Sand, pale blue and white connect the ceremony backdrop to roughly ten reception tables of ten. Low, weighted table accents preserve sightlines and are more suitable for a breeze than tall, loose decorations. The venue provides furniture; plan a firm accessible route between ceremony and dinner where possible.

Intimate Table Styling is a separately linked optional service and is not included automatically.`,
      },
      {
        title: "Weather decisions before styling",
        markdown: `## Choose a workable setting

| Condition | Planning response |
| --- | --- |
| Strong wind | Review safe backdrop placement |
| Rain | Use an agreed sheltered alternative |
| High tide | Keep the layout clear of the water |
| Uneven sand | Provide an accessible route |

Check the venue's permitted hours, safe anchoring and rules for generators. Do not assume that stakes or rigging are allowed. The couple and venue should agree the alternative space before the event rather than relying on a last-minute change.`,
      },
      {
        title: "Portrait priorities and flow",
        markdown: `## Make the best use of the light

The five-hour program can move from arrival and vows to family portraits, dinner, toasts and a short evening close. Decide which family groups matter most before the ceremony; a concise portrait list leaves guests less time waiting between the two settings.

Sunset varies by date and location, so the portrait interval is a planning priority rather than a guaranteed hour. If weather shifts the event indoors, a clear backdrop position still gives the family a place for photographs.`,
      },
      {
        title: "What this covers",
        markdown: `## Included and separate

Ceremony-backdrop and reception-table styling plus five-hour coordination are included. Venue, catering, travel and accommodation are excluded. Check loading access over sand, power and the shelter plan with the venue; tents, electrical rental and extensive weather protection need separate arrangements.

This package suits a couple who wants an open-air ceremony and dinner and can plan around coastal conditions.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Modern Ballroom Wedding": {
    intro:
      "Modern Ballroom Wedding gives a formal reception for up to 180 guests a clean ivory-and-gold frame. A symmetrical stage backdrop and coordinated dining tables establish a polished room without competing with the couple's entrance. Five hours of coordination follow the reception from cocktails to dinner, speeches and dancing, making this a good fit for families who prefer a structured city celebration.",
    sections: [
      {
        title: "Room composition",
        markdown: `## Formal without clutter

Plan around approximately eighteen venue tables of ten, with a clear central aisle and low centerpieces that do not hide guests across the table. The stage backdrop uses ivory panels and restrained gold accents; the couple's table can align with the backdrop for a balanced view from the room.

Table and chair provision belongs to the venue. The design favors a unified dining room over a separate ceremony installation.`,
      },
      {
        title: "Reception rhythm",
        markdown: `## Five-hour example

| Time | Moment |
| --- | --- |
| 0:00–0:45 | Cocktails and guest seating |
| 0:45–1:15 | Couple's entrance and welcome |
| 1:15–2:45 | Dinner |
| 2:45–3:45 | Family speeches and first dance |
| 3:45–5:00 | Dancing and farewell |

Build a short sound check into the venue access period before the reception starts.`,
      },
      {
        title: "Ballroom readiness",
        markdown: `## Work with the room

Ask for the ballroom floor plan, ceiling and attachment restrictions, loading dock hours and lift dimensions. Agree a setup window with the venue and maintain clear exit routes and accessible seating. Identify the stage power and microphone positions before finalizing the backdrop so cables and equipment do not obstruct the view.

Consider a quieter table location for guests who prefer conversation away from speakers.`,
      },
      {
        title: "What the package covers",
        markdown: `## Scope

Stage backdrop and dining-table styling plus coordination for the five-hour reception are included. Ballroom rental, meals, attire and entertainment contracts are separate. A ceremony setup, elaborate rigging or a longer program is outside this focused reception plan and needs its own discussion.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Tropical Debut Night": {
    intro:
      "Tropical Debut Night brings coral, palm green and warm white to a five-hour eighteenth birthday celebration for up to 120 guests. A celebrant backdrop and styled tables set the scene for portraits, debut traditions, dinner and dancing. It is a lively choice for a celebrant who wants botanical color and a recognizable focal point without filling every corner of the venue with decor.",
    sections: [
      {
        title: "The celebrant's space",
        markdown: `## Tropical, bright and personal

The backdrop frames the celebrant for portraits and formal program moments. Palm-inspired shapes and coral accents repeat across about twelve venue tables of ten, with low details that keep conversations comfortable. Choose a clear area for participants in the roses and candles to wait without blocking the entrance.

The venue supplies its furniture; a separate photo installation or outdoor structure is not part of this scope.`,
      },
      {
        title: "Five hours of milestones",
        markdown: `## Example running order

| Time | Moment |
| --- | --- |
| 0:00–0:45 | Guest arrival and portraits |
| 0:45–1:15 | Celebrant entrance and welcome |
| 1:15–2:30 | Dinner |
| 2:30–4:00 | Roses, candles and family messages |
| 4:00–5:00 | Dancing and farewell |

The eighteen traditions can be adapted to the celebrant's preferences; a shorter tribute segment leaves more time to dance.`,
      },
      {
        title: "Practical preparation",
        markdown: `## Room and rehearsal

Share the guest and participant lists, stage dimensions and an agreed program order. Check microphone access, power, load-in and venue closing time. For an open-air venue, identify a covered rain alternative and make sure the walkway to the celebrant area is accessible.

Use battery lighting where open flames are restricted and keep decor clear of exits.`,
      },
      {
        title: "Inclusions",
        markdown: `## A focused debut package

Celebrant backdrop and table styling with five hours of coordination are included. Venue, food, gown and entertainment are arranged separately. The package works well for a colorful formal program; extensive scenery, separate activity booths or extra program hours require a different scope.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Rose Gold Debut Dinner": {
    intro:
      "Rose Gold Debut Dinner is an elegant four-hour birthday celebration for up to 100 guests who prefer a seated meal and heartfelt tributes to a long stage production. Soft rose, champagne and candle-inspired light frame the celebrant backdrop and dining tables. Coordination keeps the arrival, dinner, messages and compact dance set flowing while preserving room for family conversation.",
    sections: [
      {
        title: "An intimate formal room",
        markdown: `## Rose and champagne accents

A celebrant backdrop anchors the head table, with rose-gold touches repeated across approximately ten venue tables of ten. Low arrangements and battery candle-style lights create warmth without obscuring faces. Leave a comfortable aisle for the celebrant and tribute participants; the furniture is supplied by the venue.

This layout favors a unified dining room over multiple themed installations.`,
      },
      {
        title: "Dinner and tributes",
        markdown: `## Four-hour sample

| Time | Moment |
| --- | --- |
| 0:00–0:35 | Arrival and portraits |
| 0:35–1:45 | Welcome and dinner |
| 1:45–2:45 | Family tributes |
| 2:45–3:30 | Celebrant's dance and music |
| 3:30–4:00 | Photos and farewell |

A concise tribute list gives each speaker space without delaying dinner or the dance set.`,
      },
      {
        title: "Venue details",
        markdown: `## Before the doors open

Check the stage position, microphone access, closing time and the venue's rules for candles and wall attachments. Provide table sizes and an accessible route to the head table. Agree setup and loading times in advance, and give the coordinator the final order of speakers and their seating locations.

If photographs are important, set aside a short interval before guests take their seats.`,
      },
      {
        title: "Scope and choices",
        markdown: `## Included in the demo

Celebrant backdrop and table styling plus coordination for a four-hour dinner are included. Meals, venue, wardrobe and performers are separate. This package suits a calm, dinner-led debut; a long sequence of eighteen-part traditions or an elaborate stage show may need more time and a different arrangement.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Little Explorer Birthday": {
    intro:
      "Little Explorer Birthday turns a three-hour children's party for up to 60 guests into a cheerful adventure in green, yellow and friendly animal shapes. A party backdrop and main-table styling frame the cake moment, while coordination helps the family move between welcome, games and photographs. The look is playful without relying on a licensed character or a large theatrical set.",
    sections: [
      {
        title: "A child-sized experience",
        markdown: `## Playful without a licensed character

Green, yellow and friendly animal shapes frame one party backdrop and main table for up to 60 guests. Arrange venue-provided seating around a clear play area so adults can see children while keeping exits open. Leave space for the family's own cake and keep the display stable, with small pieces and loose cords out of reach.

One focal table gives the party a cheerful identity without requiring several activity stations.`,
      },
      {
        title: "Plan around children",
        markdown: `## Build in breaks

A three-hour party can begin with a welcome snack, move into games, pause for refreshments, then bring everyone together for the cake and family photographs. The rest interval matters: young children may need quiet time, and families can join photos earlier if the celebrant becomes tired.

Choose games for the ages attending and consider nap times when setting the program. The coordinator follows the agreed sequence, leaving flexibility for the family.`,
      },
      {
        title: "Family and supervision brief",
        markdown: `## Who looks after what?

**Who supervises children?** The family or organizer arranges age-appropriate adult supervision. Coordination of the party sequence does not provide childcare.

**What should the venue offer?** Shade, accessible toilets, stroller access and a safe, level main-table position are useful. Identify a covered alternative for rain and check power and cable routes before adding music.

**What about allergies?** Tell the food provider about dietary and allergy needs; food service is arranged separately.`,
      },
      {
        title: "Included and separate",
        markdown: `## A compact party

Party-backdrop and main-table styling with three-hour coordination are included. Venue, food, cake and entertainers are excluded. Extra play structures and character appearances are separate arrangements; this package suits families who prefer a manageable backdrop-led celebration.

Share the venue setup window and the location of the play area before the final layout is agreed.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Pastel First Birthday": {
    intro:
      "Pastel First Birthday creates a gentle three-hour celebration for up to 70 guests, using peach, mint and cream around a family photo backdrop and main table. The program leaves breathing room for a young celebrant, parents and relatives to share lunch, a cake presentation and unhurried photographs. Coordination keeps the gathering simple rather than building it around a long sequence of performances.",
    sections: [
      {
        title: "Soft colors and safe spaces",
        markdown: `## Main table and portraits

A pastel backdrop marks a family photo spot and visually connects to the main display table. Place the table where parents can reach it easily, with venue-provided guest seating arranged around clear stroller routes. Keep display pieces stable and above a child's reach, while leaving room on the table for the family's own cake or desserts.

The restrained palette works especially well in a bright indoor room.`,
      },
      {
        title: "An easy afternoon",
        markdown: `## Three-hour example

| Time | Moment |
| --- | --- |
| 0:00–0:30 | Welcome and family photos |
| 0:30–1:30 | Lunch |
| 1:30–2:00 | Cake presentation |
| 2:00–2:40 | Photos and conversation |
| 2:40–3:00 | Farewell |

A flexible portrait interval allows the celebrant a break if needed; family photographs need not wait until the end.`,
      },
      {
        title: "Preparing the venue",
        markdown: `## Comfort for little guests

Check stroller access, accessible toilets and a quiet place for feeding or rest. Arrange refrigeration with the venue for any food that needs it and choose a safe, level location for the display. If celebrating outside, provide an indoor rain alternative and shade.

Share the table dimensions and setup window so decor does not interfere with the caterer's service area.`,
      },
      {
        title: "Inclusions and boundaries",
        markdown: `## A focused family party

The package includes photo-backdrop and main-table styling plus three-hour coordination. Cake, catering and venue are excluded. It suits a family lunch with a photo moment; entertainers, food service and extra installations are separate choices.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Baptism Family Lunch": {
    intro:
      "Baptism Family Lunch welcomes up to 50 relatives to a calm three-hour meal after the church service. White florals and pale blue details frame a family photo backdrop and the lunch tables, while coordination keeps a brief thank-you and group photographs moving gently. This package suits a family that wants the reception to feel personal without a formal stage program.",
    sections: [
      {
        title: "A welcoming lunch room",
        markdown: `## White, pale blue and family photographs

A modest photo backdrop gives the family a gathering point away from the restaurant entrance. Plan approximately five venue-provided tables of ten with low white floral accents and space for food service. A comfortable chair and accessible path near the photo area help older relatives join the group portrait.

Styling stays at the lunch venue; the church setting is not part of the package.`,
      },
      {
        title: "After the service",
        markdown: `## Three-hour lunch example

- **0:00–0:30** — Guests arrive and settle
- **0:30–1:45** — Lunch and conversation
- **1:45–2:00** — Family thank-you
- **2:00–2:45** — Group and family photographs
- **2:45–3:00** — Farewell

Allow travel from church before the lunch program begins; the journey can vary with traffic and family needs.`,
      },
      {
        title: "Restaurant coordination",
        markdown: `## Useful details to share

Ask the venue for table dimensions, a setup window and rules for displays. Arrange an accessible entrance, stroller space and a location for family photographs that does not interrupt other diners. Give the coordinator the anticipated arrival order and tell the restaurant about dietary requirements.

If the church and lunch venue are far apart, keep the first part of the reception flexible.`,
      },
      {
        title: "Scope",
        markdown: `## What's covered

Family photo-backdrop and lunch-table styling plus coordination for three hours are included. Church arrangements, meals and venue are excluded. It is best for a relaxed meal rather than a full entertainment program; additional church decor or travel coordination needs discussion.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Milestone Birthday Dinner": {
    intro:
      "Milestone Birthday Dinner gives up to 80 guests a grown-up four-hour celebration in deep green and warm gold. A memory backdrop and styled dining tables make room for photographs, toasts and a relaxed music set without turning the evening into a formal production. The design is particularly suited to a fiftieth birthday or another milestone where stories and conversation matter as much as the party.",
    sections: [
      {
        title: "A room for memories",
        markdown: `## Rich color, easy conversation

A memory backdrop makes a focal point for portraits and selected photographs. Across approximately eight venue tables of ten, low green and gold accents leave room for shared dishes and sightlines. The venue provides tables and chairs; place guests who want a quieter conversation away from the sound source.

A few meaningful photographs have more impact here than a crowded display of every year.`,
      },
      {
        title: "Evening flow",
        markdown: `## Four-hour example

| Time | Moment |
| --- | --- |
| 0:00–0:45 | Cocktails and arrival |
| 0:45–2:00 | Dinner |
| 2:00–2:45 | Tributes and toast |
| 2:45–4:00 | Music, photos and farewell |

The coordinator follows the agreed order and helps speakers find their moment while the family enjoys the meal.`,
      },
      {
        title: "Details to prepare",
        markdown: `## Share before setup

Provide permitted family images and captions, the seating layout and table sizes. Check lift and loading access, sound limits and venue closing time. Discuss dietary arrangements directly with the venue or caterer, and keep an accessible route to the backdrop for group photos.

Confirm that display supports do not require attaching anything to the venue walls.`,
      },
      {
        title: "What is covered",
        markdown: `## A focused dinner

Memory-backdrop and dining-table styling plus four-hour coordination are included. Food, venue and performers are excluded. This package emphasizes a seated gathering; an elaborate stage production or additional display areas would need a separate arrangement.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Team Workshop Day": {
    intro:
      "Team Workshop Day organizes a practical eight-hour working session for up to 60 attendees. Bright blue and neutral accents identify registration and breakout areas while keeping the room uncluttered for discussion. Coordination supports the transitions between plenary, lunch, group exercises and the closing recap. It suits teams that need a legible room plan and collaborative space more than a decorative stage.",
    sections: [
      {
        title: "Six groups, one shared room",
        markdown: `## Zone plan for 60 attendees

| Zone | Suggested use |
| --- | --- |
| Welcome | Registration and orientation |
| Plenary | Presentation point visible to all |
| Six group areas | Around ten participants each |
| Circulation | Accessible routes between groups |

Use venue-provided tables and chairs; keep the work surfaces open for notes and laptops. Blue and neutral accents distinguish registration and breakout areas without distracting from the exercise. If groups need acoustic privacy, check whether the venue offers separate rooms before choosing this open plan.`,
      },
      {
        title: "Facilitation and support",
        markdown: `## A clear division of work

**The organizer or facilitator** designs the exercises, supplies materials, leads discussions and decides what the team should produce.

**The package** styles the registration and breakout areas and coordinates the agreed eight-hour workshop sequence. It does not provide a facilitator, venue, meals or technical equipment.

Share the group assignments and transitions before the day so participants can find the next activity without losing workshop time.`,
      },
      {
        title: "Design the working day",
        markdown: `## Time for discussion

An eight-hour agenda can open with registration and a morning plenary, then move through an exercise, lunch, afternoon group work and a closing recap. Schedule a short break in each working block. Allow enough time for groups to report back; a long plenary leaves less room for the collaborative work this layout is intended to support.

The coordinator follows the organizer's running order and helps transitions between shared and group sessions.`,
      },
      {
        title: "Room readiness",
        markdown: `## Before setup

- Check Wi-Fi capacity, power outlets, projector sightlines and acoustics with the venue.
- Agree the setup window and a place for bags outside the walkways.
- Provide the group count, accessible seating requirements and the intended room layout.
- Arrange meals and workshop supplies separately.

A conference stage or several independently styled rooms is beyond this focused workshop arrangement.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Product Launch Evening": {
    intro:
      "Product Launch Evening frames a four-hour reveal and networking event for up to 120 guests in black, silver and a single accent color. Reveal-area and photo-backdrop styling give the product a clear moment of attention, while coordination helps the team move from arrival to demonstration and conversation. It suits a concise launch where the product and presentation remain the main attraction.",
    sections: [
      {
        title: "Choose the reveal",
        markdown: `## A focused launch for 120 guests

Black, silver and one approved accent color frame the reveal area; a separate photo backdrop gives guests a place to take pictures without interrupting the demonstration. Plan a circulation loop using venue furniture so people can move between both areas. The product and any fabricated display are supplied separately.

**One reveal or several?** This four-hour package favors one clear product moment. Multiple installations or a full exhibition build need a different scope.`,
      },
      {
        title: "Cue sheet",
        markdown: `## An example for the coordinator

| Cue | What happens |
| --- | --- |
| Doors open | Guests enter and orient themselves |
| Welcome | Host introduces the reveal |
| Reveal | Product takes the focal point |
| Demo | Organizer presents product details |
| Networking | Guests visit the photo area and mingle |
| Close | Host gives the final announcement |

Hold the technical rehearsal before doors open, within the venue's agreed access window. Share cue owners and the running order with the coordinator.`,
      },
      {
        title: "Reveal decision checklist",
        markdown: `## Prepare before choosing a layout

- Provide approved artwork, product dimensions and the route by which the product will arrive.
- Ask the venue about power load, loading access and rigging restrictions.
- Locate the reveal so guests using mobility aids have both a clear route and a view.
- Decide where photographs will happen without obstructing the demonstration.

A large or fragile product may require separate handling and production planning; the styled backdrop does not provide fabrication or technical equipment.`,
      },
      {
        title: "Responsibilities and boundaries",
        markdown: `## What is included

Reveal-area and photo-backdrop styling plus four-hour coordination are included. Venue, food, product fabrication and talent are excluded. The organizer supplies the product, brand approvals and demonstration content; technical production is arranged separately.

The restrained setting suits a concise reveal where the product remains the focus, rather than an immersive multi-room exhibition.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Alumni Homecoming": {
    intro:
      "Alumni Homecoming welcomes up to 150 former classmates to a five-hour reunion built around a memory display, dinner and conversation. School-inspired colors can suggest a shared history without reproducing official marks. Styled dining tables and coordination make room for registration, batch photographs, short messages and dancing, while a quieter seating area helps guests reconnect at their own pace.",
    sections: [
      {
        title: "Reconnect by batch",
        markdown: `## Memory display and dinner

A display of permitted class photographs introduces the evening; label images by batch or year so guests can find familiar faces. Plan around fifteen venue-provided tables of ten, with simple color accents and space for name cards. Place the display away from the entrance queue and keep a quiet table area apart from speakers.

The layout favors mingling over a highly formal stage set.`,
      },
      {
        title: "Five hours together",
        markdown: `## Example program

| Time | Moment |
| --- | --- |
| 0:00–0:45 | Registration and class photos |
| 0:45–2:15 | Welcome and dinner |
| 2:15–3:15 | Batch messages |
| 3:15–4:30 | Dancing and conversation |
| 4:30–5:00 | Group photo and farewell |

Keep batch messages short to leave time for the conversations that bring people back together.`,
      },
      {
        title: "Preparing the reunion",
        markdown: `## Guest comfort and permissions

Seek permission to use old photographs and any school identity. Share the batch list, display materials and table plan in advance. Check parking, accessible entrances, sound limits, setup access and a route to the display for older guests.

The venue provides tables and chairs; any printed reunion materials are arranged separately.`,
      },
      {
        title: "Included and excluded",
        markdown: `## Scope

Memory-display and dining-table styling plus five-hour coordination are included. Venue, meals and performers are excluded. Additional exhibition structures, a large stage production or extended entertainment need a separate arrangement.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Golden Anniversary Lunch": {
    intro:
      "Golden Anniversary Lunch celebrates fifty years together with up to 60 family members and friends over a relaxed three-hour meal. Champagne and gold accents frame a memory backdrop and dining tables, making the couple's story the centerpiece without demanding a long program. A welcome, lunch, family tributes and a toast leave generous time for conversation and photographs across generations.",
    sections: [
      {
        title: "A family tribute brief",
        markdown: `## Celebrate fifty years together

The memory backdrop can hold a small, family-provided selection of photographs. Choose images that tell a few recognizable chapters of the couple's life and add names or short captions. Champagne and gold accents carry the celebration to roughly six venue-provided tables of ten, with low details that leave guests able to see and hear each other.

Give the couple a comfortable seated place near the backdrop for photographs and greetings.`,
      },
      {
        title: "Comfort and accessibility",
        markdown: `## Plan for a relaxed visit

| Need | Planning choice |
| --- | --- |
| Easy arrival | Step-free entrance and route |
| Comfortable seating | Chairs near the photo area |
| Clear conversation | Low table accents |
| Shorter standing time | Seated portraits where useful |

Check restroom proximity, venue setup access and rules on candles or wall attachments. Battery lighting and freestanding supports are useful choices where open flames and attachments are restricted.`,
      },
      {
        title: "The tributes",
        markdown: `## Give family voices room

A three-hour lunch can begin with a welcome and portraits, continue through a seated meal, then pause for a few family tributes and a toast. Choose a small number of speakers and invite them to prepare one memory each. This leaves time for the couple to greet guests individually and for relatives to take group photographs without rushing.

The coordinator follows the agreed sequence; the family chooses the stories and supplies the photographs.`,
      },
      {
        title: "Scope and arrangements",
        markdown: `## What the package covers

Memory-backdrop and dining-table styling plus coordination for the three-hour lunch are included. Venue and meals are excluded. Share table dimensions, permitted photos and the speaker order before setup.

This arrangement suits a family that values conversation and a gentle pace; extensive entertainment or a separate ceremony needs discussion.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Barangay Community Celebration": {
    intro:
      "Barangay Community Celebration brings up to 180 neighbors together for a four-hour daytime gathering with a clear stage backdrop and welcoming arrival area. Colorful local-inspired details keep the setting festive while leaving the program flexible for community performances, a meal break and acknowledgments. Coordination helps the transitions feel orderly for families, elders and participants arriving throughout the day.",
    sections: [
      {
        title: "A shared public space",
        markdown: `## Welcome and stage

A visible welcome area helps guests find the program and seating; a stage backdrop identifies the performance point. Arrange venue-provided seating in manageable groups for up to 180, keeping wide access routes and clear views for children and wheelchair users. Color can come from simple banners and accents rather than obstructing the open stage.

The design does not assume the use of official seals or community artwork without permission.`,
      },
      {
        title: "A daytime program",
        markdown: `## Four-hour example

- **0:00–0:30** — Welcome and arrival
- **0:30–1:30** — Community performances
- **1:30–2:15** — Meal break
- **2:15–3:30** — Performances and participation
- **3:30–4:00** — Acknowledgments and closing

A flexible second performance block allows participants to change over without crowding the stage.`,
      },
      {
        title: "Permission and access",
        markdown: `## Organize the space

Obtain public-space permissions and arrange any required permits. Identify rain shelter, accessible entry and exit routes, safe power distribution, toilets and crowd circulation. Share the stage dimensions, performance order and venue access window with the coordinator.

For outdoor seating, plan shade and water through the organizer; keep electrical connections away from public paths.`,
      },
      {
        title: "Scope",
        markdown: `## What is included

Stage-backdrop and welcome-area styling with four-hour coordination are included. Venue or public-space costs, permits, meals and performers are excluded. The package is a focused shared program, not an end-to-end public event production; sound systems, safety staffing and extra structures require separate arrangements.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Graduation Family Gathering": {
    intro:
      "Graduation Family Gathering brings up to 50 guests together for a three-hour celebration after the ceremony. Navy, cream and a touch of gold frame a photo backdrop and dessert table, giving the graduate a place to share achievements with family and friends. The program centers on a meal, a few short speeches and photographs, leaving the formality of the school ceremony behind.",
    sections: [
      {
        title: "Celebrate the graduate",
        markdown: `## Photo and dessert focal points

Place the photo backdrop where family groups can gather without blocking the entrance. The dessert table carries the navy-and-cream palette and leaves space for food supplied by the family. Venue-provided seating can be arranged for five groups of ten, with an accessible path between the tables and portrait area.

Use personal photographs or a simple name treatment rather than reproducing official credentials.`,
      },
      {
        title: "After the ceremony",
        markdown: `## Three-hour example

| Time | Moment |
| --- | --- |
| 0:00–0:30 | Arrival and welcome |
| 0:30–1:30 | Family meal |
| 1:30–2:00 | Short speeches |
| 2:00–2:45 | Photos and dessert |
| 2:45–3:00 | Farewell |

Allow separate travel time from the graduation ceremony; keep the first photographs flexible if guests arrive at different times.`,
      },
      {
        title: "Before guests arrive",
        markdown: `## Venue details

Check parking, setup access, table dimensions and an indoor rain alternative. Arrange any food storage with the venue, and select a level, accessible position for the backdrop. Share the speaker order and approved photographs with the coordinator.

If several graduates are celebrating, agree how the portrait and speech time will be shared.`,
      },
      {
        title: "What is included",
        markdown: `## A compact celebration

Photo-backdrop and dessert-table styling plus three-hour coordination are included. Venue, food, desserts and printed credentials are excluded. The package suits a personal family gathering; additional themed displays or a formal awards production require separate discussion.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Silver Reunion Dinner": {
    intro:
      "Silver Reunion Dinner marks 25 years since a school batch shared a classroom, bringing up to 100 classmates together for a four-hour meal. Silver and midnight blue give the room a celebratory identity, while a photo display and styled dining tables encourage stories across the years. Short class tributes, a dance set and a group photograph fit around the main event: reconnecting.",
    sections: [
      {
        title: "A quarter-century of stories",
        markdown: `## Photo display and tables

Group permitted old photographs by year or class and add simple captions that help guests remember names. Around ten venue-provided tables of ten create comfortable conversation groups; low silver accents preserve sightlines. Place the display where it can be viewed throughout dinner without creating a queue at the entrance.

Leave space for classmates to move between tables and greet friends.`,
      },
      {
        title: "A four-hour reunion",
        markdown: `## Example sequence

| Time | Moment |
| --- | --- |
| 0:00–0:40 | Welcome and photo display |
| 0:40–1:50 | Dinner |
| 1:50–2:35 | Class tributes |
| 2:35–3:30 | Dancing and conversation |
| 3:30–4:00 | Group photo and farewell |

A group photo before the closing rush gives guests a clear reason to gather together.`,
      },
      {
        title: "Details for organizers",
        markdown: `## Prepare the materials

Obtain permission for old photographs and any school marks, and provide captions before setup. Check sound curfew, venue access, accessible seating and adequate lighting at the display. Share the table plan and the list of speakers with the coordinator.

A quiet table away from the music is useful for guests who prefer catching up over dancing.`,
      },
      {
        title: "Scope",
        markdown: `## Dinner-led by design

Photo-display and dining-table styling plus coordination for four hours are included. Venue, food and entertainment are excluded. This package favors an easy seated reunion; a large exhibition, separate stage installation or extended dance program requires a different arrangement.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Lantern Garden Anniversary": {
    intro:
      "Lantern Garden Anniversary is a four-hour garden dinner for up to 70 guests, with ivory, greenery and warm lantern-style accents. A photo backdrop and styled dining tables provide a gentle setting for sunset portraits, a family meal and toasts. It suits couples who want a relaxed outdoor anniversary celebration and can arrange a weather-safe alternative for their guests.",
    sections: [
      {
        title: "Warm light among greenery",
        markdown: `## A garden dinner setting

A photo backdrop creates a family portrait point, while approximately seven venue tables of ten carry low greenery and ivory details. Lantern-style accents create warmth without assuming open flames are permitted. Keep a clear, stable route between portraits, dining and restrooms, especially as the light changes.

Venue furniture is provided separately; the design concentrates on the photo area and dining tables.`,
      },
      {
        title: "From portraits to toast",
        markdown: `## Four-hour example

| Time | Moment |
| --- | --- |
| 0:00–0:40 | Welcome and portraits |
| 0:40–2:00 | Dinner |
| 2:00–2:40 | Family toasts |
| 2:40–4:00 | Conversation and photographs |

Actual sunset varies by date; the portrait window can move within the program to suit the location.`,
      },
      {
        title: "Outdoor readiness",
        markdown: `## Light, power and weather

Identify an indoor or covered rain alternative and check the venue's outdoor power and lighting rules. Share table dimensions, setup access and permitted attachment points; use safe freestanding placements where required. Ensure paths remain accessible and visible after dark.

Arrange electrical rental separately if the venue cannot provide the required power.`,
      },
      {
        title: "Scope and exclusions",
        markdown: `## Included in the package

Photo-backdrop and dining-table styling with four-hour coordination are included. Venue, catering and electrical rental are excluded. It is a dinner-and-portrait treatment rather than a full garden installation; structures, extra lighting production and longer hours require discussion.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "Heritage Family Gathering": {
    intro:
      "Heritage Family Gathering makes space for up to 80 relatives to share lunch, photographs and stories over four hours. Warm neutrals and woven textures offer a Filipino-inspired backdrop for a family photo display and styled dining tables. The day is deliberately unhurried, with time for children, elders and relatives meeting again to move between conversation and group pictures.",
    sections: [
      {
        title: "Collect the family story",
        markdown: `## A display with meaning

Choose family-provided photographs that relatives consent to share, then add names, relationships or short captions so younger guests can place each story. A stable family photo display becomes a conversation starter rather than a formal exhibition. Warm neutrals and woven textures support the Filipino-inspired setting; select details that feel right to the family rather than assuming one tradition represents everyone.

Place the display where people can view it without crowding the entrance.`,
      },
      {
        title: "Make every generation comfortable",
        markdown: `## Access and seating brief

- Use approximately eight venue-provided tables of ten, with low accents that preserve conversation.
- Keep a step-free route between tables, display and restrooms; locate comfortable seating nearby for elders.
- Set aside a quieter area and leave safe space for children to move.
- Choose a covered weather alternative if the gathering is outdoors.

The family photo display and dining tables are the styled focal points; venue furniture is provided separately.`,
      },
      {
        title: "How stories fit the day",
        markdown: `## Four unhurried hours

Begin with introductions and lunch, then invite a few relatives from different generations to share short memories. Follow with family group photographs and open conversation. Providing a few starting prompts—such as where the family first gathered or a favorite shared celebration—can help speakers prepare without requiring every guest to present.

Allow extra time for large family groups to assemble, and provide a seated option for anyone who needs it.`,
      },
      {
        title: "Scope and preparation",
        markdown: `## Before the gathering

Share the photo selection, captions, table plan and setup window. The package includes family photo-display and dining-table styling plus four-hour coordination. Venue and meals are excluded; extensive family-history production or additional activity areas requires separate discussion.

It is a good fit for a conversation-led reunion, especially when the family wants to bring its own stories into the room.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "The Grand Celebration": {
    intro:
      "The Grand Celebration is a formal five-hour wedding reception for up to 150 guests, designed around a reception backdrop and styled dining tables. Ivory and soft greenery create a calm setting for a couple's entrance, family speeches and dancing. The room is built for a large seated family gathering, with coordination to carry the evening from cocktails through the final farewell.",
    sections: [
      {
        title: "Reception setting",
        markdown: `## Ivory, greenery and a clear focal point

A reception backdrop frames the couple's entrance and formal photographs. Approximately fifteen venue tables of ten can be styled with low greenery and ivory details, keeping conversation and service paths open. A central aisle connects the entrance and focal point; reserve accessible seating with a clear view for family members who need it.

Tables and chairs are supplied by the venue, not by this package.`,
      },
      {
        title: "An evening together",
        markdown: `## Five-hour sample

| Time | Moment |
| --- | --- |
| 0:00–0:45 | Cocktails and arrival |
| 0:45–1:15 | Couple's entrance |
| 1:15–2:45 | Seated dinner |
| 2:45–3:45 | Family speeches and first dance |
| 3:45–5:00 | Dancing and farewell |

Keep the speaker list concise so dinner and dancing both have room in the program.`,
      },
      {
        title: "Preparing the venue",
        markdown: `## Before the reception

Share the floor plan, table dimensions, speaker order and backdrop position. Check loading times, power, accessible entrances and the venue's rules for freestanding structures. If portraits are planned outdoors, arrange a rain-safe alternative and allow travel between photo and reception areas.

A sound check should fit within the agreed venue access window.`,
      },
      {
        title: "Included and separate",
        markdown: `## Scope

Reception-backdrop and table styling plus coordination for five hours are included. Venue, meals and attire are excluded. The package is centered on the reception; a separate ceremony installation, elaborate production or additional hours require discussion.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "The Intimate Gathering": {
    intro:
      "The Intimate Gathering offers a warm, neutral dining setting for up to 50 guests celebrating a civil wedding, anniversary or family milestone. Dining-table styling and three hours of coordination keep the focus on a relaxed meal, family toasts and photographs. This is a flexible choice for a small celebration that values shared conversation over a large stage or heavily scheduled program.",
    sections: [
      {
        title: "One welcoming dining area",
        markdown: `## A table-led celebration

Use warm neutral linens and low accents across the venue's dining tables, planned for approximately five groups of ten or an equivalent shared arrangement. Keep sightlines open and reserve space for dishes, a toast and comfortable movement between seats. Venue tables and chairs are provided separately.

The restrained palette can suit a wedding lunch or a family anniversary without changing the character of the room.`,
      },
      {
        title: "Three easy hours",
        markdown: `## Example program

- **0:00–0:30** — Arrival and welcome
- **0:30–1:45** — Seated meal
- **1:45–2:15** — Family toasts
- **2:15–3:00** — Photographs and farewell

For a civil wedding, allow separate travel time after the ceremony before guests gather for the meal.`,
      },
      {
        title: "Preparing your table",
        markdown: `## Useful details

Provide table dimensions, the seating plan and the venue's setup window. Check step-free access, room for service and restrictions on candles or table coverings. Discuss dietary needs with the venue or caterer and identify a convenient spot for family photographs.

A shared long-table arrangement works best when the room is wide enough to preserve an accessible service route.`,
      },
      {
        title: "Scope and choices",
        markdown: `## What is included

Dining-table styling and coordination for a three-hour program are included. Venue and food are excluded. This package concentrates on the meal; a dedicated backdrop, ceremony styling or extended reception needs a separate arrangement.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
  "The Sweet Soirée": {
    intro:
      "The Sweet Soirée gives a birthday or debut for up to 80 guests a bright peach-and-cream setting over four hours. A photo backdrop and styled dessert table create a focal point for the celebrant, while coordination carries the gathering from arrival and a meal through tributes, cake and photographs. It suits a family that wants a soft palette and a compact, friendly program.",
    sections: [
      {
        title: "A sweet focal point",
        markdown: `## Photo backdrop and dessert table

A peach-and-cream backdrop frames photographs beside a dessert display, leaving enough clear surface for food provided by the family. Arrange approximately eight venue tables of ten around an open route to the display. Keep the table stable, accessible and away from direct heat; venue furniture is provided separately.

Choose a few coordinated accents so the cake and family photographs remain visible rather than lost among decorations.`,
      },
      {
        title: "A four-hour celebration",
        markdown: `## Example sequence

| Time | Moment |
| --- | --- |
| 0:00–0:40 | Arrival and portraits |
| 0:40–1:50 | Meal |
| 1:50–2:35 | Celebrant tributes |
| 2:35–3:00 | Cake moment |
| 3:00–4:00 | Photographs, mingling and farewell |

A short tribute list gives the celebrant time to visit with guests after the cake presentation.`,
      },
      {
        title: "Display and venue needs",
        markdown: `## Prepare the setting

Check refrigeration and food-handling arrangements with the venue, as well as available power and the display table's dimensions. Provide an accessible route for photographs and a rain backup for an outdoor venue. Share the planned cake delivery time and the order of family messages.

Keep food service and decorative materials separate so the display can be used comfortably.`,
      },
      {
        title: "Scope",
        markdown: `## Included and arranged separately

Photo-backdrop and dessert-table styling plus four-hour coordination are included. Desserts, venue and meals are excluded. The package is a focused birthday setting; catering, entertainment and a larger stage production require separate arrangements.

Illustrative demo scope; final arrangement requires administrator review.`,
      },
    ],
  },
};
