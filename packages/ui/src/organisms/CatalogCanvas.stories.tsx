import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type {
  CatalogSection,
  CatalogWidget,
} from "@event-management/contracts/catalog";
import {
  Button,
  CatalogCanvas,
  CatalogSections,
  CatalogWidgetContent,
  CatalogGridGuides,
  CatalogGridRuler,
  catalogGridStyle,
} from "@event-management/ui";

const widget = (
  id: string,
  type: CatalogWidget["type"],
  overrides: Partial<CatalogWidget> = {},
): CatalogWidget => ({
  id,
  type,
  x: 0,
  y: 0,
  w: 6,
  h: 5,
  markdown: "",
  media: null,
  alt: "",
  caption: "",
  autoplay: false,
  ...overrides,
});
const sections: CatalogSection[] = [
  {
    id: "story",
    title: "Our story",
    widgets: [
      widget("text", "markdown", {
        markdown:
          "# Your celebration\n\nA **memorable** day with [details](https://example.com).\n\n- Ceremony\n- Reception",
      }),
      widget("photo", "photo", {
        x: 6,
        media: {
          kind: "image",
          source: "sample",
          url: "https://images.unsplash.com/photo-1519741497674-611481863552?w=900",
        },
        alt: "Wedding reception",
        caption: "A reception setting",
      }),
      widget("video", "video", {
        y: 5,
        media: {
          kind: "video",
          source: "upload",
          url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
        },
        caption: "A short video",
        autoplay: true,
      }),
      widget("empty", "photo", { x: 6, y: 5 }),
    ],
  },
];
const meta = {
  title: "Organisms/CatalogCanvas",
  component: CatalogSections,
  args: { sections },
  render: (args) => (
    <CatalogCanvas>
      <CatalogSections {...args} />
    </CatalogCanvas>
  ),
} satisfies Meta<typeof CatalogSections>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AllWidgets: Story = {};
export const Narrow: Story = {
  render: (args) => (
    <div style={{ width: 380 }}>
      <CatalogCanvas>
        <CatalogSections {...args} />
      </CatalogCanvas>
    </div>
  ),
};
export const LongMarkdown: Story = {
  args: {
    sections: [
      {
        id: "long",
        title: "Long content",
        widgets: [
          widget("long-text", "markdown", {
            w: 12,
            h: 4,
            markdown: Array(25)
              .fill(
                "A paragraph with **details** and a [link](https://example.com).",
              )
              .join("\n\n"),
          }),
        ],
      },
    ],
  },
};
export const EmptyMedia: Story = {
  args: {
    sections: [
      {
        id: "empty",
        title: "Empty media",
        widgets: [
          widget("photo-empty", "photo"),
          widget("video-empty", "video", { x: 6 }),
        ],
      },
    ],
  },
};
export const ServiceWidgets: Story = {
  args: {
    sections: [
      {
        id: "services",
        title: "Explore our services",
        widgets: [
          widget("linked-service", "service", {
            h: 6,
            serviceId: "photo-booth",
            service: {
              id: "photo-booth",
              slug: "photo-booth",
              name: "Photo booth",
              description:
                "A photo corner for guests to capture the celebration.",
              imageUrl: "/images/wedding.jpg",
            },
            caption: "Ask our team about a photo booth for your event.",
          }),
          widget("unavailable-service", "service", {
            x: 6,
            serviceId: "archived-service",
            service: null,
          }),
        ],
      },
    ],
  },
};
function WorkspaceServiceExample() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <CatalogCanvas>
        <CatalogSections
          sections={ServiceWidgets.args?.sections ?? []}
          onOpenService={setSelected}
        />
      </CatalogCanvas>
      <p role="status">
        {selected
          ? `Open workspace preview for ${selected}`
          : "Select a service to open its workspace preview."}
      </p>
    </>
  );
}
export const WorkspaceServiceAction: Story = {
  render: () => <WorkspaceServiceExample />,
};
export const ServiceEditor: Story = {
  render: () => (
    <div style={{ width: 320, height: 244 }}>
      <CatalogWidgetContent
        widget={widget("choose-service", "service", {
          caption: "Optional context for this service.",
        })}
        editor
        servicePlaceholder={
          <Button className="ui-catalog-empty" variant="plain">
            Choose a service
          </Button>
        }
      />
    </div>
  ),
};
export const EmptyMediaWithCaption: Story = {
  render: () => (
    <div style={{ width: 320, height: 244 }}>
      <CatalogWidgetContent
        widget={widget("choose-photo", "photo", {
          caption: "The caption retains its space before a photo is selected.",
        })}
        editor
        mediaPlaceholder={
          <Button className="ui-catalog-empty" disabled>
            Choose photo
          </Button>
        }
      />
    </div>
  ),
};

export const OverflowClipped: Story = {
  args: {
    sections: [
      {
        id: "overflow",
        title: "Content that exceeds its widget",
        widgets: [
          widget("overflow-text", "markdown", {
            w: 6,
            h: 4,
            markdown: `${Array(15).fill("A long paragraph with **details**.").join("\n\n")}\n\n\`\`\`\n${"wide content ".repeat(80)}\n\`\`\``,
          }),
          widget("contained-photo", "photo", {
            x: 6,
            w: 6,
            h: 4,
            media: {
              kind: "image",
              source: "sample",
              url: "https://images.unsplash.com/photo-1519741497674-611481863552?w=900",
            },
            alt: "Wedding reception",
            caption: "The whole photo remains visible.",
          }),
        ],
      },
    ],
  },
};

export const GridGuides: Story = {
  render: () => (
    <div>
      <p>12 columns · 9 rows with a gap</p>
      <CatalogGridRuler />
      <div style={{ ...catalogGridStyle, position: "relative", height: 600 }}>
        <CatalogGridGuides rows={9} />
      </div>
    </div>
  ),
};
export const StackedGuides: Story = {
  render: () => (
    <div style={{ width: 380 }}>
      <p>Stacked view · 5 rows</p>
      <CatalogGridRuler stacked />
      <div style={{ ...catalogGridStyle, position: "relative", height: 344 }}>
        <CatalogGridGuides rows={5} stacked />
      </div>
    </div>
  ),
};
export const EmptyGuides: Story = {
  render: () => (
    <div>
      <p>0 rows</p>
      <CatalogGridRuler />
      <div style={{ ...catalogGridStyle, position: "relative", height: 24 }}>
        <CatalogGridGuides rows={0} />
      </div>
    </div>
  ),
};
