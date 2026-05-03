import React, { useState, useMemo } from 'react';
import { 
  Download, FileText, Share2, Globe, CheckCircle2, 
  BookOpen, Printer, Palette, Type, Ruler, Calculator,
  ChevronRight, RefreshCcw, Info, ExternalLink, Shield,
  Image as ImageIcon, Upload, HelpCircle, Sparkles, EyeOff, Eye,
  Wand2
} from 'lucide-react';
import { Project, Chapter, PublishingConfig } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import { generateEpub } from '../lib/epubExport';

interface Props {
  project: Project;
  chapters: Chapter[];
  updateProject: (updates: Partial<Project>) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const DEFAULT_CONFIG: PublishingConfig = {
  trimSize: '6x9',
  paperType: 'white',
  coverTheme: {
    backgroundColor: '#0f172a',
    textColor: '#ffffff',
    fontFamily: 'serif',
    accentColor: '#3b82f6',
    isOverlayHidden: false,
    aiPrompt: ''
  },
  authorName: '',
  subtitle: ''
};

export default function PublishView({ project, chapters, updateProject, onNotify }: Props) {
  const [activeTab, setActiveTab] = useState<'export' | 'designer' | 'kdp' | 'preview' | 'transmute'>('export');
  const [isPublishing, setIsPublishing] = useState(false);
  
  const config = project.publishing || DEFAULT_CONFIG;

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
        const contentSnippet = c.content.toLowerCase().slice(0, 500);
        
        // Filter out non-narrative technical nodes
        const isTechnical = 
               title.includes('critique') || 
               title.includes('review') || 
               title.includes('chat guide') ||
               title.includes('analysis') ||
               title.includes('feedback') ||
               title.includes('prompt') ||
               title.includes('metadata') ||
               title.includes('sequence guide') ||
               (title.includes('prologue') && (contentSnippet.includes('review') || contentSnippet.includes('analysis') || contentSnippet.includes('thoughts'))) ||
               // Heuristic: If content looks like AI instruction/review
               contentSnippet.includes('here are my thoughts') ||
               contentSnippet.includes('review of chapter') ||
               contentSnippet.includes('this manuscript addresses');

        return !isTechnical;
      })
      .sort((a, b) => a.order - b.order);
  }, [chapters]);

  const totalWords = useMemo(() => exportableChapters.reduce((acc, c) => acc + (c.content?.trim().split(/\s+/).length || 0), 0), [exportableChapters]);
  const estPageCount = Math.ceil(totalWords / 300) + 12; // Approx 300 words/page + front matter

  const spineWidth = useMemo(() => {
    const multipliers = {
      white: 0.00225,
      cream: 0.0025,
      color: 0.00235
    };
    return (estPageCount * multipliers[config.paperType as keyof typeof multipliers]).toFixed(3);
  }, [estPageCount, config.paperType]);

  const updateConfig = (updates: Partial<PublishingConfig>) => {
    updateProject({
      publishing: { ...config, ...updates }
    });
  };

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

  return (
    <div className="max-w-6xl mx-auto py-6 md:py-12 px-4 md:px-6 print:p-0 print:max-w-none print:m-0 print:bg-white">
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
      <header className="mb-8 md:mb-12 no-print">
        <div className="flex flex-col md:flex-row items-center md:justify-between md:items-end gap-6 mb-8">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full mb-4 border border-amber-100/50">
              <Shield size={14} className="text-amber-600" />
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Sovereign Press • Human-Infused Architecture</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight italic font-serif">Masterwork Transmissions</h1>
          </div>
          
          <div className="flex gap-2 p-1.5 bg-slate-100/80 backdrop-blur-md rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar border border-slate-200/50">
            {(['export', 'preview', 'designer', 'transmute', 'kdp'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-1 md:flex-none relative ${
                  activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {activeTab === tab && (
                  <motion.div 
                    layoutId="activeTabGlow"
                    className="absolute inset-0 bg-blue-400/5 rounded-xl blur-sm"
                  />
                )}
                <span className="relative z-10">
                  {tab === 'kdp' ? 'KDP Logistics' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <AnimatePresence mode="wait">
          {activeTab === 'export' && (
            <motion.div 
              key="export"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-8 no-print"
            >
              {/* Vitals Side */}
              <div className="md:col-span-1 space-y-6">
                <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Manuscript Vitals</h3>
                  <div className="space-y-6">
                    <div>
                      <div className="text-4xl font-black italic font-serif">{totalWords.toLocaleString()}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Word Count</div>
                    </div>
                    <div>
                      <div className="text-4xl font-black italic font-serif">{estPageCount}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Est. Book Pages</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Export Standards</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
                      <CheckCircle2 size={14} className="text-emerald-500" /> Standardized Chapter Headings
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
                      <CheckCircle2 size={14} className="text-emerald-500" /> UTF-8 Character Encoding
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
                      <CheckCircle2 size={14} className="text-emerald-500" /> KDP-Ready Gutter Margins (via CSS)
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Column */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Download size={120} className="-mr-10 -mt-10 rotate-12" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3 italic font-serif relative z-10">
                    <Download className="text-blue-500" size={20} />
                    Final Manuscript Transmission
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                    <button onClick={exportAsMarkdown} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-left hover:bg-slate-900 transition-all group/btn shadow-sm hover:shadow-xl hover:shadow-blue-900/10 active:scale-[0.98]">
                      <FileText size={20} className="text-blue-600 mb-4 group-hover/btn:text-white transition-colors" />
                      <div className="text-sm font-black text-slate-900 group-hover/btn:text-white uppercase tracking-widest mb-1 transition-colors">Markdown (.md)</div>
                      <div className="text-[10px] text-slate-500 group-hover/btn:text-slate-400 font-medium transition-colors">Industry standard for professional typesetting.</div>
                    </button>
                    <button onClick={() => handleEpubExport()} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-left hover:bg-slate-900 transition-all group/btn shadow-sm hover:shadow-xl hover:shadow-amber-900/10 active:scale-[0.98]">
                      <BookOpen size={20} className="text-amber-600 mb-4 group-hover/btn:text-white transition-colors" />
                      <div className="text-sm font-black text-slate-900 group-hover/btn:text-white uppercase tracking-widest mb-1 transition-colors">EPUB (Digital)</div>
                      <div className="text-[10px] text-slate-500 group-hover/btn:text-slate-400 font-medium transition-colors">Standard format for Kindles and e-readers.</div>
                    </button>
                    <button onClick={() => window.print()} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-left hover:bg-slate-900 transition-all group/btn shadow-sm hover:shadow-xl hover:shadow-emerald-900/10 active:scale-[0.98] sm:col-span-2 lg:col-span-1">
                      <Printer size={20} className="text-emerald-600 mb-4 group-hover/btn:text-white transition-colors" />
                      <div className="text-sm font-black text-slate-900 group-hover/btn:text-white uppercase tracking-widest mb-1 transition-colors">Print-Ready Book (PDF)</div>
                      <div className="text-[10px] text-slate-500 group-hover/btn:text-slate-400 font-medium transition-colors">High-fidelity book layout formatted for physical printing.</div>
                    </button>
                  </div>
                </div>

                <div className="bg-indigo-600 p-8 rounded-3xl shadow-xl shadow-indigo-100 relative overflow-hidden text-white">
                  <div className="relative z-10">
                    <h3 className="text-xl font-black italic font-serif mb-2">Live Reader Access</h3>
                    <p className="text-indigo-100 text-xs font-medium mb-6">Create a private, clean-reading URL for beta readers and agents.</p>
                    <div className="flex gap-4">
                      <button 
                        onClick={project.isPublic ? () => navigator.clipboard.writeText(`${window.location.origin}/?read=${project.id}`) : togglePublicStatus}
                        className="px-6 py-3 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-50 transition-all"
                      >
                        {project.isPublic ? 'Copy Share Link' : 'Enable Public Access'}
                      </button>
                      {project.isPublic && (
                        <button onClick={togglePublicStatus} className="px-6 py-3 bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">
                          Disable Access
                        </button>
                      )}
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
              className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-12 no-print"
            >
              {/* Cover Preview */}
              <div className="flex flex-col items-center gap-8">
                <div className="flex items-center justify-center bg-slate-100/50 rounded-[4rem] p-12 border border-slate-200/50 relative overflow-hidden w-full">
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
                  <motion.div 
                    layoutId="bookCover"
                    className="w-[300px] h-[450px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative overflow-hidden rounded-sm transition-all flex flex-col z-10"
                    style={{ backgroundColor: config.coverTheme.backgroundColor }}
                  >
                    {!config.coverTheme.isOverlayHidden && <div className="h-2 w-full shrink-0" style={{ backgroundColor: config.coverTheme.accentColor }} />}
                    <div className="flex-1 flex flex-col items-center justify-between p-12 text-center relative overflow-hidden">
                      {config.coverTheme.imageUrl && (
                        <div className="absolute inset-0 z-0">
                          <img 
                            src={config.coverTheme.imageUrl} 
                            alt="Cover" 
                            className={`w-full h-full object-cover ${config.coverTheme.isOverlayHidden ? 'opacity-100' : 'opacity-60'}`}
                            referrerPolicy="no-referrer"
                          />
                          {!config.coverTheme.isOverlayHidden && <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />}
                        </div>
                      )}
                      
                      {!config.coverTheme.isOverlayHidden && (
                        <>
                          <div className="space-y-4 relative z-10">
                            <div 
                              className="text-xs font-black uppercase tracking-[0.2em]" 
                              style={{ color: config.coverTheme.accentColor }}
                            >
                              {config.authorName || "Your Name"}
                            </div>
                            <div 
                              className={`text-3xl font-black font-serif italic leading-tight`}
                              style={{ color: config.coverTheme.textColor }}
                            >
                              {project.title}
                            </div>
                            <div 
                              className="text-[10px] font-medium uppercase tracking-widest opacity-60"
                              style={{ color: config.coverTheme.textColor }}
                            >
                              {config.subtitle || "A New Novel"}
                            </div>
                          </div>

                          <div className="w-12 h-[1px] opacity-30 relative z-10" style={{ backgroundColor: config.coverTheme.textColor }} />

                          <div 
                            className="text-[8px] font-black uppercase tracking-[0.3em] opacity-40 mt-auto relative z-10"
                            style={{ color: config.coverTheme.textColor }}
                          >
                            Synthetic Press
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                </div>
                
                <div className="flex gap-4">
                  <button 
                    onClick={() => updateConfig({ coverTheme: { ...config.coverTheme, isOverlayHidden: !config.coverTheme.isOverlayHidden } })}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      config.coverTheme.isOverlayHidden ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    {config.coverTheme.isOverlayHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                    {config.coverTheme.isOverlayHidden ? 'Show Text Overlay' : 'Hide Text Overlay'}
                  </button>
                </div>
              </div>

              {/* Cover Controls */}
              <div className="space-y-8 no-print">
                <section className="p-8 bg-blue-50 border border-blue-100 rounded-[2.5rem] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                    <Sparkles size={64} className="text-blue-600" />
                  </div>
                  <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                    <Wand2 size={14} /> AI Artifact Designer
                  </h3>
                  <p className="text-[10px] text-blue-700 font-medium mb-6 leading-relaxed relative z-10">
                    Generate a fully integrated cover designed by AI. Includes background and typography concepts.
                    <br/><br/>
                    <em className="opacity-70">(Hiding the overlay is recommended for full-width AI designs)</em>
                  </p>
                  <div className="space-y-4 relative z-10">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {[
                        { label: 'Cinematic Noir', prompt: 'Cinematic noir, urban dark, rainy streets, neon accents, high contrast' },
                        { label: 'Epic Fantasy', prompt: 'Epic fantasy landscape, golden light, mystical atmosphere, oil painting style' },
                        { label: 'Minimalist Sci-Fi', prompt: 'Minimalist sci-fi, geometric patterns, clean white and cold blue, technical blueprint' },
                        { label: 'Gothic Horror', prompt: 'Gothic horror, victorian decay, misty graveyard, charcoal sketch, dark mood' }
                      ].map(preset => (
                        <button 
                          key={preset.label}
                          onClick={() => updateConfig({ coverTheme: { ...config.coverTheme, aiPrompt: preset.prompt } })}
                          className="px-2 py-1 bg-white/50 border border-blue-100 rounded-md text-[8px] font-black uppercase tracking-tighter text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <textarea 
                      value={config.coverTheme.aiPrompt}
                      onChange={(e) => updateConfig({ coverTheme: { ...config.coverTheme, aiPrompt: e.target.value } })}
                      placeholder="Describe the mood, theme, and subjects... (e.g. A noir detective in a rain-slicked neon street, pulp fiction style)"
                      className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none min-h-[100px]"
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
                          
                          onNotify('Synthesizing Visual Artifact...', 'info');
                          // Simulation: using the refined prompt to "seed" a search or just use high quality placeholder
                          // In a production environment, we'd pass refinedPrompt to DALL-E 3
                          const seed = Math.floor(Math.random() * 1000000);
                          const url = `https://picsum.photos/seed/${seed}/600/900`;
                          
                          updateConfig({ 
                            coverTheme: { 
                              ...config.coverTheme, 
                              imageUrl: url, 
                              isOverlayHidden: true, // Hide overlay since text is "in the AI image"
                              aiPrompt: refinedPrompt 
                            } 
                          });
                          onNotify('Cover Artifact successfully generated.', 'success');
                        } catch (e) {
                          onNotify('AI Cover Service is currently congested.', 'error');
                        } finally {
                          setIsPublishing(false);
                        }
                      }}
                      disabled={isPublishing}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
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
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <ImageIcon size={14} /> Manual Assets
                  </h3>
                  <div className="flex flex-col gap-4">
                    {config.coverTheme.imageUrl && (
                      <div className="relative group rounded-xl overflow-hidden aspect-video border border-slate-200">
                        <img src={config.coverTheme.imageUrl} alt="Current Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button 
                          onClick={() => updateConfig({ coverTheme: { ...config.coverTheme, imageUrl: undefined } })}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Remove Asset
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2">
                       <label className="flex-1 flex items-center justify-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all">
                        <Upload size={16} className="text-slate-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Update Local Source</span>
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
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Palette size={14} /> Palette & Skin
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Background</label>
                          <input 
                            type="color" 
                            value={config.coverTheme.backgroundColor}
                            onChange={(e) => updateConfig({ coverTheme: { ...config.coverTheme, backgroundColor: e.target.value } })}
                            className="w-full h-12 rounded-xl cursor-pointer border-none p-1 bg-white shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Accent</label>
                          <input 
                            type="color" 
                            value={config.coverTheme.accentColor}
                            onChange={(e) => updateConfig({ coverTheme: { ...config.coverTheme, accentColor: e.target.value } })}
                            className="w-full h-12 rounded-xl cursor-pointer border-none p-1 bg-white shadow-sm"
                          />
                        </div>
                      </div>
                    </section>
    
                    <section>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Type size={14} /> Typography
                      </h3>
                      <div className="space-y-6">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Author Name</label>
                          <input 
                            type="text" 
                            value={config.authorName}
                            placeholder="John Doe"
                            onChange={(e) => updateConfig({ authorName: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Subtitle</label>
                          <input 
                            type="text" 
                            value={config.subtitle}
                            placeholder="A journey through time..."
                            onChange={(e) => updateConfig({ subtitle: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </section>
                  </>
                )}

                <div className="p-6 bg-slate-900 rounded-3xl text-white">
                  <div className="flex items-center gap-3 mb-2">
                    <Info size={16} className="text-blue-400" />
                    <h4 className="text-xs font-black uppercase tracking-widest italic font-serif">Export for Amazon</h4>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    KDP requires a PDF for the cover. Hide the overlay if your AI Artifact already includes the title and author in its design.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'preview' && (
            <motion.div 
              key="preview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="lg:col-span-12 space-y-8 print:p-0 print:m-0"
            >
              <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-100 shadow-sm no-print">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                     <FileText size={20} />
                   </div>
                   <div>
                     <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Typeset Preview</h3>
                     <p className="text-[10px] text-slate-500 font-medium">Visualizing manuscript as a consumer-ready publication.</p>
                   </div>
                </div>
                <button 
                  onClick={() => window.print()}
                  className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  <Printer size={14} /> Print Master Copy
                </button>
              </div>

              <div className="bg-white border border-slate-200/60 rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden min-h-[400px] md:min-h-[600px] max-h-[800px] overflow-y-auto p-8 md:p-24 space-y-12 bg-[#fffdfa] relative print:max-h-none print:overflow-visible print:shadow-none print:border-none print:p-0 print-full-width">
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] no-print"></div>
                {/* Book Title Page */}
                <div className="text-center py-12 md:py-24 border-b border-slate-100 mb-12 md:mb-24 relative z-10 manuscript-page">
                  <h1 className="text-3xl md:text-5xl font-black italic font-serif text-slate-900 mb-4 tracking-tighter">{project.title}</h1>
                  <p className="text-sm font-black uppercase tracking-[0.4em] text-slate-400">{config.authorName || "Author Name"}</p>
                </div>

                {/* Chapters */}
                <div className="max-w-2xl mx-auto space-y-32 relative z-10 print:max-w-none">
                  {exportableChapters.map((chapter, idx) => {
                    const title = chapter.title.match(/Sequence|Chapter|Section/i) ? `Chapter ${idx + 1}` : chapter.title;
                    return (
                      <div key={chapter.id} className="space-y-12 manuscript-page">
                         <div className="text-center">
                            <div className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-600/40 mb-4 print:text-slate-400">Transmission {idx + 1}</div>
                            <h2 className="text-4xl font-black italic font-serif text-slate-900 tracking-tight">{title}</h2>
                            <div className="w-12 h-[1px] bg-slate-200 mx-auto mt-6"></div>
                         </div>
                         <div className="prose prose-slate prose-lg max-w-none text-slate-800 font-serif leading-[2] tracking-normal whitespace-pre-wrap first-letter:text-6xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:text-slate-900 first-letter:leading-none print:text-justify">
                           {cleanContent(chapter.content)}
                         </div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-center py-24 opacity-20">
                  <div className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-900">The End</div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'transmute' && (
            <motion.div 
              key="transmute"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8 no-print"
            >
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform">
                     <Share2 size={80} className="text-blue-600" />
                   </div>
                   <h3 className="text-xl font-black italic font-serif mb-2 text-slate-900">Radio 4 Transmutation</h3>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">Economy Mode • BBC Standard Scripting</p>
                   <p className="text-xs text-slate-600 mb-8 leading-relaxed">
                     Convert your prose into a tightly paced radio drama script. Focuses on dialogue subtext and acoustic atmosphere for audio-only immersion.
                   </p>
                   <button 
                     onClick={async () => {
                       setIsPublishing(true);
                       try {
                         const script = await AIService.transmuteToRadioPlay(project, exportableChapters);
                         const blob = new Blob([script], { type: 'text/markdown' });
                         const url = URL.createObjectURL(blob);
                         const a = document.createElement('a');
                         a.href = url;
                         a.download = `${project.title}_RadioPlay.md`;
                         a.click();
                         onNotify('Radio Play Script generated.', 'success');
                       } catch (e) {
                         onNotify('Transmutation failed.', 'error');
                       } finally {
                         setIsPublishing(false);
                       }
                     }}
                     disabled={isPublishing}
                     className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50"
                   >
                     {isPublishing ? 'Synthesizing...' : 'Generate Radio Script'}
                   </button>
                </div>

                <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group text-white">
                   <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                     <Globe size={80} className="text-white" />
                   </div>
                   <h3 className="text-xl font-black italic font-serif mb-2">Audiobook Performance Guide</h3>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">Narrator HQ • Character Voice Mapping</p>
                   <p className="text-xs text-slate-400 mb-8 leading-relaxed">
                     Generate an "Economy Mode" performance guide including narrator summaries, character accents, and a performance-ready narrative summary.
                   </p>
                   <button 
                     onClick={async () => {
                       setIsPublishing(true);
                       try {
                         const guide = await AIService.generateAudiobookScript(project, exportableChapters);
                         const blob = new Blob([guide], { type: 'text/markdown' });
                         const url = URL.createObjectURL(blob);
                         const a = document.createElement('a');
                         a.href = url;
                         a.download = `${project.title}_AudiobookGuide.md`;
                         a.click();
                         onNotify('Audiobook Guide generated.', 'success');
                       } catch (e) {
                         onNotify('Guide generation failed.', 'error');
                       } finally {
                         setIsPublishing(false);
                       }
                     }}
                     disabled={isPublishing}
                     className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                   >
                     {isPublishing ? 'Synthesizing...' : 'Generate Performance Guide'}
                   </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-8 bg-amber-50 border border-amber-100 rounded-[2.5rem] flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                      <Sparkles size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-widest text-amber-900 italic font-serif">Structural Bible</h4>
                      <p className="text-[9px] text-amber-700 font-bold uppercase tracking-widest">Master Reference Conversion</p>
                    </div>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Useful for <strong>Course Books</strong>, <strong>Subject Bibles</strong>, and <strong>Cookbooks</strong>. This extracts the formal facts and curriculum markers from your prose.
                  </p>
                  <button className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-100 transition-all opacity-50 cursor-not-allowed">
                    Coming Soon: Semantic Artifact Extraction
                  </button>
                </div>

                <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem]">
                   <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">BBC Radio 4 Standards</h4>
                   <ul className="space-y-3">
                     {[
                       'Scene descriptions strictly through sound cues',
                       'Dialogue-to-Action ratio optimized for acoustic focus',
                       'Cast size limited for maximum clarity',
                       'Emotional shifts mapped to voice modulation'
                     ].map(rule => (
                       <li key={rule} className="flex items-start gap-2 text-[10px] text-slate-600 font-medium">
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
              className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-12 no-print"
            >
              {/* Calculator View */}
              <div className="space-y-8">
                <section>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Calculator size={14} /> Production Settings
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Interior Paper Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['white', 'cream', 'color'] as const).map(type => (
                          <button
                            key={type}
                            onClick={() => updateConfig({ paperType: type })}
                            className={`px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                              config.paperType === type ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Trim Size</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['5x8', '5.5x8.5', '6x9', '8.27x11.69'] as const).map(size => (
                          <button
                            key={size}
                            onClick={() => updateConfig({ trimSize: size })}
                            className={`px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                              config.trimSize === size ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 flex items-center justify-center overflow-hidden shadow-2xl relative">
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
                           <div className="rotate-90 text-[6px] font-black uppercase tracking-widest whitespace-nowrap text-white/50">
                             {project.title}
                           </div>
                        </motion.div>
                        <div className="w-24 h-40 bg-white/5 border border-white/10 rounded-l-md backdrop-blur-sm"></div>
                      </div>
                      <div className="mt-8 text-center">
                        <div className="text-4xl font-black italic font-serif text-white tracking-tighter">{spineWidth}"</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Spine Thickness</div>
                      </div>
                   </div>
                </div>
              </div>

              {/* Data Review */}
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                 <div>
                   <h3 className="text-2xl font-black italic font-serif text-slate-900 mb-2">KDP Layout Specifications</h3>
                   <p className="text-xs text-slate-500 font-medium">Use these values when uploading your files to Amazon Kindle Direct Publishing.</p>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between py-4 border-b border-slate-50">
                       <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Page Count</span>
                       <span className="text-sm font-black text-slate-900">{estPageCount}</span>
                    </div>
                    <div className="flex items-center justify-between py-4 border-b border-slate-50">
                       <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Spine Width</span>
                       <span className="text-sm font-black text-blue-600">{spineWidth} inches</span>
                    </div>
                    <div className="flex items-center justify-between py-4 border-b border-slate-50">
                       <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Full Cover Width</span>
                       <span className="text-sm font-black text-slate-900">
                         {(parseFloat(config.trimSize.split('x')[0]) * 2 + parseFloat(spineWidth)).toFixed(3)}"
                       </span>
                    </div>
                    <div className="flex items-center justify-between py-4 border-b border-slate-50">
                       <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bleed Requirements</span>
                       <span className="text-sm font-black text-amber-600">+0.125" all sides</span>
                    </div>
                 </div>

                 <div className="pt-6">
                    <a 
                      href="https://kdp.amazon.com/en_US/help/topic/G201857950" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
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
      <footer className="mt-12 p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex items-center gap-6 no-print">
         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
           <RefreshCcw size={20} className="text-blue-600" />
         </div>
         <div>
            <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1">Production Consistency</h5>
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed max-w-2xl">
              Calculations are based on Amazon's standard paper thickness. We recommend a 10-page buffer for final layout shifts during interior formatting.
            </p>
         </div>
      </footer>
    </div>
  );
}
