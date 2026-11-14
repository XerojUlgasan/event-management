import { useId, type ReactNode } from "react";
import { Button } from "../atoms/Button";
import { Icon } from "../atoms/Icon";
import { Panel } from "../molecules/Panel";

export type MonthCalendarProps = {
  month: string;
  onMonthChange: (month: string) => void;
  selectedDate?: string;
  onDateSelect: (date: string) => void;
  counts?: Record<string, number>;
  countLabel?: string;
  caption?: ReactNode;
  loading?: boolean;
  error?: ReactNode;
  className?: string;
};

const keyForDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function MonthCalendar({
  month,
  onMonthChange,
  selectedDate,
  onDateSelect,
  counts = {},
  countLabel = "event day",
  caption,
  loading = false,
  error,
  className = "",
}: MonthCalendarProps) {
  const titleId = useId();
  const [year, monthNumber] = month.split("-").map(Number);
  const current = new Date(year, monthNumber - 1, 1);
  const firstDay = current.getDay();
  const days = new Date(year, monthNumber, 0).getDate();
  const today = keyForDate(new Date());
  const monthLabel = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
  }).format(current);
  const moveMonth = (offset: number) =>
    onMonthChange(
      keyForDate(new Date(year, monthNumber - 1 + offset, 1)).slice(0, 7),
    );

  return (
    <Panel
      as="section"
      className={["ui-month-calendar", className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
    >
      <div className="ui-month-calendar-head">
        <Button
          size="icon"
          variant="light"
          aria-label="Previous month"
          onClick={() => moveMonth(-1)}
        >
          <Icon name="chevron" className="ui-month-calendar-previous" />
        </Button>
        <h2 id={titleId}>{monthLabel}</h2>
        <Button
          size="icon"
          variant="light"
          aria-label="Next month"
          onClick={() => moveMonth(1)}
        >
          <Icon name="chevron" />
        </Button>
      </div>
      {caption && <div className="ui-month-calendar-caption">{caption}</div>}
      <div
        className="ui-month-calendar-legend"
        aria-label={`Color scale: fewer to more ${countLabel}s`}
      >
        <span>Fewer</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <i
            key={level}
            className={`ui-month-calendar-heat-${level}`}
            aria-hidden="true"
          />
        ))}
        <span>More</span>
      </div>
      {loading && (
        <p className="ui-month-calendar-status" role="status">
          Loading calendar…
        </p>
      )}
      {error && (
        <div className="ui-month-calendar-status" role="alert">
          {error}
        </div>
      )}
      <div className="ui-month-calendar-grid" aria-busy={loading}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => (
          <div className="ui-month-calendar-weekday" key={name}>
            {name}
          </div>
        ))}
        {Array.from({ length: firstDay }, (_, index) => (
          <div className="ui-month-calendar-blank" key={index} />
        ))}
        {Array.from({ length: days }, (_, index) => {
          const date = keyForDate(new Date(year, monthNumber - 1, index + 1));
          const count = counts[date] ?? 0;
          const label = new Intl.DateTimeFormat("en-PH", {
            dateStyle: "full",
          }).format(new Date(year, monthNumber - 1, index + 1));
          const showCount = !loading && !error;
          return (
            <Button
              variant="plain"
              key={date}
              className={`ui-month-calendar-day ui-month-calendar-heat-${showCount ? Math.min(count, 4) : 0}`}
              aria-pressed={selectedDate === date}
              aria-current={date === today ? "date" : undefined}
              aria-label={`${label}${showCount ? `, ${count} ${countLabel}${count === 1 ? "" : "s"}` : ""}`}
              onClick={() => onDateSelect(date)}
            >
              <span>{index + 1}</span>
              {showCount && <strong>{count}</strong>}
            </Button>
          );
        })}
      </div>
    </Panel>
  );
}
