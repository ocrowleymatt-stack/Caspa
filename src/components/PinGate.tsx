import React, { useState, useEffect } from 'react';

const CORRECT_PIN = '3123';
const SESSION_KEY = 'nwp_pin_unlocked';

interface PinGateProps {
  children: React.ReactNode;
}

export default function PinGate({ children }: PinGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    // Persist unlock for the browser session only
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      setUnlocked(true);
    }
  }, []);

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);

    if (next.length === 4) {
      if (next === CORRECT_PIN) {
        sessionStorage.setItem(SESSION_KEY, '1');
        setUnlocked(true);
      } else {
        setShake(true);
        setError(true);
        setTimeout(() => {
          setPin('');
          setShake(false);
        }, 700);
      }
    }
  };

  const handleBackspace = () => {
    setPin(p => p.slice(0, -1));
    setError(false);
  };

  if (unlocked) return <>{children}</>;

  const dots = Array.from({ length: 4 }, (_, i) => (
    <div
      key={i}
      className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
        i < pin.length
          ? error
            ? 'bg-red-500 border-red-500'
            : 'bg-blue-400 border-blue-400'
          : 'bg-transparent border-gray-500'
      }`}
    />
  ));

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-50 select-none">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-900/40">
          <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-white" stroke="currentColor" strokeWidth={1.8}>
            <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinejoin="round"/>
            <path d="M2 17l10 5 10-5" strokeLinejoin="round"/>
            <path d="M2 12l10 5 10-5" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-white font-semibold text-lg tracking-wide">NovelWrite <span className="font-black">PRO</span></p>
        <p className="text-gray-500 text-sm mt-1">Enter PIN to continue</p>
      </div>

      {/* Dots */}
      <div className={`flex gap-4 mb-8 transition-transform ${shake ? 'animate-[wiggle_0.4s_ease-in-out]' : ''}`}>
        {dots}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />;
          const isBackspace = d === '⌫';
          return (
            <button
              key={i}
              onClick={() => isBackspace ? handleBackspace() : handleDigit(d)}
              className={`h-16 rounded-2xl text-xl font-semibold transition-all duration-100 active:scale-95
                ${isBackspace
                  ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  : 'bg-gray-800 text-white hover:bg-gray-700 active:bg-blue-600'
                }`}
            >
              {d}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-6 text-red-400 text-sm font-medium">Incorrect PIN. Try again.</p>
      )}

      <style>{`
        @keyframes wiggle {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
      `}</style>
    </div>
  );
}
