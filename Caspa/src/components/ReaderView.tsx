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
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200 px-2 sm:px-2.5 py-3 sm:py-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            title="Exit Reader View"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-[11px] font-semibold uppercase tracking-widest text-stone-500 font-sans">Public Manuscript</h1>
            <h2 className="text-lg font-medium italic">{project.title}</h2>
          </div>
        </div>
        {!isLoggedIn && (
           <button 
            onClick={() => window.location.href = '/'}
            className="px-2 py-2 bg-stone-900 text-white rounded text-xs font-medium uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg"
           >
             Login to Write
           </button>
        )}
      </nav>

      <div className="max-w-3xl mx-auto py-1 sm:py-20 px-2 sm:px-3">
        <header className="mb-1.5 sm:mb-20 text-center">
          <BookOpen size={48} className="mx-auto text-stone-300 mb-2" />
          <h1 className="text-xs font-semibold font-semibold mb-1.5 tracking-tight leading-tight">{project.title}</h1>
          <div className="flex items-center justify-center gap-1.5 text-stone-500 text-[11px] font-sans uppercase tracking-widest font-medium">
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
              <div className="text-center mb-1.5">
                <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider block mb-2">Chapter {index + 1}</span>
                <h2 className="text-xs font-semibold font-semibold italic m-0">{chapter.title}</h2>
                <div className="w-12 h-0.5 bg-stone-300 mx-auto mt-6" />
              </div>
              <div className="reader-content leading-loose text-lg whitespace-pre-wrap">
                <ReactMarkdown>{chapter.content}</ReactMarkdown>
              </div>
            </article>
          ))}
        </div>

        <footer className="mt-32 pt-12 border-t border-stone-200 text-center pb-20">
          <div className="text-stone-400 text-xs font-medium uppercase tracking-widest mb-1.5">Finis</div>
          <p className="text-stone-500 italic">Built with Caspa The Ghost Writer</p>
        </footer>
      </div>
    </div>
  );
}
