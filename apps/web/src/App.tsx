import { useEffect, useState } from "react";
import {
  api,
  clearSession,
  readSession,
  saveSession,
  type PublicUser,
  type Session,
} from "./api";
import { AssessmentTake } from "./AssessmentTake";
import { FamilyPortal } from "./FamilyPortal";
import { AdminDesk } from "./AdminDesk";
import type { FamilyRole } from "./types";
import { CAP_TITLE, HONESTY_LINE, WELCOME_INTRO, WHO_CAN_ANSWER } from "./spec-copy";

type Screen = "login" | "role" | "otp" | "forgot" | "reset" | "app";
type Workspace = { name: "home" } | { name: "take"; id: string };
type DemoInbox = {
  from: string;
  to: string;
  subject: string;
  code?: string;
  password?: string;
  note: string;
};
type LoginChallenge = {
  otpRequired: true;
  email: string;
  roleLabel: string;
  familyRole?: FamilyRole | null;
  otpSentTo?: string;
  demoInbox?: DemoInbox;
};
type ChooseRole = {
  step: "choose_role";
  email: string;
  defaultFamilyRole: FamilyRole;
  profileComplete: boolean;
  allowedRoles: FamilyRole[];
};

const ROLE_LINE: Record<PublicUser["role"], string> = {
  ADMIN: "Institute administrator",
  EXPERT: "Reviewing specialist",
  RESPONDENT: "Family sign-in",
};

