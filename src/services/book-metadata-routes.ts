import { Router, Request, Response } from "express";
import { BookMetadataService } from "./BookMetadataService";
import { analyzeContent } from "./ContentIntelligenceService";

const router = Router();

interface MetadataRequest {
  manuscript: string; // Excerpt or full text
  title?: string; // Optional explicit title
  author?: string;
  contentIntelligence?: any; // Pre-analyzed content intelligence
}

/**
 * POST /metadata/generate
 * Generate award-calibre book metadata (title, back cover, spine text)
 * linked to actual manuscript content with hallucination prevention
 */
router.post("/metadata/generate", async (req: Request, res: Response) => {
  try {
    const { manuscript, title, author, contentIntelligence } =
      req.body as MetadataRequest;

    if (!manuscript || manuscript.trim().length < 500) {
      return res.status(400).json({
        error: "Manuscript excerpt required (minimum 500 chars)",
      });
    }

    // Get the gemini function from global (set by server.ts)
    const callGemini = (global as any).callGeminiAPI;
    if (!callGemini) {
      return res.status(503).json({
        error: "Gemini API not configured",
      });
    }

    // If no content intelligence provided, generate it
    let intelligence = contentIntelligence;
    if (!intelligence) {
      try {
        intelligence = await analyzeContent(manuscript, callGemini);
      } catch (error) {
        // Continue without intelligence if it fails
        intelligence = {
          document_type: "manuscript",
          summary: manuscript.slice(0, 200),
        };
      }
    }

    // Generate metadata with hallucination prevention
    const metadataService = new BookMetadataService();
    const metadata = await metadataService.generateMetadata(
      manuscript,
      intelligence,
      title,
      callGemini
    );

    // Return 202 Accepted (processing may have taken time)
    res.status(202).json({
      status: "success",
      metadata,
      warnings: metadata.hallucination_risk === "high" ? ["High hallucination risk in metadata generation"] : [],
    });
  } catch (error) {
    console.error("Metadata generation error:", error);
    res.status(422).json({
      error: "Metadata generation failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /metadata/validate
 * Validate existing metadata against manuscript
 * Returns quality score and hallucination risk assessment
 */
router.post("/metadata/validate", async (req: Request, res: Response) => {
  try {
    const { backCoverCopy, title, manuscript } = req.body;

    if (!backCoverCopy || !manuscript) {
      return res.status(400).json({
        error: "backCoverCopy and manuscript required",
      });
    }

    // Simple validation: check if claims in copy are supported by manuscript
    const excerptLower = manuscript.toLowerCase();
    const copyLower = backCoverCopy.toLowerCase();

    // Extract nouns from copy
    const copyNouns = copyLower.match(/\b[a-z]{4,}\b/g) || [];
    const matchCount = copyNouns.filter((noun) =>
      excerptLower.includes(noun)
    ).length;
    const matchRatio = matchCount / (copyNouns.length || 1);

    const hallucinationRisk =
      matchRatio > 0.7 ? "low" : matchRatio > 0.4 ? "medium" : "high";

    const qualityScore = Math.round(matchRatio * 100);

    res.status(200).json({
      qualityScore,
      hallucinationRisk,
      supportedByManuscript: matchRatio > 0.6,
      recommendation:
        hallucinationRisk === "high"
          ? "Back cover copy contains unsupported claims. Recommend revision."
          : hallucinationRisk === "medium"
            ? "Some claims lack strong manuscript support. Consider tightening language."
            : "Metadata well-grounded in manuscript content.",
    });
  } catch (error) {
    console.error("Metadata validation error:", error);
    res.status(500).json({
      error: "Validation failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /metadata/specs
 * Return metadata specifications (character limits, best practices)
 */
router.get("/metadata/specs", (req: Request, res: Response) => {
  res.status(200).json({
    title: {
      maxLength: 80,
      recommended: "50-70 characters",
      notes: "Must be from manuscript or explicitly provided; no hallucination",
    },
    backCoverCopy: {
      wordCount: "100-150",
      requirements: [
        "Award-calibre writing",
        "Reference specific themes from text",
        "No generic praise",
        "Include tension/hook",
        "No unsupported claims",
      ],
      hallucinationPreventionRules: [
        "All major claims must be evident in manuscript",
        "No superlatives without evidence",
        "Avoid 'only', 'never before', 'first time'",
        "Quote-support recommended for key themes",
      ],
    },
    spineText: {
      maxLength: "25-30 visible characters",
      rule: "Intelligently truncated title at word boundary",
    },
    tagline: {
      length: "10-15 words",
      rule: "One-line thematic essence (must be evident in text)",
    },
    thematicKeywords: {
      count: "5-8 keywords",
      rule: "Only keywords evident in manuscript, not inferred",
    },
    qualityThresholds: {
      awardCalibre: "Score ≥ 8/10",
      acceptable: "Score ≥ 7/10",
      hallucinationRisk: "Must be 'low' for professional output",
    },
  });
});

export default router;
