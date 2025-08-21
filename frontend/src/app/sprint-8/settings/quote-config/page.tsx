'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, RefreshCw, Euro, Clock, Package, Percent } from 'lucide-react';
import { loadQuoteSettings, saveQuoteSettings, defaultQuoteSettings, QuoteSettings } from '@/lib/quoteSettings';
import { defaultHubPriceBook, HubPricing } from '@/lib/hubPriceBook';

export default function QuoteConfigPage() {
  const [settings, setSettings] = useState<QuoteSettings>(defaultQuoteSettings);
  const [hubPrices, setHubPrices] = useState<HubPricing[]>(defaultHubPriceBook);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    setSettings(loadQuoteSettings());
    
    // Load hub prices (would be from API in production)
    const storedHubs = localStorage.getItem('hubPriceBook');
    if (storedHubs) {
      try {
        setHubPrices(JSON.parse(storedHubs));
      } catch (e) {
        console.error('Failed to load hub prices:', e);
      }
    }
  }, []);

  const handleSave = () => {
    setSaving(true);
    setSaved(false);
    
    // Save settings
    saveQuoteSettings(settings);
    
    // Save hub prices
    localStorage.setItem('hubPriceBook', JSON.stringify(hubPrices));
    
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 500);
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults?')) {
      setSettings(defaultQuoteSettings);
      setHubPrices(defaultHubPriceBook);
      localStorage.removeItem('quoteSettings');
      localStorage.removeItem('hubPriceBook');
    }
  };

  const updateSetting = (path: string, value: any) => {
    const keys = path.split('.');
    const newSettings = { ...settings };
    let current: any = newSettings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setSettings(newSettings);
  };

  const updateHubPrice = (index: number, field: keyof HubPricing, value: any) => {
    const newHubs = [...hubPrices];
    newHubs[index] = { ...newHubs[index], [field]: value };
    setHubPrices(newHubs);
  };

  const addHub = () => {
    setHubPrices([...hubPrices, {
      hubId: `HUB${hubPrices.length + 1}`,
      hubName: 'New Hub',
      authenticationFee: 100,
      sewingFee: 200,
      qaFee: 50,
      tagUnitCost: 25,
      nfcUnitCost: 45,
      internalRolloutCost: 50
    }]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link
                href="/sprint-8/settings"
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Quote Configuration</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Manage default settings for quote calculations
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {saved && (
                <span className="text-sm text-green-600 font-medium">
                  ✓ Settings saved
                </span>
              )}
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <RefreshCw className="h-4 w-4 inline mr-1" />
                Reset to Defaults
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`inline-flex items-center px-4 py-2 font-medium rounded-lg transition-colors ${
                  saving
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* WG Labor Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Euro className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">White-Glove Labor</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hourly Rate (€)
              </label>
              <input
                type="number"
                value={settings.wg.hourlyRate}
                onChange={(e) => updateSetting('wg.hourlyRate', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overtime Threshold (hours)
              </label>
              <input
                type="number"
                value={settings.wg.overtimeThreshold}
                onChange={(e) => updateSetting('wg.overtimeThreshold', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overtime Multiplier
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.wg.overtimeMultiplier}
                onChange={(e) => updateSetting('wg.overtimeMultiplier', parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Per Diem (€/day)
              </label>
              <input
                type="number"
                value={settings.wg.perDiemRate}
                onChange={(e) => updateSetting('wg.perDiemRate', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Time Buffers */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Clock className="h-5 w-5 text-green-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Default Time Buffers</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Airport Check-in (minutes)
              </label>
              <input
                type="number"
                value={settings.buffers.airportCheckIn}
                onChange={(e) => updateSetting('buffers.airportCheckIn', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Train Buffer (minutes)
              </label>
              <input
                type="number"
                value={settings.buffers.trainBuffer}
                onChange={(e) => updateSetting('buffers.trainBuffer', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transfer Buffer (minutes)
              </label>
              <input
                type="number"
                value={settings.buffers.transferBuffer}
                onChange={(e) => updateSetting('buffers.transferBuffer', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Other Defaults */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Percent className="h-5 w-5 text-purple-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Default Values</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Internal Rollout (€/item)
              </label>
              <input
                type="number"
                value={settings.internal.rolloutCostPerItem}
                onChange={(e) => updateSetting('internal.rolloutCostPerItem', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Margin (%)
              </label>
              <input
                type="number"
                value={settings.defaults.marginPercentage}
                onChange={(e) => updateSetting('defaults.marginPercentage', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Insurance Rate (%)
              </label>
              <input
                type="number"
                step="0.001"
                value={settings.defaults.insuranceRate * 100}
                onChange={(e) => updateSetting('defaults.insuranceRate', (parseFloat(e.target.value) || 0) / 100)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Currency
              </label>
              <select
                value={settings.defaults.currency}
                onChange={(e) => updateSetting('defaults.currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
          </div>
        </div>

        {/* Hub Price Book */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Package className="h-5 w-5 text-orange-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Hub Price Book</h2>
            </div>
            <button
              onClick={addHub}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add Hub
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Hub Name</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">Auth Fee</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">Tag Unit</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">NFC Unit</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">Sewing</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">QA</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">Rollout</th>
                </tr>
              </thead>
              <tbody>
                {hubPrices.map((hub, index) => (
                  <tr key={hub.hubId} className="border-b">
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={hub.hubName}
                        onChange={(e) => updateHubPrice(index, 'hubName', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={hub.authenticationFee}
                        onChange={(e) => updateHubPrice(index, 'authenticationFee', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={hub.tagUnitCost}
                        onChange={(e) => updateHubPrice(index, 'tagUnitCost', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={hub.nfcUnitCost}
                        onChange={(e) => updateHubPrice(index, 'nfcUnitCost', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={hub.sewingFee}
                        onChange={(e) => updateHubPrice(index, 'sewingFee', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={hub.qaFee}
                        onChange={(e) => updateHubPrice(index, 'qaFee', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={hub.internalRolloutCost}
                        onChange={(e) => updateHubPrice(index, 'internalRolloutCost', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            <p>All prices in EUR. Hub names are matched flexibly (partial match supported).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
