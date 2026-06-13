import React, { useState, useMemo } from 'react';
import { 
  Download, FileText, Share2, Globe, CheckCircle2, 
  BookOpen, Printer, Palette, Type, Ruler, Calculator,
  ChevronRight, RefreshCcw, Info, ExternalLink, Shield,
  Image as ImageIcon, Upload, HelpCircle, Sparkles, EyeOff, Eye,
  Wand2, LayoutTemplate, List, Circle, Book
} from 'lucide-react';
import { Project, Chapter, PublishingConfig } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import { generateEpub } from '../lib/epubExport';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface Props {
  project: Project;
  chapters: Chapter[];
  updateProject: (updates: Partial<Project>) => Promise<void>;
  updateChapters?: (chapters: Chapter[]) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const DEFAULT_CONFIG: PublishingConfig = {
  trimSize: '6x9',
  paperType: 'white',
  coverTheme: {
    backgroundColor: '#0a0a0a',
    textColor: '#ffffff',
    fontFamily: 'serif',
    accentColor: '#3b82f6',
    isOverlayHidden: false,
    aiPrompt: '',
    showWraparound: false,
    textShadow: true
  },
  layoutTheme: {
    style: 'standard',
    colorMode: 'bw',
    showIllustrations: true,
    showTextBoxes: true,
    includeIndex: false
  },
  authorName: '',
  subtitle: ''
};

export default function PublishView({ project, chapters, updateProject, updateChapters, onNotify }: Props) {
  const [activeTab, setActiveTab] = useState<'export' | 'designer' | 'layout' | 'kdp' | 'preview' | 'plugins'>('export');
  const [isPublishing, setIsPublishing] = useState(false);
  const [includeIllustrations, setIncludeIllustrations] = useState(true);
  const [illustrationStyle, setIllustrationStyle] = useState<'noir' | 'classic' | 'abstract' | 'blueprint'>('classic');

  
  const [configDraft, setConfigDraft] = useState<PublishingConfig | null>(null);

  const config: PublishingConfig = useMemo(() => {
    const base = configDraft || {
      ...DEFAULT_CONFIG,
      ...(project.publishing || {}),
      coverTheme: {
        ...DEFAULT_CONFIG.coverTheme,
        ...(project.publishing?.coverTheme || {})
      },
      layoutTheme: {
        ...DEFAULT_CONFIG.layoutTheme!,
        ...(project.publishing?.layoutTheme || {})
      }
    };
    return base;
  }, [project.publishing, configDraft]);

  const updateConfig = (updates: Partial<PublishingConfig>) => {
    setConfigDraft({ ...config, ...updates });
  };

  const applyLayoutSettings = async () => {
    if (!configDraft) return;
    setIsPublishing(true);
    try {
      await updateProject({ publishing: configDraft });
      onNotify('Layout architecture applied successfully.', 'success');
      setConfigDraft(null); // Reset draft so it pulls from project
    } catch (e) {
      onNotify('Failed to save layout settings.', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const [synthesisProgress, setSynthesisProgress] = useState<{ current: number; total: number } | null>(null);

  const handleProductionSynthesis = async () => {
    if (exportableChapters.length === 0) {
      onNotify('No narrative chapters identified for production synthesis. Check chapter titles.', 'error');
      return;
    }
    
    setIsPublishing(true);
    setSynthesisProgress({ current: 0, total: exportableChapters.length });
    onNotify('Initiating Multi-Stage Production Sequence. Stand by for narrative synthesis...', 'info');
    
    try {
      // Step 1: Synthesis
      const refinedData = await AIService.synthesizeManuscript(exportableChapters, project);
      setSynthesisProgress(prev => prev ? { ...prev, current: exportableChapters.length } : null);
      onNotify(`Synthesis stage complete. [${refinedData.length} Chapters Unified]. Commencing art direction...`, 'info');

      // Step 2: Illustration Generation (Optional)
      const updatedChaptersWithArt = [];
      for (const chap of chapters) {
        const refined = refinedData.find(r => r.id === chap.id);
        if (refined) {
          let illustrationUrl = chap.illustrationUrl;
          if (includeIllustrations && refined.illustrationPrompt) {
            try {
              onNotify(`Generating illustration for ${chap.title}...`, 'info');
              illustrationUrl = await AIService.generateProductionIllustration(refined.illustrationPrompt, illustrationStyle);
              await new Promise(resolve => setTimeout(resolve, 2000)); // Delay for rate limit
            } catch (err) {
              console.error("Art generation failed:", chap.title, err);
            }
          }
          
          updatedChaptersWithArt.push({ 
            ...chap, 
            content: refined.content, 
            illustrationUrl,
            tags: Array.from(new Set([...(chap.tags || []), 'synthesized', 'production-ready']))
          });
        } else {
          updatedChaptersWithArt.push(chap);
        }
      }

      if (updateChapters) {
        await updateChapters(updatedChaptersWithArt);
        onNotify('Book-leading standards achieved. Manuscript is now in Production Grade.', 'success');
      } else {
        onNotify('Synthesis successful. Chapters updated in local buffer.', 'info');
      }
      
      setActiveTab('preview');
    } catch (e) {
      console.error("Critical Synthesis Failure:", e);
      onNotify('Production sequence aborted. Verify AI model connectivity.', 'error');
    } finally {
      setIsPublishing(false);
      setSynthesisProgress(null);
    }
  };

  const cleanContent = (content: string) => {
    if (!content) return "";
    // Remove common AI chatter at beginning/end
    let cleaned = content
      // Neural artifacts
      .replace(/^(Certainly!|Here is|I've analyzed|Based on|This draft|I have rewritten|Sure, here's|Please find)[^.!?]*[.!?]\s*/i, '')
      .replace(/\s*(I hope this|Let me know if|Does this work|This is the revised|This version address|Let me know how).*$/i, '')
      // Metadata headers
      .replace(/^(REVIEW|CRITIQUE|ANALYSIS|SYNTAX|FACTUAL|LOG|PROMPT|GUIDE|NOTES?):\s*/gi, '')
      .replace(/\s*Chapter\s+\d+:?\s*/i, '') // Remove redundant chapter headers
      .trim();
    
    // Remove sequences markers if present as raw text
    cleaned = cleaned.replace(/Sequence\s+\d+:?\s*/gi, '');
    
    // Remove any [CHAPTER X: TITLE] blocks that might be escaped
    cleaned = cleaned.replace(/\[CHAPTER\s+\d+\s*:\s*.*\]/gi, '');

    return cleaned;
  };

  const exportableChapters = useMemo(() => {
    return chapters
      .filter(c => {
        const title = c.title.toLowerCase();
        
        // Filter out obviously technical nodes, but keep Prologues/Epilogues unless they are purely technical
        const isTechnical = 
               title.includes('critique') || 
               title.includes('review') || 
               title.includes('chat guide') ||
               title.includes('analysis') ||
               title.includes('feedback') ||
               title.includes('prompt') ||
               title.includes('metadata') ||
               title.includes('sequence guide');

        return !isTechnical;
      })
      .sort((a, b) => a.order - b.order);
  }, [chapters]);

  const totalWords = useMemo(() => exportableChapters.reduce((acc, c) => acc + (c.content?.trim().split(/\s+/).filter(t => t.length > 0).length || 0), 0), [exportableChapters]);
  const estPageCount = Math.ceil(totalWords / 300) + 12; // Approx 300 words/page + front matter

  const coverPresets = useMemo(() => {
    const genre = (project.genre || '').toLowerCase();
    
    if (genre.includes('sci-fi') || genre.includes('science fiction') || genre.includes('cyberpunk')) {
      return [
        { label: 'Deep Space', prompt: 'Deep space anomaly, swirling galaxy, cosmic dust, cinematic lighting, sleek sci-fi book cover', colors: { bg: '#020617', text: '#f8fafc', accent: '#38bdf8' } },
        { label: 'Cyberpunk', prompt: 'Cyberpunk city street, neon rain, towering holograms, dark synthwave vibe book cover', colors: { bg: '#09090b', text: '#d946ef', accent: '#0ea5e9' } },
        { label: 'Minimalist Tech', prompt: 'Minimalist tech schematic, clean white and icy blue, abstract geometric shapes, high tech book cover', colors: { bg: '#f8fafc', text: '#0f172a', accent: '#0284c7' } }
      ];
    }
    
    if (genre.includes('fantasy') || genre.includes('magic') || genre.includes('myth')) {
      return [
        { label: 'Epic Landscape', prompt: 'Epic fantasy landscape, towering mountains, golden hour lighting, mystical atmosphere, oil painting style book cover', colors: { bg: '#2d1b0d', text: '#fcd34d', accent: '#fbbf24' } },
        { label: 'Dark Magic', prompt: 'Dark magic grimmoire artifact, glowing runes, deep shadows, purple mist, arcane book cover', colors: { bg: '#1e1b4b', text: '#e0e7ff', accent: '#8b5cf6' } },
        { label: 'High Fantasy', prompt: 'Gleaming white castle in the clouds, pegasus, bright ethereal lighting, majestic book cover', colors: { bg: '#f8fafc', text: '#1e293b', accent: '#d97706' } }
      ];
    }
    
    if (genre.includes('thriller') || genre.includes('mystery') || genre.includes('crime')) {
      return [
        { label: 'Noir Detective', prompt: 'Cinematic noir, urban dark, rainy streets, neon accents, mysterious silhouette book cover', colors: { bg: '#0f172a', text: '#ffffff', accent: '#3b82f6' } },
        { label: 'Psychological', prompt: 'Abstract shattered glass, psychological thriller, stark bold contrast, deep shadow, disturbing book cover', colors: { bg: '#000000', text: '#ffffff', accent: '#dc2626' } },
        { label: 'Cold Case', prompt: 'Frost-covered evidence, cold bleak lighting, isolated cabin, moody crime scene book cover', colors: { bg: '#0c4a6e', text: '#e0f2fe', accent: '#38bdf8' } }
      ];
    }
    
    if (genre.includes('romance') || genre.includes('love')) {
      return [
        { label: 'Contemporary', prompt: 'Warm vibrant sunset, silhouetted couple, pastel skies, romantic contemporary feeling book cover', colors: { bg: '#fff1f2', text: '#881337', accent: '#fb7185' } },
        { label: 'Historical', prompt: 'Regency era ballroom, elegant chandeliers, soft romantic oil painting, opulent book cover', colors: { bg: '#fefce8', text: '#422006', accent: '#ca8a04' } },
        { label: 'Moody Romance', prompt: 'Rainy window pane, soft neon glow, moody atmospheric romance book cover', colors: { bg: '#171717', text: '#fda4af', accent: '#e11d48' } }
      ];
    }
    
    if (genre.includes('horror') || genre.includes('terror')) {
      return [
        { label: 'Gothic Horror', prompt: 'Gothic horror, victorian decay, misty graveyard, charcoal sketch, dark mood book cover', colors: { bg: '#171717', text: '#d4d4d4', accent: '#991b1b' } },
        { label: 'Cosmic Dread', prompt: 'Eldritch cosmic dread, swirling madness, deep oceanic abyss, unsettling geometries book cover', colors: { bg: '#022c22', text: '#a7f3d0', accent: '#10b981' } },
        { label: 'Slasher Retro', prompt: '80s retro slasher horror, neon red title styling, cabin in the woods, VHS aesthetic cover', colors: { bg: '#000000', text: '#fca5a5', accent: '#ef4444' } }
      ];
    }
    
    if (genre.includes('literary') || genre.includes('contemporary') || genre.includes('drama')) {
       return [
         { label: 'Minimalist Abstract', prompt: 'Abstract minimalist art, striking focal point, muted elegant colors, high brow literary fiction cover style, highly polished', colors: { bg: '#fafafa', text: '#171717', accent: '#e11d48' } },
         { label: 'Modern Portrait', prompt: 'Abstract modern portrait, fragmented geometry, soft pastel palettes, literary artsy cover', colors: { bg: '#fdf4ff', text: '#4a044e', accent: '#c026d3' } },
         { label: 'Botanical', prompt: 'Vintage botanical illustration, faded paper texture, elegant literary classical style cover', colors: { bg: '#fefce8', text: '#14532d', accent: '#16a34a' } }
       ];
    }

    // Default presets
    return [
      { label: 'Cinematic Noir', prompt: 'Cinematic noir, urban dark, rainy streets, neon accents, high contrast', colors: { bg: '#0f172a', text: '#ffffff', accent: '#3b82f6' } },
      { label: 'Epic Fantasy', prompt: 'Epic fantasy landscape, golden light, mystical atmosphere, oil painting style', colors: { bg: '#2d1b0d', text: '#fcd34d', accent: '#fbbf24' } },
      { label: 'Minimalist Sci-Fi', prompt: 'Minimalist sci-fi, geometric patterns, clean white and cold blue, technical blueprint', colors: { bg: '#f8fafc', text: '#0f172a', accent: '#0ea5e9' } },
      { label: 'Literary Fiction', prompt: 'Abstract minimalist art, striking focal point, muted elegant colors, high brow literary fiction cover style, highly polished', colors: { bg: '#fafafa', text: '#171717', accent: '#e11d48' } }
    ];
  }, [project.genre]);

  const spineWidth = useMemo(() => {
    const multipliers = {
      white: 0.00225,
      cream: 0.0025,
      color: 0.00235
    };
    return (estPageCount * multipliers[config.paperType as keyof typeof multipliers]).toFixed(3);
  }, [estPageCount, config.paperType]);

  const togglePublicStatus = async () => {
    setIsPublishing(true);
    try {
      const isPublic = !project.isPublic;
      await updateProject({
        isPublic,
        publicId: isPublic ? (project.publicId || crypto.randomUUID()) : project.publicId
      });
      onNotify(isPublic ? 'Manuscript is now LIVE for readers.' : 'Manuscript access restricted.', 'success');
    } catch (e) {
      onNotify('Failed to update publishing status.', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const exportAsMarkdown = () => {
    const fullText = exportableChapters
      .map((c, idx) => {
        const title = c.title.match(/Sequence|Chapter|Section/i) ? `Chapter ${idx + 1}` : c.title;
        return `# ${title}\n\n${cleanContent(c.content)}`;
      })
      .join('\n\n---\n\n');
    
    const blob = new Blob([fullText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}_Manuscript.md`;
    a.click();
  };

  const handleEpubExport = async () => {
    const cleanedChapters = exportableChapters.map((c, idx) => ({
      ...c,
      title: c.title.match(/Sequence|Chapter|Section/i) ? `Chapter ${idx + 1}` : c.title,
      content: cleanContent(c.content)
    }));
    await generateEpub(project, cleanedChapters);
  };

  const handlePDFExport = async () => {
    try {
      onNotify('Initiating production-grade PDF synthesis. This may take a moment for large files...', 'info');
      const element = document.getElementById('manuscript-pdf-content');
      if (!element) return;
      
      // Configure layout options
      let margin: number | [number, number, number, number] = 1;
      let format: string | [number, number] = 'letter';
      
      // Use the component's current config (including drafts)
      const style = config.layoutTheme.style;

      if (style === 'standard') {
        margin = [1.2, 1, 1.2, 1]; // Top, Right, Bottom, Left
        format = [6 * 72, 9 * 72] as [number, number]; // 6x9 inches for novel
      } else if (style === 'coursebook' || style === 'magazine') {
        margin = [1, 1, 1, 1];
        format = 'a4';
      } else {
        margin = [1, 1, 1, 1];
        format = 'letter';
      }
      
      // Explicitly define the options for html2pdf
      const opt = {
        margin: margin,
        filename: `${project.title || 'Manuscript'}_Production.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true, 
          backgroundColor: '#ffffff' 
        },
        jsPDF: { 
          unit: 'in' as const, 
          format: format, 
          orientation: 'portrait' as const 
        },
        pagebreak: { mode: ['css', 'legacy'] }
      };

      await html2pdf().from(element).set(opt).save();
      onNotify('Manuscript successfully transmuted to PDF.', 'success');
    } catch (e: any) {
        console.error("PDF Export error:", e);
        onNotify(`PDF Transmutation failed: ${e.message || 'Check browser permissions'}`, 'error');
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar overscroll-contain pb-32">
      <div className="max-w-6xl mx-auto py-2 md:py-1 px-2 md:px-2 print:p-0 print:max-w-none print:m-0 print:bg-white">
        <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 1.25in;
            size: 8.5in 11in;
          }
          body {
            background: white !important;
            color: black !important;
          }
          #root > div > nav, 
          #root > div > aside, 
          .no-print,
          nav, 
          header, 
          footer {
            display: none !important;
          }
          .print-full-width {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          .manuscript-page {
            page-break-after: always;
            display: block !important;
          }
          .prose {
             font-family: "Cormorant Garamond", serif !important;
             font-size: 12pt !important;
             line-height: 1.5 !important;
             color: black !important;
             max-width: none !important;
          }
          /* Ensure text is black and crisp */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />
      <header className="mb-2 md:mb-1.5 no-print">
        <div className="flex flex-col md:flex-row items-center md:justify-between md:items-end gap-2 md:gap-2 mb-2 md:mb-1.5">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary/10 rounded mb-1.5 md:mb-2 border border-brand-primary/20">
              <Shield size={14} className="text-brand-primary" />
              <span className="text-[10px] md:text-xs font-semibold text-brand-primary uppercase tracking-widest">Caspa Ghost Writer • High-Level Architecture</span>
            </div>
            <h1 className="text-[11px] font-medium md:text-[11px] font-medium font-semibold text-text-primary tracking-tighter italic font-serif leading-none">Draft Transmissions</h1>
          </div>
          
          <div className="flex gap-2 p-2 bg-surface-muted rounded w-full md:w-auto overflow-x-auto custom-scrollbar border border-border-subtle shadow-2xl">
            {(['export', 'preview', 'designer', 'layout', 'plugins', 'kdp'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-[0.2em] transition-all whitespace-nowrap flex-1 md:flex-none relative ${
                  activeTab === tab ? 'btn-nexus-primary shadow-2xl shadow-brand-primary/20' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <span className="relative z-10">
                  {tab === 'kdp' ? 'KDP Logistics' : tab === 'layout' ? 'Layout Engine' : tab === 'plugins' ? 'Finishing Plugins' : tab === 'designer' ? 'Cover Designer' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-1.5">
        <AnimatePresence mode="wait">
          {activeTab === 'export' && (
            <motion.div 
              key="export"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-2 no-print"
            >
              {/* Vitals Side */}
              <div className="md:col-span-1 space-y-3">
                <div className="bg-brand-dark text-white p-4 rounded shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative overflow-hidden border border-border-subtle group">
                  <div className="absolute inset-0 bg-brand-primary opacity-0 group-hover:opacity-[0.02] transition-opacity duration-1000" />
                  <h3 className="text-xs font-semibold text-brand-primary uppercase tracking-widest mb-10">Manuscript Vitals</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] font-medium font-semibold italic font-serif tracking-tighter text-text-primary leading-none mb-2">{totalWords.toLocaleString()}</div>
                      <div className="text-xs font-semibold text-text-secondary uppercase tracking-widest opacity-40">Word Count</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium font-semibold italic font-serif tracking-tighter text-text-primary leading-none mb-2">{estPageCount}</div>
                      <div className="text-xs font-semibold text-text-secondary uppercase tracking-widest opacity-40">Est. Book Pages</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 ethereal-panel border border-border-subtle rounded shadow-xl">
                  <h4 className="text-xs font-semibold text-brand-primary uppercase tracking-widest mb-3">Export Standards</h4>
                  <div className="space-y-5">
                    {[
                      'Standardized Chapter Headings',
                      'UTF-8 Character Encoding',
                      'High-Density Internal Guttering'
                    ].map(std => (
                      <div key={std} className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-widest">
                        <CheckCircle2 size={18} className="text-brand-primary" /> {std}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Column */}
              <div className="md:col-span-2 space-y-3">
                <div className="ethereal-panel p-4 rounded border border-border-subtle shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-[0.06] transition-opacity duration-1000">
                    <Download size={200} className="rotate-12" />
                  </div>
                  <h3 className="text-[11px] font-medium font-semibold text-text-primary mb-10 flex items-center gap-2 italic font-serif relative z-10 tracking-tight">
                    <Download className="text-brand-primary" size={24} />
                    Production Pipeline
                  </h3>
                  
                  <div className="mb-10 relative z-10 space-y-2">
                    <div className="p-4 bg-brand-dark/50 border border-border-subtle rounded space-y-1.5">
                       <h4 className="text-xs font-semibold text-brand-primary uppercase tracking-widest mb-2">Synthesis Protocol</h4>
                       <div className="flex flex-col gap-1.5">
                          <label className="flex items-center gap-1.5 cursor-pointer group">
                             <input 
                                type="checkbox" 
                                checked={includeIllustrations} 
                                onChange={(e) => setIncludeIllustrations(e.target.checked)}
                                className="w-4 h-4 rounded border-border-subtle text-brand-primary focus:ring-brand-primary"
                             />
                             <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary group-hover:text-text-primary transition-colors">Include Digital Illustrations</span>
                          </label>
                          {includeIllustrations && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                               {(['noir', 'classic', 'abstract', 'blueprint', 'venice', 'grok'] as const).map(style => (
                                 <button
                                    key={style}
                                    onClick={() => setIllustrationStyle(style as any)}
                                    className={`px-3 py-2 rounded border text-[10px] font-semibold uppercase tracking-widest transition-all ${
                                      illustrationStyle === style ? 'btn-nexus-primary border-brand-primary' : 'ethereal-panel border-border-subtle text-text-secondary'
                                    }`}
                                 >
                                    {style}
                                 </button>
                               ))}
                            </div>
                          )}
                       </div>
                    </div>

                    <button 
                      onClick={handleProductionSynthesis}
                      disabled={isPublishing}
                      className="w-full py-10 btn-nexus-primary rounded shadow-[0_30px_60px_-12px_rgba(168,85,247,0.5)] hover:scale-[1.01] hover:shadow-[0_45px_90px_-15px_rgba(168,85,247,0.6)] transition-all flex flex-col items-center justify-center gap-2 group/master disabled:opacity-50"
                    >
                       <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center group-hover/master:bg-white/20 transition-all">
                          {isPublishing ? <RefreshCcw size={32} className="animate-spin" /> : <Sparkles size={32} />}
                       </div>
                       <div className="flex flex-col items-center">
                      <span className="text-[12px] font-semibold uppercase tracking-widest mb-1">
                        {isPublishing ? (synthesisProgress ? `Synthesizing [${synthesisProgress.current}/${synthesisProgress.total}]` : 'Synthesizing Book...') : 'Make It Start'}
                      </span>
                      <span className="text-xs opacity-60 font-medium uppercase tracking-widest">
                        {isPublishing ? 'Purging Artifacts & Synthesis Art' : 'Kick off the Production Sequence'}
                      </span>
                       </div>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 relative z-10">
                    <button onClick={exportAsMarkdown} className="p-4 bg-brand-dark rounded border border-border-subtle text-left hover:border-brand-primary/50 transition-all group/btn shadow-xl active:scale-[0.98]">
                      <div className="w-12 h-12 rounded bg-brand-primary/10 flex items-center justify-center mb-2 group-hover/btn:bg-brand-primary transition-colors">
                        <FileText size={24} className="text-brand-primary group-hover/btn:text-white transition-colors" />
                      </div>
                      <div className="text-xs font-semibold text-text-primary uppercase tracking-[0.2em] mb-2">Markdown (.md)</div>
                      <div className="text-xs text-text-secondary font-medium tracking-tight leading-relaxed opacity-50">Industry standard for professional typesetting.</div>
                    </button>
                    <button onClick={() => handleEpubExport()} className="p-4 bg-brand-dark rounded border border-border-subtle text-left hover:border-brand-primary/50 transition-all group/btn shadow-xl active:scale-[0.98]">
                      <div className="w-12 h-12 rounded bg-brand-primary/10 flex items-center justify-center mb-2 group-hover/btn:bg-brand-primary transition-colors">
                        <BookOpen size={24} className="text-brand-primary group-hover/btn:text-white transition-colors" />
                      </div>
                      <div className="text-xs font-semibold text-text-primary uppercase tracking-[0.2em] mb-2">EPUB (Digital)</div>
                      <div className="text-xs text-text-secondary font-medium tracking-tight leading-relaxed opacity-50">Standard format for Kindles and e-readers.</div>
                    </button>
                    <button onClick={() => handlePDFExport()} className="p-4 bg-brand-dark rounded border border-border-subtle text-left hover:border-brand-primary/50 transition-all group/btn shadow-xl active:scale-[0.98] sm:col-span-2 lg:col-span-1">
                      <div className="w-12 h-12 rounded bg-brand-primary/10 flex items-center justify-center mb-2 group-hover/btn:bg-brand-primary transition-colors">
                         <Printer size={24} className="text-brand-primary group-hover/btn:text-white transition-colors" />
                      </div>
                      <div className="text-xs font-semibold text-text-primary uppercase tracking-[0.2em] mb-2">Final PDF</div>
                      <div className="text-xs text-text-secondary font-medium tracking-tight leading-relaxed opacity-50">High-fidelity book layout formatted for physical printing.</div>
                    </button>
                  </div>
                </div>

                <div className="bg-brand-primary p-4 rounded shadow-[0_50px_100px_rgba(168,85,247,0.3)] relative overflow-hidden text-white group cursor-pointer" onClick={togglePublicStatus}>
                  <div className="absolute inset-0 bg-brand-accent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-1.5">
                    <div>
                      <h3 className="text-[11px] font-medium font-semibold italic font-serif mb-2 tracking-tight leading-none">Live Reader Access</h3>
                      <p className="text-white/70 text-[11px] font-medium">Coordinate private, high-level beta reading protocols via external link.</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        className="px-2 py-2 bg-white text-brand-primary rounded-[1.5rem] text-xs font-semibold uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (project.isPublic) {
                             navigator.clipboard.writeText(`${window.location.origin}/?read=${project.id}`);
                             onNotify('Access link decrypted and copied.', 'success');
                          } else {
                             togglePublicStatus();
                          }
                        }}
                      >
                        {project.isPublic ? 'Copy Intelligence URL' : 'Authorize Public Transmission'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'designer' && (
            <motion.div 
              key="designer"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-2 no-print"
            >
              {/* Cover Preview (Left Side) */}
              <div className="lg:col-span-7 flex flex-col items-center gap-2">
                <div className="flex items-center justify-center bg-slate-100/30 rounded p-4 md:p-4 border border-slate-200/50 relative overflow-hidden w-full min-h-[500px]">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
                  
                  <motion.div 
                    layout
                    className="relative shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] transition-all duration-700 flex overflow-hidden rounded-sm z-10"
                    style={{ 
                      width: config.coverTheme.showWraparound ? '100%' : '300px',
                      maxWidth: config.coverTheme.showWraparound ? '600px' : '300px',
                      aspectRatio: config.coverTheme.showWraparound ? '2/1.5' : '1/1.5',
                      backgroundColor: config.coverTheme.backgroundColor 
                    }}
                  >
                    {/* Back Cover (Wraparound mode) */}
                    {config.coverTheme.showWraparound && (
                      <div className="w-[350px] shrink-0 h-full border-r border-white/5 relative overflow-hidden flex flex-col p-4 font-sans z-10">
                         <div className="absolute inset-0 bg-black/40 z-0" />
                         {config.coverTheme.imageUrl && (
                           <img src={config.coverTheme.imageUrl} alt="Back" className="absolute inset-0 w-full h-full object-cover opacity-40 scale-x-[-1] z-[-1]" referrerPolicy="no-referrer" />
                         )}
                         <div className="relative z-10 h-full flex flex-col justify-between">
                            <div className="space-y-2">
                               <div className="h-1 w-12" style={{ backgroundColor: config.coverTheme.accentColor }} />
                               <div 
                                  className="text-xs leading-relaxed font-serif italic max-w-[280px]" 
                                  style={{ color: config.coverTheme.textColor, textShadow: config.coverTheme.textShadow ? '0 2px 4px rgba(0,0,0,0.5)' : 'none' }}>
                                  {project.premise || "A masterpiece in progress. Synthesized using Caspa Ghost Writer protocols."}
                               </div>
                            </div>
                            <div className="mt-auto pt-8 flex items-end justify-between border-t border-white/10">
                               <div className="mt-4 w-16 h-24 bg-white/10 rounded-sm border border-white/20 flex flex-col relative items-center justify-center p-2 shadow-sm">
                                  <div className="absolute top-2 left-2 right-2 h-16 flex flex-col justify-around">
                                    <div className="w-full h-1 bg-black/60"></div>
                                    <div className="w-full h-1 bg-black/60"></div>
                                    <div className="w-10 h-1 bg-black/60"></div>
                                    <div className="w-full h-1 bg-black/60"></div>
                                    <div className="w-8 h-1 bg-black/60"></div>
                                    <div className="w-full h-1 bg-black/60"></div>
                                  </div>
                                </div>
                                <div 
                                  className="text-[10px] font-semibold tracking-widest uppercase opacity-60" 
                                  style={{ color: config.coverTheme.textColor }}>
                                  Caspa Ghost Writer
                                </div>
                            </div>
                         </div>
                      </div>
                    )}

                    {/* Spine */}
                    {config.coverTheme.showWraparound && (
                      <div 
                        className="h-full shadow-[inset_0_0_30px_rgba(0,0,0,0.3)] relative flex items-center justify-center overflow-hidden border-x border-white/10 z-10 shrink-0"
                        style={{ width: `${Math.max(20, parseFloat(spineWidth) * 100)}px`, backgroundColor: config.coverTheme.accentColor }}
                      >
                         <div className="rotate-90 whitespace-nowrap flex items-center gap-1.5">
                            <span 
                               className="text-xs font-semibold uppercase tracking-wider shadow-sm"
                               style={{ color: config.coverTheme.backgroundColor }}>{config.authorName || "Author"}</span>
                            <span 
                               className="text-[12px] font-semibold italic font-serif shadow-md"
                               style={{ color: config.coverTheme.backgroundColor }}>{project.title}</span>
                         </div>
                      </div>
                    )}

                    {/* Front Cover */}
                    <div className={`flex-1 h-full relative overflow-hidden flex flex-col shrink-0`} style={{ width: '350px' }}>
                      {!config.coverTheme.isOverlayHidden && <div className="h-2 w-full shrink-0" style={{ backgroundColor: config.coverTheme.accentColor }} />}
                      <div className="flex-1 flex flex-col items-center justify-between p-4 text-center relative overflow-hidden">
                        {config.coverTheme.imageUrl && (
                          <div className="absolute inset-0 z-0">
                            <img 
                              src={config.coverTheme.imageUrl} 
                              alt="Cover" 
                              className={`w-full h-full object-cover ${config.coverTheme.isOverlayHidden ? 'opacity-100' : 'opacity-60'}`}
                              referrerPolicy="no-referrer"
                            />
                            {!config.coverTheme.isOverlayHidden && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />}
                          </div>
                        )}
                        
                        {!config.coverTheme.isOverlayHidden && (
                          <div className="absolute inset-0 flex flex-col items-center justify-between p-4 text-center z-10">
                            <div className="space-y-2 mt-8">
                              <motion.div 
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="text-xs font-semibold uppercase tracking-widest" 
                                style={{ 
                                  color: config.coverTheme.accentColor,
                                  textShadow: config.coverTheme.textShadow ? '0 2px 4px rgba(0,0,0,0.5)' : 'none'
                                }}
                              >
                                {project.genre || "NARRATIVE TRANSVERSE"}
                              </motion.div>
                              
                              <motion.div 
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className={`text-[11px] font-medium md:text-[11px] font-medium lg:text-[11px] font-medium font-semibold font-serif italic leading-[1.1] tracking-tighter`}
                                style={{ 
                                  color: config.coverTheme.textColor,
                                  textShadow: config.coverTheme.textShadow ? '0 10px 30px rgba(0,0,0,0.8), 0 5px 15px rgba(0,0,0,0.5)' : 'none'
                                }}
                              >
                                {project.title}
                              </motion.div>

                              {config.subtitle && (
                                <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.2 }}
                                  className="text-xs font-medium uppercase tracking-wider opacity-90 max-w-[240px] mx-auto leading-relaxed border-t border-white/10 pt-4"
                                  style={{ 
                                    color: config.coverTheme.textColor,
                                    textShadow: config.coverTheme.textShadow ? '0 4px 10px rgba(0,0,0,0.5)' : 'none'
                                  }}
                                >
                                  {config.subtitle}
                                </motion.div>
                              )}
                            </div>

                            <div className="mt-auto space-y-1.5">
                              <div className="w-12 h-[2px] mx-auto" style={{ backgroundColor: config.coverTheme.accentColor }} />
                              <motion.div 
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-xs font-semibold uppercase tracking-widest" 
                                style={{ 
                                  color: config.coverTheme.textColor,
                                  textShadow: config.coverTheme.textShadow ? '0 4px 12px rgba(0,0,0,0.5)' : 'none'
                                }}
                              >
                                {config.authorName || "Author Name"}
                              </motion.div>
                              
                              <div 
                                className="text-[10px] font-semibold uppercase tracking-widest opacity-40"
                                style={{ color: config.coverTheme.textColor }}
                              >
                                Sovereign Press
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-2 no-print font-sans">
                  <button 
                    onClick={() => updateConfig({ coverTheme: { ...config.coverTheme, isOverlayHidden: !config.coverTheme.isOverlayHidden } })}
                    className={`flex items-center gap-1.5 px-2 py-2 rounded text-xs font-semibold uppercase tracking-widest transition-all ${
                      !config.coverTheme.isOverlayHidden ? 'btn-nexus-primary shadow-xl shadow-brand-primary/30' : 'ethereal-panel border border-border-subtle text-text-secondary'
                    }`}
                  >
                    {!config.coverTheme.isOverlayHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    {config.coverTheme.isOverlayHidden ? 'Show Text Layout' : 'Minimize Overlay'}
                  </button>

                  <button 
                    onClick={() => updateConfig({ coverTheme: { ...config.coverTheme, showWraparound: !config.coverTheme.showWraparound } })}
                    className={`flex items-center gap-1.5 px-2 py-2 rounded text-xs font-semibold uppercase tracking-widest transition-all ${
                      config.coverTheme.showWraparound ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'ethereal-panel border border-border-subtle text-text-secondary'
                    }`}
                  >
                    <BookOpen size={16} />
                    {config.coverTheme.showWraparound ? 'Single Cover View' : 'KDP Wraparound View'}
                  </button>

                  <button 
                    onClick={() => updateConfig({ coverTheme: { ...config.coverTheme, textShadow: !config.coverTheme.textShadow } })}
                    className={`flex items-center gap-1.5 px-2 py-2 rounded text-xs font-semibold uppercase tracking-widest transition-all ${
                      config.coverTheme.textShadow ? 'btn-nexus-primary shadow-xl shadow-brand-primary/30' : 'ethereal-panel border border-border-subtle text-text-secondary'
                    }`}
                  >
                    <Sparkles size={16} />
                    {config.coverTheme.textShadow ? 'High Contrast Mode' : 'Clean Font Mode'}
                  </button>
                </div>
              </div>

              {/* Cover Controls (Right Side) */}
              <div className="lg:col-span-5 grid grid-cols-1 gap-2 no-print p-4 overflow-y-auto max-h-[1000px] custom-scrollbar">
                <section className="p-4 bg-brand-dark border border-border-subtle rounded relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Sparkles size={64} className="text-brand-primary" />
                  </div>
                  <h3 className="text-xs font-semibold text-text-primary uppercase tracking-widest mb-1.5 flex items-center gap-2 relative z-10">
                    <Wand2 size={14} className="text-brand-primary" /> AI Artifact Designer
                  </h3>
                  <p className="text-xs text-text-secondary font-medium mb-2 leading-relaxed relative z-10 font-sans">
                    Generate a fully integrated cover designed by AI. Includes background and typography concepts.
                    <br/><br/>
                    <em className="opacity-70">(Hiding the overlay is recommended for full-width AI designs)</em>
                  </p>
                  <div className="space-y-1.5 relative z-10 font-sans">
                        <div className="w-full overflow-x-auto custom-scrollbar pb-2"><div className="flex gap-2">
                          {coverPresets.map(preset => (
                            <button 
                              key={preset.label}
                              onClick={() => updateConfig({ 
                                coverTheme: { 
                                  ...config.coverTheme, 
                                  aiPrompt: preset.prompt,
                                  backgroundColor: preset.colors.bg,
                                  textColor: preset.colors.text,
                                  accentColor: preset.colors.accent
                                } 
                              })}
                              className="px-3 py-1.5 whitespace-nowrap ethereal-panel border border-border-subtle rounded text-[10px] font-semibold uppercase tracking-widest text-text-secondary hover:text-white hover:border-brand-primary/50 transition-colors"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div></div>
                    <textarea 
                      value={config.coverTheme.aiPrompt}
                      onChange={(e) => updateConfig({ coverTheme: { ...config.coverTheme, aiPrompt: e.target.value } })}
                      placeholder="Describe the mood, theme, and subjects... (e.g. A noir detective in a rain-slicked neon street, pulp fiction style)"
                      className="w-full px-2 py-2 ethereal-panel border border-border-subtle rounded text-xs font-medium text-text-primary focus:ring-2 focus:ring-brand-primary/50 outline-none resize-none min-h-[100px]"
                    />
                    <button 
                      onClick={async () => {
                        setIsPublishing(true);
                        try {
                          onNotify('Refining AI Design Prompt...', 'info');
                          const refinedPrompt = await AIService.generateCoverPrompt(
                            project, 
                            config.authorName || 'Anonymous', 
                            config.subtitle || '', 
                            config.coverTheme.aiPrompt || 'A striking book cover'
                          );
                          
                          onNotify('Synthesizing Visual Artifact (this may take up to 30 seconds)...', 'info');
                          
                          // Use high-quality Gemini Image Generator
                          const dataUrl = await AIService.generateCoverImage(refinedPrompt);
                          
                          updateConfig({ 
                            coverTheme: { 
                              ...config.coverTheme, 
                              imageUrl: dataUrl, 
                              isOverlayHidden: false, // Text is layered ON TOP since Gemini does not generate the text itself
                              aiPrompt: refinedPrompt 
                            } 
                          });
                          onNotify('Cover Artifact successfully generated.', 'success');
                        } catch (e) {
                          console.error("AI Cover Gen Error:", e);
                          onNotify('AI Cover Service is currently congested or your API config is missing.', 'error');
                        } finally {
                          setIsPublishing(false);
                        }
                      }}
                      disabled={isPublishing}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-xs uppercase tracking-widest shadow-xl shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isPublishing ? (
                        <RefreshCcw size={14} className="animate-spin" />
                      ) : (
                        <RefreshCcw size={14} />
                      )}
                      {isPublishing ? 'Synthesizing...' : 'Generate AI Cover Artifact'}
                    </button>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <ImageIcon size={14} /> Manual Assets
                  </h3>
                  <div className="flex flex-col gap-2">
                    {config.coverTheme.imageUrl && (
                      <div className="relative group rounded overflow-hidden aspect-video border border-slate-200">
                        <img src={config.coverTheme.imageUrl} alt="Current Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button 
                          onClick={() => updateConfig({ coverTheme: { ...config.coverTheme, imageUrl: undefined } })}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold uppercase tracking-widest transition-all"
                        >
                          Remove Asset
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2">
                       <label className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-white border border-slate-200 rounded cursor-pointer hover:bg-slate-50 transition-all">
                        <Upload size={16} className="text-slate-600" />
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-600">Update Local Source</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                updateConfig({ coverTheme: { ...config.coverTheme, imageUrl: ev.target?.result as string } });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </section>

                {!config.coverTheme.isOverlayHidden && (
                  <>
                    <section>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Palette size={14} /> Palette & Skin
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Background</label>
                          <input 
                            type="color" 
                            value={config.coverTheme.backgroundColor}
                            onChange={(e) => updateConfig({ coverTheme: { ...config.coverTheme, backgroundColor: e.target.value } })}
                            className="w-full h-12 rounded cursor-pointer border-none p-1 bg-white shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Accent</label>
                          <input 
                            type="color" 
                            value={config.coverTheme.accentColor}
                            onChange={(e) => updateConfig({ coverTheme: { ...config.coverTheme, accentColor: e.target.value } })}
                            className="w-full h-12 rounded cursor-pointer border-none p-1 bg-white shadow-sm"
                          />
                        </div>
                      </div>
                    </section>
    
                    <section>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Type size={14} /> Typography
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Author Name</label>
                          <input 
                            type="text" 
                            value={config.authorName}
                            placeholder="John Doe"
                            onChange={(e) => updateConfig({ authorName: e.target.value })}
                            className="w-full px-2 py-2 bg-white border border-slate-100 rounded text-[11px] font-medium text-slate-900 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Subtitle</label>
                          <input 
                            type="text" 
                            value={config.subtitle}
                            placeholder="A journey through time..."
                            onChange={(e) => updateConfig({ subtitle: e.target.value })}
                            className="w-full px-2 py-2 bg-white border border-slate-100 rounded text-[11px] font-medium text-slate-900 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </section>
                  </>
                )}

                <div className="p-4 bg-brand-dark rounded text-text-primary shadow-2xl border border-brand-primary/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Shield size={18} className="text-brand-primary" />
                    <h4 className="text-[11px] font-semibold uppercase tracking-widest italic font-serif">Cover Deployment Hub</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={applyLayoutSettings}
                      disabled={!configDraft || isPublishing}
                      className={`py-1 rounded font-semibold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                        configDraft 
                          ? 'bg-emerald-600 text-white shadow-xl hover:scale-[1.02]' 
                          : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
                      }`}
                    >
                      {isPublishing ? <RefreshCcw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Commit Cover Design
                    </button>

                    <button 
                      onClick={handleProductionSynthesis}
                      disabled={isPublishing}
                      className="py-1 btn-nexus-primary rounded font-semibold text-xs uppercase tracking-widest shadow-xl shadow-brand-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isPublishing ? <RefreshCcw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      Make It Start
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 font-medium leading-relaxed opacity-50 mb-2">
                    Finalizing the cover locks the visual identity. Synthesis will then purge drafting artifacts from the interior pages to match this professional standard.
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('layout')}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded text-xs font-semibold uppercase tracking-widest transition-all border border-white/5 flex items-center justify-center gap-2"
                    >
                      <LayoutTemplate size={14} /> Tune Layout
                    </button>
                    <button
                      onClick={() => setActiveTab('preview')}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded text-xs font-semibold uppercase tracking-widest transition-all border border-white/5 flex items-center justify-center gap-2"
                    >
                      <Eye size={14} /> Preview Book
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'layout' && (
            <motion.div 
              key="layout"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-2 no-print"
            >
              <div className="space-y-3">
                  <section>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <LayoutTemplate size={14} /> Global Layout Style
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(['standard', 'coursebook', 'manual', 'magazine', 'technical'] as const).map(style => {
                        const isSelected = config.layoutTheme?.style === style;
                        return (
                          <button
                            key={style}
                            onClick={() => {
                              const newLayout = {
                                ...(config.layoutTheme || DEFAULT_CONFIG.layoutTheme!),
                                style
                              };
                              updateConfig({ layoutTheme: newLayout });
                            }}
                            className={`p-4 rounded flex flex-col items-center justify-center gap-1.5 transition-all border ${
                              isSelected 
                                ? 'btn-nexus-primary border-brand-primary shadow-xl shadow-brand-primary/20 scale-[1.02]' 
                                : 'ethereal-panel text-text-secondary border-border-subtle hover:border-brand-primary/50 hover:text-brand-primary'
                            }`}
                          >
                            <span className="text-xs font-semibold uppercase tracking-widest">
                              {style === 'standard' ? 'Novel / Standard' : style}
                            </span>
                            {isSelected && <CheckCircle2 size={12} className="text-white/70" />}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <section>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Palette size={14} /> Color Mode
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {[
                        { id: 'bw' as const, label: 'Black & White', icon: Circle },
                        { id: 'color' as const, label: 'Full Color', icon: Palette }
                      ].map(mode => {
                        const isSelected = config.layoutTheme?.colorMode === mode.id;
                        return (
                          <button
                            key={mode.id}
                            onClick={() => {
                              const newLayout = {
                                ...(config.layoutTheme || DEFAULT_CONFIG.layoutTheme!),
                                colorMode: mode.id
                              };
                              updateConfig({ layoutTheme: newLayout });
                            }}
                            className={`flex-1 p-4 rounded flex flex-col items-center justify-center gap-1.5 transition-all border ${
                              isSelected 
                                ? (mode.id === 'color' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'btn-nexus-primary border-brand-primary shadow-xl')
                                : 'ethereal-panel text-text-secondary border-border-subtle hover:border-brand-primary/50'
                            }`}
                          >
                             <mode.icon size={24} />
                             <span className="text-xs font-semibold uppercase tracking-widest">{mode.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
              </div>

              <div className="space-y-3">
                <section className="ethereal-panel border border-border-subtle p-4 rounded">
                  <h3 className="text-xs font-semibold text-brand-primary uppercase tracking-widest mb-3">Interior Elements</h3>
                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between p-4 bg-surface-muted rounded cursor-pointer hover:bg-surface-hover transition-colors group">
                       <div className="flex items-center gap-2">
                         <div className="p-3 bg-white/5 rounded border border-border-subtle group-hover:border-brand-primary/50 transition-colors">
                           <ImageIcon size={18} className="text-text-secondary" />
                         </div>
                         <div>
                           <span className="text-xs font-medium text-text-primary block">Illustrations & Diagrams</span>
                           <span className="text-xs text-text-secondary leading-relaxed max-w-[200px] block mt-1">Allow spacing for visual assets</span>
                         </div>
                       </div>
                       <input 
                         type="checkbox" 
                         checked={config.layoutTheme?.showIllustrations} 
                         onChange={(e) => {
                           const newLayout = {
                             ...(config.layoutTheme || DEFAULT_CONFIG.layoutTheme!),
                             showIllustrations: e.target.checked
                           };
                           updateConfig({ layoutTheme: newLayout });
                         }}
                         className="w-5 h-5 rounded border-border-subtle text-brand-primary focus:ring-brand-primary focus:ring-offset-surface-card bg-transparent cursor-pointer"
                       />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-surface-muted rounded cursor-pointer hover:bg-surface-hover transition-colors group">
                       <div className="flex items-center gap-2">
                         <div className="p-3 bg-white/5 rounded border border-border-subtle group-hover:border-brand-primary/50 transition-colors">
                           <Type size={18} className="text-text-secondary" />
                         </div>
                         <div>
                           <span className="text-xs font-medium text-text-primary block">Text-box Inlays / Sidebars</span>
                           <span className="text-xs text-text-secondary leading-relaxed max-w-[200px] block mt-1">Format callouts and side-notes</span>
                         </div>
                       </div>
                       <input 
                         type="checkbox" 
                         checked={config.layoutTheme?.showTextBoxes} 
                         onChange={(e) => {
                           const newLayout = {
                             ...(config.layoutTheme || DEFAULT_CONFIG.layoutTheme!),
                             showTextBoxes: e.target.checked
                           };
                           updateConfig({ layoutTheme: newLayout });
                         }}
                         className="w-5 h-5 rounded border-border-subtle text-brand-primary focus:ring-brand-primary focus:ring-offset-surface-card bg-transparent cursor-pointer"
                       />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-surface-muted rounded cursor-pointer hover:bg-surface-hover transition-colors group">
                       <div className="flex items-center gap-2">
                         <div className="p-3 bg-white/5 rounded border border-border-subtle group-hover:border-brand-primary/50 transition-colors">
                           <List size={18} className="text-text-secondary" />
                         </div>
                         <div>
                           <span className="text-xs font-medium text-text-primary block">Generate Index/Glossary</span>
                           <span className="text-xs text-text-secondary leading-relaxed max-w-[200px] block mt-1">Append index at the back</span>
                         </div>
                       </div>
                       <input 
                         type="checkbox" 
                         checked={config.layoutTheme?.includeIndex} 
                         onChange={(e) => {
                           const newLayout = {
                             ...(config.layoutTheme || DEFAULT_CONFIG.layoutTheme!),
                             includeIndex: e.target.checked
                           };
                           updateConfig({ layoutTheme: newLayout });
                         }}
                         className="w-5 h-5 rounded border-border-subtle text-brand-primary focus:ring-brand-primary focus:ring-offset-surface-card bg-transparent cursor-pointer"
                       />
                    </label>
                   </div>
                  <div className="pt-8 border-t border-border-subtle flex flex-col md:flex-row gap-2">
                    <button
                      onClick={applyLayoutSettings}
                      disabled={!configDraft || isPublishing}
                      className={`flex-1 py-1 rounded font-semibold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                        configDraft 
                          ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 hover:scale-[1.02]' 
                          : 'bg-surface-muted text-text-secondary cursor-not-allowed border border-border-subtle'
                      }`}
                    >
                      {isPublishing ? <RefreshCcw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Commit Layout
                    </button>
                    
                    <button 
                      onClick={handleProductionSynthesis}
                      disabled={isPublishing}
                      className="flex-1 py-1 btn-nexus-primary rounded font-semibold text-xs uppercase tracking-widest shadow-xl shadow-brand-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isPublishing ? <RefreshCcw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      Make It Start
                    </button>

                    <button
                      onClick={() => handlePDFExport()}
                      className="flex-1 px-2 py-1 bg-slate-900 border border-slate-800 text-white rounded font-semibold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 shadow-xl"
                    >
                      <Download size={16} />
                      Export Test PDF
                    </button>
                    
                    <button
                      onClick={() => setActiveTab('preview')}
                      className="px-2 py-1 ethereal-panel border border-border-subtle text-text-secondary hover:text-brand-primary rounded font-semibold text-xs uppercase tracking-widest transition-all hover:border-brand-primary/50 flex items-center justify-center gap-1.5"
                    >
                      <Eye size={16} />
                      Preview
                    </button>
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {activeTab === 'preview' && (
            <motion.div 
              key="preview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="lg:col-span-12 space-y-3 print:p-0 print:m-0"
            >
              <div className="flex flex-col md:flex-row items-center justify-between bg-white p-4 rounded border border-slate-100 shadow-sm no-print gap-2">
                <div className="flex items-center gap-2">
                   <div className="p-3 bg-blue-50 text-blue-600 rounded">
                     <FileText size={20} />
                   </div>
                   <div>
                     <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-900">Typeset Preview</h3>
                     <p className="text-xs text-slate-500 font-medium">Visualizing manuscript as a consumer-ready publication.</p>
                   </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                  {configDraft && (
                    <button 
                      onClick={applyLayoutSettings}
                      disabled={isPublishing}
                      className="px-2 py-2 bg-emerald-600 text-white rounded text-xs font-semibold uppercase tracking-widest hover:scale-[1.02] shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 shrink-0"
                    >
                      {isPublishing ? <RefreshCcw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Commit Design
                    </button>
                  )}
                  <button 
                    onClick={handleProductionSynthesis}
                    disabled={isPublishing}
                    className="px-2 py-2 btn-nexus-primary rounded text-xs font-semibold uppercase tracking-widest hover:scale-[1.02] shadow-lg shadow-brand-primary/20 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    {isPublishing ? <RefreshCcw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Make It Start
                  </button>
                  <button 
                    onClick={() => handlePDFExport()}
                    className="px-2 py-2 bg-slate-900 text-white rounded text-xs font-semibold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shrink-0"
                  >
                    <Download size={14} /> Final Export
                  </button>
                </div>
              </div>

              <div id="manuscript-pdf-content" className={`bg-white border border-slate-200/60 rounded md:rounded shadow-2xl overflow-hidden min-h-[400px] md:min-h-[600px] max-h-[800px] overflow-y-auto p-4 md:p-24 ${config.layoutTheme?.colorMode === 'bw' ? 'grayscale border-slate-300' : 'bg-[#fffdfa]'} relative print:max-h-none print:overflow-visible print:shadow-none print:border-none print:p-0 print-full-width ${config.layoutTheme?.style !== 'standard' ? 'max-w-5xl mx-auto' : ''}`}>
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] no-print"></div>
                
                {/* Book Title Page */}
                <div className="text-center py-1 md:py-24 border-b border-slate-100 mb-1.5 md:mb-24 relative z-10 manuscript-page">
                  <h1 className="text-[11px] font-medium md:text-[11px] font-medium font-semibold italic font-serif text-slate-900 mb-1.5 tracking-tighter">{project.title}</h1>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{config.authorName || "Author Name"}</p>
                  
                  {config.layoutTheme?.style === 'coursebook' && (
                    <div className="mt-16 inline-block p-4 bg-slate-50 border border-slate-200 rounded text-left max-w-md mx-auto">
                       <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2 font-sans">Course Material</h3>
                       <p className="text-xs text-slate-600 font-sans leading-relaxed">This edition includes structured layouts, visual hierarchy, and space for margin notes. Ideal for academic or professional study.</p>
                    </div>
                  )}
                  {config.layoutTheme?.style === 'manual' && (
                    <div className="mt-16 inline-block p-4 bg-slate-800 border border-slate-700 rounded text-left max-w-md mx-auto text-white">
                       <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-widest mb-2 font-sans">Training Manual</h3>
                       <p className="text-xs text-slate-300 font-sans leading-relaxed">Structured for quick reference, warnings, and procedures.</p>
                    </div>
                  )}
                </div>

                {/* Chapters */}
                <div className={`relative z-10 print:max-w-none mx-auto space-y-32 ${config.layoutTheme?.style === 'standard' ? 'max-w-2xl' : 'max-w-4xl'}`}>
                  {exportableChapters.map((chapter, idx) => {
                    const title = chapter.title.match(/Sequence|Chapter|Section/i) ? `Chapter ${idx + 1}` : chapter.title;
                    return (
                      <div key={chapter.id} className="space-y-1.5 manuscript-page">
                         <div className={config.layoutTheme?.style !== 'standard' ? 'text-left border-b-4 border-slate-900 pb-6 mb-3' : 'text-center'}>
                            <div className={`text-xs font-semibold uppercase tracking-widest mb-1.5 print:text-slate-400 ${config.layoutTheme?.style !== 'standard' ? 'text-slate-900' : 'text-slate-900/40'}`}>
                              {config.layoutTheme?.style === 'coursebook' ? `Module ${idx + 1}` : config.layoutTheme?.style === 'manual' ? `Section ${idx + 1}` : `Transmission ${idx + 1}`}
                            </div>
                            <h2 className={`font-semibold italic text-slate-900 tracking-tight ${config.layoutTheme?.style !== 'standard' ? 'text-[11px] font-medium font-sans' : 'text-[11px] font-medium font-serif'}`}>{title}</h2>
                            {config.layoutTheme?.style === 'standard' && <div className="w-12 h-[1px] bg-slate-200 mx-auto mt-6"></div>}
                         </div>
                         
                          <div className={`flex ${config.layoutTheme?.style !== 'standard' ? 'flex-col md:flex-row gap-2' : 'flex-col gap-2'}`}>
                            {/* Main Content Area */}
                            <div className="flex-1 space-y-1.5">
                              {chapter.illustrationUrl && config.layoutTheme?.showIllustrations && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 20 }}
                                  whileInView={{ opacity: 1, y: 0 }}
                                  className={`w-full relative rounded overflow-hidden shadow-2xl ${config.layoutTheme?.colorMode === 'bw' ? 'grayscale' : ''}`}
                                >
                                  <img 
                                    src={chapter.illustrationUrl} 
                                    alt={`Illustration for ${title}`} 
                                    className="w-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </motion.div>
                              )}
                              <div className={`prose prose-slate max-w-none text-slate-800 leading-[2] tracking-normal whitespace-pre-wrap ${
                                config.layoutTheme?.style !== 'standard' ? 'font-sans prose-lg' : 'font-serif prose-lg first-letter:text-[11px] font-medium first-letter:font-semibold first-letter:mr-3 first-letter:float-left first-letter:text-slate-900 first-letter:leading-none print:text-justify'
                              }`}>
                                {cleanContent(chapter.content)}
                              </div>
                            </div>
                           
                           {/* Margin Notes Area (Coursebook / Manual only) */}
                           {config.layoutTheme?.style === 'coursebook' && (
                             <div className="w-full md:w-64 shrink-0 border-l-2 border-slate-100 pl-8 space-y-3 hidden md:block">
                                {config.layoutTheme?.showTextBoxes && (
                                  <div className="p-4 bg-slate-50 border border-slate-200/50 rounded">
                                    <h4 className="text-xs font-semibold font-sans uppercase tracking-[0.2em] text-slate-400 mb-2">Key Takeaways</h4>
                                    <div className="h-32 border-b border-dashed border-slate-300"></div>
                                  </div>
                                )}
                                <div className="p-4">
                                  <h4 className="text-xs font-semibold font-sans uppercase tracking-[0.2em] text-slate-400 mb-2">Notes</h4>
                                  <div className="space-y-1.5">
                                    <div className="border-b border-solid border-slate-200"></div>
                                    <div className="border-b border-solid border-slate-200"></div>
                                    <div className="border-b border-solid border-slate-200"></div>
                                    <div className="border-b border-solid border-slate-200"></div>
                                    <div className="border-b border-solid border-slate-200"></div>
                                    <div className="border-b border-solid border-slate-200"></div>
                                  </div>
                                </div>
                                {config.layoutTheme?.showIllustrations && (
                                  <div className="p-4 bg-slate-100 border border-slate-200/50 rounded aspect-[3/4] flex items-center justify-center text-slate-400">
                                    <ImageIcon size={32} opacity={0.3} />
                                  </div>
                                )}
                             </div>
                           )}
                           {config.layoutTheme?.style === 'manual' && config.layoutTheme?.showTextBoxes && (
                              <div className="w-full md:w-64 shrink-0 space-y-3 hidden md:block">
                                <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl">
                                  <h4 className="text-xs font-semibold font-sans uppercase tracking-[0.2em] text-amber-700 mb-2">Caution</h4>
                                  <p className="text-xs text-amber-900">Ensure prerequisite steps are completed.</p>
                                </div>
                              </div>
                           )}
                           {config.layoutTheme?.style === 'magazine' && config.layoutTheme?.showTextBoxes && (
                              <div className="w-full md:w-64 shrink-0 space-y-3 hidden md:block">
                                <div className="p-4 bg-slate-900 border-l-4 border-brand-primary rounded-r-xl text-white">
                                  <h4 className="text-xs font-semibold font-sans uppercase tracking-[0.2em] text-slate-400 mb-3">Pull Quote</h4>
                                  <p className="text-[11px] font-medium font-serif italic text-white leading-relaxed">"The layout engine transforms words into an experience."</p>
                                </div>
                                {config.layoutTheme?.showIllustrations && (
                                  <div className="p-0 bg-slate-100 rounded aspect-[4/3] flex items-center justify-center text-slate-400 overflow-hidden">
                                     <div className="w-full h-full bg-slate-200 animate-pulse"></div>
                                  </div>
                                )}
                              </div>
                           )}
                         </div>
                      </div>
                    );
                  })}
                  
                  {config.layoutTheme?.includeIndex && (
                     <div className="space-y-1.5 manuscript-page mt-32 border-t-8 border-slate-900 pt-16">
                        <h2 className={`font-semibold italic text-slate-900 tracking-tight ${config.layoutTheme?.style !== 'standard' ? 'text-[11px] font-medium font-sans text-left' : 'text-[11px] font-medium font-serif text-center'}`}>Index</h2>
                        <div className="columns-2 md:columns-3 gap-2 text-[11px] font-sans text-slate-600">
                           <div className="mb-1.5"><strong>A</strong><br/>Artifacts, 42<br/>Author, 12</div>
                           <div className="mb-1.5"><strong>L</strong><br/>Layouts, 8<br/>Logic, 101</div>
                           <div className="mb-1.5"><strong>T</strong><br/>Typesetting, 56<br/>Typography, 89</div>
                        </div>
                     </div>
                  )}
                </div>

                <div className="text-center py-24 opacity-20">
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-900">The End</div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'plugins' && (
            <motion.div 
              key="plugins"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-2 no-print"
            >
              <div className="space-y-2">
                <div className="bg-brand-dark p-4 rounded border border-border-subtle shadow-2xl relative overflow-hidden group text-text-primary">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                     <FileText size={80} className="text-brand-primary" />
                   </div>
                   <h3 className="text-[11px] font-medium font-semibold italic font-serif mb-2">NovelCrafter Sync</h3>
                   <p className="text-xs text-brand-primary font-medium uppercase tracking-widest mb-2">Series Bible Integration</p>
                   <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                     Export a structured compatible payload including all Deep Research Notes, Plot Nodes, and Characters to rapidly ingest into NovelCrafter.
                   </p>
                   <button 
                     onClick={async () => {
                       onNotify('Compiling NovelCrafter Blueprint...', 'info');
                       setTimeout(() => {
                         exportAsMarkdown();
                         onNotify('Successfully mapped to NovelCrafter format', 'success');
                       }, 1500)
                     }}
                     className="w-full py-2 ethereal-panel border border-brand-primary/40 hover:border-brand-primary text-brand-primary rounded font-semibold text-xs uppercase tracking-widest transition-all active:scale-95"
                   >
                     Export NC Compatible File
                   </button>
                </div>

                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-4 rounded border border-indigo-800 shadow-2xl relative overflow-hidden group text-white">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                     <Book size={80} className="text-white" />
                   </div>
                   <h3 className="text-[11px] font-medium font-semibold italic font-serif mb-2">Atticus / Vellum Engine</h3>
                   <p className="text-xs text-indigo-300 font-medium uppercase tracking-widest mb-2">Professional Typesetting Routing</p>
                   <p className="text-xs text-indigo-200 mb-3 leading-relaxed">
                     Bypasses the internal layout engine to prepare a cleanly-stripped, tag-free DOCX blueprint optimized directly for Atticus or Vellum ingestion.
                   </p>
                   <button 
                     onClick={async () => {
                        onNotify('Formatting clean .docx payload for Vellum...', 'info');
                        setTimeout(() => {
                           exportAsMarkdown();
                           onNotify('Vellum-Ready file exported.', 'success');
                        }, 1200)
                     }}
                     className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/50 active:scale-95"
                   >
                     Export to Typesetter
                   </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="p-4 bg-[#1e1e1e] border border-[#2d2d2d] rounded flex flex-col gap-2 relative overflow-hidden">
                  <div className="flex items-center gap-2 relative z-10">
                    <div className="w-12 h-12 bg-purple-900/30 border border-purple-500/50 rounded flex items-center justify-center shadow-sm">
                      <svg width="24" height="24" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M222.75 125.75L138.75 41.75C133.09 36.09 123.91 36.09 118.25 41.75L34.25 125.75C28.59 131.41 28.59 140.59 34.25 146.25L118.25 230.25C123.91 235.91 133.09 235.91 138.75 230.25L222.75 146.25C228.41 140.59 228.41 131.41 222.75 125.75Z" stroke="#a855f7" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-widest text-slate-100 italic font-serif">Obsidian Vault Bridge</h4>
                      <p className="text-[10px] text-[#a855f7] font-medium uppercase tracking-widest">Multi-Directional Markdown File Sync</p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-400 relative z-10">
                    Connect this Caspa instance to your local Obsidian folder map. Extracts the Intelligence Graph and Chapters as tightly linked Markdown documents for secondary knowledge graphs.
                  </p>
                  
                  <div className="p-4 bg-black/40 rounded space-y-2 border border-white/5 relative z-10">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                      <span>Vault Connection Status</span>
                      <span className="text-amber-500">AWAITING LOCAL DIRECTORY PATH</span>
                    </div>
                    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full w-1/4 bg-amber-500 animate-pulse" />
                    </div>
                  </div>

                  <button className="w-full py-2 bg-[#a855f7] hover:bg-[#9333ea] text-white rounded font-semibold text-xs uppercase tracking-widest transition-all relative z-10">
                    Link Obsidian Vault
                  </button>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded">
                   <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">BBC Radio 4 Standards</h4>
                   <ul className="space-y-3">
                     {[
                       'Scene descriptions strictly through sound cues',
                       'Dialogue-to-Action ratio optimized for acoustic focus',
                       'Cast size limited for maximum clarity',
                       'Emotional shifts mapped to voice modulation'
                     ].map(rule => (
                       <li key={rule} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                         <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 shrink-0" />
                         {rule}
                       </li>
                     ))}
                   </ul>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'kdp' && (
            <motion.div 
              key="kdp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-2 no-print"
            >
              {/* Calculator View */}
              <div className="space-y-3">
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Calculator size={14} /> Production Settings
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Interior Paper Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['white', 'cream', 'color'] as const).map(type => (
                          <button
                            key={type}
                            onClick={() => updateConfig({ paperType: type })}
                            className={`px-2 py-2 rounded border text-xs font-semibold uppercase tracking-widest transition-all ${
                              config.paperType === type ? 'bg-brand-primary border-brand-primary text-white shadow-lg' : 'bg-surface-muted border-border-subtle text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Trim Size</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['5x8', '5.5x8.5', '6x9', '8.27x11.69'] as const).map(size => (
                          <button
                            key={size}
                            onClick={() => updateConfig({ trimSize: size })}
                            className={`px-2 py-2 rounded border text-xs font-semibold uppercase tracking-widest transition-all ${
                              config.trimSize === size ? 'bg-brand-primary border-brand-primary text-white shadow-lg' : 'bg-surface-muted border-border-subtle text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <div className="bg-slate-900 p-4 rounded border border-slate-800 flex items-center justify-center overflow-hidden shadow-2xl relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Ruler size={40} className="text-white" />
                  </div>
                   <div className="relative z-10">
                      {/* Spine Mockup */}
                      <div className="flex gap-1 items-center">
                        <div className="w-24 h-40 bg-white/5 border border-white/10 rounded-r-md backdrop-blur-sm"></div>
                        <motion.div 
                          initial={false}
                          animate={{ width: Math.max(12, parseFloat(spineWidth) * 100) }}
                          className="h-40 bg-blue-600 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)] flex items-center justify-center transition-all duration-700"
                        >
                           <div className="rotate-90 text-[6px] font-semibold uppercase tracking-widest whitespace-nowrap text-white/50">
                             {project.title}
                           </div>
                        </motion.div>
                        <div className="w-24 h-40 bg-white/5 border border-white/10 rounded-l-md backdrop-blur-sm"></div>
                      </div>
                      <div className="mt-8 text-center">
                        <div className="text-[11px] font-medium font-semibold italic font-serif text-white tracking-tighter">{spineWidth}"</div>
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-widest">Spine Thickness</div>
                      </div>
                   </div>
                </div>
              </div>

              {/* Data Review */}
              <div className="bg-white p-4 rounded border border-slate-100 shadow-sm space-y-3">
                 <div>
                   <h3 className="text-[11px] font-medium font-semibold italic font-serif text-slate-900 mb-2">KDP Layout Specifications</h3>
                   <p className="text-xs text-slate-500 font-medium">Use these values when uploading your files to Amazon Kindle Direct Publishing.</p>
                 </div>

                 <div className="space-y-1.5">
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                       <span className="text-xs font-semibold uppercase text-slate-400 tracking-widest">Page Count</span>
                       <span className="text-[11px] font-semibold text-slate-900">{estPageCount}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                       <span className="text-xs font-semibold uppercase text-slate-400 tracking-widest">Spine Width</span>
                       <span className="text-[11px] font-semibold text-blue-600">{spineWidth} inches</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                       <span className="text-xs font-semibold uppercase text-slate-400 tracking-widest">Full Cover Width</span>
                       <span className="text-[11px] font-semibold text-slate-900">
                         {(parseFloat(config.trimSize.split('x')[0]) * 2 + parseFloat(spineWidth)).toFixed(3)}"
                       </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                       <span className="text-xs font-semibold uppercase text-slate-400 tracking-widest">Bleed Requirements</span>
                       <span className="text-[11px] font-semibold text-amber-600">+0.125" all sides</span>
                    </div>
                 </div>

                 <div className="pt-6">
                    <a 
                      href="https://kdp.amazon.com/en_US/help/topic/G201857950" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-slate-900 text-white rounded flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest hover:bg-slate-800 transition-all"
                    >
                      Open KDP Help Center <ExternalLink size={14} />
                    </a>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Global Notice */}
      <footer className="mt-12 p-4 bg-slate-50 border border-slate-100 rounded flex items-center gap-2 no-print">
         <div className="w-12 h-12 bg-white rounded flex items-center justify-center shadow-sm flex-shrink-0">
           <RefreshCcw size={20} className="text-blue-600" />
         </div>
         <div>
            <h5 className="text-xs font-semibold text-slate-900 uppercase tracking-widest mb-1">Production Consistency</h5>
            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-2xl">
              Calculations are based on Amazon's standard paper thickness. We recommend a 10-page buffer for final layout shifts during interior formatting.
            </p>
         </div>
      </footer>
      </div>
    </div>
  );
}
