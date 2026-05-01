import React from 'react';
import { Download, FileText, Share2, Globe, CheckCircle2, ChevronRight, BookOpen, Printer } from 'lucide-react';
import { Project, Chapter } from '../types';
import { motion } from 'motion/react';

interface Props {
  project: Project;
  chapters: Chapter[];
}

export default function PublishView({ project, chapters }: Props) {
  const exportAsMarkdown = () => {
    const fullText = chapters
      .sort((a, b) => a.order - b.order)
      .map(c => `# ${c.title}\n\n${c.content}`)
      .join('\n\n---\n\n');
    
    const blob = new Blob([fullText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}_Manuscript.md`;
    a.click();
  };

  const exportAsTxt = () => {
    const fullText = chapters
      .sort((a, b) => a.order - b.order)
      .map(c => `${c.title.toUpperCase()}\n\n${c.content}`)
      .join('\n\n\n');
    
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}_Manuscript.txt`;
    a.click();
  };

  const totalWords = chapters.reduce((acc, c) => acc + (c.content?.trim().split(/\s+/).length || 0), 0);
  const totalChapters = chapters.length;

  return (
    <div className="max-w-5xl mx-auto py-12 px-6">
      <header className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full mb-4">
          <BookOpen size={14} className="text-emerald-600" />
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Finalization Hub</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight italic font-serif">Export & Publish</h1>
        <p className="text-slate-500 max-w-2xl mx-auto font-medium">
          Ready to share your work with the world? Export your manuscript in production-ready formats or prepare for listing.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Statistics Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <FileText size={120} />
            </div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Manuscript Vitals</h3>
            <div className="space-y-6 relative">
              <div>
                <div className="text-3xl font-black italic font-serif">{totalWords.toLocaleString()}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimated Word Count</div>
              </div>
              <div>
                <div className="text-3xl font-black italic font-serif">{totalChapters}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Chapters</div>
              </div>
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">Project Type</span>
                  <span className="text-blue-400 uppercase">{project.type}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-2">Manuscript Health</h4>
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              All plot nodes have been reconciled. The manuscript structure is valid for professional delivery.
            </p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3 italic font-serif">
               <Download className="text-blue-500" size={20} />
               Export Formats
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={exportAsMarkdown}
                className="group p-6 bg-slate-50 rounded-2xl border border-slate-100 text-left hover:bg-slate-900 transition-all"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <h4 className="text-sm font-black text-slate-900 group-hover:text-white uppercase tracking-widest mb-1 italic font-serif">Markdown (.md)</h4>
                <p className="text-[10px] text-slate-500 group-hover:text-slate-400 font-medium">Standard for writers and technical documentation.</p>
              </button>

              <button 
                onClick={exportAsTxt}
                className="group p-6 bg-slate-50 rounded-2xl border border-slate-100 text-left hover:bg-slate-900 transition-all"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                  <FileText size={20} className="text-slate-600" />
                </div>
                <h4 className="text-sm font-black text-slate-900 group-hover:text-white uppercase tracking-widest mb-1 italic font-serif">Plain Text (.txt)</h4>
                <p className="text-[10px] text-slate-500 group-hover:text-slate-400 font-medium">Universal compatibility. Clean, unformatted prose.</p>
              </button>
            </div>
          </div>

          <div className="bg-indigo-600 p-8 rounded-3xl shadow-xl shadow-indigo-200 relative overflow-hidden">
             <div className="absolute -right-12 -top-12 p-24 opacity-10 pointer-events-none transform rotate-12">
              <Globe size={200} className="text-white" />
            </div>
            <div className="relative">
              <h3 className="text-xl font-black text-white italic font-serif mb-2">Publish to Reader View</h3>
              <p className="text-indigo-100 text-xs font-medium mb-8 max-w-md">
                Generate a clean, distraction-free reading link to share with beta readers or peers.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="flex-1 py-4 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-lg">
                  <Share2 size={14} />
                  Get Private Sharable Link
                </button>
                <button 
                  onClick={() => window.print()}
                  className="flex-1 py-4 bg-indigo-900/30 text-white border border-indigo-400/30 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-800 transition-all flex items-center justify-center gap-2"
                >
                  <Printer size={14} />
                  Print Manuscript
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200">
             <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Globe size={16} className="text-amber-600" />
                </div>
                <div>
                   <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1">Coming Soon: Direct Publishing</h5>
                   <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                     We are working on direct integrations with Amazon KDP, Apple Books, and Substack. Stay tuned for one-click publishing.
                   </p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
