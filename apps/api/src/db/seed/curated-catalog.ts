import { storedSectionsSchema } from "@event-management/contracts/catalog-canvas";
import { packageEditorial } from "./package-editorial.js";
import { serviceEditorial } from "./service-editorial.js";

type CatalogEditorial = {
  intro: string;
  sections: Array<{ title: string; markdown: string }>;
};

export type CatalogCopy = CatalogEditorial & {
  name: string;
  description: string;
  photo: string;
  alt: string;
};

type PackageCopy = CatalogCopy & { price: number; guests: number };

type ServiceCopy = CatalogCopy & {
  rate: number;
  fixed: number | null;
  hours: number | null;
};

// Listing facts and editorial copy are separate: customer pages own their prose,
// while these existing fictional prices, capacities and rates stay authoritative.
const photos = {
  "catalog-greenery": {
    photo: "/images/catalog-greenery.jpg",
    alt: "A reception table set with leafy centerpieces, white chairs, and purple napkins.",
  },
  dinner: {
    photo: "/images/dinner.jpg",
    alt: "Illustrative dinner event setting",
  },
  "catalog-coastal": {
    photo: "/images/catalog-coastal.jpg",
    alt: "Wooden chairs with pink bows face a floral wedding arch beside the sea.",
  },
  "catalog-ballroom": {
    photo: "/images/catalog-ballroom.jpg",
    alt: "Round tables with white chairs and floral arrangements beneath a chandelier in a reception hall.",
  },
  "catalog-birthday": {
    photo: "/images/catalog-birthday.jpg",
    alt: "Pink and white balloons and paper decorations in a child's playroom.",
  },
  "catalog-conference": {
    photo: "/images/catalog-conference.jpg",
    alt: "A white lectern with a microphone in front of rows of empty chairs.",
  },
  hero: { photo: "/images/hero.jpg", alt: "Illustrative hero event setting" },
  dessert: {
    photo: "/images/dessert.jpg",
    alt: "Illustrative dessert event setting",
  },
  "catalog-dj": {
    photo: "/images/catalog-dj.jpg",
    alt: "A DJ working at a mixer under red lighting.",
  },
  wedding: {
    photo: "/images/wedding.jpg",
    alt: "Illustrative wedding event setting",
  },
};

type PhotoName = keyof typeof photos;

const packages: Array<
  [
    name: string,
    price: number,
    guests: number,
    photo: PhotoName,
    description: string,
  ]
> = [
  [
    "Garden Filipiniana Wedding",
    145000,
    120,
    "catalog-greenery",
    "A Filipiniana wedding with sampaguita accents and a leafy garden reception. Fictional demo concept.",
  ],
  [
    "Civil Vows and Merienda",
    48000,
    30,
    "dinner",
    "An intimate civil wedding followed by an afternoon merienda. Fictional demo concept.",
  ],
  [
    "Coastal Sunset Wedding",
    172000,
    100,
    "catalog-coastal",
    "A sunset wedding reception inspired by the coast. Fictional demo concept.",
  ],
  [
    "Modern Ballroom Wedding",
    215000,
    180,
    "catalog-ballroom",
    "A formal city ballroom wedding in ivory and gold. Fictional demo concept.",
  ],
  [
    "Tropical Debut Night",
    130000,
    120,
    "catalog-greenery",
    "A tropical debut with a bright botanical palette. Fictional demo concept.",
  ],
  [
    "Rose Gold Debut Dinner",
    118000,
    100,
    "catalog-ballroom",
    "A rose gold debut and family dinner. Fictional demo concept.",
  ],
  [
    "Little Explorer Birthday",
    52000,
    60,
    "catalog-birthday",
    "A children's adventure birthday with playful color. Fictional demo concept.",
  ],
  [
    "Pastel First Birthday",
    58000,
    70,
    "catalog-birthday",
    "A pastel first birthday with a dessert table. Fictional demo concept.",
  ],
  [
    "Baptism Family Lunch",
    46000,
    50,
    "dinner",
    "A baptism celebration with a quiet family lunch. Fictional demo concept.",
  ],
  [
    "Milestone Birthday Dinner",
    76000,
    80,
    "dinner",
    "An elegant milestone birthday dinner. Fictional demo concept.",
  ],
  [
    "Team Workshop Day",
    65000,
    60,
    "catalog-conference",
    "A practical corporate workshop and breakout day. Fictional demo concept.",
  ],
  [
    "Industry Conference Forum",
    195000,
    200,
    "catalog-conference",
    "A business conference with a plenary and networking area. Fictional demo concept.",
  ],
  [
    "Product Launch Evening",
    155000,
    120,
    "catalog-conference",
    "A contemporary product reveal and networking evening. Fictional demo concept.",
  ],
  [
    "Alumni Homecoming",
    110000,
    150,
    "dinner",
    "An alumni reunion with a memory display and dinner. Fictional demo concept.",
  ],
  [
    "Golden Anniversary Lunch",
    69000,
    60,
    "dinner",
    "A golden wedding anniversary for family and friends. Fictional demo concept.",
  ],
  [
    "Barangay Community Celebration",
    88000,
    180,
    "hero",
    "A neighborhood community gathering with a shared program. Fictional demo concept.",
  ],
  [
    "Graduation Family Gathering",
    54000,
    50,
    "dessert",
    "A graduation party with a photo and dessert corner. Fictional demo concept.",
  ],
  [
    "Silver Reunion Dinner",
    98000,
    100,
    "dinner",
    "A silver anniversary school reunion dinner. Fictional demo concept.",
  ],
  [
    "Lantern Garden Anniversary",
    79000,
    70,
    "catalog-greenery",
    "A garden anniversary with soft lantern-inspired lighting. Fictional demo concept.",
  ],
  [
    "Heritage Family Gathering",
    72000,
    80,
    "dinner",
    "A family reunion inspired by Filipino heritage. Fictional demo concept.",
  ],
];

