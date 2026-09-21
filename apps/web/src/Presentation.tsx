import { useEffect, useState, type ReactNode } from "react";
import {
  CAP_AUTHOR,
  CAP_TITLE,
  CONSENT_INTRO,
  CONSENT_ITEMS,
  DECLARATION_ITEMS,
  DISCLAIMER,
  DURATION_LINE,
  HONESTY_LINE,
  THANKS_LINE,
  TOOL_ORDER,
  WELCOME_APPROACH,
  WELCOME_INTRO,
  WELCOME_USES,
  WHO_CAN_ANSWER,
  toolHeading,
} from "./spec-copy";

const STEPS = [
  { id: "overview", label: "Overview" },
  { id: "purpose", label: "Purpose" },
  { id: "people", label: "Who takes part" },
  { id: "send", label: "Institute sends form" },
  { id: "letter", label: "Enrolment letter" },
  { id: "signin", label: "Sign in" },
  { id: "role", label: "Parent first" },
  { id: "otp", label: "Email code" },
  { id: "profile", label: "Basic Information" },
  { id: "consent", label: "Consent" },
  { id: "tools", label: "Six tools" },
  { id: "question", label: "One question" },
  { id: "resume", label: "Save and resume" },
  { id: "teacher", label: "Teacher form" },
  { id: "complete", label: "Completion" },
  { id: "desk", label: "Institute desk" },
  { id: "safeguards", label: "Safeguards" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const SAMPLE_QUESTIONS = [
  {
    prompt: "How independently does the learner manage everyday personal care?",
    options: [
      { mark: "4", label: "Consistently, with little or no help" },
      { mark: "3", label: "Often, with occasional prompts" },
      { mark: "2", label: "Sometimes, with regular support" },
      { mark: "1", label: "Rarely, even with support" },
    ],
  },
  {
    prompt: "How readily does the learner follow a familiar daily routine?",
    options: [
      { mark: "4", label: "Consistently" },
      { mark: "3", label: "Often" },
      { mark: "2", label: "Sometimes" },
      { mark: "1", label: "Rarely" },
    ],
  },
  {
    prompt: "How comfortably does the learner work alongside a familiar adult?",
    options: [
      { mark: "4", label: "Consistently" },
      { mark: "3", label: "Often" },
      { mark: "2", label: "Sometimes" },
      { mark: "1", label: "Rarely" },
    ],
  },
];

const PRESENT_ONLY = import.meta.env.VITE_PRESENT_ONLY === "true";

function parseStep(): StepId {
  const ids = STEPS.map((step) => step.id);
  const hashValue = window.location.hash.replace(/^#\/?/, "");
  const hashId = hashValue.replace(/^present\/?/, "").split("/")[0];
  if (hashId && ids.includes(hashId as StepId)) return hashId as StepId;
  if (!PRESENT_ONLY) {
    const path = window.location.pathname.match(/\/present(?:\/([a-z0-9-]+))?/i);
    if (path?.[1] && ids.includes(path[1] as StepId)) return path[1] as StepId;
  }
  return "overview";
}

function writeStep(id: StepId) {
  if (PRESENT_ONLY) {
    const next = `#/${id}`;
    if (window.location.hash === next) return;
    window.history.pushState({ present: id }, "", next);
    return;
  }
  const next = `/present/${id}`;
  if (window.location.pathname === next) return;
  window.history.pushState({ present: id }, "", next);
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

function Frame(props: { eyebrow: string; title: string; note: string; children: ReactNode }) {
  return (
    <div className="grid gap-4">
      <p className="present-note">{props.note}</p>
      <div className="present-frame">
        <header className="shell-header" style={{ marginBottom: 0 }}>
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              P
            </span>
            <div>
              <p className="eyebrow">Prakramika Vocational Institute</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">PVI-CAP</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-soft">{CAP_TITLE}</p>
            </div>
          </div>
          <div className="text-right text-sm text-soft">
            <p className="font-semibold text-ink">{props.eyebrow}</p>
            <p>{props.title}</p>
          </div>
        </header>
        <div className="present-frame-body">{props.children}</div>
      </div>
    </div>
  );
}

export function isPresentationRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === "/present" || path.startsWith("/present/") || window.location.hash.startsWith("#/present");
}

export function Presentation() {
  const [stepId, setStepId] = useState<StepId>(parseStep);
  const [notesOn, setNotesOn] = useState(true);
  const index = STEPS.findIndex((step) => step.id === stepId);
  const step = STEPS[index] ?? STEPS[0];

  function go(id: StepId) {
    writeStep(id);
    setStepId(id);
  }

  function shift(delta: number) {
    const next = STEPS[index + delta];
    if (next) go(next.id);
  }

  useEffect(() => {
    document.title = "PVI-CAP walkthrough · Prakramika Vocational Institute";
    return () => {
      document.title = "PVI-CAP · Prakramika Vocational Institute";
    };
  }, []);

  useEffect(() => {
    const sync = () => setStepId(parseStep());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    if (PRESENT_ONLY) {
      if (!window.location.hash) writeStep(parseStep());
    } else if (!window.location.pathname.startsWith("/present")) {
      writeStep(parseStep());
    }
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "ArrowRight" || event.key === "PageDown") shift(1);
      if (event.key === "ArrowLeft" || event.key === "PageUp") shift(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="app-shell present-shell">
      <header className="present-top">
        <div>
          <p className="eyebrow">For presentation</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">PVI-CAP product walkthrough</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-soft">
            Prakramika Vocational Institute · {CAP_AUTHOR}. Click through the screens as they will appear. Sample child:
            Aarav. No live data is used.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-quiet text-sm" onClick={() => setNotesOn((value) => !value)}>
            {notesOn ? "Hide speaker notes" : "Show speaker notes"}
          </button>
          <span className="pill">
            {index + 1} / {STEPS.length}
          </span>
        </div>
      </header>

      <div className="present-layout">
        <nav className="present-nav panel" aria-label="Walkthrough steps">
          <p className="text-sm font-semibold">The journey</p>
          <ol className="present-steps">
            {STEPS.map((item, itemIndex) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === step.id ? "present-step present-step-on" : "present-step"}
                  aria-current={item.id === step.id ? "step" : undefined}
                  onClick={() => go(item.id)}
                >
                  <span>{itemIndex + 1}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className={notesOn ? undefined : "present-notes-off"}>
          <StepBody id={step.id} onNext={() => shift(1)} />
          <div className="present-pager">
            <button type="button" className="btn-quiet" disabled={index === 0} onClick={() => shift(-1)}>
              Previous
            </button>
            <button type="button" className="btn" disabled={index === STEPS.length - 1} onClick={() => shift(1)}>
              {index === STEPS.length - 1 ? "End" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBody(props: { id: StepId; onNext: () => void }) {
  switch (props.id) {
    case "overview":
      return <Overview onBegin={props.onNext} />;
    case "purpose":
      return <Purpose />;
    case "people":
      return <People />;
    case "send":
      return <SendForm onSent={props.onNext} />;
    case "letter":
      return <EnrolmentLetter />;
    case "signin":
      return <SignIn onSignIn={props.onNext} />;
    case "role":
      return <ParentFirst onContinue={props.onNext} />;
    case "otp":
      return <OtpScreen onContinue={props.onNext} />;
    case "profile":
      return <ProfileScreen onContinue={props.onNext} />;
    case "consent":
      return <ConsentScreen onContinue={props.onNext} />;
    case "tools":
      return <ToolsScreen onBegin={props.onNext} />;
    case "question":
      return <QuestionScreen onDone={props.onNext} />;
    case "resume":
      return <ResumeScreen />;
    case "teacher":
      return <TeacherScreen />;
    case "complete":
      return <CompleteScreen />;
    case "desk":
      return <DeskScreen />;
    case "safeguards":
      return <SafeguardsScreen />;
  }
}

function Overview(props: { onBegin: () => void }) {
  return (
    <article className="panel grid gap-6">
      <div>
        <p className="eyebrow">Career Alignment Pathway</p>
        <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">{CAP_TITLE}</h2>
        <p className="mt-3 text-soft">{CAP_AUTHOR} · Prakramika Vocational Institute</p>
      </div>
      <p className="max-w-3xl leading-relaxed">{WELCOME_INTRO}</p>
      <p className="max-w-3xl leading-relaxed text-soft">{WELCOME_APPROACH}</p>
      <ul className="present-points">
        <li>A calm website for the family, the teacher, and the institute — not an exam.</li>
        <li>Six tools, in order, to understand strengths, interests, learning, independence, workplace readiness, and vocational pathways.</li>
        <li>Each person fills their own form. They may stop and continue later from the same question.</li>
        <li>The institute can send the form, follow progress, and read answers. The report follows by email.</li>
      </ul>
      <button type="button" className="btn w-fit" onClick={props.onBegin}>
        Begin the walkthrough
      </button>
    </article>
  );
}

function Purpose() {
  return (
    <Frame
      eyebrow="Family website"
      title="Welcome"
      note="Start here with government guests: what CAP is for, and what it is not."
    >
      <article className="panel mx-auto grid max-w-2xl gap-6">
        <div>
          <p className="eyebrow">Welcome</p>
          <h3 className="mt-2 text-2xl font-semibold">{CAP_TITLE}</h3>
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
      </article>
    </Frame>
  );
}

function People() {
  const roles = [
    { label: "Parent", hint: "Completes Basic Information first, then their own form at home." },
    { label: "Teacher", hint: "Same child, a separate form. Sign-in code can go to the teacher’s mailbox." },
    { label: "Caregiver", hint: "Supports day to day. Own form, own saved progress." },
    { label: "Child", hint: "An older learner may answer with help. No separate child mailbox is required." },
    { label: "Institute admin", hint: "Sends the form, follows progress, reads answers, maintains the question bank." },
  ];
  return (
    <Frame
      eyebrow="Who is involved"
      title="One child · many voices"
      note="One family login per child. The first visit is Parent only. After that, each person fills an individual form."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {roles.map((role) => (
          <article key={role.label} className="panel">
            <h3 className="font-semibold">{role.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-soft">{role.hint}</p>
          </article>
        ))}
      </div>
    </Frame>
  );
}

function SendForm(props: { onSent: () => void }) {
  return (
    <Frame
      eyebrow="Institute administrator"
      title="Send a form"
      note="The institute enrols a child. The parent receives the login by email."
    >
      <section className="panel mx-auto grid max-w-xl gap-5">
        <div>
          <p className="eyebrow">Send a form</p>
          <h3 className="mt-2 text-xl font-semibold">Enrol a child</h3>
          <p className="mt-2 text-sm text-soft">Parent name, parent email, child name, and date of birth.</p>
        </div>
        <label className="field">
          Parent first name
          <input defaultValue="Meera" readOnly />
        </label>
        <label className="field">
          Parent last name
          <input defaultValue="Sharma" readOnly />
        </label>
        <label className="field">
          Parent email
          <input defaultValue="meera.sharma@example.com" readOnly />
        </label>
        <label className="field">
          Child’s name
          <input defaultValue="Aarav Sharma" readOnly />
        </label>
        <label className="field">
          Date of birth
          <input defaultValue="2016-04-12" readOnly />
        </label>
        <button type="button" className="btn w-fit" onClick={props.onSent}>
          Send form
        </button>
      </section>
    </Frame>
  );
}

function EnrolmentLetter() {
  return (
    <Frame
      eyebrow="Parent mailbox"
      title="Enrolment letter"
      note="The letter carries the login link, username, and a temporary password. The parent does not create an account themselves."
    >
      <article className="letter">
        <p className="text-sm text-soft">From: Prakramika Vocational Institute</p>
        <p className="text-sm text-soft">To: meera.sharma@example.com</p>
        <h3 className="mt-4 text-xl font-semibold">Aarav Sharma has been enrolled in PVI-CAP</h3>
        <p className="mt-4 leading-relaxed">
          Please sign in to complete Basic Information and begin the Career Alignment Pathway Assessment.
        </p>
        <dl className="mt-5 grid gap-3 text-sm">
          <div>
            <dt className="text-soft">Login</dt>
            <dd className="font-medium">Open the PVI-CAP website</dd>
          </div>
          <div>
            <dt className="text-soft">Username</dt>
            <dd className="font-medium">meera.sharma@example.com</dd>
          </div>
          <div>
            <dt className="text-soft">Temporary password</dt>
            <dd className="font-medium">Sent only in this letter</dd>
          </div>
        </dl>
      </article>
    </Frame>
  );
}

function SignIn(props: { onSignIn: () => void }) {
  return (
    <Frame
      eyebrow="Family sign-in"
      title="Welcome"
      note="The family website opens with the CAP welcome, then a simple sign-in."
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="panel">
          <p className="eyebrow">Welcome</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">{CAP_TITLE}</h3>
          <p className="mt-3 leading-relaxed text-soft">{WELCOME_INTRO}</p>
          <p className="mt-3 leading-relaxed text-soft">{HONESTY_LINE}</p>
          <p className="mt-3 text-sm leading-relaxed text-soft">{WHO_CAN_ANSWER}</p>
        </section>
        <form
          className="panel grid content-start"
          onSubmit={(event) => {
            event.preventDefault();
            props.onSignIn();
          }}
        >
          <h3 className="mb-1 text-xl font-semibold">Sign in</h3>
          <p className="mb-5 text-sm text-soft">Use the username and password from your enrolment email.</p>
          <label className="field mb-3">
            Username (email)
            <input defaultValue="meera.sharma@example.com" readOnly />
          </label>
          <label className="field mb-5">
            Password
            <input type="password" defaultValue="••••••••••" readOnly />
          </label>
          <button type="submit" className="btn w-full">
            Sign in
          </button>
        </form>
      </div>
    </Frame>
  );
}

function ParentFirst(props: { onContinue: () => void }) {
  return (
    <Frame
      eyebrow="Who is answering?"
      title="First visit"
      note="The first time, only the parent can sign in. They must complete Basic Information before a teacher, caregiver, or child can fill a form."
    >
      <form
        className="panel mx-auto grid max-w-xl gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          props.onContinue();
        }}
      >
        <div>
          <p className="eyebrow">One more step</p>
          <h3 className="mt-2 text-2xl font-semibold">Who is answering?</h3>
          <p className="mt-2 text-sm leading-relaxed text-soft">
            The first time, only the parent can sign in. They fill Basic Information for the child. After that, teacher,
            caregiver, or child can each fill their own form.
          </p>
        </div>
        <div className="role-grid" role="radiogroup" aria-label="I am the">
          <button type="button" role="radio" aria-checked className="role-card role-card-on">
            <span className="font-semibold">Parent</span>
            <span className="text-sm text-soft">At home with the child</span>
          </button>
          <div className="role-card present-role-off">
            <span className="font-semibold">Teacher</span>
            <span className="text-sm text-soft">Available after Basic Information</span>
          </div>
          <div className="role-card present-role-off">
            <span className="font-semibold">Caregiver</span>
            <span className="text-sm text-soft">Available after Basic Information</span>
          </div>
          <div className="role-card present-role-off">
            <span className="font-semibold">Child</span>
            <span className="text-sm text-soft">Available after Basic Information</span>
          </div>
        </div>
        <button type="submit" className="btn w-fit">
          Send my sign-in code
        </button>
      </form>
    </Frame>
  );
}

function OtpScreen(props: { onContinue: () => void }) {
  return (
    <Frame
      eyebrow="Signed in as Parent"
      title="Email code"
      note="A one-time code is emailed. If a teacher email is saved later, the teacher’s code goes to that mailbox."
    >
      <form
        className="panel mx-auto grid max-w-lg gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          props.onContinue();
        }}
      >
        <h3 className="text-xl font-semibold">Enter the email code</h3>
        <p className="text-sm leading-relaxed text-soft">
          You have logged in as <strong>Parent</strong>. A 6-digit OTP was sent to meera.sharma@example.com.
        </p>
        <p className="text-center text-3xl font-semibold tracking-[0.35em] text-ink">482190</p>
        <p className="text-center text-sm text-soft">Valid for 10 minutes</p>
        <button type="submit" className="btn w-full">
          Verify code
        </button>
      </form>
    </Frame>
  );
}

function ProfileScreen(props: { onContinue: () => void }) {
  return (
    <Frame
      eyebrow="Parent · Aarav Sharma"
      title="Basic Information"
      note="The parent fills this once. Optional teacher and caregiver emails let those people receive their own sign-in codes."
    >
      <form
        className="panel mx-auto grid max-w-2xl gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          props.onContinue();
        }}
      >
        <div>
          <p className="eyebrow">Basic Information</p>
          <h3 className="mt-2 text-2xl font-semibold">Basic Information</h3>
          <p className="mt-3 leading-relaxed text-soft">
            The parent fills this once. After it is saved, teacher, caregiver, or child can each fill their own form.
          </p>
        </div>
        <fieldset className="grid gap-4">
          <legend className="mb-1 font-semibold">Learner</legend>
          <label className="field">
            Full Name
            <input defaultValue="Aarav Sharma" readOnly />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              Date of birth
              <input defaultValue="12 Apr 2016" readOnly />
            </label>
            <div className="field">
              Gender
              <div className="chip-row">
                <span className="chip">Girl</span>
                <span className="chip chip-on">Boy</span>
                <span className="chip">Other</span>
              </div>
            </div>
          </div>
        </fieldset>
        <fieldset className="grid gap-4">
          <legend className="mb-1 font-semibold">Who else may sign in — optional</legend>
          <label className="field">
            Teacher’s email
            <input defaultValue="latha.teacher@example.com" readOnly />
          </label>
          <label className="field">
            Caregiver’s email
            <input defaultValue="" placeholder="Optional" readOnly />
          </label>
        </fieldset>
        <button type="submit" className="btn w-fit">
          Save child profile
        </button>
      </form>
    </Frame>
  );
}

function ConsentScreen(props: { onContinue: () => void }) {
  const [consented, setConsented] = useState(() => CONSENT_ITEMS.map(() => false));
  const ready = consented.every(Boolean);
  return (
    <Frame
      eyebrow="Parent · Aarav Sharma"
      title="Consent and disclaimer"
      note="Consent is required in the live system. The disclaimer states that CAP is not a medical diagnosis."
    >
      <article className="panel mx-auto grid max-w-2xl gap-6">
        <div>
          <p className="eyebrow">Welcome</p>
          <h3 className="mt-2 text-2xl font-semibold">{CAP_TITLE}</h3>
        </div>
        <div>
          <h4 className="font-semibold">Consent Statement</h4>
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
          <h4 className="font-semibold">Disclaimer</h4>
          {DISCLAIMER.slice(0, 3).map((row) => (
            <div key={row.title}>
              <p className="font-medium">{row.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-soft">{row.body}</p>
            </div>
          ))}
          <p className="text-sm text-soft">All eight disclaimer points appear on the live screen.</p>
        </div>
        <button type="button" className="btn w-fit" disabled={!ready} onClick={props.onContinue}>
          Continue
        </button>
      </article>
    </Frame>
  );
}

function ToolsScreen(props: { onBegin: () => void }) {
  return (
    <Frame
      eyebrow="Parent form · Aarav Sharma"
      title="Six tools in order"
      note="Sections cannot be skipped. Only the current tool can be begun. Overall progress sits at the top."
    >
      <section className="grid gap-5">
        <div className="panel">
          <h3 className="text-xl font-semibold">{CAP_TITLE}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-soft">
            This is the Parent form for Aarav Sharma. Answers here stay with this person. You can save and continue
            later from the same question. {DURATION_LINE}
          </p>
          <div className="mt-5">
            <ProgressBar percent={0} label="Overall · 0 of 6 sections" />
          </div>
        </div>
        <div className="grid gap-3">
          {TOOL_ORDER.map((tool, toolIndex) => (
            <article
              key={tool.code}
              className={toolIndex === 0 ? "section-card" : "section-card section-card-locked"}
            >
              <div>
                <p className="font-semibold">
                  {toolHeading(tool.code, tool.name)}
                  <span className="ml-2 text-sm font-normal text-soft">{tool.code}</span>
                </p>
                <p className="mt-1 text-sm text-soft">
                  {toolIndex === 0 ? "Ready to begin" : "Locked until the previous section is finished"}
                </p>
              </div>
              {toolIndex === 0 ? (
                <button type="button" className="btn" onClick={props.onBegin}>
                  Begin
                </button>
              ) : (
                <span className="pill pill-locked">Locked</span>
              )}
            </article>
          ))}
        </div>
      </section>
    </Frame>
  );
}

function QuestionScreen(props: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const question = SAMPLE_QUESTIONS[index];
  const percent = Math.round((index / SAMPLE_QUESTIONS.length) * 100);

  function choose(mark: string) {
    setPicked(mark);
    window.setTimeout(() => {
      if (index + 1 >= SAMPLE_QUESTIONS.length) {
        props.onDone();
        return;
      }
      setIndex((current) => current + 1);
      setPicked(null);
    }, 280);
  }

  return (
    <Frame
      eyebrow="Parent form"
      title="One question at a time"
      note="Choosing an answer saves it and moves forward. There is no next or previous. The last answer completes the section."
    >
      <section className="mx-auto grid max-w-2xl gap-5">
        <div className="panel">
          <p className="eyebrow">HDMA</p>
          <h3 className="mt-2 text-2xl font-semibold">{toolHeading("HDMA", "Holistic Development Milestone Assessment")}</h3>
          <p className="mt-2 text-sm text-soft">Parent form for Aarav Sharma. You can leave and continue later from this question.</p>
          <div className="mt-5">
            <ProgressBar percent={percent} label={`Question ${index + 1} of ${SAMPLE_QUESTIONS.length}`} />
          </div>
        </div>
        <article className="panel question-enter" key={question.prompt}>
          <p className="text-xl font-medium leading-relaxed">{question.prompt}</p>
          <div className="choice-grid mt-6" role="radiogroup">
            {question.options.map((option) => (
              <button
                key={option.mark}
                type="button"
                role="radio"
                aria-checked={picked === option.mark}
                className={picked === option.mark ? "choice choice-on" : "choice"}
                onClick={() => choose(option.mark)}
              >
                <span className="choice-mark">{option.mark}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </article>
      </section>
    </Frame>
  );
}

function ResumeScreen() {
  return (
    <Frame
      eyebrow="Parent form"
      title="Save now, continue later"
      note="If the parent signs out mid-section, the next visit opens the same unanswered question. Completed answers cannot be edited."
    >
      <section className="grid gap-5">
        <div className="panel">
          <h3 className="text-xl font-semibold">{CAP_TITLE}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-soft">
            Aarav’s parent returned the next day. Section 1 is complete. Section 2 is ready. The rest stay locked.
          </p>
          <div className="mt-5">
            <ProgressBar percent={17} label="Overall · 1 of 6 sections" />
          </div>
        </div>
        <article className="section-card">
          <div>
            <p className="font-semibold">{toolHeading("HDMA", "HDMA")}</p>
            <p className="mt-1 text-sm text-soft">Completed</p>
          </div>
          <span className="pill">Completed</span>
        </article>
        <article className="section-card">
          <div>
            <p className="font-semibold">{toolHeading("III", "III")}</p>
            <p className="mt-1 text-sm text-soft">In progress · continue from the last unanswered question</p>
          </div>
          <span className="btn pointer-events-none">Continue</span>
        </article>
        <article className="section-card section-card-locked">
          <div>
            <p className="font-semibold">{toolHeading("CALP", "CALP")}</p>
            <p className="mt-1 text-sm text-soft">Locked until the previous section is finished</p>
          </div>
          <span className="pill pill-locked">Locked</span>
        </article>
      </section>
    </Frame>
  );
}

function TeacherScreen() {
  return (
    <Frame
      eyebrow="Teacher form · same child"
      title="A separate sitting"
      note="Same family login. Choose Teacher. The teacher starts at question 1 of their own form. Parent answers are never mixed in."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="panel">
          <p className="eyebrow">Parent</p>
          <h3 className="mt-2 text-lg font-semibold">Meera · Parent form</h3>
          <p className="mt-2 text-sm text-soft">2 of 6 sections complete</p>
          <div className="mt-4">
            <ProgressBar percent={33} label="Parent progress" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-soft">Saved answers stay with the parent sitting.</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Teacher</p>
          <h3 className="mt-2 text-lg font-semibold">Ms Latha · Teacher form</h3>
          <p className="mt-2 text-sm text-soft">Own form · starts from the first question</p>
          <div className="mt-4">
            <ProgressBar percent={0} label="Teacher progress" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-soft">
            Sign-in code goes to the teacher email if one was saved. The same family username is used.
          </p>
        </article>
      </div>
    </Frame>
  );
}

function CompleteScreen() {
  const [declared, setDeclared] = useState(() => DECLARATION_ITEMS.map(() => false));
  const ready = declared.every(Boolean);
  return (
    <Frame
      eyebrow="Parent form · complete"
      title="Declaration"
      note="When all six tools are finished, the family confirms the declaration. A letter says the report will follow by email. Scores are not shown in the app."
    >
      <article className="panel-quiet mx-auto grid max-w-2xl gap-4">
        <h3 className="text-xl font-semibold">Declaration</h3>
        <p className="leading-relaxed">You have finished all six tools for Aarav Sharma.</p>
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
        {ready ? (
          <p className="leading-relaxed">
            Thank you. A letter is on its way. The family will receive the report shortly.
          </p>
        ) : (
          <p className="text-sm text-soft">Tick every statement to complete the declaration.</p>
        )}
      </article>
    </Frame>
  );
}

function DeskScreen() {
  return (
    <Frame
      eyebrow="Institute administrator"
      title="Children and answers"
      note="The institute sees each filler’s progress separately, and can open the saved answers. No score is computed on this screen."
    >
      <article className="panel">
        <h3 className="text-xl font-semibold">Children</h3>
        <table className="data-table mt-4">
          <thead>
            <tr>
              <th>Child</th>
              <th>Parent / login</th>
              <th>Progress by person</th>
              <th>Filled as</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Aarav Sharma
                <div className="text-soft">Basic</div>
              </td>
              <td>
                Meera Sharma
                <div className="text-soft">meera.sharma@example.com</div>
              </td>
              <td>
                <div>Parent · 6/6 · 100%</div>
                <div>Teacher · 2/6 · 33%</div>
              </td>
              <td>Teacher</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-6 border-t border-line/80 pt-4">
          <h4 className="font-semibold">
            Parent · Holistic Development Milestone Assessment
            <span className="ml-2 font-normal text-soft">submitted · 100%</span>
          </h4>
          <p className="mt-3 text-sm text-soft">How independently does the learner manage everyday personal care?</p>
          <p>Often, with occasional prompts</p>
        </div>
      </article>
    </Frame>
  );
}

function SafeguardsScreen() {
  const does = [
    "Enrol a child and send the family a login letter",
    "Require the parent to complete Basic Information first",
    "Collect consent and show the CAP disclaimer",
    "Run six tools in a fixed order, one question at a time",
    "Let parent, teacher, caregiver, and child each keep an individual form",
    "Save progress so a person can leave and continue later",
    "Let the institute follow progress and read answers",
    "Let the institute add or update questions",
    "Email a completion letter; the report follows separately",
  ];
  const doesNot = [
    "It is not a medical, psychological, or diagnostic test",
    "It does not show scores or a report inside the website",
    "It does not let a later section start before the previous one is finished",
    "It does not mix parent answers with teacher answers",
  ];
  return (
    <article className="panel grid gap-6">
      <div>
        <p className="eyebrow">For the record</p>
        <h2 className="mt-2 text-2xl font-semibold">What the platform does</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-soft">
          A confidential, strength-based career alignment assessment for neurodivergent learners and the adults who
          know them well.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold">The website will</h3>
          <ul className="welcome-list">
            {does.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">The website will not</h3>
          <ul className="welcome-list">
            {doesNot.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-soft">
        Intellectual property of Prakramika Vocational Institute and Dr. Gayatri Narasimhan. Responses remain
        confidential and are used for assessment, educational planning, vocational guidance, and related authorised
        purposes.
      </p>
    </article>
  );
}
