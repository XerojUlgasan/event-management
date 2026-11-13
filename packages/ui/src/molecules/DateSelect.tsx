import { useEffect, useId, useRef, useState, type ComponentPropsWithRef } from "react";
import { Button } from "../atoms/Button";
import { Icon } from "../atoms/Icon";
import { Select } from "../atoms/Select";

function offsetDate(date: string, offset: number) {
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + offset);
  return instant.toISOString().slice(0, 10);
}
function longDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

/** A five-row date list, initially scrolled around centerDate; no calendar UI. */
export function DateSelect({ value, centerDate, onChange, disabled, ...props }: {
  value: string;
  centerDate: string;
  onChange: (value: string) => void;
} & Omit<ComponentPropsWithRef<"button">, "value" | "onChange" | "children" | "ref">) {
  const distance = Math.round((Date.parse(`${value}T12:00:00Z`) - Date.parse(`${centerDate}T12:00:00Z`)) / 86400000) || 0;
  const [range, setRange] = useState({ before: Math.max(30, -distance + 2), after: Math.max(30, distance + 2) });
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const [active, setActive] = useState(value || centerDate);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLSelectElement>(null);
  const opened = useRef(false);
  const scrollCenter = useRef(centerDate);
  const pendingScroll = useRef<number | null>(null);
  const listId = useId();
  const dates = Array.from({ length: range.before + range.after + 1 }, (_, index) => offsetDate(centerDate, index - range.before));
  function close(restore = false) {
    setOpen(false);
    if (restore) trigger.current?.focus({ preventScroll: true });
  }
  function show() {
    if (open) { close(); return; }
    const rect = trigger.current?.getBoundingClientRect();
    setAbove(Boolean(rect && window.innerHeight - rect.bottom < 220 && rect.top > 220));
    setActive(value || centerDate);
    scrollCenter.current = opened.current ? value || centerDate : centerDate;
    opened.current = true;
    setOpen(true);
  }
  function commit(date: string) { onChange(date); close(true); }
  useEffect(() => {
    if (!open || !list.current) return;
    const select = list.current;
    if (pendingScroll.current !== null) { select.scrollTop = pendingScroll.current; pendingScroll.current = null; return; }
    select.focus({ preventScroll: true });
    const target = Array.from(select.options).findIndex(option => option.value === scrollCenter.current);
    const rowHeight = select.options[0]?.getBoundingClientRect().height || 40;
    select.scrollTop = Math.max(0, target - 2) * rowHeight;
  }, [open, range]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (event.target instanceof Node && !container.current?.contains(event.target)) close(); }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="ui-date-select" ref={container} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(true); }
  }}>
    <Button {...props} ref={trigger} variant="plain" className="ui-control ui-date-select-trigger" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={show} onKeyDown={event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (!open) show(); }
    }}><span>{value ? longDate(value) : "Choose a date"}</span><Icon name="chevron" size={14} /></Button>
    {open && !disabled && <div className={`ui-date-select-menu${above ? " ui-date-select-above" : ""}`}>
      <Select ref={list} id={listId} aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]} className="ui-date-select-options" size={5} value={active} onChange={event => setActive(event.target.value)} onClick={event => {
        if (event.target instanceof HTMLOptionElement) commit(event.currentTarget.value);
      }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); commit(event.currentTarget.value); } }} onScroll={event => {
        if (pendingScroll.current !== null) return;
        const select = event.currentTarget;
        const rowHeight = select.options[0]?.getBoundingClientRect().height || 40;
        if (select.scrollTop <= 1) { pendingScroll.current = select.scrollTop + 30 * rowHeight; setRange(previous => ({ ...previous, before: previous.before + 30 })); }
        else if (select.scrollHeight - select.clientHeight - select.scrollTop <= 1) { pendingScroll.current = select.scrollTop; setRange(previous => ({ ...previous, after: previous.after + 30 })); }
      }}>{dates.map(date => <option value={date} key={date}>{longDate(date)}</option>)}</Select>
    </div>}
  </div>;
}
