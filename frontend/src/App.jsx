import React, { useState, useEffect, useRef, useMemo } from 'react'
import Dashboard from './components/Dashboard'
import AttachmentRateChart from './components/AttachmentRateChart'
import IncrementalityChart from './components/IncrementalityChart'
import ElasticityChart from './components/ElasticityChart'
import PriceSimulator from './components/PriceSimulator'
import MethodologyPanel from './components/MethodologyPanel'
import MarketSelector from './components/MarketSelector'
import AnomalyDetector from './components/AnomalyDetector'
import ChatBot from './components/ChatBot'
import ScenarioLab from './components/ScenarioLab'
import CompetitiveRadar from './components/CompetitiveRadar'
import DiscountOptimizer from './components/DiscountOptimizer'
import BundleRecommender from './components/BundleRecommender'
import MacroValidation from './components/MacroValidation'
import SentimentAnalysis from './components/SentimentAnalysis'

// ── Tab registry ────────────────────────────────────────────────────────────
// tier: 'core'     → always visible, cannot be hidden
// tier: 'pinnable' → user can pin to top bar or leave in "More"
// tier: 'overflow' → lives in "More" by default
// tier: 'analyst'  → only visible in Analyst mode
const TAB_REGISTRY = [
  { id: 'dashboard',     label: 'Overview',        tier: 'core',     group: 'Core' },
  { id: 'simulator',     label: 'Price Simulator', tier: 'pinnable', group: 'Decision Labs' },
  { id: 'scenario',      label: 'Scenarios',       tier: 'pinnable', group: 'Decision Labs' },
  { id: 'bundles',       label: 'Bundles',         tier: 'pinnable', group: 'Decision Labs' },
  { id: 'discount',      label: 'Discounts',       tier: 'pinnable', group: 'Decision Labs' },
  { id: 'competitive',   label: 'Competitors',     tier: 'pinnable', group: 'Market Context' },
  { id: 'macro',         label: 'Macro Risk',      tier: 'pinnable', group: 'Market Context' },
  { id: 'sentiment',     label: 'Sentiment',       tier: 'pinnable', group: 'Market Context' },
  { id: 'attachment',    label: 'Attachment',      tier: 'overflow', group: 'Deep Dives' },
  { id: 'elasticity',    label: 'Elasticity',      tier: 'overflow', group: 'Deep Dives' },
  { id: 'incrementality',label: 'Incrementality',  tier: 'overflow', group: 'Deep Dives' },
  { id: 'methodology',   label: 'Methodology',     tier: 'analyst',  group: 'Analyst' },
]

// ── Role presets ────────────────────────────────────────────────────────────
const ROLE_PRESETS = {
  executive: {
    label: 'Executive',
    description: 'Clean executive view — headline KPIs, risks, decisions.',
    mode: 'executive',
    pinned: ['scenario', 'macro'],
  },
  commercial: {
    label: 'Commercial',
    description: 'Pricing, bundles, discounts and competitive intel.',
    mode: 'executive',
    pinned: ['simulator', 'scenario', 'bundles', 'discount', 'competitive'],
  },
  analyst: {
    label: 'Analyst',
    description: 'Full technical depth — every model, every metric.',
    mode: 'analyst',
    pinned: ['simulator', 'scenario', 'attachment', 'elasticity', 'macro'],
  },
}

const DEFAULT_PRESET = 'executive'
const MAX_PINNED = 5
const STORAGE_KEY = 'bamp:navPrefs:v1'

// ── Local-storage preference hook ──────────────────────────────────────────
function useNavPrefs() {
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    } catch (e) {}
    return {
      mode: ROLE_PRESETS[DEFAULT_PRESET].mode,
      pinned: ROLE_PRESETS[DEFAULT_PRESET].pinned,
      preset: DEFAULT_PRESET,
      customized: false,
    }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch (e) {}
  }, [prefs])

  return [prefs, setPrefs]
}

