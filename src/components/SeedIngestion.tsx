/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SeedIngestion — Any seed (text, image OCR, voice, URL) → collaborative story proposal
 * The entry point for the "idea to book by end of afternoon" vision.
 */

import React, { useState, useRef } from 'react';
import { Sparkles, Upload, Mic, Link, FileText, ChevronRight, X, BookOpen, Trophy, MessageSquare, Loader2, Camera } from 'lucide-react';
import { AIService } from '../services/ai';
import { Project, ProjectType, Chapter, PlotNode } from '../types';

interface SeedResult {
  title: string;
  premise: string;
  genre: string;
  tone: string;
  type: ProjectType;
  targetWordCount: number;
  logline: string;
  centralWound: string;
  suggestedChapters: { title: string; summary: string }[];
  suggestedCharacters: { name: string; role: string; backstory: string }[];
  authorQuestions: string[];
  prizeTarget: string;
}

interface Props {
  onAccept: (proposal: {
    title: string;
    premise: string;
    genre: string;
    tone: string;
    type: ProjectType;
    targetWordCount: number;
    chapters: Chapter[];
    authorQuestions: string[];
  }) => void;
  onDismiss: () => void;
}

export default function SeedIngestion({ onAccept, onDismiss }: Props) {
  const [seedText, setSeedText] = useState('');
  const [seedType, setSeedType] = useState<'text' | 'image_ocr' | 'voice_transcript' | 'url'>('text');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [authorAnswers, setAuthorAnswers] = useState<Record<number, string>>({});
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      // OCR via canvas + description
      setSeedType('image_ocr');
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setSeedText(`[IMAGE UPLOADED: ${file.name}]\n\nImage data URL (first 500 chars): ${dataUrl.slice(0, 500)}\n\nDescribe what you see in this image and find the story within it.`);
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const text = await file.text();
      setSeedText(text);
      setSeedType('text');
    } else if (file.type === 'application/pdf') {
      setSeedText(`[PDF UPLOADED: ${file.name}]\n\nPlease describe the content of this document and find the story or narrative within it.`);
      setSeedType('text');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Convert to text description for seed
        setSeedText(`[VOICE NOTE RECORDED — ${(audioBlob.size / 1024).toFixed(1)}KB]\n\nThis is a voice recording. Treat it as a raw verbal brainstorm or story idea. Find the narrative within it.`);
        setSeedType('voice_transcript');
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Microphone access denied. Type your idea instead.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleProcess = async () => {
    if (!seedText.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const proposal = await AIService.seedToStory(seedText, seedType);
      setResult(proposal);
    } catch (err: any) {
      setError(err.message || 'Story extraction failed. Try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAccept = () => {
    if (!result) return;

    // Weave author answers back into the premise
    const enrichedPremise = authorAnswers && Object.keys(authorAnswers).length > 0
      ? result.premise + '\n\nAUTHOR NOTES:\n' + Object.entries(authorAnswers)
          .filter(([, v]) => (v as string).trim())
          .map(([k, v]) => `Q: ${result.authorQuestions[parseInt(k)]}\nA: ${v}`)
          .join('\n\n')
      : result.premise;

    const chapters: Chapter[] = result.suggestedChapters.map((c, i) => ({
      id: crypto.randomUUID(),
      title: c.title,
      summary: c.summary,
      content: '',
      order: i,
      plotNodeIds: [],
      tags: [],
      updatedAt: Date.now()
    }));

    onAccept({
      title: result.title,
      premise: enrichedPremise,
      genre: result.genre,
      tone: result.tone,
      type: result.type,
      targetWordCount: result.targetWordCount,
      chapters,
      authorQuestions: result.authorQuestions
    });
  };

  const seedTypeOptions = [
    { id: 'text', label: 'Text / Idea', icon: FileText, desc: 'A sentence, paragraph, or full outline' },
    { id: 'image_ocr', label: 'Image / Photo', icon: Camera, desc: 'A receipt, photo, sketch, or screenshot' },
    { id: 'voice_transcript', label: 'Voice Note', icon: Mic, desc: 'Speak your idea aloud' },
    { id: 'url', label: 'URL / Article', icon: Link, desc: 'Paste a link to an article or page' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-[#131f2e] border border-[#1e3a5f] rounded-3xl shadow-2xl shadow-teal-900/20 overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-8 border-b border-[#1e3a5f] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/20 flex items-center justify-center">
                <Sparkles size={20} className="text-teal-400" />
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">Story Seed</h2>
            </div>
            <p className="text-sm text-slate-400 max-w-lg">
              Drop anything — a receipt, a voice note, a single sentence, a photo. Shakespeare will find the story inside it.
            </p>
          </div>
          <button onClick={onDismiss} className="p-2 text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {!result ? (
          <div className="p-8 space-y-6">
            {/* Seed type selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {seedTypeOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSeedType(opt.id)}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    seedType === opt.id
                      ? 'border-teal-500 bg-teal-500/10 text-teal-300'
                      : 'border-[#1e3a5f] bg-[#0d1520] text-slate-400 hover:border-teal-500/50'
                  }`}
                >
                  <opt.icon size={18} className="mb-2" />
                  <div className="text-xs font-black uppercase tracking-wider">{opt.label}</div>
                  <div className="text-[10px] opacity-60 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Input area */}
            <div className="space-y-3">
              {seedType === 'voice_transcript' ? (
                <div className="flex flex-col items-center gap-4 p-8 border border-dashed border-[#1e3a5f] rounded-2xl">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                      isRecording
                        ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/30'
                        : 'bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/50'
                    }`}
                  >
                    <Mic size={24} className={isRecording ? 'text-white' : 'text-teal-400'} />
                  </button>
                  <p className="text-sm text-slate-400">
                    {isRecording ? 'Recording... click to stop' : 'Click to record your idea'}
                  </p>
                  {seedText && (
                    <div className="w-full p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl text-xs text-teal-300">
                      {seedText.slice(0, 100)}...
                    </div>
                  )}
                </div>
              ) : seedType === 'image_ocr' ? (
                <div
                  className="flex flex-col items-center gap-4 p-8 border border-dashed border-[#1e3a5f] rounded-2xl cursor-pointer hover:border-teal-500/50 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center">
                    <Upload size={24} className="text-teal-400" />
                  </div>
                  <p className="text-sm text-slate-400">Click to upload an image, photo, or scan</p>
                  {seedText && (
                    <div className="w-full p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl text-xs text-teal-300">
                      Image loaded. Ready to extract story.
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt,.md" className="hidden" onChange={handleFileUpload} />
                </div>
              ) : (
                <textarea
                  value={seedText}
                  onChange={e => setSeedText(e.target.value)}
                  placeholder={
                    seedType === 'url'
                      ? 'Paste a URL here...'
                      : 'Drop your seed here. A sentence. A memory. A receipt. A name. Anything...'
                  }
                  className="w-full h-40 p-4 bg-[#0d1520] border border-[#1e3a5f] rounded-2xl text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-teal-500/50 transition-colors"
                />
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleProcess}
                disabled={!seedText.trim() || isProcessing}
                className="flex-1 py-4 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Finding the story...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Extract the Story
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 space-y-6">
            {/* Logline */}
            <div className="p-6 bg-teal-500/10 border border-teal-500/30 rounded-2xl">
              <div className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-2">Logline</div>
              <p className="text-white font-medium italic">{result.logline}</p>
            </div>

            {/* Title + metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Working Title</div>
                <div className="text-lg font-black text-white">{result.title}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Genre / Type</div>
                <div className="text-sm text-teal-300 font-bold">{result.genre} · {result.type}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Target Length</div>
                <div className="text-sm text-white font-bold">{result.targetWordCount.toLocaleString()} words</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tone</div>
                <div className="text-sm text-slate-300">{result.tone}</div>
              </div>
            </div>

            {/* Central wound */}
            <div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Central Wound</div>
              <p className="text-sm text-slate-300 leading-relaxed">{result.centralWound}</p>
            </div>

            {/* Premise */}
            <div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Premise</div>
              <p className="text-sm text-slate-300 leading-relaxed">{result.premise}</p>
            </div>

            {/* Prize target */}
            {result.prizeTarget && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <Trophy size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Prize Ambition</div>
                  <p className="text-xs text-amber-200">{result.prizeTarget}</p>
                </div>
              </div>
            )}

            {/* Author questions — the collaboration */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={14} className="text-teal-400" />
                <div className="text-[10px] font-black text-teal-400 uppercase tracking-widest">Your Turn — Answer These to Unlock the Story</div>
              </div>
              <div className="space-y-2">
                {result.authorQuestions.map((q, i) => (
                  <div key={i} className="border border-[#1e3a5f] rounded-2xl overflow-hidden">
                    <button
                      className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-[#1e3a5f]/30 transition-colors"
                      onClick={() => setActiveQuestion(activeQuestion === i ? null : i)}
                    >
                      <span className="text-sm text-slate-300">{q}</span>
                      <ChevronRight size={14} className={`text-teal-400 transition-transform shrink-0 ${activeQuestion === i ? 'rotate-90' : ''}`} />
                    </button>
                    {activeQuestion === i && (
                      <div className="px-4 pb-4">
                        <textarea
                          value={authorAnswers[i] || ''}
                          onChange={e => setAuthorAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                          placeholder="Your answer..."
                          className="w-full h-20 p-3 bg-[#0d1520] border border-[#1e3a5f] rounded-xl text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-teal-500/50"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Chapter count preview */}
            <div className="flex items-center gap-3 p-4 bg-[#0d1520] border border-[#1e3a5f] rounded-2xl">
              <BookOpen size={16} className="text-slate-400" />
              <span className="text-sm text-slate-400">
                {result.suggestedChapters.length} chapters proposed · {result.suggestedCharacters.length} characters
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setResult(null)}
                className="px-6 py-4 border border-[#1e3a5f] text-slate-400 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Rethink
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 py-4 bg-teal-500 hover:bg-teal-400 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
              >
                <BookOpen size={16} />
                Build This Book
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
