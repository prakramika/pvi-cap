import { useEffect, useMemo, useState } from "react";
import { api, type PublicLearner, type PublicUser } from "./api";
import type { AssessmentPayload } from "./types";

type Tab = "send" | "children" | "questions";

type FillerTrack = {
  familyRole: string;
  familyRoleLabel: string;
  overall: { completed: number; total: number; percent: number };
  sections: {
    code: string;
    name: string;
    state: string;
    status: string | null;
    progressPercent: number;
    instanceId: string | null;
  }[];
};

type ChildRow = {
  id: string;
  childName: string;
  dateOfBirth: string;
  stageLabel: string;
  profileComplete: boolean;
  signedInAs: string | null;
  parentName: string;
  parentEmail: string;
  overall: { completed: number; total: number; percent: number };
  fillers: FillerTrack[];
  sections: FillerTrack["sections"];
};

type BankQuestion = {
  id: string;
  toolCode: string;
  sectionTitle: string;
  indicatorCode: string;
  prompt: string;
  type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "SCALE" | "FREE_TEXT";
  isQualitative: boolean;
  isActive: boolean;
  stages: string[];
  options: { id: string; label: string; value: string; sortOrder: number }[];
  responseCount: number;
};

type BankTool = {
  code: string;
  name: string;
  isStageBased: boolean;
  sections: { id: string; title: string; questions: BankQuestion[] }[];
};

