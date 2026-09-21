# Family user journey (Phase 1)

This is the source of truth for the **family / user side**. Admin / specialist work is next and is not rebuilt here.

The product is a normal website for a parent, teacher, caregiver, or older child. Do not call the family a “respondent” on screen. The child record is the **child profile**.

The live question bank is `data/pvi-cap-questions.csv`.

Phase 1 does **not** score, does **not** show a report in the app, and does **not** send a PDF report. After all six sections, we still send the completion letter that says the report will follow shortly.

## Who signs in

One family login per child. Example: parent of **Aarav**.

| Person | What they use |
|---|---|
| Parent | Enrolment email: username, temporary password, login link. Then chooses **Parent**. OTP goes to the family username (the parent mailbox). |
| Teacher | Same login link and family username. Chooses **Teacher**. OTP goes to the teacher email on the child profile if one was saved; otherwise to the family username. They also get a portal letter when that email is saved. |
| Caregiver | Same, with **Caregiver** and the caregiver email if saved. |
| Child | Same login, choose **Child**. OTP goes to the family username. Use this when an older child is at the computer. |

The child does not need their own mailbox. **The first time, only Parent can sign in.** The parent must complete Basic Information. After that, teacher, caregiver, or child can each sign in and fill their **own** form.

Same family username is fine. Teacher and parent can even share one mailbox. What keeps the forms separate is the role chosen at sign-in, not a live connection (SSE). Each person gets a saved sitting: leave, come back, continue from the last unanswered question.

Staff accounts (admin / specialist) skip the family-role dropdown and still receive a login OTP.

## Letters (what goes to whose inbox)

**To** always follows the person. Locally those letters land in **Mailpit** (http://localhost:8025), not Gmail. How to run it: [mailpit.md](mailpit.md). If `SMTP_HOST` is unset, the same letter is shown on screen as a demo inbox.

When the client SMTP is connected, the same copy goes to real mailboxes.

### 1. Enrolment — to the parent (family username)

Sent when admin enrols the child.

- Subject: `{Child} has been enrolled in PVI-CAP`
- Login link
- Username
- Temporary password
- What happens next: sign in, choose who is at the computer, enter the OTP, fill the child profile the first time, then start the career assessment

### 2. Sign-in OTP — to the person for the chosen role

Sent after password + role.

- You have logged in as **Parent** (or Teacher / Caregiver / Child).
- Your OTP is `xxxxxx` (6 digits, 10 minutes).
- Login link again

### 3. Teacher / caregiver portal letter

Sent when the child profile first saves a teacher or caregiver email.

- Login link
- Family username
- Ask the parent for the password if they do not have it
- Choose Teacher (or Caregiver); we then email the OTP to that address

### 4. Completion — to the family username

Sent when all **six** sections are submitted.

- You have completed the career assessment for {Child}.
- You will receive the report by email shortly.
- No report is attached in Phase 1.

## Click-through (parent of Aarav)

1. Parent receives the enrolment letter and opens the **login link**.
2. Enters **username** and **password**, clicks Sign in.
3. Who is signing in. **First visit: Parent only.** After Basic Information is saved, Parent, Teacher, Caregiver, or Child.
4. OTP letter: “You have logged in as Parent” + the code. Enters the OTP.
5. **First visit only:** Child profile (name, date of birth, gender, optional diagnosis, school, city, teacher email, caregiver email). Not labelled respondent.
6. Home: child summary, **Start the career assessment**, **Edit child profile** in the top-right (with Sign out).
7. Start → disclaimer and instructions → confirm → six sections.
8. Only section 1 has **Begin**. The rest are disabled. Overall progress tracker is on this screen.
9. Begin → one question at a time. Section progress bar. **No next / previous.**  
   - 4 / 3 / 2 / 1 radios: choosing an answer saves it and shows the next question.  
   - Fill-in: type, then **Save this answer**.
10. Last question of the section submits that section automatically. Back to the six-section screen: section 1 completed, section 2 **Begin** active, 3–6 still locked.
11. Same for every section.
12. After section 6: completion letter. Home says the assessment is complete and the report will follow by email.
13. Sign in again at any time: resume the current unanswered question, or the next section’s Begin if the previous section is done. Answers already given cannot be edited.

## Six sections (order, cannot jump)

The API enforces this, not only the screen.

1. HDMA — Holistic Development & Milestone Assessment  
2. III — Interest Identification Inventory  
3. CALP — Cognitive Ability & Learning Profile  
4. FSIC — Functional Skills & Independence Checklist  
5. BWRS — Behavioural & Workplace Readiness Scale  
6. VLAP — Vocational Learning & Aptitude Profile  

There is one sitting per **child + tool + person** (Parent, Teacher, Caregiver, Child). Parent and teacher forms are separate. If the parent stops in section 1, the teacher starts their own form from question 1. Sign in again as the same person to resume that sitting.

This is ordinary save-and-resume in Postgres. Do **not** use Server-Sent Events for it.

## What we still need from you (mail)

**Local now:** Mailpit. No Gmail needed. See [mailpit.md](mailpit.md).

**Before a client demo on real inboxes:** their SMTP (or a Gmail App Password). Same `SMTP_*` keys. Do not put passwords in git.

## Out of scope (do not demo as if it exists)

- Scores, AI, in-app report, PDF report
- Jumping sections or editing a previous answer
- A separate teacher username (Phase 1 uses one family username; teacher gets OTP + link)
- Native mobile apps
- Admin redesign (next)

## Related docs

- Click-through on this laptop: [local-test.md](local-test.md)
- APIs: [api-m2.md](api-m2.md)
- Data model: [er-diagram.md](er-diagram.md)
- Architecture: [architecture.md](architecture.md)
