import { motion } from 'motion/react';
import { 
  Book, 
  Trash2, 
  Plus, 
  Calendar, 
  Search, 
  ExternalLink,
  MoreVertical,
  BookOpen
} from 'lucide-react';
import { Project } from '../types';
import { useState } from 'react';

interface LibraryProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
  onDeleteProject: (projectId: string) => void;
}

export default function Library({ 
  projects, 
  onSelectProject, 
  onCreateProject, 
  onDeleteProject 
}: LibraryProps) {
  const [filter, setFilter] = useState('');

  const filteredProjects = projects.filter(p => 
    (p.title || '').toLowerCase().includes(filter.toLowerCase()) ||
    (p.genre || '').toLowerCase().includes(filter.toLowerCase())
  );

  // Let's pass the active projectId to the Library component
  return (
    <div className="p-8 md:p-16 max-w-7xl mx-auto space-y-12 h-full overflow-y-auto custom-scrollbar bg-surface-bg transition-colors duration-500 pb-32" style={{ minHeight: 0 }}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 border-b border-border-subtle pb-16">
        <div>
          <div className="text-[10px] font-black text-brand-primary uppercase tracking-[0.5em] mb-4 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
            Intelligence Repository
          </div>
          <h2 className="text-5xl md:text-7xl font-black text-text-primary tracking-tighter italic font-serif leading-none">The Vault</h2>
          <p className="text-text-secondary font-medium mt-6 text-xl max-w-md leading-relaxed">Your portfolio of protected narrative intellectual assets and decrypted drafts.</p>
        </div>
        <button 
          onClick={onCreateProject}
          className="bg-brand-primary text-white hover:bg-brand-accent px-10 py-6 rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-4 shadow-[0_20px_50px_rgba(59,130,246,0.3)] transition-all hover:scale-105 active:scale-95 group"
        >
          <Plus size={24} className="group-hover:rotate-90 transition-transform" />
          Forge New Archive
        </button>
      </div>

      <div className="relative group max-w-2xl">
        <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-brand-primary transition-all" size={24} />
        <input 
          type="text"
          placeholder="Decrypt archive by title, genre, or narrative markers..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-surface-card border border-border-subtle rounded-[2.5rem] py-8 pl-20 pr-10 focus:outline-none focus:border-brand-primary transition-all shadow-2xl text-text-primary font-medium text-xl placeholder:text-text-secondary/30 group-hover:border-text-secondary/30 no-print"
        />
      </div>

      {filteredProjects.length === 0 ? (
        <div className="bg-surface-card border border-dashed border-border-subtle rounded-[4rem] p-32 text-center relative group overflow-hidden">
          <div className="absolute inset-0 bg-brand-primary rounded-full blur-[150px] opacity-5 group-hover:opacity-10 transition-opacity" />
          <div className="w-28 h-28 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-10 relative z-10">
            <Book size={56} className="text-brand-primary opacity-30" />
          </div>
          <p className="font-black text-text-primary uppercase tracking-[0.4em] text-lg relative z-10 italic">Intelligence Void Detected</p>
          <p className="text-text-secondary mt-4 max-w-xs mx-auto relative z-10 opacity-60">Authorize a new narrative ingestion sequence to begin populating this terminal.</p>
        </div>
      ) : (
        <div className="space-y-16">
          {/* Active / Recent Projects */}
          <section>
            <h3 className="text-[10px] font-black text-brand-primary uppercase tracking-[0.4em] mb-8 px-8">Active Transmissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {filteredProjects.slice(0, 3).map((proj) => (
                <ProjectCard key={proj.id} proj={proj} onSelect={onSelectProject} onDelete={onDeleteProject} />
              ))}
            </div>
          </section>

          {/* All Other Projects */}
          {filteredProjects.length > 3 && (
            <section className="pt-16 border-t border-border-subtle/50">
              <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.4em] mb-8 px-8 opacity-40">Archived Repositories</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {filteredProjects.slice(3).map((proj) => (
                  <ProjectCard key={proj.id} proj={proj} onSelect={onSelectProject} onDelete={onDeleteProject} isArchived />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ proj, onSelect, onDelete, isArchived }: { proj: Project, onSelect: (p: Project) => void, onDelete: (id: string) => void, isArchived?: boolean }) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -12 }}
      className={`bg-surface-card rounded-[3rem] border border-border-subtle p-10 shadow-2xl transition-all group relative overflow-hidden flex flex-col h-full hover:border-brand-primary/50 hover:shadow-brand-primary/5 active:scale-[0.98] ${isArchived ? 'opacity-70 hover:opacity-100' : ''}`}
    >
      <div className="absolute top-0 right-0 p-10">
         <button 
          onClick={(e) => {
            e.stopPropagation();
            if(confirm("Permanently purge this manuscript? This cannot be undone.")) {
              onDelete(proj.id);
            }
          }}
          className="p-4 text-text-secondary/20 hover:text-red-500 transition-all hover:bg-red-500/10 rounded-2xl"
        >
          <Trash2 size={24} />
        </button>
      </div>

      <div className="mb-10">
        <div className={`w-18 h-18 rounded-[1.5rem] flex items-center justify-center group-hover:bg-brand-primary group-hover:scale-110 transition-all duration-700 shadow-inner ${isArchived ? 'bg-surface-muted' : 'bg-brand-dark'}`}>
          <BookOpen className="text-text-secondary group-hover:text-white transition-colors" size={32} />
        </div>
      </div>

      <div className="space-y-6 mb-auto">
        <h3 className="text-3xl font-black text-text-primary group-hover:text-brand-primary transition-colors italic font-serif leading-tight">
          {proj.title || 'Untitled Cryptograph'}
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-5 py-2 bg-brand-dark rounded-xl text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] border border-border-subtle group-hover:border-brand-primary/30 transition-colors">
            {proj.genre || 'Classified Genre'}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-border-subtle" />
          <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em] opacity-80 group-hover:opacity-100 transition-opacity">
            {proj.type}
          </span>
        </div>
      </div>

      <div className="mt-12 flex items-center justify-between border-t border-border-subtle/30 pt-8">
        <div className="flex flex-col">
           <span className="text-[8px] font-black text-text-secondary uppercase tracking-widest opacity-40 mb-1">Last Synchronization</span>
           <div className="flex items-center gap-2 text-[10px] text-text-secondary font-black uppercase tracking-widest">
            <Calendar size={14} className="text-brand-primary" />
            <span>{new Date(proj.lastModified).toLocaleDateString()}</span>
          </div>
        </div>
        <button 
          onClick={() => onSelect(proj)}
          className="bg-brand-primary text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-brand-accent transition-all shadow-xl active:scale-95 shadow-brand-primary/20"
        >
          Enter Studio
          <ExternalLink size={14} />
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-primary/0 group-hover:bg-brand-primary/30 transition-all duration-700 blur-[2px]" />
    </motion.div>
  );
}
