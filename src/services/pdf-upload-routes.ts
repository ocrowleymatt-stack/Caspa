/**
 * PDF Upload & Ingestion Routes
 * Handles file uploads, parsing, and indexing
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import * as pdfParse from 'pdf-parse';

const router = express.Router();

// Configure multer for PDF uploads
const upload = multer({
  dest: '/tmp/caspa-uploads',
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files allowed'));
    } else {
      cb(null, true);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

interface UploadedFile extends Express.Multer.File {
  path?: string;
}

interface PDFContent {
  title?: string;
  text: string;
  pageCount: number;
  metadata: Record<string, any>;
}

/**
 * POST /upload
 * Upload and parse a PDF file
 */
router.post('/upload', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    const file = req.file as UploadedFile;

    if (!file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    // Read the uploaded file
    const fileBuffer = await fs.readFile(file.path!);

    // Parse PDF
    let pdfData: PDFContent;
    try {
      const parsed = await pdfParse(fileBuffer);
      pdfData = {
        title: path.parse(file.originalname!).name,
        text: parsed.text,
        pageCount: parsed.numpages,
        metadata: parsed.info || {},
      };
    } catch (parseError) {
      console.error('PDF parsing failed:', parseError);
      return res.status(400).json({
        error: 'Failed to parse PDF',
        details: (parseError as Error).message,
      });
    }

    // Clean up temp file
    await fs.unlink(file.path!).catch(() => {});

    // Return parsed content
    res.json({
      success: true,
      fileName: file.originalname,
      fileSize: file.size,
      content: pdfData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      details: (error as Error).message,
    });
  }
});

/**
 * POST /upload/batch
 * Upload multiple PDFs
 */
router.post('/upload/batch', upload.array('pdfs', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as UploadedFile[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No PDF files provided' });
    }

    const results = [];

    for (const file of files) {
      try {
        const fileBuffer = await fs.readFile(file.path!);
        const parsed = await pdfParse(fileBuffer);

        results.push({
          fileName: file.originalname,
          fileSize: file.size,
          pageCount: parsed.numpages,
          success: true,
          textPreview: parsed.text.substring(0, 500),
        });

        await fs.unlink(file.path!).catch(() => {});
      } catch (err) {
        results.push({
          fileName: file.originalname,
          success: false,
          error: (err as Error).message,
        });
      }
    }

    res.json({
      success: true,
      totalFiles: files.length,
      successful: results.filter((r) => r.success).length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Batch upload error:', error);
    res.status(500).json({
      error: 'Batch upload failed',
      details: (error as Error).message,
    });
  }
});

/**
 * GET /health
 * Check if upload service is ready
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'pdf-upload',
    status: 'ready',
    maxFileSize: '100MB',
    supportedFormats: ['application/pdf'],
  });
});

export default router;
