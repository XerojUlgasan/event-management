import { useEffect, useState } from "react";
import { Button, Panel, useNotifications } from "@event-management/ui";
import { getMyConversation } from "../../../../lib/data/messages/conversations";
import { markNotificationRead } from "../../../../lib/data/notifications/notifications";
import {
  customerConversationPath,
  navigateWorkspace,
} from "../../../../lib/navigation/workspace-navigation";
import { useRequestGeneration } from "../../../../lib/pagination/use-request-generation";
import {
  loadCustomerHomeStep,
  type CustomerHomeStep,
} from "../../../../lib/services/customer-home/next-step";
import { bookingDate } from "../../../booking-requests/BookingRequestDisplay";

type LoadState =
  { state: "loading" | "error" } | { state: "ready"; step: CustomerHomeStep };

export function CustomerHomeNextStep() {
  const { notifyError } = useNotifications();
  const generation = useRequestGeneration();
  const [result, setResult] = useState<LoadState>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [opening, setOpening] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const ticket = generation.bump();

    loadCustomerHomeStep()
      .then((step) => {
        if (generation.isCurrent(ticket)) setResult({ state: "ready", step });
      })
      .catch((cause) => {
        if (!generation.isCurrent(ticket)) return;

        setResult({ state: "error" });
        notifyError(cause, "Unable to load your next step.");
      });

    return () => {
      generation.bump();
    };
  }, [attempt, generation, notifyError]);

  async function open(action: CustomerHomeStep["action"]) {
    if (opening) return;

    if (action.kind === "navigate") {
      navigateWorkspace(action.path);

      return;
    }

    const ticket = generation.current();
    setOpening(true);
    setActionError("");

    try {
      let path;

      if (action.kind === "start") {
        const { conversation } = await getMyConversation();
        path = customerConversationPath(conversation.id);
      } else {
        const updated = await loadCustomerHomeStep();

        if (!generation.isCurrent(ticket)) return;

        if (
          updated.action.kind !== "quotation" ||
          updated.action.notificationId !== action.notificationId
        ) {
          setResult({ state: "ready", step: updated });
          setActionError("Your next step has changed.");

          return;
        }

        await markNotificationRead(action.notificationId);
        path = updated.action.path;
      }

      if (generation.isCurrent(ticket)) navigateWorkspace(path);
    } catch (cause) {
      if (generation.isCurrent(ticket))
        setActionError(notifyError(cause, "Unable to open your next step."));
    } finally {
      if (generation.isCurrent(ticket)) setOpening(false);
    }
  }

  return (
    <Panel
      as="section"
      className="customer-next-step"
      aria-labelledby="customer-next-step-title"
    >
      <h2 id="customer-next-step-title">Your next step</h2>
      {result.state === "loading" && <p role="status">Checking for updates…</p>}
      {result.state === "error" && (
        <div className="customer-next-step-content">
          <p role="alert">We couldn’t load your next step.</p>
          <Button
            onClick={() => {
              setResult({ state: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}
      {result.state === "ready" && (
        <div className="customer-next-step-content">
          <div>
            <h3>{result.step.title}</h3>
            <p>{result.step.description}</p>
            {(result.step.eventType || result.step.requestedDate) && (
              <p className="customer-next-step-event">
                {result.step.eventType}
                {result.step.eventType && result.step.requestedDate && " · "}
                {result.step.requestedDate && (
                  <>
                    {result.step.hasMultipleDates
                      ? "First requested date "
                      : "Requested date "}
                    <time dateTime={result.step.requestedDate}>
                      {bookingDate(result.step.requestedDate)}
                    </time>
                  </>
                )}
              </p>
            )}
            {actionError && <p role="alert">{actionError}</p>}
          </div>
          <Button
            pending={opening}
            onClick={() => void open(result.step.action)}
          >
            {result.step.action.label}
          </Button>
        </div>
      )}
    </Panel>
  );
}
