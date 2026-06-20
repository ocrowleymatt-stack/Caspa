import { motion } from 'motion/react';
import { Ghost, Sparkles, LogIn } from 'lucide-react';

type LoginScreenProps = {
  onLoginWithGoogle: () => void;
  onLoginAnonymously?: () => void;
  isLoading?: boolean;
  error?: string | null;
};

export default function LoginScreen({ 
  onLoginWithGoogle, 
  onLoginAnonymously,
  isLoading = false,
  error = null 
}: LoginScreenProps) {
  return (
    <div className="h-dvh w-dvw bg-gradient-to-br from-[#090614] via-[#1a0d2e] to-[#0d1117] flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Ambient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(168,85,247,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(59,130,246,0.1),transparent_50%)]" />
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center gap-12 max-w-md"
      >
        {/* Logo & Title */}
        <div className="flex flex-col items-center gap-6">
          <motion.div
            animate={{ rotate: [0, -2, 2, -1, 1, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="relative"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-[0_0_60px_rgba(168,85,247,0.4)] border border-purple-400/30">
              <Ghost size={40} className="text-white" strokeWidth={1.5} />
            </div>
          </motion.div>

          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-white font-serif">Caspa</h1>
            <p className="text-sm text-purple-300/80 uppercase tracking-[0.15em] font-medium">
              Story Intelligence
            </p>
            <p className="text-xs text-slate-400 mt-4 leading-relaxed max-w-sm">
              AI-powered writing companion for character development, plot architecture, and narrative refinement
            </p>
          </div>
        </div>

        {/* Auth Section */}
        <div className="w-full space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs text-center font-medium uppercase tracking-wide"
            >
              {error}
            </motion.div>
          )}

          <motion.button
            onClick={onLoginWithGoogle}
            disabled={isLoading}
            whileHover={{ scale: 1.02, translateY: -2 }}
            whileTap={{ scale: 0.98 }}
            className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-white uppercase tracking-wide text-sm shadow-[0_20px_40px_rgba(168,85,247,0.3)] transition-all border border-purple-400/30 flex items-center justify-center gap-3"
          >
            <Sparkles size={18} />
            {isLoading ? 'Connecting...' : 'Sign In with Google'}
          </motion.button>

          {onLoginAnonymously && (
            <motion.button
              onClick={onLoginAnonymously}
              disabled={isLoading}
              whileHover={{ scale: 1.02, translateY: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full px-6 py-3 bg-slate-700/40 hover:bg-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-600/50 rounded-lg font-semibold text-slate-300 uppercase tracking-wide text-xs transition-all flex items-center justify-center gap-2"
            >
              <LogIn size={16} />
              Continue as Guest
            </motion.button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center space-y-3 text-[11px] text-slate-400">
          <p className="opacity-60">
            Sign in to access your manuscripts and sync across devices
          </p>
          <p className="opacity-50 leading-relaxed">
            Google Sign-In secured by Firebase. Your data is encrypted end-to-end
          </p>
        </div>
      </motion.div>
    </div>
  );
}
