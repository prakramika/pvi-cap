# Admin journey (Phase 1)

Family / parent flow: [user-journey.md](user-journey.md). This page is the **institute admin**.

Local login (seeded):

- Username: `admin@gmail.com`
- Password: `Admin12345a`

Admin signs in with email and password only (no family-role OTP). Change this password before any shared demo.

## What admin does

### 1. Send a form

Tab **Send a form**.

- Parent first name, last name, **email** (the login and the mailbox)
- Child’s name and date of birth
- **Send form**

The parent gets the enrolment letter (login link, username, temporary password) in **Mailpit** at http://localhost:8025. They then complete the family journey for that child (for example Aarav).

### 2. See progress and answers

Tab **Children and answers**.

Each child row shows:

- Child name and stage
- Parent name and login email
- Overall progress (how many of the six sections are done)
- Who last signed in (Parent / Teacher / Caregiver / Child)

**View answers** opens every started section and the saved replies. No score is computed in Phase 1.

### 3. Questions

Tab **Questions**. Admin can:

- Type a new question under a section (HDMA, III, CALP, FSIC, BWRS, VLAP)
- Edit the wording or hide a question
- Delete a question that nobody has answered yet (if answers exist, it is hidden instead, so old sittings stay intact)
- Import a CSV (paste or file). The same `indicatorCode` **updates** the existing question

CSV columns:

```
toolCode,sectionTitle,indicatorCode,prompt,type,options,stages,isQualitative
```

| Column | Meaning |
|---|---|
| toolCode | HDMA, III, CALP, FSIC, BWRS, or VLAP |
| sectionTitle | Group under that tool (created if new) |
| indicatorCode | Unique inside that tool (e.g. HDMA-001) |
| prompt | The question text |
| type | `SCALE`, `FREE_TEXT`, or `SINGLE_CHOICE` |
| options | Labels separated by `\|`. Leading numbers become the stored value |
| stages | Empty = all ages. Or `EARLY_CHILDHOOD`, `PRE_SKILL`, `BASIC`, `INTERMEDIATE`, `ADVANCED` |
| isQualitative | `true` or `false` |

The live bank is `data/pvi-cap-questions.csv`. Seed loads it. Same indicator code updates the existing question.

## Out of scope here

- Scores, AI, in-app PDF report
- More than one admin profile (we can add experts later)
- Changing the six-section order
