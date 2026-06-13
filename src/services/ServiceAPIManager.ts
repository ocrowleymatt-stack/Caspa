/**
 * ServiceAPIManager
 * Handles batch job submission, tracking, and result delivery
 * Enables Life-Factory and Nexus-Factory integration
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import type PDFAssemblyService from './PDFAssemblyService';
import { BookMetadataService } from './BookMetadataService';
import type { GoogleGenAI } from '@google/genai';

export interface JobRequest {
  manuscripts: Array<{
    id: string;
    title: string;
    content: string;
    isbn?: string;
    authorName?: string;
  }>;
  outputFormat: 'screen' | 'professional';
  includeMetadata: boolean;
  includeIllustrations?: boolean;
  options?: {
    cmykValidation?: boolean;
    dpiTarget?: number;
    bleeds?: number;
  };
}

export interface JobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'partial';
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  documentCount: number;
  processed: number;
  failed: number;
  results: Map<string, DocumentResult>;
  error?: string;
}

export interface DocumentResult {
  documentId: string;
  status: 'pending' | 'completed' | 'failed';
  pdfPath?: string;
  metadata?: any;
  error?: string;
  processingTime?: number;
}

const JOBS_DIR = '/opt/caspa/data/service-jobs';
const RESULTS_DIR = '/opt/caspa/data/service-results';

export class ServiceAPIManager {
  private jobs: Map<string, JobStatus> = new Map();
  private pdfService: PDFAssemblyService;
  private metadataService: BookMetadataService;
  private gemini: any;

  constructor(pdfService: PDFAssemblyService, metadataService: BookMetadataService, gemini: any) {
    this.pdfService = pdfService;
    this.metadataService = metadataService;
    this.gemini = gemini;
    this.initializeDirs();
    this.loadPersistedJobs();
  }

  private async initializeDirs() {
    try {
      await fs.mkdir(JOBS_DIR, { recursive: true });
      await fs.mkdir(RESULTS_DIR, { recursive: true });
      console.log('✅ Service directories initialized');
    } catch (error) {
      console.error('Failed to initialize job directories:', error);
    }
  }

  private async loadPersistedJobs() {
    try {
      const files = await fs.readdir(JOBS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(JOBS_DIR, file), 'utf-8');
          const jobStatus = JSON.parse(data);
          // Reconstruct Map
          jobStatus.results = new Map(Object.entries(jobStatus.results || {}));
          this.jobs.set(jobStatus.jobId, jobStatus);
        }
      }
      console.log(`✅ Loaded ${this.jobs.size} persisted jobs`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load persisted jobs:', error);
      }
    }
  }

  async submitBatch(request: JobRequest): Promise<string> {
    const jobId = uuidv4();
    const now = new Date().toISOString();

    const jobStatus: JobStatus = {
      jobId,
      status: 'queued',
      submittedAt: now,
      documentCount: request.manuscripts.length,
      processed: 0,
      failed: 0,
      results: new Map(),
      error: undefined,
    };

    // Initialize results for each manuscript
    for (const ms of request.manuscripts) {
      jobStatus.results.set(ms.id, {
        documentId: ms.id,
        status: 'pending',
      });
    }

    this.jobs.set(jobId, jobStatus);

    // Persist job metadata
    await this.persistJob(jobStatus);

    // Start async processing
    this.processJob(jobId, request).catch((error) => {
      console.error(`Job ${jobId} processing error:`, error);
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
        this.persistJob(job).catch(console.error);
      }
    });

    console.log(`📋 Job ${jobId} submitted (${request.manuscripts.length} documents)`);
    return jobId;
  }

  async getStatus(jobId: string): Promise<JobStatus | null> {
    const job = this.jobs.get(jobId);
    if (!job) {
      // Try to load from disk
      try {
        const data = await fs.readFile(path.join(JOBS_DIR, `${jobId}.json`), 'utf-8');
        const jobStatus = JSON.parse(data);
        jobStatus.results = new Map(Object.entries(jobStatus.results || {}));
        return jobStatus;
      } catch {
        return null;
      }
    }
    return job;
  }

  async getResultPath(jobId: string, documentId: string): Promise<string | null> {
    const job = await this.getStatus(jobId);
    if (!job) return null;

    const result = job.results.get(documentId);
    if (!result || !result.pdfPath) return null;

    const pdfPath = path.join(RESULTS_DIR, result.pdfPath);
    try {
      await fs.stat(pdfPath);
      return pdfPath;
    } catch {
      return null;
    }
  }

  async listJobs(): Promise<Partial<JobStatus>[]> {
    return Array.from(this.jobs.values()).map((job) => ({
      jobId: job.jobId,
      status: job.status,
      submittedAt: job.submittedAt,
      documentCount: job.documentCount,
      processed: job.processed,
      failed: job.failed,
    }));
  }

  private async processJob(jobId: string, request: JobRequest) {
    const job = this.jobs.get(jobId)!;
    job.status = 'processing';
    job.startedAt = new Date().toISOString();
    await this.persistJob(job);

    let successCount = 0;
    let failCount = 0;

    for (const manuscript of request.manuscripts) {
      try {
        const startTime = Date.now();
        const result = job.results.get(manuscript.id);
        
        if (!result) {
          throw new Error(`No result entry for ${manuscript.id}`);
        }

        // Generate metadata if requested
        if (request.includeMetadata && this.metadataService) {
          try {
            const metadata = await this.metadataService.generateMetadata({
              manuscriptText: manuscript.content,
              isbn: manuscript.isbn,
              authorName: manuscript.authorName,
            });
            result.metadata = metadata;
          } catch (metaError) {
            console.warn(`Metadata generation skipped for ${manuscript.id}:`, metaError);
          }
        }

        // Assemble PDF using the correct method
        const pdfRelPath = `${jobId}/${manuscript.id}.pdf`;
        const pdfFullPath = path.join(RESULTS_DIR, pdfRelPath);
        await fs.mkdir(path.dirname(pdfFullPath), { recursive: true });

        // Use the correct PDF generation method
        const pdfResult = request.outputFormat === 'professional'
          ? await this.pdfService.generateProfessionalPDF({
              html: `<h1>${manuscript.title}</h1><p>${manuscript.content}</p>`,
              filename: `${manuscript.id}.pdf`,
              width: 210,
              height: 297,
              designProfile: { layout: { columnCount: 1, margin: 20 } },
            })
          : await this.pdfService.generateScreenPDF({
              html: `<h1>${manuscript.title}</h1><p>${manuscript.content}</p>`,
              filename: `${manuscript.id}.pdf`,
              width: 800,
              height: 600,
              designProfile: { layout: { columnCount: 1, margin: 10 } },
            });

        await fs.writeFile(pdfFullPath, pdfResult.buffer);

        result.status = 'completed';
        result.pdfPath = pdfRelPath;
        result.processingTime = Date.now() - startTime;
        successCount++;
        console.log(`✅ Processed ${manuscript.id} (${result.processingTime}ms)`);
      } catch (error) {
        const result = job.results.get(manuscript.id);
        if (result) {
          result.status = 'failed';
          result.error = error instanceof Error ? error.message : 'Unknown error';
        }
        failCount++;
        console.error(`Failed to process document ${manuscript.id}:`, error);
      }
    }

    job.processed = successCount;
    job.failed = failCount;
    job.status = failCount === 0 ? 'completed' : failCount === job.documentCount ? 'failed' : 'partial';
    job.completedAt = new Date().toISOString();

    await this.persistJob(job);
    console.log(`✅ Job ${jobId} completed: ${successCount} succeeded, ${failCount} failed`);
  }

  private async persistJob(job: JobStatus) {
    try {
      const jobData = {
        ...job,
        results: Object.fromEntries(job.results),
      };
      await fs.writeFile(path.join(JOBS_DIR, `${job.jobId}.json`), JSON.stringify(jobData, null, 2));
    } catch (error) {
      console.error(`Failed to persist job ${job.jobId}:`, error);
    }
  }
}
