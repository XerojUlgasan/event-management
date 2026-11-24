// Fictional public catalog packages. Prices are fixed totals in whole PHP pesos.
export const curatedPackages = [
  {
    name: "Civil Wedding Family Table",
    description:
      "A family-style merienda reception with a shared table, short toasts and time for portraits after the civil ceremony.",
    intro:
      "Bring both families together over a long table after the signing. A three-hour reception leaves room for portraits, a few toasts and a meal everyone can linger over.",
    price: 72000,
    guests: 36,
    sections: [
      {
        title: "A shared table",
        markdown: `- Family-style merienda with two savory dishes, dessert and nonalcoholic drinks.
- Low flowers, linens and printed place cards on venue tables.
- A coordinator and one photographer for the three-hour reception.`,
      },
      {
        title: "After the signing",
        markdown: `Allow travel time between the civil ceremony and the reception. Start with family portraits while guests have refreshments, then serve merienda. Save the final half hour for two short toasts and a group photo.`,
      },
      {
        title: "Before you choose a room",
        markdown: `Ask for one long table or two facing tables with a clear aisle. Send the seating plan and dietary needs with your inquiry.

Arrange the room, ceremony fees and ceremony photography separately.`,
      },
    ],
    images: [
      {
        file: "packages/civil-wedding-toast.jpg",
        alt: "Wedding guests raise their glasses along a long table facing the couple.",
      },
      {
        file: "packages/civil-wedding-table.jpg",
        alt: "A long dining table set for a reception beneath pendant lights.",
      },
      {
        file: "packages/civil-wedding-signing.jpg",
        alt: "A bride stands behind a seated groom at a table with a marriage certificate.",
      },
    ],
  },
  {
    name: "Garden Wedding Under the Lights",
    description:
      "An outdoor ceremony and buffet reception with a floral arch, greenery and a covered backup plan.",
    intro:
      "Say your vows in the garden, then share dinner under string lights. This five-hour plan keeps the ceremony and reception at one site so guests can move between them easily.",
    price: 198000,
    guests: 100,
    sections: [
      {
        title: "From the aisle to dinner",
        markdown: `- One floral arch and light aisle styling for the ceremony.
- A Filipino buffet with dessert and nonalcoholic drinks, plus centerpieces for ten guest tables.
- A wireless microphone, reception lighting and day-of coordination.`,
      },
      {
        title: "Five hours together",
        markdown: `Begin with vows and group portraits. Offer refreshments as guests move to their tables, then serve dinner before speeches and the first dance. Leave the last hour open for dancing and farewells.`,
      },
      {
        title: "Make the rain plan first",
        markdown: `Choose a covered space with room for all 100 guests. Agree on a rain decision before setup and confirm the venue's power, ground access and sound cutoff.

Book the venue, furniture, officiant and photo or video coverage separately.`,
      },
    ],
    images: [
      {
        file: "packages/garden-wedding-aisle.jpg",
        alt: "Rows of white chairs face a floral arch on a garden lawn.",
      },
      {
        file: "packages/garden-wedding-dinner.jpg",
        alt: "Flowers and glassware line an outdoor reception table under string lights.",
      },
      {
        file: "packages/garden-wedding-place-setting.jpg",
        alt: "A close view of flowers and place settings on a rustic outdoor table.",
      },
    ],
  },
  {
    name: "Eighteen in the Spotlight",
    description:
      "A debut dinner with a dance floor, time for 18 Roses or 18 Candles, and a DJ set to close the night.",
    intro:
      "Give the debutante a proper entrance and enough space to dance. Build a four-hour evening around the traditions she wants to share, with dinner and a DJ set in the same room.",
    price: 119000,
    guests: 70,
    sections: [
      {
        title: "Dinner and the dance floor",
        markdown: `- Buffet dinner and nonalcoholic drinks.
- A portrait backdrop, guest-table accents and a clear dance area.
- An emcee, a DJ, two microphones and a coordinator for the program.`,
      },
      {
        title: "Plan the eighteen",
        markdown: `**First hour:** Arrival portraits and the debutante's entrance.

**Middle two hours:** Dinner, cake and your chosen 18 Roses or 18 Candles segments.

**Final hour:** Open the dance floor and gather for one last group photo.`,
      },
      {
        title: "Send the emcee your list",
        markdown: `Share names, pronunciations, song cues and any video file before rehearsal. Decide whether to use one tradition or keep both to short turns so dinner stays on time.

Arrange the venue, cake, formalwear and photo coverage separately.`,
      },
    ],
    images: [
      {
        file: "packages/debut-disco-dinner.jpg",
        alt: "Dinner tables under hanging disco balls and purple event lighting.",
      },
      {
        file: "packages/debut-candles.jpg",
        alt: "A young woman blows out candles on her birthday cake beside balloons.",
      },
      {
        file: "packages/debut-table-detail.jpg",
        alt: "Crystal glasses and folded napkins on a formally set dinner table.",
      },
    ],
  },
  {
    name: "Birthday Playroom Party",
    description:
      "A short indoor birthday with hosted games, colorful balloon styling and a merienda for children and grown-ups.",
    intro:
      "Start with a game children can join as they arrive. Two and a half hours gives them time to play, eat and blow out the candles before the room needs to be packed up.",
    price: 46000,
    guests: 34,
    sections: [
      {
        title: "Food and play",
        markdown: `- Pancit or spaghetti, chicken bites, fruit and juice for children, with merienda plates for adults.
- A balloon backdrop and a cake table.
- One game host with supplies for two rounds and a coordinator for the party.`,
      },
      {
        title: "Keep the games moving",
        markdown: `Start with a short group game while guests settle in. Serve merienda before the second activity, then bring everyone together for the birthday song and cake. Leave the last 20 minutes for photos and pickup.`,
      },
      {
        title: "Tell us who is coming",
        markdown: `Count adults and children in the 34 seats. Share ages, food allergies and any activity adjustments. Pick a room with a play area in sight of the adults and away from the food line.

Book the room and order the cake separately.`,
      },
    ],
    images: [
      {
        file: "packages/playroom-party-guests.jpg",
        alt: "A child in a party hat holds a balloon next to a table with a birthday cake.",
      },
      {
        file: "packages/playroom-party-balloons.jpg",
        alt: "A child sits beside a toy piano against a wall of colorful balloons.",
      },
      {
        file: "packages/playroom-party-treats.jpg",
        alt: "Cupcakes and candy arranged on a brightly colored dessert table.",
      },
    ],
  },
  {
    name: "Team Workshop and Breakouts",
    description:
      "A working day for up to six teams, with breakout supplies, lunch and a shared screen for report-backs.",
    intro:
      "Use one room for the kickoff, small-group work and the final share-out. The six-hour format gives teams time to work through a problem and leave with agreed next steps.",
    price: 96000,
    guests: 60,
    sections: [
      {
        title: "Set up for group work",
        markdown: `- Supplies for six groups, including flip charts, markers and sticky notes.
- One projector and screen, a handheld mic and an on-site coordinator.
- Buffet lunch, water and a coffee break.`,
      },
      {
        title: "A six-hour working session",
        markdown: `| Time | Activity |
| --- | --- |
| Hour 1 | Briefing and teams |
| Hours 2–5 | Breakouts and lunch |
| Hour 6 | Reports and next steps |

Give each group five minutes to report back.`,
      },
      {
        title: "Brief your facilitator",
        markdown: `Share the agenda, number of groups and any remote dial-in needs. Ask for moveable tables and test laptop audio before guests arrive.

The organizer supplies the venue, facilitators, content and any video conferencing equipment.`,
      },
    ],
    images: [
      {
        file: "packages/workshop-room.jpg",
        alt: "An audience faces two speakers and a green presentation screen.",
      },
      {
        file: "packages/workshop-breakout.jpg",
        alt: "Colleagues gather around a table with laptops and notes.",
      },
      {
        file: "packages/workshop-notes.jpg",
        alt: "A presenter stands beside a board of sticky notes while colleagues listen.",
      },
    ],
  },
  {
    name: "Recognition Night and Awards",
    description:
      "A banquet and staged awards program with an emcee, speaker sound and a clear route for honorees.",
    intro:
      "Make every name easy to hear and every award easy to present. This five-hour evening pairs a seated dinner with a rehearsed awards program and a place for honorees to take photos.",
    price: 285000,
    guests: 180,
    sections: [
      {
        title: "Banquet and awards setup",
        markdown: `- Dinner buffet, nonalcoholic drinks and centerpieces for up to 18 tables.
- A branded stage backdrop, presentation screen, two microphones and lighting.
- An emcee, a stage cue lead and a coordinator for the evening.`,
      },
      {
        title: "Call awards in batches",
        markdown: `Open with arrival photos and dinner, then cue awardees by category. Seat the next group near the stage and use a separate exit path after each photo. Reserve the final 30 minutes for the full honoree group.`,
      },
      {
        title: "What the organizer supplies",
        markdown: `Send award order, pronunciations, approved slides and any accessibility needs for rehearsal. Arrange the ballroom, stage platform, trophies and photo coverage separately.`,
      },
    ],
    images: [
      {
        file: "packages/awards-gala.jpg",
        alt: "Guests gather around banquet tables facing a blue-lit stage.",
      },
      {
        file: "packages/awards-program.jpg",
        alt: "Two people on stage face an audience seated in an auditorium.",
      },
      {
        file: "packages/awards-detail.jpg",
        alt: "Rows of gold trophy cups waiting to be presented.",
      },
    ],
  },
  {
    name: "Graduation Class Send-Off",
    description:
      "A shared meal and class program after commencement, with tribute slides and space for family photos.",
    intro:
      "Give graduates a chance to thank the people who got them here. This four-hour gathering brings classmates and families together after the school ceremony.",
    price: 165000,
    guests: 120,
    sections: [
      {
        title: "A class celebration",
        markdown: `- Buffet meal, dessert and nonalcoholic drinks.
- A school-color photo backdrop and a welcome board for class messages.
- A screen for the slideshow, two speech microphones and a coordinator.`,
      },
      {
        title: "After commencement",
        markdown: `Build in travel time from the ceremony. Open with family photos, serve the meal, then play a short class reel and invite a few speakers. Close with section photos and a full class portrait.`,
      },
      {
        title: "Keep families together",
        markdown: `Count graduates and accompanying guests in the 120 seats. Share a table plan and designate a spot for bags and gowns.

The school ceremony, venue, video editing and photography are arranged separately.`,
      },
    ],
    images: [
      {
        file: "packages/graduation-class.jpg",
        alt: "A commencement crowd gathers around a large white canopy.",
      },
      {
        file: "packages/graduation-portrait.jpg",
        alt: "A graduate in a cap and gown holds a diploma.",
      },
      {
        file: "packages/graduation-cap-toss.jpg",
        alt: "Graduates toss their caps into the air together.",
      },
    ],
  },
  {
    name: "Christening Family Lunch",
    description:
      "A relaxed Filipino lunch after the service, with a welcome table and room for godparent and family photos.",
    intro:
      "After the church service, gather ninongs, ninangs and relatives over lunch. A three-hour reception gives everyone time to eat and keeps the baby’s part of the program short.",
    price: 73000,
    guests: 55,
    sections: [
      {
        title: "A place for every generation",
        markdown: `- A Filipino buffet with rice, two main dishes, a vegetable dish and dessert.
- Nonalcoholic drinks, simple table flowers and a welcome sign.
- A reception coordinator and a styled family photo corner.`,
      },
      {
        title: "Work around the service",
        markdown: `Open the lunch room before the first guests arrive from church. Take godparent photos early, then serve lunch and leave time for a brief family thank-you. Let the baby leave the program to rest when needed.`,
      },
      {
        title: "Ask about access and timing",
        markdown: `Confirm parking, stroller access and space for a quiet feeding break. Share the church start time, travel estimate and any highchair requests.

Arrange the parish requirements, venue, cake and photography separately.`,
      },
    ],
    images: [
      {
        file: "packages/christening-family.jpg",
        alt: "Relatives gather beside a priest during a child's baptism.",
      },
      {
        file: "packages/christening-cake-table.jpg",
        alt: "A white cake and sweets on an outdoor baptism celebration table.",
      },
      {
        file: "packages/christening-filipino-food.jpg",
        alt: "Assorted Filipino dishes served in foil catering trays.",
      },
    ],
  },
  {
    name: "First Look Product Launch",
    description:
      "A brand reveal and hands-on demo with a presentation cue plan, two demo stations and a networking reception.",
    intro:
      "Show the product once on stage, then let guests try it for themselves. This four-hour standing reception keeps the reveal short and leaves room for conversations at two demo stations.",
    price: 148000,
    guests: 90,
    sections: [
      {
        title: "Reveal and demo setup",
        markdown: `- A branded welcome wall, stage backdrop and two dressed demo counters.
- Playback screen, two microphones and a technician for the reveal.
- Passed bites, nonalcoholic drinks and a floor coordinator.`,
      },
      {
        title: "Give guests time to try it",
        markdown: `Use the first 45 minutes for check-in and refreshments. Keep the reveal and remarks to half an hour, then open both stations and run short repeat demos. Leave the last half hour for follow-up conversations.`,
      },
      {
        title: "Rehearse a backup demo",
        markdown: `Send brand files, product power and network needs, and a local copy of the reveal video. Your team supplies demo units, presenters and working samples.

Arrange the venue, product transport and media coverage separately.`,
      },
    ],
    images: [
      {
        file: "packages/launch-reveal.jpg",
        alt: "An audience faces a speaker and blue screens at a presentation.",
      },
      {
        file: "packages/launch-demo.jpg",
        alt: "A presenter gestures toward equipment at a trade-show display.",
      },
      {
        file: "packages/launch-reception.jpg",
        alt: "Attendees chat in small groups around standing-height tables.",
      },
    ],
  },
  {
    name: "Seaside Sunset Dinner",
    description:
      "A small anniversary or milestone dinner with a lantern-lit table, shared plates and a quiet toast by the coast.",
    intro:
      "Gather on a beachfront terrace for sunset, then sit down together as the lanterns come on. Three hours leaves time for a shared dinner, a toast and a few unhurried family photos.",
    price: 68500,
    guests: 28,
    sections: [
      {
        title: "Dinner for twenty-eight",
        markdown: `- A shared coastal menu with grilled mains, vegetables, rice, dessert and nonalcoholic drinks.
- A styled dinner table with low arrangements and battery lanterns.
- A coordinator to time dinner, toasts and cleanup with the venue.`,
      },
      {
        title: "Count back from sunset",
        markdown: `Invite guests about 45 minutes before sunset for refreshments and group photos. Seat everyone as the light fades, then serve the shared plates and hold the toast before dessert.`,
      },
      {
        title: "Choose a sheltered fallback",
        markdown: `Confirm wind cover, step-free access and a nearby indoor option. Ask the venue about open-flame rules, access after dark and the music cutoff.

Arrange the venue, alcoholic drinks, transfers and photography separately.`,
      },
    ],
    images: [
      {
        file: "packages/seaside-sunset.jpg",
        alt: "A beach dinner table set with white linens and a blue runner at sunset.",
      },
      {
        file: "packages/seaside-dinner-table.jpg",
        alt: "A group gathers around a dining table on the beach at night.",
      },
      {
        file: "packages/seaside-dinner-detail.jpg",
        alt: "White chairs tied with red bows surround tables on a sandy beach.",
      },
    ],
  },
];
