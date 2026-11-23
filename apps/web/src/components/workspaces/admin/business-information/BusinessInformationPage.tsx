import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  FormField,
  Input,
  PageHeader,
  Panel,
  Textarea,
  useNotifications,
} from "@event-management/ui";
import {
  businessInformationSchema,
  emptyBusinessInformation,
  type BusinessInformation,
} from "@event-management/contracts/business-information";
import {
  getAdminBusinessInformation,
  saveAdminBusinessInformation,
} from "../../../../lib/data/business-information/business-information";
import { ApiError } from "../../../../lib/http/request";
import { BUSINESS_INFORMATION_FIELD_LABELS } from "../../../../lib/utils/business-information/field-labels";
import {
  BUSINESS_INFORMATION_GROUPS,
  businessFieldMaxLength,
  isBusinessUrlField,
  isMultilineField,
  type BusinessInformationGroupKey,
} from "../../../../lib/utils/business-information/display";
import "../../../../styles/business-information/business-information.css";

type GroupKey = BusinessInformationGroupKey;

const SECTION_DESCRIPTIONS: Partial<Record<GroupKey, string>> = {
  about: "Name and a short line that introduces your business to visitors.",
  contact: "Phone, email, and the social profiles you want customers to use.",
  location: "Address, map link, and the areas where you provide services.",
  hours: "When customers can reach you or visit. Use plain language.",
};

const SUPPORT_HOURS_PLACEHOLDER = "Example: Mon–Fri, 9am–5pm";

function parseFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const map = new Map<string, string>();

  for (const issue of issues) {
    const path = issue.path.length ? issue.path.map(String).join(".") : "form";

    if (!map.has(path)) map.set(path, issue.message || "Invalid value.");
  }

  return map;
}

export function BusinessInformationPage() {
  const { notify, notifyError } = useNotifications();
  const [information, setInformation] = useState<BusinessInformation>(
    emptyBusinessInformation(),
  );
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [formError, setFormError] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Map<string, string>>(
    () => new Map(),
  );

  const dirty = useRef(false);
  const seq = useRef(0);
  const savingRef = useRef(false);

  const load = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    if (!dirty.current) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [information]);

  useEffect(() => {
    const current = ++seq.current;
    setLoading(true);
    setLoadError(false);
    setFormError("");

    void getAdminBusinessInformation()
      .then((result) => {
        if (seq.current !== current) return;

        if (!dirty.current) {
          setInformation(result.information);
        }

        setExpectedUpdatedAt(result.updatedAt);
      })
      .catch(() => {
        if (seq.current === current) setLoadError(true);
      })
      .finally(() => {
        if (seq.current === current) setLoading(false);
      });

    return () => {
      seq.current++;
    };
  }, [retry]);

  const setGroupField = <G extends GroupKey>(
    group: G,
    field: keyof BusinessInformation[G] & string,
    value: string,
  ) => {
    dirty.current = true;
    setInformation((current) => ({
      ...current,
      [group]: { ...current[group], [field]: value },
    }));
    setFieldErrors((current) => {
      const next = new Map(current);
      next.delete(`${group}.${field}`);

      return next;
    });
  };

  const reloadLatest = () => {
    if (
      dirty.current &&
      !window.confirm("Reload and replace your unsaved changes?")
    )
      return;

    dirty.current = false;
    setStale(false);
    setFormError("");
    load();
  };

  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (savingRef.current || loading || stale) return;

    const parsed = businessInformationSchema.safeParse(information);

    if (!parsed.success) {
      setFieldErrors(parseFieldErrors(parsed.error.issues));
      setFormError("Fix the highlighted fields and try again.");

      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFormError("");
    setFieldErrors(new Map());

    try {
      const result = await saveAdminBusinessInformation({
        information: parsed.data,
        expectedUpdatedAt,
      });
      setInformation(result.information);
      setExpectedUpdatedAt(result.updatedAt);
      dirty.current = false;
      setStale(false);
      notify(
        "Business information saved. It is now visible in the website footer.",
        "success",
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setStale(true);
        setFormError(
          "Someone else saved newer business information. Reload the latest version before saving again.",
        );
      } else {
        setFormError(
          notifyError(cause, "Unable to save business information."),
        );
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const disabled = loading || saving || stale;

  return (
    <div className="business-information-admin">
      <PageHeader
        title="Business information"
        description={
          !loading && !loadError && expectedUpdatedAt === null
            ? "No business information saved yet. Add details to show them in the website footer."
            : "Saved details appear in the website footer."
        }
        actions={
          <a
            className="button button-secondary"
            href="/#business-information"
            target="_blank"
            rel="noopener noreferrer"
          >
            View website footer
          </a>
        }
      />
      {loadError ? (
        <Panel className="business-information-status">
          <p>Could not load business information.</p>
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
        </Panel>
      ) : (
        <form className="business-information-form" onSubmit={save} noValidate>
          <fieldset
            className="business-information-sections"
            aria-label="Business details"
            disabled={disabled}
          >
            {BUSINESS_INFORMATION_GROUPS.map(({ key, title, fields }) => (
              <section key={key} className="business-information-section">
                <header className="business-information-section-heading">
                  <h2>{title}</h2>
                  {SECTION_DESCRIPTIONS[key] ? (
                    <p>{SECTION_DESCRIPTIONS[key]}</p>
                  ) : null}
                </header>
                <div className="business-information-fields">
                  {fields.map((field) => {
                    const label = BUSINESS_INFORMATION_FIELD_LABELS[key][field];
                    const path = `${key}.${field}`;
                    const groupData = information[key] as Record<
                      string,
                      string
                    >;
                    const value = groupData[field] ?? "";
                    const error = fieldErrors.get(path);
                    const multiline = isMultilineField(key, field);
                    const maxLength = businessFieldMaxLength(key, field);
                    const inputType =
                      field === "email"
                        ? "email"
                        : field === "phone"
                          ? "tel"
                          : isBusinessUrlField(key, field)
                            ? "url"
                            : "text";

                    return (
                      <FormField
                        key={path}
                        className={multiline ? "full" : undefined}
                        label={label}
                        error={error}
                      >
                        {(props) =>
                          multiline ? (
                            <Textarea
                              {...props}
                              value={value}
                              maxLength={maxLength}
                              rows={field === "introduction" ? 3 : 2}
                              placeholder={
                                field === "supportHours"
                                  ? SUPPORT_HOURS_PLACEHOLDER
                                  : undefined
                              }
                              onChange={(event) =>
                                setGroupField(
                                  key,
                                  field as keyof BusinessInformation[typeof key] &
                                    string,
                                  event.target.value,
                                )
                              }
                            />
                          ) : (
                            <Input
                              {...props}
                              type={inputType}
                              value={value}
                              maxLength={maxLength}
                              onChange={(event) =>
                                setGroupField(
                                  key,
                                  field as keyof BusinessInformation[typeof key] &
                                    string,
                                  event.target.value,
                                )
                              }
                            />
                          )
                        }
                      </FormField>
                    );
                  })}
                </div>
              </section>
            ))}
          </fieldset>

          {stale ? (
            <Panel
              className="business-information-status business-information-conflict"
              role="alert"
            >
              <p>
                This form is out of date. Reload the latest business information
                before saving.
              </p>
              <Button type="button" variant="secondary" onClick={reloadLatest}>
                Reload latest
              </Button>
            </Panel>
          ) : null}

          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="business-information-actions">
            <Button type="submit" pending={saving} disabled={loading || stale}>
              Save business information
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
