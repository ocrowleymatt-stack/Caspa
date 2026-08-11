import express from 'express';
import { expandOsintEvidence } from '../services/osintAnalystService';

const router = express.Router();

/**
 * Bridge between Atlas collection engines and the heavyweight analyst router.
 * Collection remains a separate concern; this endpoint consumes the bounded
 * evidence bundle, expands it, and returns provenance-aware leads/pivots.
 */
router.post('/expand', async (req, res) => {
  try {
    const { target, objective = '', collectedText, sources = [] } = req.body || {};
    if (!String(target || '').trim()) {
      return res.status(400).json({ success: false, message: 'target is required' });
    }
    if (!String(collectedText || '').trim()) {
      return res.status(400).json({ success: false, message: 'collectedText is required' });
    }
    const analysis = await expandOsintEvidence({
      target: String(target),
      objective: String(objective || ''),
      collectedText: String(collectedText),
      sources: Array.isArray(sources) ? sources.map(String) : [],
    });
    return res.json({
      success: true,
      data: {
        ...analysis,
        target: String(target),
        sourceCount: Array.isArray(sources) ? sources.length : 0,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return res.status(502).json({ success: false, message: err?.message || 'OSINT analyst expansion failed' });
  }
});

export default router;
