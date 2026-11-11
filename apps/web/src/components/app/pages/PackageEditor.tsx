import { Button, Input, Select, Textarea } from "@event-management/ui";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import {
  MAX_PACKAGE_SERVICES,
  type PackageContent,
} from "@event-management/contracts/catalog";
import { CatalogEditor, newCatalogSection } from "./CatalogEditor";
import { CatalogCard } from "./CatalogCard";
import {
  createPackage,
  updatePackage,
  packageImageSrc,
  type AdminPackage,
} from "../../../lib/data/packages";
import { centavosToPesos, pesosToCentavos } from "../../../lib/utils/money";
import { PackageCanvas, priceLabel } from "../PackagePreview";
import { photos } from "../data";
import "../../../styles/package-editor.css";

const blank = (): PackageContent => ({
  name: "",
  description: "",
  maxGuests: 100,
  price: { kind: "fixed", currency: "PHP", amountMinor: 0 },
  sections: [newCatalogSection()],
  services: [],
});
function cover(item: PackageContent) {
  return (
    item.sections
      .flatMap((s) => s.widgets)
      .find((w) => w.type === "photo" && w.media)?.media?.url || null
  );
}
export function PackageCard({
  item,
  action,
}: {
  item: PackageContent;
  action?: React.ReactNode;
}) {
  return (
    <CatalogCard
      image={packageImageSrc(cover(item)) || photos.dinner}
      eyebrow="Event package"
      title={item.name || "Untitled package"}
      description={item.description}
      metadata={[
        {
          label: "Package price",
          value: priceLabel(item.price).replace(/ total$/, ""),
        },
        { label: "Maximum guests", value: `Up to ${item.maxGuests} guests` },
      ]}
      action={action}
    />
  );
}
export function PackageEditor({
  initial,
  onClose,
  onSaved,
  saveCustom,
  serviceOptions = [],
}: {
  initial: AdminPackage | null;
  onClose: () => void;
  onSaved: () => void;
  saveCustom?: (
    content: PackageContent & {
      services: { serviceId: string; role: "included" | "optional" }[];
    },
  ) => Promise<void>;
  serviceOptions?: { id: string; name: string; archivedAt: string | null }[];
}) {
  type EditorContent = PackageContent & {
    services: { serviceId: string; role: "included" | "optional" }[];
  };
  return (
    <CatalogEditor<EditorContent>
      initial={
        initial
          ? {
              name: initial.name,
              description: initial.description,
              maxGuests: initial.maxGuests,
              price: initial.price,
              sections: initial.sections,
              services: initial.services.map(({ serviceId, role }) => ({
                serviceId,
                role,
              })),
            }
          : { ...blank(), services: [] }
      }
      entity="package"
      onClose={onClose}
      onSaved={onSaved}
      validate={(content) =>
        !content.name.trim() ||
        !Number.isInteger(content.maxGuests) ||
        content.maxGuests < 1 ||
        !Number.isInteger(content.price.amountMinor) ||
        content.price.amountMinor < 1 ||
        content.price.amountMinor % 100 !== 0
          ? "Enter a package name, a positive whole number of guests, and a whole peso price."
          : undefined
      }
      onSave={async (content) => {
        if (saveCustom) await saveCustom(content);
        else if (initial)
          await updatePackage(initial.id, content, initial.updatedAt);
        else await createPackage(content);
      }}
      renderDetails={(content, setContent) => (
        <>
          <fieldset>
            <legend>Package services</legend>
            {content.services.map((link, index) => (
              <div key={link.serviceId}>
                <span>
                  {serviceOptions.find((s) => s.id === link.serviceId)?.name ??
                    initial?.services.find(
                      (s) => s.serviceId === link.serviceId,
                    )?.name ??
                    link.serviceId}
                </span>{" "}
                <Select
                  aria-label="Service inclusion"
                  value={link.role}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      services: content.services.map((v, i) =>
                        i === index
                          ? {
                              ...v,
                              role:
                                e.target.value === "optional"
                                  ? "optional"
                                  : "included",
                            }
                          : v,
                      ),
                    })
                  }
                >
                  <option value="included">Included</option>
                  <option value="optional">Optional</option>
                </Select>{" "}
                <Button
                  variant="secondary"
                  aria-label={`Move ${serviceOptions.find((s) => s.id === link.serviceId)?.name ?? "service"} up`}
                  disabled={index === 0}
                  onClick={() => {
                    const services = [...content.services];
                    [services[index - 1], services[index]] = [
                      services[index],
                      services[index - 1],
                    ];
                    setContent({ ...content, services });
                  }}
                >
                  ↑
                </Button>{" "}
                <Button
                  variant="secondary"
                  aria-label={`Move ${serviceOptions.find((s) => s.id === link.serviceId)?.name ?? "service"} down`}
                  disabled={index === content.services.length - 1}
                  onClick={() => {
                    const services = [...content.services];
                    [services[index + 1], services[index]] = [
                      services[index],
                      services[index + 1],
                    ];
                    setContent({ ...content, services });
                  }}
                >
                  ↓
                </Button>{" "}
                <Button
                  variant="secondary"
                  onClick={() =>
                    setContent({
                      ...content,
                      services: content.services.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <Select
              aria-label="Add service"
              disabled={content.services.length >= MAX_PACKAGE_SERVICES}
              value=""
              onChange={(e) => {
                if (e.target.value)
                  setContent({
                    ...content,
                    services: [
                      ...content.services,
                      { serviceId: e.target.value, role: "included" },
                    ],
                  });
              }}
            >
              <option value="">Add a service…</option>
              {serviceOptions
                .filter(
                  (s) =>
                    !s.archivedAt &&
                    !content.services.some((v) => v.serviceId === s.id),
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </fieldset>
          <label>
            Catalog description
            <Textarea
              maxLength={MAX_CATALOG_TEXT_LENGTH}
              value={content.description}
              onChange={(e) =>
                setContent({ ...content, description: e.target.value })
              }
            />
          </label>
          <label>
            Maximum guests
            <Input
              type="number"
              min="1"
              value={content.maxGuests || ""}
              onChange={(e) =>
                setContent({ ...content, maxGuests: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Package price (PHP)
            <Input
              type="number"
              min="1"
              step="1"
              value={
                content.price.amountMinor
                  ? centavosToPesos(content.price.amountMinor)
                  : ""
              }
              onChange={(e) =>
                setContent({
                  ...content,
                  price: {
                    ...content.price,
                    amountMinor: pesosToCentavos(Number(e.target.value)),
                  },
                })
              }
            />
          </label>
        </>
      )}
      renderPreview={(content, mode) =>
        mode === "customer" ? (
          <PackageCanvas
            item={{
              ...content,
              services: content.services.map((s) => ({
                ...s,
                name:
                  serviceOptions.find((o) => o.id === s.serviceId)?.name ??
                  initial?.services.find((o) => o.serviceId === s.serviceId)
                    ?.name ??
                  "Service",
              })),
            }}
          />
        ) : (
          <div className="pe-card-preview">
            <PackageCard item={content} />
          </div>
        )
      }
    />
  );
}
