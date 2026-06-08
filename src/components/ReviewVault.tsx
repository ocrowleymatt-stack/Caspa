/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Plus, Trash2, CheckCircle, Globe, Filter, MessageSquare, Clipboard, Star, Calendar, ExternalLink } from 'lucide-react';
import { Project, ExternalReview } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  project: Project;
  reviews: ExternalReview[];
  onUpsert: (review: ExternalReview) => void;
  onDelete: (id: string) => void;
}

export default function ReviewVault({ project, reviews, onUpsert, onDelete }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newReview, setNewReview] = useState<Partial<ExternalReview>>({
    source: '',
    content: '',
    score: 0,
    isImplemented: false
  });

  const filteredReviews = reviews.filter(r => 
    r.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    if (!newReview.source || !newReview.content) return;
    onUpsert({
      id: `review_${crypto.randomUUID()}`,
      source: newReview.source,
      content: newReview.content,
      score: newReview.score,
      date: Date.now(),
      isImplemented: false
    });
    setNewReview({ source: '', content: '', score: 0, isImplemented: false });
    setIsAdding(false);
  };

  const toggleImplemented = (review: ExternalReview) => {
    onUpsert({ ...review, isImplemented: !review.isImplemented });
  };

  return (
    <div className="h-full flex flex-col gap-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-text-primary mb-1 italic font-serif">Review Vault</h2>
          <p className="text-[10px] text-text-secondary font-black uppercase tracking-[0.2em] opacity-50">External feedback and critical ingestion.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-brand-primary" size={14} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search feedback..."
              className="pl-10 pr-4 py-2 bg-surface-muted border border-border-subtle rounded-xl text-[10px] font-bold text-text-primary outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all w-64"
            />
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="px-6 py-2 bg-brand-primary hover:bg-brand-accent text-white font-black text-[10px] rounded-xl transition-all shadow-xl shadow-brand-primary/20 flex items-center gap-2 uppercase tracking-widest active:scale-95"
          >
            <Plus size={14} />
            Ingest Review
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
        {/* Review List */}
        <div className="lg:col-span-2 overflow-y-auto overscroll-contain space-y-4 pr-2 custom-scrollbar pb-32">
          <AnimatePresence mode="popLayout">
            {isAdding && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-brand-dark border border-brand-primary/20 rounded-[2rem] p-8 mb-6 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                  <MessageSquare size={80} />
                </div>
                <div className="space-y-6 relative z-10">
                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-brand-primary tracking-widest pl-1">Source / Lens</label>
                        <input 
                          value={newReview.source}
                          onChange={(e) => setNewReview({ ...newReview, source: e.target.value })}
                          placeholder="e.g. Literary Agent, Beta Reader..."
                          className="w-full ethereal-panel border border-border-subtle rounded-xl px-4 py-3 text-xs font-bold text-text-primary outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-brand-primary tracking-widest pl-1">Score / Weight (Optional)</label>
                        <input 
                          type="number"
                          value={newReview.score}
                          onChange={(e) => setNewReview({ ...newReview, score: parseInt(e.target.value) })}
                          placeholder="0-100"
                          className="w-full ethereal-panel border border-border-subtle rounded-xl px-4 py-3 text-xs font-bold text-text-primary outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                        />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-brand-primary tracking-widest pl-1">Observation / Critique</label>
                      <textarea 
                        value={newReview.content}
                        onChange={(e) => setNewReview({ ...newReview, content: e.target.value })}
                        placeholder="Paste the review or notes here..."
                        className="w-full h-32 ethereal-panel border border-border-subtle rounded-xl px-4 py-3 text-xs font-medium text-text-primary outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all resize-none italic leading-relaxed"
                      />
                   </div>
                   <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setIsAdding(false)}
                        className="px-6 py-2 text-text-secondary hover:text-text-primary font-black text-[10px] uppercase tracking-widest transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleAdd}
                        className="px-8 py-2 bg-brand-primary hover:bg-brand-accent text-white font-black text-[10px] rounded-xl transition-all shadow-xl shadow-brand-primary/20 uppercase tracking-widest active:scale-95"
                      >
                        Save to Vault
                      </button>
                   </div>
                </div>
              </motion.div>
            )}

            {filteredReviews.length > 0 ? filteredReviews.map((r, i) => (
              <motion.div 
                key={r.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                layout
                className={`group ethereal-panel border rounded-[2rem] p-8 shadow-sm hover:shadow-2xl transition-all relative overflow-hidden ${r.isImplemented ? 'border-emerald-500/20 bg-brand-dark/50 opacity-60' : 'border-border-subtle hover:border-brand-primary/30'}`}
              >
                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl transition-all ${r.isImplemented ? 'bg-emerald-500/10 text-emerald-500' : 'bg-surface-muted text-brand-primary group-hover:scale-110'}`}>
                      <Clipboard size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-text-primary text-sm uppercase tracking-widest flex items-center gap-2">
                        {r.source}
                        {r.isImplemented && <CheckCircle size={14} className="text-emerald-500" />}
                      </h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-text-secondary font-black uppercase tracking-widest opacity-50">{new Date(r.date).toLocaleDateString()}</span>
                        {r.score !== undefined && (
                          <div className="flex items-center gap-1 text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                             <Star size={10} className="fill-current" />
                             {r.score}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleImplemented(r)}
                      title={r.isImplemented ? 'Mark as active' : 'Mark as implemented'}
                      className={`p-2.5 rounded-xl transition-all border ${r.isImplemented ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-surface-muted text-text-secondary hover:text-emerald-500 hover:border-emerald-500/20 border-border-subtle'}`}
                    >
                      <CheckCircle size={18} />
                    </button>
                    <button 
                      onClick={() => onDelete(r.id)}
                      className="p-2.5 bg-surface-muted text-text-secondary hover:text-red-500 rounded-xl transition-all border border-border-subtle hover:border-red-500/20"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="relative z-10">
                  <div className={`text-text-primary text-base leading-relaxed font-serif italic border-l-4 pl-6 transition-all ${r.isImplemented ? 'border-emerald-500/20 line-through text-text-secondary opacity-50' : 'border-brand-primary/30'}`}>
                    "{r.content}"
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-20 border-2 border-dashed border-border-subtle rounded-[3rem] text-text-secondary ethereal-panel shadow-inner">
                <Clipboard size={64} strokeWidth={0.5} className="opacity-10 mb-6" />
                <div>
                  <p className="text-xl font-black text-text-primary font-serif italic mb-2 tracking-tight">Vault Empty</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-40">Ingest agent or beta reader feedback here.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Strategies Sidebar */}
        <div className="space-y-8 overflow-y-auto overscroll-contain custom-scrollbar pb-32 pr-2">
           <section className="bg-brand-dark text-text-primary rounded-[2rem] p-8 shadow-2xl border border-border-subtle relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:rotate-12 transition-all duration-700">
                <Globe size={120} />
              </div>
              <header className="relative mb-6">
                <h3 className="text-lg font-black italic font-serif flex items-center gap-2">
                  <Star className="text-amber-500" size={18} />
                  Intelligence Sync
                </h3>
              </header>
              <p className="text-xs text-text-secondary leading-relaxed mb-8 relative font-medium italic">
                External reviews are automatically integrated into the AI's drafting context. The engine will prioritize resolving high-weight critical observations.
              </p>
              <div className="space-y-4 relative">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-text-secondary opacity-50">Implementation Rate</span>
                  <span className="text-brand-primary">{reviews.length > 0 ? Math.round((reviews.filter(r=>r.isImplemented).length / reviews.length) * 100) : 0}%</span>
                </div>
                <div className="h-2 w-full bg-surface-muted rounded-full overflow-hidden shadow-inner border border-border-subtle">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${reviews.length > 0 ? (reviews.filter(r=>r.isImplemented).length / reviews.length) * 100 : 0}%` }}
                    className="h-full bg-brand-primary shadow-[0_0_15px_rgba(168,85,247,0.6)]"
                    transition={{ type: "spring", bounce: 0, duration: 1 }}
                  />
                </div>
              </div>
           </section>

           <section className="ethereal-panel border border-border-subtle rounded-[2.5rem] p-8 shadow-xl">
             <div className="flex items-center gap-2 mb-6">
               <div className="w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
               <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-50">Consolidated Notes</h4>
             </div>
             <div className="space-y-2">
                {reviews.filter(r => !r.isImplemented).length === 0 ? (
                  <p className="text-[10px] text-text-secondary italic opacity-40 font-medium">No active critiques currently affecting context.</p>
                ) : (
                  reviews.filter(r => !r.isImplemented).slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center gap-4 py-3 border-b border-border-subtle last:border-0 group cursor-default">
                      <div className="w-1 h-1 rounded-full bg-text-secondary group-hover:bg-brand-primary group-hover:scale-[3] transition-all duration-300" />
                      <span className="text-xs font-bold text-text-primary truncate flex-1 tracking-tight group-hover:pl-1 transition-all">{r.source}</span>
                      <ExternalLink size={12} className="text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))
                )}
             </div>
           </section>
        </div>
      </div>
    </div>
  );
}
