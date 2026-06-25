import { apiCall } from './client';

export async function simulateAudience(projectId: string) {
  return apiCall(`/api/audience/simulate/${projectId}`, { method: 'POST' });
}

export async function testAudienceText(text: string, persona?: string, projectId?: string) {
  return apiCall('/api/audience/test-text', { method: 'POST', body: JSON.stringify({ text, persona, projectId }) });
}

export async function getMarketFit(projectId: string) {
  return apiCall(`/api/audience/market-fit/${projectId}`);
}

export async function simulateReviews(projectId: string) {
  return apiCall(`/api/audience/review-sim/${projectId}`, { method: 'POST' });
}

export async function getTicketBuyerFit(projectId: string) {
  return apiCall(`/api/audience/ticket-buyer-fit/${projectId}`);
}
