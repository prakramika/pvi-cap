import { useEffect, useState } from "react";
import { api, type PublicUser } from "./api";
import type { CatalogResponse, CatalogTool } from "./types";

export function RespondentHome(props: {
  user: PublicUser;
  onError: (message: string) => void;
  onOpen: (instanceId: string) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const learner = props.user.learner;

  useEffect(() => {
    api<CatalogResponse>("/api/v1/assessments/catalog")
      .then(setCatalog)
      .catch((err: Error) => props.onError(err.message));
  }, []);

  async function start(tool: CatalogTool) {
    setBusy(tool.code);
    try {
      const payload = await api<{ instance: { id: string } }>("/api/v1/assessments/start", {
        method: "POST",
        json: { toolCode: tool.code },
      });
      props.onOpen(payload.instance.id);
    } catch (err) {
      props.onError(err instanceof Error ? err.message : "Could not start this sitting.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid gap-6">
      {learner ? (
        <article className="border border-line bg-card p-6 sm:p-8">
          <p className="text-xs tracking-[0.16em] text-teal">CHILD PROFILE</p>
          <h2 className="mt-2 text-2xl font-semibold">{learner.displayName}</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-soft">Date of birth</dt>
              <dd>{learner.dateOfBirth}</dd>
            </div>
            <div>
              <dt className="text-sm text-soft">Age</dt>
              <dd>{learner.ageYears} years</dd>
            </div>
            <div>
              <dt className="text-sm text-soft">Developmental stage</dt>
              <dd>{learner.stageLabel}</dd>
            </div>
            <div>
              <dt className="text-sm text-soft">You are signed in as</dt>
              <dd>
                {props.user.firstName} {props.user.lastName} · {learner.relationLabel}
              </dd>
            </div>
          </dl>
          <p className="mt-5 max-w-2xl leading-relaxed text-soft">{learner.stageGuidance}</p>
        </article>
      ) : (
        <p className="border border-line bg-card p-5 text-sm">This sign-in is not linked to a child profile. Please contact the institute.</p>
      )}

      <div>
        <h2 className="text-xl font-semibold">Sittings for {learner?.displayName ?? "this child"}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-soft">
          Answer what you have seen in everyday life. Skip nothing if you can; if you are unsure, choose “Not sure”.
          You may pause. We save as you go.
        </p>
      </div>

      {!catalog ? (
        <p className="text-sm text-soft">Loading sittings…</p>
      ) : (
        <div className="grid gap-3">
          {catalog.tools.map((tool) => {
            const locked = ["SUBMITTED", "UNDER_REVIEW", "REVIEWED"].includes(tool.instance?.status ?? "");
            const label = locked
              ? "View what you sent"
              : tool.instance
                ? `Continue (${tool.instance.progressPercent}%)`
                : "Begin";
            return (
              <article key={tool.code} className="flex flex-wrap items-center justify-between gap-3 border border-line bg-card p-5">
                <div>
                  <p className="font-medium">
                    {tool.name}
                    <span className="ml-2 text-sm font-normal text-soft">{tool.code}</span>
                  </p>
                  <p className="mt-1 text-sm text-soft">
                    {tool.availableQuestionCount} questions for this stage
                    {tool.isStageBased ? " · chosen for this age band" : " · same for every age"}
                  </p>
                  {tool.instance ? (
                    <p className="text-sm text-soft">
                      {locked ? "Sent to the specialist" : "In progress — you can continue"}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busy === tool.code || tool.availableQuestionCount === 0}
                  className="btn"
                  onClick={() => {
                    if (tool.instance && locked) props.onOpen(tool.instance.id);
                    else void start(tool);
                  }}
                >
                  {busy === tool.code ? "Opening…" : label}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
