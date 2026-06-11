import React, { useState, useRef } from 'react';
import { ShieldCheck, Zap, AlertCircle, CheckCircle2, ChevronRight, Play, Wand2, Hammer, Activity, FileUp, Target, Plus, X, Flame, Scissors, Sparkles } from 'lucide-react';
import { Project, Chapter, ProjectType, ResearchNote, Character, ExternalReview } from '../types';
import { calculateSimilarity, findRedundantChapters } from '../lib/narrativeUtils';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

interface Props {
  project: Project;
  chapters: Chapter[];
  research: ResearchNote[];
  updateProject: (updates: Partial<Project>) => void;
  updateChapters: (chaps: Chapter[]) => void;
  updatePlotNodes: (nodes: any[]) => void;
  onImportCharacters?: (chars: Character[]) => Promise<void>;
  onAddResearch?: (note: ResearchNote) => Promise<void>;
  setView: (view: any) => void;
  onError?: (msg: string) => void;
}

export default function ManuscriptFixer({ project, chapters, research, updateProject, updateChapters, updatePlotNodes, onImportCharacters, onAddResearch, setView, onError }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [autoPilot, setAutoPilot] = useState(false);
  const [isDeepDrafting, setIsDeepDrafting] = useState(false);
  const [isSlowCooking, setIsSlowCooking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isRestructuring, setIsRestructuring] = useState(false);

  const handleRipUp = async () => {
    if (!confirm("CRITICAL WARNING: This will liquidate your current chapters and plot nodes. Your core story will be restructured from the ground up. Proceed?")) return;
    
    setIsRestructuring(true);
    addLog("System: Initializing RIP UP AND START AGAIN protocol...");
    try {
      const { plotNodes, chapters: newChapters, research: newResearch } = await AIService.ripUpAndRestart(project, chapters, research);
      
      addLog("Success: Narrative architecture liquidated and replaced.");
      addLog(`Reconstructed: ${newChapters.length} chapters, ${plotNodes.length} nodes, ${newResearch.length} creative sources.`);
      
      updatePlotNodes(plotNodes);
      updateChapters(newChapters);
      
      if (onAddResearch && newResearch.length > 0) {
        for (const res of newResearch) {
          await onAddResearch(res);
        }
      }
    } catch (err: any) {
      console.error(err);
      addLog(`Fatal: Restructure sequence failed. ${err.message}`);
    } finally {
      setIsRestructuring(false);
    }
  };

  const runSlowCooker = async () => {
    setIsSlowCooking(true);
    addLog("System: Initializing SLOW COOKER [Economy Auto-Draft Mode]...");
    try {
      let updatedChaps = [...chapters];
      const emptyChapters = chapters.filter(c => !c.content.trim());
      
      if (emptyChapters.length === 0) {
        addLog("Status: No empty chapters found. The structure is fully drafted.");
        return;
      }

      addLog(`Analysis: Found ${emptyChapters.length} unwritten chapters. 'Simmering' to completion...`);

      for (const chap of emptyChapters) {
        addLog(`Simmering: Chapter ${chap.order + 1} - "${chap.title}"...`);
        
        // ECONOMY CONTEXT: Use only the last 1500 characters of the preceding chapters.
        const earlierContent = updatedChaps
          .filter(c => c.order < chap.order)
          .map(c => c.content)
          .join('\n\n')
          .slice(-1500);

        // ECONOMY: Omit source materials to save token cost
        const content = await AIService.writeDraft(
          chap.title,
          chap.summary,
          earlierContent,
          project.type,
          [],
          research,
          project.maturity,
          [], 
          chap.directives || [],
          project.targetWordCount,
          [],
          project.draftStage,
          chapters.length,
          project.cutMode
        );

        updatedChaps = updatedChaps.map(c => c.id === chap.id ? { ...c, content, updatedAt: Date.now() } : c);
        await updateChapters(updatedChaps);
        addLog(`Success: Synthesized Chapter ${chap.order + 1} (Economy Mode).`);
      }
      
      addLog("System: Slow Cooker chapter production complete. Structure filled.");
    } catch (err: any) {
      console.error(err);
      const msg = `Slow Cooker process interrupted. ${err.message || ""}`;
      addLog(`Error: ${msg}`);
      onError?.(msg);
    } finally {
      setIsSlowCooking(false);
    }
  };

  const handleManualImport = async () => {
    if (!pasteContent.trim()) return;
    const mockFile = new File([pasteContent], "manual_paste.txt", { type: "text/plain" });
    processFile(mockFile);
    setShowManualPaste(false);
  };

  const processFile = async (file: File, bypassAI = false) => {
    if (!file) return;
    setIsImporting(true);
    setAnalysis(null);
    setLogs([]); 
    addLog(`System IO: Initializing stream for ${file.name}...`);
    addLog(`File Profile: ${(file.size / 1024).toFixed(1)} KB | Type: ${file.type || 'plain/text'}`);
    if (bypassAI) addLog("Bypass Active: Sequential fragmentation engaged.");
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const fullText = (event.target?.result as string) || "";
          if (!fullText.trim()) {
            addLog("IO Error: Manuscript content is null or empty.");
            setIsImporting(false);
            return;
          }

          addLog(`IO Success: ${fullText.length.toLocaleString()} characters buffered.`);
          
          // JSON Plan Detection
          if (file.type === 'application/json' || file.name.endsWith('.json')) {
            addLog("System IO: Detected JSON Plan artifact. Parsing structure...");
            try {
              const data = JSON.parse(fullText);
              if (data.chapters && Array.isArray(data.chapters)) {
                addLog(`Success: Found ${data.chapters.length} chapters in JSON plan.`);
                const mappedChapters: Chapter[] = data.chapters.map((c: any, i: number) => ({
                  id: crypto.randomUUID(),
                  title: c.title || `Chapter ${i + 1}`,
                  summary: c.summary || c.description || "",
                  content: "",
                  directives: c.directives || (c.beats ? c.beats : []),
                  order: i,
                  plotNodeIds: [],
                  isPlan: true,
                  updatedAt: Date.now()
                }));

                await updateChapters(mappedChapters);

                // Auto-seed characters if present
                if (data.characters && Array.isArray(data.characters)) {
                  addLog(`Success: Found ${data.characters.length} characters in plan. Seeding archive...`);
                  const mappedCharacters: Character[] = data.characters.map((c: any, i: number) => ({
                    id: c.id || crypto.randomUUID(),
                    name: (c.name && c.name !== 'Unknown' && !/^character\s*\d+$/i.test(c.name)) ? c.name : (c.role ? `${c.role.split(' ')[0]}_${(i+1)}` : `Char_${(i+1)}`),
                    role: c.role || 'Supporting',
                    backstory: c.backstory || '',
                    traits: c.traits || [],
                    goals: c.goals || [],
                    fears: c.fears || [],
                    motivations: c.motivations || [],
                    quirks: c.quirks || [],
                    archetype: c.archetype || 'Unknown',
                    updatedAt: Date.now()
                  }));
                  
                  if (onImportCharacters) {
                    await onImportCharacters(mappedCharacters);
                  }
                }

                addLog("Ingestion Sequence: 100% COMPLETE (JSON Plan Mode).");
                setAnalysis(`## Ingestion Successful: JSON Plan Detected\n\nYour project structure has been seeded from the provided JSON file. **${mappedChapters.length} Chapters** have been initialized with instructions and summary context.`);
                setIsImporting(false);
                return;
              }
            } catch (e) {
              addLog("Warning: JSON parsing failed or schema mismatch. Falling back to default extraction.");
            }
          }

          let isPlan = false;
          if (!bypassAI) {
            addLog("AI Core: Detecting artifact typology...");
            const type = await AIService.detectIngestionType(fullText);
            isPlan = type === 'plan';
            addLog(`Detected Archetype: ${isPlan ? "STRUCTURAL PLAN / BLUEPRINT" : "RAW MANUSCRIPT / DRAFT"}`);
          }

          addLog("Phase 1: Detecting narrative architecture...");
          
          let finalSegments: { title: string; summary: string; marker: string; directives?: string[] }[] = [];
          
          if (!bypassAI) {
            try {
              addLog(`AI Core: Sourcing structural markers (${isPlan ? "Instructional" : "Neural"})...`);
              const segments = await AIService.splitManuscript(fullText, project.type, isPlan);
              if (segments && segments.length > 0) {
                finalSegments = segments;
                addLog(`AI Core Success: Found ${segments.length} logical boundaries.`);
              } else {
                addLog("AI Core responded with empty structure payload.");
              }
            } catch (err: any) {
              console.error("AI Split Error:", err);
              const msg = err.message || "Handshake failure";
              addLog(`AI Core Blocked: ${msg}.`);
              onError?.(`Neural Analysis Error: ${msg}`);
            }
          }
            
          if (finalSegments.length === 0) {
            addLog(bypassAI ? "Direct fragmentation engaged." : "Engaging fallback: Detecting boundary patterns (Regex)...");
            const chapterRegex = /(?:Chapter|CHAPTER|SECTION|Section|Part|PART)\s+([0-9A-Z]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)|(?:\n\n|^)(?:\* \* \*|# |### |---)(?:\n\n|$)/g;
            const matches = bypassAI ? [] : [...fullText.matchAll(chapterRegex)];
            
            if (matches.length >= 2) {
              addLog(`Pattern Match Success: Detected ${matches.length} boundaries.`);
              finalSegments = matches.map((m, i) => {
                const title = m[1] ? `Chapter ${m[1]}` : `Section ${i + 1}`;
                const markerSnippet = fullText.slice(m.index, m.index + 120);
                return {
                  title,
                  summary: "Imported via pattern matching.",
                  marker: markerSnippet
                };
              });
            } else {
              if (!bypassAI) addLog("Deterministic patterns absent. Executing density-based fragmentation...");
              const chunks = fullText.split(/\n\n\n+/);
              if (chunks.length > 2 && !bypassAI) {
                addLog(`Density Success: Fragmenting into ${chunks.length} blocks.`);
                finalSegments = chunks.map((c, i) => ({
                  title: `Sequence ${i + 1}`,
                  summary: "Imported via density-based chunking.",
                  marker: c.slice(0, 100)
                }));
              } else {
                addLog(`Info: Applying sequential blocks (10k char segments)...`);
                const pageSize = 10000;
                for (let i = 0; i < fullText.length; i += pageSize) {
                  finalSegments.push({
                    title: `Draft Fragment ${Math.floor(i / pageSize) + 1}`,
                    summary: "Forced split for monolithic text.",
                    marker: fullText.slice(i, i + 80)
                  });
                }
              }
            }
          }

          addLog(`Architecture: ${finalSegments.length} nodes ready for reconstruction.`);
            
          const generateId = () => {
             try { return crypto.randomUUID(); } 
             catch (e) { return Math.random().toString(36).substring(2) + Date.now().toString(36); }
          };

          const newChapters: Chapter[] = finalSegments.map((seg, i) => {
            const nextSeg = finalSegments[i + 1];
            let content = "";
            const normalize = (str: string) => (str || "").replace(/\s+/g, ' ').trim();
            const normalizedFullText = normalize(fullText);
            const normalizedMarker = normalize(seg.marker);
            const normalizedStartIndex = normalizedFullText.indexOf(normalizedMarker);
            
            if (normalizedStartIndex !== -1) {
              const escapedMarker = (seg.marker || "")
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\s+/g, '\\s+');
              
              const markerRegex = new RegExp(escapedMarker, 'g');
              const match = markerRegex.exec(fullText);
              
              if (match) {
                const startIndex = match.index;
                let endIndex = fullText.length;
                
                if (nextSeg) {
                   const nextEscapedMarker = (nextSeg.marker || "")
                    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    .replace(/\s+/g, '\\s+');
                  const nextRegex = new RegExp(nextEscapedMarker, 'g');
                  nextRegex.lastIndex = startIndex + match[0].length;
                  const nextMatch = nextRegex.exec(fullText);
                  if (nextMatch) {
                    endIndex = nextMatch.index;
                  } else {
                    const lowerFullText = fullText.toLowerCase();
                    const lowerMarker = (nextSeg.marker || "").toLowerCase().slice(0, 30);
                    if (lowerMarker) {
                      const fuzzyNext = lowerFullText.indexOf(lowerMarker, startIndex + match[0].length);
                      if (fuzzyNext !== -1) endIndex = fuzzyNext;
                    }
                  }
                }
                content = fullText.slice(startIndex, endIndex).trim();
              } else {
                const simpleStart = fullText.indexOf(seg.marker);
                if (simpleStart !== -1) {
                   let nextIndex = fullText.length;
                   if (nextSeg) {
                     const nextSimple = fullText.indexOf(nextSeg.marker, simpleStart + 1);
                     if (nextSimple !== -1) nextIndex = nextSimple;
                   }
                   content = fullText.slice(simpleStart, nextIndex).trim();
                } else {
                  content = `[INGESTION WARNING: CONTENT CONTINUITY AT RISK]`;
                }
              }
            } else {
              content = `[FRAGMENT RECOVERY FAILED: Marker not resolved]`;
            }

            return {
              id: generateId(),
              title: seg.title || `Chapter ${i + 1}`,
              summary: seg.summary || "Imported content.",
              content: isPlan ? "" : content,
              directives: isPlan ? (seg.directives || [content]) : [],
              order: i,
              plotNodeIds: [],
              tags: isPlan ? ['plan-imported'] : ['bulk-imported'],
              updatedAt: Date.now()
            };
          });
          
          addLog(`Phase 2: Synchronizing ${newChapters.length} chapters to cloud...`);
          await updateChapters(newChapters);
          addLog("Ingestion Sequence: 100% COMPLETE.");
          
          setAnalysis(`## Ingestion Successful
Your ${isPlan ? "**Structural Plan**" : "manuscript"} has been parsed into **${finalSegments.length} chapters**. 

**Diagnostic Overview:**
- Source Method: ${isPlan ? "Instructional Extraction" : (bypassAI ? "Manual Sequential" : (finalSegments.length > 5 ? "Neural Analysis" : "Structural Recovery"))}
- Artifact Typology: ${isPlan ? "PLAN (Prioritizing Directions)" : "MANUSCRIPT (Prioritizing Word Count)"}
- Character Count: ${fullText.length.toLocaleString()}
- Node Density: ${Math.round(fullText.length / finalSegments.length)} chars/node

${isPlan ? "\n**Plan Instruction Protocol Active:** The system will now prioritize your specific chapter instructions over generic word count targets during drafting." : "Go to the **Writing Studio** to review the reconstructed chapters."}`);
        } catch (innerErr) {
          console.error("Internal processing error:", innerErr);
          addLog(`Process Error: ${innerErr instanceof Error ? innerErr.message : "Structure corrupted"}`);
        } finally {
          setIsImporting(false);
        }
      };
      reader.onerror = () => {
        addLog("FileReader Error: Access denied or storage failure.");
        setIsImporting(false);
      };
      reader.readAsText(file);
    } catch (err) {
      console.error(err);
      addLog("Fatal IO: Kernel crash during ingestion.");
      setIsImporting(false);
    }
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const runFinishAndFix = async () => {
    setIsFixing(true);
    addLog("Initializing Global Manuscript Scan...");
    try {
      const result = await AIService.finishAndFix(chapters, project.type, project.sourceMaterials || []);
      setAnalysis(result);
      addLog("Analysis complete. Found structural opportunities.");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Analysis failed";
      addLog(`Error during analysis: ${msg}`);
      onError?.(msg);
    } finally {
      setIsFixing(false);
    }
  };

  const startAutoPilot = async () => {
    setAutoPilot(true);
    addLog("Engaging Auto-Pilot: Staged Narrative Expansion Protocol...");
    try {
      // Phase 1: Scan research notes for brainstorm/structural directives
      addLog("Phase 1: Harvesting structural directives from research...");
      const brainstormDirectives = research
        .filter(r => r.category === 'brainstorm' || r.tags?.includes('structural') || r.tags?.includes('brainstorm'))
        .map(r => r.content);

      // Phase 2: Find structural gaps
      addLog("Phase 2: Surveying architecture for narrative gaps...");
      const beats = await AIService.automateNextSteps(project, chapters, analysis || undefined);
      let workingChapters = [...chapters];
      
      if (beats && beats.length > 0) {
        addLog(`Architecture: Found ${beats.length} missing narrative turns. Inserting beats...`);
        for (const beat of beats) {
          const newChap: Chapter = {
            id: crypto.randomUUID(),
            title: beat.title || "Untitled Resolution",
            summary: beat.summary || "No summary provided.",
            content: '',
            order: workingChapters.length,
            plotNodeIds: [],
            directives: beat.directives || [],
            tags: ['automated-finalization'],
            updatedAt: Date.now()
          };
          workingChapters.push(newChap);
        }
        await updateChapters(workingChapters);
        addLog("System Sync: New architecture committed to cloud registry.");
      }

      // Phase 3: Identify chapters needing prose
      addLog("Phase 3: Identifying skeletal chapters needing prose synthesis...");
      const chaptersNeedingProse = workingChapters.filter(c => !c.content.trim() || c.content.split(/\s+/).length < 200);
      
      if (chaptersNeedingProse.length === 0) {
        addLog("Status: Functional parity achieved. No chapters require drafting.");
        return;
      }

      // Phase 4: Target Logic
      const totalWordsTarget = project.targetWordCount || 50000;
      const totalChapters = workingChapters.length || 25;
      const wordsPerChapter = Math.round(totalWordsTarget / totalChapters);
      addLog(`Phase 4: Global Word Count Target locked at ~${wordsPerChapter.toLocaleString()} words/chapter.`);

      // Phase 5: Loop through all chapters needing prose
      addLog(`Phase 5: Initiating Staged Drafting for ${chaptersNeedingProse.length} chapters...`);
      let totalWordsWritten = 0;

      for (const chap of chaptersNeedingProse) {
        addLog(`Synthesis: Drafting "${chap.title}"...`);
        
        const earlierContent = workingChapters
          .filter(c => c.order < chap.order)
          .map(c => c.content)
          .join('\n\n')
          .slice(-5000);

        const mergedDirectives = [...(chap.directives || []), ...brainstormDirectives];

        try {
          const autoReviews: ExternalReview[] = analysis ? [
            {
              id: 'global-scan',
              source: 'Manuscript Analysis',
              content: analysis,
              date: Date.now(),
              isImplemented: false
            }
          ] : [];

          const content = await AIService.writeDraft(
            chap.title,
            chap.summary,
            earlierContent,
            project.type,
            [], // activeNodes
            research,
            project.maturity,
            project.sourceMaterials || [],
            mergedDirectives,
            project.targetWordCount || 50000,
            autoReviews,
            project.draftStage,
            totalChapters,
            project.cutMode
          );

          const draftWordCount = content.split(/\s+/).length;
          totalWordsWritten += draftWordCount;
          
          workingChapters = workingChapters.map(c => c.id === chap.id ? { ...c, content, updatedAt: Date.now() } : c);
          await updateChapters(workingChapters);
          addLog(`Success: "${chap.title}" saved. [${draftWordCount} words generated]`);
        } catch (err: any) {
          addLog(`Warning: Failed to draft ${chap.title}. Attempting skip...`);
          console.error(err);
        }
      }

      addLog(`Auto-Pilot COMPLETE. Total generated: ${totalWordsWritten.toLocaleString()} words vs Target: ${(wordsPerChapter * chaptersNeedingProse.length).toLocaleString()}.`);

      // NEXT BOOK PROMPT LOGIC
      const currentTotalWords = workingChapters.reduce((sum, c) => sum + (c.content?.split(/\s+/).length || 0), 0);
      const isNearTarget = currentTotalWords >= (project.targetWordCount || 50000) * 0.9;
      const isLastChapterDrafted = chaptersNeedingProse.some(c => c.order === workingChapters.length - 1);

      if (isNearTarget && isLastChapterDrafted) {
        addLog("System: Final Volume threshold reached. Generating transitional potential assessment...");
        const sequelConcept = await AIService.brainstormSequel(project, workingChapters);
        setAnalysis(prev => prev + `\n\n---\n\n### 📚 Beyond the Horizon: Sequel Potential\n\nThe manuscript has achieved cohesive structural closure. The narrative engine suggests a transitional pivot for a sequel:\n\n${sequelConcept}\n\n**Would you like to initialize the architecture for Volume II?**`);
      }
    } catch (err: any) {
      console.error('Auto-Pilot Failure:', err);
      const msg = err.message || "Auto-Pilot sequence interrupted";
      addLog(`Fatal: ${msg}`);
      onError?.(msg);
    } finally {
      setAutoPilot(false);
    }
  };

  const runDeepDraft = async () => {
    setIsDeepDrafting(true);
    addLog("Initializing Deep Draft sequence...");
    try {
      const emptyChapters = chapters.filter(c => !c.content.trim());
      if (emptyChapters.length === 0) {
        addLog("No empty chapters found. Manuscript is fully drafted.");
        return;
      }

      addLog(`Found ${emptyChapters.length} chapters to draft. Starting synthesis...`);
      let updatedChaps = [...chapters];

      for (const chap of emptyChapters) {
        addLog(`Drafting: ${chap.title}...`);
        
        const earlierContent = updatedChaps
          .filter(c => c.order < chap.order)
          .map(c => c.content)
          .join('\n\n')
          .slice(-5000);

        try {
          const content = await AIService.writeDraft(
            chap.title,
            chap.summary,
            earlierContent,
            project.type,
            [], // activeNodes placeholder
            research,
            project.maturity,
            project.sourceMaterials || [],
            chap.directives || [],
            project.targetWordCount,
            [],
            project.draftStage,
            chapters.length,
            project.cutMode
          );

          // Update local copy
          updatedChaps = updatedChaps.map(c => c.id === chap.id ? { ...c, content, updatedAt: Date.now() } : c);
          
          // Trigger the app-level update (which persists to cloud)
          // Note: In App.tsx, updateChapters currently calls upsertChapterBatch for the whole list.
          // This ensures "auto saves along the way" as requested.
          await updateChapters(updatedChaps);
          addLog(`Checkpoint saved: ${chap.title}.`);
        } catch (err: any) {
          addLog(`Warning: Failed to draft ${chap.title}. Attempting to proceed...`);
          console.error(err);
        }
      }
      addLog("Deep Draft series complete. The manuscript is fully synchronized.");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "AI exhaustion";
      addLog(`Deep Draft interrupted: ${msg}`);
      onError?.(msg);
    } finally {
      setIsDeepDrafting(false);
    }
  };

  const [isFixingBadBook, setIsFixingBadBook] = useState(false);

  const [fixProgress, setFixProgress] = useState(0);

  const runFixBadBook = async () => {
    setIsFixingBadBook(true);
    setFixProgress(0);
    addLog("System: Initializing FIX A BAD BOOK sequence...");
    addLog("This macro will execute Prize Targeting, Outline Architecture, Continuity Sweeps, and Deep Drafting sequentially.");
    try {
      // Step 1: Prize Targeting
      setFixProgress(5);
      addLog("Phase 1/5: Assessing Prize Worthiness & Word Count Targets...");
      const prizeAssessments = await AIService.assessPrizeWorthiness(project, chapters);
      if (prizeAssessments.length > 0) {
        addLog(`Prize targeted: ${prizeAssessments[0].prizeName}. Alignment: ${prizeAssessments[0].eligibilityScore}%`);
        addLog(`Focusing edits on: ${prizeAssessments[0].recommendation}`);
        
        // AUTO-SET TARGETS: If a prize expects a specific word count, we align the project architecture.
        const suggestedTarget = prizeAssessments[0].targetWordCount || project.targetWordCount || 50000;
        await updateProject({ 
          prizeAssessments, 
          targetPrize: prizeAssessments[0].prizeName,
          targetWordCount: suggestedTarget
        });
        addLog(`Intelligence Update: Word Target synchronized to ${suggestedTarget.toLocaleString()} words.`);
      } else {
        addLog("Prize Assessment yielded generic targets. Proceeding.");
      }

      // Step 2: Plot Outlining
      setFixProgress(20);
      addLog("Phase 2/5: Extracting structural vulnerabilities...");
      const newNodes = await AIService.outlinePlotNodes({ ...project, plotNodes: [] }, chapters, research);
      await updatePlotNodes(newNodes);
      addLog(`Architected ${newNodes.length} new Plot Nodes.`);

      // Step 3: Reconcile Chapters
      setFixProgress(40);
      addLog("Phase 3/5: Reconciling chapters with new structural logic...");
      const rawBeats = await AIService.reconcileChapters(project, newNodes, chapters, research);
      
      // De-duplicate beats by title or high similarity
      const uniqueBeats: { title: string; summary: string; plotNodeIds: string[] }[] = [];
      for (const beat of rawBeats) {
        const isDuplicate = uniqueBeats.some(b => 
          b.title.toLowerCase() === beat.title.toLowerCase() || 
          calculateSimilarity(b.summary, beat.summary) > 0.7
        );
        if (!isDuplicate) {
          uniqueBeats.push(beat);
        } else {
          addLog(`Skipped redundant chapter structure: "${beat.title}"`);
        }
      }

      const newChapters: Chapter[] = uniqueBeats.map((beat, index) => {
        const existingChap = chapters.find(c => c.title === beat.title);
        return {
          id: existingChap?.id || crypto.randomUUID(),
          title: beat.title,
          summary: beat.summary,
          content: existingChap?.content || "",
          order: index,
          plotNodeIds: beat.plotNodeIds,
          tags: existingChap?.tags || [],
          updatedAt: Date.now()
        };
      });
      await updateChapters(newChapters);
      addLog(`Manuscript realigned into ${newChapters.length} chapters.`);

      // Step 4: Continuity Sweep
      setFixProgress(60);
      addLog("Phase 4/5: Executing Swarm Continuity Pass...");
      const continuityReport = await AIService.analyzeContinuity(newNodes, newChapters, research);
      addLog("Continuity analysis complete. Swarm logic integrated.");

      // Step 5: Deep Draft
      setFixProgress(75);
      addLog("Phase 5/5: Engaging Deep Draft generation for missing sequences...");
      const emptyChapters = newChapters.filter(c => !c.content.trim() || c.content.length < 500);
      
      if (emptyChapters.length > 0) {
        let updatedChaps = [...newChapters];
        let i = 0;
        for (const chap of emptyChapters) {
          const subProgress = 75 + ((i / emptyChapters.length) * 20);
          setFixProgress(subProgress);
          addLog(`[${i+1}/${emptyChapters.length}] Re-drafting: Chapter ${chap.order + 1} - "${chap.title}"... (AI processing)`);
          
          const earlierContent = updatedChaps
            .filter(c => c.order < chap.order)
            .map(c => c.content)
            .join('\n\n')
            .slice(-3000);
          
          const activeChapterNodes = newNodes.filter(n => (chap.plotNodeIds || []).includes(n.id));

          // In Fix a Bad Book, bypass the draft stages and aim directly for the final target (100%)
          // because it expects to generate the final missing content in one go.
          const draftStageValue = 4;
          const stagePct = 1.0;
          const targetChapterWords = Math.round((project.targetWordCount || 50000) * stagePct / Math.max(1, newChapters.length));
          
          let content = "";
          let currentWords = 0;
          let iterations = 0;
          const maxIterations = 8; // Increased to allow multiple appends

          while (iterations < maxIterations) {
            const iterationDirectives = [...(chap.directives || [])];
            let isAppending = false;
            
            if (iterations > 0) {
              const diff = currentWords - targetChapterWords;
              if (Math.abs(diff) / targetChapterWords <= 0.02) {
                break;
              }
              
              addLog(`[${i+1}/${emptyChapters.length}] Adjusting (Iteration ${iterations + 1}): Got ${currentWords} words, Target ${targetChapterWords}...`);
              
              // Give a small break between runs to avoid rate limits and let the system breathe
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              if (diff > 0) {
                iterationDirectives.push(`CRITICAL: The current draft is ${currentWords} words. It MUST BE exactly ${targetChapterWords} words (you are over by ${diff} words). You must CUT and COMPRESS the scene to meet the exact word count. Do not lose the narrative thread. Ban all filler and cut aggressively.`);
                iterationDirectives.push(`PREVIOUS ATTEMPT TEXT FOR REVISION:\n${content}`);
              } else {
                if (Math.abs(diff) > 300) {
                  isAppending = true;
                  iterationDirectives.push(`CRITICAL CONTINUATION REQUIRED: You are short by ${Math.abs(diff)} words. DO NOT REWRITE THE PREVIOUS SCENE. You MUST CONTINUE the narrative from where the previous text left off. Expand the plot organically, introduce new sub-conflicts, explore the character's internal wound, and propel the story forward. DO NOT just pad with words. ONLY output the continuation, DO NOT output the previous text.`);
                } else {
                  iterationDirectives.push(`CRITICAL: The current draft is ${currentWords} words. It MUST BE exactly ${targetChapterWords} words (you are short by ${Math.abs(diff)} words). Do NOT pad with useless adjectives, purple prose, or looped internal monologue. Instead, EXPAND STRUCTURALLY: deepen the subtext, escalate the tension, reveal the character's hidden wound, or add a necessary complication. Keep prose lean, precise, and sharp.`);
                  iterationDirectives.push(`PREVIOUS ATTEMPT TEXT FOR REVISION:\n${content}`);
                }
              }
            }

            const generated = await AIService.writeDraft(
              chap.title,
              chap.summary + `\n\nCONTINUITY DIRECTIVE:\n${continuityReport.slice(0, 500)}` + (isAppending ? `\n\nCONTINUING FROM PREVIOUS TEXT: Pick up exactly where the last paragraph left off.` : ""),
              isAppending ? (earlierContent + "\n\n" + content) : earlierContent,
              project.type,
              activeChapterNodes,
              research,
              project.maturity,
              project.sourceMaterials || [],
              iterationDirectives,
              project.targetWordCount,
              [],
              4, // Force draft stage 4 (100% target)
              newChapters.length,
              project.cutMode
            );
            
            if (isAppending) {
              content = content + "\n\n" + generated;
            } else {
              content = generated;
            }
            
            currentWords = content.split(/\s+/).filter(w => w.length > 0).length;
            iterations++;
            
            if (Math.abs(currentWords - targetChapterWords) / targetChapterWords <= 0.02) {
              addLog(`[${i+1}/${emptyChapters.length}] Target achieved: ${currentWords} words (within 2% margin).`);
              break;
            } else if (iterations === maxIterations) {
              addLog(`[${i+1}/${emptyChapters.length}] Max iterations reached. Final words: ${currentWords} (Target: ${targetChapterWords})`);
            }
          }
          
          updatedChaps = updatedChaps.map(c => c.id === chap.id ? { ...c, content, updatedAt: Date.now() } : c);
          await updateChapters(updatedChaps);
          addLog(`Success: Drafted Chapter ${chap.order + 1}. Moving to next...`);
          
          if (i < emptyChapters.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Brief delay to prevent rate limiting
          }
          i++;
        }
      }

      setFixProgress(100);
      addLog("System: FIX A BAD BOOK sequence completed. Manuscript is primed for export.");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Sequence failed.";
      addLog(`Total Overhaul interrupted: ${msg}`);
      onError?.(msg);
    } finally {
      setIsFixingBadBook(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto overscroll-contain custom-scrollbar pb-4" style={{ minHeight: 0 }}>
      <div className="max-w-5xl mx-auto py-2 px-2 md:px-2.5 relative">
      <header className="mb-1.5 text-center">
        <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-brand-primary/10 border border-brand-primary/20 rounded-full mb-2">
          <ShieldCheck size={12} className="text-brand-primary" />
          <span className="text-[10px] font-semibold text-brand-primary uppercase tracking-widest">Protocol Engine</span>
        </div>
        <h1 className="text-xs font-semibold font-semibold text-text-primary mb-1 tracking-tight italic font-serif">Finish & Fix <span className="text-[10px] not-italic text-text-secondary font-sans tracking-normal opacity-30">v2.55 Cloud</span></h1>
        
        {isFixingBadBook && (
          <div className="max-w-md mx-auto mt-4 mb-1.5 space-y-2">
            <div className="h-1.5 w-full bg-surface-muted rounded-full overflow-hidden shadow-inner border border-border-subtle">
              <motion.div 
                className="h-full bg-brand-primary"
                initial={{ width: 0 }}
                animate={{ width: `${fixProgress}%` }}
                transition={{ type: "spring", bounce: 0, duration: 0.5 }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-semibold uppercase tracking-widest text-brand-primary">
              <span>Macro Overhaul: {fixProgress < 20 ? 'Targeting' : fixProgress < 40 ? 'Architecting' : fixProgress < 60 ? 'Reconciling' : fixProgress < 75 ? 'Continuity' : 'Deep Drafting'}</span>
              <span className="tabular-nums">{Math.round(fixProgress)}%</span>
            </div>
          </div>
        )}

        <p className="text-text-secondary max-w-2xl mx-auto font-medium text-xs opacity-70">
          Neural integrity analysis. Automated structural reconciliation. Swarm drafting.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5 md:gap-1.5">
        <div className="lg:col-span-1 space-y-3">
          <div className="ethereal-panel p-4 rounded border border-border-subtle shadow-lg">
            <h3 className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-3 flex items-center gap-2 opacity-50">
              <Zap size={12} className="text-amber-500" />
              Directives
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={runFixBadBook}
                disabled={isFixingBadBook}
                className={`w-full flex items-center justify-between p-3 rounded-md transition-all group ${
                  isFixingBadBook ? 'bg-surface-muted text-text-secondary' : 'bg-red-600/95 text-white hover:bg-red-600 shadow-md active:scale-95'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Target size={16} className="shrink-0" />
                  <span className="text-xs font-medium text-left leading-tight uppercase tracking-wider">
                    {isFixingBadBook ? `Overhaul: ${Math.round(fixProgress)}%` : 'Fix a Bad Book'}
                  </span>
                </div>
                {isFixingBadBook ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Activity size={14} />
                  </motion.div>
                ) : <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform shrink-0" />}
              </button>

              <button 
                onClick={runFinishAndFix}
                disabled={isFixing}
                className={`w-full flex items-center justify-between p-3 rounded-md transition-all group ${
                  isFixing ? 'bg-surface-muted text-text-secondary' : 'bg-brand-dark text-text-primary hover:bg-black border border-border-subtle active:scale-95'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Hammer size={16} className="shrink-0" />
                  <span className="text-xs font-medium uppercase tracking-wider">Manuscript Scan</span>
                </div>
                {isFixing ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Activity size={14} />
                  </motion.div>
                ) : <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform shrink-0" />}
              </button>

              <button 
                onClick={startAutoPilot}
                disabled={autoPilot}
                className={`w-full flex items-center justify-between p-3 rounded-md transition-all group ${
                  autoPilot ? 'bg-surface-muted text-text-secondary' : 'btn-nexus-primary active:scale-95'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Play size={16} className="shrink-0" />
                  <span className="text-xs font-medium uppercase tracking-wider">Auto-Pilot Finish</span>
                </div>
                {autoPilot ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Activity size={14} />
                  </motion.div>
                ) : <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform shrink-0" />}
              </button>

              <button 
                onClick={handleRipUp}
                disabled={isRestructuring}
                className={`w-full flex items-center justify-between p-3 rounded-md transition-all group ${
                   isRestructuring ? 'bg-surface-muted text-text-secondary' : 'bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-500/20 active:scale-95'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Flame size={16} className={`shrink-0 ${isRestructuring ? 'animate-pulse' : ''}`} />
                  <span className="text-xs font-medium uppercase tracking-wider">Full Restructure</span>
                </div>
                {!isRestructuring && <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform shrink-0" />}
              </button>
            </div>
          </div>
          
          <div className="bg-brand-dark/40 p-3 rounded shadow-sm border border-border-subtle">
            <h3 className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2 flex items-center gap-2 opacity-30">
              <Activity size={12} className="text-emerald-500" />
              Pulse Logs
            </h3>
            <div className="space-y-1 font-mono h-20 overflow-y-auto custom-scrollbar">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[7px] text-text-secondary opacity-20 uppercase tracking-widest">Standby...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-[10px] text-emerald-400 last:text-emerald-300 line-clamp-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {analysis ? (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="ethereal-panel p-3 rounded border border-border-subtle shadow-xl min-h-[280px] relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-2 pb-4 border-b border-border-subtle">
                  <h2 className="text-xs font-semibold font-semibold text-text-primary italic font-serif tracking-tight">System Report</h2>
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                    <CheckCircle2 size={14} />
                    Synchronized
                  </div>
                </div>
                <div className="markdown-body prose prose-invert prose-brand max-w-none italic">
                  <Markdown>{analysis}</Markdown>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-8">
                  <button 
                    onClick={() => setView('writing')}
                    className="w-full py-1 bg-brand-primary hover:bg-brand-accent text-white rounded font-semibold text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95"
                  >
                    Enter Writing Studio
                  </button>
                  <button 
                    onClick={() => setView('scalpel')}
                    className="w-full py-1 bg-red-600 hover:bg-red-500 text-white rounded font-semibold text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Scissors size={18} />
                    The Scalpel
                  </button>
                </div>
              </motion.div>
            ) : isImporting || isFixing ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-3 text-center ethereal-panel rounded border border-border-subtle shadow-inner">
                <img src="/skeleton_writer.gif" alt="Skeleton Writer" className="h-32 w-auto mb-3 drop-shadow-2xl" referrerPolicy="no-referrer" />
                <h3 className="text-[11px] font-semibold font-semibold text-text-primary mb-1.5 tracking-tight italic font-serif">Processing Manuscript...</h3>
                <p className="text-text-secondary max-w-sm font-medium opacity-60 italic mb-3"> neural core fragments the narrative architecture...</p>
                <div className="w-full max-w-md h-1.5 bg-surface-muted rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 10 }} className="h-full bg-brand-primary" />
                </div>
              </div>
            ) : (
              <div 
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); handleDrop(e as any); }}
                className={`h-full min-h-[250px] flex flex-col items-center justify-center p-2 text-center rounded-md border-2 border-dashed transition-all relative overflow-hidden group ${
                  dragActive ? 'border-brand-primary bg-brand-primary/5' : 'border-border-subtle ethereal-panel hover:border-text-secondary/30'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  multiple 
                  onChange={(e) => {
                    if (e.target.files) {
                      const fileList = Array.from(e.target.files);
                      fileList.forEach(file => processFile(file));
                    }
                  }} 
                />
                <img src="/skeleton_writer.gif" alt="Skeleton" className="h-20 w-auto mb-2 opacity-30 group-hover:opacity-60 transition-opacity grayscale hover:grayscale-0" referrerPolicy="no-referrer" />
                <p className="text-xs font-semibold font-semibold text-text-primary italic font-serif">Awaiting Ingestion Signal</p>
                <div className="flex flex-col items-center gap-2 mt-4">
                  <p className="text-xs text-text-secondary font-semibold uppercase tracking-widest opacity-40">Drag and drop artifacts to begin</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] font-semibold text-brand-primary uppercase tracking-widest hover:underline hover:opacity-100 transition-all opacity-60"
                  >
                    Or select files manually
                  </button>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 md:px-2.5 mt-8">
        <section className="ethereal-panel p-3 rounded-md border border-brand-primary/20 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-[0.05]">
            <Target size={100} className="text-brand-primary" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-5">
              <div className="p-2 bg-brand-primary/10 rounded-md text-brand-primary">
                <Sparkles size={18} />
              </div>
              <h2 className="text-lg font-semibold text-text-primary uppercase tracking-tight italic font-serif">Narrative Pulse Diagnostics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {[
                { 
                  label: 'Wound Check', 
                  desc: 'Identifying core trauma driving character masks.',
                  status: project.premise?.length > 50 ? 'Calibrated' : 'Syncing',
                  color: 'text-brand-primary'
                },
                { 
                  label: 'Subtext Engine', 
                  desc: 'Detecting evasion & manipulation in dialogue.',
                  status: chapters.some(c => c.content.includes('"')) ? 'Flux Detected' : 'Silent',
                  color: 'text-amber-500'
                },
                { 
                  label: 'Momentum Pass', 
                  desc: 'Escalating irreversible narrative costs.',
                  status: chapters.length > 5 ? 'Steady' : 'Building',
                  color: 'text-emerald-500'
                }
              ].map((item, i) => (
                <div key={i} className="bg-surface-muted/30 border border-border-subtle p-4 rounded-md space-y-2 group hover:border-brand-primary/20 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-text-primary">{item.label}</span>
                    <span className={`text-[7px] font-semibold uppercase tracking-widest ${item.color} bg-white/5 px-2 py-0.5 rounded-full border border-current opacity-60`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-secondary leading-relaxed opacity-60">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">Neural subtext check active in background...</span>
              </div>
              <button 
                onClick={runFinishAndFix}
                className="px-2 py-2 bg-brand-primary text-white text-[10px] font-semibold uppercase tracking-widest rounded shadow-lg shadow-brand-primary/10 hover:scale-105 active:scale-95 transition-all"
              >
                Neural Scan
              </button>
            </div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showManualPaste && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-brand-dark/95 backdrop-blur-2xl">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="w-full max-w-4xl ethereal-panel border border-border-subtle rounded-md p-3 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold font-semibold text-text-primary italic font-serif">Manual Injection</h3>
                <button onClick={() => setShowManualPaste(false)} className="p-3 bg-surface-muted rounded-md transition-all border border-border-subtle">
                  <X size={20} />
                </button>
              </div>
              <textarea 
                value={pasteContent} 
                onChange={(e) => setPasteContent(e.target.value)} 
                className="w-full h-96 bg-brand-dark border border-border-subtle rounded-md p-2 text-text-primary focus:ring-2 focus:ring-brand-primary/20 outline-none resize-none"
              />
              <div className="flex justify-end gap-1.5 mt-10">
                <button onClick={handleManualImport} className="px-2.5 py-1 btn-nexus-primary font-semibold text-xs uppercase tracking-widest rounded active:scale-95">
                  Neural Fragmentation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
  );
}
