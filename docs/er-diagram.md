# PVI-CAP Phase 1 — Entity-Relationship diagram

Milestone 1 deliverable. Schema is implemented in `apps/api/prisma/schema.prisma`.

Phase 1 stores responses and review notes. It does **not** compute scores or generate reports.

```mermaid
erDiagram
  User ||--o| Learner : "respondent has one"
  User ||--o{ RefreshToken : issues
  User ||--o{ AuditLog : performs
  User ||--o{ Notification : receives
  User ||--o{ Review : "expert writes"

  Learner ||--o{ AssessmentInstance : sits
  AssessmentTool ||--o{ AssessmentSection : contains
  AssessmentTool ||--o{ Question : contains
  AssessmentTool ||--o{ AssessmentInstance : assigned

  AssessmentSection ||--o{ Question : groups
  Question ||--o{ AnswerOption : has
  Question ||--o{ QuestionStage : "shown in"
  Question ||--o{ Response : answered

  AssessmentInstance ||--o{ Response : collects
  AssessmentInstance ||--o| Review : "one review"

  User {
    uuid id PK
    string email UK
    string passwordHash
    enum role "ADMIN EXPERT RESPONDENT"
    enum accountStatus
  }

  Learner {
    uuid id PK
    uuid userId FK
    string displayName
    date dateOfBirth
    enum assignedStage
    boolean stageOverridden
    enum lastFamilyRole "PARENT TEACHER CAREGIVER CHILD"
    string gender
    string diagnosis
    string schoolName
    string city
    string teacherEmail
    string caregiverEmail
    datetime profileCompletedAt
  }

  AssessmentTool {
    uuid id PK
    string code UK
    int indicatorCount
    boolean isStageBased
  }

  Question {
    uuid id PK
    uuid toolId FK
    enum type "SINGLE_CHOICE MULTI_CHOICE SCALE FREE_TEXT"
    boolean isQualitative
  }

  AssessmentInstance {
    uuid id PK
    uuid learnerId FK
    uuid toolId FK
    enum familyRole "PARENT TEACHER CAREGIVER CHILD"
    enum status
    int progressPercent
  }

  Response {
    uuid id PK
    uuid instanceId FK
    uuid questionId FK
    uuid optionId FK
    text freeText
  }

  Review {
    uuid id PK
    uuid instanceId FK
    uuid reviewerId FK
    enum status
    text notes
  }

  AuditLog {
    uuid id PK
    uuid actorId FK
    string action
    json metadata
  }
```

## Stage bands

| Enum | Ages | Label |
|---|---|---|
| EARLY_CHILDHOOD | 0–5 | Early Childhood |
| PRE_SKILL | 6–10 | Pre-Skill |
| BASIC | 11–15 | Basic |
| INTERMEDIATE | 16–20 | Intermediate |
| ADVANCED | 21–25 | Advanced |

HDMA and VLAP ignore stage filters (all questions). III, CALP, FSIC, and BWRS use `QuestionStage`.

## Phase 1 constraints encoded in the schema

- `Learner.userId` is unique — one learner per respondent.
- `AssessmentInstance` uniqueness `(learnerId, toolId, familyRole)` — one sitting per child, tool, and filler (parent / teacher / caregiver / child). Existing rows migrate as Parent.
- `Response` uniqueness `(instanceId, questionId)` — auto-save overwrites the same row.
- `Review` is 1:1 with an instance.
- `scoringNotes` on questions is stored for PVI’s methodology; the API will not use it to score in Phase 1.
