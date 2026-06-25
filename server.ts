import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { config, logger } from './src/shared/index';
import { ensureDemoProject } from './src/shared/demoSeed';
import { storageRouter } from './src/modules/storage/index';
import { manuscriptRouter } from './src/modules/manuscript/index';
import { aiRouter } from './src/modules/ai/index';
import { showFactoryRouter } from './src/modules/show-factory/index';
import { musicLabRouter } from './src/modules/music-lab/index';
import { orchestraRouter, jobWorker } from './src/modules/orchestra/index';
import { publishingRouter } from './src/modules/publishing/index';
import { showBoxRouter } from './src/modules/show-box/index';
import { wonderRouter } from './src/modules/wonder/index';
import { qualityRouter } from './src/modules/quality/index';
import { tasteRouter } from './src/modules/taste/index';
import { audienceRouter } from './src/modules/audience/index';
import { showstopperRouter } from './src/modules/showstopper/index';
import { rehearsalRouter } from './src/modules/rehearsal/index';
import { producerRouter } from './src/modules/producer/index';
import { localiseRouter } from './src/modules/localise/index';
import { visualsRouter } from './src/modules/visuals/index';
import { awardsRouter } from './src/modules/awards/index';
import { goldRouter, goldPipelineRoutes } from './src/modules/gold/index';
import { authRouter, bootstrapAuth, requireAuth } from './src/modules/auth/index';
import { commandRouter } from './src/modules/command-orchestrator/index';
import { casperRouter } from './src/modules/casper-freestyle/index';
import { intakeRouter } from './src/modules/intake/index';
import { productForgeRouter } from './src/modules/product-forge/index';
import { researchRouter } from './src/modules/research/index';
import { verificationRouter } from './src/modules/verification/index';
import { illustrationRouter } from './src/modules/illustration/index';
import { musicPromptRouter } from './src/modules/music-prompt-lab/index';
import { documentRenderRouter } from './src/modules/document-renderer/index';
import { publishConfidenceRouter } from './src/modules/publish-confidence/index';
import { outputsRouter } from './src/modules/outputs/index';
import { showCatalogueRouter } from './src/modules/show-catalogue/index';
import { runMigrations } from './src/services/db';

runMigrations();

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use(authRouter);
if (config.authEnabled) {
  app.use(requireAuth);
}

app.use(storageRouter);
app.use(manuscriptRouter);
app.use(aiRouter);
app.use(showFactoryRouter);
app.use(musicLabRouter);
app.use(orchestraRouter);
app.use(publishingRouter);
app.use(showBoxRouter);
app.use(wonderRouter);
app.use(qualityRouter);
app.use(tasteRouter);
app.use(audienceRouter);
app.use(showstopperRouter);
app.use(rehearsalRouter);
app.use(producerRouter);
app.use(localiseRouter);
app.use(visualsRouter);
app.use(awardsRouter);
app.use(goldRouter);
app.use('/api/goldpipeline', goldPipelineRoutes);
app.use(commandRouter);
app.use(casperRouter);
app.use(intakeRouter);
app.use(productForgeRouter);
app.use(researchRouter);
app.use(verificationRouter);
app.use(illustrationRouter);
app.use(musicPromptRouter);
app.use(documentRenderRouter);
app.use(publishConfidenceRouter);
app.use(outputsRouter);
app.use(showCatalogueRouter);

const publicDir = path.join(process.cwd(), 'public');
app.use(
  express.static(publicDir, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

app.use((req: Request, res: Response) => {
  // Never serve SPA shell for API or hashed asset requests — stale index.html + wrong
  // bundle hashes otherwise return HTML as JS and produce a blank page.
  if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }

  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'CASPA API is running. No UI found in /public.' });
  }
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
  res.status(500).json({
    success: false,
    error: err instanceof Error ? err.message : 'Internal server error',
  });
};

app.use(errorHandler);

async function start(): Promise<void> {
  await bootstrapAuth();
  await ensureDemoProject();
  jobWorker.start();
  app.listen(config.port, () => {
    logger.info(`CASPA Studio running on port ${config.port}`);
    logger.info(`Health: http://localhost:${config.port}/health`);
  });
}

start().catch((err) => logger.error(err));
