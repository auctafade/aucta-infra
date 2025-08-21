'use client';

/**
 * OPERATIONS ROUTE CARD - Sprint-2 Professional Look
 * 
 * Comprehensive route option card with:
 * - Header: Label, hubs, ETA, totals, score
 * - Pills: Rate freshness, hub status, compliance
 * - Overview: Delivery window, operator effort, costs
 * - Tabs: Timeline, Transport, Costs, Assumptions
 * - CTAs: Plan route, Compare, Refresh rates
 */

import React, { useState } from 'react';
import {
  Calendar, Clock, DollarSign, MapPin, Package, Plane, Truck, Building2,
  CheckCircle, AlertTriangle, Info, RefreshCw, Eye, FileText, ArrowRight,
  Globe, Timer, Shield, Zap, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';

// Utility functions for safe data handling
const safeNumber = (value: any, fallback: number = 0): number => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? fallback : num;
};

const safeCurrency = (amount: any, currency: string = 'EUR'): string => {
  const num = safeNumber(amount);
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

const formatDateTime = (dateString: any): string => {
  if (!dateString) return '--';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '--';
    return date.toLocaleString('en-GB', { 
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '--';
  }
};

interface RouteOption {
  id: string;
  label: string;
  description: string;
  hubId?: { hubCode: string; city: string; country: string };
  hubCou?: { hubCode: string; city: string; country: string };
  costBreakdown: {
    total: number;
    clientPrice: number;
    currency: string;
  };
  schedule: {
    estimatedDelivery: string;
    totalHours: number;
    timeline?: Array<{
      step: string;
      startTime: string;
      endTime: string;
      location: string;
      responsible: string;
      buffer?: number;
    }>;
  };
  slaValidation?: {
    compliant: boolean;
    bufferHours: number;
    grade: string;
    risks: Array<{ type: string; severity: string; message: string }>;
  };
  operatorDetails?: {
    totalHours: number;
    overtime: number;
    requiresOvernight: boolean;
  };
  transport?: {
    legs: Array<{
      mode: 'ground' | 'flight' | 'train' | 'dhl';
      from: string;
      to: string;
      distance: number;
      duration: number;
      cost: number;
    }>;
  };
  detailedCosts?: {
    labor: number;
    transport: number;
    hubFees: number;
    inventory: number;
    insurance: number;
    surcharges: number;
    breakdown: Record<string, number>;
  };
  assumptions?: {
    rateSource: string;
    lastUpdated: string;
    ttl: number;
    hubCapacityCheck: string;
  };
  score: number;
  feasible: boolean;
  tier: number;
}

interface OperationsRouteCardProps {
  route: RouteOption;
  onSelectRoute: (routeId: string) => void;
  onCompareRoute: (routeId: string) => void;
  onRefreshRates: (routeId: string) => void;
  isSelected?: boolean;
  isRefreshing?: boolean;
  capacityStatus: 'high' | 'medium' | 'low' | 'none';
  ratesFreshness: 'fresh' | 'stale';
}

export default function OperationsRouteCard({
  route,
  onSelectRoute,
  onCompareRoute,
  onRefreshRates,
  isSelected = false,
  isRefreshing = false,
  capacityStatus,
  ratesFreshness
}: OperationsRouteCardProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'transport' | 'costs' | 'assumptions'>('timeline');
  const [isExpanded, setIsExpanded] = useState(false);

  // Safe number formatting with NaN guards
  const formatCurrency = (amount: number | undefined, currency = 'EUR'): string => {
    if (!amount || isNaN(amount)) return `-- ${currency}`;
    return `${amount.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })} ${currency}`;
  };

  // Safe date formatting with Invalid Date guards
  const formatDateTime = (dateString: string | undefined): { date: string; time: string; timezone: string } => {
    if (!dateString) return { date: '--', time: '--', timezone: 'UTC' };
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return { date: '--', time: '--', timezone: 'UTC' };
      }
      
      return {
        date: date.toLocaleDateString('en-GB'),
        time: date.toLocaleTimeString('en-GB', { hour12: false }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    } catch {
      return { date: '--', time: '--', timezone: 'UTC' };
    }
  };

  const eta = formatDateTime(route.schedule.estimatedDelivery);
  const isCapacityOK = capacityStatus === 'high' || capacityStatus === 'medium';
  const canPlanRoute = route.feasible && isCapacityOK;

  // Status pills
  const getPillVariant = (type: 'rates' | 'capacity' | 'compliance') => {
    switch (type) {
      case 'rates':
        return ratesFreshness === 'fresh' 
          ? 'bg-green-100 text-green-800 border-green-200' 
          : 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'capacity':
        return isCapacityOK 
          ? 'bg-green-100 text-green-800 border-green-200' 
          : 'bg-red-100 text-red-800 border-red-200';
      case 'compliance':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className={`bg-white rounded-lg border-2 transition-all duration-200 ${
      isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'
    }`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {route.label}
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              {route.description}
            </p>
            
            {/* Hub routing */}
            <div className="flex items-center gap-2 text-sm text-gray-700 mb-3">
              <Building2 className="w-4 h-4" />
              {route.tier === 3 ? (
                <span>
                  {route.hubId?.hubCode} ({route.hubId?.city}) → {route.hubCou?.hubCode} ({route.hubCou?.city})
                </span>
              ) : (
                <span>
                  {route.hubId?.hubCode} ({route.hubId?.city})
                </span>
              )}
            </div>
          </div>
          
          {/* Score and ETA */}
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatCurrency(route.costBreakdown.clientPrice, route.costBreakdown.currency)}
            </div>
            <div className="text-sm text-gray-500 mb-2">
              {formatCurrency(route.costBreakdown.total, 'EUR')}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{eta.date}</span>
            </div>
            <div className="text-xs text-gray-500">
              {eta.time} {eta.timezone}
            </div>
            
            {/* Score badge */}
            <div className="mt-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                safeNumber(route.score, 0) >= 80 ? 'bg-green-100 text-green-800' :
                safeNumber(route.score, 0) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                Score: {safeNumber(route.score, 0).toFixed(0)}
              </span>
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getPillVariant('rates')}`}>
            {ratesFreshness === 'fresh' ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
            {ratesFreshness === 'fresh' ? 'Fresh rates' : 'Stale rates'}
          </span>
          
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getPillVariant('capacity')}`}>
            {isCapacityOK ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
            {isCapacityOK ? 'Hub OK' : 'Hub tight'}
          </span>
          
          {route.tier === 3 && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getPillVariant('compliance')}`}>
              <Shield className="w-3 h-3 mr-1" />
              No DHL between Hubs
            </span>
          )}
          
          {route.slaValidation && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
              route.slaValidation.grade === 'A' ? 'bg-green-100 text-green-800 border-green-200' :
              route.slaValidation.grade === 'B' ? 'bg-blue-100 text-blue-800 border-blue-200' :
              route.slaValidation.grade === 'C' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
              'bg-red-100 text-red-800 border-red-200'
            }`}>
              SLA Grade {route.slaValidation.grade}
            </span>
          )}
        </div>

        {/* Compact Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Delivery Window</span>
            <div className="font-medium">{safeNumber(route.schedule?.totalHours, 0).toFixed(1)}h total</div>
          </div>
          
          <div>
            <span className="text-gray-500">WG Operator Effort</span>
            <div className="font-medium">
              {safeNumber(route.operatorDetails?.totalHours, 0).toFixed(1)}h
              {route.operatorDetails?.requiresOvernight && <span className="text-orange-600 ml-1">overnight</span>}
            </div>
          </div>
          
          <div>
            <span className="text-gray-500">Transport Cost</span>
            <div className="font-medium">{formatCurrency(route.detailedCosts?.transport, 'EUR')}</div>
          </div>
          
          <div>
            <span className="text-gray-500">Hub Fees</span>
            <div className="font-medium">{formatCurrency(route.detailedCosts?.hubFees, 'EUR')}</div>
          </div>
        </div>

        {/* Expand/Collapse Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 flex items-center justify-center w-full py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />
              Show Details
            </>
          )}
        </button>
      </div>

      {/* Detailed Tabs */}
      {isExpanded && (
        <div className="border-b border-gray-100">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-100">
            {[
              { id: 'timeline', label: 'Timeline', icon: Clock },
              { id: 'transport', label: 'Transport', icon: Truck },
              { id: 'costs', label: 'Detailed Costs', icon: DollarSign },
              { id: 'assumptions', label: 'Assumptions', icon: Info }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'timeline' && (
              <TimelineTab 
                timeline={route.schedule.timeline || []}
                totalHours={safeNumber(route.schedule?.totalHours, 0)}
              />
            )}
            
            {activeTab === 'transport' && (
              <TransportTab 
                legs={route.transport?.legs || []}
                totalCost={route.detailedCosts?.transport || 0}
              />
            )}
            
            {activeTab === 'costs' && (
              <DetailedCostsTab 
                costs={route.detailedCosts}
                breakdown={route.detailedCosts?.breakdown || {}}
              />
            )}
            
            {activeTab === 'assumptions' && (
              <AssumptionsTab 
                assumptions={route.assumptions}
                ratesFreshness={ratesFreshness}
              />
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-6 bg-gray-50 flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={() => onCompareRoute(route.id)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4 mr-2" />
            Compare
          </button>
          
          <button
            onClick={() => onRefreshRates(route.id)}
            disabled={isRefreshing}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh Rates
          </button>
        </div>

        <button
          onClick={() => onSelectRoute(route.id)}
          disabled={!canPlanRoute}
          className={`inline-flex items-center px-6 py-2 text-sm font-medium rounded-md transition-colors ${
            canPlanRoute
              ? 'text-white bg-blue-600 hover:bg-blue-700'
              : 'text-gray-400 bg-gray-200 cursor-not-allowed'
          }`}
        >
          {!route.feasible ? (
            <>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Not Feasible
            </>
          ) : !isCapacityOK ? (
            <>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Capacity Missing
            </>
          ) : (
            <>
              <ArrowRight className="w-4 h-4 mr-2" />
              Plan This Route
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Timeline Tab Component
function TimelineTab({ timeline, totalHours }: { 
  timeline: Array<{
    step: string;
    startTime: string;
    endTime: string;
    location: string;
    responsible: string;
    buffer?: number;
  }>;
  totalHours: number;
}) {
  const formatTimeWithTimezone = (timeString: string) => {
    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) return { local: '--', utc: '--' };
      
      return {
        local: date.toLocaleString('en-GB', { 
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          hour12: false
        }),
        utc: date.toLocaleString('en-GB', { 
          timeZone: 'UTC',
          hour12: false
        }) + ' UTC'
      };
    } catch {
      return { local: '--', utc: '--' };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">Complete Timeline</h4>
        <span className="text-sm text-gray-500">Total: {totalHours.toFixed(1)} hours</span>
      </div>
      
      <div className="space-y-3">
        {timeline.map((step, index) => {
          const startTime = formatTimeWithTimezone(step.startTime);
          const endTime = formatTimeWithTimezone(step.endTime);
          
          return (
            <div key={index} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-800">
                {index + 1}
              </div>
              
              <div className="flex-1 min-w-0">
                <h5 className="font-medium text-gray-900">{step.step}</h5>
                <p className="text-sm text-gray-600 mb-2">{step.location}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Start (Local):</span>
                    <div className="font-mono">{startTime.local}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Start (UTC):</span>
                    <div className="font-mono">{startTime.utc}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">End (Local):</span>
                    <div className="font-mono">{endTime.local}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">End (UTC):</span>
                    <div className="font-mono">{endTime.utc}</div>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                    {step.responsible}
                  </span>
                  {step.buffer && (
                    <span className="text-xs text-gray-500">
                      +{step.buffer}h buffer
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Transport Tab Component  
function TransportTab({ legs, totalCost }: {
  legs: Array<{
    mode: 'ground' | 'flight' | 'train' | 'dhl';
    from: string;
    to: string;
    distance: number;
    duration: number;
    cost: number;
  }>;
  totalCost: number;
}) {
  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'flight': return <Plane className="w-4 h-4" />;
      case 'train': return <Truck className="w-4 h-4" />;
      case 'ground': return <Truck className="w-4 h-4" />;
      case 'dhl': return <Package className="w-4 h-4" />;
      default: return <Truck className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">Transport Breakdown</h4>
        <span className="text-sm text-gray-500">Total: €{totalCost.toFixed(2)}</span>
      </div>
      
      <div className="space-y-3">
        {legs.map((leg, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {getModeIcon(leg.mode)}
              <div>
                <div className="font-medium text-gray-900 capitalize">{leg.mode}</div>
                <div className="text-sm text-gray-600">{leg.from} → {leg.to}</div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="font-medium">€{safeNumber(leg.cost, 0).toFixed(2)}</div>
              <div className="text-xs text-gray-500">
                {safeNumber(leg.distance, 0).toFixed(0)}km • {safeNumber(leg.duration, 0).toFixed(1)}h
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Detailed Costs Tab Component
function DetailedCostsTab({ costs, breakdown }: {
  costs?: {
    labor: number;
    transport: number;
    hubFees: number;
    inventory: number;
    insurance: number;
    surcharges: number;
  };
  breakdown: Record<string, number>;
}) {
  const categories = [
    { key: 'labor', label: 'Labor Costs', value: costs?.labor || 0 },
    { key: 'transport', label: 'Transport', value: costs?.transport || 0 },
    { key: 'hubFees', label: 'Hub Fees', value: costs?.hubFees || 0 },
    { key: 'inventory', label: 'NFC/Tag Units', value: costs?.inventory || 0 },
    { key: 'insurance', label: 'Insurance', value: costs?.insurance || 0 },
    { key: 'surcharges', label: 'Surcharges', value: costs?.surcharges || 0 }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium text-gray-900 mb-4">Cost Categories</h4>
        <div className="space-y-2">
          {categories.map(category => (
            <div key={category.key} className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-700">{category.label}</span>
              <span className="font-medium">€{safeNumber(category.value, 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
      
      {Object.keys(breakdown).length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-4">Detailed Breakdown</h4>
          <div className="space-y-1">
            {Object.entries(breakdown).map(([item, cost]) => (
              <div key={item} className="flex items-center justify-between py-1 text-sm">
                <span className="text-gray-600 capitalize">{item.replace(/([A-Z])/g, ' $1')}</span>
                <span>€{(cost || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Assumptions Tab Component
function AssumptionsTab({ assumptions, ratesFreshness }: {
  assumptions?: {
    rateSource: string;
    lastUpdated: string;
    ttl: number;
    hubCapacityCheck: string;
  };
  ratesFreshness: 'fresh' | 'stale';
}) {
  const formatLastUpdated = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '--';
      return date.toLocaleString('en-GB');
    } catch {
      return '--';
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Rate Sources & Assumptions</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <span className="text-sm text-gray-500">Rate Source</span>
            <div className="font-medium">{assumptions?.rateSource || 'Internal pricing'}</div>
          </div>
          
          <div>
            <span className="text-sm text-gray-500">Last Updated</span>
            <div className="font-medium">{formatLastUpdated(assumptions?.lastUpdated || '')}</div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <span className="text-sm text-gray-500">Cache TTL</span>
            <div className="font-medium">{assumptions?.ttl || 60} minutes</div>
          </div>
          
          <div>
            <span className="text-sm text-gray-500">Capacity Check</span>
            <div className="font-medium">{assumptions?.hubCapacityCheck || 'Real-time'}</div>
          </div>
        </div>
      </div>
      
      <div className={`p-3 rounded-lg border ${
        ratesFreshness === 'fresh' 
          ? 'bg-green-50 border-green-200' 
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center gap-2 mb-1">
          {ratesFreshness === 'fresh' ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <Clock className="w-4 h-4 text-yellow-600" />
          )}
          <span className="font-medium">
            {ratesFreshness === 'fresh' ? 'Rates are current' : 'Rates may be outdated'}
          </span>
        </div>
        <p className="text-sm text-gray-600">
          {ratesFreshness === 'fresh' 
            ? 'All pricing data is up-to-date and reflects current market rates.'
            : 'Some pricing data may be cached. Consider refreshing for latest rates.'
          }
        </p>
      </div>
    </div>
  );
}
