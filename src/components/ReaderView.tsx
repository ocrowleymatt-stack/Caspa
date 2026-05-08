import React from 'react';
import { BookOpen, ChevronLeft, Calendar, User } from 'lucide-react';
import { Project, Chapter } from '../types';
import ReactMarkdown from 'react-markdown';

interface Props {
  project: Project;
  chapters: Chapter[];
  onBack?: () => void;
  isLoggedIn: boolean;
}

export default function ReaderView({ project, chapters, onBack, isLoggedIn }: Props) {
  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);

  return (
    <div className="h-dvh overflow-y-auto bg-stone-50 text-stone-900 font-serif selection:bg-stone-200 custom-scrollbar">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            title="Exit Reader View"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest text-stone-500 font-sans">Public Manuscript</h1>
            <h2 className="text-lg font-bold italic">{project.title}</h2>
          </div>
        </div>
        {!isLoggedIn && (
           <button 
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg"
           >
             Login to Write
           </button>
        )}
      </nav>

      <div className="max-w-3xl mx-auto py-12 sm:py-20 px-5 sm:px-8">
        <header className="mb-12 sm:mb-20 text-center">
          <BookOpen size={48} className="mx-auto text-stone-300 mb-6" />
          <h1 className="text-5xl font-black mb-4 tracking-tight leading-tight">{project.title}</h1>
          <div className="flex items-center justify-center gap-6 text-stone-500 text-sm font-sans uppercase tracking-widest font-bold">
             <div className="flex items-center gap-2">
               <User size={14} />
               <span>Shared by Author</span>
             </div>
             <div className="flex items-center gap-2">
               <Calendar size={14} />
               <span>{new Date(project.lastModified).toLocaleDateString()}</span>
             </div>
          </div>
          <div className="mt-12 text-lg text-stone-600 italic leading-relaxed max-w-xl mx-auto">
            "{project.premise}"
          </div>
        </header>

        <div className="space-y-20 sm:space-y-32">
          {sortedChapters.map((chapter, index) => (
            <article key={chapter.id} className="prose prose-stone max-w-none">
              <div className="text-center mb-12">
                <span className="text-xs font-black text-stone-400 uppercase tracking-[0.3em] block mb-2">Chapter {index + 1}</span>
                <h2 className="text-3xl font-black italic m-0">{chapter.title}</h2>
                <div className="w-12 h-0.5 bg-stone-300 mx-auto mt-6" />
              </div>
              <div className="reader-content leading-loose text-lg whitespace-pre-wrap">
                <ReactMarkdown>{chapter.content}</ReactMarkdown>
              </div>
            </article>
          ))}
        </div>

        <footer className="mt-32 pt-12 border-t border-stone-200 text-center pb-20">
          <div className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-4">Finis</div>
          <p className="text-stone-500 italic">Built with NovelWrite Pro</p>
        </footer>
      </div>
    </div>
  );
}
