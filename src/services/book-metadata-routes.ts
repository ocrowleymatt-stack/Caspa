import { Router, Request, Response } from "express";
import { BookMetadataService, BookMetadata } from "./BookMetadataService";

export function createBookMetadataRoutes(geminiKey: string): Router {
  const router = Router();
  const service = new BookMetadataService(geminiKey);

  /**
   * POST /metadata/generate
   * Generate complete book metadata from manuscript
   * Body: { manuscript, title?, isbn? }
   */
  router.post("/generate", async (req: Request, res: Response) => {
    try {
      const { manuscript, title, isbn } = req.body;

      if (!manuscript || manuscript.length < 500) {
        return res.status(400).json({
          error: "Manuscript required (minimum 500 characters)",
        });
      }

      // Validate ISBN if provided
      if (isbn && !isValidISBNFormat(isbn)) {
        return res.status(400).json({
          error: `Invalid ISBN format: ${isbn}`,
        });
      }

      const metadata = await service.generateMetadata(
        manuscript,
        title,
        isbn
      );

      return res.status(200).json(metadata);
    } catch (error) {
      console.error("Metadata generation error:", error);
      return res.status(500).json({
        error: "Failed to generate metadata",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /metadata/validate
   * Validate existing metadata for quality/hallucination
   * Body: { metadata }
   */
  router.post("/validate", async (req: Request, res: Response) => {
    try {
      const { metadata } = req.body;

      if (!metadata) {
        return res.status(400).json({ error: "Metadata object required" });
      }

      const validation = await service.validateMetadata(metadata);

      return res.status(200).json(validation);
    } catch (error) {
      console.error("Validation error:", error);
      return res.status(500).json({
        error: "Validation failed",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /metadata/kdp
   * Generate Amazon KDP-optimized metadata
   * (Prepares for future FTP integration)
   * Body: { metadata }
   */
  router.post("/kdp", async (req: Request, res: Response) => {
    try {
      const { metadata } = req.body;

      if (!metadata || typeof metadata !== "object") {
        return res.status(400).json({ error: "Metadata object required" });
      }

      const kdpMeta = await service.generateKDPMetadata(
        metadata as BookMetadata
      );

      return res.status(200).json(kdpMeta);
    } catch (error) {
      console.error("KDP generation error:", error);
      return res.status(500).json({
        error: "KDP metadata generation failed",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /metadata/specs
   * Return metadata schema and best practices
   */
  router.get("/specs", (req: Request, res: Response) => {
    return res.status(200).json({
      schema: {
        title: "string (required, 3-200 chars)",
        backCopy: "string (required, 80-4000 chars, award-calibre)",
        spineText: "string (required, 2-50 chars)",
        keywords: "string[] (required, 3-10 items)",
        tagline: "string (optional, powerful image/essence)",
        isbn: "string (optional ISBN-10 or ISBN-13)",
      },
      isbnInfo: {
        required_for: "Print distribution (Amazon KDP, IngramSpark, offset)",
        optional_for: "Digital ebooks",
        format: "ISBN-10 (10 chars) or ISBN-13 (13 chars), with or without hyphens",
        validation: "Check digit automatically verified",
        sources: [
          "Bowker (US): https://www.isbn.org/",
          "KDP: Amazon generates ISBNs for free (KDP-owned) or you provide your own",
          "IngramSpark: Requires ISBN-13 for print distribution",
        ],
      },
      hallucination_prevention: {
        noun_matching:
          "70%+ of key claims must have noun support in manuscript",
        red_flags: [
          "only",
          "never before",
          "first",
          "only author",
          "must read",
          "will change",
          "unforgettable",
          "masterpiece",
        ],
        quality_threshold: "Minimum score 7/10, award-calibre ≥ 8/10",
      },
      examples: {
        manuscript_input: "... (first 8000 chars of your manuscript)",
        request_with_isbn: {
          manuscript: "...",
          title: "Optional: provide your title",
          isbn: "978-1-234567-89-0",
        },
        request_without_isbn: {
          manuscript: "...",
          title: "Optional: provide your title",
        },
      },
    });
  });

  return router;
}

/**
 * Helper: Validate ISBN format (ISBN-10 or ISBN-13)
 */
function isValidISBNFormat(isbn: string): boolean {
  const clean = isbn.replace(/[-\s]/g, "");

  // ISBN-13
  if (clean.length === 13 && /^\d{13}$/.test(clean)) {
    return validateISBN13(clean);
  }

  // ISBN-10
  if (clean.length === 10 && /^\d{10}$|^\d{9}X$/.test(clean)) {
    return validateISBN10(clean);
  }

  return false;
}

function validateISBN13(isbn: string): boolean {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(isbn[12]);
}

function validateISBN10(isbn: string): boolean {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(isbn[i]) * (10 - i);
  }
  const checkChar = isbn[9];
  const checkDigit = (11 - (sum % 11)) % 11;
  const expectedChar = checkDigit === 10 ? "X" : checkDigit.toString();
  return checkChar === expectedChar;
}
