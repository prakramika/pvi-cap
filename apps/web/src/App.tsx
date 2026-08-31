import { useEffect, useState, type ReactNode } from "react";
import {
  api,
  clearSession,
  readSession,
  saveSession,
  type PublicUser,
  type Session,
} from "./api";

type Tool = {
  code: string;
  name: string;
  indicatorCount: number;
  isStageBased: boolean;
};

type Screen = "login" | "forgot" | "reset" | "app";

export default function App() {
  const [screen, setScreen] = useState<Screen>(readSession() ? "app" : "login");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (screen !== "app") return;
    api<{ user: PublicUser }>("/api/v1/auth/me")
      .then((body) => setUser(body.user))
      .catch(() => {
        clearSession();
        setScreen("login");
      });
  }, [screen]);

  async function onLogin(email: string, password: string) {
    setError(null);
    const session = await api<Session>("/api/v1/auth/login", { method: "POST", json: { email, password } });
    saveSession(session);
    setUser(session.user);
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
    setScreen("login");
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-end justify-between gap-4 border-b border-stone-300 pb-6">
        <div>
          <p className="text-sm tracking-wide text-stone-500">Prakramika Vocational Institute</p>
          <h1 className="text-3xl font-semibold">PVI-CAP</h1>
          <p className="mt-1 text-stone-600">Digital Career Assessment Platform — Phase 1</p>
        </div>
        {user ? (
          <button type="button" className="rounded border border-stone-300 px-3 py-1 text-sm" onClick={() => void onLogout()}>
            Sign out
          </button>
        ) : (
          <span className="rounded border border-stone-300 px-3 py-1 text-sm text-stone-600">Milestone 2</span>
        )}
      </header>

      {error ? <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {notice ? <p className="mb-4 border border-stone-300 bg-white px-3 py-2 text-sm">{notice}</p> : null}

      {screen === "login" ? (
        <AuthForm
          title="Sign in"
          submitLabel="Sign in"
          onSubmit={(email, password) => onLogin(email, password).catch((err: Error) => setError(err.message))}
          footer={
            <button type="button" className="text-sm underline" onClick={() => { setError(null); setScreen("forgot"); }}>
              Forgot password
            </button>
          }
        />
      ) : null}

      {screen === "forgot" ? (
        <ForgotForm
          onCancel={() => setScreen("login")}
          onSent={() => {
            setNotice("If that email exists, a 6-digit code was sent. Check the API console if SMTP is not configured.");
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

      {screen === "app" && user ? <SignedIn user={user} onError={setError} /> : null}
    </div>
  );
}

function AuthForm(props: {
  title: string;
  submitLabel: string;
  onSubmit: (email: string, password: string) => void;
  footer?: ReactNode;
}) {
  const [email, setEmail] = useState("admin@pvi.local");
  const [password, setPassword] = useState("ChangeMe_admin1");

  return (
    <form
      className="max-w-md border border-stone-300 bg-white p-6"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit(email, password);
      }}
    >
      <h2 className="mb-4 text-lg font-medium">{props.title}</h2>
      <label className="mb-3 block text-sm">
        Email
        <input className="mt-1 w-full border border-stone-300 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="mb-4 block text-sm">
        Password
        <input className="mt-1 w-full border border-stone-300 px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <button type="submit" className="bg-stone-900 px-4 py-2 text-sm text-white">
        {props.submitLabel}
      </button>
      <div className="mt-3">{props.footer}</div>
    </form>
  );
}

function ForgotForm(props: { onCancel: () => void; onSent: () => void; onError: (message: string) => void }) {
  const [email, setEmail] = useState("");
  return (
    <form
      className="max-w-md border border-stone-300 bg-white p-6"
      onSubmit={(event) => {
        event.preventDefault();
        api("/api/v1/auth/forgot-password", { method: "POST", json: { email } })
          .then(props.onSent)
          .catch((err: Error) => props.onError(err.message));
      }}
    >
      <h2 className="mb-4 text-lg font-medium">Reset password</h2>
      <label className="mb-4 block text-sm">
        Email
        <input className="mt-1 w-full border border-stone-300 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <div className="flex gap-3">
        <button type="submit" className="bg-stone-900 px-4 py-2 text-sm text-white">Send code</button>
        <button type="button" className="text-sm underline" onClick={props.onCancel}>Back</button>
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
      className="max-w-md border border-stone-300 bg-white p-6"
      onSubmit={(event) => {
        event.preventDefault();
        api("/api/v1/auth/reset-password", { method: "POST", json: { email, code, password } })
          .then(props.onDone)
          .catch((err: Error) => props.onError(err.message));
      }}
    >
      <h2 className="mb-4 text-lg font-medium">Enter the email code</h2>
      <label className="mb-3 block text-sm">
        Email
        <input className="mt-1 w-full border border-stone-300 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="mb-3 block text-sm">
        6-digit code
        <input className="mt-1 w-full border border-stone-300 px-3 py-2" value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
      <label className="mb-4 block text-sm">
        New password
        <input className="mt-1 w-full border border-stone-300 px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <div className="flex gap-3">
        <button type="submit" className="bg-stone-900 px-4 py-2 text-sm text-white">Update password</button>
        <button type="button" className="text-sm underline" onClick={props.onCancel}>Back</button>
      </div>
    </form>
  );
}

function SignedIn(props: { user: PublicUser; onError: (message: string) => void }) {
  const [tools, setTools] = useState<Tool[]>([]);

  useEffect(() => {
    api<{ tools: Tool[] }>("/api/v1/meta")
      .then((body) => setTools(body.tools))
      .catch((err: Error) => props.onError(err.message));
  }, [props.onError]);

  return (
    <div className="grid gap-8">
      <section className="border border-stone-300 bg-white p-5">
        <h2 className="text-lg font-medium">Signed in</h2>
        <p className="mt-2 text-sm text-stone-600">
          {props.user.firstName} {props.user.lastName} · {props.user.email} · {props.user.role}
        </p>
        {props.user.learner ? (
          <p className="mt-2 text-sm">
            Learner: {props.user.learner.displayName} · {props.user.learner.stageLabel} ({props.user.learner.dateOfBirth})
            {props.user.learner.stageOverridden ? " · stage overridden by admin" : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-stone-600">No learner profile on this account (admin/expert).</p>
        )}
      </section>

      {props.user.role === "ADMIN" ? <AdminUsers onError={props.onError} /> : null}

      <section>
        <h2 className="mb-3 text-lg font-medium">Six assessment tools</h2>
        <p className="mb-4 max-w-3xl text-sm text-stone-600">
          Assessment taking is Milestone 4. Question import is Milestone 3. This screen is the Milestone 2 login
          foundation.
        </p>
        <div className="overflow-x-auto border border-stone-300 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Tool</th>
                <th className="px-4 py-2 font-medium">Indicators</th>
                <th className="px-4 py-2 font-medium">Stage logic</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.code} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2 font-medium">{tool.code}</td>
                  <td className="px-4 py-2">{tool.name}</td>
                  <td className="px-4 py-2">{tool.indicatorCount}</td>
                  <td className="px-4 py-2">{tool.isStageBased ? "Five age stages" : "All questions"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AdminUsers(props: { onError: (message: string) => void }) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Respondent1");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("2014-01-15");

  function reload() {
    api<{ users: PublicUser[] }>("/api/v1/users")
      .then((body) => setUsers(body.users))
      .catch((err: Error) => props.onError(err.message));
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <section className="grid gap-4 border border-stone-300 bg-white p-5">
      <h2 className="text-lg font-medium">Users (admin)</h2>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          api("/api/v1/users", {
            method: "POST",
            json: {
              email,
              password,
              firstName,
              lastName,
              role: "RESPONDENT",
              displayName,
              dateOfBirth,
            },
          })
            .then(() => {
              setEmail("");
              setFirstName("");
              setLastName("");
              setDisplayName("");
              reload();
            })
            .catch((err: Error) => props.onError(err.message));
        }}
      >
        <input className="border border-stone-300 px-3 py-2 text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border border-stone-300 px-3 py-2 text-sm" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="border border-stone-300 px-3 py-2 text-sm" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input className="border border-stone-300 px-3 py-2 text-sm" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <input className="border border-stone-300 px-3 py-2 text-sm" placeholder="Learner display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <input className="border border-stone-300 px-3 py-2 text-sm" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        <button type="submit" className="bg-stone-900 px-4 py-2 text-sm text-white sm:col-span-2">
          Create respondent
        </button>
      </form>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Email</th>
            <th className="py-2 font-medium">Role</th>
            <th className="py-2 font-medium">Learner / stage</th>
          </tr>
        </thead>
        <tbody>
          {users.map((row) => (
            <tr key={row.id} className="border-b border-stone-100">
              <td className="py-2">{row.firstName} {row.lastName}</td>
              <td className="py-2">{row.email}</td>
              <td className="py-2">{row.role}</td>
              <td className="py-2">{row.learner ? `${row.learner.displayName} · ${row.learner.stageLabel}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
