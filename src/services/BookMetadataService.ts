export interface BookMetadata {
  title: string;
  author: string;
  backCoverCopy: string;
  spineText: string;
  tagline: string;
  thematicKeywords: string[];
  linkedToContent: {
    sourceQuotes: string[];
    thematicElements: string[];
    narrativeCore: string;
  };
  qualityScore: number;
  hallucination_risk: "low" | "medium" | "high";
  awardCalibre: boolean;
}

export class BookMetadataService {
  private callGemini: any;

  constructor(callGemini?: any) {
    this.callGemini = callGemini;
  }

  async generateMetadata(
    manuscriptExcerpt: string,
    contentIntelligence: any,
    userTitle?: string,
    callGemini?: any
  ): Promise<BookMetadata> {
    const gemini = callGemini || this.callGemini;

    // Step 1: Validate/extract title from manuscript
    const titleValidation = await this.validateOrExtractTitle(
      manuscriptExcerpt,
      userTitle,
      gemini
    );

    if (titleValidation.hallucination_risk === "high") {
      throw new Error(
        "Title extraction too speculative; provide explicit title"
      );
    }

    // Step 2: Generate back cover copy with source validation
    const backCoverCopy = await this.generateBackCoverCopy(
      manuscriptExcerpt,
      titleValidation.title,
      contentIntelligence,
      gemini
    );

    // Step 3: Spine text (truncate title intelligently)
    const spineText = this.generateSpineText(titleValidation.title);

    // Step 4: Extract thematic keywords linked to actual content
    const thematicAnalysis = await this.extractThematicKeywords(
      manuscriptExcerpt,
      contentIntelligence,
      gemini
    );

    // Step 5: Quality gate — ensure award calibre
    const qualityAssessment = await this.assessQuality(
      backCoverCopy,
      titleValidation.title,
      contentIntelligence,
      gemini
    );

    if (qualityAssessment.score < 7 && !qualityAssessment.improvable) {
      throw new Error(
        `Back cover copy below award calibre (${qualityAssessment.score}/10). Recommendation: ${qualityAssessment.recommendation}`
      );
    }

    return {
      title: titleValidation.title,
      author: contentIntelligence?.author || "Unknown Author",
      backCoverCopy: backCoverCopy.copy,
      spineText,
      tagline: thematicAnalysis.tagline,
      thematicKeywords: thematicAnalysis.keywords,
      linkedToContent: {
        sourceQuotes: backCoverCopy.sourceQuotes,
        thematicElements: thematicAnalysis.thematicElements,
        narrativeCore: contentIntelligence?.narrative_core || "",
      },
      qualityScore: qualityAssessment.score,
      hallucination_risk: this.determineHallucinationRisk(
        manuscriptExcerpt,
        backCoverCopy.copy
      ),
      awardCalibre: qualityAssessment.score >= 8,
    };
  }

  private async validateOrExtractTitle(
    excerpt: string,
    userTitle: string | undefined,
    gemini: any
  ): Promise<{
    title: string;
    confidence: number;
    hallucination_risk: "low" | "medium" | "high";
  }> {
    if (userTitle) {
      // User provided title — just validate it's reasonable
      if (userTitle.length > 80) {
        return {
          title: userTitle,
          confidence: 0.95,
          hallucination_risk: "low",
        };
      }

      // Check for hallucination markers in user title
      if (
        userTitle.includes("Untitled") ||
        userTitle.includes("[") ||
        userTitle.includes("TBD")
      ) {
        return {
          title: userTitle,
          confidence: 0.7,
          hallucination_risk: "high",
        };
      }

      return {
        title: userTitle,
        confidence: 0.98,
        hallucination_risk: "low",
      };
    }

    if (!gemini) {
      return {
        title: "Untitled Manuscript",
        confidence: 0.3,
        hallucination_risk: "high",
      };
    }

    // Extract from manuscript if available
    try {
      const prompt = `Analyze this manuscript excerpt and extract the most likely title. Consider: chapter headers, opening lines, thematic focus.

Excerpt:
${excerpt.slice(0, 1500)}

Respond in JSON:
{
  "title": "...",
  "confidence": 0.0,
  "source": "opening|theme|chapter_header|inferred",
  "reasoning": "..."
}

If no clear title exists, respond with confidence < 0.6 and source "inferred". NEVER hallucinate.`;

      const response = await gemini(prompt);
      const parsed = JSON.parse(response);

      return {
        title: parsed.title || "Untitled Manuscript",
        confidence: parsed.confidence || 0.5,
        hallucination_risk:
          parsed.confidence > 0.8
            ? "low"
            : parsed.confidence > 0.5
              ? "medium"
              : "high",
      };
    } catch (error) {
      return {
        title: "Untitled Manuscript",
        confidence: 0.3,
        hallucination_risk: "high",
      };
    }
  }

  private async generateBackCoverCopy(
    excerpt: string,
    title: string,
    contentIntelligence: any,
    gemini: any
  ): Promise<{
    copy: string;
    sourceQuotes: string[];
  }> {
    if (!gemini) {
      return {
        copy: `A compelling work that will resonate with readers. Explore the depths of ${title}.`,
        sourceQuotes: [],
      };
    }

    // Generate back cover copy that references actual manuscript content
    try {
      const prompt = `You are a prize-winning book jacket copywriter. Generate compelling back cover copy for:

Title: "${title}"
Type: ${contentIntelligence?.document_type || "novel"}
Summary: ${contentIntelligence?.summary || ""}

Excerpt (for sourcing claims):
${excerpt.slice(0, 2000)}

Requirements:
1. 100-150 words
2. Award-calibre writing (Booker/Hugo/Pulitzer level)
3. Hook the reader emotionally
4. Reference SPECIFIC themes/conflicts from the excerpt (no generic praise)
5. Avoid hyperbole — claim only what's evident in the text
6. Include a subtle question or tension that makes reader want to open it

Respond in JSON:
{
  "copy": "...",
  "sourceThemes": ["theme1", "theme2", "theme3"],
  "emotionalHook": "...",
  "hallucination_risk": "low|medium|high"
}`;

      const response = await gemini(prompt);
      const parsed = JSON.parse(response);

      // Extract quotes from excerpt that support the copy
      const sourceQuotes = this.extractSupportingQuotes(
        excerpt,
        parsed.sourceThemes || []
      );

      return {
        copy: parsed.copy || "",
        sourceQuotes,
      };
    } catch (error) {
      return {
        copy: `A compelling work that explores the depths of human experience. Discover ${title}.`,
        sourceQuotes: [],
      };
    }
  }

