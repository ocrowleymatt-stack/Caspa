import { jobWorker } from '../orchestra';
import { EPUBBuilder, epubBuilder, type EPUBOptions } from './EPUBBuilder';
import { KDPPackager, kdpPackager } from './KDPPackager';
import { PDFAssembler, pdfAssembler, type PDFOptions } from './PDFAssembler';
import { publishingRouter, updateExportJob } from './publishing-routes';

interface ExportPayload {
  exportId: string;
  projectId: string;
  options?: PDFOptions | EPUBOptions;
}

function isPdfPayload(payload: unknown): payload is ExportPayload & { options: PDFOptions } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'exportId' in payload &&
    'projectId' in payload &&
    'options' in payload
  );
}

function isEpubPayload(payload: unknown): payload is ExportPayload & { options: EPUBOptions } {
  return isPdfPayload(payload);
}

function isProjectPayload(payload: unknown): payload is ExportPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'exportId' in payload &&
    'projectId' in payload
  );
}

export function registerPublishingHandlers(): void {
  jobWorker.registerHandler('pdf-export', async (payload, updateProgress) => {
    if (!isPdfPayload(payload)) {
      throw new Error('Invalid pdf-export payload');
    }

    await updateExportJob(payload.exportId, { status: 'running' });
    await updateProgress(10, 'Assembling PDF');

    const outputPath = await pdfAssembler.assemblePDF(payload.projectId, payload.options);
    await updateProgress(100, 'PDF complete');

    await updateExportJob(payload.exportId, {
      status: 'complete',
      outputPath,
    });

    return { exportId: payload.exportId, outputPath };
  });

  jobWorker.registerHandler('epub-export', async (payload, updateProgress) => {
    if (!isEpubPayload(payload)) {
      throw new Error('Invalid epub-export payload');
    }

    await updateExportJob(payload.exportId, { status: 'running' });
    await updateProgress(10, 'Building EPUB');

    const outputPath = await epubBuilder.buildEPUB(payload.projectId, payload.options);
    await updateProgress(100, 'EPUB complete');

    await updateExportJob(payload.exportId, {
      status: 'complete',
      outputPath,
    });

    return { exportId: payload.exportId, outputPath };
  });

  jobWorker.registerHandler('kdp-package', async (payload, updateProgress) => {
    if (!isProjectPayload(payload)) {
      throw new Error('Invalid kdp-package payload');
    }

    await updateExportJob(payload.exportId, { status: 'running' });
    await updateProgress(20, 'Generating KDP package');

    const outputPath = await kdpPackager.generateKDPPackage(payload.projectId);
    await updateProgress(100, 'KDP package complete');

    await updateExportJob(payload.exportId, {
      status: 'complete',
      outputPath,
    });

    return { exportId: payload.exportId, outputPath };
  });

  jobWorker.registerHandler('ingram-package', async (payload, updateProgress) => {
    if (!isProjectPayload(payload)) {
      throw new Error('Invalid ingram-package payload');
    }

    await updateExportJob(payload.exportId, { status: 'running' });
    await updateProgress(20, 'Generating IngramSpark package');

    const outputPath = await kdpPackager.generateIngramPackage(payload.projectId);
    await updateProgress(100, 'IngramSpark package complete');

    await updateExportJob(payload.exportId, {
      status: 'complete',
      outputPath,
    });

    return { exportId: payload.exportId, outputPath };
  });
}

registerPublishingHandlers();

export {
  PDFAssembler,
  pdfAssembler,
  EPUBBuilder,
  epubBuilder,
  KDPPackager,
  kdpPackager,
  publishingRouter,
};
export type { PDFOptions, CoverOptions } from './PDFAssembler';
export type { EPUBOptions } from './EPUBBuilder';
