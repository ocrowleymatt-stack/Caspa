/**
 * Service API Routes
 * Batch job submission, status tracking, result delivery
 */

import { Router, Request, Response } from 'express';
import { ServiceAPIManager, JobRequest } from './ServiceAPIManager';
import pdfService from './PDFAssemblyService';  // Singleton instance
import { BookMetadataService } from './BookMetadataService';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';

const router = Router();

// Initialize services
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

let metadataService: BookMetadataService | null = null;
let apiManager: ServiceAPIManager | null = null;

function getMetadataService() {
  if (!metadataService && gemini) {
    metadataService = new BookMetadataService(gemini);
  }
  return metadataService;
}

function getAPIManager() {
  if (!apiManager) {
    const meta = getMetadataService();
    // Metadata is optional - proceed if Gemini key is available
    if (meta && gemini) {
      apiManager = new ServiceAPIManager(pdfService, meta, gemini);
    } else {
      // Create a minimal API manager without metadata (phase 4a test mode)
      console.log('⚠️  Gemini API not configured - metadata generation disabled');
      // Use a mock metadata service for now
      const mockMetadata = new BookMetadataService(gemini || ({} as any));
      apiManager = new ServiceAPIManager(pdfService, mockMetadata, gemini || ({} as any));
    }
  }
  return apiManager;
}

/**
 * POST /queue
 * Submit a batch of documents for processing
 */
router.post('/queue', async (req: Request, res: Response) => {
  try {
    const request: JobRequest = req.body;

    // Validate request
    if (!request.manuscripts || !Array.isArray(request.manuscripts)) {
      return res.status(400).json({ error: 'manuscripts array required' });
    }

    if (request.manuscripts.length === 0) {
      return res.status(400).json({ error: 'at least 1 manuscript required' });
    }

    if (request.manuscripts.length > 50) {
      return res.status(400).json({ error: 'maximum 50 documents per batch' });
    }

    if (!request.outputFormat || !['screen', 'professional'].includes(request.outputFormat)) {
      return res.status(400).json({ error: 'outputFormat must be "screen" or "professional"' });
    }

    // Submit batch
    const manager = getAPIManager();
    const jobId = await manager.submitBatch(request);

    return res.status(202).json({
      jobId,
      status: 'queued',
      documentCount: request.manuscripts.length,
      statusUrl: `/api/service/status/${jobId}`,
    });
  } catch (error) {
    console.error('Queue error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to queue job' });
  }
});

/**
 * GET /status/:jobId
 * Check job status and progress
 */
router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const manager = getAPIManager();
    const job = await manager.getStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json({
      jobId: job.jobId,
      status: job.status,
      submittedAt: job.submittedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      documentCount: job.documentCount,
      processed: job.processed,
      failed: job.failed,
      error: job.error,
      results: Array.from(job.results.entries()).map(([id, result]) => ({
        documentId: id,
        status: result.status,
        processingTime: result.processingTime,
        error: result.error,
      })),
    });
  } catch (error) {
    console.error('Status error:', error);
    return res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

/**
 * GET /download/:jobId/:documentId
 * Download completed PDF
 */
router.get('/download/:jobId/:documentId', async (req: Request, res: Response) => {
  try {
    const { jobId, documentId } = req.params;
    const manager = getAPIManager();
    const pdfPath = await manager.getResultPath(jobId, documentId);

    if (!pdfPath) {
      return res.status(404).json({ error: 'Result not found or not ready' });
    }

    const buffer = await fs.readFile(pdfPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${documentId}.pdf"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({ error: 'Failed to download result' });
  }
});

/**
 * GET /jobs
 * List all jobs
 */
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const manager = getAPIManager();
    const jobs = await manager.listJobs();
    return res.json({ jobs });
  } catch (error) {
    console.error('List jobs error:', error);
    return res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/**
 * GET /specs
 * Service API specifications
 */
router.get('/specs', (req: Request, res: Response) => {
  return res.json({
    name: 'Caspa Service API',
    version: '4.0.0',
    description: 'Batch document processing for Life-Factory and Nexus-Factory',
    endpoints: [
      {
        method: 'POST',
        path: '/api/service/queue',
        description: 'Submit batch job (max 50 documents)',
        body: {
          manuscripts: [
            {
              id: 'string (unique per batch)',
              title: 'string',
              content: 'string (manuscript text)',
              isbn: 'string (optional)',
              authorName: 'string (optional)',
            },
          ],
          outputFormat: 'screen | professional',
          includeMetadata: 'boolean',
          includeIllustrations: 'boolean (optional)',
          options: {
            cmykValidation: 'boolean (professional only)',
            dpiTarget: 'number (default 300)',
            bleeds: 'number in mm (default 3.5)',
          },
        },
        returns: {
          jobId: 'string',
          status: 'queued',
          documentCount: 'number',
          statusUrl: 'string',
        },
      },
      {
        method: 'GET',
        path: '/api/service/status/:jobId',
        description: 'Check job status',
        returns: {
          jobId: 'string',
          status: 'queued | processing | completed | failed | partial',
          documentCount: 'number',
          processed: 'number',
          failed: 'number',
          results: 'array of document results',
        },
      },
      {
        method: 'GET',
        path: '/api/service/download/:jobId/:documentId',
        description: 'Download completed PDF',
        returns: 'PDF binary (application/pdf)',
      },
      {
        method: 'GET',
        path: '/api/service/jobs',
        description: 'List all jobs',
        returns: {
          jobs: 'array of job summaries',
        },
      },
    ],
    limits: {
      maxDocumentsPerBatch: 50,
      maxDocumentSize: '50MB (per manuscript text)',
      maxConcurrentJobs: 'unlimited',
      jobRetention: '30 days',
    },
    outputFormats: {
      screen: 'sRGB, 72 DPI, fast rendering (5-15s per document)',
      professional: 'CMYK, 300 DPI, professional print-ready (gated validation)',
    },
  });
});

export default router;
