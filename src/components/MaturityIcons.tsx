import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * STANDARD — Girl in a dress. Demure, wholesome, fully clothed.
 * Stick figure with a triangular skirt, hair, and arms out politely.
 */
export function IconStandard({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Head */}
      <circle cx="12" cy="4" r="2" />
      {/* Hair — two small arcs on top */}
      <path d="M10 3 Q10 1.5 12 1.5 Q14 1.5 14 3" />
      {/* Neck + torso */}
      <line x1="12" y1="6" x2="12" y2="11" />
      {/* Arms out politely */}
      <line x1="12" y1="8" x2="8" y2="10" />
      <line x1="12" y1="8" x2="16" y2="10" />
      {/* Dress — triangle from waist */}
      <path d="M12 11 L8 20 L16 20 Z" />
      {/* Feet peeking out */}
      <line x1="9.5" y1="20" x2="8.5" y2="22" />
      <line x1="14.5" y1="20" x2="15.5" y2="22" />
    </svg>
  );
}

/**
 * MATURE — Man with hands crossed over privates. Awkward, embarrassed.
 * Stick figure, no dress, hands clasped low in the classic "fig leaf" pose.
 */
export function IconMature({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Head */}
      <circle cx="12" cy="4" r="2" />
      {/* Torso */}
      <line x1="12" y1="6" x2="12" y2="15" />
      {/* Arms angled down to meet at groin — the fig-leaf cross */}
      <line x1="12" y1="9" x2="9" y2="13" />
      <line x1="12" y1="9" x2="15" y2="13" />
      {/* Hands crossed at groin */}
      <line x1="9" y1="13" x2="13" y2="14" />
      <line x1="15" y1="13" x2="11" y2="14" />
      {/* Legs */}
      <line x1="12" y1="15" x2="9.5" y2="22" />
      <line x1="12" y1="15" x2="14.5" y2="22" />
      {/* Feet */}
      <line x1="9.5" y1="22" x2="7.5" y2="22" />
      <line x1="14.5" y1="22" x2="16.5" y2="22" />
      {/* Embarrassed sweat drop */}
      <path d="M16 5 Q17 4 16.5 3 Q16 4 16 5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * TRANSGRESSIVE — Two stick figures in the act. Explicit, unmistakable.
 * One figure horizontal, one figure on top. Classic missionary silhouette.
 */
export function IconTransgressive({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* === FIGURE 1 — lying on back (bottom) === */}
      {/* Head */}
      <circle cx="4" cy="16" r="1.8" />
      {/* Body horizontal */}
      <line x1="5.8" y1="16" x2="16" y2="16" />
      {/* Legs raised */}
      <line x1="16" y1="16" x2="19" y2="12" />
      <line x1="16" y1="16" x2="20" y2="14" />

      {/* === FIGURE 2 — on top (active) === */}
      {/* Head */}
      <circle cx="14" cy="6" r="1.8" />
      {/* Torso angled down */}
      <line x1="14" y1="7.8" x2="13" y2="13" />
      {/* Arms braced */}
      <line x1="13.5" y1="10" x2="10" y2="12" />
      <line x1="13.5" y1="10" x2="17" y2="12" />
      {/* Legs behind */}
      <line x1="13" y1="13" x2="10" y2="18" />
      <line x1="13" y1="13" x2="16" y2="19" />
    </svg>
  );
}
