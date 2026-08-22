import { z } from "zod";
import { EDITORIAL_RUBRIC, RUBRIC_VERSION, type DiagnosisPayload } from "../../shared/editorial";
import { manuscriptMetrics, type ManuscriptChapter } from "../../shared/manuscript";
import type { Project } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { createTraceId, logPrivateError } from "./errors";

const findingSchema = z.object({
  criterion: z.enum(["structure", "causality", "character", "clarity", "continuity", "pacing", "voice", "promise"]),
  category: z.string().min(2).max(100),
  severity: z.enum(["critical", "major", "moderate", "minor"]),
  confidence: z.number().int().min(0).max(100),
  title: z.string().min(3).max(220),
  rationale: z.string().min(12).max(3000),
  suggestedFix: z.string().min(12).max(3000),
  evidenceQuote: z.string().min(1).max(1200),
  citationLabel: z.string().min(2).max(180),
  citationStart: z.number().int().nonnegative().nullable(),
  citationEnd: z.number().int().positive().nullable(),
  selectedByDefault: z.boolean(),
});

const payloadSchema = z.object({
  overallSummary: z.string().min(20).max(5000),
  overallConfidence: z.number().int().min(0).max(100),
  findings: z.array(findingSchema).min(1).max(12),
});

export function validateDiagnosisPayload(value: unknown) {
  return payloadSchema.parse(value);
}

const outputSchema = {
  type: "object",
  properties: {
    overallSummary: { type: "string" },
    overallConfidence: { type: "integer", minimum: 0, maximum: 100 },
    findings: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          criterion: { type: "string", enum: EDITORIAL_RUBRIC.map(item => item.id) },
          category: { type: "string" },
          severity: { type: "string", enum: ["critical", "major", "moderate", "minor"] },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          title: { type: "string" },
          rationale: { type: "string" },
          suggestedFix: { type: "string" },
          evidenceQuote: { type: "string" },
          citationLabel: { type: "string" },
          citationStart: { type: ["integer", "null"] },
          citationEnd: { type: ["integer", "null"] },
          selectedByDefault: { type: "boolean" },
        },
        required: ["criterion", "category", "severity", "confidence", "title", "rationale", "suggestedFix", "evidenceQuote", "citationLabel", "citationStart", "citationEnd", "selectedByDefault"],
        additionalProperties: false,
      },
    },
  },
  required: ["overallSummary", "overallConfidence", "findings"],
  additionalProperties: false,
} as const;

function chapterEvidence(chapter: ManuscriptChapter | undefined, fallback: string) {
  const text = chapter?.content.trim() || fallback.trim();
  const quote = text.slice(0, 360) || "No manuscript text was supplied.";
  return {
    quote,
    label: chapter ? `Chapter ${chapter.index + 1}: ${chapter.title}` : "Manuscript opening",
    start: chapter?.start ?? 0,
    end: (chapter?.start ?? 0) + quote.length,
  };
}

