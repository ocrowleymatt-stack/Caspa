import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PenTool, Delete, ShieldCheck } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

const CORRECT_PIN = '3123';

export default function PinGate({ children }: Props) {
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const unlocked = sessionStorage.getItem('novel_write_unlocked');
    if (unlocked === 'true') {
      setIsUnlocked(true);
    }
  }, []);

  const handleKeyPress = (val: string) => {
    if (error) return;
    if (pin.length < 4) {
      const newPin = pin + val;
      setPin(newPin);

      if (newPin.length === 4) {
        if (newPin === CORRECT_PIN) {
          setTimeout(() => {
            sessionStorage.setItem('novel_write_unlocked', 'true');
            setIsUnlocked(true);
          }, 300);
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 700);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (error) return;
    setPin(pin.slice(0, -1));
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[999] bg-gray-950 flex flex-col items-center justify-center font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center max-w-xs w-full"
      >
        {/* Logo */}
        <div className="mb-8 p-4 bg-brand-primary/10 rounded-3xl">
          <PenTool size={48} className="text-brand-primary" />
        </div>

        <h1 className="text-2xl font-black text-white mb-2 tracking-tight italic font-serif">NovelWrite Pro</h1>
        <p className="text-sm text-gray-500 mb-12 font-medium tracking-wide">Enter PIN to continue</p>

        {/* PIN Indicators */}
        <div className="flex gap-4 mb-16">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={error ? {
                x: [0, -10, 10, -10, 10, 0],
                backgroundColor: ['#ef4444', '#ef4444', '#ef4444', '#ef4444', '#ef4444', '#ef4444']
              } : {
                scale: pin.length > i ? 1.2 : 1,
                backgroundColor: pin.length > i ? '#ffffff' : '#374151'
              }}
              transition={error ? { duration: 0.4 } : { duration: 0.2 }}
              className={`w-4 h-4 rounded-full shadow-lg ${error ? 'bg-red-500' : pin.length > i ? 'bg-white' : 'bg-gray-700'}`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-6 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="aspect-square rounded-2xl bg-gray-900/50 border border-white/5 text-2xl font-bold text-white hover:bg-gray-800 hover:border-white/20 active:scale-90 transition-all flex items-center justify-center group"
            >
              <span className="group-hover:scale-110 transition-transform">{num}</span>
            </button>
          ))}
          <div />
          <button
            onClick={() => handleKeyPress('0')}
            className="aspect-square rounded-2xl bg-gray-900/50 border border-white/5 text-2xl font-bold text-white hover:bg-gray-800 hover:border-white/20 active:scale-90 transition-all flex items-center justify-center"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="aspect-square rounded-2xl bg-gray-900/50 border border-white/5 text-gray-400 hover:text-white hover:bg-gray-800 hover:border-white/20 active:scale-90 transition-all flex items-center justify-center"
          >
            <Delete size={24} />
          </button>
        </div>

        <div className="mt-16 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-black text-gray-700">
           <ShieldCheck size={12} className="opacity-50" />
           Private Protocol Active
        </div>
      </motion.div>
    </div>
  );
}
