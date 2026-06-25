import { Router, type Request, type Response } from 'express';
import {
  getCasperShowInABoxPhases,
  getCasperShowInABoxSummary,
} from '../../data/casperShowInABoxModel';
import {
  runShowFactoryVirtualTest,
  showFactoryAgents,
  showFactoryApiCatalogue,
} from '../../data/casperShowFactoryModule';
import {
  orchestraAgents,
  orchestraQualityGates,
  orchestraServices,
  runOrchestraVirtualTest,
} from '../../data/showProductionOrchestraModule';
import {
  overnightMusicAgents,
  overnightMusicQualityGates,
  overnightMusicServices,
  runOvernightMusicLabVirtualTest,
} from '../../data/overnightMusicLabModule';

type ApiResponse = {
  success: boolean;
  data?: unknown;
  error?: string;
};

function sendSuccess(res: Response, data: unknown): void {
  res.json({ success: true, data } satisfies ApiResponse);
}

function sendError(res: Response, error: unknown, status = 500): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(status).json({ success: false, error: message } satisfies ApiResponse);
}

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response) => void {
  return (req, res) => {
    handler(req, res).catch((error) => sendError(res, error));
  };
}

export const showCatalogueRouter = Router();

showCatalogueRouter.get(
  '/api/show-catalogue/show-factory',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, {
      agents: showFactoryAgents,
      apiCatalogue: showFactoryApiCatalogue,
      virtualTest: runShowFactoryVirtualTest(),
    });
  }),
);

showCatalogueRouter.get(
  '/api/show-catalogue/orchestra',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, {
      agents: orchestraAgents,
      services: orchestraServices,
      qualityGates: orchestraQualityGates,
      virtualTest: runOrchestraVirtualTest(),
    });
  }),
);

showCatalogueRouter.get(
  '/api/show-catalogue/music-lab',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, {
      agents: overnightMusicAgents,
      services: overnightMusicServices,
      qualityGates: overnightMusicQualityGates,
      virtualTest: runOvernightMusicLabVirtualTest(),
    });
  }),
);

showCatalogueRouter.get(
  '/api/show-catalogue/show-in-a-box',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, {
      summary: getCasperShowInABoxSummary(),
      phases: getCasperShowInABoxPhases(),
    });
  }),
);
