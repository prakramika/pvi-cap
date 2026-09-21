# APIs — Auth, users, learners, assessments

Base URL (local): `http://localhost:4000/api/v1`  
Auth header: `Authorization: Bearer <accessToken>`  
Access token: 15 minutes. Refresh token: 7 days, rotated on use.

## Auth

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public | Family: email + password → `{ step: "choose_role", allowedRoles, profileComplete }`. First time `allowedRoles` is Parent only. Then send the same body with `familyRole` → OTP. Staff: email + password → session immediately (no OTP) |
| POST | `/auth/verify-login-otp` | Public | Email + 6-digit code + `familyRole` (family) → access, refresh, user |
| POST | `/auth/resend-login-otp` | Public | New login OTP if a sign-in was started in the last 10 minutes. Family should resend `familyRole` so the letter still names that role |
| POST | `/auth/refresh` | Public | New token pair from refresh token |
| POST | `/auth/logout` | Signed in | Revoke that refresh token |
| GET | `/auth/me` | Signed in | Current user + child profile |
| POST | `/auth/forgot-password` | Public | Email a 6-digit OTP (always returns `{ ok: true }`) |
| POST | `/auth/reset-password` | Public | Email + OTP + new password |

Password rule: at least 10 characters, one letter, one number.

Inactive or suspended accounts cannot sign in.

## Users

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/users` | Admin, Expert | Search `q`, filter `role`, `accountStatus`, paginate |
| POST | `/users` | Admin | Create user. Respondent **must** include `displayName` + `dateOfBirth` (creates the one learner) |
| GET | `/users/:id` | Admin, Expert | User detail |
| PATCH | `/users/:id` | Admin | Name, role, account status |

## Learners (child profile)

On the family website this is the **child profile**, never “respondent”.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/learners/me` | Family | Own child profile |
| PATCH | `/learners/me` | Family | First-time complete or later edit: name, DOB, gender, diagnosis, school, city, teacher email, caregiver email |
| GET | `/learners/:id` | Admin, Expert | Child profile detail |
| PATCH | `/learners/:id` | Admin | Display name, DOB, stage override |

Age stages (admin may override): 0–5 Early Childhood, 6–10 Pre-Skill, 11–15 Basic, 16–20 Intermediate, 21–25 Advanced.

## Email

Letters: enrolment (username, password, login link), role OTP (“You have logged in as Parent. Your OTP is …”), teacher/caregiver portal link, completion (“you will receive the report shortly”).

OTP for Teacher goes to `teacherEmail` on the child profile when set; Caregiver likewise. Parent and Child OTPs go to the family username.

If SMTP is not set, messages are printed in the API console and returned as `demoInbox`. For a real local inbox, run Mailpit ([mailpit.md](mailpit.md)) with `SMTP_HOST=localhost` `SMTP_PORT=1025`. To still changes per letter; Mailpit shows every To address.

## Admin desk

Admin login is email + password (no family OTP). See [admin.md](admin.md).

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/admin/children` | Admin, Expert | Every child, overall 6-section progress, parent email |
| GET | `/admin/children/:id` | Admin, Expert | Child profile plus all answers so far |
| GET | `/admin/questions` | Admin | Full question bank by tool and section |
| POST | `/admin/questions` | Admin | Create or update by `toolCode` + `indicatorCode` |
| PATCH | `/admin/questions/:id` | Admin | Edit wording, section, active flag |
| DELETE | `/admin/questions/:id` | Admin | Delete if unused; hide if answers already exist |
| POST | `/admin/questions/import` | Admin | Body `{ csv }` — upsert rows |

## Assessments

All routes require a signed-in user. Family routes are child-profile accounts. Staff = Admin or Expert.

Six tools are six **sections in order**. The API will not start section N until section N−1 is submitted. The child profile must be completed before Start.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/assessments/catalog` | Family | Six sections + `state` (`completed` \| `active` \| `locked`) + overall tracker + `resumeInstanceId` |
| POST | `/assessments/start` | Family | Body `{ toolCode }`. Only the active section. Creates or resumes one sitting per child+tool+role |
| GET | `/assessments/:id` | Owner or staff | Questions, options, saved answers, `resume` (current unanswered question) |
| PUT | `/assessments/:id/responses` | Owner | Save the **current** question only. Radios and fill-ins. No going back. Last answer auto-submits the section |
| POST | `/assessments/:id/submit` | Owner | Locks the section when every visible item is answered. When all six are done, sends the completion letter. No score |
| GET | `/assessments` | Staff | List sittings (`q`, `toolCode`, `status`, `stage`, `reviewStatus`, page) |
| PATCH | `/assessments/:id/review` | Staff | `{ notes?, status: PENDING \| IN_REVIEW \| COMPLETED }` |

Stage-based tools (HDMA, III, CALP, FSIC, BWRS) only return items mapped to the learner stage. VLAP returns every item.