export function deterministicDiagnosis(project: Project, content: string): DiagnosisPayload {
  const metrics = manuscriptMetrics(content);
  const first = chapterEvidence(metrics.chapters[0], content);
  const findings: DiagnosisPayload["findings"] = [];
  const ratio = project.targetWordCount > 0 ? metrics.wordCount / project.targetWordCount : 1;

  if (!content.trim()) {
    findings.push({
      criterion: "structure", category: "Completeness", severity: "critical", confidence: 100,
      title: "The manuscript is empty", rationale: "CASPA needs manuscript or plan text before it can perform an evidence-backed diagnosis.",
      suggestedFix: "Paste or upload the current manuscript or a structured plan, then run diagnosis again.",
      evidenceQuote: first.quote, citationLabel: first.label, citationStart: first.start, citationEnd: first.end, selectedByDefault: true,
    });
  } else {
    if (metrics.wordCount < 120) {
      findings.push({
        criterion: "promise", category: "Completeness", severity: "critical", confidence: 99,
        title: "The sample is too brief to support a whole-work judgment", rationale: `Only ${metrics.wordCount} words are available, so structural conclusions beyond the supplied passage would be speculative.`,
        suggestedFix: "Add the complete current draft or label the project as a plan before commissioning a whole-work revision.",
        evidenceQuote: first.quote, citationLabel: first.label, citationStart: first.start, citationEnd: first.end, selectedByDefault: true,
      });
    }
    if (ratio < 0.7) {
      findings.push({
        criterion: "pacing", category: "Proportion", severity: ratio < 0.25 ? "critical" : "major", confidence: 96,
        title: "The current draft is materially below its target length", rationale: `The manuscript contains ${metrics.wordCount.toLocaleString()} words against a ${project.targetWordCount.toLocaleString()}-word target. This is a completeness signal, not an instruction to pad the work.`,
        suggestedFix: "Identify missing beats, evidence, scenes, or promised sections before expanding prose. Revise only where the reader promise requires more substance.",
        evidenceQuote: first.quote, citationLabel: first.label, citationStart: first.start, citationEnd: first.end, selectedByDefault: true,
      });
    }
    if (["fiction", "non-fiction", "script"].includes(project.format) && project.targetWordCount > 8000 && metrics.chapterCount <= 1) {
      findings.push({
        criterion: "structure", category: "Architecture", severity: "major", confidence: 94,
        title: "Long-form structure is not yet visible", rationale: "The supplied text contains one detected section, which makes progression, balance, and continuity difficult to inspect across the full work.",
        suggestedFix: "Add explicit chapter, act, scene, or section headings that reflect the intended reading sequence.",
        evidenceQuote: first.quote, citationLabel: first.label, citationStart: first.start, citationEnd: first.end, selectedByDefault: true,
      });
    }
  }

  if (!findings.length) {
    findings.push({
      criterion: "clarity", category: "Editorial review", severity: "moderate", confidence: 72,
      title: "A focused editorial pass is still recommended", rationale: "The deterministic safety review found no obvious structural blocker, but it cannot assess subtext, voice, or causal momentum as deeply as the full editorial model.",
      suggestedFix: "Review the opening and each chapter turn for clear intention, consequence, and reader orientation.",
      evidenceQuote: first.quote, citationLabel: first.label, citationStart: first.start, citationEnd: first.end, selectedByDefault: true,
    });
  }

  return {
    overallSummary: `CASPA completed a rubric-based safety diagnosis across ${metrics.wordCount.toLocaleString()} words and ${metrics.chapterCount} detected section${metrics.chapterCount === 1 ? "" : "s"}. The findings below are limited to evidence that can be verified directly from the supplied manuscript.`,
    overallConfidence: Math.round(findings.reduce((total, finding) => total + finding.confidence, 0) / findings.length),
    findings,
  };
}

export async function diagnoseWithAi(project: Project, content: string): Promise<{
  payload: DiagnosisPayload;
  mode: "ai" | "deterministic-fallback";
  warningCode: string | null;
  traceId: string;
}> {
  const traceId = createTraceId();
  const metrics = manuscriptMetrics(content);
  const rubricText = EDITORIAL_RUBRIC.map(item => `${item.id}: ${item.label} — ${item.description}`).join("\n");
  const chapterMap = metrics.chapters.map(chapter => `[${chapter.index + 1}] ${chapter.title} (${chapter.wordCount} words; chars ${chapter.start}-${chapter.end})`).join("\n");

  if (!content.trim() || metrics.wordCount < 60) {
    return { payload: deterministicDiagnosis(project, content), mode: "deterministic-fallback", warningCode: "MANUSCRIPT_TOO_SHORT_FOR_AI", traceId };
  }

  try {
    const response = await invokeLLM({
      model: "claude-sonnet-4-6",
      thinking: { type: "enabled", budget_tokens: 2048 },
      maxTokens: 7000,
      messages: [
        {
          role: "system",
          content: "You are CASPA, a rigorous developmental editor. Diagnose only what the supplied manuscript supports. Every finding must quote exact manuscript evidence, use a precise citation label and character offsets when possible, state uncertainty honestly, and recommend a reversible editorial action. Never invent missing plot, biography, sources, or author intent.",
        },
        {
          role: "user",
          content: `PROJECT\nTitle: ${project.title}\nFormat: ${project.format}\nPremise: ${project.premise}\nTarget length: ${project.targetWordCount}\nCurrent words: ${metrics.wordCount}\n\nRUBRIC ${RUBRIC_VERSION}\n${rubricText}\n\nDETECTED SECTIONS\n${chapterMap || "No sections detected"}\n\nMANUSCRIPT\n${content.slice(0, 180_000)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "caspa_diagnosis", strict: true, schema: outputSchema },
      },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw || typeof raw !== "string") throw new Error("Structured diagnosis returned no textual content");
    const parsed = validateDiagnosisPayload(JSON.parse(raw));
    return { payload: parsed, mode: "ai", warningCode: null, traceId };
  } catch (error) {
    logPrivateError("diagnosis", traceId, error, { projectId: project.id, wordCount: metrics.wordCount });
    return {
      payload: deterministicDiagnosis(project, content),
      mode: "deterministic-fallback",
      warningCode: "AI_TEMPORARILY_UNAVAILABLE",
      traceId,
    };
  }
}