function tempPassword(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Welcome${n}a`;
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

export function AdminDesk(props: {
  user: PublicUser;
  onError: (message: string) => void;
  onCreated: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>(props.user.role === "ADMIN" ? "send" : "children");
  return (
    <div className="grid gap-5">
      <div className="tabs">
        {props.user.role === "ADMIN" ? (
          <TabButton active={tab === "send"} onClick={() => setTab("send")}>
            Send a form
          </TabButton>
        ) : null}
        <TabButton active={tab === "children"} onClick={() => setTab("children")}>
          Children and answers
        </TabButton>
        {props.user.role === "ADMIN" ? (
          <TabButton active={tab === "questions"} onClick={() => setTab("questions")}>
            Questions
          </TabButton>
        ) : null}
      </div>
      {tab === "send" ? <SendForm onError={props.onError} onCreated={props.onCreated} /> : null}
      {tab === "children" ? <ChildrenDesk onError={props.onError} /> : null}
      {tab === "questions" ? <QuestionBank onError={props.onError} onNotice={props.onCreated} /> : null}
    </div>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" className={props.active ? "tab tab-active" : "tab"} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

function SendForm(props: { onError: (message: string) => void; onCreated: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [password, setPassword] = useState(tempPassword);
  const [busy, setBusy] = useState(false);

  return (
    <section className="panel grid gap-6">
      <div>
        <p className="eyebrow">Enrol a family</p>
        <h2 className="mt-2 text-xl font-semibold">Send a form</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-soft">
          Enter the parent email. They receive the login link and a temporary password.
        </p>
      </div>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          api<{
            enrolmentEmailSent: boolean;
            enrolmentEmailTo: string;
          }>("/api/v1/users", {
            method: "POST",
            json: {
              email,
              password,
              firstName,
              lastName,
              role: "RESPONDENT",
              displayName,
              dateOfBirth,
              respondentRelation: "PARENT",
            },
          })
            .then((result) => {
              props.onCreated(
                result.enrolmentEmailSent
                  ? `Form sent to ${result.enrolmentEmailTo}. Open Mailpit to see the letter.`
                  : `Child saved, but the email did not send. Share the username and password by hand.`,
              );
              setEmail("");
              setFirstName("");
              setLastName("");
              setDisplayName("");
              setDateOfBirth("");
              setPassword(tempPassword());
            })
            .catch((err: Error) => props.onError(err.message))
            .finally(() => setBusy(false));
        }}
      >
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 font-semibold">Parent who will sign in</legend>
          <label className="field">
            First name
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </label>
          <label className="field">
            Last name
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
          <label className="field sm:col-span-2">
            Email — login and the letter go here
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
          </label>
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 font-semibold">Child this form is for</legend>
          <label className="field">
            Child&apos;s name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>
          <label className="field">
            Date of birth
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
          </label>
        </fieldset>
        <button type="submit" className="btn w-fit" disabled={busy}>
          {busy ? "Sending…" : "Send form"}
        </button>
      </form>
    </section>
  );
}

function ChildrenDesk(props: { onError: (message: string) => void }) {
  const [rows, setRows] = useState<ChildRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    child: PublicLearner;
    parentName: string;
    parentEmail: string;
    overall: { completed: number; total: number; percent: number };
    fillers: FillerTrack[];
    sittings: AssessmentPayload[];
  } | null>(null);

  useEffect(() => {
    api<{ children: ChildRow[] }>("/api/v1/admin/children")
      .then((body) => setRows(body.children))
      .catch((err: Error) => props.onError(err.message));
  }, []);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      return;
    }
    api<{
      child: PublicLearner;
      parentName: string;
      parentEmail: string;
      overall: { completed: number; total: number; percent: number };
      fillers: FillerTrack[];
      sittings: AssessmentPayload[];
    }>(`/api/v1/admin/children/${openId}`)
      .then(setDetail)
      .catch((err: Error) => props.onError(err.message));
  }, [openId]);

  return (
    <section className="grid gap-5">
      <article className="panel">
        <h2 className="text-xl font-semibold">Children</h2>
        <p className="mb-4 mt-1 text-sm text-soft">
          Progress and answers after a parent or teacher fills the form. Open a child to read every section.
        </p>
        <table className="data-table">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2 font-medium">Child</th>
              <th className="py-2 font-medium">Parent / login</th>
              <th className="py-2 font-medium">Progress by person</th>
              <th className="py-2 font-medium">Filled as</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="py-3 text-soft" colSpan={5}>
                  No children enrolled yet. Send a form first.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line/60">
                  <td className="py-2">
                    {row.childName}
                    <div className="text-soft">{row.stageLabel}</div>
                  </td>
                  <td className="py-2">
                    {row.parentName}
                    <div className="text-soft">{row.parentEmail}</div>
                  </td>
                  <td className="py-2">
                    {row.fillers.map((filler) => (
                      <div key={filler.familyRole}>
                        {filler.familyRoleLabel} · {filler.overall.completed}/{filler.overall.total} · {filler.overall.percent}%
                      </div>
                    ))}
                  </td>
                  <td className="py-2">{row.signedInAs ?? "Not signed in yet"}</td>
                  <td className="py-2">
                    <button type="button" className="btn-quiet" onClick={() => setOpenId(row.id)}>
                      View answers
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </article>

      {detail ? (
        <article className="panel grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{detail.child.displayName}</h2>
              <p className="text-sm text-soft">
                {detail.parentName} · {detail.parentEmail}
                {detail.child.familyRoleLabel ? ` · last signed in as ${detail.child.familyRoleLabel}` : ""}
              </p>
            </div>
            <button type="button" className="btn-quiet text-sm" onClick={() => setOpenId(null)}>
              Close
            </button>
          </div>
          <ProgressBar
            percent={detail.overall.percent}
            label={`Parent form · ${detail.overall.completed} of ${detail.overall.total} sections complete`}
          />
          {detail.fillers.length > 1
            ? detail.fillers
                .filter((filler) => filler.familyRole !== "PARENT")
                .map((filler) => (
                  <ProgressBar
                    key={filler.familyRole}
                    percent={filler.overall.percent}
                    label={`${filler.familyRoleLabel} form · ${filler.overall.completed} of ${filler.overall.total} sections complete`}
                  />
                ))
            : null}
          {detail.sittings.length === 0 ? (
            <p className="text-sm text-soft">The family has not started any section yet.</p>
          ) : (
            detail.sittings.map((sitting) => (
              <div key={sitting.instance.id} className="border-t border-line/80 pt-4">
                <h3 className="font-semibold">
                  {sitting.instance.familyRoleLabel ?? "Parent"} · {sitting.instance.tool.name}
                  <span className="ml-2 font-normal text-soft">
                    {sitting.instance.status.replaceAll("_", " ").toLowerCase()} · {sitting.progress.percent}%
                  </span>
                </h3>
                {sitting.sections.map((section) => (
                  <div key={section.id} className="mt-3">
                    <h4 className="text-sm font-medium text-teal">{section.title}</h4>
                    <ul className="mt-2 grid gap-2 text-sm">
                      {section.questions.map((question) => {
                        const chosen = question.options.find((option) => option.id === question.response?.optionId);
                        const answer =
                          chosen?.label ??
                          question.response?.optionLabel ??
                          question.response?.freeText ??
                          (question.response ? "Answered (the original choice is no longer in the bank)" : "Not answered");
                        return (
                          <li key={question.id}>
                            <span className="text-soft">{question.prompt}</span>
                            <div>{answer}</div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ))
          )}
        </article>
      ) : null}
    </section>
  );
}

function QuestionBank(props: { onError: (message: string) => void; onNotice: (message: string) => void }) {
  const [tools, setTools] = useState<BankTool[]>([]);
  const [toolCode, setToolCode] = useState("HDMA");
  const [sectionTitle, setSectionTitle] = useState("Daily living");
  const [indicatorCode, setIndicatorCode] = useState("");
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<BankQuestion["type"]>("SCALE");
  const [csv, setCsv] = useState("");
  const [editing, setEditing] = useState<BankQuestion | null>(null);

  const tool = useMemo(() => tools.find((row) => row.code === toolCode), [tools, toolCode]);

  function reload() {
    return api<{ tools: BankTool[] }>("/api/v1/admin/questions").then((body) => setTools(body.tools));
  }

  useEffect(() => {
    reload().catch((err: Error) => props.onError(err.message));
  }, []);

  useEffect(() => {
    if (tool?.sections[0] && !editing) setSectionTitle(tool.sections[0].title);
  }, [toolCode, tool?.sections[0]?.title]);

  return (
    <section className="grid gap-5">
      <article className="panel grid gap-4">
        <h2 className="text-xl font-semibold">Add a question</h2>
        <p className="text-sm text-soft">
          Type a question or import a CSV. The same indicator code updates an existing question.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            Section (tool)
            <select value={toolCode} onChange={(e) => setToolCode(e.target.value)}>
              {tools.map((row) => (
                <option key={row.code} value={row.code}>
                  {row.code} — {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Group title
            <input value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} />
          </label>
          <label className="field">
            Indicator code
            <input value={indicatorCode} onChange={(e) => setIndicatorCode(e.target.value)} placeholder="HDMA-001" />
          </label>
          <label className="field">
            Type
            <select value={type} onChange={(e) => setType(e.target.value as BankQuestion["type"])}>
              <option value="SCALE">Rating scale</option>
              <option value="FREE_TEXT">Fill in the blank</option>
              <option value="SINGLE_CHOICE">Single choice</option>
            </select>
          </label>
          <label className="field sm:col-span-2">
            Question text
            <textarea className="min-h-20" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          className="btn w-fit"
          onClick={() => {
            api("/api/v1/admin/questions", {
              method: "POST",
              json: { toolCode, sectionTitle, indicatorCode, prompt, type },
            })
              .then(() => {
                setIndicatorCode("");
                setPrompt("");
                props.onNotice("Question saved.");
                return reload();
              })
              .catch((err: Error) => props.onError(err.message));
          }}
        >
          Save question
        </button>
      </article>

      <article className="panel grid gap-4">
        <h2 className="text-xl font-semibold">Import CSV</h2>
        <p className="text-sm text-soft">
          Columns: toolCode, sectionTitle, indicatorCode, prompt, type, options, stages, isQualitative. Same indicator
          code updates the existing question.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-quiet text-sm"
            onClick={() =>
              setCsv(
                [
                  "toolCode,sectionTitle,indicatorCode,prompt,type,options,stages,isQualitative",
                  'HDMA,Daily living,HDMA-001,Does the child complete a familiar daily routine?,SCALE,"4 — Always|3 — Often|2 — Sometimes|1 — Never",,false',
                  "III,Qualitative note,III-FT,Describe one activity the child returns to without being asked.,FREE_TEXT,,,true",
                ].join("\n"),
              )
            }
          >
            Load CSV template
          </button>
          <label className="btn-quiet cursor-pointer text-sm">
            Choose a CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                file.text().then(setCsv).catch((err: Error) => props.onError(err.message));
              }}
            />
          </label>
        </div>
        <textarea
          className="input min-h-32 font-mono text-sm"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="Paste CSV here"
        />
        <button
          type="button"
          className="btn w-fit"
          disabled={csv.trim().length < 20}
          onClick={() => {
            api<{ created: number; updated: number; total: number }>("/api/v1/admin/questions/import", {
              method: "POST",
              json: { csv },
            })
              .then((result) => {
                props.onNotice(`Imported ${result.total} questions (${result.created} new, ${result.updated} updated).`);
                setCsv("");
                return reload();
              })
              .catch((err: Error) => props.onError(err.message));
          }}
        >
          Import CSV
        </button>
      </article>

      <article className="panel grid gap-4">
        <h2 className="text-xl font-semibold">{tool?.name ?? "Questions"}</h2>
        {tool?.sections.map((section) => (
          <div key={section.id}>
            <h3 className="font-medium">{section.title}</h3>
            <ul className="mt-2 grid gap-3">
              {section.questions.map((question) => (
                <li key={question.id} className="section-card text-sm">
                  {editing?.id === question.id ? (
                    <EditQuestion
                      question={question}
                      sectionTitle={section.title}
                      onCancel={() => setEditing(null)}
                      onError={props.onError}
                      onSaved={() => {
                        setEditing(null);
                        void reload();
                      }}
                    />
                  ) : (
                    <>
                      <p className={!question.isActive ? "text-soft" : ""}>
                        <span className="text-soft">{question.indicatorCode}</span> · {question.prompt}
                      </p>
                      <p className="mt-1 text-soft">
                        {question.type}
                        {question.isActive ? "" : " · hidden"}
                        {question.responseCount ? ` · ${question.responseCount} answers already stored` : ""}
                      </p>
                      <div className="mt-2 flex gap-4">
                        <button type="button" className="btn-quiet" onClick={() => setEditing(question)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-quiet"
                          onClick={() => {
                            api(`/api/v1/admin/questions/${question.id}`, { method: "DELETE" })
                              .then(() => reload())
                              .catch((err: Error) => props.onError(err.message));
                          }}
                        >
                          {question.responseCount ? "Hide" : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </article>
    </section>
  );
}

function EditQuestion(props: {
  question: BankQuestion;
  sectionTitle: string;
  onCancel: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [prompt, setPrompt] = useState(props.question.prompt);
  const [sectionTitle, setSectionTitle] = useState(props.sectionTitle);
  const [active, setActive] = useState(props.question.isActive);
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        api(`/api/v1/admin/questions/${props.question.id}`, {
          method: "PATCH",
          json: { prompt, sectionTitle, isActive: active },
        })
          .then(props.onSaved)
          .catch((err: Error) => props.onError(err.message));
      }}
    >
      <label className="field">
        Group title
        <input value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} />
      </label>
      <label className="field">
        Question text
        <textarea className="min-h-20" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Show this question to families
      </label>
      <div className="flex gap-3">
        <button type="submit" className="btn">
          Save
        </button>
        <button type="button" className="btn-quiet text-sm" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
