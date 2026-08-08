/**
 * Betting Game Panel
 * Fortune Telling Agent Integration: Live race predictions, betting simulation, leaderboard.
 * 
 * Features:
 * - Live upcoming races with ML predictions
 * - Confidence scores & odds visualization
 * - Betting slip simulator (calculate potential returns)
 * - Model leaderboard (accuracy, win rate, ROI)
 * - Daily digest summary (high-confidence picks, model stats)
 * - Hall of fame (best predictions, close calls)
 */

import React, { useState, useEffect } from 'react';
import { Zap, TrendingUp, AlertCircle, Plus, X, Trophy, BarChart3, Pocket, ChevronDown } from 'lucide-react';

interface Prediction {
  horse: string;
  winProbability: number;
  confidence: number;
  odds: number;
  roiSimulation: number;
}

interface Race {
  raceId: string;
  modelVersion: string;
  predictionCount: number;
  predictions: Prediction[];
  createdAt: string;
}

interface ModelStats {
  modelVersion: string;
  accuracy: number;
  totalPredictions: number;
  totalWins: number;
  winRate: number;
  simulatedRoi: number;
  createdAt: string;
}

interface BettingSlipItem {
  raceId: string;
  horse: string;
  odds: number;
  stake: number;
}

interface BettingGamePanelProps {
  onNavigate?: (view: string) => void;
}

