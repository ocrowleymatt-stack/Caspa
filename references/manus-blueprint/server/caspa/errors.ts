import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";

export type CaspaErrorCode =
  | "AI_TEMPORARILY_UNAVAILABLE"
  | "AI_RESPONSE_INVALID"
  | "IMAGE_GENERATION_UNAVAILABLE"
  | "DATABASE_UNAVAILABLE"
  | "MANUSCRIPT_REQUIRED"
  | "WORKFLOW_STATE_CONFLICT"
  | "REVISION_JOB_FAILED"
  | "EXPORT_PREFLIGHT_REQUIRED"
  | "EXPORT_NOT_READY"
  | "UPLOAD_UNSUPPORTED"
  | "DRAFT_PREVIEW_STALE"
  | "STYLE_CONSENT_REQUIRED"
  | "COLLABORATOR_ACCESS_DENIED"
  | "REVIEW_CLOSED"
  | "APPROVAL_REQUIRED";

export class CaspaServiceError extends Error {
  constructor(
    public readonly errorCode: CaspaErrorCode,
    public readonly userMessage: string,
    public readonly traceId = randomUUID(),
  ) {
    super(userMessage);
    this.name = "CaspaServiceError";
  }
}

export function createTraceId() {
  return randomUUID();
}

export function logPrivateError(area: string, traceId: string, error: unknown, context?: Record<string, unknown>) {
  console.error(`[caspa:${area}]`, {
    traceId,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
  });
}

export function toSafeTrpcError(error: unknown, fallbackMessage = "We could not complete that request. Please try again."): never {
  if (error instanceof TRPCError) throw error;
  if (error instanceof CaspaServiceError) {
    throw new TRPCError({
      code: error.errorCode.startsWith("AI_") ? "BAD_GATEWAY" : "PRECONDITION_FAILED",
      message: `${error.errorCode}|${error.userMessage}|${error.traceId}`,
    });
  }

  const traceId = createTraceId();
  logPrivateError("unhandled", traceId, error);
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `REQUEST_FAILED|${fallbackMessage}|${traceId}`,
  });
}
