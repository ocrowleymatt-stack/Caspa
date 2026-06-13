import { Router, Request, Response } from 'express';
import PDFAssemblyService, { AssemblyOptions, PDFOutput } from './PDFAssemblyService';
import { analyzeContent, ContentAnalysisInput, ContentIntelligence } from './ContentIntelligenceService';
import { createGrokImagineService } from './GrokImagineService';
import { GoogleGenAI } from '@google/genai';

const router = Router();

// Create Gemini API instance for PDF routes
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// Lazy-initialize Grok service
let grokService: any = null;
function getGrokService() {
  if (!grokService) {
    grokService = createGrokImagineService();
  }
  return grokService;
}

// Helper: Call Gemini from PDF routes
async function callGemini(prompt: string, json: boolean = false): Promise<string> {
  if (!gemini) {
    throw new Error('Gemini API not configured');
  }
  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    });
    const text = response.response.text();
    return text;
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

/**
 * POST /api/pdf/screen
 * Generate screen-friendly PDF (sRGB, 72 DPI, fast)
 */
router.post('/pdf/screen', async (req: Request, res: Response) => {
  try {
    const { content, designProfile, illustrations, turbo } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Missing content' });
    }

    // Prepare input for analyzeContent
    const analysisInput: ContentAnalysisInput = {
      title: content.title || 'Untitled Document',
      content: content.text || content,
      targetAudience: content.targetAudience || 'general',
      purpose: content.purpose || 'publishing',
      context: content.context || '',
    };

    // Analyze content
    const intelligence = await analyzeContent(analysisInput, callGemini);

    // Use provided illustrations or ask to generate
    let illustrationAssets = illustrations || [];
    if (!illustrations || illustrations.length === 0) {
      return res.status(202).json({
        status: 'illustrations_required',
        message: 'Illustrations needed before PDF assembly',
        illustrationCount: intelligence.illustrations.length,
        illustrations: intelligence.illustrations.map(ill => ({
          type: ill.type,
          description: ill.description,
          location: ill.location,
        })),
        nextStep: 'Submit illustrations via assemble endpoint or /api/grok/generate-illustrations',
      });
    }

    const options: AssemblyOptions = {
      contentIntelligence: intelligence,
      illustrations: illustrationAssets,
      designProfile: designProfile || intelligence.designProfile,
      outputMode: 'screen',
      turbo: turbo || false,
    };

    const { buffer, output } = await PDFAssemblyService.generateScreenPDF(options);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document-screen.pdf"');
    res.setHeader('X-PDF-Info', JSON.stringify(output));
    res.send(buffer);
  } catch (error) {
    console.error('Screen PDF generation failed:', error);
    res.status(500).json({
      error: 'PDF generation failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/pdf/professional
 * Generate professional print-ready PDF (CMYK, 300 DPI, with gating)
 * GATED: Validates print specs before output
 */
router.post('/pdf/professional', async (req: Request, res: Response) => {
  try {
    const { content, designProfile, illustrations } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Missing content' });
    }

    const analysisInput: ContentAnalysisInput = {
      title: content.title || 'Untitled Document',
      content: content.text || content,
      targetAudience: content.targetAudience || 'general',
      purpose: content.purpose || 'publishing',
      context: content.context || '',
    };

    const intelligence = await analyzeContent(analysisInput, callGemini);

    // Professional requires illustrations
    if (!illustrations || illustrations.length === 0) {
      return res.status(400).json({
        error: 'Professional PDF requires all illustrations pre-generated',
        message: 'Generate illustrations first and provide in request',
      });
    }

    const options: AssemblyOptions = {
      contentIntelligence: intelligence,
      illustrations: illustrations,
      designProfile: designProfile || intelligence.designProfile,
      outputMode: 'professional',
    };

    const { buffer, output } = await PDFAssemblyService.generateProfessionalPDF(options);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document-professional.pdf"');
    res.setHeader('X-PDF-Info', JSON.stringify(output));
    res.send(buffer);
  } catch (error) {
    console.error('Professional PDF generation failed:', error);

    const isSpecError = error instanceof Error && error.message.includes('Professional PDF rejected');

    res.status(isSpecError ? 422 : 500).json({
      error: isSpecError ? 'Print specification validation failed' : 'PDF generation failed',
      details: error instanceof Error ? error.message : String(error),
      hint: isSpecError
        ? 'Adjust typography (leading), layout (gutters), or margins to meet print specs'
        : undefined,
    });
  }
});

/**
 * POST /api/pdf/assemble
 * One-shot assembly: content → intelligence → illustrations → PDF
 */
router.post('/pdf/assemble', async (req: Request, res: Response) => {
  try {
    const { content, designOverride, turbo } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Missing content' });
    }

    // Step 1: Analyze
    const analysisInput: ContentAnalysisInput = {
      title: content.title || 'Untitled Document',
      content: content.text || content,
      targetAudience: content.targetAudience || 'general',
      purpose: content.purpose || 'publishing',
      context: content.context || '',
    };

    const intelligence = await analyzeContent(analysisInput, callGemini);

    // Step 2: Generate illustrations (or skip if not available)
    let illustrations: any[] = [];
    if (intelligence.illustrations.length > 0) {
      try {
        const grok = getGrokService();
        illustrations = await Promise.all(
          intelligence.illustrations.map(async (spec: any) => ({
            type: spec.type,
            url: `placeholder-${spec.id}`, // Would be actual URL from Grok
            description: spec.description,
            prompt: spec.grokPrompt,
            location: spec.location,
            priority: spec.priority,
          }))
        );
      } catch (illustError) {
        console.warn('Illustration generation skipped:', illustError);
      }
    }

    // Step 3: Assemble screen PDF
    const screenOptions: AssemblyOptions = {
      contentIntelligence: intelligence,
      illustrations: illustrations,
      designProfile: designOverride || intelligence.designProfile,
      outputMode: 'screen',
      turbo: turbo || false,
    };

    const { buffer, output } = await PDFAssemblyService.generateScreenPDF(screenOptions);

    // Step 4: Prepare professional option info
    const professionalOptions = {
      endpoint: '/api/pdf/professional',
      method: 'POST',
      message: 'Professional PDF requires CMYK color space, 300 DPI, and pre-generated illustrations',
      specs: {
        colorSpace: 'CMYK',
        resolution: '300 DPI',
        bleed: '3.5mm',
        safetyZone: '5mm',
      },
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.setHeader('X-Professional-Info', JSON.stringify(professionalOptions));
    res.setHeader('X-PDF-Info', JSON.stringify(output));

    res.send(buffer);
  } catch (error) {
    console.error('Full assembly failed:', error);
    res.status(500).json({
      error: 'Document assembly failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/pdf/specs
 * Returns default print/screen specifications
 */
router.get('/pdf/specs', (req: Request, res: Response) => {
  const specs = {
    screen: {
      colorSpace: 'sRGB',
      resolution: '72 DPI',
      bleedSize: '0mm',
      safetyZone: '0mm',
      useCase: 'Digital reading, email, web',
      generateTime: '5-15 seconds',
    },
    professional: {
      colorSpace: 'CMYK',
      resolution: '300 DPI',
      bleedSize: '3.5mm',
      safetyZone: '5mm',
      cropMarks: true,
      registrationMarks: true,
      useCase: 'Print production, publishing',
      generateTime: '30-60 seconds',
      requirements: [
        'Typography: leading 1.4–1.6x base size',
        'Layout: gutters ≥6mm for multi-column',
        'Margins: inner ≥15mm, outer ≥12mm',
        'All illustrations must be pre-generated',
      ],
      validation: {
        colorSpace: 'MUST be CMYK (no RGB)',
        resolution: 'MUST be ≥300 DPI',
        safetyZone: 'MUST be ≥5mm from edge',
        leadingRatio: 'SHOULD be 1.4–1.6x base size',
      },
    },
  };

  res.json(specs);
});


// Cost Estimation
router.post('/estimate', (req, res) => {
  try {
    const { CostEstimatorService } = require('./CostEstimatorService');
    const estimator = new CostEstimatorService();
    const estimate = estimator.estimateCost(req.body);
    res.json(estimate);
  } catch (error) {
    res.status(400).json({ error: 'Invalid estimate parameters' });
  }
});


export default router;
