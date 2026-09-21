import { useEffect, useMemo, useState } from "react";
import { api, type PublicUser } from "./api";
import { ChildProfile } from "./ChildProfile";
import type { CatalogResponse, CatalogTool } from "./types";
import {
  CAP_TITLE,
  CONSENT_INTRO,
  CONSENT_ITEMS,
  DECLARATION_ITEMS,
  DISCLAIMER,
  DURATION_LINE,
  HONESTY_LINE,
  THANKS_LINE,
  WELCOME_APPROACH,
  WELCOME_INTRO,
  WELCOME_USES,
  toolHeading,
} from "./spec-copy";

type FamilyView = "profile" | "hub" | "disclaimer" | "sections";

function ProgressBar(props: { percent: number; label: string }) {
  return (
    <div>
      <div className="mb-2 flex justify-between gap-3 text-sm text-soft">
        <span>{props.label}</span>
        <span>{props.percent}%</span>
      </div>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, props.percent))}%` }} />
      </div>
    </div>
  );
}

export function FamilyPortal(props: {
  user: PublicUser;
  onUser: (user: PublicUser) => void;
  onError: (message: string) => void;
  onNotice: (message: string | null) => void;
  onOpen: (instanceId: string) => void;
  editingProfile: boolean;
  onEditingProfile: (value: boolean) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [view, setView] = useState<FamilyView>(props.user.learner?.profileComplete ? "hub" : "profile");
  const [consented, setConsented] = useState<boolean[]>(() => CONSENT_ITEMS.map(() => false));
  const [declared, setDeclared] = useState<boolean[]>(() => DECLARATION_ITEMS.map(() => false));
  const [busy, setBusy] = useState<string | null>(null);
  const allConsented = consented.every(Boolean);
  const allDeclared = declared.every(Boolean);
  const learner = props.user.learner;

  function loadCatalog() {
    return api<CatalogResponse>("/api/v1/assessments/catalog").then((body) => {
      setCatalog(body);
      return body;
    });
  }

  useEffect(() => {
    if (!learner?.profileComplete || props.editingProfile) return;
    loadCatalog()
      .then((body) => {
        if (body.resumeInstanceId) {
          props.onOpen(body.resumeInstanceId);
          return;
        }
        if (body.overall.completed > 0 && !body.allComplete) setView("sections");
        else setView("hub");
      })
      .catch((err: Error) => props.onError(err.message));
  }, [learner?.profileComplete, props.editingProfile]);

  const roleLabel = learner?.familyRoleLabel ?? "Parent";

  if (!learner) {
    return (
      <p className="panel text-sm">
        This sign-in is not linked to a child. Please contact Prakramika Vocational Institute.
      </p>
    );
  }

  if (!learner.profileComplete || props.editingProfile) {
    return (
      <ChildProfile
        learner={learner}
        mode={learner.profileComplete ? "edit" : "first"}
        onError={props.onError}
        onCancel={learner.profileComplete ? () => props.onEditingProfile(false) : undefined}
        onSaved={(next) => {
          props.onUser({ ...props.user, learner: next });
          props.onEditingProfile(false);
          props.onNotice("Child profile saved.");
          setView("hub");
          void loadCatalog().catch((err: Error) => props.onError(err.message));
        }}
      />
    );
  }

  if (view === "disclaimer") {
    return (
      <article className="panel mx-auto grid max-w-2xl gap-6">
        <div>
          <p className="eyebrow">Welcome</p>
          <h2 className="mt-2 text-2xl font-semibold">{CAP_TITLE}</h2>
          <p className="mt-3 leading-relaxed">{WELCOME_INTRO}</p>
          <p className="mt-3 leading-relaxed text-soft">{WELCOME_APPROACH}</p>
        </div>
        <div>
          <p className="font-semibold">The information collected through this assessment will be used to:</p>
          <ul className="welcome-list">
            {WELCOME_USES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <p className="leading-relaxed">{HONESTY_LINE}</p>
        <p className="text-sm leading-relaxed text-soft">
          {DURATION_LINE} {THANKS_LINE}
        </p>
        <div>
          <h3 className="font-semibold">Consent Statement</h3>
          <p className="mt-2 text-sm text-soft">{CONSENT_INTRO}</p>
          <div className="consent mt-3">
            {CONSENT_ITEMS.map((item, index) => (
              <label key={item} className="consent-item">
                <input
                  type="checkbox"
                  checked={consented[index]}
                  onChange={(event) =>
                    setConsented((current) => current.map((value, i) => (i === index ? event.target.checked : value)))
                  }
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          <h3 className="font-semibold">Disclaimer</h3>
          {DISCLAIMER.map((row) => (
            <div key={row.title}>
              <p className="font-medium">{row.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-soft">{row.body}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={!allConsented} onClick={() => setView("sections")}>
            Continue
          </button>
          <button type="button" className="btn-quiet" onClick={() => setView("hub")}>
            Back
          </button>
        </div>
      </article>
    );
  }

  if (view === "sections" && catalog) {
    return (
      <SectionsBoard
        catalog={catalog}
        childName={learner.displayName}
        busy={busy}
        onBegin={(tool) => {
          setBusy(tool.code);
          api<{ instance: { id: string } }>("/api/v1/assessments/start", {
            method: "POST",
            json: { toolCode: tool.code },
          })
            .then((payload) => props.onOpen(payload.instance.id))
            .catch((err: Error) => props.onError(err.message))
            .finally(() => setBusy(null));
        }}
      />
    );
  }

  return (
    <section className="grid gap-5">
      <article className="panel flex flex-wrap items-start gap-4">
        <span className="avatar" aria-hidden="true">
          {learner.displayName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Child profile</p>
          <h2 className="mt-1 text-2xl font-semibold">{learner.displayName}</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-soft">Date of birth</dt>
              <dd className="font-medium">{learner.dateOfBirth}</dd>
            </div>
            <div>
              <dt className="text-sm text-soft">Age</dt>
              <dd className="font-medium">{learner.ageYears} years</dd>
            </div>
            <div>
              <dt className="text-sm text-soft">Gender</dt>
              <dd className="font-medium">{learner.gender ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-soft">You are signed in as</dt>
              <dd>
                <span className="pill">{roleLabel}</span>
              </dd>
            </div>
          </dl>
        </div>
      </article>

      {catalog?.allComplete ? (
        <article className="panel-quiet grid gap-4">
          <h3 className="text-xl font-semibold">Declaration</h3>
          <p className="leading-relaxed">
            You have finished all six tools for {learner.displayName}. Please confirm the declaration from the CAP
            Assessment before you close.
          </p>
          <div className="consent">
            {DECLARATION_ITEMS.map((item, index) => (
              <label key={item} className="consent-item">
                <input
                  type="checkbox"
                  checked={declared[index]}
                  onChange={(event) =>
                    setDeclared((current) => current.map((value, i) => (i === index ? event.target.checked : value)))
                  }
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
          {allDeclared ? (
            <p className="leading-relaxed">
              Thank you. A letter is on its way to {props.user.email}. You will receive the report shortly.
            </p>
          ) : (
            <p className="text-sm text-soft">Tick every statement to complete the declaration.</p>
          )}
        </article>
      ) : (
        <article className="panel">
          <h3 className="text-xl font-semibold">{CAP_TITLE}</h3>
          <p className="mt-3 max-w-2xl leading-relaxed text-soft">
            Six tools, in order, for the {catalog?.familyRoleLabel ?? roleLabel} form. Other people each have their own
            form. You may stop at any time and continue later from the same question.
          </p>
          {catalog ? (
            <div className="mt-5">
              <ProgressBar
                percent={catalog.overall.percent}
                label={`${catalog.overall.completed} of ${catalog.overall.total} sections complete`}
              />
            </div>
          ) : null}
          <button
            type="button"
            className="btn mt-6"
            onClick={() => setView(catalog && catalog.overall.completed > 0 ? "sections" : "disclaimer")}
          >
            {catalog && catalog.overall.completed > 0 ? "Continue" : "Begin"}
          </button>
        </article>
      )}
    </section>
  );
}

function SectionsBoard(props: {
  catalog: CatalogResponse;
  childName: string;
  busy: string | null;
  onBegin: (tool: CatalogTool) => void;
}) {
  const ordered = useMemo(
    () => [...props.catalog.tools].sort((a, b) => a.sortOrder - b.sortOrder),
    [props.catalog.tools],
  );

  return (
    <section className="grid gap-5">
      <div className="panel">
        <h2 className="text-xl font-semibold">{CAP_TITLE}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-soft">
          This is the {props.catalog.familyRoleLabel} form for {props.childName}. Answers here stay with this person.
          You can save and continue later from the same question. {DURATION_LINE}
        </p>
        <div className="mt-5">
          <ProgressBar
            percent={props.catalog.overall.percent}
            label={`Overall · ${props.catalog.overall.completed} of ${props.catalog.overall.total} sections`}
          />
        </div>
      </div>
      <div className="grid gap-3">
        {ordered.map((tool) => {
          const inProgress = tool.state === "active" && Boolean(tool.instance) && tool.instance?.status === "IN_PROGRESS";
          return (
            <article
              key={tool.code}
              className={tool.state === "locked" ? "section-card section-card-locked" : "section-card"}
            >
              <div>
                <p className="font-semibold">
                  {toolHeading(tool.code, tool.name)}
                  <span className="ml-2 text-sm font-normal text-soft">{tool.code}</span>
                </p>
                <p className="mt-1 text-sm text-soft">
                  {tool.state === "completed"
                    ? "Completed"
                    : tool.state === "active"
                      ? inProgress
                        ? `In progress · ${tool.instance?.progressPercent ?? 0}% of this section`
                        : "Ready to begin"
                      : "Locked until the previous section is finished"}
                </p>
              </div>
              {tool.state === "completed" ? (
                <span className="pill">Completed</span>
              ) : tool.state === "locked" ? (
                <span className="pill pill-locked">Locked</span>
              ) : (
                <button
                  type="button"
                  className="btn"
                  disabled={tool.state !== "active" || !tool.canBegin || props.busy === tool.code}
                  onClick={() => props.onBegin(tool)}
                >
                  {props.busy === tool.code ? "Opening…" : inProgress ? "Continue" : "Begin"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
