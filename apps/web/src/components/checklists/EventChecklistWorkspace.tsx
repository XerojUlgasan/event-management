import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  FormField,
  Input,
  useNotifications,
} from "@event-management/ui";
import {
  MAX_CHECKLIST_TASKS,
  MAX_CHECKLIST_TITLE_LENGTH,
  type ChecklistOperation,
  type EventChecklist,
} from "@event-management/contracts/event-checklists";
import type { EventDay } from "../../lib/data/event-days/event-days";
import {
  createEventChecklist,
  getEventChecklist,
  sendEventChecklist,
  updateEventChecklist,
} from "../../lib/data/checklists/checklists";
import { ApiError } from "../../lib/http/request";
import { formatEventTime } from "../../lib/utils/event-days/event-day-time";
import { ChecklistTaskEditor } from "./ChecklistTaskEditor";

export function EventChecklistWorkspace({
  day,
  admin = false,
  active = true,
  onBusyChange,
}: {
  day: EventDay;
  admin?: boolean;
  active?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { notify, notifyError } = useNotifications();
  const [checklist, setChecklist] = useState<EventChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState(`${day.eventType} checklist`);
  const generation = useRef(0);
  const pending = useRef(false);
  const loadFailure = useRef("");
  useEffect(() => {
    onBusyChange?.(
      busy ||
        !!editing ||
        (!checklist && title !== `${day.eventType} checklist`),
    );
    return () => onBusyChange?.(false);
  }, [busy, editing, checklist, title, day.eventType, onBusyChange]);
  const load = useCallback(
    async (silent = false) => {
      if (pending.current) return;
      const request = ++generation.current;
      if (!silent) setLoading(true);
      try {
        const result = await getEventChecklist(day.id, admin);
        if (request !== generation.current) return;
        setChecklist(result.checklist);
        setTitle(result.checklist?.title ?? `${day.eventType} checklist`);
        setError("");
        setStale(false);
        setEditing(null);
        loadFailure.current = "";
      } catch (cause) {
        if (request !== generation.current) return;
        if (!admin && cause instanceof ApiError && cause.status === 404) {
          setChecklist(null);
          setError("");
          setStale(false);
          setEditing(null);
          loadFailure.current = "";
        } else {
          const message =
            cause instanceof Error
              ? cause.message
              : "Unable to load checklist.";
          setError(message);
          setStale(true);
          if (loadFailure.current !== message) {
            loadFailure.current = message;
            notifyError(cause, "Unable to load checklist.");
          }
        }
      } finally {
        if (request === generation.current) setLoading(false);
      }
    },
    [day.id, day.eventType, admin, notifyError],
  );
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  useEffect(() => {
    if (
      editing ||
      busy ||
      (!checklist && title !== `${day.eventType} checklist`)
    )
      return;
    const refresh = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load, editing, busy, checklist, title, day.eventType]);
  async function run(
    action: () => Promise<{ checklist: EventChecklist }>,
    message: string,
  ) {
    if (pending.current) return;
    pending.current = true;
    generation.current++;
    setBusy(true);
    setError("");
    try {
      const result = await action();
      setChecklist(result.checklist);
      setTitle(result.checklist.title);
      setEditing(null);
      setStale(false);
      notify(message);
    } catch (cause) {
      setError(notifyError(cause, "Unable to save checklist."));
      if (cause instanceof ApiError && [404, 409].includes(cause.status))
        setStale(true);
      throw cause;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const mutate = (operation: ChecklistOperation, message: string) => {
    if (!checklist) return Promise.resolve();
    return run(
      () => updateEventChecklist(day.id, admin, checklist.revision, operation),
      message,
    );
  };
  const startEdit = (value: string) => {
    generation.current++;
    setEditing(value);
  };
  const changeTitle = (value: string) => {
    generation.current++;
    setTitle(value);
  };
  const locked = busy || stale || !active || day.status !== "scheduled";
  const tasks = checklist?.content.tasks ?? [];
  const done = tasks.filter((task) => task.status === "completed").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const overdue = tasks.filter(
    (task) =>
      task.status !== "completed" && Date.parse(task.endsAt) < Date.now(),
  ).length;
  return (
    <section
      className="event-checklist"
      aria-label={admin ? "Event-day checklist" : "Your event-day checklist"}
    >
      {!admin && <h3>Your event-day checklist</h3>}
      {admin &&
        active &&
        day.status === "scheduled" &&
        !checklist &&
        !loading &&
        !error && (
          <p>Create a private draft to prepare tasks for the coordinator.</p>
        )}
      {error && (
        <p role="alert" className="checklist-error">
          {error}
        </p>
      )}
      {stale && (
        <p>
          Reload the current checklist before continuing. Reloading discards the
          open edit.
        </p>
      )}
      {(stale || !admin) && (
        <div className="checklist-actions">
          <Button
            variant="secondary"
            size="small"
            disabled={busy || loading || (!stale && !!editing)}
            onClick={() => void load()}
          >
            {stale ? "Reload checklist" : "Refresh checklist"}
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading checklist…</p>
      ) : !checklist ? (
        admin ? (
          !active || day.status !== "scheduled" ? (
            <p>No checklist was created for this day.</p>
          ) : (
            <form
              className="checklist-create"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () => createEventChecklist(day.id, title),
                  "Private checklist draft created.",
                ).catch(() => {});
              }}
            >
              <FormField label="Checklist title">
                {(field) => (
                  <Input
                    {...field}
                    required
                    maxLength={MAX_CHECKLIST_TITLE_LENGTH}
                    value={title}
                    disabled={locked}
                    onChange={(event) => changeTitle(event.target.value)}
                  />
                )}
              </FormField>
              <div className="checklist-actions">
                <Button type="submit" disabled={locked || !title.trim()}>
                  Create private draft
                </Button>
                {title !== `${day.eventType} checklist` && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setTitle(`${day.eventType} checklist`)}
                  >
                    Discard title
                  </Button>
                )}
              </div>
            </form>
          )
        ) : (
          <p>No checklist received yet. Refresh after the admin sends it.</p>
        )
      ) : (
        <>
          {editing === "title" ? (
            <form
              className="checklist-create"
              onSubmit={(event) => {
                event.preventDefault();
                void mutate(
                  { kind: "title", title },
                  "Checklist title saved.",
                ).catch(() => {});
              }}
            >
              <FormField label="Checklist title">
                {(field) => (
                  <Input
                    {...field}
                    required
                    maxLength={MAX_CHECKLIST_TITLE_LENGTH}
                    value={title}
                    disabled={locked}
                    onChange={(event) => changeTitle(event.target.value)}
                  />
                )}
              </FormField>
              <div className="checklist-actions">
                <Button type="submit" disabled={locked}>
                  Save title
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTitle(checklist.title);
                    setEditing(null);
                  }}
                >
                  Cancel edit
                </Button>
              </div>
            </form>
          ) : (
            <div className="checklist-heading">
              <div className="checklist-title">
                <h4>{checklist.title}</h4>
                <Badge tone={checklist.sentAt ? "info" : "neutral"}>
                  {checklist.sentAt ? "Sent" : "Private draft"}
                </Badge>
              </div>
              {admin && (
                <Button
                  size="small"
                  variant="link"
                  disabled={locked || !!editing}
                  onClick={() => startEdit("title")}
                >
                  Edit title
                </Button>
              )}
            </div>
          )}
          {checklist.sentAt && (
            <div className="checklist-progress">
              <strong>
                {done} of {tasks.length} tasks completed
              </strong>
              <span>
                {blocked} blocked · {overdue} overdue
              </span>
              <progress
                aria-label="Checklist completion"
                value={done}
                max={tasks.length || 1}
              />
            </div>
          )}
          <ol className="checklist-task-list">
            {tasks.map((task, index) => (
              <li
                key={task.id}
                className={`checklist-task checklist-task-${task.status}`}
              >
                {editing === task.id ? (
                  <ChecklistTaskEditor
                    task={task}
                    day={day}
                    busy={busy}
                    disabled={locked}
                    onCancel={() => setEditing(null)}
                    onSave={(values) =>
                      mutate(
                        { kind: "update", taskId: task.id, task: values },
                        "Task saved.",
                      )
                    }
                  />
                ) : (
                  <>
                    <div className="checklist-heading">
                      <h4>
                        {index + 1}. {task.title}
                      </h4>
                      <Badge
                        tone={
                          task.status === "completed"
                            ? "success"
                            : task.status === "blocked"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {task.status === "completed"
                          ? "Completed"
                          : task.status === "blocked"
                            ? "Blocked"
                            : Date.parse(task.endsAt) < Date.now()
                              ? "Overdue"
                              : "Pending"}
                      </Badge>
                    </div>
                    <p className="checklist-time-preview">
                      {formatEventTime(task.startsAt, day.timezone)} →{" "}
                      {formatEventTime(task.endsAt, day.timezone)}
                    </p>
                    {task.instructions && (
                      <p className="checklist-task-text">{task.instructions}</p>
                    )}
                    {task.note && (
                      <p className="checklist-task-text">
                        <strong>Progress note:</strong> {task.note}
                      </p>
                    )}
                    {task.completedAt && (
                      <small>
                        Completed{" "}
                        {formatEventTime(task.completedAt, day.timezone)}
                      </small>
                    )}
                    <div className="checklist-actions">
                      {checklist.sentAt && (
                        <Button
                          size="small"
                          disabled={locked || !!editing}
                          onClick={() => {
                            const status =
                              task.status === "completed"
                                ? "pending"
                                : "completed";
                            void mutate(
                              {
                                kind: "update",
                                taskId: task.id,
                                task: {
                                  title: task.title,
                                  instructions: task.instructions,
                                  startsAt: task.startsAt,
                                  endsAt: task.endsAt,
                                  status,
                                  note: task.note,
                                },
                              },
                              status === "completed"
                                ? "Task completed."
                                : "Task reopened.",
                            ).catch(() => {});
                          }}
                        >
                          {task.status === "completed"
                            ? "Reopen task"
                            : "Mark complete"}
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={locked || !!editing}
                        onClick={() => startEdit(task.id)}
                      >
                        Edit task {index + 1}
                      </Button>
                      <details className="checklist-more">
                        <summary
                          aria-label={`More actions for task ${index + 1}`}
                        >
                          More actions
                        </summary>
                        <div className="checklist-actions">
                          <Button
                            size="small"
                            variant="secondary"
                            disabled={locked || !!editing || index === 0}
                            aria-label={`Move task ${index + 1} up`}
                            onClick={() => {
                              const ids = tasks.map((item) => item.id);
                              [ids[index - 1], ids[index]] = [
                                ids[index],
                                ids[index - 1],
                              ];
                              void mutate(
                                { kind: "reorder", taskIds: ids },
                                "Task order saved.",
                              ).catch(() => {});
                            }}
                          >
                            Move up
                          </Button>
                          <Button
                            size="small"
                            variant="secondary"
                            disabled={
                              locked || !!editing || index === tasks.length - 1
                            }
                            aria-label={`Move task ${index + 1} down`}
                            onClick={() => {
                              const ids = tasks.map((item) => item.id);
                              [ids[index + 1], ids[index]] = [
                                ids[index],
                                ids[index + 1],
                              ];
                              void mutate(
                                { kind: "reorder", taskIds: ids },
                                "Task order saved.",
                              ).catch(() => {});
                            }}
                          >
                            Move down
                          </Button>
                          <Button
                            size="small"
                            variant="link"
                            disabled={locked || !!editing}
                            aria-label={`Delete task ${index + 1}`}
                            onClick={() =>
                              void mutate(
                                { kind: "delete", taskId: task.id },
                                "Task deleted.",
                              ).catch(() => {})
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </details>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ol>
          {editing === "new" && (
            <ChecklistTaskEditor
              day={day}
              busy={busy}
              disabled={locked}
              onCancel={() => setEditing(null)}
              onSave={(task) => mutate({ kind: "add", task }, "Task added.")}
            />
          )}
          {!tasks.length && editing !== "new" && <p>No tasks yet.</p>}
          {!editing && (
            <div className="checklist-actions">
              <Button
                variant="secondary"
                disabled={locked || tasks.length >= MAX_CHECKLIST_TASKS}
                onClick={() => startEdit("new")}
              >
                Add task
              </Button>
              {admin && (
                <Button
                  disabled={locked || !!editing || !tasks.length}
                  pending={busy}
                  onClick={() =>
                    void run(
                      () => sendEventChecklist(day.id, checklist.revision),
                      "Checklist sent.",
                    ).catch(() => {})
                  }
                >
                  {checklist.sentAt ? "Send again" : "Send checklist"}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
