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
          <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-1 italic font-serif">Review Vault</h2>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.2em]">External feedback and critical ingestion.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search feedback..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded transition-all shadow-xl flex items-center gap-2 uppercase tracking-widest"
          >
            <Plus size={14} />
            Ingest Review
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
        {/* Review List */}
        <div className="lg:col-span-2 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {isAdding && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-6 shadow-sm"
              >
                <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-blue-600 tracking-widest pl-1">Source / Lens</label>
                        <input 
                          value={newReview.source}
                          onChange={(e) => setNewReview({ ...newReview, source: e.target.value })}
                          placeholder="e.g. Literary Agent, Beta Reader..."
                          className="w-full bg-white border border-blue-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-blue-600 tracking-widest pl-1">Score / Weight (Optional)</label>
                        <input 
                          type="number"
                          value={newReview.score}
                          onChange={(e) => setNewReview({ ...newReview, score: parseInt(e.target.value) })}
                          placeholder="0-100"
                          className="w-full bg-white border border-blue-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400/20"
                        />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-blue-600 tracking-widest pl-1">Observation / Critique</label>
                      <textarea 
                        value={newReview.content}
                        onChange={(e) => setNewReview({ ...newReview, content: e.target.value })}
                        placeholder="Paste the review or notes here..."
                        className="w-full h-32 bg-white border border-blue-200 rounded-xl px-4 py-3 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-400/20 resize-none"
                      />
                   </div>
                   <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setIsAdding(false)}
                        className="px-6 py-2 text-slate-500 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleAdd}
                        className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] rounded-lg transition-all shadow-lg shadow-blue-200 uppercase tracking-widest"
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
                className={`group bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all ${r.isImplemented ? 'border-emerald-200 bg-emerald-50/20 opacity-80' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${r.isImplemented ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'}`}>
                      <Clipboard size={18} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
                        {r.source}
                        {r.isImplemented && <CheckCircle size={12} className="text-emerald-600" />}
                      </h4>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(r.date).toLocaleDateString()}</span>
                        {r.score !== undefined && (
                          <div className="flex items-center gap-1 text-[10px] font-black text-amber-500">
                             <Star size={10} className="fill-current" />
                             {r.score}/100
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleImplemented(r)}
                      title={r.isImplemented ? 'Mark as active' : 'Mark as implemented'}
                      className={`p-2 rounded-lg transition-all ${r.isImplemented ? 'text-emerald-600 hover:bg-emerald-100' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                    >
                      <CheckCircle size={18} />
                    </button>
                    <button 
                      onClick={() => onDelete(r.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <p className={`text-slate-600 text-sm leading-relaxed font-serif italic border-l-2 pl-4 transition-all ${r.isImplemented ? 'border-emerald-200 line-through text-slate-400' : 'border-slate-200'}`}>
                  "{r.content}"
                </p>
              </motion.div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-20 border-2 border-dashed border-slate-200 rounded-3xl text-slate-300 bg-white">
                <Clipboard size={64} strokeWidth={1} className="opacity-10 mb-4" />
                <div>
                  <p className="text-lg font-bold text-slate-400 font-serif italic">Vault Empty</p>
                  <p className="text-xs text-slate-300 font-medium uppercase tracking-widest mt-1">Ingest agent or beta reader feedback here.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Strategies Sidebar */}
        <div className="space-y-8">
           <section className="bg-slate-950 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform">
                <Globe size={120} />
              </div>
              <header className="relative mb-6">
                <h3 className="text-lg font-black italic font-serif flex items-center gap-2">
                  <Star className="text-amber-500" size={18} />
                  Intelligence Sync
                </h3>
              </header>
              <p className="text-xs text-slate-400 leading-relaxed mb-6 relative">
                External reviews are automatically integrated into the AI's drafting context. The engine will prioritize resolving high-weight critical observations.
              </p>
              <div className="space-y-3 relative">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span>Implementation Rate</span>
                  <span className="text-blue-400">{reviews.length > 0 ? Math.round((reviews.filter(r=>r.isImplemented).length / reviews.length) * 100) : 0}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${reviews.length > 0 ? (reviews.filter(r=>r.isImplemented).length / reviews.length) * 100 : 0}%` }}
                    className="h-full bg-blue-600"
                  />
                </div>
              </div>
           </section>

           <section className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Consolidated Notes</h4>
             <div className="space-y-1">
                {reviews.filter(r => !r.isImplemented).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No active critiques currently affecting context.</p>
                ) : (
                  reviews.filter(r => !r.isImplemented).slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0 group">
                      <div className="w-1 h-1 rounded-full bg-blue-500 group-hover:scale-150 transition-transform" />
                      <span className="text-xs font-bold text-slate-600 truncate flex-1">{r.source}</span>
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