const services: Array<
  [
    name: string,
    rate: number,
    fixed: number | null,
    hours: number | null,
    photo: PhotoName,
    description: string,
  ]
> = [
  [
    "Garden Floral Styling",
    2500,
    18000,
    6,
    "catalog-greenery",
    "Garden-inspired floral styling for weddings. Fictional demo concept.",
  ],
  [
    "Filipiniana Decor Accents",
    1800,
    14000,
    6,
    "catalog-greenery",
    "Filipino-inspired woven and floral decor. Fictional demo concept.",
  ],
  [
    "Intimate Table Styling",
    1500,
    9000,
    4,
    "dinner",
    "A styled dining table for intimate gatherings. Fictional demo concept.",
  ],
  [
    "Tropical Backdrop Styling",
    2000,
    15000,
    6,
    "catalog-greenery",
    "A colorful tropical photo backdrop. Fictional demo concept.",
  ],
  [
    "Celebration Sound and Lights",
    3000,
    22000,
    6,
    "catalog-dj",
    "Sound and lighting for a celebration program. Fictional demo concept.",
  ],
  [
    "Workshop Audio Support",
    2200,
    16000,
    8,
    "catalog-conference",
    "Audio support for a corporate workshop. Fictional demo concept.",
  ],
  [
    "Conference Stage Lighting",
    2800,
    21000,
    8,
    "catalog-conference",
    "Stage lighting for conference speakers. Fictional demo concept.",
  ],
  [
    "Reception DJ Set",
    2500,
    null,
    null,
    "catalog-dj",
    "Hourly DJ music for a reception. Fictional demo concept.",
  ],
  [
    "Event Photography",
    3500,
    21000,
    6,
    "wedding",
    "Photography coverage for family celebrations. Fictional demo concept.",
  ],
  [
    "Portrait Photo Booth",
    2000,
    12000,
    4,
    "hero",
    "A portrait booth for guests at a party. Fictional demo concept.",
  ],
  [
    "Wedding Program Host",
    2500,
    12500,
    5,
    "wedding",
    "A host for a wedding reception program. Fictional demo concept.",
  ],
  [
    "Debut Program Host",
    2200,
    11000,
    5,
    "hero",
    "A host for debut traditions and dinner. Fictional demo concept.",
  ],
  [
    "Day-of Event Coordination",
    1800,
    14400,
    8,
    "dinner",
    "Day-of coordination for a family event. Fictional demo concept.",
  ],
  [
    "Workshop Facilitation Support",
    1600,
    null,
    null,
    "catalog-conference",
    "Hourly coordination support for workshops. Fictional demo concept.",
  ],
  [
    "Dessert Table Styling",
    1700,
    10200,
    6,
    "dessert",
    "A styled dessert display for birthdays. Fictional demo concept.",
  ],
  [
    "Ceremony Aisle Florals",
    1900,
    11400,
    6,
    "catalog-greenery",
    "Floral aisle accents for a wedding ceremony. Fictional demo concept.",
  ],
  [
    "Corporate Registration Styling",
    1500,
    9000,
    6,
    "catalog-conference",
    "A clear registration point for corporate events. Fictional demo concept.",
  ],
  [
    "Family Celebration Emcee",
    1800,
    null,
    null,
    "dinner",
    "Hourly emcee for family milestones. Fictional demo concept.",
  ],
  [
    "Children's Party Coordination",
    1500,
    9000,
    6,
    "catalog-birthday",
    "Coordination for a children's birthday party. Fictional demo concept.",
  ],
  [
    "Anniversary Memory Display",
    1200,
    6000,
    5,
    "dinner",
    "A family memory display for an anniversary. Fictional demo concept.",
  ],
];

