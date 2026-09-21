import { useState } from "react";
import { api, type PublicLearner } from "./api";

const GENDERS = ["Girl", "Boy", "Other", "Prefer not to say"] as const;

export function ChildProfile(props: {
  learner: PublicLearner;
  mode: "first" | "edit";
  onSaved: (learner: PublicLearner) => void;
  onCancel?: () => void;
  onError: (message: string) => void;
}) {
  const [displayName, setDisplayName] = useState(props.learner.displayName);
  const [dateOfBirth, setDateOfBirth] = useState(props.learner.dateOfBirth);
  const [gender, setGender] = useState(props.learner.gender ?? "");
  const [diagnosis, setDiagnosis] = useState(props.learner.diagnosis ?? "");
  const [schoolName, setSchoolName] = useState(props.learner.schoolName ?? "");
  const [city, setCity] = useState(props.learner.city ?? "");
  const [teacherEmail, setTeacherEmail] = useState(props.learner.teacherEmail ?? "");
  const [caregiverEmail, setCaregiverEmail] = useState(props.learner.caregiverEmail ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="panel mx-auto grid max-w-2xl gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        api<{ learner: PublicLearner }>("/api/v1/learners/me", {
          method: "PATCH",
          json: {
            displayName,
            dateOfBirth,
            gender,
            diagnosis: diagnosis || undefined,
            schoolName: schoolName || undefined,
            city: city || undefined,
            teacherEmail: teacherEmail || undefined,
            caregiverEmail: caregiverEmail || undefined,
          },
        })
          .then((body) => props.onSaved(body.learner))
          .catch((err: Error) => props.onError(err.message))
          .finally(() => setBusy(false));
      }}
    >
      <div>
        <p className="eyebrow">Basic Information</p>
        <h2 className="mt-2 text-2xl font-semibold">
          {props.mode === "first" ? "Basic Information" : "Edit Basic Information"}
        </h2>
        <p className="mt-3 leading-relaxed text-soft">
          {props.mode === "first"
            ? "The parent fills this once. After it is saved, teacher, caregiver, or child can each fill their own form."
            : "Full name, date of birth, and gender as listed in the CAP Assessment. Other details are optional."}
        </p>
      </div>

      <fieldset className="grid gap-4">
        <legend className="mb-1 font-semibold">Learner</legend>
        <label className="field">
          Full Name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            Date of birth
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
          </label>
          <div className="field">
            Gender
            <div className="chip-row" role="radiogroup" aria-label="Gender">
              {GENDERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={gender === value}
                  className={gender === value ? "chip chip-on" : "chip"}
                  onClick={() => setGender(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 font-semibold">Everyday details — optional</legend>
        <label className="field">
          Diagnosis or condition
          <textarea
            className="min-h-24"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Only if you wish to share it."
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            School or centre
            <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
          </label>
          <label className="field">
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 font-semibold">Who else may sign in — optional</legend>
        <label className="field">
          Teacher&apos;s email
          <input
            type="email"
            value={teacherEmail}
            onChange={(e) => setTeacherEmail(e.target.value)}
            placeholder="We send the teacher their sign-in code here."
          />
        </label>
        <label className="field">
          Caregiver&apos;s email
          <input
            type="email"
            value={caregiverEmail}
            onChange={(e) => setCaregiverEmail(e.target.value)}
            placeholder="We send the caregiver their sign-in code here."
          />
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn" disabled={busy || !gender}>
          {busy ? "Saving…" : props.mode === "first" ? "Save child profile" : "Save changes"}
        </button>
        {props.mode === "edit" && props.onCancel ? (
          <button type="button" className="btn-quiet" onClick={props.onCancel}>
            Back
          </button>
        ) : null}
      </div>
    </form>
  );
}
