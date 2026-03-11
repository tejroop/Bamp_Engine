import React from 'react'

function MarketSelector({ value, onChange }) {
  const markets = [
    { code: 'HK', name: 'Hong Kong', rows: '32K orders' },
    { code: 'TW', name: 'Taiwan', rows: '81K orders' },
  ]

  return (
    <div className="flex items-center space-x-3">
      <label className="text-white font-medium">Select Market:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white text-gray-800 px-4 py-2 rounded-lg font-medium border-2 border-orange-400 focus:outline-none focus:border-orange-500 cursor-pointer"
      >
        {markets.map(market => (
          <option key={market.code} value={market.code}>
            {market.name} ({market.code})
          </option>
        ))}
      </select>
    </div>
  )
}

export default MarketSelector
