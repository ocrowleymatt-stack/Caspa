import { Router } from 'express';
import {
  economyCapabilities,
  getEconomyBatch,
  listEconomyBatches,
  submitEconomyBatch,
} from '../services/economyBatchService';

const router = Router();

router.get('/capabilities', (_req, res) => {
  res.json(economyCapabilities());
});

router.get('/jobs', (_req, res) => {
  res.json({ jobs: listEconomyBatches() });
});

router.post('/jobs', async (req, res) => {
  try {
    const job = await submitEconomyBatch(req.body || {});
    res.status(202).json(job);
  } catch (error: any) {
    res.status(400).json({ message: error?.message || 'Could not submit economy batch job' });
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await getEconomyBatch(req.params.id);
    if (!job) return res.status(404).json({ message: 'Economy batch job not found in this Atlas process' });
    return res.json(job);
  } catch (error: any) {
    return res.status(502).json({ message: error?.message || 'Could not refresh economy batch job' });
  }
});

export default router;
