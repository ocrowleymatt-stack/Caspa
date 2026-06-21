/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { PenTool, Plus, Zap, MessageSquare, BookOpen, Trash2, ChevronRight, ChevronLeft, FileText, Tag, Users, Upload, X, ArrowRight, Search, Filter, Activity, Maximize2, Minimize2, Type, Flame, Save, Library, AlertTriangle, CircleSlash, Sparkles, RefreshCcw, AlertCircle, ChevronUp, ChevronDown, Fingerprint } from 'lucide-react';
import { SourceMaterial, Project, Chapter, PlotNode, Presence, Critique, ViewType, ExternalReview, Character } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';
import Markdown from 'react-markdown';
import Fuse from 'fuse.js';
import { calculateSimilarity, detectEchoes, findRedundantChapters } from '../lib/narrativeUtils';
import { Repeat, Menu, Settings, Wind, FileWarning, Eye } from 'lucide-react';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface Props {
  project: Project;
  plotNodes: PlotNode[];
  presence: Presence[];
  updateProject: (updates: Partial<Project>) => void;
  updateChapters: (chapters: Chapter[]) => void;
  setView: (view: ViewType) => void;
  upsertChapter?: (chapter: Chapter) => void;
  onDeleteChapter?: (id: string) => void;
  onUpsertSource: (source: SourceMaterial) => void | Promise<void>;
  onDeleteSource: (id: string) => void;
  onUpsertCharacters?: (chars: Character[]) => Promise<void>;
  onError?: (message: string) => void;
}

