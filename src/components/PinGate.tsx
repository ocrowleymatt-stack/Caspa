import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Ghost, Delete, ShieldCheck } from 'lucide-react';

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
    <div className="fixed inset-0 z-[999] bg-surface-bg/90 backdrop-blur-3xl flex flex-col items-center justify-center font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center max-w-xs w-full"
      >
        <div className="mb-10 relative">
          <div className="absolute inset-0 bg-brand-primary opacity-20 blur-2xl rounded-full" />
          <div className="p-3 ethereal-panel rounded-full relative z-10 shadow-[0_0_50px_rgba(168,85,247,0.4)]">
            <Ghost size={56} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
          </div>
        </div>

        <h1 className="text-xs font-semibold font-semibold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-2 tracking-widest uppercase text-center font-sans drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">Caspa<br/>The Ghost Writer</h1>
        <p className="text-xs text-brand-accent uppercase tracking-widest mb-1.5 font-medium text-center">Writing the stories of the <br/> digital afterlife</p>

        {/* PIN Indicators */}
        <div className="flex gap-2 mb-1.5">
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
        <div className="grid grid-cols-3 gap-1.5 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="aspect-square rounded bg-gray-900/50 border border-white/5 text-[11px] font-semibold font-medium text-white hover:bg-gray-800 hover:border-white/20 active:scale-90 transition-all flex items-center justify-center group"
            >
              <span className="group-hover:scale-110 transition-transform">{num}</span>
            </button>
          ))}
          <div />
          <button
            onClick={() => handleKeyPress('0')}
            className="aspect-square rounded bg-gray-900/50 border border-white/5 text-[11px] font-semibold font-medium text-white hover:bg-gray-800 hover:border-white/20 active:scale-90 transition-all flex items-center justify-center"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="aspect-square rounded bg-gray-900/50 border border-white/5 text-gray-400 hover:text-white hover:bg-gray-800 hover:border-white/20 active:scale-90 transition-all flex items-center justify-center"
          >
            <Delete size={24} />
          </button>
        </div>

        <div className="mt-16 flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-gray-700">
           <ShieldCheck size={12} className="opacity-50" />
           Private Protocol Active
        </div>
      </motion.div>
    </div>
  );
}
