import { useState, type SubmitEvent } from "react";
import {
  Button,
  DateSelect,
  FormField,
  Input,
  Select,
  Textarea,
} from "@event-management/ui";
import {
  MAX_CHECKLIST_TEXT_LENGTH,
  MAX_CHECKLIST_TITLE_LENGTH,
  type ChecklistTask,
  type ChecklistTaskInput,
} from "@event-management/contracts/event-checklists";
import type { EventDay } from "../../lib/data/event-days/event-days";
import {
  formatEventTime,
  localInput,
  zonedInstant,
} from "../../lib/utils/event-days/event-day-time";

const durations = [15, 30, 45, 60, 90, 120, 180, 240];
export function ChecklistTaskEditor({
  task,
  day,
  busy,
  disabled,
  onSave,
  onCancel,
}: {
  task?: ChecklistTask;
  day: EventDay;
  busy: boolean;
  disabled: boolean;
  onSave: (task: ChecklistTaskInput) => Promise<void>;
  onCancel: () => void;
}) {
  const start = localInput(task?.startsAt ?? day.startsAt, day.timezone);
  const [date, setDate] = useState(start.slice(0, 10));
  const [clock, setClock] = useState(start.slice(11, 16));
  const [minutes, setMinutes] = useState(
    String(
      task
        ? Math.round(
            (Date.parse(task.endsAt) - Date.parse(task.startsAt)) / 60000,
          )
        : 30,
    ),
  );
  const [custom, setCustom] = useState(!durations.includes(Number(minutes)));
  const [title, setTitle] = useState(task?.title ?? "");
  const [instructions, setInstructions] = useState(task?.instructions ?? "");
  const [status, setStatus] = useState<ChecklistTaskInput["status"]>(
    task?.status ?? "pending",
  );
  const [note, setNote] = useState(task?.note ?? "");
  const [error, setError] = useState("");
  let preview = "Choose a date, start time, and duration.";
  try {
    const begins = zonedInstant(`${date}T${clock}`, day.timezone);
    if (Number(minutes) > 0)
      preview = `${formatEventTime(begins, day.timezone)} → ${formatEventTime(new Date(Date.parse(begins) + Number(minutes) * 60000).toISOString(), day.timezone)}`;
  } catch {
    /* Incomplete wall-clock input is validated on save. */
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    let input: ChecklistTaskInput;
    try {
      if (!title.trim()) throw new Error("Enter a task name.");
      if (!Number.isInteger(Number(minutes)) || Number(minutes) < 1)
        throw new Error("Enter a positive duration in minutes.");
      if (status === "blocked" && !note.trim())
        throw new Error("Add a concern note for the blocked task.");
      const startsAt = zonedInstant(`${date}T${clock}`, day.timezone);
      input = {
        title,
        instructions,
        startsAt,
        endsAt: new Date(
          Date.parse(startsAt) + Number(minutes) * 60000,
        ).toISOString(),
        status,
        note,
      };
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Check the task details.",
      );
      return;
    }
    await onSave(input).catch(() => {
      /* The workspace retains API errors and the open edit. */
    });
  }
  return (
    <form
      className="checklist-task-editor"
      onSubmit={(event) => void submit(event)}
    >
      <fieldset disabled={disabled}>
        <legend>{task ? "Edit task" : "New task"}</legend>
        <FormField label="Task name">
          {(field) => (
            <Input
              {...field}
              required
              maxLength={MAX_CHECKLIST_TITLE_LENGTH}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
        </FormField>
        <FormField label="Task date">
          {(field) => (
            <DateSelect
              {...field}
              value={date}
              centerDate={day.day}
              onChange={setDate}
            />
          )}
        </FormField>
        <div className="checklist-time-fields">
          <FormField label="Start time">
            {(field) => (
              <Input
                {...field}
                required
                type="time"
                value={clock}
                onChange={(event) => setClock(event.target.value)}
              />
            )}
          </FormField>
          <FormField label="Duration">
            {(field) => (
              <Select
                {...field}
                value={custom ? "custom" : minutes}
                onChange={(event) => {
                  setCustom(event.target.value === "custom");
                  if (event.target.value !== "custom")
                    setMinutes(event.target.value);
                }}
              >
                {durations.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration} minutes
                  </option>
                ))}
                <option value="custom">Custom duration…</option>
              </Select>
            )}
          </FormField>
        </div>
        {custom && (
          <FormField label="Duration in minutes">
            {(field) => (
              <Input
                {...field}
                required
                type="number"
                min={1}
                step={1}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            )}
          </FormField>
        )}
        <p className="checklist-time-preview">
          {preview} · {day.timezone}
        </p>
        <FormField label="Instructions">
          {(field) => (
            <Textarea
              {...field}
              maxLength={MAX_CHECKLIST_TEXT_LENGTH}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
          )}
        </FormField>
        {task && (
          <>
            <FormField label="Task status">
              {(field) => (
                <Select
                  {...field}
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value === "completed"
                        ? "completed"
                        : event.target.value === "blocked"
                          ? "blocked"
                          : "pending",
                    )
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="blocked">Blocked</option>
                  <option value="completed">Completed</option>
                </Select>
              )}
            </FormField>
            <FormField
              label="Progress or concern note"
              description={
                status === "blocked"
                  ? "A concern note is required for a blocked task."
                  : undefined
              }
            >
              {(field) => (
                <Textarea
                  {...field}
                  required={status === "blocked"}
                  maxLength={MAX_CHECKLIST_TEXT_LENGTH}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              )}
            </FormField>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="checklist-actions">
          <Button type="submit" pending={busy}>
            Save task
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel edit
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
