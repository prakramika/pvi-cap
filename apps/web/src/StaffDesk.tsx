import { useEffect, useMemo, useState } from "react";
import { api, type PublicUser } from "./api";
import type { AssessmentPayload, StaffRow } from "./types";

const RELATIONS = [
  { value: "PARENT", label: "Parent" },
  { value: "GUARDIAN", label: "Guardian" },
  { value: "TEACHER", label: "Teacher / educator" },
  { value: "SELF", label: "The young person (own login)" },
  { value: "OTHER", label: "Other caregiver" },
] as const;

function tempPassword(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Welcome${n}a`;
}

function previewAge(iso: string): { years: number; stage: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const dob = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let years = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) years -= 1;
  years = Math.max(0, years);
  const stage =
    years <= 5 ? "Early Childhood" : years <= 10 ? "Pre-Skill" : years <= 15 ? "Basic" : years <= 20 ? "Intermediate" : "Advanced";
  return { years, stage };
}

export function StaffDesk(props: {
  user: PublicUser;
  onError: (message: string) => void;
  onCreated: (message: string) => void;
}) {
  const [tab, setTab] = useState<"enrol" | "review">(props.user.role === "ADMIN" ? "enrol" : "review");
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AssessmentPayload | null>(null);
  const [notes, setNotes] = useState("");
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastLetter, setLastLetter] = useState<{
    from: string;
    to: string;
    subject: string;
    password?: string;
    note: string;
  } | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(tempPassword);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relation, setRelation] = useState<(typeof RELATIONS)[number]["value"]>("PARENT");
  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const preview = useMemo(() => previewAge(dateOfBirth), [dateOfBirth]);

  function loadList() {
    api<{ assessments: StaffRow[] }>("/api/v1/assessments")
      .then((body) => setRows(body.assessments))
      .catch((err: Error) => props.onError(err.message));
  }

  function loadUsers() {
    api<{ users: PublicUser[] }>("/api/v1/users")
      .then((body) => setUsers(body.users))
      .catch((err: Error) => props.onError(err.message));
  }

  useEffect(() => {
    loadList();
    loadUsers();
  }, []);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      return;
    }
    api<AssessmentPayload>(`/api/v1/assessments/${openId}`)
      .then((payload) => {
        setDetail(payload);
        setNotes(payload.instance.review?.notes ?? "");
      })
      .catch((err: Error) => props.onError(err.message));
  }, [openId]);

  return (
    <div className="grid gap-6">
      <p className="text-sm text-soft">
        Signed in as {props.user.firstName} {props.user.lastName} · {props.user.role === "ADMIN" ? "Administrator" : "Specialist"}
      </p>
      <div className="flex flex-wrap gap-2">
        {props.user.role === "ADMIN" ? (
          <button
            type="button"
            className={tab === "enrol" ? "btn" : "min-h-11 border border-line bg-card px-4 text-teal"}
            onClick={() => setTab("enrol")}
          >
            Enrol a child
          </button>
        ) : null}
        <button
          type="button"
          className={tab === "review" ? "btn" : "min-h-11 border border-line bg-card px-4 text-teal"}
          onClick={() => setTab("review")}
        >
          Review sittings
        </button>
      </div>

      {tab === "enrol" ? (
        <section className="grid gap-8 border border-line bg-card p-6 sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">Enrol a child</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-soft">
              The email belongs to the adult who will sign in — usually a parent, guardian, or teacher.
              The child gets a profile, not a mailbox. After you save, we send them the username and a temporary password.
            </p>
          </div>
          <form
            className="grid gap-8"
            onSubmit={(event) => {
              event.preventDefault();
              setBusy(true);
              api<{
                user: PublicUser;
                enrolmentEmailSent: boolean;
                enrolmentEmailTo: string;
                demoInbox?: { from: string; to: string; subject: string; password?: string; note: string };
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
                  respondentRelation: relation,
                },
              })
                .then((result) => {
                  if (result.demoInbox) {
                    setLastLetter(result.demoInbox);
                    props.onCreated(
                      `${displayName} is enrolled. SMTP is off, so the Prakramika no-reply letter is shown on this page.`,
                    );
                  } else {
                    const mail = result.enrolmentEmailSent
                      ? `Enrolment email sent to ${result.enrolmentEmailTo}.`
                      : `Child enrolled, but the email could not be sent. Please share the username and password with the family by hand.`;
                    props.onCreated(`${displayName} is enrolled. ${mail}`);
                  }
                  setEmail("");
                  setFirstName("");
                  setLastName("");
                  setDisplayName("");
                  setDateOfBirth("");
                  setPassword(tempPassword());
                  loadUsers();
                })
                .catch((err: Error) => props.onError(err.message))
                .finally(() => setBusy(false));
            }}
          >
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium tracking-wide text-teal">Who signs in</legend>
              <label className="field sm:col-span-1">
                First name
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </label>
              <label className="field">
                Last name
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </label>
              <label className="field sm:col-span-2">
                Email — this is the username. Mail goes here, not to the child.
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
              </label>
              <label className="field">
                Relationship to the child
                <select value={relation} onChange={(e) => setRelation(e.target.value as (typeof RELATIONS)[number]["value"])}>
                  {RELATIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Temporary password
                <span className="flex gap-2">
                  <input className="flex-1" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <button type="button" className="btn bg-teal-deep" onClick={() => setPassword(tempPassword())}>
                    New
                  </button>
                </span>
              </label>
            </fieldset>

            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium tracking-wide text-teal">Child being enrolled</legend>
              <label className="field sm:col-span-2">
                Child&apos;s name (how the family knows them)
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </label>
              <label className="field">
                Date of birth
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
              </label>
              <p className="self-end text-sm text-soft">
                {preview
                  ? `About ${preview.years} years · stage ${preview.stage} (you can override later if needed)`
                  : "Stage is chosen from date of birth."}
              </p>
            </fieldset>

            <button type="submit" className="btn w-fit" disabled={busy}>
              {busy ? "Enrolling…" : "Enrol and send email"}
            </button>
          </form>

          {lastLetter ? (
            <article className="border border-line bg-mist p-5 text-sm">
              <p className="text-xs tracking-[0.14em] text-teal">DEMO INBOX · NOT REAL SMTP</p>
              <p className="mt-2">{lastLetter.note}</p>
              <p className="mt-3 text-soft">From: {lastLetter.from}</p>
              <p className="text-soft">To: {lastLetter.to}</p>
              <p className="mt-2 font-medium">{lastLetter.subject}</p>
              {lastLetter.password ? (
                <p className="mt-3">
                  Temporary password: <strong>{lastLetter.password}</strong>
                </p>
              ) : null}
            </article>
          ) : null}

          <div>
            <h3 className="font-medium">People</h3>
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 font-medium">Adult sign-in</th>
                  <th className="py-2 font-medium">Email</th>
                  <th className="py-2 font-medium">Role</th>
                  <th className="py-2 font-medium">Child / stage</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id} className="border-b border-line/60">
                    <td className="py-2">
                      {row.firstName} {row.lastName}
                    </td>
                    <td className="py-2">{row.email}</td>
                    <td className="py-2">{row.role === "RESPONDENT" ? row.learner?.relationLabel ?? "Family" : row.role}</td>
                    <td className="py-2">
                      {row.learner ? `${row.learner.displayName} · ${row.learner.stageLabel}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "review" ? (
        <section className="grid gap-6">
          <article className="border border-line bg-card p-6">
            <h2 className="text-xl font-semibold">Sittings</h2>
            <p className="mb-3 mt-1 text-sm text-soft">Read what the family sent. Phase 1 does not score or generate a report.</p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 font-medium">Child</th>
                  <th className="py-2 font-medium">Tool</th>
                  <th className="py-2 font-medium">Stage</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="py-3 text-soft" colSpan={5}>
                      No sittings yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-line/60">
                      <td className="py-2">{row.learnerName}</td>
                      <td className="py-2">{row.toolCode}</td>
                      <td className="py-2">{row.stageLabel}</td>
                      <td className="py-2">{row.status.replaceAll("_", " ").toLowerCase()}</td>
                      <td className="py-2">
                        <button type="button" className="btn-quiet" onClick={() => setOpenId(row.id)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </article>

          {detail ? (
            <section className="grid gap-4 border border-line bg-card p-6">
              <h2 className="text-lg font-semibold">
                {detail.instance.tool.name} · {detail.instance.learner.displayName}
              </h2>
              {detail.sections.map((section) => (
                <div key={section.id}>
                  <h3 className="font-medium">{section.title}</h3>
                  <ul className="mt-2 grid gap-2 text-sm">
                    {section.questions.map((question) => {
                      const chosen = question.options.find((option) => option.id === question.response?.optionId);
                      return (
                        <li key={question.id}>
                          <span className="text-soft">{question.prompt}</span>
                          <div>{chosen?.label ?? question.response?.freeText ?? "—"}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <label className="field">
                Specialist notes (for the institute, not shown to the family in Phase 1)
                <textarea className="min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn disabled:opacity-50"
                  disabled={!["SUBMITTED", "UNDER_REVIEW", "REVIEWED"].includes(detail.instance.status)}
                  onClick={() => {
                    api(`/api/v1/assessments/${detail.instance.id}/review`, {
                      method: "PATCH",
                      json: { notes, status: "COMPLETED" },
                    })
                      .then(() => {
                        loadList();
                        setOpenId(null);
                      })
                      .catch((err: Error) => props.onError(err.message));
                  }}
                >
                  Mark reviewed
                </button>
                <button type="button" className="btn-quiet text-sm" onClick={() => setOpenId(null)}>
                  Close
                </button>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
