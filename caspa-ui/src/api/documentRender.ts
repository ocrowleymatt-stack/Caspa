import { apiCall } from './client';

export function previewDocument(body: {
  title?: string;
  content: string;
  format?: 'html' | 'markdown';
}) {
  return apiCall<{ html: string; markdown: string; pdfAvailable: boolean }>(
    '/api/document-render/preview',
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function renderPdf(body: { title?: string; content: string }) {
  return apiCall<{ pdfBase64: string; title: string }>('/api/document-render/pdf', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
