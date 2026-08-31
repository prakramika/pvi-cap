# Milestone 2 APIs — Auth, users, learners

Client-review notes for **Backend Foundation**. Assessment taking is still M4.

Base URL (local): `http://localhost:4000/api/v1`  
Auth header: `Authorization: Bearer <accessToken>`  
Access token: 15 minutes. Refresh token: 7 days, rotated on use.

## Auth

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public | Email + password → access, refresh, user |
| POST | `/auth/refresh` | Public | New token pair from refresh token |
| POST | `/auth/logout` | Signed in | Revoke that refresh token |
| GET | `/auth/me` | Signed in | Current user + learner |
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

## Learners

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/learners/me` | Respondent | Own learner (one per account) |
| GET | `/learners/:id` | Admin, Expert | Learner detail |
| PATCH | `/learners/:id` | Admin | Display name, DOB, stage override |

Age stages (admin may override): 0–5 Early Childhood, 6–10 Pre-Skill, 11–15 Basic, 16–20 Intermediate, 21–25 Advanced.

## Email

If SMTP is not set, messages are printed in the API console (including OTP codes in development). PVI is contracted to supply SMTP/SendGrid/SES before week 2.
