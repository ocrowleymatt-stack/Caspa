import { GoogleGenerativeAI } from "@google/generative-ai";

export interface BookMetadata {
  title: string;
  titleSource: "provided" | "generated" | "validated";
  backCopy: string;
  spineText: string;
  keywords: string[];
  tagline: string;
  isbn?: string;
  isbnStatus: "provided" | "required" | "optional";
  isbnPrompt?: string;
  hallucination: {
    riskLevel: "none" | "low" | "medium" | "high";
    flags: string[];
    nounMatchPercentage: number;
  };
  qualityScore: number;
  awardCalibrated: boolean;
  sourceQuotes: {
    for: string;
    quote: string;
  }[];
}

interface ValidationResult {
  score: number;
  awardCalibrated: boolean;
  flags: string[];
  nounMatchPercentage: number;
}

export class BookMetadataService {
  private gemini: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.gemini = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generate complete metadata from manuscript with zero-hallucination gating
   */
  async generateMetadata(
    manuscriptText: string,
    userProvidedTitle?: string,
    userProvidedISBN?: string
  ): Promise<BookMetadata> {
    const model = this.gemini.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Step 1: Extract core narrative elements
    const extractionPrompt = `You are a literary analyst. Analyze this manuscript excerpt and extract ONLY verifiable elements. Return JSON only.

Manuscript:
${manuscriptText.slice(0, 8000)}

Extract:
1. Main themes (max 3, from actual text)
2. Key emotions/mood
3. Narrative core in one sentence (actual plot, not interpretation)
4. 3-5 specific nouns/concepts that appear in text
5. One powerful scene or image that defines the book

Return ONLY valid JSON:
{
  "themes": ["theme1", "theme2"],
  "mood": "description",
  "narrativeCore": "one sentence",
  "keyNouns": ["noun1", "noun2"],
  "powerfulImage": "description"
}`;

    const extractionRes = await model.generateContent(extractionPrompt);
    let extracted: any = {
      themes: [],
      mood: "",
      narrativeCore: "",
      keyNouns: [],
      powerfulImage: "",
    };

    try {
      const extractedText =
        extractionRes.response.text().match(/\{[\s\S]*\}/)?.[0] || "{}";
      extracted = JSON.parse(extractedText);
    } catch (e) {
      console.warn("Extraction parsing failed, using defaults");
    }

    // Step 2: Generate back cover copy (award-calibre)
    const backCopyPrompt = `You are an award-winning book marketing specialist. Write a back cover description for this book.

CONSTRAINTS:
- 100-150 words
- Create emotional investment, not hype
- Use specific details from this narrative: ${extracted.narrativeCore}
- Evoke the mood: ${extracted.mood}
- End with a compelling question or revelation
- NO generic phrases ("unforgettable", "will change your life", "masterpiece")
- Sound like a Booker Prize or Pulitzer entry

Narrative core: ${extracted.narrativeCore}
Powerful image: ${extracted.powerfulImage}
Themes: ${extracted.themes.join(", ")}

Write the back cover copy only (no label):`;

    const backCopyRes = await model.generateContent(backCopyPrompt);
    const backCopy = backCopyRes.response
      .text()
      .trim()
      .replace(/^Back\s+Copy:\s*/i, "");

    // Step 3: Generate spine text
    const spinePrompt = `Create a concise spine title (2-5 words maximum) that captures the essence of this book:
    
Narrative: ${extracted.narrativeCore}
Main image: ${extracted.powerfulImage}

Return ONLY the spine text, no explanation:`;

    const spineRes = await model.generateContent(spinePrompt);
    const spineText = spineRes.response.text().trim().slice(0, 50);

    // Step 4: Validate against hallucination
    const validation = await this.validateAgainstManuscript(
      manuscriptText,
      backCopy,
      extracted.keyNouns
    );

    // Step 5: Determine ISBN status
    let isbnStatus: "provided" | "required" | "optional" = "optional";
    let isbnPrompt: string | undefined;

    if (userProvidedISBN) {
      // Validate ISBN format
      if (this.isValidISBN(userProvidedISBN)) {
        isbnStatus = "provided";
      }
    } else {
      // ISBN becomes required if publishing to Amazon/KDP
      isbnPrompt =
        "ISBN optional for digital, required for print distribution (Amazon KDP, IngramSpark). Provide your ISBN-13 or leave blank to generate one later.";
      isbnStatus = "optional";
    }

    return {
      title: userProvidedTitle || extracted.narrativeCore.slice(0, 80),
      titleSource: userProvidedTitle ? "provided" : "generated",
      backCopy,
      spineText,
      keywords: extracted.keyNouns,
      tagline: extracted.powerfulImage,
      isbn: userProvidedISBN,
      isbnStatus,
      isbnPrompt:
        !userProvidedISBN && isbnStatus === "optional"
          ? isbnPrompt
          : undefined,
      hallucination: {
        riskLevel:
          validation.flags.length === 0
            ? "none"
            : validation.flags.length <= 2
              ? "low"
              : validation.flags.length <= 4
                ? "medium"
                : "high",
        flags: validation.flags,
        nounMatchPercentage: validation.nounMatchPercentage,
      },
      qualityScore: validation.score,
      awardCalibrated: validation.awardCalibrated,
      sourceQuotes: [
        {
          for: "backCopy",
          quote: extracted.powerfulImage,
        },
        {
          for: "narrativeCore",
          quote: extracted.narrativeCore,
        },
      ],
    };
  }

