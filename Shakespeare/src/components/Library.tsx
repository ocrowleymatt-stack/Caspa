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
import { Project, SourceMaterial } from '../types';
import { useState } from 'react';

interface LibraryProps {
  projects: Project[];
  activeProject?: Project;
  sourceMaterials?: SourceMaterial[];
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onBroadScan?: (q?: string) => Promise<void>;
  isMobile?: boolean;
}

export default function Library({ 
  projects, 
  activeProject,
  sourceMaterials,
  onSelectProject, 
  onCreateProject, 
  onDeleteProject,
  onBroadScan,
  isMobile
}: LibraryProps) {
  const [filter, setFilter] = useState('');

  const filteredProjects = projects.filter(p => 
    (p.title || '').toLowerCase().includes(filter.toLowerCase()) ||
    (p.genre || '').toLowerCase().includes(filter.toLowerCase())
  );

  // Let's pass the active projectId to the Library component
  return (
    <div 
      className="h-full overflow-y-auto custom-scrollbar bg-surface-bg transition-colors duration-500 pb-32"
      style={{ minHeight: 0 }}
    >
      <div className="p-4 md:p-4 max-w-7xl mx-auto space-y-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 border-b border-border-subtle pb-4">
        <div>
          <h2 className="text-[11px] font-medium font-semibold text-text-primary tracking-tight">
            Good morning{localStorage.getItem('currentUserEmail') ? `, ${localStorage.getItem('currentUserEmail')?.split('@')[0]}` : ''}
          </h2>
          <p className="text-teal-500 font-medium mt-1 text-xs flex items-center gap-1.5">
            You have {filteredProjects.length} active project{filteredProjects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button 
          onClick={onCreateProject}
          className="btn-nexus-glass px-2 py-1.5 rounded font-medium text-xs transition-all hover:scale-105 active:scale-95 group flex items-center gap-2 border-brand-primary/30 hover:border-brand-primary"
        >
          New Project <Plus size={14} />
        </button>
      </div>

      <div className="relative group max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
        <input 
          type="text"
          placeholder="Search projects or clients..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-surface-card border border-border-subtle rounded py-1.5 pl-9 pr-3 focus:outline-none focus:border-brand-primary transition-all text-[11px] text-text-primary placeholder:text-text-secondary/50 no-print"
        />
      </div>

      {filteredProjects.length === 0 ? (
        <div className="bg-surface-card border border-dashed border-border-subtle rounded p-4 md:p-4 text-center relative group overflow-hidden">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-1.5 relative z-10">
            <Book size={24} className="text-brand-primary opacity-50" />
          </div>
          <p className="font-semibold text-text-primary text-[11px] relative z-10">No projects found</p>
          <div className="space-y-1.5 mt-3 relative z-10 max-w-lg mx-auto">
            <p className="text-text-secondary opacity-80 text-xs">Create a new project to get started with Caspa.</p>
            
            <div className="flex flex-col gap-1.5 items-center">
              <button 
                onClick={() => {
                  if (onBroadScan) onBroadScan();
                }}
                className="w-full max-w-xs py-2 bg-surface-muted hover:bg-white/5 rounded font-medium text-xs transition-all flex items-center justify-center gap-2"
              >
                <Search size={14} />
                Global Recovery Scan
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <section>
            <h3 className="text-xs font-semibold text-text-primary mb-1.5">Recent Projects</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {filteredProjects.map((proj) => (
                <ProjectCard key={proj.id} proj={proj} onSelect={onSelectProject} onDelete={onDeleteProject} />
              ))}
            </div>
          </section>
        </div>
      )}

      {activeProject && activeProject.id !== 'default' && (
        <section className="mt-8 pt-6 border-t border-border-subtle/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
              Project Reference Ingests ({sourceMaterials?.length || 0})
            </h3>
            <span className="text-[10px] text-[#90939a] uppercase tracking-widest font-mono select-none">
              Active Project Context: <span className="text-text-primary italic font-serif font-semibold">{activeProject.title}</span>
            </span>
          </div>
          
          {(!sourceMaterials || sourceMaterials.length === 0) ? (
            <div className="bg-surface-card/40 border border-dashed border-border-subtle rounded p-6 text-center">
              <p className="text-xs text-text-secondary italic">No reference documents or background briefs ingested for this project yet.</p>
              <p className="text-[10px] text-[#90939a] mt-1">Go to "Evidence & Uploads" section to upload folders, background PDFs, or raw text reference archives.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sourceMaterials.map((source) => (
                <div 
                  key={source.id}
                  className="bg-surface-card p-4 rounded border border-border-subtle hover:border-brand-primary/30 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold text-text-primary truncate max-w-[80%]" title={source.name}>
                        {source.name}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-brand-primary font-mono select-none uppercase">
                        {source.type.includes('pdf') ? 'PDF' : 'TXT'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#90939a] line-clamp-3 font-serif italic mb-4 leading-relaxed">
                      {source.content || 'Empty source'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-border-subtle/50 pt-2 text-[10px] text-text-secondary">
                    <span>Synced {new Date(source.updatedAt || Date.now()).toLocaleDateString()}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wider">{(source.content?.length || 0).toLocaleString()} chars</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      </div>
    </div>
  );
}

function ProjectCard({ proj, onSelect, onDelete }: { proj: Project, onSelect: (p: Project) => void, onDelete: (id: string) => void }) {
  return (
    <motion.div 
      layout
      whileHover={{ y: -4 }}
      className={`bg-surface-card rounded border border-border-subtle p-4 transition-all group relative flex flex-col h-full hover:border-brand-primary/50 hover:shadow-lg active:scale-[0.98]`}
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
         <button 
          onClick={(e) => {
            e.stopPropagation();
            if(confirm("Permanently delete this project?")) {
              onDelete(proj.id);
            }
          }}
          className="p-2 text-text-secondary hover:text-red-500 transition-colors rounded"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mb-2 flex items-start justify-between">
        <div className={`w-12 h-12 rounded flex items-center justify-center bg-brand-primary/10`}>
          <BookOpen className="text-brand-primary" size={20} />
        </div>
      </div>

      <div className="space-y-3 mb-auto">
        <h3 className="text-[11px] font-medium font-medium text-text-primary leading-tight">
          {proj.title || 'Untitled Project'}
        </h3>
        <p className="text-xs text-text-secondary font-medium">
          {proj.targetWordCount ? `${(proj.stats?.totalWords || 0).toLocaleString()} / ${proj.targetWordCount.toLocaleString()} words` : `${(proj.stats?.totalWords || 0).toLocaleString()} words`}
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-border-subtle pt-4">
        <div className="flex flex-col">
           <span className="text-xs text-text-secondary mb-0.5">Last edited</span>
           <span className="text-xs text-text-primary font-medium">{new Date(proj.lastModified).toLocaleDateString()}</span>
        </div>
        <button 
          onClick={() => onSelect(proj)}
          className="px-2 py-2 bg-brand-primary/10 text-brand-primary rounded font-medium text-xs flex items-center gap-2 hover:bg-brand-primary hover:text-white transition-all shadow-sm"
        >
          Open
        </button>
      </div>
    </motion.div>
  );
}
