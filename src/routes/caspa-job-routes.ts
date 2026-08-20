import express from 'express';
import { requestUser } from '../middleware/authenticatedUser';
import { getUserJob, jobSummary, listUserJobs } from '../services/jobQueueService';
import { runServerCommission } from '../services/serverCommissionJobService';
import { updateJob } from '../services/jobQueueService';

const router = express.Router();

router.get('/', (req, res) => {
  const user = requestUser(res);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
  const jobs = listUserJobs(user.id, limit, String(req.query.projectId || ''), String(req.query.status || ''));
  res.json({ success: true, data: { jobs: jobs.map(jobSummary) } });
});

router.get('/:id', (req, res) => {
  const job = getUserJob(requestUser(res).id, req.params.id);
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  return res.json({ success: true, data: jobSummary(job) });
});

router.get('/:id/result', (req, res) => {
  const job = getUserJob(requestUser(res).id, req.params.id);
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  if (job.status !== 'complete') return res.status(409).json({ success: false, message: 'Job is not complete', code: 'JOB_NOT_COMPLETE' });
  return res.json({ success: true, data: { id: job.id, result: job.result } });
});

router.post('/:id/retry', (req, res) => {
  const job = getUserJob(requestUser(res).id, req.params.id);
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  if (job.type !== 'commission' || (!job.input && !job.checkpoint)) return res.status(409).json({ success: false, message: 'This job has no resumable checkpoint', code: 'JOB_NOT_RESUMABLE' });
  updateJob(job.id, { status: 'queued', error: undefined, stage: 'retry-queued' });
  setTimeout(() => void runServerCommission(job.id), 0);
  return res.status(202).json({ success: true, data: { id: job.id, status: 'queued' } });
});

export default router;
