import { asyncHandler, createElevationRouter, sendError, sendSuccess } from '../../shared/routeHelpers';
import { generateId, writeJsonFile } from '../../shared/fileStore';
import { documentRenderer } from './DocumentRenderer';

export const documentRenderRouter = createElevationRouter();

documentRenderRouter.post(
  '/api/document-render/preview',
  asyncHandler(async (req, res) => {
    const { title, content, format } = req.body as {
      title?: string;
      content?: string;
      format?: 'html' | 'markdown';
    };
    if (!content?.trim()) {
      sendError(res, new Error('content is required'), 400);
      return;
    }
    const result = await documentRenderer.render({
      title: title ?? 'Untitled',
      content,
      format: format ?? 'markdown',
    });
    await writeJsonFile('document-renders', `${generateId()}.json`, result);
    sendSuccess(res, result);
  }),
);

documentRenderRouter.post(
  '/api/document-render/pdf',
  asyncHandler(async (req, res) => {
    const { title, content } = req.body as { title?: string; content?: string };
    if (!content?.trim()) {
      sendError(res, new Error('content is required'), 400);
      return;
    }
    const result = await documentRenderer.render({
      title: title ?? 'Untitled',
      content,
      format: 'markdown',
    });
    if (!result.pdfAvailable || !result.pdfBase64) {
      sendError(res, new Error('PDF generation unavailable'), 503);
      return;
    }
    sendSuccess(res, { pdfBase64: result.pdfBase64, title: title ?? 'Untitled' });
  }),
);
