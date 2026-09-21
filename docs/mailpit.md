# Local Mailpit (Windows, no Docker)

Mailpit is a fake SMTP server plus a web inbox. The app sends letters to it.
Open http://localhost:8025 to read them. Nothing goes to Gmail.

This laptop does not have Docker Desktop. The binary lives on D: so we do not
fill C:.

## 1. One-time download + run

From `D:\pvi\pvi-cap` in a Cursor terminal:

```powershell
$env:TEMP = "D:\pvi\tmp"
$env:TMP = "D:\pvi\tmp"
npm run mail:up
```

Leave that terminal open. You should see Mailpit listening on **1025** (SMTP) and **8025** (inbox).

The exe is stored at `D:\pvi\tools\mailpit\mailpit.exe` (gitignored tools folder on D:, not in the repo).

## 2. Point the API at Mailpit

In `.env` and `apps/api/.env` (same values; do not commit):

```
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Prakramika Vocational Institute <noreply@localhost>
```

Restart `npm run dev:api` after saving.

**To still changes per letter.** Mailpit catches every To address (parent, teacher, caregiver). You distinguish them by the To line in the inbox.

## 3. How to demo / UAT mail

Letters the app sends:

| When | Who gets it | What is in it |
|---|---|---|
| Admin clicks **Send a form** | Parent email | Login link, username, temporary password |
| Family chooses Parent / Teacher / Caregiver / Child | That person's mailbox | 6-digit OTP, valid 10 minutes |
| Forgot password | Username email | Reset OTP |
| All six tools finished | Family username | Completion letter — report will follow |

1. Keep Mailpit running (`npm run mail:up`).
2. Keep API running. `.env` must have `SMTP_HOST=localhost` and `SMTP_PORT=1025`.
3. Enrol a child or sign in as Parent.
4. Open **http://localhost:8025** — the letter is there. Copy the OTP from the inbox.
5. Check the **To** line so parent / teacher / caregiver letters are not mixed up.

If `.env` has no `SMTP_HOST`, the OTP also appears on screen as a demo inbox.

## Stop

Ctrl+C in the Mailpit terminal.

On a machine with Docker: `docker compose --profile mail up -d mailpit` (ports 1025 and 8025). Do not run the Windows exe and the Docker container together.

For AWS SES, use the same `SMTP_*` keys. See [aws.md](aws.md).