export default function WritingStudio({ 
  project, 
  plotNodes, 
  presence, 
  updateProject, 
  updateChapters, 
  setView,
  upsertChapter, 
  onDeleteChapter, 
  onUpsertSource, 
  onDeleteSource,
  onUpsertCharacters,
  onError
}: Props) {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(() => {
    return localStorage.getItem(`ls_selected_chapter_${project.id}`) || null;
  });
  const [showCritique, setShowCritique] = useState(false);
  const [critiqueText, setCritiqueText] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [isAnalyzingProse, setIsAnalyzingProse] = useState(false);
  const [isCheckingTurn, setIsCheckingTurn] = useState(false);
  const [writingStatus, setWritingStatus] = useState<string>('');
  const [sceneTurnResult, setSceneTurnResult] = useState<{ turned: boolean; score: number; reasoning: string; missing: string } | null>(null);
  const [proseViolations, setProseViolations] = useState<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }[]>([]);
  const [showProsePanel, setShowProsePanel] = useState(false);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [viewingSourceId, setViewingSourceId] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [archiveSearchTerm, setArchiveSearchTerm] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<'All' | 'Manuscript' | 'Research' | 'Source' | 'AI Compilation'>('All');
  const [isSaving, setIsSaving] = useState(false);
  const [isLeftRailOpen, setIsLeftRailOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1180 : true);
  const [isRightRailOpen, setIsRightRailOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1180 : true);
  const [lastSaved, setLastSaved] = useState<number>(Date.now());
  const [isScanningChars, setIsScanningChars] = useState(false);
  const dirtyRef = useRef<boolean>(false);

  const chapters = (project as any).chapters || [];

  const typeMap: Record<string, string> = {
    'Manuscript': 'ARCHIVE',
    'AI Compilation': 'SYNTHESIS',
    'Research': 'INTEL',
    'Source': 'SOURCE'
  };

  // Background Character Extraction (Auto-Absorb)
  useEffect(() => {
    const lastScanWordCount = parseInt(localStorage.getItem(`ls_last_char_scan_${project.id}`) || '0');
    const currentWordCount = chapters.reduce((acc: number, c: Chapter) => acc + (c.content?.split(/\s+/).length || 0), 0);

    if (currentWordCount > lastScanWordCount + 1000 && !isScanningChars) {
      const scan = async () => {
        setIsScanningChars(true);
        try {
          const extracted = await AIService.extractCharacters(chapters, project);
          if (extracted.length > 0 && onUpsertCharacters) {
            await onUpsertCharacters(extracted);
            localStorage.setItem(`ls_last_char_scan_${project.id}`, currentWordCount.toString());
          }
        } catch (e) {
          console.warn("Background character absorption failed silently.");
        } finally {
          setIsScanningChars(false);
        }
      };
      // Delay to avoid interference with editing
      const timer = setTimeout(scan, 10000);
      return () => clearTimeout(timer);
    }
  }, [chapters, project, isScanningChars]);
  
  // Auto-select logic
  useEffect(() => {
    if (selectedChapterId) {
      localStorage.setItem(`ls_selected_chapter_${project.id}`, selectedChapterId);
    } else if (chapters.length > 0) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId, project.id]);

  const selectedChapter = chapters.find((c: Chapter) => c.id === selectedChapterId);
  
  // Support both sourceMaterials and researchNotes in the viewer
  const allSources = useMemo(() => {
    const raw = [
      ...(project.sourceMaterials || []).map(s => ({
        ...s,
        displayType: (s.name || "").startsWith('[MANUSCRIPT]') ? 'Manuscript' : ((s.name || "").startsWith('[RESEARCH]') ? 'Research' : 'Source')
      })),
      ...(project.research || []).map((r: any) => ({
        id: r.id,
        name: `[RESEARCH] ${r.title || "Untitled Intelligence"}`,
        content: r.content || "",
        type: 'AI Compilation',
        displayType: 'AI Compilation'
      }))
    ];

    let filtered = raw;
    if (archiveFilter !== 'All') {
      filtered = filtered.filter(s => s.displayType === archiveFilter);
    }

    if (archiveSearchTerm.trim()) {
      const fuse = new Fuse(filtered, {
        keys: ['name', 'content'],
        threshold: 0.4
      });
      return fuse.search(archiveSearchTerm).map(result => result.item);
    }

    return filtered;
  }, [project.sourceMaterials, project.research, archiveSearchTerm, archiveFilter]);
  const viewingSource = allSources.find(s => s.id === viewingSourceId);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<'editor' | 'outline' | 'ops' | 'critiques'>('editor');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1180);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const addChapter = () => {
    const newChapter: Chapter = {
      id: crypto.randomUUID(),
      title: `Chapter ${chapters.length + 1}`,
      summary: '',
      content: '',
      order: chapters.length,
      plotNodeIds: [],
      tags: [],
      updatedAt: Date.now()
    };
    updateChapters([...chapters, newChapter]);
    if (upsertChapter) upsertChapter(newChapter);
    setSelectedChapterId(newChapter.id);
  };

  const [localTitle, setLocalTitle] = useState(selectedChapter?.title || '');
  const [localSummary, setLocalSummary] = useState(selectedChapter?.summary || '');
  const [localContent, setLocalContent] = useState(selectedChapter?.content || '');
  const [isPendingAiSync, setIsPendingAiSync] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      // Use requestAnimationFrame to ensure the DOM is ready for measurement
      const resize = () => {
        editor.style.height = 'auto';
        editor.style.height = `${editor.scrollHeight}px`;
      };
      resize();
      
      // Also resize on window resize
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }
  }, [localContent]);

  // Synchronize local state when chapter selection changes
  useEffect(() => {
    if (selectedChapter) {
      const draft = localStorage.getItem(`ls_draft_${selectedChapter.id}`);
      
      // If we have a local draft that is different from cloud, flag it
      // BUT only if we just switched to this chapter or were forced by AI sync
      if (draft && draft !== selectedChapter.content && draft.trim().length > 0) {
        setHasDraft(true);
        // We do NOT setLocalContent yet, we let the user decide to restore it
      } else {
        setHasDraft(false);
        setLocalContent(selectedChapter.content);
      }

      setLocalTitle(selectedChapter.title);
      setLocalSummary(selectedChapter.summary);
    }
  }, [selectedChapterId, isPendingAiSync]); // Avoid dependency on selectedChapter.content to prevent loops

  // Handle external updates (e.g. from collaborators or AI)
  useEffect(() => {
    if (selectedChapter && !dirtyRef.current && !hasDraft) {
      setLocalContent(selectedChapter.content);
      setLocalTitle(selectedChapter.title);
      setLocalSummary(selectedChapter.summary);
    }
  }, [selectedChapter?.content, selectedChapter?.title, selectedChapter?.summary]);

  const restoreDraft = () => {
    if (!selectedChapterId) return;
    const draft = localStorage.getItem(`ls_draft_${selectedChapterId}`);
    if (draft) {
      setLocalContent(draft);
      setHasDraft(false);
      dirtyRef.current = true;
    }
  };

  const discardDraft = () => {
    if (!selectedChapterId) return;
    localStorage.removeItem(`ls_draft_${selectedChapterId}`);
    setHasDraft(false);
    if (selectedChapter) {
      setLocalContent(selectedChapter.content);
    }
  };

  // Debug source materials loading
  useEffect(() => {
    if (project.sourceMaterials && project.sourceMaterials.length > 0) {
      console.log(`Writing Studio loaded ${project.sourceMaterials.length} source materials.`);
    }
  }, [project.sourceMaterials]);

  const updateChapter = (id: string, updates: Partial<Chapter>) => {
    const existing = chapters.find((c: Chapter) => c.id === id);
    if (!existing) return;
    const newChapter = { ...existing, ...updates };
    updateChapters(chapters.map((c: Chapter) => c.id === id ? newChapter : c));
  };

  const updateChapterRef = useRef(updateChapter);
  useEffect(() => {
    updateChapterRef.current = updateChapter;
  }, [updateChapter]);

  const flushSave = async () => {
    if (!dirtyRef.current || !selectedChapterId) return;
    
    setIsSaving(true);
    try {
      const updates = { 
        title: localTitle, 
        summary: localSummary, 
        content: localContent 
      };
      
      updateChapterRef.current(selectedChapterId, updates);
      
      const existing = chapters.find((c: Chapter) => c.id === selectedChapterId);
      if (existing && upsertChapter) {
        await upsertChapter({ ...existing, ...updates });
      }
      
      setLastSaved(Date.now());
      // On successful save, the cloud matches our local state
      localStorage.setItem(`ls_hardsave_${selectedChapterId}`, localContent);
      localStorage.removeItem(`ls_draft_${selectedChapterId}`);
      dirtyRef.current = false;
    } catch (err) {
      console.warn("Manual flush save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Track dirty state
  useEffect(() => {
    if (selectedChapter) {
      const isDirty = (
        localTitle !== selectedChapter.title ||
        localSummary !== selectedChapter.summary ||
        localContent !== selectedChapter.content
      );
      dirtyRef.current = isDirty;
    }
  }, [localTitle, localSummary, localContent, selectedChapter]);

  // Debounce updates to parent + Local Draft fallback
  useEffect(() => {
    if (!selectedChapterId) return;
    
    // Recovery: Save to localStorage as draft in case of catastrophic failure
    localStorage.setItem(`ls_draft_${selectedChapterId}`, localContent);

    const timer = setTimeout(async () => {
       if (dirtyRef.current) {
         await flushSave();
       }
    }, 1500); // 1.5s debounce for heavier DB writes

    return () => {
      clearTimeout(timer);
    };
  }, [localTitle, localSummary, localContent, selectedChapterId]);

  // Final flush on unmount
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        flushSave();
      }
    };
  }, []);

  const handleManualSave = async () => {
    await flushSave();
    // Force a project-level save to cloud as well
    await saveToCloud(); 
  };

  const saveToCloud = async () => {
    setIsSaving(true);
    try {
      // Small delay to simulate heavy sync
      await new Promise(resolve => setTimeout(resolve, 800));
      updateProject({ lastModified: Date.now() });
      setLastSaved(Date.now());
    } catch (e) {
      onError?.("Cloud synchronization interrupted.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle chapter selection change - Flush current before switching
  const handleChapterSelect = async (id: string) => {
    if (id === selectedChapterId) return;
    await flushSave();
    setSelectedChapterId(id);
    if (isMobile) setIsLeftRailOpen(false);
  };

  const deleteChapter = (id: string) => {
    updateChapters(chapters.filter((c: Chapter) => c.id !== id));
    if (onDeleteChapter) onDeleteChapter(id);
    if (selectedChapterId === id) setSelectedChapterId(chapters[0]?.id || null);
  };

  const moveChapterToSource = (chapter: Chapter) => {
    const newSource: SourceMaterial = {
      id: crypto.randomUUID(),
      name: `[MANUSCRIPT] ${chapter.title}`,
      content: chapter.content,
      type: 'text/markdown'
    };
    onUpsertSource(newSource);
  };

  const toggleNode = (nodeId: string) => {
    if (!selectedChapter) return;
    const currentNodes = selectedChapter.plotNodeIds || [];
    const newNodes = currentNodes.includes(nodeId)
      ? currentNodes.filter(id => id !== nodeId)
      : [...currentNodes, nodeId];
    updateChapter(selectedChapter.id, { plotNodeIds: newNodes });
  };

  const handleRefine = async () => {
    if (!selectedChapter || !localContent.trim()) return;
    setIsRefining(true);
    setIsPendingAiSync(true);
    setWritingStatus('Initializing Deep Simmer...');
    const statusTimer = setTimeout(() => setWritingStatus('Reviewing plot vectors...'), 4000);
    const statusTimer2 = setTimeout(() => setWritingStatus('Calculating narrative flow...'), 9000);
    const statusTimer3 = setTimeout(() => setWritingStatus('Synthesizing surgical refinement...'), 15000);
    
    try {
      const earlierContent = (chapters || [])
        .filter((c: Chapter) => c.order < selectedChapter.order)
        .map((c: Chapter) => c.content)
        .join('\n\n')
        .slice(-15000);

      const activeNodes = plotNodes.filter(n => selectedChapter.plotNodeIds?.includes(n.id));

      const refined = await AIService.deepSimmer(
        { ...selectedChapter, content: localContent },
        earlierContent,
        project.type,
        activeNodes,
        project.research || [],
        project.maturity,
        project.sourceMaterials || [],
        project.targetWordCount,
        project.externalReviews || [],
        project.draftStage,
        chapters.length,
        project.cutMode
      );
      setLocalContent(refined);
      updateChapter(selectedChapter.id, { content: refined });
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Deep Simmer failed.');
    } finally {
      setIsRefining(false);
      setWritingStatus('');
      clearTimeout(statusTimer);
      clearTimeout(statusTimer2);
      clearTimeout(statusTimer3);
      setTimeout(() => setIsPendingAiSync(false), 2000);
    }
  };

  const handleSmartWrite = async () => {
    if (!selectedChapter) return;
    setIsWriting(true);
    setIsPendingAiSync(true);
    setWritingStatus('Waking Composition Core...');
    const statusTimer = setTimeout(() => setWritingStatus('Absorbing earlier context...'), 3500);
    const statusTimer2 = setTimeout(() => setWritingStatus('Projecting narrative arc...'), 8000);
    const statusTimer3 = setTimeout(() => setWritingStatus('Weaving final prose...'), 14000);

    try {
      const earlierContent = chapters
        .filter((c: Chapter) => c.order < selectedChapter.order)
        .map((c: Chapter) => c.content)
        .join('\n\n')
        .slice(-15000);

      const activeNodes = plotNodes.filter(n => selectedChapter.plotNodeIds?.includes(n.id));

      const content = await AIService.writeDraft(
        selectedChapter.title, 
        selectedChapter.summary, 
        earlierContent, 
        project.type,
        activeNodes,
        project.research || [],
        project.maturity,
        project.sourceMaterials || [],
        [], // directives placeholder
        project.targetWordCount,
        project.externalReviews || [],
        project.draftStage,  // staged pass number (1-4)
        chapters.length,       // total chapter count
        project.cutMode
      );
      
      const newContent = (localContent + '\n\n' + content).trim();
      setLocalContent(newContent);
      updateChapter(selectedChapter.id, { content: newContent });
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Composition Core failed to initialize.');
    } finally {
      setIsWriting(false);
      setWritingStatus('');
      clearTimeout(statusTimer);
      clearTimeout(statusTimer2);
      clearTimeout(statusTimer3);
      setTimeout(() => setIsPendingAiSync(false), 2000);
    }
  };

  const handleAnalyzeProse = async () => {
    if (!localContent.trim() || !selectedChapter) return;
    
    // 1. FAST FEEDBACK (Algorithmic)
    const localEchoes = detectEchoes(localContent);
    const echoViolations: { type: string, message: string, severity: 'low' | 'medium' | 'high' }[] = localEchoes.slice(0, 5).map(echo => ({
      type: 'Echo',
      message: `Word "${echo.word.toUpperCase()}" is echoing close together. Rule 14: Cut thematic static.`,
      severity: 'low'
    }));

    // Chapter Redundancy Check
    const redundant = findRedundantChapters(chapters);
    const isRedundant = redundant.some(r => r.chapterId === selectedChapter.id);
    if (isRedundant) {
      echoViolations.unshift({
        type: 'Static',
        message: `NARRATIVE LOOP WARNING: This chapter overlaps significantly with existing beats. Ensure a unique "turn".`,
        severity: 'medium' as const
      });
    }

    setProseViolations([...echoViolations]);
    setShowProsePanel(true);
    if (isMobile) {
      setMobileTab('editor');
    }

    // 2. AI ANALYSIS
    setIsAnalyzingProse(true);
    try {
      const precedingContext = chapters
        .filter(c => c.order < selectedChapter.order)
        .slice(-3)
        .map(c => `[CHAPTER: ${c.title}]\n${c.summary}`)
        .join('\n\n');

      const violations = await AIService.analyzeProse(
        localContent, 
        project.type, 
        precedingContext, 
        project.externalReviews || []
      );
      
      setProseViolations([...echoViolations, ...violations]);

      // 3. AUTO-TRIGGER SCENE TURN CHECK
      if (localContent.length >= 200) {
        setIsCheckingTurn(true);
        setSceneTurnResult(null);
        try {
          const turnResult = await AIService.checkSceneTurn(localContent, project.externalReviews || []);
          setSceneTurnResult(turnResult);
        } catch (e) {
          console.warn("Auto-turn check silent failure:", e);
        } finally {
          setIsCheckingTurn(false);
        }
      }
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Prose Analysis failed.');
    } finally {
      setIsAnalyzingProse(false);
    }
  };

  const handleCheckTurn = async () => {
    if (!localContent || localContent.trim().length < 200) {
      onError?.("Scene insufficient in length for reversal analysis.");
      return;
    }
    setIsCheckingTurn(true);
    setShowProsePanel(true);
    if (isMobile) {
      setMobileTab('editor');
    }
    setSceneTurnResult(null);
    try {
      const result = await AIService.checkSceneTurn(localContent, project.externalReviews || []);
      setSceneTurnResult(result);
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Reversal analysis failed.');
    } finally {
      setIsCheckingTurn(false);
    }
  };

  const handleCritique = async () => {
    if (!selectedChapter?.content) return;
    setIsCritiquing(true);
    setShowCritique(true);
    if (isMobile) {
      setMobileTab('critiques');
    }
    try {
      const results = await AIService.getSwarmCritique(
        selectedChapter.content, 
        project.type, 
        project.maturity, 
        project.sourceMaterials || [],
        ['vocal', 'structural', 'factual', 'agent', 'sentence', 'thematic', 'writer', 'repetition']
      );
      
      setCritiqueText(results[0]?.content || "Analysis complete.");

      // Persist to project state - Accumulate and ensure we don't duplicate by ID if possible
      const currentMap = project.critiques || {};
      const chapterCritiques = currentMap[selectedChapter.id] || [];
      
      updateProject({
        critiques: {
          ...currentMap,
          [selectedChapter.id]: [...results, ...chapterCritiques].slice(0, 30)
        }
      });
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Narrative Sync Analysis failed.');
    } finally {
      setIsCritiquing(false);
    }
  };

  const applySuggestionsToChapter = () => {
    if (!selectedChapter) return;
    const currentCritiques = (project.critiques || {})[selectedChapter.id] || [];
    const latestCritique = currentCritiques[0];
    if (!latestCritique) return;

    const acceptedSuggestions = latestCritique.suggestions
      .filter(s => s.accepted !== false) // Default to accepted if not explicitly rejected for this simple "apply all"
      .map(s => s.text);
    
    if (acceptedSuggestions.length === 0) return;

    const updatedChapters = chapters.map(chap => {
      if (chap.id === selectedChapter.id) {
        const currentDirectives = chap.directives || [];
        const newDirectives = [...currentDirectives];
        acceptedSuggestions.forEach(s => {
          if (!newDirectives.includes(s)) newDirectives.push(s);
        });
        return { ...chap, directives: newDirectives };
      }
      return chap;
    });
    
    updateChapters(updatedChapters);
    setView('architect'); // Redirect to auto-draft
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { 
        onError?.(`File ${file.name} is too large (max 10MB).`);
        continue;
      }

      try {
        let content = '';
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          const workerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => (item as any).str).join(' ');
            fullText += pageText + '\n\n';
          }
          content = fullText;
        } else {
          content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });
        }

        const CHUNK_SIZE = 400000;
        if (content.length > CHUNK_SIZE) {
          for (let i = 0; i < content.length; i += CHUNK_SIZE) {
            const chunk = content.substring(i, i + CHUNK_SIZE);
            const partNum = Math.floor(i / CHUNK_SIZE) + 1;
            const totalParts = Math.ceil(content.length / CHUNK_SIZE);
            const newSource: SourceMaterial = {
              id: crypto.randomUUID(),
              name: `${file.name} (Part ${partNum}/${totalParts})`,
              content: chunk,
              type: file.type || 'text/plain',
              updatedAt: Date.now()
            };
            await onUpsertSource(newSource);
          }
        } else {
          const newSource: SourceMaterial = {
            id: crypto.randomUUID(),
            name: file.name,
            content: content,
            type: file.type || 'text/plain',
            updatedAt: Date.now()
          };
          await onUpsertSource(newSource);
        }
      } catch (err) {
        console.error("Error processing file:", file.name, err);
        onError?.(`Failed to process ${file.name}.`);
      }
    }
    
    // Reset input so same file can be uploaded again
    e.target.value = '';
  };

  const removeSource = (id: string) => {
    onDeleteSource(id);
  };

  const wordCount = useMemo(() => {
    if (!localContent.trim()) return 0;
    // Strip symbols for word count and filter empty tokens
    return localContent.trim().split(/\s+/).filter(t => t.length > 0).length;
  }, [localContent]);

  const readingTime = useMemo(() => {
    return Math.ceil(wordCount / 200);
  }, [wordCount]);

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    foundations: false,
    sensory: false,
    intel: false,
    critique: false
  });

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const isOverWordLimit = useMemo(() => {
    if (!project.targetWordCount || selectedChapter?.isPlan) return false;
    return wordCount > (project.targetWordCount || 0) * 1.03;
  }, [wordCount, project.targetWordCount, selectedChapter?.isPlan]);

  const recenter = () => {
    setIsFocusMode(false);
    setIsLeftRailOpen(true);
    setIsRightRailOpen(true);
    if (editorRef.current) {
      editorRef.current.scrollTo(0, 0);
    }
  };

  const toggleFocus = () => {
    const next = !isFocusMode;
    setIsFocusMode(next);
    if (next) {
      document.documentElement.requestFullscreen().catch(() => console.log("Fullscreen blocked"));
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => console.log("Exit fullscreen blocked"));
    }
  };

  return (
    <div 
      className={`h-full flex flex-col lg:flex-row gap-0 relative overflow-hidden transition-all duration-700 ${isFocusMode ? 'bg-black' : 'bg-surface-bg'}`}
      style={{ minHeight: 0 }}
    >
      {/* Mobile Inline Switcher */}
      {isMobile && !isFocusMode && (
        <div className="flex border-b border-border-subtle bg-brand-dark/95 backdrop-blur-xl p-2 gap-1.5 sticky top-0 z-[60] shrink-0 w-full">
          <button
            onClick={() => setMobileTab('outline')}
            className={`flex-1 py-2 px-1 rounded text-xs font-semibold uppercase tracking-widest text-center transition-all min-h-[44px] flex items-center justify-center ${
              mobileTab === 'outline' 
                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]' 
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            Outline
          </button>
          <button
            onClick={() => setMobileTab('editor')}
            className={`flex-1 py-2 px-1 rounded text-xs font-semibold uppercase tracking-widest text-center transition-all min-h-[44px] flex items-center justify-center ${
              mobileTab === 'editor' 
                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]' 
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            Draft
          </button>
          <button
            onClick={() => setMobileTab('ops')}
            className={`flex-1 py-2 px-1 rounded text-xs font-semibold uppercase tracking-widest text-center transition-all min-h-[44px] flex items-center justify-center ${
              mobileTab === 'ops' 
                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]' 
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            AI Ops
          </button>
          <button
            onClick={() => setMobileTab('critiques')}
            className={`flex-1 py-2 px-1 rounded text-xs font-semibold uppercase tracking-widest text-center transition-all min-h-[44px] flex items-center justify-center ${
              mobileTab === 'critiques' 
                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]' 
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            Critiques
          </button>
        </div>
      )}

      {/* Sidebar - Chapter Navigation & Sources */}
      <AnimatePresence initial={false}>
        {!isFocusMode && (isMobile ? mobileTab === 'outline' : isLeftRailOpen) && (
          <motion.aside 
            initial={isMobile ? { opacity: 0 } : { width: 0, opacity: 0, x: -50 }}
            animate={{ width: isMobile ? '100%' : 'clamp(15rem, 21vw, 18rem)', opacity: 1, x: 0 }}
            exit={isMobile ? { opacity: 0 } : { width: 0, opacity: 0, x: -50 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`border-r border-border-subtle ethereal-panel flex flex-col z-30 h-full relative overflow-hidden shrink-0 no-print ${isMobile ? 'w-full h-full relative bg-brand-dark' : 'relative'}`}
          >
            <AnimatePresence>
              {isMobile && !isMobile && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsLeftRailOpen(false)}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[-1]"
                />
              )}
            </AnimatePresence>
            {!isMobile && (
              <div className="absolute top-4 right-4 z-40">
                <button 
                  onClick={() => setIsLeftRailOpen(false)}
                  className="p-3 sm:p-1 hover:bg-white/5 rounded sm:rounded-md text-text-secondary hover:text-brand-primary flex items-center justify-center min-w-[36px] min-h-[36px]"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft size={20} className="sm:w-4 sm:h-4" />
                </button>
              </div>
            )}
        {/* Manuscript Section */}
        <div className="flex-none p-3 md:p-4 border-b border-border-subtle relative bg-surface-bg shadow-sm">
          <div className="flex items-center justify-between mb-1.5 pr-1">
            <h3 className="text-[11px] font-semibold flex items-center gap-2 text-text-primary">
              <BookOpen size={14} className="text-brand-primary" />
              Manuscript
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => toggleSection('foundations')}
                className="p-1 px-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors border border-border-subtle hover:border-text-secondary/30 rounded-md flex items-center gap-1"
                title={collapsedSections.foundations ? 'Restore View' : 'Collapse Section'}
              >
                {collapsedSections.foundations ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                {collapsedSections.foundations ? 'Show' : 'Hide'}
              </button>
              <label className="p-1.5 hover:bg-surface-muted text-text-secondary hover:text-brand-primary rounded-md transition-all cursor-pointer border border-transparent hover:border-border-subtle" title="Import File">
                <Upload size={14} />
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".txt,.md,.json,.yaml,.yml,.pdf" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 20 * 1024 * 1024) {
                      onError?.(`Manuscript excessive (max 20MB).`);
                      return;
                    }
                    
                    try {
                      let content = '';
                      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                        const workerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
                        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

                        const arrayBuffer = await file.arrayBuffer();
                        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                        const pdf = await loadingTask.promise;
                        let fullText = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                          const page = await pdf.getPage(i);
                          const textContent = await page.getTextContent();
                          const pageText = textContent.items.map((item: any) => (item as any).str).join(' ');
                          fullText += pageText + '\n\n';
                        }
                        content = fullText;
                      } else {
                        content = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = (event) => resolve(event.target?.result as string);
                          reader.onerror = reject;
                          reader.readAsText(file);
                        });
                      }

                      const CHUNK_SIZE = 500000;
                      const contentChunks: string[] = [];
                      if (content.length > CHUNK_SIZE) {
                        for (let i = 0; i < content.length; i += CHUNK_SIZE) {
                          contentChunks.push(content.substring(i, i + CHUNK_SIZE));
                        }
                      } else {
                        contentChunks.push(content);
                      }

                      const newChapters: Chapter[] = contentChunks.map((chunk, index) => {
                        const baseTitle = file.name.replace(/\.[^/.]+$/, "");
                        const isPlan = /plan|outline|architecture|strategy|blueprint/i.test(baseTitle) || chunk.toLowerCase().includes("narrative plan");
                        
                        return {
                          id: crypto.randomUUID(),
                          title: contentChunks.length > 1 ? `${baseTitle} (Part ${index + 1})` : baseTitle,
                          summary: isPlan ? 'Strategic Narrative Architecture' : 'Auto-synthesized ingest.',
                          content: chunk,
                          order: chapters.length + index,
                          plotNodeIds: [],
                          isPlan,
                          tags: [isPlan ? 'plan' : 'ingested'],
                          updatedAt: Date.now()
                        };
                      });

                      const updatedChapters = [...chapters, ...newChapters];
                      updateChapters(updatedChapters);
                      
                      for (const ch of newChapters) {
                        if (upsertChapter) upsertChapter(ch);
                      }

                      setSelectedChapterId(newChapters[0].id);
                    } catch (err) {
                      console.error("Import failure:", err);
                      onError?.(`Artifact failed processing.`);
                    }
                  }} 
                />
              </label>
              <button 
                onClick={addChapter}
                className="p-1.5 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white rounded-md transition-all active:scale-95 border border-brand-primary/20"
                title="Add Sequence"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          {!collapsedSections.foundations && (
            <div className="space-y-2 max-h-[32dvh] overflow-y-auto custom-scrollbar pr-1">
              {chapters.map((chapter: Chapter) => (
              <div key={chapter.id} className="group relative">
                <button
                  onClick={() => handleChapterSelect(chapter.id)}
                  className={`w-full text-left px-3 py-1 rounded transition-all flex items-center gap-1.5 border ${
                    selectedChapterId === chapter.id 
                      ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary font-medium' 
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted border-transparent hover:border-border-subtle'
                  }`}
                >
                  <span className={`text-xs font-medium opacity-50 tabular-nums ${selectedChapterId === chapter.id ? 'text-brand-primary' : ''}`}>
                    {(chapter.order + 1).toString().padStart(2, '0')}
                  </span>
                  <span className="text-[11px] font-medium truncate flex-1">{chapter.title}</span>
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-all bg-surface-card border border-border-subtle rounded-md p-0.5 shadow-sm">
                  <button 
                    onClick={() => moveChapterToSource(chapter)}
                    className="p-1.5 text-text-secondary hover:text-brand-primary transition-all rounded"
                    title="Archive to Source"
                  >
                    <ArrowRight size={14} />
                  </button>
                  <button 
                    onClick={() => deleteChapter(chapter.id)}
                    className="p-1.5 text-text-secondary hover:text-red-500 transition-all rounded"
                    title="Purge Segment"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Source Ingestion Section */}
        <div className="p-3 md:p-4 flex-1 flex flex-col gap-1.5 overflow-hidden bg-surface-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-[11px] font-semibold flex items-center gap-2 text-text-primary">
                <Library size={14} className="text-brand-primary" />
                Archive & Intel
              </h3>
              <button 
                onClick={() => toggleSection('intel')}
                className="p-1 px-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors border border-border-subtle hover:border-text-secondary/30 rounded-md flex items-center gap-1 ml-2"
                title={collapsedSections.intel ? 'Restore View' : 'Collapse Section'}
              >
                {collapsedSections.intel ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                {collapsedSections.intel ? 'Show' : 'Hide'}
              </button>
            </div>
            <label className="p-1.5 hover:bg-surface-muted text-text-secondary hover:text-brand-primary rounded-md transition-all cursor-pointer border border-transparent hover:border-border-subtle" title="Add Source">
              <Plus size={14} />
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.md,.json,.yaml,.yml,.pdf" multiple />
            </label>
          </div>

          {!collapsedSections.intel && (
            <>
              {/* Search and Filter UI */}
              <div className="space-y-3">
            <div className="relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-brand-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Search Archive..." 
                value={archiveSearchTerm}
                onChange={(e) => setArchiveSearchTerm(e.target.value)}
                className="w-full bg-surface-card border border-border-subtle rounded py-2 pl-9 pr-4 text-[11px] font-medium text-text-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none placeholder:text-text-secondary/50 transition-all"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {(['All', 'Manuscript', 'Research', 'Source', 'AI Compilation'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setArchiveFilter(type)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all border ${
                    archiveFilter === type 
                      ? 'bg-brand-primary/20 border-brand-primary/30 text-brand-primary shadow-sm' 
                      : 'bg-surface-card text-text-secondary border-border-subtle hover:bg-surface-muted hover:text-text-primary'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
            {allSources.length > 0 ? (
              <div className="space-y-3">
                {allSources.map(source => (
                  <div 
                    key={source.id} 
                    onClick={() => {
                      setViewingSourceId(source.id);
                      if (isMobile) setIsLeftRailOpen(false);
                    }}
                    className="p-3 bg-surface-card rounded border border-border-subtle group relative cursor-pointer hover:border-brand-primary/50 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {(source as any).displayType === 'AI Compilation' ? (
                          <div className="w-6 h-6 rounded bg-brand-primary/10 flex items-center justify-center shrink-0">
                            <Zap className="text-brand-primary" size={14} />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded bg-surface-muted flex items-center justify-center shrink-0">
                            <FileText className="text-text-secondary" size={14} />
                          </div>
                        )}
                        <span className="text-xs font-semibold text-text-primary truncate flex-1">{source.name}</span>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed opacity-80 pl-8">
                      {source.content.slice(0, 80)}...
                    </p>
                    {(source as any).displayType !== 'AI Compilation' && (source as any).displayType !== 'Research' && (source as any).displayType !== 'Manuscript' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSource(source.id);
                        }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 text-text-secondary hover:text-red-500 transition-all bg-surface-bg border border-border-subtle rounded shadow-sm"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-text-secondary">
                <div className="w-20 h-20 bg-surface-muted rounded flex items-center justify-center mx-auto mb-2 border border-dashed border-border-subtle">
                  {archiveSearchTerm ? <Search size={28} className="opacity-20" /> : <Upload size={28} className="opacity-20" />}
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest leading-relaxed opacity-40">
                  {archiveSearchTerm ? 'No Secure Matches' : 'Ingest External\nArtifacts Here'}
                </p>
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Collaborative Presence */}
        {presence.length > 0 && (
          <div className="p-4 xl:p-4 border-t border-border-subtle ethereal-panel">
            <div className="text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
              Live Presence Matrix
            </div>
            <div className="flex -space-x-3">
              {presence.map((p) => (
                <div 
                  key={p.userId} 
                  title={p.userName}
                  className="w-10 h-10 rounded border-2 border-surface-card bg-brand-dark text-text-primary flex items-center justify-center text-xs font-semibold shadow-2xl ring-2 ring-brand-primary/20"
                >
                  {p.userName.charAt(0)}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.aside>
    )}
  </AnimatePresence>

  {/* Main Study Area */}
  {(!isMobile || mobileTab === 'editor') && (
    <div 
      className="flex-1 flex flex-col bg-surface-bg relative z-0 min-w-0"
      style={{ minHeight: 0 }}
    >
        {/* Toggle Buttons for Rails */}
        {!isMobile && !isFocusMode && !isLeftRailOpen && (
          <motion.button 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setIsLeftRailOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-[55] w-6 h-24 md:h-32 bg-brand-dark border-y border-r border-border-subtle rounded-r-xl flex items-center justify-center text-text-secondary hover:text-brand-primary transition-all hover:w-8 group shadow-2xl"
            title="Restore Navigation"
          >
            <ChevronRight size={14} className="group-hover:scale-125 transition-transform" />
          </motion.button>
        )}

        {!isMobile && !isFocusMode && !isRightRailOpen && (
          <motion.button 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setIsRightRailOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-[55] w-6 h-24 md:h-32 bg-brand-dark border-y border-l border-border-subtle rounded-l-xl flex items-center justify-center text-text-secondary hover:text-brand-primary transition-all hover:w-8 group shadow-2xl"
            title="Restore Ops Rail"
          >
            <ChevronLeft size={14} className="group-hover:scale-125 transition-transform" />
          </motion.button>
        )}

        <AnimatePresence mode="wait">
          {selectedChapter ? (
             <motion.div 
              key={selectedChapter.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden"
              style={{ minHeight: 0 }}
            >
              {/* Internal Editor Header */}
              <div className={`h-auto min-h-14 studio-header border-b border-border-subtle flex flex-wrap items-center justify-between px-3 md:px-2 lg:px-2 py-2 bg-surface-bg/95 backdrop-blur shadow-sm flex-none transition-all ${isFocusMode ? 'opacity-10 hover:opacity-100' : ''} no-print overflow-hidden gap-2`}>
                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                  {!isFocusMode && !isMobile && (
                    <button 
                      onClick={() => setIsLeftRailOpen(!isLeftRailOpen)}
                      className="p-2.5 hover:bg-white/5 text-text-secondary hover:text-brand-primary rounded border border-transparent hover:border-border-subtle transition-all active:scale-95 flex items-center gap-2 group"
                      title="Toggle Navigation Menu"
                    >
                      <Menu size={20} className={isLeftRailOpen ? 'text-brand-primary' : ''} />
                      <span className="hidden sm:inline text-xs font-medium uppercase tracking-widest group-hover:text-brand-primary transition-colors">NAV</span>
                      <ChevronRight size={14} className={isLeftRailOpen ? 'rotate-180 transition-transform opacity-50' : 'transition-transform opacity-50'} />
                    </button>
                  )}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                       <input 
                        value={localTitle}
                        onChange={(e) => setLocalTitle(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 font-semibold text-text-primary text-xs md:text-[11px] font-medium italic font-serif w-24 md:w-auto p-0 hover:text-brand-primary transition-colors cursor-text"
                      />
                      {selectedChapter.isPlan && (
                        <span className="px-2 py-0.5 bg-brand-primary/20 text-brand-primary text-[7px] font-semibold uppercase rounded border border-brand-primary/30 tracking-widest">Plan Mode</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${isSaving ? 'bg-amber-500 animate-pulse' : 'bg-brand-primary'}`} />
                      <span className="text-[7px] md:text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] md:tracking-wider leading-none opacity-40">
                        {isSaving ? 'Synchronizing' : 'Secure Connection Active'}
                      </span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 md:gap-2 ml-2 md:ml-4 border-l border-border-subtle pl-4 md:pl-6">
                    <div className="flex flex-col">
                      <span className="text-xs text-text-secondary leading-none mb-0.5">Word Count</span>
                      <span className={`text-[11px] font-medium tabular-nums transition-colors ${isOverWordLimit ? 'text-red-500' : 'text-brand-primary'}`}>
                        {wordCount.toLocaleString()}
                        {isOverWordLimit && <span className="ml-1 text-xs text-red-500">(Over Limit)</span>}
                      </span>
                    </div>
                    <div className="flex flex-col border-l border-border-subtle pl-4 md:pl-6">
                      <span className="text-xs text-text-secondary leading-none mb-0.5">Reading Time</span>
                      <span className="text-[11px] text-text-primary tabular-nums">{readingTime} mins</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-2 shrink-0 overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
                  <button 
                    onClick={handleManualSave}
                    disabled={isSaving}
                    className={`flex items-center gap-2 md:gap-1.5 px-3 md:px-2 py-2 md:py-1 rounded md:rounded text-xs md:text-xs font-semibold uppercase tracking-widest transition-all border active:scale-95 whitespace-nowrap ${
                      dirtyRef.current 
                        ? 'bg-brand-primary border-brand-primary text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]' 
                        : (isSaving ? 'bg-white/5 border-border-subtle text-brand-primary' : 'bg-surface-muted border-border-subtle text-text-secondary hover:text-text-primary hover:border-text-secondary/30')
                    }`}
                  >
                    {isSaving ? <Activity size={12} className="animate-spin text-brand-primary" /> : <Save size={12} />}
                    {isSaving ? 'Cloud...' : (dirtyRef.current ? 'Commit' : 'Synced')}
                  </button>

                  <button 
                    onClick={recenter}
                    className="p-2 md:p-3 rounded md:rounded bg-surface-muted border border-border-subtle text-text-secondary hover:text-brand-primary hover:border-brand-primary transition-all active:scale-95 shrink-0"
                    title="Re-centre Architecture"
                  >
                    <RefreshCcw size={16} />
                  </button>

                  <button 
                    onClick={toggleFocus}
                    className={`p-2 md:p-3 rounded md:rounded transition-all shrink-0 border active:scale-95 ${isFocusMode ? 'btn-nexus-primary border-brand-primary' : 'bg-surface-muted border-border-subtle text-text-secondary hover:text-text-primary hover:border-text-secondary/30'}`}
                    title="Toggle Void Focus"
                  >
                    {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>

                  <div className="h-6 w-px bg-border-subtle shrink-0 hidden md:block" />

                  {/* Plot Node Tags */}
                  <div className="relative shrink-0 hidden lg:block">
                    <button 
                      onClick={() => setShowNodePicker(!showNodePicker)}
                      className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] px-2 py-1 rounded bg-surface-muted border border-border-subtle transition-all active:scale-95 ${showNodePicker ? 'border-brand-primary text-brand-primary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                      <Tag size={14} />
                      {selectedChapter.plotNodeIds?.length || 0} Vectors
                    </button>
                    <AnimatePresence>
                      {showNodePicker && (
                        <motion.div 
                          initial={{ opacity: 0, y: 15, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-full mt-2 w-64 bg-surface-card border border-border-subtle rounded shadow-lg z-[60] p-4 backdrop-blur-xl"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-xs font-semibold text-text-primary">Linked Outline Items</h4>
                            <Tag size={14} className="text-text-secondary" />
                          </div>
                          <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                            {plotNodes.map(node => (
                              <button
                                key={node.id}
                                onClick={() => toggleNode(node.id)}
                                className={`w-full text-left px-3 py-2 rounded text-[11px] flex items-center justify-between group transition-all border ${
                                  selectedChapter.plotNodeIds?.includes(node.id) 
                                    ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary' 
                                    : 'text-text-secondary border-transparent hover:bg-surface-muted hover:text-text-primary'
                                }`}
                              >
                                {node.title}
                                {selectedChapter.plotNodeIds?.includes(node.id) ? (
                                  <Zap size={12} className="fill-current animate-pulse" />
                                ) : (
                                  <div className="w-1.5 h-1.5 rounded-full bg-border-subtle group-hover:bg-brand-primary transition-colors" />
                                )}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="h-6 w-px bg-border-subtle shrink-0 hidden lg:block" />

                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSmartWrite}
                    disabled={isWriting}
                    className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded text-[11px] font-medium transition-all active:scale-95 ${
                      isWriting ? 'bg-brand-primary text-surface-bg shadow-sm' : 'bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary'
                    }`}
                  >
                    {isWriting ? (
                      <>
                        <Activity size={14} className="animate-pulse" />
                        {writingStatus || 'Writing...'}
                      </>
                    ) : (
                      <>
                        <Zap size={14} className="fill-current" />
                        Compose
                      </>
                    )}
                  </motion.button>

                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRefine}
                    disabled={isRefining || !selectedChapter.content.trim()}
                    className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded text-[11px] font-medium transition-all shadow-sm active:scale-95 ${
                      isRefining ? 'bg-orange-600 text-white' : 'bg-surface-muted hover:bg-white/5 text-text-primary border border-border-subtle'
                    }`}
                    title="Deep Quality Refinement"
                  >
                    {isRefining ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {writingStatus || 'Simmering...'}
                      </>
                    ) : (
                      <>
                        <Activity size={14} />
                        Refine
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
              <div 
                className="flex-1 flex overflow-hidden lg:flex-row flex-col relative"
                style={{ minHeight: 0 }}
              >
                <div 
                  className={`flex-1 flex flex-col writing-scroll ${isFocusMode ? 'p-4 md:p-4 lg:px-14 lg:py-3' : 'p-4 md:p-4 lg:px-2 xl:px-20 2xl:px-32 lg:py-1 xl:py-16'} overflow-y-auto overscroll-contain w-full custom-scrollbar relative transition-all duration-500 pb-32`}
                  style={{ minHeight: 0 }}
                >
                   <div className="w-full max-w-[80ch] mx-auto flex flex-col items-center">
                  {/* Summary Box */}
                  <div className="max-w-[80ch] w-full mb-3 opacity-70 focus-within:opacity-100 hover:opacity-100 transition-all duration-300 p-4 sm:p-4 bg-surface-card border border-border-subtle hover:border-brand-primary/20 rounded relative">
                    {/* Prose Analysis Flyout */}
                    <AnimatePresence>
                      {showProsePanel && (
                        <motion.div 
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="absolute right-0 lg:left-[calc(100%+1rem)] top-full lg:top-0 w-full lg:w-72 bg-surface-card border border-border-subtle rounded shadow-xl p-4 z-[90] mt-4 lg:mt-0"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary flex items-center gap-2">
                              {sceneTurnResult ? <Flame size={14} /> : <CircleSlash size={14} />}
                              {sceneTurnResult ? "Scene Reversal Meter" : "The Sludge Filter"}
                            </h4>
                            <button onClick={() => { setShowProsePanel(false); setSceneTurnResult(null); }} className="text-text-secondary hover:text-text-primary">
                              <X size={14} />
                            </button>
                          </div>

                          {isAnalyzingProse || isCheckingTurn ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center">
                              <Activity className="text-brand-primary animate-pulse mb-1.5" size={32} />
                              <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                                {isCheckingTurn ? "Analyzing Narrative Engine..." : "Scanning for pretty sludge..."}
                              </p>
                            </div>
                          ) : sceneTurnResult ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Reversal Intensity</div>
                                <div className={`text-[11px] font-medium font-semibold italic font-serif ${sceneTurnResult.turned ? 'text-brand-primary' : 'text-red-500'}`}>
                                  {sceneTurnResult.score}%
                                </div>
                              </div>
                              
                              <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${sceneTurnResult.score}%` }}
                                  className={`h-full ${sceneTurnResult.turned ? 'bg-brand-primary' : 'bg-red-500'}`}
                                />
                              </div>

                              <div className="space-y-1.5">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-1">Reasoning</p>
                                  <p className="text-xs text-text-primary leading-relaxed italic">"{sceneTurnResult.reasoning}"</p>
                                </div>
                                {!sceneTurnResult.turned && (
                                  <div className="p-4 bg-red-500/5 border border-red-500/20 rounded">
                                    <p className="text-xs font-semibold uppercase tracking-widest text-red-500 mb-1">Critical Missing Component</p>
                                    <p className="text-xs text-text-secondary leading-relaxed font-serif uppercase tracking-tighter">{sceneTurnResult.missing}</p>
                                  </div>
                                )}
                              </div>

                              <button 
                                onClick={handleCheckTurn}
                                className="w-full py-2 bg-surface-muted hover:ethereal-panel border border-border-subtle rounded text-xs font-semibold uppercase tracking-widest text-text-primary transition-all flex items-center justify-center gap-2"
                              >
                                <RefreshCcw size={12} />
                                Re-Scan Sequence
                              </button>
                            </div>
                          ) : proseViolations.length > 0 ? (
                            <div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                              {proseViolations.map((v, i) => (
                                <div key={i} className={`p-4 rounded border ${
                                  v.severity === 'high' ? 'bg-red-500/5 border-red-500/20' : 
                                  v.severity === 'medium' ? 'bg-orange-500/5 border-orange-500/20' : 
                                  'bg-brand-primary/5 border-brand-primary/20'
                                }`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle size={12} className={v.severity === 'high' ? 'text-red-500' : 'text-orange-500'} />
                                    <span className="text-xs font-semibold uppercase tracking-widest text-text-primary">{v.type}</span>
                                  </div>
                                  <p className="text-xs text-text-secondary leading-relaxed capitalize">{v.message}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-20 flex flex-col items-center justify-center text-center">
                              <Sparkles className="text-brand-primary mb-1.5" size={32} />
                              <p className="text-xs font-semibold uppercase tracking-widest text-text-primary">No sludge detected.</p>
                              <p className="text-xs text-text-secondary mt-2">Your prose is surgical.</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="flex items-center gap-2 text-xs font-semibold text-brand-primary mb-1.5">
                      <FileText size={14} />
                      Chapter Architecture
                    </div>
                    <textarea 
                      value={localSummary}
                      onChange={(e) => setLocalSummary(e.target.value)}
                      placeholder="Define the primary intelligence vector for this sequence..."
                      className="w-full bg-transparent border-t border-border-subtle/30 py-2 text-text-primary text-[11px] font-medium md:text-[11px] font-medium resize-none focus:ring-0 outline-none placeholder:text-text-secondary/40 leading-relaxed font-serif italic"
                      rows={2}
                    />
                  </div>
 
                  {/* Writing Area */}
                  <div className="max-w-[80ch] w-full flex flex-col pb-60">
                    <AnimatePresence>
                      {hasDraft && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mb-2 p-4 bg-brand-primary/10 border border-brand-primary/20 rounded flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-3 bg-brand-primary/20 rounded">
                              <Sparkles size={20} className="text-brand-primary" />
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-text-primary italic font-serif">Unsaved Draft Detected</p>
                              <p className="text-xs text-text-secondary font-medium uppercase tracking-widest mt-1">Local version is more detailed than cloud state.</p>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <button 
                              onClick={discardDraft}
                              className="px-2 py-2 text-xs font-semibold uppercase tracking-widest text-text-secondary hover:text-red-500 transition-all"
                            >
                              Discard
                            </button>
                            <button 
                              onClick={restoreDraft}
                              className="px-2 py-2 btn-nexus-primary rounded text-xs font-semibold uppercase tracking-widest shadow-lg shadow-brand-primary/20 transition-all active:scale-95"
                            >
                              Restore Draft
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <textarea 
                      ref={editorRef}
                      value={localContent}
                      onChange={(e) => setLocalContent(e.target.value)}
                      placeholder="Initialize narrative thread..."
                      className="w-full h-auto min-h-[65dvh] bg-transparent border-none focus:ring-0 text-sm md:text-base text-text-primary leading-relaxed resize-none outline-none font-serif placeholder:text-text-secondary/35 selection:bg-brand-primary/30 overflow-hidden"
                      spellCheck={true}
                    />
                  </div>
                </div>
              </div>


                {/* Right Rail - Analysis & Actions */}
                <AnimatePresence>
                  {!isFocusMode && (isMobile ? mobileTab === 'ops' : isRightRailOpen) && (
                    <motion.div 
                      key="right-rail"
                      initial={isMobile ? { opacity: 0 } : { width: 0, opacity: 0 }}
                      animate={{ width: isMobile ? '100%' : 'clamp(13rem, 18vw, 15.5rem)', opacity: 1 }}
                      exit={isMobile ? { opacity: 0 } : { width: 0, opacity: 0 }}
                      transition={{ type: "spring", damping: 30, stiffness: 300 }}
                      className={`h-full border-l border-border-subtle ethereal-panel flex flex-col z-30 shrink-0 relative overflow-hidden ${isMobile ? 'w-full h-full relative border-none' : 'relative'}`}
                    >
                      <AnimatePresence>
                        {isMobile && isRightRailOpen && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsRightRailOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[-1]"
                          />
                        )}
                      </AnimatePresence>
                      <div className="p-3 md:p-4 border-b border-border-subtle flex items-center justify-between shrink-0">
                        <span className="text-xs font-semibold text-brand-primary uppercase tracking-widest">Strategic Ops</span>
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="text-brand-primary animate-pulse" />
                          {!isMobile && (
                            <button 
                              onClick={() => setIsRightRailOpen(false)}
                              className="p-2.5 sm:p-1 hover:bg-white/5 rounded sm:rounded-md text-text-secondary hover:text-brand-primary flex items-center justify-center min-w-[36px] min-h-[36px]"
                              title="Collapse Ops Rail"
                            >
                              <ChevronRight size={20} className="sm:w-4 sm:h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-4 xl:p-4 space-y-3 md:space-y-1.5 xl:space-y-5">
                        <button 
                          onClick={handleAnalyzeProse}
                          disabled={isAnalyzingProse}
                          className={`w-full p-4 h-32 rounded border transition-all active:scale-95 group shadow-xl relative flex flex-col items-center justify-center gap-1.5 bg-surface-muted/30 ${
                            isAnalyzingProse ? 'animate-pulse border-brand-primary bg-brand-primary/5' : 'hover:border-brand-primary hover:bg-brand-primary/5'
                          }`}
                        >
                          <CircleSlash size={32} className={isAnalyzingProse ? 'text-brand-primary' : 'text-text-secondary group-hover:text-brand-primary'} />
                          <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary group-hover:text-brand-primary">The Sludge Filter</span>
                        </button>

                        <button 
                          onClick={handleCheckTurn}
                          disabled={isCheckingTurn}
                          className={`w-full p-4 h-32 rounded border transition-all active:scale-95 group shadow-xl relative flex flex-col items-center justify-center gap-1.5 bg-surface-muted/30 ${
                            isCheckingTurn ? 'animate-pulse border-brand-primary bg-brand-primary/5' : 'hover:border-brand-primary hover:bg-brand-primary/5'
                          }`}
                        >
                          <Flame size={32} className={isCheckingTurn ? 'text-brand-primary' : 'text-text-secondary group-hover:text-brand-primary'} />
                          <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary group-hover:text-brand-primary">Reversal Meter</span>
                        </button>

                        <div className="h-px bg-border-subtle mx-4" />

                        <button 
                          onClick={handleCritique}
                          disabled={isCritiquing}
                          className="w-full p-4 bg-brand-dark border border-border-subtle text-text-secondary hover:text-brand-primary hover:border-brand-primary rounded shadow-xl active:scale-95 transition-all group flex flex-col items-center justify-center gap-1.5"
                        >
                          <Users size={32} className={isCritiquing ? 'animate-pulse' : ''} />
                          <span className="text-xs font-semibold uppercase tracking-widest">Narrative Swarm</span>
                        </button>

                         <button 
                          onClick={() => {/* Deep Scan */}}
                          className="w-full p-4 bg-brand-dark border border-border-subtle text-text-secondary hover:text-brand-primary hover:border-brand-primary rounded shadow-xl active:scale-95 transition-all group flex flex-col items-center justify-center gap-2 opacity-30 cursor-not-allowed"
                          title="DNA Mapping - Architectural Analysis (Coming Soon)"
                        >
                          <Fingerprint size={32} />
                          <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary/50">DNA Mapping</span>
                          <span className="text-[7px] font-semibold uppercase tracking-widest text-brand-primary/40 -mt-2">Coming Soon</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mobile Bottom Bar for Actions */}
                {!isFocusMode && !isMobile && (
                  <div className="lg:hidden fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 flex items-center gap-1.5 ethereal-panel/90 backdrop-blur-xl border border-border-subtle p-2 rounded shadow-2xl z-[80] max-w-[95vw] overflow-x-auto no-scrollbar">
                    <button onClick={recenter} className="p-3.5 text-text-secondary hover:text-brand-primary min-w-[44px] min-h-[44px] flex items-center justify-center" title="Recenter workspace"><RefreshCcw size={20} /></button>
                    <button onClick={handleAnalyzeProse} className="p-3.5 text-text-secondary hover:text-brand-primary min-w-[44px] min-h-[44px] flex items-center justify-center" title="Analyze Prose"><CircleSlash size={20} /></button>
                    <button onClick={handleCheckTurn} className="p-3.5 text-text-secondary hover:text-brand-primary min-w-[44px] min-h-[44px] flex items-center justify-center" title="Check Scene Reversal"><Flame size={20} /></button>
                    <button onClick={handleSmartWrite} className="p-4 btn-nexus-primary rounded min-w-[48px] min-h-[48px] flex items-center justify-center" title="Compose with Caspa"><Zap size={20} /></button>
                    <button onClick={handleRefine} className="p-3.5 text-text-secondary hover:text-brand-primary min-w-[44px] min-h-[44px] flex items-center justify-center" title="Refine Prose"><Repeat size={20} /></button>
                    <button onClick={handleCritique} className="p-3.5 text-text-secondary hover:text-brand-primary min-w-[44px] min-h-[44px] flex items-center justify-center" title="Show critiques"><Users size={20} /></button>
                  </div>
                )}

                {/* Critique Sidebar */}
                <AnimatePresence>
                  {(isMobile ? mobileTab === 'critiques' : showCritique) && (
                    <motion.div 
                      key="critique"
                      initial={isMobile ? { opacity: 0 } : { width: 0, opacity: 0 }}
                      animate={{ width: isMobile ? '100%' : 'clamp(20rem, 30vw, 26rem)', opacity: 1 }}
                      exit={isMobile ? { opacity: 0 } : { width: 0, opacity: 0 }}
                      transition={{ type: "spring", damping: 30, stiffness: 300 }}
                      className={`border-l border-border-subtle bg-brand-dark flex flex-col overflow-hidden h-full relative ${isMobile ? 'w-full h-full relative border-none z-30 shadow-none' : 'z-[150] shadow-[-40px_0_100px_rgba(0,0,0,0.5)]'}`}
                    >
                      <AnimatePresence>
                        {isMobile && showCritique && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCritique(false)}
                            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[-1]"
                          />
                        )}
                      </AnimatePresence>
                      <div className="p-4 md:p-4 border-b border-border-subtle flex items-center justify-between bg-surface-bg shadow-sm">
                        <div className="flex flex-col">
                          <h3 className="text-[11px] font-semibold text-brand-primary flex items-center gap-2 mb-0.5">
                            <Zap size={14} className="fill-brand-primary" />
                            Case Narrative
                          </h3>
                          <span className="text-xs text-text-secondary opacity-70">Spectral Analysis</span>
                        </div>
                        <button 
                          onClick={() => { if (isMobile) { setMobileTab('editor'); } else { setShowCritique(false); } }} 
                          className="p-1.5 text-text-secondary hover:text-white transition-colors bg-surface-muted hover:bg-red-500 rounded border border-transparent hover:border-red-600 shadow-sm active:scale-95 group z-[100]"
                          title="Close Analysis"
                        >
                          <X size={16} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform" />
                        </button>
                      </div>
                      <div className="p-4 md:p-4 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                        {isCritiquing ? (
                          <div className="h-full flex flex-col items-center justify-center gap-2">
                             <div className="relative">
                               <motion.div 
                                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute inset-0 bg-brand-primary rounded-full blur-2xl" 
                              />
                              <Activity size={32} className="text-brand-primary animate-pulse relative z-10" />
                             </div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary animate-pulse">Analyzing...</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="prose prose-sm prose-invert max-w-none text-text-secondary/90 prose-strong:text-text-primary prose-headings:text-brand-primary prose-headings:font-semibold border-b border-border-subtle pb-8">
                              <Markdown>{critiqueText}</Markdown>
                            </div>

                            {/* Suggestions */}
                            {(project.critiques || {})[selectedChapter.id]?.[0]?.suggestions.length > 0 && (
                              <div className="space-y-1.5">
                                <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2">
                                  <Flame size={14} className="text-brand-primary" />
                                  Actionable Suggestions
                                </h4>
                                <div className="space-y-3">
                                  {(project.critiques || {})[selectedChapter.id][0].suggestions.map((s: any, idx: number) => (
                                    <div key={idx} className="flex gap-1.5 text-xs text-text-secondary bg-surface-card p-4 rounded border border-border-subtle group hover:border-brand-primary/40 transition-colors shadow-sm">
                                      <span className="font-medium text-brand-primary opacity-60 group-hover:opacity-100 transition-opacity">{(idx + 1).toString().padStart(2, '0')}</span>
                                      <p className="leading-relaxed">{s.text}</p>
                                    </div>
                                  ))}
                                </div>
                                <button 
                                  onClick={applySuggestionsToChapter}
                                  className="w-full py-2 btn-nexus-primary flex items-center justify-center gap-2 mt-6 active:scale-95"
                                >
                                  <Zap size={14} className="text-white fill-current" />
                                  Synthesize Refined Draft
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 bg-surface-bg relative">
              <div className="relative group">
                <Library size={80} strokeWidth={1} className="text-text-secondary opacity-20 mb-3 relative z-10" />
              </div>
              <div className="max-w-md space-y-1.5 relative z-10">
                <h3 className="text-[11px] font-medium font-medium text-text-primary italic font-serif tracking-tight">No Chapters Selected</h3>
                <p className="text-[11px] text-text-secondary opacity-80">Add a new chapter sequence to begin drafting.</p>
                <div className="pt-6">
                  <button 
                    onClick={addChapter}
                    className="px-2 py-1 btn-nexus-primary flex items-center justify-center gap-2 mx-auto"
                  >
                    <Plus size={16} />
                    New Sequence
                  </button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* Source Viewer Modal */}
      <AnimatePresence>
        {viewingSource && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface-bg w-full max-w-4xl h-[80vh] rounded overflow-hidden shadow-2xl flex flex-col border border-border-subtle"
            >
              <div className="p-4 md:p-4 border-b border-border-subtle flex items-center justify-between bg-surface-card">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded flex items-center justify-center border border-brand-primary/20">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary text-[11px] mb-0.5">{viewingSource.name}</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-xs text-brand-primary font-medium px-2 py-0.5 bg-brand-primary/10 rounded-md border border-brand-primary/20 tabular-nums">
                         ID: {viewingSource.id.slice(0, 8)}
                       </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingSourceId(null)}
                  className="w-10 h-10 flex items-center justify-center rounded hover:bg-surface-muted text-text-secondary hover:text-text-primary transition-all border border-transparent hover:border-border-subtle active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-4 custom-scrollbar bg-surface-bg">
                <div className="max-w-[75ch] mx-auto">
                  <div className="text-text-primary/90 leading-[1.8] font-serif whitespace-pre-wrap text-[11px] font-medium selection:bg-brand-primary/30">
                    {viewingSource.content}
                  </div>
                </div>
              </div>
              <div className="p-4 bg-surface-card border-t border-border-subtle flex justify-end">
                <button 
                  onClick={() => setViewingSourceId(null)}
                  className="px-2 py-2 btn-nexus-primary rounded flex items-center justify-center gap-2 active:scale-95"
                >
                  Close
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
