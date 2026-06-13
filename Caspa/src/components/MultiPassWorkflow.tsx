/**
 * Multi-Pass Workflow Component
 * Orchestrates the 5-stage iterative refinement pipeline
 */

import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Zap, Loader, CheckCircle } from 'lucide-react';
import { PassResult, multiPassOrchestrator } from '../services/multiPassOrchestrator';

interface MultiPassWorkflowProps {
  projectId: string;
  manuscript: string;
  targetWordCount: number;
  aiService: any;
  onPassComplete?: (result: PassResult) => void;
}

export const MultiPassWorkflow: React.FC<MultiPassWorkflowProps> = ({
  projectId,
  manuscript,
  targetWordCount,
  aiService,
  onPassComplete,
}) => {
  const [running, isRunning] = useState(false);
  const [paused, isPaused] = useState(false);
  const [passes, setPasses] = useState<PassResult[]>([]);
  const [currentPass, setCurrentPass] = useState<number | null>(null);
  const [currentPassProgress, setCurrentPassProgress] = useState(0);

  useEffect(() => {
    multiPassOrchestrator.setProjectId(projectId);
    loadPasses();
  }, [projectId]);

  const loadPasses = async () => {
    try {
      const results = await multiPassOrchestrator.getProjectPasses(projectId);
      setPasses(results);
    } catch (error) {
      console.error('Failed to load passes:', error);
    }
  };

  const handleStartPipeline = async () => {
    if (!manuscript.trim()) {
      alert('Please write or load a manuscript first');
      return;
    }

    isRunning(true);
    setCurrentPass(null);
    setPasses([]);

    try {
      const results = await multiPassOrchestrator.runCompletePipeline(
        manuscript,
        targetWordCount,
        aiService,
        (result: PassResult) => {
          setPasses(prev => [...prev, result]);
          setCurrentPass(null);

          if (onPassComplete) {
            onPassComplete(result);
          }

          // Reset progress for next pass
          setCurrentPassProgress(0);
        }
      );

      console.log('Pipeline complete:', results);
    } catch (error) {
      console.error('Pipeline failed:', error);
      alert('Pipeline encountered an error: ' + (error as Error).message);
    } finally {
      isRunning(false);
      setCurrentPass(null);
    }
  };

  const handlePause = () => {
    isPaused(!paused);
  };

  const handleReset = () => {
    if (confirm('Reset all passes? This cannot be undone.')) {
      setPasses([]);
      setCurrentPass(null);
      isRunning(false);
      isPaused(false);
    }
  };

  const passDescriptions: Record<number, { title: string; description: string }> = {
    1: {
      title: 'Foundation (50%)',
      description: 'Establish premise, protagonist, and main conflict. Trim ruthlessly.',
    },
    2: {
      title: 'Character & World (75%)',
      description: 'Deepen backstories, enrich dialogue, build world details.',
    },
    3: {
      title: 'Psychological Influence (85%)',
      description: 'Add emotional depth, moral complexity, psychological architecture.',
    },
    4: {
      title: 'Polish & Precision (95%)',
      description: 'Perfect prose, verify continuity, ensure research accuracy.',
    },
    5: {
      title: 'Mrs. Parry Edit (Final)',
      description: 'Ruthless cutting: remove 25-40%, keep only what earns its place.',
    },
  };

  const getPassStatus = (passNumber: number): 'complete' | 'current' | 'pending' => {
    const pass = passes.find(p => p.passNumber === passNumber);
    if (pass) return 'complete';
    if (currentPass === passNumber) return 'current';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
          <Zap className="w-6 h-6" />
          Multi-Pass Refiner
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          5-stage iterative pipeline: foundation → character → psychology → polish → ruthless edit
        </p>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleStartPipeline}
          disabled={running}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-6 rounded-lg flex items-center gap-2 transition"
        >
          {running ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Start Pipeline
            </>
          )}
        </button>

        {running && (
          <button
            onClick={handlePause}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center gap-2 transition"
          >
            <Pause className="w-5 h-5" />
            {paused ? 'Resume' : 'Pause'}
          </button>
        )}

        {passes.length > 0 && (
          <button
            onClick={handleReset}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center gap-2 transition"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </button>
        )}
      </div>

      {/* Passes Timeline */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(passNumber => {
          const status = getPassStatus(passNumber);
          const pass = passes.find(p => p.passNumber === passNumber);
          const info = passDescriptions[passNumber];

          return (
            <div
              key={passNumber}
              className={`border-2 rounded-lg p-4 transition ${
                status === 'complete'
                  ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900'
                  : status === 'current'
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {status === 'complete' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : status === 'current' ? (
                      <Loader className="w-5 h-5 animate-spin text-blue-600" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-400" />
                    )}
                    <h3 className="font-bold text-lg">{info.title}</h3>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    {info.description}
                  </p>

                  {status === 'current' && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-300 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition"
                          style={{ width: `${currentPassProgress}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold">
                        {Math.round(currentPassProgress)}%
                      </span>
                    </div>
                  )}
                </div>

                {pass && (
                  <div className="text-right ml-4">
                    <div className="text-sm font-semibold">
                      {pass.originalWordCount} → {pass.resultWordCount} words
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Quality: {Math.round(pass.qualityScore)}%
                    </div>
                  </div>
                )}
              </div>

              {/* Pass Details */}
              {pass && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                  <p className="text-sm">{pass.summary}</p>

                  {pass.characterArcsUpdated && pass.characterArcsUpdated.length > 0 && (
                    <div className="text-xs">
                      <span className="font-semibold">Characters Updated:</span>{' '}
                      {pass.characterArcsUpdated.join(', ')}
                    </div>
                  )}

                  {pass.researchIntegrated && pass.researchIntegrated.length > 0 && (
                    <div className="text-xs">
                      <span className="font-semibold">Research Integrated:</span>{' '}
                      {pass.researchIntegrated.join(', ')}
                    </div>
                  )}

                  {pass.notes && (
                    <div className="text-xs text-gray-700 dark:text-gray-300">
                      {pass.notes}
                    </div>
                  )}

                  <button
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-semibold mt-2"
                  >
                    View Full Manuscript →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {passes.length === 5 && (
        <div className="bg-green-50 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-2">Pipeline Complete! 🎉</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Your manuscript has gone through all 5 passes.
            Final word count: <strong>{passes[4].resultWordCount}</strong> words
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The final manuscript is now prize-ready. Review, export, or start again.
          </p>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded p-4">
        <p className="text-sm">
          <strong>💡 How it works:</strong> The pipeline automatically refines your manuscript through
          5 progressive passes, with each one building on the last. Word count targets ensure the final
          book is lean and powerful. Mrs. Parry's ruthless edit removes up to 40% of content.
        </p>
      </div>
    </div>
  );
};
