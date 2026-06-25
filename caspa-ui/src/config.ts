/** Empty string = same origin (production). Set VITE_API_URL for split Vite dev on :5173. */
export const API_BASE = import.meta.env.VITE_API_URL ?? '';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
