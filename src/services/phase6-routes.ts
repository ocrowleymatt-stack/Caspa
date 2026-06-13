import { Router } from 'express';
import { LiteraryPrizeEngine, PsychologyEngine, ResearchDesk, OneClickExporter } from './Phase6Engine';

const router = Router();
const prizeEngine = new LiteraryPrizeEngine();
const psychEngine = new PsychologyEngine();
const researchDesk = new ResearchDesk();
const exporter = new OneClickExporter();

// Prize endpoints
router.get('/prizes', (req, res) => {
  res.json({ prizes: prizeEngine.getPrizeDefinitions() });
});

router.post('/analyze-prize', async (req, res) => {
  try {
    const { manuscriptText, prizeId } = req.body;
    if (!manuscriptText || !prizeId) return res.status(400).json({ error: 'Missing fields' });
    const analysis = await prizeEngine.analyzePrize(manuscriptText, prizeId);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/scan-all-prizes', async (req, res) => {
  try {
    const { manuscriptText } = req.body;
    if (!manuscriptText) return res.status(400).json({ error: 'manuscriptText required' });
    const analyses = await prizeEngine.scanMultiplePrizes(manuscriptText);
    res.json({ topPrizes: analyses.slice(0, 3), allAnalyses: analyses });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Psychology endpoints
router.post('/psychology/character', async (req, res) => {
  try {
    const { characterProfile } = req.body;
    if (!characterProfile) return res.status(400).json({ error: 'characterProfile required' });
    const validation = await psychEngine.validateCharacter(characterProfile);
    res.json(validation);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Research endpoint
router.post('/research', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });
    const result = await researchDesk.research(query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Export endpoints
router.post('/export/kdp', (req, res) => {
  try {
    const { title, author, isbn } = req.body;
    const metadata = exporter.generateKDPMetadata(title, author, isbn);
    res.json({
      package: metadata,
      checklist: exporter.getPrintChecklist(),
      nextSteps: ['Upload to KDP', 'Review and publish']
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/export/ingramspark', (req, res) => {
  try {
    const { title, author, isbn } = req.body;
    const metadata = exporter.generateIngramMetadata(title, author, isbn);
    res.json({
      package: metadata,
      checklist: exporter.getPrintChecklist(),
      nextSteps: ['Upload to IngramSpark', 'Submit for review']
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/export/checklist/:platform', (req, res) => {
  res.json({ platform: req.params.platform, checklist: exporter.getPrintChecklist() });
});

export default router;
