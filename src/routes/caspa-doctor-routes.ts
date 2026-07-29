/**
 * Caspa Doctor route — public safe diagnostics (no auth, no secrets)
 */

import { Router } from 'express';
import { getDoctorSnapshot } from '../services/doctorService';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const data = await getDoctorSnapshot();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Doctor] Snapshot failed:', err);
    res.status(500).json({ success: false, data: { status: 'error' } });
  }
});

export default router;
