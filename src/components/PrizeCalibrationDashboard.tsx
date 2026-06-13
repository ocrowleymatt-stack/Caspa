import React from 'react';
import { Award } from 'lucide-react';

interface PrizeCalibrationDashboardProps {
  onSelectPrize?: (prizeId: string) => void;
  onCoachingRequest?: (dimension: string) => void;
}

export const PrizeCalibrationDashboard: React.FC<PrizeCalibrationDashboardProps> = ({
  onSelectPrize,
  onCoachingRequest,
}) => {
  return (
    <div className="w-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-amber-500/20 p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Award className="w-8 h-8 text-amber-400" />
          <h2 className="text-3xl font-bold text-amber-50">🏆 Prize Calibration</h2>
        </div>
      </div>

      <div className="text-center py-12">
        <p className="text-amber-100 text-lg">
          Literary Prize Calibration Engine — Analyze your manuscript against major literary prizes.
        </p>
        <p className="text-slate-400 mt-4">
          Coming soon: Booker Prize, Costa Awards, Women's Prize, Hugo Award, Nebula, Pulitzer, National Book, Orwell Prize.
        </p>
      </div>

      <div className="mt-8 p-6 bg-amber-500/10 border border-amber-400/30 rounded-xl">
        <h4 className="text-amber-50 font-semibold mb-2">🎯 How it works</h4>
        <ul className="text-amber-100 text-sm space-y-2">
          <li>✓ Upload or paste your manuscript</li>
          <li>✓ Engine scans against prize rubrics</li>
          <li>✓ Scores across 6 dimensions: prose, originality, character, narrative, emotion, cultural relevance</li>
          <li>✓ Compares to recent winners & shortlists</li>
          <li>✓ Provides targeted coaching to maximize winning potential</li>
        </ul>
      </div>
    </div>
  );
};

export default PrizeCalibrationDashboard;