  private generateSpineText(title: string): string {
    // Intelligently truncate for spine (typically 20-30 chars visible)
    if (title.length <= 25) return title;

    // Try to break at word boundary
    const words = title.split(" ");
    let spine = "";
    for (const word of words) {
      if ((spine + word).length <= 25) {
        spine = spine ? `${spine} ${word}` : word;
      } else {
        break;
      }
    }

    return spine || title.slice(0, 25);
  }

  private async extractThematicKeywords(
    excerpt: string,
    contentIntelligence: any,
    gemini: any
  ): Promise<{
    keywords: string[];
    thematicElements: string[];
    tagline: string;
  }> {
    if (!gemini) {
      return {
        keywords: [],
        thematicElements: [],
        tagline: "",
      };
    }

    try {
      const prompt = `Extract thematic keywords directly from this manuscript excerpt. Only keywords that are EVIDENT in the text, not inferred.

Excerpt:
${excerpt.slice(0, 1500)}

Respond in JSON:
{
  "keywords": ["keyword1", "keyword2", "..."],
  "thematicElements": ["element1", "element2", "..."],
  "tagline": "One-line thematic essence (10-15 words)"
}

Be specific. "Love" is too generic; "love across forbidden boundaries" is better.`;

      const response = await gemini(prompt);
      const parsed = JSON.parse(response);

      return {
        keywords: parsed.keywords || [],
        thematicElements: parsed.thematicElements || [],
        tagline: parsed.tagline || "",
      };
    } catch (error) {
      return {
        keywords: [],
        thematicElements: [],
        tagline: "",
      };
    }
  }

  private async assessQuality(
    backCoverCopy: string,
    title: string,
    contentIntelligence: any,
    gemini: any
  ): Promise<{
    score: number;
    improvable: boolean;
    recommendation: string;
  }> {
    if (!gemini) {
      // Fallback to simple word count based assessment
      const wordCount = backCoverCopy.split(" ").length;
      const score = wordCount >= 100 && wordCount <= 150 ? 7 : 5;

      return {
        score,
        improvable: true,
        recommendation: "Word count should be 100-150 words",
      };
    }

    try {
      const prompt = `Rate this book jacket copy against award-calibre standards (Booker, Pulitzer, Hugo):

Title: "${title}"
Type: ${contentIntelligence?.document_type || "novel"}

Copy:
${backCoverCopy}

Score on:
- Originality (1-10)
- Emotional resonance (1-10)
- Specificity to content (1-10)
- Professional quality (1-10)

Respond in JSON:
{
  "originality": 0,
  "emotionalResonance": 0,
  "specificity": 0,
  "professionalQuality": 0,
  "overallScore": 0,
  "improvable": true,
  "recommendation": "..."
}`;

      const response = await gemini(prompt);
      const parsed = JSON.parse(response);

      const overallScore =
        (parsed.originality +
          parsed.emotionalResonance +
          parsed.specificity +
          parsed.professionalQuality) /
        4;

      return {
        score: overallScore,
        improvable: parsed.improvable !== false,
        recommendation: parsed.recommendation || "",
      };
    } catch (error) {
      // Fallback simple assessment
      const hasEmotionalLanguage = /\b(discover|uncover|journey|powerful|compelling)\b/i.test(
        backCoverCopy
      );

      return {
        score: hasEmotionalLanguage ? 6 : 4,
        improvable: true,
        recommendation: "Consider adding more emotional resonance",
      };
    }
  }

  private extractSupportingQuotes(excerpt: string, themes: string[]): string[] {
    // Extract 2-3 short quotes from excerpt that support identified themes
    const sentences = excerpt.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    const quotes: string[] = [];

    for (const theme of themes.slice(0, 2)) {
      const themeWords = theme.toLowerCase().split(" ");
      for (const sentence of sentences) {
        if (
          themeWords.some((word) => sentence.toLowerCase().includes(word)) &&
          sentence.trim().length < 150
        ) {
          quotes.push(sentence.trim().slice(0, 100));
          break;
        }
      }
    }

    return quotes;
  }

  private determineHallucinationRisk(
    excerpt: string,
    backCoverCopy: string
  ): "low" | "medium" | "high" {
    // Check for claims in copy that aren't supported by excerpt
    const excerptLower = excerpt.toLowerCase();
    const copyLower = backCoverCopy.toLowerCase();

    // Red flags
    if (
      copyLower.includes("the only") ||
      copyLower.includes("never before") ||
      copyLower.includes("first time")
    ) {
      return "high";
    }

    // Check if key nouns from copy appear in excerpt
    const copyNouns = copyLower.match(/\b[a-z]{4,}\b/g) || [];
    const matchCount = copyNouns.filter((noun) =>
      excerptLower.includes(noun)
    ).length;

    const matchRatio = matchCount / (copyNouns.length || 1);

    return matchRatio > 0.7 ? "low" : matchRatio > 0.4 ? "medium" : "high";
  }
}
