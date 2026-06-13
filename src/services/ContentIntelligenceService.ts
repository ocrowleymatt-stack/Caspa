/**
 * Content Intelligence Service
 * 
 * Analyzes user input and determines:
 * - Document type (novel, course, manual, reference, illustrated story)
 * - Illustration map (what images needed, where, style/type)
 * - Design profile (professional layout, typography, color scheme)
 * - Output specification (format, structure, components)
 * 
 * This is the core engine that makes Caspa "intelligent" — it looks at
 * content and knows what it needs to become before generation begins.
 */

export interface ContentAnalysisInput {
  content: string;
  title?: string;
  context?: string;
  targetAudience?: string;
  purpose?: string;
}

export interface IllustrationSpec {
  id: string;
  type: 'chapter-opener' | 'diagram' | 'character-mood' | 'infographic' | 'flowchart' | 'concept-map' | 'cover' | 'scene-illustration';
  location: string; // e.g., "Chapter 3, page 45" or "Module 2: Introduction"
  description: string;
  priority: 'high' | 'medium' | 'low';
  style: string; // e.g., "watercolor", "technical", "photorealistic", "minimal"
  dimensions?: string; // e.g., "landscape", "square", "portrait"
  colorPalette?: string[];
  grokPrompt?: string; // Generated prompt for Grok Imagine
}

export interface DesignProfile {
  fontFamily: 'serif' | 'sans-serif' | 'mono';
  colorScheme: 'professional' | 'warm' | 'academic' | 'creative' | 'minimal';
  layout: 'traditional' | 'modern' | 'academic' | 'creative';
  pageSize: 'A4' | 'A5' | 'US-Letter';
  columnCount: 1 | 2 | 3;
  illustrationStyle: string;
}

export interface DocumentTypeProfile {
  type: 'novel' | 'short-story' | 'course-book' | 'training-manual' | 'reference-bible' | 'illustrated-narrative' | 'technical-manual' | 'guide';
  category: string;
  estimatedPages: number;
  chapterCount?: number;
  hasExercises?: boolean;
  hasGlossary?: boolean;
  hasIndex?: boolean;
  illustrationDensity: 'sparse' | 'moderate' | 'rich'; // How many illustrations per 1000 words
}

export interface ContentIntelligence {
  documentType: DocumentTypeProfile;
  illustrations: IllustrationSpec[];
  designProfile: DesignProfile;
  structure: {
    frontMatter: string[];
    mainContent: string;
    backMatter: string[];
    hasTOC: boolean;
    hasChapterSummaries?: boolean;
  };
  estimatedProductionTime: string;
  qualityScore: {
    content: number;
    structure: number;
    readiness: number; // % ready for production
  };
  recommendations: string[];
}

/**
 * Analyzes content and generates comprehensive intelligence
 * about what the final product should be
 */
export async function analyzeContent(
  input: ContentAnalysisInput,
  callGemini: (prompt: string, json: boolean) => Promise<string>
): Promise<ContentIntelligence> {
  const analysisPrompt = `
You are Caspa's Content Intelligence Engine. Analyze the following content and provide a comprehensive JSON analysis of:

1. **Document Type**: Determine if this is a novel, course book, training manual, reference bible, illustrated narrative, technical guide, etc.
2. **Illustration Map**: List every illustration that should be included (chapter openers, diagrams, mood boards, infographics, flowcharts). Specify:
   - Type (chapter-opener, diagram, character-mood, infographic, flowchart, concept-map, cover, scene-illustration)
   - Where it should appear (location in document)
   - What it should show (description)
   - Priority (high, medium, low)
   - Suggested style (watercolor, technical, photorealistic, minimal, etc.)
   - Grok Imagine prompt (what to ask the AI to generate)

3. **Design Profile**: Recommend typography, color scheme, layout style, and page design suitable for this content type and audience.

4. **Document Structure**: Identify what front matter (dedication, TOC, intro) and back matter (glossary, index, resources) this needs.

5. **Quality Assessment**: Rate content quality, structural readiness, and production readiness (0-100).

6. **Recommendations**: List any improvements or additions needed for professional output.

Content to analyze:
Title: ${input.title || '(untitled)'}
Target Audience: ${input.targetAudience || 'general'}
Purpose: ${input.purpose || 'unknown'}
Context: ${input.context || 'none provided'}

Content:
${input.content.substring(0, 5000)}${input.content.length > 5000 ? '\n... [content truncated for analysis]' : ''}

Respond with ONLY valid JSON matching this structure:
{
  "documentType": {
    "type": "novel|short-story|course-book|training-manual|reference-bible|illustrated-narrative|technical-manual|guide",
    "category": "brief category description",
    "estimatedPages": number,
    "chapterCount": number or null,
    "hasExercises": boolean,
    "hasGlossary": boolean,
    "hasIndex": boolean,
    "illustrationDensity": "sparse|moderate|rich"
  },
  "illustrations": [
    {
      "id": "unique-id",
      "type": "chapter-opener|diagram|character-mood|infographic|flowchart|concept-map|cover|scene-illustration",
      "location": "Chapter X, Section Y",
      "description": "what this illustration should show",
      "priority": "high|medium|low",
      "style": "visual style description",
      "dimensions": "landscape|square|portrait",
      "colorPalette": ["color1", "color2"],
      "grokPrompt": "detailed prompt for Grok Imagine"
    }
  ],
  "designProfile": {
    "fontFamily": "serif|sans-serif|mono",
    "colorScheme": "professional|warm|academic|creative|minimal",
    "layout": "traditional|modern|academic|creative",
    "pageSize": "A4|A5|US-Letter",
    "columnCount": 1|2|3,
    "illustrationStyle": "visual style for all illustrations"
  },
  "structure": {
    "frontMatter": ["dedication", "foreword", "introduction"],
    "mainContent": "description of main content structure",
    "backMatter": ["glossary", "index", "resources"],
    "hasTOC": boolean,
    "hasChapterSummaries": boolean
  },
  "estimatedProductionTime": "X hours or X days",
  "qualityScore": {
    "content": 0-100,
    "structure": 0-100,
    "readiness": 0-100
  },
  "recommendations": [
    "specific improvement recommendations"
  ]
}
`;

  try {
    const response = await callGemini(analysisPrompt, true);
    const analysis = JSON.parse(response);
    return analysis as ContentIntelligence;
  } catch (error) {
    console.error('Error analyzing content:', error);
    throw new Error('Failed to analyze content intelligence');
  }
}

