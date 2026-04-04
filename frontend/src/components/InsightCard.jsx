import React, { useState } from 'react';

/**
 * InsightCard Component — AI Insight Narrator (F1)
 *
 * Renders a collapsible AI-generated insight panel below each chart.
 * Uses smart template-based insights computed from actual data values.
 * Architecture supports seamless upgrade to live LLM API calls.
 *
 * Props:
 *   headline   — bold one-liner (e.g., "HK demand is price-inelastic")
 *   body       — 2-3 sentence explanation of what the data means
 *   recommendation — strategic action item
 *   comparison — optional cross-market comparison note
 *   sentiment  — "positive" | "negative" | "neutral" (controls color)
 */

const SENTIMENT_STYLES = {
  positive: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    accent: 'text-emerald-700',
    accentBg: 'bg-emerald-100',
    icon: (
      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  negative: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    accent: 'text-red-700',
    accentBg: 'bg-red-100',
    icon: (
      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    ),
  },
  neutral: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    accent: 'text-indigo-700',
    accentBg: 'bg-indigo-100',
    icon: (
      <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
};

export default function InsightCard({ headline, body, recommendation, comparison, sentiment = 'neutral' }) {
  const [expanded, setExpanded] = useState(false);
  const style = SENTIMENT_STYLES[sentiment] || SENTIMENT_STYLES.neutral;

  return (
    <div className={`mt-4 rounded-xl border ${style.border} ${style.bg} overflow-hidden transition-all duration-300`}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-90 transition-opacity"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`flex-shrink-0 p-1.5 rounded-lg ${style.accentBg}`}>
            {style.icon}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-gradient-to-r from-violet-500 to-purple-600 text-white flex-shrink-0">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L9.19 8.63L2 9.24l5.46 4.73L5.82 21L12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
              </svg>
              AI
            </span>
            <p className={`font-semibold text-sm ${style.accent} truncate`}>{headline}</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 flex-shrink-0 ml-2 transform transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body — collapsible */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-fadeIn">
          <div className="border-t border-gray-200/50 pt-3">
            <p className="text-sm text-gray-700 leading-relaxed">{body}</p>
          </div>

          {recommendation && (
            <div className="flex items-start gap-2 bg-white/60 rounded-lg p-3">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-0.5">Recommendation</p>
                <p className="text-sm text-gray-700">{recommendation}</p>
              </div>
            </div>
          )}

          {comparison && (
            <div className="flex items-start gap-2 bg-white/60 rounded-lg p-3">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-0.5">Cross-Market Comparison</p>
                <p className="text-sm text-gray-700">{comparison}</p>
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-400 italic">
            Generated by BAMP AI Narrator — insights computed from econometric model outputs
          </p>
        </div>
      )}
    </div>
  );
}