export function requireCatalogEditorial(
  entries: Record<string, CatalogEditorial>,
  name: string,
): CatalogEditorial {
  const editorial = entries[name];

  if (!editorial) throw new Error(`Missing catalog editorial: ${name}`);

  return editorial;
}

export const curatedPackages: PackageCopy[] = packages.map(
  ([name, price, guests, photo, description]) => ({
    name,
    price,
    guests,
    description,
    ...photos[photo],
    ...requireCatalogEditorial(packageEditorial, name),
  }),
);

export const curatedServices: ServiceCopy[] = services.map(
  ([name, rate, fixed, hours, photo, description]) => ({
    name,
    rate,
    fixed,
    hours,
    description,
    ...photos[photo],
    ...requireCatalogEditorial(serviceEditorial, name),
  }),
);

// Estimate for the narrowest supported reading column, not just the desktop
// arrangement. The browser audit checks real rendered Markdown and table wraps.
function markdownRows(markdown: string, width: number) {
  const charactersPerLine = width === 12 ? 30 : 26;
  let pixels = 24;

  for (const line of markdown.split("\n")) {
    if (!line.trim()) {
      pixels += 12;
      continue;
    }

    if (/^\s*\|/.test(line)) {
      if (/^[\s|:-]+$/.test(line)) continue;

      const cells = line.split("|").slice(1, -1);
      const cellWidth = Math.max(
        8,
        Math.floor((charactersPerLine - 8) / Math.max(1, cells.length)),
      );
      pixels +=
        Math.max(
          ...cells.map((cell) => Math.ceil(cell.trim().length / cellWidth)),
          1,
        ) *
          24 +
        24;
    } else {
      pixels += Math.ceil(line.length / charactersPerLine) * 24;

      if (/^#{1,3} /.test(line)) pixels += 24;

      if (/^[-*] /.test(line)) pixels += 18;
    }
  }

  return Math.max(3, Math.ceil((pixels + 12) / 64));
}

export function buildCatalogCanvas(
  copy: CatalogCopy,
  mediaId: string,
  id: (part: string) => string,
  index: number,
  link?: { kind: "service" | "package"; id: string; caption: string },
) {
  const composition = index % 5;
  const stacked = composition === 2 || composition === 3;
  const photoFirst =
    composition === 0 || composition === 2 || composition === 4;
  const introWidth = stacked ? 12 : 6;
  const introHeight = markdownRows(copy.intro, introWidth);
  const photoHeight = stacked ? 5 : Math.max(6, introHeight);

  const widget = (part: string, markdown: string, width: number) => ({
    id: id(part),
    type: "markdown",
    x: 0,
    y: 0,
    w: width,
    h: markdownRows(markdown, width),
    markdown,
    mediaId: null,
    alt: "",
    caption: "",
    autoplay: false,
  });

  const intro = {
    ...widget("intro", copy.intro, introWidth),
    x: stacked || !photoFirst ? 0 : 6,
    y: composition === 2 ? photoHeight : 0,
  };
  const photo = {
    id: id("photo"),
    type: "photo",
    x: stacked || photoFirst ? 0 : 6,
    y: composition === 3 ? introHeight : 0,
    w: stacked ? 12 : 6,
    h: photoHeight,
    markdown: "",
    mediaId,
    alt: copy.alt,
    caption:
      "Illustrative sample photo; not a record of this event or service.",
    autoplay: false,
  };

  const sections = [
    {
      id: id("section-vision"),
      title: "The occasion",
      widgets: composition === 3 ? [intro, photo] : [photo, intro],
    },
    ...copy.sections.map((section, position) => ({
      id: id(`section-editorial-${position}`),
      title: section.title,
      widgets: [widget(`editorial-${position}`, section.markdown, 12)],
    })),
  ];

  if (link)
    sections.push({
      id: id("section-related"),
      title: "Explore a related idea",
      widgets: [
        {
          id: id("related"),
          type: link.kind,
          x: 0,
          y: 0,
          w: 6,
          h: 7,
          markdown: "",
          mediaId: null,
          alt: "",
          caption: link.caption,
          autoplay: false,
          ...(link.kind === "service"
            ? { serviceId: link.id }
            : { packageId: link.id }),
        },
      ],
    });

  return storedSectionsSchema.parse(sections);
}