/**
 * Generates professional Grok Imagine prompts from illustration specs
 */
export function generateGrokPrompts(illustrations: IllustrationSpec[]): Map<string, string> {
  const prompts = new Map<string, string>();

  illustrations.forEach(illustration => {
    // Build detailed, professional prompt for Grok
    const basePrompt = illustration.grokPrompt || illustration.description;
    
    const fullPrompt = `
Professional ${illustration.type.replace(/-/g, ' ')} illustration:
${basePrompt}

Style: ${illustration.style}
${illustration.colorPalette ? `Color palette: ${illustration.colorPalette.join(', ')}` : ''}
${illustration.dimensions ? `Format: ${illustration.dimensions}` : 'Format: landscape'}

Requirements:
- Publication-ready quality
- Professional finish
- Suitable for book/training material publication
- Clear, legible, visually appealing
- Consistent with modern design standards
    `.trim();

    prompts.set(illustration.id, fullPrompt);
  });

  return prompts;
}

/**
 * Validates content readiness and suggests pre-production steps
 */
export function validateProductionReadiness(
  intelligence: ContentIntelligence
): {
  isReady: boolean;
  blockers: string[];
  suggestions: string[];
} {
  const blockers: string[] = [];
  const suggestions: string[] = [];

  // Check readiness scores
  if (intelligence.qualityScore.content < 60) {
    blockers.push('Content quality score is low. Consider revising for clarity and coherence.');
  }
  if (intelligence.qualityScore.structure < 50) {
    blockers.push('Document structure needs work. Consider reorganizing chapters/sections.');
  }

  // Check illustration plan
  if (intelligence.illustrations.length === 0) {
    suggestions.push('No illustrations planned. Consider adding visual elements for engagement.');
  } else if (intelligence.illustrations.filter(i => i.priority === 'high').length === 0) {
    suggestions.push('Consider marking some illustrations as high priority for early generation.');
  }

  // Check for common components
  if (!intelligence.structure.hasTOC && intelligence.documentType.type !== 'short-story') {
    suggestions.push('Add a table of contents for better navigation.');
  }
  if (!intelligence.structure.backMatter.includes('glossary') && intelligence.documentType.type === 'technical-manual') {
    suggestions.push('Add a glossary for technical terms.');
  }

  return {
    isReady: blockers.length === 0 && intelligence.qualityScore.readiness >= 70,
    blockers,
    suggestions
  };
}

/**
 * Generates an output specification for the PDF/document generator
 */
export function generateOutputSpec(intelligence: ContentIntelligence) {
  return {
    format: 'pdf',
    metadata: {
      documentType: intelligence.documentType.type,
      estimatedPages: intelligence.documentType.estimatedPages,
      illustrationCount: intelligence.illustrations.length,
    },
    design: intelligence.designProfile,
    structure: intelligence.structure,
    illustrations: intelligence.illustrations.map(i => ({
      id: i.id,
      type: i.type,
      location: i.location,
      priority: i.priority,
    })),
    quality: {
      targetDPI: 300,
      colorProfile: 'CMYK',
      embedding: 'all-fonts',
    }
  };
}