// ── "More" dropdown ────────────────────────────────────────────────────────
function MoreMenu({ items, activeTab, onSelect, onOpenCustomize }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Group items by group label
  const grouped = items.reduce((acc, t) => {
    (acc[t.group] = acc[t.group] || []).push(t)
    return acc
  }, {})

  const isActiveInMore = items.some(t => t.id === activeTab)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`px-4 py-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 ${
          isActiveInMore || open
            ? 'border-orange-500 text-orange-600'
            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
        }`}
      >
        More
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-0 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2">
          {Object.entries(grouped).map(([group, groupItems]) => (
            <div key={group} className="py-1">
              <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                {group}
              </div>
              {groupItems.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onSelect(t.id); setOpen(false) }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    activeTab === t.id ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => { onOpenCustomize(); setOpen(false) }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Customize nav…
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Customize panel (modal) ────────────────────────────────────────────────
function CustomizePanel({ open, onClose, prefs, setPrefs, visibleTabs }) {
  if (!open) return null

  const togglePin = (id) => {
    setPrefs(p => {
      const isPinned = p.pinned.includes(id)
      let next
      if (isPinned) {
        next = p.pinned.filter(x => x !== id)
      } else {
        if (p.pinned.length >= MAX_PINNED) return p
        next = [...p.pinned, id]
      }
      return { ...p, pinned: next, customized: true, preset: null }
    })
  }

  const applyPreset = (key) => {
    const preset = ROLE_PRESETS[key]
    setPrefs({
      mode: preset.mode,
      pinned: [...preset.pinned],
      preset: key,
      customized: false,
    })
  }

  const resetDefault = () => applyPreset(DEFAULT_PRESET)

  const pinnableTabs = TAB_REGISTRY.filter(t => t.tier !== 'core' && t.tier !== 'analyst')
  const analystTabs  = TAB_REGISTRY.filter(t => t.tier === 'analyst')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Customize navigation</h2>
            <p className="text-xs text-gray-500 mt-1">
              Pin the sections you use most. Unpinned items live under "More".
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Role presets */}
        <div className="px-6 py-5 border-b border-gray-100">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Quick presets</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(ROLE_PRESETS).map(([key, p]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className={`px-3 py-3 rounded-lg border text-left transition-all ${
                  prefs.preset === key
                    ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                    : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-semibold text-gray-800">{p.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{p.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Mode toggle */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Information depth</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Analyst mode reveals methodology, coefficients, and statistical output.
              </p>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {['executive','analyst'].map(m => (
                <button
                  key={m}
                  onClick={() => setPrefs(p => ({ ...p, mode: m, customized: true, preset: null }))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition ${
                    prefs.mode === m ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pin/unpin list */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
              Sections
            </p>
            <p className="text-[11px] text-gray-400">
              {prefs.pinned.length} / {MAX_PINNED} pinned
            </p>
          </div>

          {/* Core - locked */}
          <div className="mb-2">
            {TAB_REGISTRY.filter(t => t.tier === 'core').map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 mb-1">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-sm text-gray-700 font-medium">{t.label}</span>
                </div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Always visible</span>
              </div>
            ))}
          </div>

          {/* Pinnable */}
          {pinnableTabs.map(t => {
            const pinned = prefs.pinned.includes(t.id)
            const disabled = !pinned && prefs.pinned.length >= MAX_PINNED
            return (
              <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                <div>
                  <p className="text-sm text-gray-700">{t.label}</p>
                  <p className="text-[10px] text-gray-400">{t.group}</p>
                </div>
                <button
                  onClick={() => togglePin(t.id)}
                  disabled={disabled}
                  className={`text-[11px] px-3 py-1 rounded-md font-medium transition ${
                    pinned
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : disabled
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {pinned ? 'Pinned' : 'Pin'}
                </button>
              </div>
            )
          })}

          {/* Analyst-only section */}
          {prefs.mode === 'analyst' && analystTabs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1 px-3">Analyst only</p>
              {analystTabs.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg">
                  <span className="text-sm text-gray-700">{t.label}</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">In More menu</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 rounded-b-2xl">
          <button
            onClick={resetDefault}
            className="text-xs text-gray-600 hover:text-orange-600 font-medium"
          >
            Reset to default
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedMarket, setSelectedMarket] = useState('HK')
  const [prefs, setPrefs] = useNavPrefs()
  const [customizeOpen, setCustomizeOpen] = useState(false)

  // Derived: which tabs show where
  const { primaryTabs, moreTabs, allAvailableIds } = useMemo(() => {
    const availableTabs = TAB_REGISTRY.filter(t => prefs.mode === 'analyst' || t.tier !== 'analyst')

    const core = availableTabs.filter(t => t.tier === 'core')
    const pinned = prefs.pinned
      .map(id => availableTabs.find(t => t.id === id))
      .filter(Boolean)
    const pinnedIds = new Set(pinned.map(t => t.id))
    const more = availableTabs.filter(t => t.tier !== 'core' && !pinnedIds.has(t.id))

    return {
      primaryTabs: [...core, ...pinned],
      moreTabs: more,
      allAvailableIds: availableTabs.map(t => t.id),
    }
  }, [prefs])

  // Guard: if active tab becomes unavailable (e.g. switching to Executive hides Methodology)
  useEffect(() => {
    if (!allAvailableIds.includes(activeTab)) setActiveTab('dashboard')
  }, [allAvailableIds, activeTab])

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':      return <Dashboard market={selectedMarket} />
      case 'attachment':     return <AttachmentRateChart market={selectedMarket} />
      case 'incrementality': return <IncrementalityChart market={selectedMarket} />
      case 'elasticity':     return <ElasticityChart market={selectedMarket} />
      case 'simulator':      return <PriceSimulator market={selectedMarket} />
      case 'scenario':       return <ScenarioLab market={selectedMarket} />
      case 'competitive':    return <CompetitiveRadar market={selectedMarket} />
      case 'discount':       return <DiscountOptimizer market={selectedMarket} />
      case 'bundles':        return <BundleRecommender market={selectedMarket} />
      case 'macro':          return <MacroValidation market={selectedMarket} />
      case 'sentiment':      return <SentimentAnalysis market={selectedMarket} />
      case 'methodology':    return <MethodologyPanel />
      default:               return <Dashboard market={selectedMarket} />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="gradient-header text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">BAMP Market Response Engine</h1>
              <p className="text-orange-300">Emma Sleep — Strategic Pricing & Market Analysis</p>
            </div>
            <div className="flex items-center gap-4">
              <AnomalyDetector market={selectedMarket} />
              <div className="text-right">
                <p className="text-sm text-gray-300">Market Intelligence Platform</p>
              </div>
            </div>
          </div>

          {/* Market selector + mode toggle */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <MarketSelector value={selectedMarket} onChange={setSelectedMarket} />
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-lg p-1">
              {['executive','analyst'].map(m => (
                <button
                  key={m}
                  onClick={() => setPrefs(p => ({ ...p, mode: m, customized: true, preset: null }))}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition ${
                    prefs.mode === m ? 'bg-white text-gray-800 shadow' : 'text-white/80 hover:text-white'
                  }`}
                  title={m === 'executive'
                    ? 'Clean executive view — hides technical depth'
                    : 'Full analyst depth — methodology, coefficients, statistics'}
                >
                  {m} mode
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex space-x-1 overflow-x-auto">
              {primaryTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {moreTabs.length > 0 && (
                <MoreMenu
                  items={moreTabs}
                  activeTab={activeTab}
                  onSelect={setActiveTab}
                  onOpenCustomize={() => setCustomizeOpen(true)}
                />
              )}
            </div>

            {/* Gear icon — customize */}
            <button
              onClick={() => setCustomizeOpen(true)}
              className="p-2 text-gray-400 hover:text-orange-600 transition-colors"
              title="Customize navigation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-gray-600 text-sm">
          <p>BAMP Market Response Engine | Emma Sleep © 2026 | Powered by Advanced Analytics</p>
        </div>
      </footer>

      {/* Customize modal */}
      <CustomizePanel
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        prefs={prefs}
        setPrefs={setPrefs}
      />

      {/* Chatbot */}
      <ChatBot market={selectedMarket} />
    </div>
  )
}

export default App
