import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { AssessmentPayload, TakeQuestion } from "./types";
import { HONESTY_LINE, toolHeading } from "./spec-copy";

function flatten(data: AssessmentPayload): TakeQuestion[] {
  return data.sections.flatMap((section) => section.questions);
}

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

export function AssessmentTake(props: {
  instanceId: string;
  onFinished: (payload: { allComplete?: boolean; completionDemoInbox?: AssessmentPayload["completionDemoInbox"] }) => void;
  onError: (message: string) => void;
}) {
  const [data, setData] = useState<AssessmentPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    api<AssessmentPayload>(`/api/v1/assessments/${props.instanceId}`)
      .then(setData)
      .catch((err: Error) => props.onError(err.message));
  }, [props.instanceId]);

  const questions = useMemo(() => (data ? flatten(data) : []), [data]);
  const current = questions.find((question) => {
    if (question.type === "FREE_TEXT") return !question.response?.freeText?.trim();
    return !question.response?.optionId;
  });
  const index = current ? questions.findIndex((row) => row.id === current.id) : questions.length;

  useEffect(() => {
    setDraft(current?.response?.freeText ?? "");
  }, [current?.id]);

  useEffect(() => {
    if (!data) return;
    const lockedNow = ["SUBMITTED", "UNDER_REVIEW", "REVIEWED"].includes(data.instance.status);
    if (lockedNow) {
      props.onFinished({ allComplete: data.allComplete, completionDemoInbox: data.completionDemoInbox });
      return;
    }
    if (data.resume.done) {
      api<AssessmentPayload>(`/api/v1/assessments/${props.instanceId}/submit`, { method: "POST" })
        .then((payload) =>
          props.onFinished({ allComplete: payload.allComplete, completionDemoInbox: payload.completionDemoInbox }),
        )
        .catch((err: Error) => props.onError(err.message));
    }
  }, [data?.instance.status, data?.resume.done]);

  async function persist(question: TakeQuestion, optionId: string | null, freeText: string | null) {
    setSaving(true);
    try {
      const result = await api<{
        progress: { answered: number; total: number; percent: number };
        submitted?: boolean;
        allComplete?: boolean;
        completionDemoInbox?: AssessmentPayload["completionDemoInbox"];
      }>(`/api/v1/assessments/${props.instanceId}/responses`, {
        method: "PUT",
        json: { questionId: question.id, optionId, freeText },
      });
      if (result.submitted) {
        props.onFinished({ allComplete: result.allComplete, completionDemoInbox: result.completionDemoInbox });
        return;
      }
      setData((previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          progress: result.progress,
          instance: { ...previous.instance, progressPercent: result.progress.percent },
          sections: previous.sections.map((section) => ({
            ...section,
            questions: section.questions.map((item) =>
              item.id === question.id
                ? { ...item, response: { optionId, freeText, savedAt: new Date().toISOString() } }
                : item,
            ),
          })),
        };
      });
    } catch (err) {
      props.onError(err instanceof Error ? err.message : "Could not save that answer.");
    } finally {
      setSaving(false);
    }
  }

  if (!data || !current) {
    return <p className="panel text-sm text-soft">Loading the next question…</p>;
  }

  const percent = data.progress.total ? Math.round((index / data.progress.total) * 100) : 0;

  return (
    <section className="mx-auto grid max-w-2xl gap-5">
      <div className="panel">
        <p className="eyebrow">{data.instance.tool.code}</p>
        <h2 className="mt-2 text-2xl font-semibold">{toolHeading(data.instance.tool.code, data.instance.tool.name)}</h2>
        <p className="mt-2 text-sm text-soft">
          {data.instance.familyRoleLabel ?? "Parent"} form for {data.instance.learner.displayName}. You can leave and
          continue later from this question
          {saving ? " · saved" : ""}.
        </p>
        <div className="mt-5">
          <ProgressBar percent={percent} label={`Question ${index + 1} of ${data.progress.total}`} />
        </div>
      </div>

      <article className="panel question-enter" key={current.id}>
        <p className="text-xl leading-relaxed font-medium">{current.prompt}</p>
        {current.type === "FREE_TEXT" ? (
          <div className="mt-6 grid gap-4">
            <textarea
              className="input min-h-32"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a short answer, then save."
            />
            <button
              type="button"
              className="btn w-fit"
              disabled={saving || draft.trim().length === 0}
              onClick={() => void persist(current, null, draft)}
            >
              {saving ? "Saving…" : "Save this answer"}
            </button>
          </div>
        ) : (
          <div className="choice-grid mt-6" role="radiogroup" aria-label="Choose an answer">
            {current.options.map((option) => {
              const selected = current.response?.optionId === option.id;
              const mark = option.value || option.label.match(/^\d+/)?.[0] || "";
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={saving}
                  className={selected ? "choice choice-on" : "choice"}
                  onClick={() => void persist(current, option.id, null)}
                >
                  {mark ? <span className="choice-mark">{mark}</span> : null}
                  <span>{option.label.replace(/^\d+\s*[—-]\s*/, "")}</span>
                </button>
              );
            })}
          </div>
        )}
      </article>
      <p className="px-1 text-sm text-soft">{HONESTY_LINE}</p>
    </section>
  );
}
