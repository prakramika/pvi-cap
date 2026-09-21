export type FamilyRole = "PARENT" | "TEACHER" | "CAREGIVER" | "CHILD";

export type CatalogTool = {
  code: string;
  name: string;
  isStageBased: boolean;
  contractedIndicatorCount: number;
  availableQuestionCount: number;
  sampleContent: boolean;
  sortOrder: number;
  state: "completed" | "active" | "locked";
  canBegin: boolean;
  instance: {
    id: string;
    status: string;
    progressPercent: number;
    submittedAt: string | null;
  } | null;
};

export type CatalogResponse = {
  profileComplete: boolean;
  familyRole: FamilyRole;
  familyRoleLabel: string;
  childName: string;
  stage: string;
  stageLabel: string;
  overall: { completed: number; total: number; percent: number };
  allComplete: boolean;
  resumeInstanceId: string | null;
  tools: CatalogTool[];
};

export type QuestionOption = {
  id: string;
  label: string;
  value: string;
  sortOrder: number;
};

export type TakeQuestion = {
  id: string;
  indicatorCode: string;
  prompt: string;
  type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "SCALE" | "FREE_TEXT";
  isQualitative: boolean;
  sortOrder: number;
  options: QuestionOption[];
  response: { optionId: string | null; optionLabel?: string | null; freeText: string | null; savedAt: string } | null;
};

export type TakeSection = {
  id: string;
  title: string;
  sortOrder: number;
  questions: TakeQuestion[];
};

export type AssessmentPayload = {
  sampleContent: boolean;
  instance: {
    id: string;
    status: string;
    familyRole?: FamilyRole;
    familyRoleLabel?: string;
    progressPercent: number;
    stage: string;
    stageLabel: string;
    submittedAt: string | null;
    tool: { code: string; name: string; isStageBased: boolean; contractedIndicatorCount: number };
    learner: { id: string; displayName: string; respondentEmail: string; respondentName: string };
    review: { id: string; status: string; notes: string | null; reviewedAt: string | null } | null;
  };
  sections: TakeSection[];
  progress: { answered: number; total: number; percent: number };
  resume: { questionId: string | null; index: number; total: number; done: boolean };
  allComplete?: boolean;
  completionDemoInbox?: { to: string; subject: string; note: string };
};

export type StaffRow = {
  id: string;
  status: string;
  progressPercent: number;
  stage: string;
  stageLabel: string;
  submittedAt: string | null;
  toolCode: string;
  toolName: string;
  learnerName: string;
  respondentName: string;
  respondentEmail: string;
  reviewStatus: string | null;
};