export default function BettingGamePanel({ onNavigate }: BettingGamePanelProps) {
  const [races, setRaces] = useState<Race[]>([]);
  const [models, setModels] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'races' | 'leaderboard' | 'slip'>('races');
  const [selectedRace, setSelectedRace] = useState<string | null>(null);
  const [slip, setSlip] = useState<BettingSlipItem[]>([]);
  const [slipStake, setSlipStake] = useState(10);
  const [showAdd, setShowAdd] = useState(false);
  const [digest, setDigest] = useState<any>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Mock data for demo
      const mockRaces: Race[] = [
        {
          raceId: 'ASCOT-20260803-R1',
          modelVersion: 'v20260803_120000',
          predictionCount: 12,
          predictions: [
            {
              horse: 'Thunderbolt',
              winProbability: 0.35,
              confidence: 0.87,
              odds: 3.5,
              roiSimulation: 0.105,
            },
            {
              horse: 'Dancing Queen',
              winProbability: 0.28,
              confidence: 0.82,
              odds: 4.2,
              roiSimulation: 0.176,
            },
            {
              horse: 'Silver Strike',
              winProbability: 0.22,
              confidence: 0.71,
              odds: 5.5,
              roiSimulation: 0.21,
            },
          ],
          createdAt: new Date().toISOString(),
        },
        {
          raceId: 'EPSOM-20260803-R2',
          modelVersion: 'v20260803_120000',
          predictionCount: 14,
          predictions: [
            {
              horse: 'Royal Crown',
              winProbability: 0.42,
              confidence: 0.91,
              odds: 2.8,
              roiSimulation: 0.176,
            },
            {
              horse: 'Speed Demon',
              winProbability: 0.31,
              confidence: 0.79,
              odds: 3.8,
              roiSimulation: 0.178,
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ];

      const mockModels: ModelStats[] = [
        {
          modelVersion: 'v20260803_120000',
          accuracy: 0.68,
          totalPredictions: 145,
          totalWins: 98,
          winRate: 0.676,
          simulatedRoi: 0.248,
          createdAt: new Date().toISOString(),
        },
        {
          modelVersion: 'v20260802_090000',
          accuracy: 0.61,
          totalPredictions: 132,
          totalWins: 81,
          winRate: 0.614,
          simulatedRoi: 0.156,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          modelVersion: 'v20260801_150000',
          accuracy: 0.57,
          totalPredictions: 128,
          totalWins: 73,
          winRate: 0.570,
          simulatedRoi: 0.089,
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        },
      ];

      setRaces(mockRaces);
      setModels(mockModels);
      setDigest({
        date: new Date().toISOString().split('T')[0],
        totalPredictions: 145,
        totalRaces: 8,
        highConfidencePicks: { races: 4, horses: 12 },
        averageRoiSimulation: 0.187,
      });
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToSlip = (race: Race, prediction: Prediction) => {
    const newItem: BettingSlipItem = {
      raceId: race.raceId,
      horse: prediction.horse,
      odds: prediction.odds,
      stake: slipStake,
    };
    setSlip([...slip, newItem]);
    setShowAdd(false);
  };

  const removeFromSlip = (index: number) => {
    setSlip(slip.filter((_, i) => i !== index));
  };

  const calculateSlipReturns = () => {
    const totalStake = slip.reduce((sum, item) => sum + item.stake, 0);
    const oddsProduct = slip.reduce((product, item) => product * item.odds, 1);
    const potentialPayout = oddsProduct * totalStake;
    return {
      totalStake,
      potentialPayout,
      profit: potentialPayout - totalStake,
      roi: totalStake > 0 ? (potentialPayout - totalStake) / totalStake : 0,
    };
  };

  const slipReturns = calculateSlipReturns();
  const confidenceColor = (conf: number) => {
    if (conf >= 0.85) return '#2ecc71';
    if (conf >= 0.75) return '#f39c12';
    return '#e74c3c';
  };

  return (
    <div style={{ padding: '24px', background: '#f5efe5', minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px', color: '#172033' }}>
          🎲 Betting Game
        </h1>
        <p style={{ fontSize: '13px', color: '#8b7d6b', margin: 0 }}>
          ML-powered predictions · {races.length} races · {models[0]?.accuracy.toLocaleString('en', { style: 'percent' })}{' '}
          accuracy
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e0d3bf', paddingBottom: '12px' }}>
        {(['races', 'leaderboard', 'slip'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 14px',
              background: tab === t ? '#d6a846' : 'transparent',
              color: tab === t ? '#1a1208' : '#8b7d6b',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: tab === t ? 700 : 400,
              fontSize: '13px',
              textTransform: 'capitalize',
            }}
          >
            {t === 'slip' ? `Slip (${slip.length})` : t}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'races' && (
        <div>
          {digest && (
            <div
              style={{
                padding: '16px',
                background: '#fffaf2',
                borderRadius: '12px',
                border: '1px solid #e0d3bf',
                marginBottom: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '16px',
              }}
            >
              <div>
                <p style={{ fontSize: '11px', color: '#8b7d6b', margin: '0 0 4px' }}>
                  <strong>Today's Predictions</strong>
                </p>
                <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#172033' }}>
                  {digest.totalPredictions}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: '#8b7d6b', margin: '0 0 4px' }}>
                  <strong>High Confidence</strong>
                </p>
                <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#2ecc71' }}>
                  {digest.highConfidencePicks.horses}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: '#8b7d6b', margin: '0 0 4px' }}>
                  <strong>Avg ROI</strong>
                </p>
                <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#d6a846' }}>
                  {(digest.averageRoiSimulation * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: '16px' }}>
            {races.map((race) => (
              <div
                key={race.raceId}
                style={{
                  padding: '16px',
                  background: '#fffaf2',
                  borderRadius: '12px',
                  border: '1px solid #e0d3bf',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#172033' }}>
                    {race.raceId}
                  </h3>
                  <span style={{ fontSize: '11px', background: '#e8dcc8', padding: '4px 8px', borderRadius: '4px', color: '#5a4a3a' }}>
                    {race.modelVersion}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  {race.predictions.map((pred, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '12px',
                        background: '#f5efe5',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px', color: '#172033' }}>
                          {pred.horse}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '12px', color: '#8b7d6b' }}>Win Prob: </span>
                            <span style={{ fontWeight: 700, color: '#172033' }}>
                              {(pred.winProbability * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div style={{ width: '2px', height: '12px', background: '#d0c4b8' }} />
                          <div>
                            <span style={{ fontSize: '12px', color: '#8b7d6b' }}>Odds: </span>
                            <span style={{ fontWeight: 700, color: '#172033' }}>{pred.odds.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '16px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#8b7d6b',
                              marginBottom: '2px',
                            }}
                          >
                            Confidence
                          </div>
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 700,
                              color: confidenceColor(pred.confidence),
                            }}
                          >
                            {(pred.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                        <button
                          onClick={() => addToSlip(race, pred)}
                          style={{
                            padding: '6px 10px',
                            background: '#d6a846',
                            color: '#1a1208',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '12px',
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'leaderboard' && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {models.map((model, i) => (
            <div
              key={model.modelVersion}
              style={{
                padding: '16px',
                background: '#fffaf2',
                borderRadius: '12px',
                border: '1px solid #e0d3bf',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  {i === 0 && <Trophy size={18} color="#d6a846" />}
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#172033' }}>
                    #{i + 1} {model.modelVersion}
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: '#8b7d6b', margin: '4px 0' }}>
                  {model.totalPredictions} predictions · {model.totalWins} wins
                </p>
              </div>
              <div style={{ display: 'grid', gap: '8px', gridAutoFlow: 'column', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: '#8b7d6b', margin: '0 0 2px' }}>Accuracy</p>
                  <p style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#2ecc71' }}>
                    {(model.accuracy * 100).toFixed(1)}%
                  </p>
                </div>
                <div style={{ width: '1px', height: '30px', background: '#d0c4b8' }} />
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: '#8b7d6b', margin: '0 0 2px' }}>ROI</p>
                  <p style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#d6a846' }}>
                    {(model.simulatedRoi * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'slip' && (
        <div>
          <div
            style={{
              padding: '16px',
              background: '#fffaf2',
              borderRadius: '12px',
              border: '1px solid #e0d3bf',
              marginBottom: '20px',
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px', color: '#172033' }}>
              Betting Slip Simulator
            </h3>

            {slip.length === 0 ? (
              <p style={{ color: '#8b7d6b', fontSize: '13px', margin: 0 }}>
                Add predictions from the races tab to build a betting slip.
              </p>
            ) : (
              <>
                <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
                  {slip.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 12px',
                        background: '#f5efe5',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 2px', color: '#172033' }}>
                          {item.horse}
                        </p>
                        <p style={{ fontSize: '11px', color: '#8b7d6b', margin: 0 }}>
                          {item.raceId} @ {item.odds.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromSlip(i)}
                        style={{
                          padding: '4px 8px',
                          background: 'transparent',
                          border: '1px solid #d0c4b8',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#e74c3c',
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    padding: '12px',
                    background: '#e8dcc8',
                    borderRadius: '8px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                  }}
                >
                  <div>
                    <p style={{ fontSize: '11px', color: '#5a4a3a', margin: '0 0 4px' }}>
                      <strong>Total Stake</strong>
                    </p>
                    <p style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#172033' }}>
                      £{slipReturns.totalStake.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: '#5a4a3a', margin: '0 0 4px' }}>
                      <strong>Potential Payout</strong>
                    </p>
                    <p style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#2ecc71' }}>
                      £{slipReturns.potentialPayout.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#d6a846',
                    borderRadius: '8px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: '11px', color: '#1a1208', margin: '0 0 4px' }}>
                    <strong>Potential Profit</strong>
                  </p>
                  <p style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#1a1208' }}>
                    £{slipReturns.profit.toFixed(2)} ({(slipReturns.roi * 100).toFixed(1)}%)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
