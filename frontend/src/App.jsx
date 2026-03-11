import React, { useState } from 'react'
import Dashboard from './components/Dashboard'
import AttachmentRateChart from './components/AttachmentRateChart'
import IncrementalityChart from './components/IncrementalityChart'
import ElasticityChart from './components/ElasticityChart'
import PriceSimulator from './components/PriceSimulator'
import MethodologyPanel from './components/MethodologyPanel'
import MarketSelector from './components/MarketSelector'
import AnomalyDetector from './components/AnomalyDetector'
import ChatBot from './components/ChatBot'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedMarket, setSelectedMarket] = useState('HK')

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'attachment', label: 'Attachment Rate' },
    { id: 'incrementality', label: 'Incrementality' },
    { id: 'elasticity', label: 'Elasticity' },
    { id: 'simulator', label: 'Price Simulator' },
    { id: 'methodology', label: 'Methodology' },
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard market={selectedMarket} />
      case 'attachment':
        return <AttachmentRateChart market={selectedMarket} />
      case 'incrementality':
        return <IncrementalityChart market={selectedMarket} />
      case 'elasticity':
        return <ElasticityChart market={selectedMarket} />
      case 'simulator':
        return <PriceSimulator market={selectedMarket} />
      case 'methodology':
        return <MethodologyPanel />
      default:
        return <Dashboard market={selectedMarket} />
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
              <p className="text-orange-300">Emma Sleep - Strategic Pricing & Market Analysis</p>
            </div>
            <div className="flex items-center gap-4">
              <AnomalyDetector market={selectedMarket} />
              <div className="text-right">
                <p className="text-sm text-gray-300">Market Intelligence Platform</p>
              </div>
            </div>
          </div>
          
          {/* Market Selector */}
          <div className="mb-4">
            <MarketSelector value={selectedMarket} onChange={setSelectedMarket} />
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map(tab => (
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
          <p>BAMP Market Response Engine | Emma Sleep © 2024 | Powered by Advanced Analytics</p>
        </div>
      </footer>

      {/* Conversational Analytics Chatbot (F3) */}
      <ChatBot market={selectedMarket} />
    </div>
  )
}

export default App
