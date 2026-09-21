# Local test procedure (Windows / Cursor)

Questions load from `data/pvi-cap-questions.csv`. Work only in `D:\pvi\pvi-cap`.

C: has ~250 MB free. In **every** Cursor terminal before npm/prisma:

```powershell
New-Item -ItemType Directory -Force -Path "D:\pvi\tmp","D:\pvi\npm-cache" | Out-Null
$env:TEMP = "D:\pvi\tmp"
$env:TMP = "D:\pvi\tmp"
$env:npm_config_cache = "D:\pvi\npm-cache"
```

If you skip that, Prisma can crash with an out-of-memory error.

## What this machine needs (checked 11 Sep 2026)

| Check | Status on this laptop |
|---|---|
| Node.js 22+ | Installed (`v22.14.0`) |
| Repo `.env` | Present |
| Docker Desktop | **Not installed** |
| Drive C: free space | ~250 MB — too small for Docker Desktop |
| Native PostgreSQL 18 | **Running** as Windows service `postgresql-x64-18` on port 5432 |

**Use native PostgreSQL 18 for local test.** Do not install Docker Desktop until
C: has several GB free. The `npm run db:up` Docker path stays in the repo for
later / other machines.

## 0. One-time: create the `pvi` role and `pvi_cap` database

The app expects `postgresql://pvi:pvi@localhost:5432/pvi-cap` on this laptop.
(You already created a database named **`pvi-cap`** with a hyphen. Prisma was
looking for `pvi_cap` with an underscore, which is why migrate said
`permission denied to create database`.)

1. Open **SQL Shell (psql)** or **pgAdmin 4** from the Start menu.
2. Sign in as the `postgres` superuser (the password you set when PostgreSQL 18 was installed).
3. Run **block A** against database `postgres`:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pvi') THEN
    CREATE ROLE pvi LOGIN PASSWORD 'pvi';
  END IF;
END
$$;

CREATE DATABASE pvi_cap OWNER pvi;
```

If `CREATE DATABASE` says the database already exists, continue.

4. Connect to `pvi_cap` (`\c pvi_cap` in psql, or a new Query Tool in pgAdmin) and run **block B**:

```sql
GRANT ALL ON SCHEMA public TO pvi;
ALTER SCHEMA public OWNER TO pvi;
```

The same SQL lives in `scripts/bootstrap-local-pg.sql`.

5. If `apps/api/.env` is missing, copy the repo `.env` there so Prisma CLI can see `DATABASE_URL`.

## 1. Install, migrate, seed

From `D:\pvi\pvi-cap` in a Cursor terminal:

```powershell
npm install
npm run db:migrate
npm run db:seed
```

`db:migrate` applies `20260821120000_init` with `prisma migrate deploy` (no name prompt).

Seed creates:

| Email | Password | Role | Learner |
|---|---|---|---|
| `respondent@pvi.local` | `Respondent1` | Respondent | Aarav Kumar, born 2014-01-15 → **Basic** |
| `early@pvi.local` | `Respondent1` | Respondent | Anaya Iyer, born 2023-06-01 → **Early Childhood** |
| `admin@gmail.com` | `Admin12345a` | Admin | — |

Passwords: at least 10 characters, one letter, one number.

## 2. Run the apps

Two Cursor terminals from `D:\pvi\pvi-cap`:

Terminal 1:

```powershell
npm run dev:api
```

Expect: `PVI-CAP API listening on http://localhost:4000`

Terminal 2:

```powershell
npm run dev:web
```

Expect: Vite on http://localhost:5173

Mailpit (local letters, not Gmail): third terminal `npm run mail:up`, then http://localhost:8025 — [docs/mailpit.md](mailpit.md).

Checks:

- http://localhost:4000/health → `{ "status": "ok", "milestone": "M4-sample", ... }`
- If health is `degraded`, Postgres is unreachable — redo step 0.

## 3. Test script (about 40 minutes)

Use a normal window plus a private window so family and admin stay signed in together.

The family site must feel like a parent website. Full copy of letters and screens: [user-journey.md](user-journey.md).

### A. Parent of Aarav (Basic)

1. Open http://localhost:5173
2. Sign in as `respondent@pvi.local` / `Respondent1`
3. Choose role **Parent** (first visit: Parent is the only choice). Open http://localhost:8025 — the OTP letter is in Mailpit (or the on-screen demo inbox if `SMTP_HOST` is unset).
4. Enter the OTP.
5. **First time:** fill the **child profile** (not “respondent”). Name Aarav, DOB, gender, optional details. Save.
6. Home shows Aarav, **Start the career assessment**, and **Edit child profile** top-right.
7. Start → read disclaimer → six sections. Only section 1 (HDMA) has Begin. Overall tracker at 0/6.
8. Begin. One question at a time. 4 / 3 / 2 / 1 radios advance on select. Fill-in uses Save this answer. No next/previous. Section progress bar.
9. After the last HDMA question you return to the six-section screen: HDMA completed, III Begin active, rest locked.
10. Sign out, sign in again as Parent, OTP, skip profile. You must land on the current section (III Begin, or mid-question if you stopped inside a section).
11. Finish all six. Confirm the completion letter: you have completed the test; the report will follow shortly. Home shows complete. No score on screen.

### B. Teacher (same child)

1. Edit child profile, add a teacher email if you want the OTP to go to a second mailbox (otherwise it stays on the family username).
2. Sign out. Sign in with the **same** username/password. Choose **Teacher**.
3. Confirm the OTP letter is “You have logged in as Teacher” and names the teacher mailbox when one is saved.
4. Teacher sees the same child and a **separate** six-section form, starting at question 1. Parent answers are not shown. Sign out and back as Teacher to resume the teacher sitting.

### C. Early Childhood stage filter

1. Sign in as `early@pvi.local` / `Respondent1`, role Parent, complete Anaya’s child profile if asked.
2. Start **III** (after HDMA). You must see the **Early Childhood** sample item, not the Basic item.

### D. Admin

1. Sign in as `admin@gmail.com` / `Admin12345a` (password only — no family OTP).
2. **Send a form** with a parent email, child name, date of birth. Confirm the letter in Mailpit (http://localhost:8025).
3. **Children and answers** — Aarav’s row shows progress. **View answers** shows what the parent or teacher filled.
4. **Questions** — the live bank is loaded from CSV. Admin can still add, edit, hide, or import.

### E. Negative checks

- Starting III before HDMA is submitted → error, section stays locked.
- Changing an already saved answer → error.
- After all six, Start is gone; home shows complete.

## 4. Stop

Stop the two `npm run dev:*` terminals (Ctrl+C). Leave the PostgreSQL Windows service running.

If you later use Docker on a machine that has it:

```powershell
npm run db:up
docker compose stop
```

Do not treat this seed as production data. Change the admin password before any shared demo.

## Later: Docker path (not this laptop today)

When C: has several GB free and Docker Desktop is installed, `npm run db:up` starts
`pvi-cap-postgres` on port 5432. That port is currently owned by native PostgreSQL 18,
so Docker and native Postgres cannot both bind 5432. Pick one.
