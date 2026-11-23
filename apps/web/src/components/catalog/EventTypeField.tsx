import { FormField, Select } from "@event-management/ui";
import {
  EVENT_TYPES,
  type EventType,
} from "@event-management/contracts/catalog-filters";

/**
 * Reusable event-type selector used in both the catalog filter form and the
 * admin package/service editors.
 *
 * Without allowNull (filter mode): "" means "All event types"; onChange
 * receives EventType | "".
 *
 * With allowNull (editor mode): null means unclassified; onChange receives
 * EventType | null.
 */
export function EventTypeField({
  value,
  onChange,
  allowNull = false,
  className,
  name,
}:
  | {
      value: EventType | "";
      onChange: (value: EventType | "") => void;
      allowNull?: false;
      className?: string;
      name?: string;
    }
  | {
      value: EventType | null;
      onChange: (value: EventType | null) => void;
      allowNull: true;
      className?: string;
      name?: string;
    }) {
  const displayValue = value ?? "";

  const handleChange = (v: string) => {
    if (v === "") {
      // Safe: allowNull determines which branch of the union is active.
      (onChange as (value: EventType | "" | null) => void)(
        allowNull ? null : "",
      );
    } else if ((EVENT_TYPES as readonly string[]).includes(v)) {
      (onChange as (value: EventType) => void)(v as EventType);
    }
  };

  return (
    <FormField label="Event type" className={className}>
      {(field) => (
        <Select
          {...field}
          name={name}
          value={displayValue}
          onChange={(event) => handleChange(event.target.value)}
        >
          <option value="">
            {allowNull ? "No event type" : "All event types"}
          </option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );
}
