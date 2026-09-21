/** User-facing copy taken from the PVI CAP Tool App Spec. */

export const CAP_TITLE = "PVI Career Alignment Pathway (CAP) Assessment";
export const CAP_AUTHOR = "By Dr Gayatri Narasimhan";

export const WELCOME_INTRO =
  "Thank you for participating in the PVI Career Alignment Pathway (CAP) Assessment, a comprehensive framework developed by Dr. Gayatri Narasimhan and Prakramika Vocational Institute (PVI) to identify an individual's strengths, interests, functional abilities, learning profile, behavioural readiness, and potential career pathways.";

export const WELCOME_APPROACH =
  "Unlike traditional assessments that focus only on limitations, the CAP Model adopts a strength-based, person-centred approach. It is designed to understand the unique abilities of each individual and recommend meaningful educational, vocational, and employment opportunities that promote independence and dignity.";

export const WELCOME_USES = [
  "Identify developmental strengths and support needs",
  "Understand personal interests and preferences",
  "Assess functional independence and workplace readiness",
  "Determine cognitive and learning profiles",
  "Map suitable vocational and career pathways",
  "Develop individualized training and transition plans",
];

export const HONESTY_LINE =
  "There are no right or wrong answers. Please respond honestly based on the individual's typical abilities and behaviours rather than isolated incidents or exceptional performances.";

export const WHO_CAN_ANSWER =
  "Most questions can be answered by the learner, parent, caregiver, educator, therapist, or vocational trainer who knows the individual well.";

export const CONFIDENTIALITY_LINE =
  "Your responses will remain confidential and will be used solely for assessment, educational planning, vocational guidance, research, and service improvement purposes in accordance with ethical standards.";

export const DURATION_LINE =
  "The assessment may take approximately 30–45 minutes to complete, depending on the sections applicable to the learner.";

export const THANKS_LINE =
  "We appreciate your time and commitment towards building meaningful pathways for lifelong learning, employment, and inclusion.";

export const CONSENT_INTRO = "Please read carefully before proceeding:";

export const CONSENT_ITEMS = [
  "I confirm that the information provided in this assessment is true and accurate to the best of my knowledge.",
  "I understand that this assessment is intended for educational and vocational planning purposes and does not constitute a medical diagnosis.",
  "I consent to the collection, storage, and analysis of the information provided for the purpose of generating individualized recommendations and reports.",
  "I understand that the data will be treated confidentially and used only by authorized personnel involved in assessment, research, or intervention planning.",
  "I voluntarily agree to participate in this assessment.",
];

export const DISCLAIMER = [
  {
    title: "1. Purpose of the Assessment",
    body: "This assessment has been developed by Prakramika Vocational Institute (PVI) as part of the Career Alignment Pathway (CAP) Model to understand an individual's strengths, interests, functional abilities, cognitive profile, behavioural readiness, and vocational potential. It is intended to support educational planning, vocational training, career guidance, and individualized intervention.",
  },
  {
    title: "2. Not a Medical or Diagnostic Tool",
    body: "The CAP Assessment is not a medical, psychological, psychiatric, or diagnostic instrument. It does not diagnose any disability, disorder, or health condition and should not be used as a substitute for professional clinical evaluation or medical advice.",
  },
  {
    title: "3. Recommendations Are Suggestive",
    body: "The career pathways, vocational recommendations, and intervention strategies generated through this assessment are guidance-based recommendations derived from the information provided by the respondent. Final educational or career decisions should be made by the individual, family, educators, therapists, and qualified professionals after considering all relevant factors.",
  },
  {
    title: "4. Accuracy of Responses",
    body: "The quality and usefulness of the assessment depend on the accuracy and honesty of the information provided. Prakramika Vocational Institute cannot be held responsible for recommendations based on incomplete, inaccurate, or misleading responses.",
  },
  {
    title: "5. Confidentiality",
    body: "Information collected through this assessment will be treated with confidentiality and used only for assessment, educational planning, vocational guidance, research, program evaluation, or service improvement, unless otherwise required by law or with the participant's consent.",
  },
  {
    title: "6. Intellectual Property",
    body: "The CAP Model, assessment framework, questionnaires, scoring methodology, and related materials are the intellectual property of Prakramika Vocational Institute and Dr. Gayatri Narasimhan. Unauthorized reproduction, modification, distribution, or commercial use of any part of this assessment without prior written permission is prohibited.",
  },
  {
    title: "7. No Guarantee of Employment",
    body: "Completion of this assessment or participation in recommended training programs does not guarantee employment, placement, admission, certification, or vocational success. The assessment is designed to support informed planning and skill development.",
  },
  {
    title: "8. Voluntary Participation",
    body: "Participation in this assessment is voluntary. Respondents may choose to discontinue the assessment at any stage.",
  },
];

export const DECLARATION_ITEMS = [
  "I have read and understood the purpose of this assessment.",
  "I understand that this is not a medical or psychological diagnostic tool.",
  "I confirm that the information provided is true and accurate to the best of my knowledge.",
  "I understand that the recommendations generated are advisory in nature and should be interpreted along with professional judgment.",
  "I consent to the use of my responses for assessment, educational planning, vocational guidance, and related research or program development while maintaining confidentiality.",
];

export const TOOL_ORDER = [
  { code: "HDMA", number: 1, name: "Holistic Development Milestone Assessment" },
  { code: "III", number: 2, name: "Interest Identification Inventory" },
  { code: "CALP", number: 3, name: "Cognitive Ability & Learning Profile" },
  { code: "FSIC", number: 4, name: "Functional Skills & Independence Checklist" },
  { code: "BWRS", number: 5, name: "Behavioural & Workplace Readiness Scale" },
  { code: "VLAP", number: 6, name: "Vocational Learning & Aptitude Profile" },
] as const;

export function toolHeading(code: string, fallback: string): string {
  const row = TOOL_ORDER.find((tool) => tool.code === code);
  return row ? `Tool ${row.number} — ${row.name}` : fallback;
}
