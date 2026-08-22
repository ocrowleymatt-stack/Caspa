export const RUBRIC_VERSION = "caspa-editorial-v1";

export const EDITORIAL_RUBRIC = [
  { id: "structure", label: "Structure & progression", description: "The manuscript has an intelligible beginning, development, and resolution appropriate to its format." },
  { id: "causality", label: "Causality & momentum", description: "Scenes or sections create consequences and forward pressure rather than merely accumulating." },
  { id: "character", label: "Character & agency", description: "Principal characters have legible motives, choices, and evolving consequences." },
  { id: "clarity", label: "Clarity & coherence", description: "The argument, sequence, point of view, and referents remain understandable." },
  { id: "continuity", label: "Continuity & consistency", description: "Names, facts, chronology, world rules, and stated claims do not contradict one another." },
  { id: "pacing", label: "Pacing & proportion", description: "Narrative or explanatory emphasis is distributed according to reader need rather than accidental length." },
  { id: "voice", label: "Voice & line craft", description: "Language is specific, controlled, non-repetitive, and appropriate to the intended audience." },
  { id: "promise", label: "Reader promise", description: "The work fulfils the expectations created by its premise, opening, genre, and stated purpose." },
] as const;

export type RubricCriterion = (typeof EDITORIAL_RUBRIC)[number]["id"];

export type DiagnosisFindingPayload = {
  criterion: RubricCriterion;
  category: string;
  severity: "critical" | "major" | "moderate" | "minor";
  confidence: number;
  title: string;
  rationale: string;
  suggestedFix: string;
  evidenceQuote: string;
  citationLabel: string;
  citationStart?: number | null;
  citationEnd?: number | null;
  selectedByDefault: boolean;
};

export type DiagnosisPayload = {
  overallSummary: string;
  overallConfidence: number;
  findings: DiagnosisFindingPayload[];
};