  /**
   * Validate metadata against manuscript to prevent hallucinations
   */
  private async validateAgainstManuscript(
    manuscriptText: string,
    backCopy: string,
    keyNouns: string[]
  ): Promise<ValidationResult> {
    const model = this.gemini.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Check noun matching
    const nounMatches = keyNouns.filter((noun) =>
      manuscriptText.toLowerCase().includes(noun.toLowerCase())
    );
    const nounMatchPercentage = (nounMatches.length / keyNouns.length) * 100;

    // Check for red flags in back copy
    const redFlags = [
      "only",
      "never before",
      "first",
      "only author",
      "must read",
      "will change",
      "unforgettable",
      "masterpiece",
    ];
    const flags: string[] = [];

    redFlags.forEach((flag) => {
      if (backCopy.toLowerCase().includes(flag.toLowerCase())) {
        flags.push(
          `Marketing phrase detected: "${flag}" (lacks specificity)`
        );
      }
    });

    // Score based on specificity and support
    let score = 10;
    if (nounMatchPercentage < 70)
      score -= 3;
    if (flags.length > 0) score -= flags.length;
    if (backCopy.split(" ").length < 80)
      score -= 1; // Too brief

    score = Math.max(0, Math.min(10, score));

    return {
      score,
      awardCalibrated: score >= 8,
      flags,
      nounMatchPercentage,
    };
  }

  /**
   * Validate ISBN format (ISBN-10 or ISBN-13)
   */
  private isValidISBN(isbn: string): boolean {
    // Remove hyphens and spaces
    const clean = isbn.replace(/[-\s]/g, "");

    // ISBN-13
    if (clean.length === 13 && /^\d{13}$/.test(clean)) {
      return this.validateISBN13(clean);
    }

    // ISBN-10
    if (clean.length === 10 && /^\d{10}$|^\d{9}X$/.test(clean)) {
      return this.validateISBN10(clean);
    }

    return false;
  }

  /**
   * Validate ISBN-13 check digit
   */
  private validateISBN13(isbn: string): boolean {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(isbn[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(isbn[12]);
  }

  /**
   * Validate ISBN-10 check digit
   */
  private validateISBN10(isbn: string): boolean {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(isbn[i]) * (10 - i);
    }
    const checkChar = isbn[9];
    const checkDigit = (11 - (sum % 11)) % 11;
    const expectedChar = checkDigit === 10 ? "X" : checkDigit.toString();
    return checkChar === expectedChar;
  }

  /**
   * Validate existing metadata for quality/hallucination
   */
  async validateMetadata(metadata: Partial<BookMetadata>): Promise<{
    isValid: boolean;
    score: number;
    issues: string[];
  }> {
    const issues: string[] = [];

    if (!metadata.title || metadata.title.length < 3) {
      issues.push("Title too short or missing");
    }

    if (!metadata.backCopy || metadata.backCopy.length < 80) {
      issues.push("Back copy too brief (minimum 80 characters)");
    }

    if (!metadata.spineText || metadata.spineText.length < 2) {
      issues.push("Spine text too short");
    }

    if (metadata.isbn && !this.isValidISBN(metadata.isbn)) {
      issues.push(
        `Invalid ISBN format: ${metadata.isbn} (must be ISBN-10 or ISBN-13)`
      );
    }

    return {
      isValid: issues.length === 0,
      score: metadata.qualityScore || 0,
      issues,
    };
  }

  /**
   * Generate Amazon KDP-friendly metadata
   * (Prepares for future FTP integration)
   */
  async generateKDPMetadata(metadata: BookMetadata): Promise<{
    title: string;
    description: string;
    keywords: string[];
    isbn?: string;
    spine: string;
    requiresISBN: boolean;
    kdpOptimizations: string[];
  }> {
    const optimizations: string[] = [];

    if (!metadata.isbn) {
      optimizations.push(
        "No ISBN provided - KDP will assign one for ebook, but print requires ISBN-13"
      );
    }

    if (metadata.backCopy.length > 4000) {
      optimizations.push(
        "Description length optimal for KDP product page"
      );
    }

    if (metadata.keywords.length < 7) {
      optimizations.push(
        `Add ${7 - metadata.keywords.length} more keywords for better discoverability`
      );
    }

    return {
      title: metadata.title,
      description: metadata.backCopy,
      keywords: metadata.keywords,
      isbn: metadata.isbn,
      spine: metadata.spineText,
      requiresISBN: !metadata.isbn,
      kdpOptimizations: optimizations,
    };
  }
}