const FAMILY_ROLE_OPTIONS: { value: FamilyRole; label: string; hint: string }[] = [
  { value: "PARENT", label: "Parent", hint: "At home with the child" },
  { value: "TEACHER", label: "Teacher", hint: "At school or the centre" },
  { value: "CAREGIVER", label: "Caregiver", hint: "Supporting day to day" },
  { value: "CHILD", label: "Child", hint: "The child is answering, with help" },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>(readSession() ? "app" : "login");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>({ name: "home" });
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [familyRole, setFamilyRole] = useState<FamilyRole>("PARENT");
  const [allowedRoles, setAllowedRoles] = useState<FamilyRole[]>(FAMILY_ROLE_OPTIONS.map((role) => role.value));
  const [profileCompleteAtRole, setProfileCompleteAtRole] = useState(true);
  const [otpRole, setOtpRole] = useState("");
  const [otpSentTo, setOtpSentTo] = useState("");
  const [otpDemo, setOtpDemo] = useState<DemoInbox>();
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    if (screen !== "app") return;
    api<{ user: PublicUser }>("/api/v1/auth/me")
      .then((body) => setUser(body.user))
      .catch(() => {
        clearSession();
        setScreen("login");
      });
  }, [screen]);

  async function requestOtp(email: string, password: string, role?: FamilyRole) {
    const result = await api<ChooseRole | LoginChallenge | Session>("/api/v1/auth/login", {
      method: "POST",
      json: { email, password, familyRole: role },
    });
    if ("step" in result && result.step === "choose_role") {
      setPendingEmail(result.email);
      setPendingPassword(password);
      setAllowedRoles(result.allowedRoles?.length ? result.allowedRoles : ["PARENT"]);
      setProfileCompleteAtRole(Boolean(result.profileComplete));
      setFamilyRole(result.profileComplete ? result.defaultFamilyRole : "PARENT");
      setScreen("role");
      return;
    }
    if ("otpRequired" in result && result.otpRequired) {
      setPendingEmail(result.email);
      setFamilyRole(result.familyRole ?? role ?? "PARENT");
      setOtpRole(result.roleLabel);
      setOtpSentTo(result.otpSentTo ?? result.email);
      setOtpDemo(result.demoInbox);
      setNotice(
        result.demoInbox
          ? "SMTP is not connected yet. The letter is shown below so you can demo."
          : `A 6-digit code was sent from Prakramika no-reply to ${result.otpSentTo ?? result.email}.`,
      );
      setScreen("otp");
      return;
    }
    const session = result as Session;
    saveSession(session);
    setUser(session.user);
    setWorkspace({ name: "home" });
    setScreen("app");
  }

  async function onVerifyOtp(code: string) {
    setError(null);
    const session = await api<Session>("/api/v1/auth/verify-login-otp", {
      method: "POST",
      json: { email: pendingEmail, code, familyRole },
    });
    saveSession(session);
    setUser(session.user);
    setPendingPassword("");
    setWorkspace({ name: "home" });
    setEditingProfile(false);
    setNotice(null);
    setScreen("app");
  }

  async function onLogout() {
    const session = readSession();
    try {
      if (session) {
        await api("/api/v1/auth/logout", { method: "POST", json: { refreshToken: session.refreshToken } });
      }
    } catch {
      // still clear local session
    }
    clearSession();
    setUser(null);
    setWorkspace({ name: "home" });
    setEditingProfile(false);
    setScreen("login");
  }

  const familyHome = user?.role === "RESPONDENT" && workspace.name === "home";

  return (
    <div className="app-shell">
      <header className="shell-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <div>
            <p className="eyebrow">Prakramika Vocational Institute</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">PVI-CAP</h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-soft">{CAP_TITLE}</p>
          </div>
        </div>
        {user ? (
          <div className="text-right">
            <p className="text-sm font-semibold">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-soft">
              {user.role === "RESPONDENT"
                ? `Signed in as ${user.learner?.familyRoleLabel ?? "Parent"}`
                : ROLE_LINE[user.role]}
            </p>
            <div className="mt-2 flex flex-wrap justify-end gap-1">
              {familyHome && user.learner?.profileComplete ? (
                <button type="button" className="btn-quiet text-sm" onClick={() => setEditingProfile(true)}>
                  Edit Basic Information
                </button>
              ) : null}
              <button type="button" className="btn-quiet text-sm" onClick={() => void onLogout()}>
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </header>

      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}

      {screen === "login" ? (
        <AuthForm
          onSubmit={(email, password) => {
            setError(null);
            requestOtp(email, password).catch((err: Error) => setError(err.message));
          }}
          onForgot={() => {
            setError(null);
            setScreen("forgot");
          }}
        />
      ) : null}

      {screen === "role" ? (
        <RoleForm
          email={pendingEmail}
          value={familyRole}
          allowedRoles={allowedRoles}
          firstVisit={!profileCompleteAtRole}
          onChange={setFamilyRole}
          onSubmit={() => {
            setError(null);
            requestOtp(pendingEmail, pendingPassword, familyRole).catch((err: Error) => setError(err.message));
          }}
          onBack={() => {
            setPendingPassword("");
            setError(null);
            setScreen("login");
          }}
        />
      ) : null}

      {screen === "otp" ? (
        <OtpForm
          email={otpSentTo || pendingEmail}
          roleLabel={otpRole}
          demoInbox={otpDemo}
          onSubmit={(code) => onVerifyOtp(code).catch((err: Error) => setError(err.message))}
          onResend={() => {
            api<{ demoInbox?: DemoInbox; otpSentTo?: string; roleLabel?: string }>("/api/v1/auth/resend-login-otp", {
              method: "POST",
              json: { email: pendingEmail, familyRole },
            })
              .then((body) => {
                if (body.demoInbox) setOtpDemo(body.demoInbox);
                if (body.otpSentTo) setOtpSentTo(body.otpSentTo);
                if (body.roleLabel) setOtpRole(body.roleLabel);
                setNotice(body.demoInbox ? "A new demo letter is below." : "A new code was sent from Prakramika no-reply.");
              })
              .catch((err: Error) => setError(err.message));
          }}
          onBack={() => {
            setNotice(null);
            setScreen(pendingPassword ? "role" : "login");
          }}
        />
      ) : null}

      {screen === "forgot" ? (
        <ForgotForm
          onCancel={() => setScreen("login")}
          onSent={() => {
            setNotice("If that email is on our records, a 6-digit code was sent. Check the inbox, including spam.");
            setScreen("reset");
          }}
          onError={setError}
        />
      ) : null}

      {screen === "reset" ? (
        <ResetForm
          onCancel={() => setScreen("login")}
          onDone={() => {
            setNotice("Password updated. Sign in with the new password.");
            setScreen("login");
          }}
          onError={setError}
        />
      ) : null}

      {screen === "app" && user ? (
        <div className="grid gap-6">
          {user.role === "RESPONDENT" && workspace.name === "home" ? (
            <FamilyPortal
              user={user}
              onUser={setUser}
              onError={setError}
              onNotice={setNotice}
              editingProfile={editingProfile}
              onEditingProfile={setEditingProfile}
              onOpen={(id) => {
                setEditingProfile(false);
                setWorkspace({ name: "take", id });
              }}
            />
          ) : null}
          {user.role === "RESPONDENT" && workspace.name === "take" ? (
            <AssessmentTake
              instanceId={workspace.id}
              onError={setError}
              onFinished={(result) => {
                setWorkspace({ name: "home" });
                if (result.allComplete) {
                  setNotice(
                    result.completionDemoInbox
                      ? `You have completed the assessment. SMTP is off, so the completion letter for ${result.completionDemoInbox.to} is not in a real inbox yet — it is logged on the API.`
                      : "You have completed the assessment. You will receive the report by email shortly.",
                  );
                }
              }}
            />
          ) : null}
          {user.role !== "RESPONDENT" ? (
            <AdminDesk user={user} onError={setError} onCreated={(message) => setNotice(message)} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AuthForm(props: { onSubmit: (email: string, password: string) => void; onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
      <section className="panel">
        <p className="eyebrow">Welcome</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{CAP_TITLE}</h2>
        <p className="mt-3 max-w-xl leading-relaxed text-soft">{WELCOME_INTRO}</p>
        <p className="mt-3 max-w-xl leading-relaxed text-soft">{HONESTY_LINE}</p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-soft">{WHO_CAN_ANSWER}</p>
      </section>
      <form
        className="panel grid content-start"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit(email, password);
        }}
      >
        <h2 className="mb-1 text-xl font-semibold">Sign in</h2>
        <p className="mb-5 text-sm text-soft">Use the username and password from your enrolment email.</p>
        <label className="field mb-3">
          Username (email)
          <input autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field mb-5">
          Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit" className="btn w-full">
          Sign in
        </button>
        <div className="mt-3">
          <button type="button" className="btn-quiet text-sm" onClick={props.onForgot}>
            Forgot password
          </button>
        </div>
      </form>
    </div>
  );
}

function RoleForm(props: {
  email: string;
  value: FamilyRole;
  allowedRoles: FamilyRole[];
  firstVisit: boolean;
  onChange: (value: FamilyRole) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const roles = FAMILY_ROLE_OPTIONS.filter((role) => props.allowedRoles.includes(role.value));
  return (
    <form
      className="panel mx-auto grid max-w-xl gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <div>
        <p className="eyebrow">One more step</p>
        <h2 className="mt-2 text-2xl font-semibold">Who is answering?</h2>
        <p className="mt-2 text-sm leading-relaxed text-soft">
          {props.firstVisit
            ? "The first time, only the parent can sign in. They fill Basic Information for the child. After that, teacher, caregiver, or child can each fill their own form."
            : `A one-time code will be sent for ${props.email}. Each person fills their own form and can save, then continue later.`}
        </p>
      </div>
      <div className="role-grid" role="radiogroup" aria-label="I am the">
        {roles.map((role) => (
          <button
            key={role.value}
            type="button"
            role="radio"
            aria-checked={props.value === role.value}
            className={props.value === role.value ? "role-card role-card-on" : "role-card"}
            onClick={() => props.onChange(role.value)}
          >
            <span className="font-semibold">{role.label}</span>
            <span className="text-sm text-soft">{role.hint}</span>
          </button>
        ))}
      </div>
      <button type="submit" className="btn w-fit">
        Send my sign-in code
      </button>
      <button type="button" className="btn-quiet w-fit text-sm" onClick={props.onBack}>
        Back to sign in
      </button>
    </form>
  );
}

function OtpForm(props: {
  email: string;
  roleLabel: string;
  demoInbox?: DemoInbox;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  return (
    <div className="mx-auto grid max-w-lg gap-5">
      {props.demoInbox?.code ? (
        <article className="panel text-sm">
          <p className="eyebrow">Demo inbox · not real SMTP</p>
          <p className="mt-2 text-soft">From: {props.demoInbox.from}</p>
          <p className="text-soft">To: {props.demoInbox.to}</p>
          <p className="mt-2 font-medium">{props.demoInbox.subject}</p>
          <p className="mt-3">You have logged in as {props.roleLabel}.</p>
          <p className="mt-4 text-center text-3xl font-semibold tracking-[0.35em] text-ink">{props.demoInbox.code}</p>
          <p className="mt-2 text-center text-soft">Your OTP · valid for 10 minutes</p>
          <button type="button" className="btn mt-4 w-full" onClick={() => setCode(props.demoInbox!.code!)}>
            Use this code
          </button>
        </article>
      ) : null}
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit(code);
        }}
      >
        <h2 className="text-xl font-semibold">Enter the email code</h2>
        <p className="mt-3 text-sm leading-relaxed text-soft">
          You have logged in as <strong>{props.roleLabel}</strong>. We sent a 6-digit OTP from{" "}
          <strong>no-reply@prakramikavocationalinstitute.com</strong> to {props.email}.
        </p>
        <label className="field mt-5 mb-4">
          6-digit OTP
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="tracking-[0.4em] text-center text-2xl"
          />
        </label>
        <button type="submit" className="btn w-full" disabled={code.length !== 6}>
          Verify code
        </button>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <button type="button" className="btn-quiet" onClick={props.onResend}>
            Resend code
          </button>
          <button type="button" className="btn-quiet" onClick={props.onBack}>
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

function ForgotForm(props: { onCancel: () => void; onSent: () => void; onError: (message: string) => void }) {
  const [email, setEmail] = useState("");
  return (
    <form
      className="panel max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        api("/api/v1/auth/forgot-password", { method: "POST", json: { email } })
          .then(props.onSent)
          .catch((err: Error) => props.onError(err.message));
      }}
    >
      <h2 className="mb-4 text-xl font-semibold">Reset password</h2>
      <p className="mb-4 text-sm text-soft">Use the same email that received the enrolment message.</p>
      <label className="field mb-4">
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <div className="flex gap-3">
        <button type="submit" className="btn">Send code</button>
        <button type="button" className="btn-quiet text-sm" onClick={props.onCancel}>Back</button>
      </div>
    </form>
  );
}

function ResetForm(props: { onCancel: () => void; onDone: () => void; onError: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form
      className="panel max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        api("/api/v1/auth/reset-password", { method: "POST", json: { email, code, password } })
          .then(props.onDone)
          .catch((err: Error) => props.onError(err.message));
      }}
    >
      <h2 className="mb-4 text-xl font-semibold">Enter the email code</h2>
      <label className="field mb-3">
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field mb-3">
        6-digit code
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
      </label>
      <label className="field mb-4">
        New password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <p className="mb-4 text-sm text-soft">At least 10 characters, with a letter and a number.</p>
      <div className="flex gap-3">
        <button type="submit" className="btn">Update password</button>
        <button type="button" className="btn-quiet text-sm" onClick={props.onCancel}>Back</button>
      </div>
    </form>
  );
}
