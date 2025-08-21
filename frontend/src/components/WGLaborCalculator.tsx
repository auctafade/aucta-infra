'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock, Euro, Calculator, Info, CheckSquare, Square,
  Plane, Train, ArrowLeftRight, Settings
} from 'lucide-react';
import { RouteSegment } from './RouteSegmentEditor';

interface BufferSettings {
  airportCheckIn: boolean;
  airportCheckInMinutes: number;
  trainBuffer: boolean;
  trainBufferMinutes: number;
  transferBuffer: boolean;
  transferBufferMinutes: number;
}

interface OvertimeSettings {
  threshold: number; // hours before overtime kicks in
  multiplier: number; // e.g., 1.5 for time-and-a-half
}

interface LaborCalculation {
  totalWGHours: number;
  bufferHours: number;
  totalActiveHours: number;
  regularHours: number;
  overtimeHours: number;
  baseLaborCost: number;
  overtimeCost: number;
  perDiemCost: number;
  totalLaborCost: number;
}

interface WGLaborCalculatorProps {
  segments: RouteSegment[];
  onLaborCostChange: (laborCost: number, details: LaborCalculation) => void;
}

export default function WGLaborCalculator({ segments, onLaborCostChange }: WGLaborCalculatorProps) {
  // Settings
  const [hourlyRate, setHourlyRate] = useState(65);
  const [overtimeSettings, setOvertimeSettings] = useState<OvertimeSettings>({
    threshold: 8,
    multiplier: 1.5
  });
  const [perDiemEnabled, setPerDiemEnabled] = useState(false);
  const [perDiemAmount, setPerDiemAmount] = useState(150);
  const [numberOfOperators, setNumberOfOperators] = useState(1);
  
  // Buffers
  const [buffers, setBuffers] = useState<BufferSettings>({
    airportCheckIn: false,
    airportCheckInMinutes: 90,
    trainBuffer: false,
    trainBufferMinutes: 20,
    transferBuffer: false,
    transferBufferMinutes: 30
  });

  // Calculated values
  const [laborCalculation, setLaborCalculation] = useState<LaborCalculation>({
    totalWGHours: 0,
    bufferHours: 0,
    totalActiveHours: 0,
    regularHours: 0,
    overtimeHours: 0,
    baseLaborCost: 0,
    overtimeCost: 0,
    perDiemCost: 0,
    totalLaborCost: 0
  });

  // Calculate labor costs whenever inputs change
  useEffect(() => {
    calculateLabor();
  }, [segments, hourlyRate, overtimeSettings, perDiemEnabled, perDiemAmount, numberOfOperators, buffers]);

  const calculateLabor = () => {
    // 1. Calculate total WG segment hours
    const wgSegments = segments.filter(s => s.mode === 'wg');
    const totalWGHours = wgSegments.reduce((sum, seg) => sum + (seg.duration || 0), 0);

    // 2. Calculate buffer hours
    let bufferHours = 0;
    
    // Check if any segment involves flights
    const hasFlights = wgSegments.some(seg => seg.wgPricing && seg.wgPricing.flights > 0);
    if (hasFlights && buffers.airportCheckIn) {
      // Add airport buffer for each flight segment
      const flightCount = wgSegments.filter(seg => seg.wgPricing && seg.wgPricing.flights > 0).length;
      bufferHours += (buffers.airportCheckInMinutes / 60) * flightCount;
    }

    // Check if any segment involves trains
    const hasTrains = wgSegments.some(seg => seg.wgPricing && seg.wgPricing.trains > 0);
    if (hasTrains && buffers.trainBuffer) {
      // Add train buffer for each train segment
      const trainCount = wgSegments.filter(seg => seg.wgPricing && seg.wgPricing.trains > 0).length;
      bufferHours += (buffers.trainBufferMinutes / 60) * trainCount;
    }

    // Add transfer buffer if enabled
    if (buffers.transferBuffer && wgSegments.length > 1) {
      // Add transfer buffer between segments
      const transferCount = Math.max(0, wgSegments.length - 1);
      bufferHours += (buffers.transferBufferMinutes / 60) * transferCount;
    }

    // 3. Calculate total active hours
    const totalActiveHours = totalWGHours + bufferHours;

    // 4. Calculate regular vs overtime hours per operator
    const hoursPerOperator = totalActiveHours;
    const regularHours = Math.min(hoursPerOperator, overtimeSettings.threshold);
    const overtimeHours = Math.max(0, hoursPerOperator - overtimeSettings.threshold);

    // 5. Calculate costs
    const baseLaborCost = regularHours * hourlyRate * numberOfOperators;
    const overtimeCost = overtimeHours * hourlyRate * overtimeSettings.multiplier * numberOfOperators;
    
    // Per diem calculation
    let perDiemCost = 0;
    if (perDiemEnabled) {
      // Calculate number of days (any hours over 8 = overnight stay)
      const requiresOvernight = totalActiveHours > 8;
      const numberOfDays = requiresOvernight ? Math.ceil(totalActiveHours / 24) : 0;
      perDiemCost = numberOfDays * perDiemAmount * numberOfOperators;
    }

    const totalLaborCost = baseLaborCost + overtimeCost + perDiemCost;

    // Update state
    const calculation: LaborCalculation = {
      totalWGHours,
      bufferHours,
      totalActiveHours,
      regularHours,
      overtimeHours,
      baseLaborCost,
      overtimeCost,
      perDiemCost,
      totalLaborCost
    };

    setLaborCalculation(calculation);
    onLaborCostChange(totalLaborCost, calculation);
  };

  const toggleBuffer = (bufferType: keyof BufferSettings) => {
    if (bufferType.endsWith('Minutes')) return; // Skip minute fields
    setBuffers(prev => ({
      ...prev,
      [bufferType]: !prev[bufferType as keyof BufferSettings]
    }));
  };

  const updateBufferMinutes = (bufferType: string, minutes: number) => {
    setBuffers(prev => ({
      ...prev,
      [bufferType]: minutes
    }));
  };

  // Check if route has specific transport types
  const hasFlightSegments = segments.some(s => s.mode === 'wg' && s.wgPricing && s.wgPricing.flights > 0);
  const hasTrainSegments = segments.some(s => s.mode === 'wg' && s.wgPricing && s.wgPricing.trains > 0);
  const hasMultipleWGSegments = segments.filter(s => s.mode === 'wg').length > 1;

  return (
    <div className="space-y-6">
      {/* Settings Row */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
          <Settings className="h-4 w-4 mr-2" />
          Labor Settings
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Hourly Rate (€)
            </label>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Number of Operators
            </label>
            <input
              type="number"
              value={numberOfOperators}
              onChange={(e) => setNumberOfOperators(parseInt(e.target.value) || 1)}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              OT Threshold (hours)
            </label>
            <input
              type="number"
              value={overtimeSettings.threshold}
              onChange={(e) => setOvertimeSettings({ ...overtimeSettings, threshold: parseFloat(e.target.value) || 8 })}
              step="0.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              OT Multiplier
            </label>
            <input
              type="number"
              value={overtimeSettings.multiplier}
              onChange={(e) => setOvertimeSettings({ ...overtimeSettings, multiplier: parseFloat(e.target.value) || 1.5 })}
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Per Diem Toggle */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPerDiemEnabled(!perDiemEnabled)}
            className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            {perDiemEnabled ? (
              <CheckSquare className="h-4 w-4 text-blue-600" />
            ) : (
              <Square className="h-4 w-4 text-gray-400" />
            )}
            <span>Per Diem Required</span>
          </button>
          {perDiemEnabled && (
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-600">Amount (€):</label>
              <input
                type="number"
                value={perDiemAmount}
                onChange={(e) => setPerDiemAmount(parseFloat(e.target.value) || 0)}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <span className="text-xs text-gray-500">/day/operator</span>
            </div>
          )}
        </div>
      </div>

      {/* Buffer Selections */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
          <Clock className="h-4 w-4 mr-2" />
          Time Buffers
        </h4>
        
        <div className="space-y-3">
          {/* Airport Check-in Buffer */}
          {hasFlightSegments && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <button
                onClick={() => toggleBuffer('airportCheckIn')}
                className="flex items-center space-x-2 text-sm"
              >
                {buffers.airportCheckIn ? (
                  <CheckSquare className="h-4 w-4 text-blue-600" />
                ) : (
                  <Square className="h-4 w-4 text-gray-400" />
                )}
                <Plane className="h-4 w-4 text-gray-600" />
                <span className="font-medium">Airport Check-in Buffer</span>
              </button>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={buffers.airportCheckInMinutes}
                  onChange={(e) => updateBufferMinutes('airportCheckInMinutes', parseInt(e.target.value) || 0)}
                  disabled={!buffers.airportCheckIn}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                />
                <span className="text-xs text-gray-600">minutes</span>
              </div>
            </div>
          )}

          {/* Train Buffer */}
          {hasTrainSegments && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <button
                onClick={() => toggleBuffer('trainBuffer')}
                className="flex items-center space-x-2 text-sm"
              >
                {buffers.trainBuffer ? (
                  <CheckSquare className="h-4 w-4 text-blue-600" />
                ) : (
                  <Square className="h-4 w-4 text-gray-400" />
                )}
                <Train className="h-4 w-4 text-gray-600" />
                <span className="font-medium">Train Station Buffer</span>
              </button>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={buffers.trainBufferMinutes}
                  onChange={(e) => updateBufferMinutes('trainBufferMinutes', parseInt(e.target.value) || 0)}
                  disabled={!buffers.trainBuffer}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                />
                <span className="text-xs text-gray-600">minutes</span>
              </div>
            </div>
          )}

          {/* Transfer Buffer */}
          {hasMultipleWGSegments && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <button
                onClick={() => toggleBuffer('transferBuffer')}
                className="flex items-center space-x-2 text-sm"
              >
                {buffers.transferBuffer ? (
                  <CheckSquare className="h-4 w-4 text-blue-600" />
                ) : (
                  <Square className="h-4 w-4 text-gray-400" />
                )}
                <ArrowLeftRight className="h-4 w-4 text-gray-600" />
                <span className="font-medium">Transfer Buffer (between segments)</span>
              </button>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={buffers.transferBufferMinutes}
                  onChange={(e) => updateBufferMinutes('transferBufferMinutes', parseInt(e.target.value) || 0)}
                  disabled={!buffers.transferBuffer}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                />
                <span className="text-xs text-gray-600">minutes</span>
              </div>
            </div>
          )}

          {!hasFlightSegments && !hasTrainSegments && !hasMultipleWGSegments && (
            <p className="text-sm text-gray-500 text-center py-2">
              No buffers available (add WG segments with transport details first)
            </p>
          )}
        </div>
      </div>

      {/* Calculated Output (Read-only) */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
          <Calculator className="h-4 w-4 mr-2" />
          Labor Calculation (Auto-computed)
        </h4>

        {/* Hours Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">WG Segment Hours</label>
            <div className="text-lg font-semibold text-gray-900">
              {laborCalculation.totalWGHours.toFixed(1)}h
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Buffer Hours</label>
            <div className="text-lg font-semibold text-gray-900">
              {laborCalculation.bufferHours.toFixed(1)}h
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Total Active Hours</label>
            <div className="text-lg font-semibold text-blue-600">
              {laborCalculation.totalActiveHours.toFixed(1)}h
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Overtime Hours</label>
            <div className="text-lg font-semibold text-orange-600">
              {laborCalculation.overtimeHours.toFixed(1)}h
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Base Labor ({laborCalculation.regularHours.toFixed(1)}h × €{hourlyRate} × {numberOfOperators} op.)
            </span>
            <span className="font-medium">€{laborCalculation.baseLaborCost.toFixed(2)}</span>
          </div>
          
          {laborCalculation.overtimeHours > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Overtime ({laborCalculation.overtimeHours.toFixed(1)}h × €{hourlyRate} × {overtimeSettings.multiplier}x × {numberOfOperators} op.)
              </span>
              <span className="font-medium text-orange-600">€{laborCalculation.overtimeCost.toFixed(2)}</span>
            </div>
          )}
          
          {perDiemEnabled && laborCalculation.perDiemCost > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Per Diem ({Math.ceil(laborCalculation.totalActiveHours / 24)} days × €{perDiemAmount} × {numberOfOperators} op.)
              </span>
              <span className="font-medium">€{laborCalculation.perDiemCost.toFixed(2)}</span>
            </div>
          )}
          
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between font-semibold text-base">
              <span>WG Labor Subtotal</span>
              <span className="text-blue-600">€{laborCalculation.totalLaborCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div className="flex items-start">
          <Info className="h-4 w-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-xs text-yellow-800">
            <p className="font-semibold mb-1">How Labor is Calculated:</p>
            <ul className="space-y-0.5">
              <li>• Active hours = Sum of WG segment durations + selected buffers</li>
              <li>• Regular hours = First {overtimeSettings.threshold} hours per operator</li>
              <li>• Overtime = Hours beyond {overtimeSettings.threshold}h at {overtimeSettings.multiplier}x rate</li>
              <li>• Per diem applies when trip requires overnight stay (>8h active time)</li>
              <li>• All costs multiply by number of operators</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
