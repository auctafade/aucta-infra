'use client';

/**
 * DHL LABELS PAGE - LOGISTICS SPRINT 8
 * 
 * Purpose: Purchase/generate shipping labels for DHL legs defined by planned route
 * This page materializes the DHL parts of the route without changing the plan itself
 * 
 * Key Features:
 * - Context header with shipment details
 * - Display DHL legs from selected route
 * - Label purchase flow with API simulation
 * - Tracking number assignment
 * - Integration with hub console and client apps
 * - Clear separation from WG legs
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Truck,
  MapPin,
  Clock,
  Building2,
  AlertTriangle,
  CheckCircle,
  Zap,
  FileText,
  CreditCard,
  ExternalLink,
  Download,
  Eye,
  Printer,
  RefreshCw,
  Shield,
  Info,
  Tag,
  Plane,
  Globe,
  Calendar,
  DollarSign,
  QrCode,
  User,
  ArrowRight,
  PlayCircle,
  CheckCircle2,
  X,
  Monitor,
  Copy,
  Mail,
  Trash2,
  Save,
  Archive
} from 'lucide-react';
import { api } from '@/lib/api';

interface ShipmentData {
  shipment_id: string;
  reference_sku: string;
  assigned_tier: string;
  assigned_hub: string;
  tier_status: string;
  sender_location: string;
  buyer_location: string;
  declared_value: number;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  fragility?: string;
  sla_target_date?: string;
  created_at: string;
}

interface RouteData {
  shipmentId: string;
  planId: string;
  routeLabel: string;
  status: string;
  selectedAt: string;
  totalCost: number;
  estimatedDays: number;
  deliveryDate: string;
  provisionalLegs: ProvisionaLeg[];
  nextAction: string;
}

interface ProvisionaLeg {
  leg_order: number;
  leg_type: string;
  from_location: string;
  to_location: string;
  start_date: string;
  end_date: string;
  leg_cost: number;
  carrier: string;
  provisional_eta: string;
}

interface DhlLeg extends ProvisionaLeg {
  serviceType: 'standard' | 'express';
  estimatedTransitDays: number;
  labelStatus: 'pending' | 'purchasing' | 'generated' | 'failed';
  trackingNumber?: string;
  labelUrl?: string;
  dhlReference?: string;
  etaBand: string;
  rateTtlStatus: 'fresh' | 'amber' | 'stale';
  validationStatus: 'ready' | 'missing_data';
  missingData?: string[];
  senderCountry?: string;
  buyerCountry?: string;
  // Options configuration
  options?: DhlLegOptions;
  // Cost breakdown
  costBreakdown?: DhlCostBreakdown;
  provisionalCost?: number; // Original estimate from plan
}

interface DhlCostBreakdown {
  baseCost: number;
  fuelSurcharge: number;
  remoteAreaSurcharge: number;
  insuranceCost: number;
  signatureCost: number;
  customsClearance?: number;
  total: number;
  currency: string;
}

interface DhlLegOptions {
  serviceLevel: 'standard' | 'express';
  signatureRequired: boolean;
  insuredValue: number;
  packages: DhlPackage[];
  pickupMethod: 'pickup' | 'dropoff';
  pickupWindow?: {
    date: string;
    timeWindow: string;
  };
  labelFormat: 'pdf' | 'png';
  paperlessTrade: boolean;
  addresses: {
    sender: AddressData;
    hub: AddressData;
    buyer: AddressData;
  };
  customs?: CustomsData;
}

interface DhlPackage {
  id: string;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  quantity: number;
  description: string;
}

interface AddressData {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
  email: string;
  validationState: 'valid' | 'invalid' | 'pending';
  validationErrors?: string[];
}

interface CustomsData {
  isRequired: boolean;
  commercialInvoice: {
    shipper: string;
    recipient: string;
    hsCode: string;
    description: string;
    declaredValue: number;
    currency: string;
    incoterm: string;
    contentsType: string;
  };
  eoriNumber?: string;
  vatNumber?: string;
  documents: {
    invoiceAttached: boolean;
    receiptAttached: boolean;
  };
}

interface LabelPurchaseResult {
  success: boolean;
  trackingNumber: string;
  dhlReference: string;
  labelUrl: string;
  estimatedDelivery: string;
  cost: number;
  currency: string;
  error?: string;
}

interface ToastAction {
  label: string;
  action: () => void;
  icon?: any;
}

interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// Event interfaces for system integration
interface DhlLabelPurchasedEvent {
  event: 'dhl.label.purchased';
  data: {
    shipmentId: string;
    legId: string;
    service: 'standard' | 'express';
    costCts: number; // Cost in cents
    trackingNumber: string;
    actorId: string;
    ts: string;
  };
}

interface DhlTrackingAddedEvent {
  event: 'dhl.tracking.added';
  data: {
    shipmentId: string;
    legId: string;
    trackingNumber: string;
    carrier: 'DHL';
    ts: string;
  };
}

interface DhlPickupScheduledEvent {
  event: 'dhl.pickup.scheduled';
  data: {
    shipmentId: string;
    legId: string;
    windowFrom: string;
    windowTo: string;
    ts: string;
  };
}

type DhlEvent = DhlLabelPurchasedEvent | DhlTrackingAddedEvent | DhlPickupScheduledEvent;

// Telemetry Event Interfaces
interface DhlTelemetryEvent {
  event: 'dhl.rate.refresh' | 'dhl.purchase.time_ms' | 'dhl.guardrail.triggered' | 'dhl.variance.vs_plan_pct';
  data: any;
  timestamp: string;
  sessionId: string;
}

interface RemoteAreaSurcharge {
  detected: boolean;
  location: string;
  surcharge: number;
  currency: string;
  reason: string;
}

interface AddressSuggestion {
  field: string;
  current: string;
  suggested: string;
  confidence: number;
  reason: string;
}

interface CurrencyDisplay {
  client: {
    amount: number;
    currency: string;
    symbol: string;
  };
  base: {
    amount: number;
    currency: 'EUR';
    symbol: '€';
  };
  exchangeRate: number;
  lastUpdated: string;
}

interface ValidationIssue {
  type: 'address' | 'customs' | 'insured' | 'stale_rate' | 'multi_parcel' | 'remote_area';
  field?: string;
  message: string;
  suggestion?: AddressSuggestion;
  canContinue: boolean;
}

// Comprehensive Options Panel Component
function LegOptionsPanel({ 
  leg, 
  shipment, 
  options, 
  onOptionsChange, 
  onPurchaseLabel, 
  isPurchasing 
}: {
  leg: DhlLeg;
  shipment: ShipmentData;
  options: DhlLegOptions;
  onOptionsChange: (updates: Partial<DhlLegOptions>) => void;
  onPurchaseLabel: () => void;
  isPurchasing: boolean;
}) {
  const [activeTab, setActiveTab] = useState('service');
  const validationErrors = validateLegOptions(options);
  const canPurchase = validationErrors.length === 0 && leg.rateTtlStatus !== 'stale';

  const formatCurrency = (amount: number) => `€${amount.toLocaleString()}`;

  const tabs = [
    { id: 'service', label: 'Service & Packages', icon: Package },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
    { id: 'customs', label: 'Customs & Docs', icon: Globe },
    { id: 'summary', label: 'Summary', icon: CheckCircle }
  ];

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Options (per leg) - {leg.from_location.split(',')[0]} → {leg.to_location.split(',')[0]}
        </h3>
        <p className="text-sm text-gray-600">
          Choose service level and finalize shipment data before purchase
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'service' && (
          <ServicePackagesTab 
            options={options} 
            onOptionsChange={onOptionsChange}
            leg={leg}
            shipment={shipment}
          />
        )}
        
        {activeTab === 'addresses' && (
          <AddressesTab 
            options={options} 
            onOptionsChange={onOptionsChange}
            leg={leg}
          />
        )}
        
        {activeTab === 'customs' && (
          <CustomsTab 
            options={options} 
            onOptionsChange={onOptionsChange}
            leg={leg}
            shipment={shipment}
          />
        )}
        
        {activeTab === 'summary' && (
          <SummaryTab 
            options={options}
            leg={leg}
            shipment={shipment}
            validationErrors={validationErrors}
          />
        )}
      </div>

      {/* Guardrails & Purchase Actions */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              Validation Issues
            </div>
            <ul className="text-sm text-red-700 space-y-1">
              {validationErrors.map((error, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <X className="h-3 w-3" />
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {leg.rateTtlStatus === 'stale' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
              <Clock className="h-4 w-4" />
              Rate Expired
            </div>
            <p className="text-sm text-red-700 mb-3">
              DHL rates have expired. Please refresh rates before purchasing labels.
            </p>
            <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
              <RefreshCw className="h-4 w-4 mr-2 inline" />
              Refresh Rates
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Estimated cost: {formatCurrency(leg.leg_cost)} • 
            Insured for: {formatCurrency(options.insuredValue)} • 
            Service: DHL {options.serviceLevel === 'express' ? 'Express' : 'Standard'}
          </div>
          
          <button
            onClick={onPurchaseLabel}
            disabled={!canPurchase || isPurchasing}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              canPurchase && !isPurchasing
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isPurchasing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 inline animate-spin" />
                Purchasing Label...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2 inline" />
                Purchase Label
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function to validate options
function validateLegOptions(options: DhlLegOptions): string[] {
  const errors: string[] = [];
  
  // Weight/dimensions validation
  if (options.packages.some(pkg => pkg.weight <= 0)) {
    errors.push('Package weight must be greater than 0');
  }
  
  if (options.packages.some(pkg => 
    pkg.dimensions.length <= 0 || pkg.dimensions.width <= 0 || pkg.dimensions.height <= 0
  )) {
    errors.push('Package dimensions must be greater than 0');
  }
  
  // Address validation
  Object.entries(options.addresses).forEach(([key, address]) => {
    if (address.validationState === 'invalid') {
      errors.push(`${key} address has validation errors`);
    }
    if (!address.phone || !address.email) {
      errors.push(`${key} phone and email are required`);
    }
  });
  
  // Insurance validation
  if (options.insuredValue < 0) {
    errors.push('Insured value cannot be negative');
  }
  
  // Customs validation
  if (options.customs?.isRequired) {
    if (!options.customs.commercialInvoice.hsCode) {
      errors.push('HS code is required for cross-border shipment');
    }
    if (!options.customs.commercialInvoice.incoterm) {
      errors.push('Incoterm is required for cross-border shipment');
    }
    if (!options.customs.documents.invoiceAttached) {
      errors.push('Commercial invoice must be attached for customs');
    }
  }
  
  return errors;
}

// Service & Packages Tab Component
function ServicePackagesTab({ 
  options, 
  onOptionsChange, 
  leg, 
  shipment 
}: {
  options: DhlLegOptions;
  onOptionsChange: (updates: Partial<DhlLegOptions>) => void;
  leg: DhlLeg;
  shipment: ShipmentData;
}) {
  const formatCurrency = (amount: number) => `€${amount.toLocaleString()}`;
  const valueThreshold = 500;
  const maxInsuredValue = shipment.declared_value * 1.5; // Allow 50% over declared value
  
  const addPackage = () => {
    const newPackage: DhlPackage = {
      id: `pkg-${Date.now()}`,
      weight: options.packages[0]?.weight || 1.0,
      dimensions: options.packages[0]?.dimensions || { length: 30, width: 20, height: 10 },
      quantity: 1,
      description: `${shipment.reference_sku} - Additional Package`
    };
    
    onOptionsChange({
      packages: [...options.packages, newPackage]
    });
  };
  
  const updatePackage = (packageId: string, updates: Partial<DhlPackage>) => {
    onOptionsChange({
      packages: options.packages.map(pkg => 
        pkg.id === packageId ? { ...pkg, ...updates } : pkg
      )
    });
  };
  
  const removePackage = (packageId: string) => {
    if (options.packages.length > 1) {
      onOptionsChange({
        packages: options.packages.filter(pkg => pkg.id !== packageId)
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Service Level */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Service Level</h4>
        <div className="grid grid-cols-2 gap-4">
          {(['standard', 'express'] as const).map((service) => (
            <button
              key={service}
              onClick={() => onOptionsChange({ serviceLevel: service })}
              className={`p-4 border rounded-lg text-left transition-colors ${
                options.serviceLevel === service
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {service === 'express' ? (
                  <Plane className="h-5 w-5 text-orange-600" />
                ) : (
                  <Truck className="h-5 w-5 text-blue-600" />
                )}
                <div>
                  <div className="font-medium">DHL {service === 'express' ? 'Express' : 'Standard'}</div>
                  <div className="text-sm text-gray-600">
                    {service === 'express' ? '2-3 business days' : '3-5 business days'}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          ℹ️ Reflects plan suggestion, but editable here
        </p>
      </div>

      {/* Signature & Insurance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Signature Options</h4>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={options.signatureRequired}
                onChange={(e) => onOptionsChange({ signatureRequired: e.target.checked })}
                disabled={shipment.declared_value > valueThreshold}
                className="rounded border-gray-300"
              />
              <div>
                <span className="text-gray-900">Signature required</span>
                {shipment.declared_value > valueThreshold && (
                  <div className="text-xs text-orange-600">
                    ⚠️ Forced on above {formatCurrency(valueThreshold)} threshold
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-3">Insured Value</h4>
          <div className="space-y-2">
            <input
              type="number"
              value={options.insuredValue}
              onChange={(e) => onOptionsChange({ insuredValue: Math.min(maxInsuredValue, Math.max(0, Number(e.target.value))) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              min="0"
              max={maxInsuredValue}
            />
            <div className="text-sm text-gray-600">
              Default: {formatCurrency(shipment.declared_value)} • 
              Max: {formatCurrency(maxInsuredValue)}
            </div>
          </div>
        </div>
      </div>

      {/* Packages */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Packages</h4>
          <button
            onClick={addPackage}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Add Package
          </button>
        </div>
        
        <div className="space-y-4">
          {options.packages.map((pkg, index) => (
            <div key={pkg.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-gray-900">Package {index + 1}</h5>
                {options.packages.length > 1 && (
                  <button
                    onClick={() => removePackage(pkg.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={pkg.weight}
                    onChange={(e) => updatePackage(pkg.id, { weight: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="0.1"
                    step="0.1"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={pkg.quantity}
                    onChange={(e) => updatePackage(pkg.id, { quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dimensions (cm)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="Length"
                    value={pkg.dimensions.length}
                    onChange={(e) => updatePackage(pkg.id, { 
                      dimensions: { ...pkg.dimensions, length: Number(e.target.value) } 
                    })}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Width"
                    value={pkg.dimensions.width}
                    onChange={(e) => updatePackage(pkg.id, { 
                      dimensions: { ...pkg.dimensions, width: Number(e.target.value) } 
                    })}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Height"
                    value={pkg.dimensions.height}
                    onChange={(e) => updatePackage(pkg.id, { 
                      dimensions: { ...pkg.dimensions, height: Number(e.target.value) } 
                    })}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={pkg.description}
                  onChange={(e) => updatePackage(pkg.id, { description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pickup vs Drop-off */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">
          {leg.from_location.toLowerCase().includes('hub') ? 'Hub Drop-off' : 'Pickup vs Drop-off'}
        </h4>
        
        {leg.from_location.toLowerCase().includes('hub') ? (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-700">
              <Building2 className="h-4 w-4" />
              <span>Hub → Buyer: Typically hub drop-off after processing</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              This leg will be dropped off at DHL by the hub team after processing.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(['pickup', 'dropoff'] as const).map((method) => (
              <label key={method} className="flex items-start gap-3">
                <input
                  type="radio"
                  name="pickupMethod"
                  value={method}
                  checked={options.pickupMethod === method}
                  onChange={(e) => onOptionsChange({ pickupMethod: e.target.value as 'pickup' | 'dropoff' })}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-gray-900">
                    {method === 'pickup' ? 'DHL Pickup' : 'Drop-off'}
                  </span>
                  <div className="text-sm text-gray-600">
                    {method === 'pickup' 
                      ? 'Request DHL pickup (date/time window)'
                      : 'Drop-off at DHL service point (if allowed by policy)'
                    }
                  </div>
                </div>
              </label>
            ))}
            
            {options.pickupMethod === 'pickup' && (
              <div className="ml-6 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pickup Date
                  </label>
                  <input
                    type="date"
                    value={options.pickupWindow?.date || ''}
                    onChange={(e) => onOptionsChange({
                      pickupWindow: {
                        ...options.pickupWindow,
                        date: e.target.value,
                        timeWindow: options.pickupWindow?.timeWindow || '09:00-17:00'
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Window
                  </label>
                  <select
                    value={options.pickupWindow?.timeWindow || '09:00-17:00'}
                    onChange={(e) => onOptionsChange({
                      pickupWindow: {
                        ...options.pickupWindow,
                        date: options.pickupWindow?.date || '',
                        timeWindow: e.target.value
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="09:00-12:00">Morning (9 AM - 12 PM)</option>
                    <option value="12:00-17:00">Afternoon (12 PM - 5 PM)</option>
                    <option value="09:00-17:00">All Day (9 AM - 5 PM)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Label Format */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Label Format</h4>
        <div className="grid grid-cols-2 gap-4">
          {(['pdf', 'png'] as const).map((format) => (
            <button
              key={format}
              onClick={() => onOptionsChange({ labelFormat: format })}
              className={`p-3 border rounded-lg text-center transition-colors ${
                options.labelFormat === format
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <FileText className="h-5 w-5 mx-auto mb-2" />
              <div className="font-medium">{format.toUpperCase()}</div>
            </button>
          ))}
        </div>
        
        <div className="mt-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={options.paperlessTrade}
              onChange={(e) => onOptionsChange({ paperlessTrade: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-gray-900">
              Paperless trade (if supported)
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

// Addresses Tab Component  
function AddressesTab({ 
  options, 
  onOptionsChange, 
  leg 
}: {
  options: DhlLegOptions;
  onOptionsChange: (updates: Partial<DhlLegOptions>) => void;
  leg: DhlLeg;
}) {
  const updateAddress = (type: 'sender' | 'hub' | 'buyer', updates: Partial<AddressData>) => {
    onOptionsChange({
      addresses: {
        ...options.addresses,
        [type]: {
          ...options.addresses[type],
          ...updates
        }
      }
    });
  };

  const validateAddress = (type: 'sender' | 'hub' | 'buyer') => {
    // Simulate address validation
    const address = options.addresses[type];
    const errors: string[] = [];
    
    if (!address.postcode.match(/^[A-Z0-9\s-]+$/)) {
      errors.push('Invalid postcode format');
    }
    if (!address.phone.match(/^\+?[\d\s-()]+$/)) {
      errors.push('Invalid phone format');
    }
    if (!address.email.includes('@')) {
      errors.push('Invalid email format');
    }
    
    updateAddress(type, {
      validationState: errors.length > 0 ? 'invalid' : 'valid',
      validationErrors: errors
    });
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h4 className="font-medium text-gray-900 mb-2">Address Recap with Validation</h4>
        <p className="text-sm text-gray-600">
          Verify sender, hub, and buyer addresses with validation state
        </p>
      </div>

      {(['sender', 'hub', 'buyer'] as const).map((type) => {
        const address = options.addresses[type];
        const isRelevant = type === 'sender' || type === 'buyer' || 
          (type === 'hub' && (leg.from_location.toLowerCase().includes('hub') || leg.to_location.toLowerCase().includes('hub')));
        
        if (!isRelevant) return null;
        
        return (
          <div key={type} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-medium text-gray-900 capitalize">{type} Address</h5>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                address.validationState === 'valid' ? 'text-green-600 bg-green-100' :
                address.validationState === 'invalid' ? 'text-red-600 bg-red-100' :
                'text-yellow-600 bg-yellow-100'
              }`}>
                {address.validationState === 'valid' ? '✓ Valid' :
                 address.validationState === 'invalid' ? '⚠ Invalid' : '⏳ Pending'}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={address.name}
                  onChange={(e) => updateAddress(type, { name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={address.phone}
                  onChange={(e) => updateAddress(type, { phone: e.target.value })}
                  onBlur={() => validateAddress(type)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  value={address.address1}
                  onChange={(e) => updateAddress(type, { address1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={address.address2 || ''}
                  onChange={(e) => updateAddress(type, { address2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) => updateAddress(type, { city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Postcode *
                </label>
                <input
                  type="text"
                  value={address.postcode}
                  onChange={(e) => updateAddress(type, { postcode: e.target.value })}
                  onBlur={() => validateAddress(type)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country *
                </label>
                <input
                  type="text"
                  value={address.country}
                  onChange={(e) => updateAddress(type, { country: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={address.email}
                  onChange={(e) => updateAddress(type, { email: e.target.value })}
                  onBlur={() => validateAddress(type)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            
            {address.validationErrors && address.validationErrors.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-800 font-medium mb-1">Validation Errors:</div>
                <ul className="text-sm text-red-700 space-y-1">
                  {address.validationErrors.map((error, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <X className="h-3 w-3" />
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Customs Tab Component
function CustomsTab({ 
  options, 
  onOptionsChange, 
  leg, 
  shipment 
}: {
  options: DhlLegOptions;
  onOptionsChange: (updates: Partial<DhlLegOptions>) => void;
  leg: DhlLeg;
  shipment: ShipmentData;
}) {
  const isCrossBorder = leg.senderCountry !== leg.buyerCountry;
  const isUKEU = (leg.senderCountry === 'UK' && leg.buyerCountry !== 'UK') || 
                 (leg.senderCountry !== 'UK' && leg.buyerCountry === 'UK');
  
  const updateCustoms = (updates: Partial<CustomsData>) => {
    onOptionsChange({
      customs: {
        ...options.customs,
        ...updates
      } as CustomsData
    });
  };
  
  const updateCommercialInvoice = (updates: Partial<CustomsData['commercialInvoice']>) => {
    if (options.customs) {
      updateCustoms({
        commercialInvoice: {
          ...options.customs.commercialInvoice,
          ...updates
        }
      });
    }
  };
  
  const updateDocuments = (updates: Partial<CustomsData['documents']>) => {
    if (options.customs) {
      updateCustoms({
        documents: {
          ...options.customs.documents,
          ...updates
        }
      });
    }
  };

  if (!isCrossBorder) {
    return (
      <div className="text-center py-8">
        <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Customs Required</h3>
        <p className="text-gray-600">
          This is a domestic shipment within {leg.senderCountry}. No customs documentation needed.
        </p>
      </div>
    );
  }

  if (!options.customs) return null;

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h4 className="font-medium text-gray-900 mb-2">Customs & Duties (Cross-border)</h4>
        <p className="text-sm text-gray-600">
          {leg.senderCountry} → {leg.buyerCountry} shipment requires customs documentation
        </p>
      </div>

      {/* Commercial Invoice */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h5 className="font-medium text-gray-900 mb-4">Commercial Invoice</h5>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shipper *
            </label>
            <input
              type="text"
              value={options.customs.commercialInvoice.shipper}
              onChange={(e) => updateCommercialInvoice({ shipper: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipient *
            </label>
            <input
              type="text"
              value={options.customs.commercialInvoice.recipient}
              onChange={(e) => updateCommercialInvoice({ recipient: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HS Code *
            </label>
            <input
              type="text"
              value={options.customs.commercialInvoice.hsCode}
              onChange={(e) => updateCommercialInvoice({ hsCode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g., 7113.19.00"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Declared Value *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={options.customs.commercialInvoice.declaredValue}
                onChange={(e) => updateCommercialInvoice({ declaredValue: Number(e.target.value) })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <select
                value={options.customs.commercialInvoice.currency}
                onChange={(e) => updateCommercialInvoice({ currency: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <input
              type="text"
              value={options.customs.commercialInvoice.description}
              onChange={(e) => updateCommercialInvoice({ description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Incoterm *
            </label>
            <select
              value={options.customs.commercialInvoice.incoterm}
              onChange={(e) => updateCommercialInvoice({ incoterm: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="DAP">DAP (Delivered at Place)</option>
              <option value="DDP">DDP (Delivered Duty Paid)</option>
              <option value="EXW">EXW (Ex Works)</option>
              <option value="FOB">FOB (Free on Board)</option>
            </select>
            <p className="text-xs text-gray-600 mt-1">Default: DAP</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contents Type
            </label>
            <select
              value={options.customs.commercialInvoice.contentsType}
              onChange={(e) => updateCommercialInvoice({ contentsType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="Commercial goods">Commercial goods</option>
              <option value="Service/Authentication return">Service/Authentication return</option>
              <option value="Gift">Gift</option>
              <option value="Personal effects">Personal effects</option>
            </select>
            {leg.from_location.toLowerCase().includes('hub') && (
              <p className="text-xs text-blue-600 mt-1">
                ℹ️ Hub legs typically use "Service/Authentication return"
              </p>
            )}
          </div>
        </div>
      </div>

      {/* EORI/VAT for UK/EU */}
      {isUKEU && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-4">UK/EU Requirements</h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                EORI Number
              </label>
              <input
                type="text"
                value={options.customs.eoriNumber || ''}
                onChange={(e) => updateCustoms({ eoriNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="GB123456789000"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                VAT Number
              </label>
              <input
                type="text"
                value={options.customs.vatNumber || ''}
                onChange={(e) => updateCustoms({ vatNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="FR12345678901"
              />
            </div>
          </div>
          
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              ⚠️ UK/EU lanes: customs documentation is mandatory
            </p>
          </div>
        </div>
      )}

      {/* Documents Checklist */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h5 className="font-medium text-gray-900 mb-4">Documents Checklist</h5>
        
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={options.customs.documents.invoiceAttached}
              onChange={(e) => updateDocuments({ invoiceAttached: e.target.checked })}
              className="rounded border-gray-300"
            />
            <div>
              <span className="text-gray-900">Commercial Invoice attached *</span>
              <div className="text-sm text-gray-600">
                Required for customs clearance
              </div>
            </div>
          </label>
          
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={options.customs.documents.receiptAttached}
              onChange={(e) => updateDocuments({ receiptAttached: e.target.checked })}
              className="rounded border-gray-300"
            />
            <div>
              <span className="text-gray-900">Receipt/Invoice image</span>
              <div className="text-sm text-gray-600">
                Supporting documentation
              </div>
            </div>
          </label>
        </div>
        
        <div className="mt-4 flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            📎 Attach Invoice
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
            📄 Preview Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

// Actions Panel Component
function ActionsPanel({ 
  dhlLegs,
  legOptions,
  purchasing,
  refreshingRate,
  voidingLabel,
  downloadingAll,
  savedDrafts,
  buyLabel,
  buyAndDownload,
  buyAndDownloading,
  refreshRate,
  saveForLater,
  voidLabel,
  downloadAllLabels,
  fieldErrors
}: {
  dhlLegs: DhlLeg[];
  legOptions: Record<string, DhlLegOptions>;
  purchasing: string | null;
  refreshingRate: string | null;
  voidingLabel: string | null;
  downloadingAll: boolean;
  savedDrafts: Set<string>;
  buyLabel: (legId: string) => Promise<ActionResult>;
  buyAndDownload: (legId: string) => Promise<ActionResult>;
  buyAndDownloading: string | null;
  refreshRate: (legId: string) => Promise<ActionResult>;
  saveForLater: (legId: string) => ActionResult;
  voidLabel: (legId: string) => Promise<ActionResult>;
  downloadAllLabels: () => Promise<ActionResult>;
  fieldErrors: Record<string, Record<string, string[]>>;
}) {
  const generatedLegs = dhlLegs.filter(leg => leg.labelStatus === 'generated');
  const pendingLegs = dhlLegs.filter(leg => leg.labelStatus === 'pending');
  const staleRateLegs = dhlLegs.filter(leg => leg.rateTtlStatus === 'stale');

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-orange-100 rounded-lg">
          <Zap className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Actions</h3>
          <p className="text-sm text-gray-600">
            Manage label purchases and configurations
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Primary Actions */}
        <div>
          <h4 className="font-medium text-gray-900 mb-4">Primary Actions</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingLegs.map(leg => {
              const legId = leg.leg_order.toString();
              const options = legOptions[legId];
              const validation = options ? 
                { isValid: validateLegOptions(options).length === 0, errors: validateLegOptions(options) } : 
                { isValid: false, errors: ['Options not configured'] };
              const legFieldErrors = fieldErrors[legId] || {};
              const canPurchase = validation.isValid && leg.rateTtlStatus !== 'stale';
              const isPurchasing = purchasing === legId;
              const isBuyAndDownloading = buyAndDownloading === legId;
              const isSaved = savedDrafts.has(legId);
              const hasFieldErrors = Object.keys(legFieldErrors).length > 0;

              // Determine leg type for independent purchase messaging
              const isOutbound = !leg.from_location.toLowerCase().includes('hub');
              const legType = isOutbound ? 'Outbound' : 'Return';

              return (
                <div key={legId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h5 className="font-medium text-gray-900">
                        {leg.from_location.split(',')[0]} → {leg.to_location.split(',')[0]}
                      </h5>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          leg.serviceType === 'express' 
                            ? 'text-orange-600 bg-orange-100' 
                            : 'text-blue-600 bg-blue-100'
                        }`}>
                          DHL {leg.serviceType === 'express' ? 'Express' : 'Standard'}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          isOutbound ? 'text-blue-600 bg-blue-100' : 'text-purple-600 bg-purple-100'
                        }`}>
                          {legType}
                        </span>
                        {isSaved && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium text-green-600 bg-green-100">
                            <Save className="h-3 w-3 mr-1 inline" />
                            Saved
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        €{(leg.costBreakdown?.total || leg.leg_cost).toFixed(2)}
                      </div>
                      {canPurchase && (
                        <div className="text-xs text-green-600">Ready in ~2s</div>
                      )}
                    </div>
                  </div>

                  {/* Field-level Validation Errors */}
                  {hasFieldErrors && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
                      <div className="text-xs text-red-800 font-medium mb-1">Field Issues:</div>
                      <div className="text-xs text-red-700 space-y-1">
                        {Object.entries(legFieldErrors).slice(0, 3).map(([field, errors]) => (
                          <div key={field}>
                            <span className="font-medium">{field.replace('_', ' ')}:</span> {errors[0]}
                          </div>
                        ))}
                        {Object.keys(legFieldErrors).length > 3 && (
                          <div>... and {Object.keys(legFieldErrors).length - 3} more</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* General Validation Status */}
                  {!hasFieldErrors && validation.errors.length > 0 && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
                      <div className="text-xs text-red-800 font-medium mb-1">Issues:</div>
                      <div className="text-xs text-red-700">
                        {validation.errors.slice(0, 2).join(', ')}
                        {validation.errors.length > 2 && '...'}
                      </div>
                    </div>
                  )}

                  {/* Rate TTL Warning */}
                  {leg.rateTtlStatus === 'stale' && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
                      <div className="text-xs text-red-800 font-medium">Rate Expired</div>
                      <div className="text-xs text-red-700">Refresh required before purchase</div>
                    </div>
                  )}

                  {/* Independent Purchase Info */}
                  {dhlLegs.length > 1 && canPurchase && (
                    <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                      <div className="text-xs text-blue-800">
                        💡 <strong>Independent Purchase:</strong> Buy {legType.toLowerCase()} now, 
                        {isOutbound ? ' return leg after hub completion' : ' outbound was purchased separately'}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {/* Primary Action: Buy & Download (One-click) */}
                    {canPurchase && (
                      <button
                        onClick={() => buyAndDownload(legId)}
                        disabled={isPurchasing || isBuyAndDownloading}
                        className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                      >
                        {isBuyAndDownloading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1 inline animate-spin" />
                            Buy & Download...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-1 inline" />
                            Buy & Download (One-click)
                          </>
                        )}
                      </button>
                    )}

                    {/* Secondary Actions Row */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => buyLabel(legId)}
                        disabled={!canPurchase || isPurchasing || isBuyAndDownloading}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          canPurchase && !isPurchasing && !isBuyAndDownloading
                            ? 'bg-orange-600 text-white hover:bg-orange-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {isPurchasing ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1 inline animate-spin" />
                            Buying...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4 mr-1 inline" />
                            Buy Only
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => saveForLater(legId)}
                        disabled={hasFieldErrors}
                        className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                        title="Save configuration for later"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {pendingLegs.length === 0 && (
              <div className="col-span-2 text-center py-6 text-gray-500">
                <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                <p>All labels have been generated</p>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Actions */}
        <div>
          <h4 className="font-medium text-gray-900 mb-4">Secondary Actions</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Refresh Stale Rates */}
            {staleRateLegs.length > 0 && (
              <button
                onClick={() => {
                  staleRateLegs.forEach(leg => refreshRate(leg.leg_order.toString()));
                }}
                disabled={refreshingRate !== null}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50 text-sm"
              >
                {refreshingRate ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh Rates ({staleRateLegs.length})
              </button>
            )}

            {/* Download All Labels */}
            {generatedLegs.length > 1 && (
              <button
                onClick={downloadAllLabels}
                disabled={downloadingAll}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 text-sm"
              >
                {downloadingAll ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download All ({generatedLegs.length})
              </button>
            )}

            {/* Generated Labels Management */}
            {generatedLegs.map(leg => {
              const legId = leg.leg_order.toString();
              const isVoiding = voidingLabel === legId;

              return (
                <div key={legId} className="flex flex-col gap-2">
                  <div className="text-xs text-gray-600 truncate">
                    {leg.from_location.split(',')[0]} → {leg.to_location.split(',')[0]}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => window.open(leg.labelUrl, '_blank')}
                      className="flex-1 px-2 py-1 text-xs border border-green-300 text-green-700 rounded hover:bg-green-50"
                    >
                      <Download className="h-3 w-3 mx-auto" />
                    </button>
                    <button
                      onClick={() => voidLabel(legId)}
                      disabled={isVoiding}
                      className="flex-1 px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50"
                    >
                      {isVoiding ? (
                        <RefreshCw className="h-3 w-3 mx-auto animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 mx-auto" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Definition of Done Panel
function DefinitionOfDonePanel({ 
  dhlLegs, 
  legOptions,
  emittedEvents
}: {
  dhlLegs: DhlLeg[];
  legOptions: Record<string, DhlLegOptions>;
  emittedEvents: DhlEvent[];
}) {
  const totalLegs = dhlLegs.length;
  const configuredLegs = Object.keys(legOptions).length;
  const validatedLegs = Object.entries(legOptions).filter(([id, options]) => {
    return validateLegOptions(options).length === 0;
  }).length;
  const purchasedLegs = dhlLegs.filter(leg => leg.labelStatus === 'generated').length;
  const downloadableLegs = dhlLegs.filter(leg => leg.labelUrl).length;
  const trackedLegs = emittedEvents.filter(e => e.event === 'dhl.tracking.added').length;
  
  const hasVarianceTransparency = dhlLegs.some(leg => 
    leg.provisionalCost && Math.abs(leg.leg_cost - leg.provisionalCost) > 0
  );
  
  const criteriaData = [
    {
      title: "Individual Configuration",
      description: "Each DHL leg can be configured individually",
      completed: configuredLegs >= totalLegs,
      progress: `${configuredLegs}/${totalLegs}`,
      icon: Package
    },
    {
      title: "Validation & Guardrails", 
      description: "Validated legs prevent bad purchases",
      completed: validatedLegs >= configuredLegs,
      progress: `${validatedLegs}/${configuredLegs}`,
      icon: Shield
    },
    {
      title: "Individual Purchase",
      description: "Each leg purchased individually",
      completed: purchasedLegs > 0,
      progress: `${purchasedLegs}/${totalLegs}`,
      icon: CreditCard
    },
    {
      title: "Labels Downloadable",
      description: "Purchased labels are downloadable",
      completed: downloadableLegs >= purchasedLegs,
      progress: `${downloadableLegs}/${purchasedLegs || 1}`,
      icon: Download
    },
    {
      title: "Tracking Visibility",
      description: "Tracking visible on Dashboard and Shipment detail",
      completed: trackedLegs > 0,
      progress: `${trackedLegs} events`,
      icon: Tag
    },
    {
      title: "Variance Transparency",
      description: "Plan variance is transparent for Ops margin impact",
      completed: hasVarianceTransparency,
      progress: hasVarianceTransparency ? "Visible" : "N/A",
      icon: DollarSign
    }
  ];

  const overallCompletion = criteriaData.filter(c => c.completed).length / criteriaData.length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Definition of Done (Page-level)</h3>
          <p className="text-sm text-gray-600">
            Completion status: {Math.round(overallCompletion * 100)}% ({criteriaData.filter(c => c.completed).length}/{criteriaData.length} criteria met)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {criteriaData.map((criteria, index) => {
          const Icon = criteria.icon;
          return (
            <div 
              key={index} 
              className={`border rounded-lg p-4 ${
                criteria.completed ? 'border-green-200 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  criteria.completed ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <Icon className={`h-4 w-4 ${
                    criteria.completed ? 'text-green-600' : 'text-gray-500'
                  }`} />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={`font-medium ${
                      criteria.completed ? 'text-green-900' : 'text-gray-900'
                    }`}>
                      {criteria.title}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      criteria.completed 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {criteria.progress}
                    </span>
                  </div>
                  <p className={`text-sm ${
                    criteria.completed ? 'text-green-700' : 'text-gray-600'
                  }`}>
                    {criteria.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {overallCompletion === 1 && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800 font-medium">
            <CheckCircle className="h-5 w-5" />
            All Definition of Done criteria completed!
          </div>
          <p className="text-sm text-green-700 mt-1">
            DHL Labels functionality is fully operational with proper guardrails, 
            individual leg management, and system integration.
          </p>
        </div>
      )}
    </div>
  );
}

// Events Panel Component (for demo visibility)
function EventsPanel({ 
  events 
}: {
  events: DhlEvent[];
}) {
  if (events.length === 0) return null;

  const formatEventData = (event: DhlEvent) => {
    const { ts, ...data } = event.data;
    return {
      ...data,
      ts: new Date(ts).toLocaleTimeString()
    };
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'dhl.label.purchased': return CreditCard;
      case 'dhl.tracking.added': return Tag;
      case 'dhl.pickup.scheduled': return Calendar;
      default: return Info;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'dhl.label.purchased': return 'text-green-600 bg-green-100';
      case 'dhl.tracking.added': return 'text-blue-600 bg-blue-100';
      case 'dhl.pickup.scheduled': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Zap className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Events (emit)</h3>
          <p className="text-sm text-gray-600">
            System integration events for Dashboard, Hub Console, and Sprint 2 tracking
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {events.map((event, index) => {
          const Icon = getEventIcon(event.event);
          const eventData = formatEventData(event);
          
          return (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getEventColor(event.event)}`}>
                  <Icon className="h-4 w-4" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{event.event}</h4>
                    <span className="text-xs text-gray-500">{eventData.ts}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    {Object.entries(eventData).map(([key, value]) => {
                      if (key === 'ts') return null;
                      return (
                        <div key={key} className="flex flex-col">
                          <span className="text-gray-600 text-xs uppercase tracking-wide">{key}</span>
                          <span className="font-medium text-gray-900 truncate" title={String(value)}>
                            {String(value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Integration Impact</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <div>• <strong>Dashboard queues</strong>: Updates shipment status and tracking info</div>
          <div>• <strong>Sprint 2 client tracking</strong>: Triggers real-time tracking updates</div>
          <div>• <strong>Hub ETA</strong>: Informs hub of expected delivery times</div>
          <div>• <strong>Pickup scheduling</strong>: Coordinates DHL collection windows</div>
        </div>
      </div>
    </div>
  );
}

// Toast Notification Component
function ToastContainer({ 
  toasts, 
  removeToast 
}: {
  toasts: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
    actions?: ToastAction[];
  }>;
  removeToast: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`p-4 rounded-lg shadow-lg border ${
            toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-2">
              <p className="text-sm font-medium">{toast.message}</p>
              
              {toast.actions && toast.actions.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {toast.actions.map((action, index) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          action.action();
                          removeToast(toast.id);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${
                          toast.type === 'success' ? 'bg-green-100 hover:bg-green-200 text-green-700' :
                          toast.type === 'error' ? 'bg-red-100 hover:bg-red-200 text-red-700' :
                          'bg-blue-100 hover:bg-blue-200 text-blue-700'
                        }`}
                      >
                        {Icon && <Icon className="h-3 w-3" />}
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 ml-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Cost Recap Component
function CostRecapPanel({ 
  dhlLegs, 
  legOptions, 
  calculateUpdatedCosts, 
  calculateVariance 
}: {
  dhlLegs: DhlLeg[];
  legOptions: Record<string, DhlLegOptions>;
  calculateUpdatedCosts: (leg: DhlLeg, options: DhlLegOptions) => DhlCostBreakdown;
  calculateVariance: (current: number, provisional: number) => { amount: number; percentage: number; isSignificant: boolean };
}) {
  const formatCurrency = (amount: number) => `€${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Calculate costs for each leg
  const legCosts = dhlLegs.map(leg => {
    const options = legOptions[leg.leg_order.toString()];
    const costs = options ? calculateUpdatedCosts(leg, options) : leg.costBreakdown;
    const variance = leg.provisionalCost ? calculateVariance(costs?.total || leg.leg_cost, leg.provisionalCost) : null;
    
    return {
      leg,
      costs: costs || {
        baseCost: leg.leg_cost,
        fuelSurcharge: 0,
        remoteAreaSurcharge: 0,
        insuranceCost: 0,
        signatureCost: 0,
        total: leg.leg_cost,
        currency: 'EUR'
      },
      variance,
      options
    };
  });

  // Calculate totals
  const totalCurrent = legCosts.reduce((sum, { costs }) => sum + costs.total, 0);
  const totalProvisional = legCosts.reduce((sum, { leg }) => sum + (leg.provisionalCost || leg.leg_cost), 0);
  const totalVariance = calculateVariance(totalCurrent, totalProvisional);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <Package className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">D) Cost Recap</h3>
          <p className="text-sm text-gray-600">
            Per leg breakdown with service, surcharges, and variance vs plan
          </p>
        </div>
      </div>

      {/* Per Leg Breakdown */}
      <div className="space-y-4 mb-6">
        {legCosts.map(({ leg, costs, variance, options }, index) => (
          <div key={leg.leg_order} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium text-gray-900">
                  Leg {index + 1}: {leg.from_location.split(',')[0]} → {leg.to_location.split(',')[0]}
                </h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    (options?.serviceLevel || leg.serviceType) === 'express' 
                      ? 'text-orange-600 bg-orange-100' 
                      : 'text-blue-600 bg-blue-100'
                  }`}>
                    DHL {(options?.serviceLevel || leg.serviceType) === 'express' ? 'Express' : 'Standard'}
                  </span>
                  {variance && variance.isSignificant && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium text-amber-600 bg-amber-100">
                      ⚠ {variance.percentage > 0 ? '+' : ''}{variance.percentage.toFixed(1)}% vs Plan
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-gray-900">{formatCurrency(costs.total)}</div>
                {variance && (
                  <div className={`text-sm ${
                    variance.amount >= 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {variance.amount >= 0 ? '+' : ''}{formatCurrency(variance.amount)} vs plan
                  </div>
                )}
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="font-medium text-gray-900">{formatCurrency(costs.baseCost)}</div>
                <div className="text-gray-600">Base Cost</div>
              </div>
              
              {costs.fuelSurcharge > 0 && (
                <div className="text-center p-2 bg-red-50 rounded">
                  <div className="font-medium text-red-900">{formatCurrency(costs.fuelSurcharge)}</div>
                  <div className="text-red-600">Fuel Surcharge</div>
                </div>
              )}
              
              {costs.remoteAreaSurcharge > 0 && (
                <div className="text-center p-2 bg-orange-50 rounded">
                  <div className="font-medium text-orange-900">{formatCurrency(costs.remoteAreaSurcharge)}</div>
                  <div className="text-orange-600">Remote Area</div>
                </div>
              )}
              
              {costs.insuranceCost > 0 && (
                <div className="text-center p-2 bg-blue-50 rounded">
                  <div className="font-medium text-blue-900">{formatCurrency(costs.insuranceCost)}</div>
                  <div className="text-blue-600">Insurance</div>
                </div>
              )}
              
              {costs.signatureCost > 0 && (
                <div className="text-center p-2 bg-purple-50 rounded">
                  <div className="font-medium text-purple-900">{formatCurrency(costs.signatureCost)}</div>
                  <div className="text-purple-600">Signature</div>
                </div>
              )}
              
              {costs.customsClearance && costs.customsClearance > 0 && (
                <div className="text-center p-2 bg-yellow-50 rounded">
                  <div className="font-medium text-yellow-900">{formatCurrency(costs.customsClearance)}</div>
                  <div className="text-yellow-600">Customs</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Total Summary */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900">Total Across Selected Legs</h4>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalCurrent)}</div>
            <div className="text-sm text-gray-600">{dhlLegs.length} DHL leg{dhlLegs.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Variance vs Plan */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-gray-900">Variance vs Plan</div>
            <div className="text-sm text-gray-600">
              Original estimate: {formatCurrency(totalProvisional)}
            </div>
          </div>
          <div className={`text-right ${
            totalVariance.isSignificant ? 'text-amber-600' : 
            totalVariance.amount >= 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            <div className="text-lg font-semibold">
              {totalVariance.amount >= 0 ? '+' : ''}{formatCurrency(totalVariance.amount)}
            </div>
            <div className="text-sm">
              {totalVariance.percentage >= 0 ? '+' : ''}{totalVariance.percentage.toFixed(1)}%
              {totalVariance.isSignificant && ' ⚠'}
            </div>
          </div>
        </div>

        {totalVariance.isSignificant && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Significant cost variance detected</span>
            </div>
            <p className="text-amber-700 text-sm mt-1">
              Total cost is {Math.abs(totalVariance.percentage).toFixed(1)}% {totalVariance.amount >= 0 ? 'higher' : 'lower'} than the original plan estimate. 
              Review service levels and options before proceeding.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Summary Tab Component
function SummaryTab({ 
  options, 
  leg, 
  shipment, 
  validationErrors 
}: {
  options: DhlLegOptions;
  leg: DhlLeg;
  shipment: ShipmentData;
  validationErrors: string[];
}) {
  const formatCurrency = (amount: number) => `€${amount.toLocaleString()}`;
  const totalWeight = options.packages.reduce((sum, pkg) => sum + (pkg.weight * pkg.quantity), 0);
  const totalPackages = options.packages.reduce((sum, pkg) => sum + pkg.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h4 className="font-medium text-gray-900 mb-2">Configuration Summary</h4>
        <p className="text-sm text-gray-600">
          Review all settings before purchasing the label
        </p>
      </div>

      {/* Service Summary */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h5 className="font-medium text-gray-900 mb-3">Service Configuration</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Service Level:</span>
              <span className="font-medium">DHL {options.serviceLevel === 'express' ? 'Express' : 'Standard'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Signature Required:</span>
              <span className="font-medium">{options.signatureRequired ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Insured Value:</span>
              <span className="font-medium">{formatCurrency(options.insuredValue)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Packages:</span>
              <span className="font-medium">{totalPackages}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Weight:</span>
              <span className="font-medium">{totalWeight.toFixed(1)} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Label Format:</span>
              <span className="font-medium">{options.labelFormat.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Addresses Summary */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h5 className="font-medium text-gray-900 mb-3">Addresses</h5>
        <div className="space-y-3">
          {Object.entries(options.addresses).map(([type, address]) => (
            <div key={type} className="flex justify-between items-center">
              <div>
                <span className="font-medium capitalize">{type}:</span>
                <div className="text-sm text-gray-600">
                  {address.name}, {address.city}, {address.country}
                </div>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                address.validationState === 'valid' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
              }`}>
                {address.validationState === 'valid' ? '✓' : '⚠'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customs Summary */}
      {options.customs?.isRequired && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-3">Customs & Documentation</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">HS Code:</span>
              <span className="font-medium">{options.customs.commercialInvoice.hsCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Declared Value:</span>
              <span className="font-medium">
                {formatCurrency(options.customs.commercialInvoice.declaredValue)} {options.customs.commercialInvoice.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Incoterm:</span>
              <span className="font-medium">{options.customs.commercialInvoice.incoterm}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Invoice Attached:</span>
              <span className={`font-medium ${
                options.customs.documents.invoiceAttached ? 'text-green-600' : 'text-red-600'
              }`}>
                {options.customs.documents.invoiceAttached ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Validation Status */}
      <div className={`border rounded-lg p-4 ${
        validationErrors.length === 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      }`}>
        <div className={`flex items-center gap-2 font-medium mb-2 ${
          validationErrors.length === 0 ? 'text-green-800' : 'text-red-800'
        }`}>
          {validationErrors.length === 0 ? (
            <>
              <CheckCircle className="h-4 w-4" />
              Ready for Purchase
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4" />
              Validation Issues ({validationErrors.length})
            </>
          )}
        </div>
        
        {validationErrors.length > 0 ? (
          <ul className="text-sm text-red-700 space-y-1">
            {validationErrors.map((error, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <X className="h-3 w-3" />
                {error}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-green-700">
            All requirements met. Ready to purchase DHL label.
          </p>
        )}
      </div>

      {/* Cost Estimate */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h5 className="font-medium text-gray-900 mb-3">Cost Estimate</h5>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Base Shipping:</span>
            <span className="font-medium">{formatCurrency(leg.leg_cost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Insurance:</span>
            <span className="font-medium">{formatCurrency(Math.round(options.insuredValue * 0.002))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Signature Service:</span>
            <span className="font-medium">{options.signatureRequired ? '€5.00' : '€0.00'}</span>
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between font-medium">
            <span>Total Estimated:</span>
            <span>{formatCurrency(leg.leg_cost + Math.round(options.insuredValue * 0.002) + (options.signatureRequired ? 5 : 0))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DhlLabelsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeId = searchParams.get('route');
  
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [dhlLegs, setDhlLegs] = useState<DhlLeg[]>([]);
  const [wgLegs, setWgLegs] = useState<ProvisionaLeg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null); // leg ID currently being purchased
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showLabelPreview, setShowLabelPreview] = useState<string | null>(null);
  const [allLabelsGenerated, setAllLabelsGenerated] = useState(false);
  const [selectedLeg, setSelectedLeg] = useState<string | null>(null);
  const [legOptions, setLegOptions] = useState<Record<string, DhlLegOptions>>({});
  const [refreshingRate, setRefreshingRate] = useState<string | null>(null);
  const [voidingLabel, setVoidingLabel] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<Set<string>>(new Set());
  const [toastQueue, setToastQueue] = useState<Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
    actions?: ToastAction[];
  }>>([]);
  const [emittedEvents, setEmittedEvents] = useState<DhlEvent[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, Record<string, string[]>>>({});
  const [buyAndDownloading, setBuyAndDownloading] = useState<string | null>(null);
  const [telemetryEvents, setTelemetryEvents] = useState<DhlTelemetryEvent[]>([]);
  const [remoteAreaSurcharges, setRemoteAreaSurcharges] = useState<Record<string, RemoteAreaSurcharge>>({});
  const [addressSuggestions, setAddressSuggestions] = useState<Record<string, AddressSuggestion[]>>({});
  const [validationIssues, setValidationIssues] = useState<Record<string, ValidationIssue[]>>({});
  const [sessionId] = useState(() => `dhl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Extract shipment ID from search params (since we're using /dhl?shipment=id)
  const shipmentId = searchParams.get('shipment');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch shipment details and DHL legs from backend
        const [shipmentResponse, dhlLegsResponse] = await Promise.all([
          api.getShipmentDetails(shipmentId),
          api.getDHLLegs(shipmentId)
        ]);
        
        if (!shipmentResponse.success) {
          setError('Shipment not found');
          return;
        }
        
        if (!dhlLegsResponse.success) {
          setError('No DHL legs found. Please complete route planning first.');
          return;
        }
        
        // Set shipment data
        setShipment(shipmentResponse.data.shipment);
        
        // Convert DHL legs from backend to frontend format
        const dhlLegsList = dhlLegsResponse.data.dhl_legs.map((leg: any): DhlLeg => {
              // Use real backend data instead of simulation
              return {
                leg_order: leg.leg_order,
                leg_type: leg.leg_type,
                from_location: leg.from_location,
                to_location: leg.to_location,
                start_date: leg.start_date,
                end_date: leg.end_date,
                leg_cost: leg.leg_cost,
                carrier: leg.carrier,
                serviceType: leg.service_type,
                estimatedTransitDays: leg.estimated_transit_days,
                labelStatus: leg.label_status,
                trackingNumber: leg.tracking_number,
                labelUrl: leg.label_url,
                dhlReference: leg.dhl_reference,
                etaBand: leg.eta_band,
                rateTtlStatus: leg.rate_ttl_status,
                validationStatus: leg.validation_status,
                missingData: [],
                senderCountry: leg.from_location.split(',').pop()?.trim() || 'Unknown',
                buyerCountry: leg.to_location.split(',').pop()?.trim() || 'Unknown',
                costBreakdown: leg.cost_breakdown,
                provisionalCost: leg.provisional_cost
              };
            });
          
          setDhlLegs(dhlLegsList);
          
          // Initialize default options for each DHL leg
          const defaultOptions: Record<string, DhlLegOptions> = {};
          dhlLegsList.forEach(leg => {
            defaultOptions[leg.leg_order.toString()] = createDefaultLegOptions(leg, shipmentResponse.data.shipment);
          });
          setLegOptions(defaultOptions);
          
          // Check if all DHL labels are already generated
          const allGenerated = dhlLegsList.length > 0 && 
            dhlLegsList.every((leg: DhlLeg) => leg.labelStatus === 'generated');
          setAllLabelsGenerated(allGenerated);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load shipment and route data');
      } finally {
        setLoading(false);
      }
    };

    if (shipmentId) {
      fetchData();
    }
  }, [shipmentId]);

  const handlePurchaseLabel = async (legId: string) => {
    const leg = dhlLegs.find(l => l.leg_order.toString() === legId);
    if (!leg) return;

    setPurchasing(legId);
    setError(null);

    try {
      // Simulate DHL API call
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API delay

      // Mock successful response
      const mockResult: LabelPurchaseResult = {
        success: true,
        trackingNumber: `DHL${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        dhlReference: `REF-${shipmentId}-${legId}`,
        labelUrl: `/api/labels/dhl/${shipmentId}-${legId}.pdf`,
        estimatedDelivery: new Date(Date.now() + leg.estimatedTransitDays * 24 * 60 * 60 * 1000).toISOString(),
        cost: leg.leg_cost,
        currency: 'EUR'
      };

      // Update leg with purchase results
      setDhlLegs(prev => prev.map(l => 
        l.leg_order.toString() === legId 
          ? {
              ...l,
              labelStatus: 'generated',
              trackingNumber: mockResult.trackingNumber,
              labelUrl: mockResult.labelUrl,
              dhlReference: mockResult.dhlReference
            }
          : l
      ));

      // Log the purchase event
      console.log('🏷️ DHL Label Purchased:', {
        shipmentId,
        legId,
        trackingNumber: mockResult.trackingNumber,
        service: leg.serviceType,
        route: `${leg.from_location} → ${leg.to_location}`,
        cost: mockResult.cost,
        estimatedDelivery: mockResult.estimatedDelivery
      });

      // Show success message
      setSuccessMessage(`Label generated successfully! Tracking: ${mockResult.trackingNumber}`);
      
      // Check if all labels are now generated
      const updatedLegs = dhlLegs.map(l => 
        l.leg_order.toString() === legId 
          ? { ...l, labelStatus: 'generated' as const }
          : l
      );
      const allGenerated = updatedLegs.every(l => l.labelStatus === 'generated');
      setAllLabelsGenerated(allGenerated);

      // Emit integration events
      emitDhlLabelEvent('label.generated', {
        shipmentId,
        legId,
        trackingNumber: mockResult.trackingNumber,
        serviceType: leg.serviceType,
        fromLocation: leg.from_location,
        toLocation: leg.to_location,
        estimatedDelivery: mockResult.estimatedDelivery
      });

      // If all labels generated, emit completion event
      if (allGenerated) {
        emitDhlLabelEvent('shipment.labels_complete', {
          shipmentId,
          totalLabels: updatedLegs.length,
          trackingNumbers: updatedLegs.map(l => l.trackingNumber).filter(Boolean)
        });
      }

    } catch (err) {
      console.error('Error purchasing label:', err);
      setError('Failed to purchase DHL label. Please try again.');
      
      // Update leg status to failed
      setDhlLegs(prev => prev.map(l => 
        l.leg_order.toString() === legId 
          ? { ...l, labelStatus: 'failed' }
          : l
      ));
    } finally {
      setPurchasing(null);
    }
  };

  const handlePurchaseAllLabels = async () => {
    const pendingLegs = dhlLegs.filter(leg => leg.labelStatus === 'pending');
    
    for (const leg of pendingLegs) {
      await handlePurchaseLabel(leg.leg_order.toString());
      // Small delay between purchases
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const emitDhlLabelEvent = (eventType: string, data: any) => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent(eventType, { detail: data });
      window.dispatchEvent(event);
      console.log(`🔔 DHL Event: ${eventType}`, data);
    }
  };

  const formatCurrency = (amount: number) => `€${amount.toLocaleString()}`;

  const getTierName = (tier: string) => {
    const tierMap = {
      'standard': 'Standard',
      'premium': 'Premium', 
      'platinum': 'Platinum'
    };
    return tierMap[tier as keyof typeof tierMap] || tier;
  };

  const getServiceIcon = (serviceType: string) => {
    return serviceType === 'express' ? Plane : Truck;
  };

  const getServiceColor = (serviceType: string) => {
    return serviceType === 'express' 
      ? 'bg-orange-100 text-orange-600 border-orange-200'
      : 'bg-blue-100 text-blue-600 border-blue-200';
  };

  const getLabelStatusColor = (status: string) => {
    switch (status) {
      case 'generated': return 'text-green-600 bg-green-100';
      case 'purchasing': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getLabelStatusIcon = (status: string) => {
    switch (status) {
      case 'generated': return CheckCircle2;
      case 'purchasing': return RefreshCw;
      case 'failed': return X;
      default: return Clock;
    }
  };

  const getRateTtlColor = (status: string) => {
    switch (status) {
      case 'fresh': return 'text-green-600 bg-green-100';
      case 'amber': return 'text-amber-600 bg-amber-100 border-amber-200';
      case 'stale': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Helper function to get rate TTL message
  const getRateTtlMessage = (status: string, lastRefresh?: string) => {
    const time = lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : '';
    switch (status) {
      case 'fresh': return `Fresh rate (updated ${time})`;
      case 'amber': return `Rate expires soon (from ${time}) - consider refresh`;
      case 'stale': return `Rate expired (from ${time}) - refresh required`;
      default: return 'Rate status unknown';
    }
  };

  const getValidationStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-600 bg-green-100';
      case 'missing_data': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'generated': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-blue-600 bg-blue-100';
      case 'purchasing': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Helper function to create default options for a leg
  const createDefaultLegOptions = (leg: DhlLeg, shipmentData: ShipmentData): DhlLegOptions => {
    const isHubToB = leg.from_location.toLowerCase().includes('hub');
    const isCrossBorder = leg.senderCountry !== leg.buyerCountry;
    const valueThreshold = 500; // Signature required above €500
    
    return {
      serviceLevel: leg.serviceType,
      signatureRequired: shipmentData.declared_value > valueThreshold,
      insuredValue: shipmentData.declared_value,
      packages: [{
        id: 'pkg-1',
        weight: shipmentData.weight || 1.0,
        dimensions: shipmentData.dimensions || { length: 30, width: 20, height: 10 },
        quantity: 1,
        description: `${shipmentData.reference_sku} - Luxury Item`
      }],
      pickupMethod: isHubToB ? 'dropoff' : 'pickup',
      pickupWindow: isHubToB ? undefined : {
        date: new Date(leg.start_date).toISOString().split('T')[0],
        timeWindow: '09:00-17:00'
      },
      labelFormat: 'pdf',
      paperlessTrade: true,
      addresses: {
        sender: createAddressData(leg.from_location, 'sender'),
        hub: createAddressData(shipmentData.assigned_hub || 'London Hub', 'hub'),
        buyer: createAddressData(leg.to_location, 'buyer')
      },
      customs: isCrossBorder ? createCustomsData(shipmentData, leg) : undefined
    };
  };

  const createAddressData = (location: string, type: 'sender' | 'hub' | 'buyer'): AddressData => {
    // Mock address data - in real app would come from shipment data
    const mockAddresses = {
      sender: {
        name: 'Luxury Goods Seller',
        address1: '123 Bond Street',
        city: 'London',
        postcode: 'W1S 1SP',
        country: 'UK',
        phone: '+44 20 7123 4567',
        email: 'sender@luxury.com'
      },
      hub: {
        name: 'AUCTA Processing Hub',
        address1: '456 Industrial Estate',
        city: 'London',
        postcode: 'E14 9GE',
        country: 'UK',
        phone: '+44 20 8765 4321',
        email: 'hub@aucta.com'
      },
      buyer: {
        name: 'Premium Client',
        address1: '789 Champs-Élysées',
        city: 'Paris',
        postcode: '75008',
        country: 'France',
        phone: '+33 1 23 45 67 89',
        email: 'buyer@client.com'
      }
    };

    const base = mockAddresses[type];
    const hasValidationIssues = Math.random() > 0.8; // 20% chance of issues
    
    return {
      ...base,
      validationState: hasValidationIssues ? 'invalid' : 'valid',
      validationErrors: hasValidationIssues ? ['Invalid postcode format', 'Phone number verification needed'] : []
    };
  };

  const createCustomsData = (shipmentData: ShipmentData, leg: DhlLeg): CustomsData => {
    const isUKEU = (leg.senderCountry === 'UK' && leg.buyerCountry !== 'UK') || 
                   (leg.senderCountry !== 'UK' && leg.buyerCountry === 'UK');
    
    return {
      isRequired: true,
      commercialInvoice: {
        shipper: 'Luxury Goods Ltd',
        recipient: 'Premium Client',
        hsCode: '7113.19.00', // Jewelry HS code
        description: `Luxury ${shipmentData.reference_sku}`,
        declaredValue: shipmentData.declared_value,
        currency: 'EUR',
        incoterm: 'DAP',
        contentsType: leg.from_location.toLowerCase().includes('hub') ? 'Service/Authentication return' : 'Commercial goods'
      },
      eoriNumber: isUKEU ? 'GB123456789000' : undefined,
      vatNumber: isUKEU ? 'FR12345678901' : undefined,
      documents: {
        invoiceAttached: Math.random() > 0.3, // 70% have invoice
        receiptAttached: Math.random() > 0.5  // 50% have receipt
      }
    };
  };



  const updateLegOptions = (legId: string, updates: Partial<DhlLegOptions>) => {
    setLegOptions(prev => ({
      ...prev,
      [legId]: {
        ...prev[legId],
        ...updates
      }
    }));
    
    // Clear field errors for updated fields
    if (fieldErrors[legId]) {
      const updatedErrors = { ...fieldErrors };
      Object.keys(updates).forEach(field => {
        if (updatedErrors[legId]?.[field]) {
          delete updatedErrors[legId][field];
        }
      });
      setFieldErrors(updatedErrors);
    }
    
    // Real-time validation for immediate feedback
    setTimeout(() => validateLegFieldsRealTime(legId, updates), 100);
  };

  // Real-time field validation with specific error messages
  const validateLegFieldsRealTime = (legId: string, updates: Partial<DhlLegOptions>) => {
    const currentOptions = legOptions[legId];
    if (!currentOptions) return;

    const errors: Record<string, string[]> = {};

    // Validate packages in real-time
    if (updates.packages || currentOptions.packages) {
      const packages = updates.packages || currentOptions.packages;
      packages.forEach((pkg, index) => {
        const pkgErrors: string[] = [];
        if (pkg.weight <= 0) pkgErrors.push('Weight must be greater than 0');
        if (pkg.weight > 70) pkgErrors.push('Weight exceeds DHL limit (70kg)');
        if (pkg.dimensions.length <= 0 || pkg.dimensions.width <= 0 || pkg.dimensions.height <= 0) {
          pkgErrors.push('All dimensions must be greater than 0');
        }
        if (pkg.description.length < 3) pkgErrors.push('Description too short (minimum 3 characters)');
        
        if (pkgErrors.length > 0) {
          errors[`package_${index}`] = pkgErrors;
        }
      });
    }

    // Validate insurance value
    if (updates.insuredValue !== undefined || currentOptions.insuredValue) {
      const insuredValue = updates.insuredValue ?? currentOptions.insuredValue;
      const maxAllowed = shipment ? shipment.declared_value * 1.5 : 1000;
      if (insuredValue < 0) {
        errors.insuredValue = ['Insurance value cannot be negative'];
      } else if (insuredValue > maxAllowed) {
        errors.insuredValue = [`Insurance cannot exceed ${formatCurrency(maxAllowed)} (150% of declared value)`];
      }
    }

    // Validate addresses in real-time
    if (updates.addresses || currentOptions.addresses) {
      const addresses = updates.addresses || currentOptions.addresses;
      Object.entries(addresses).forEach(([type, address]) => {
        const addrErrors: string[] = [];
        if (!address.name?.trim()) addrErrors.push('Name is required');
        if (!address.address1?.trim()) addrErrors.push('Address line 1 is required');
        if (!address.city?.trim()) addrErrors.push('City is required');
        if (!address.postcode?.trim()) addrErrors.push('Postcode is required');
        if (address.postcode && !address.postcode.match(/^[A-Z0-9\s-]{3,10}$/i)) {
          addrErrors.push('Invalid postcode format');
        }
        if (!address.phone?.trim()) addrErrors.push('Phone is required');
        if (address.phone && !address.phone.match(/^\+?[\d\s\-()]{8,}$/)) {
          addrErrors.push('Invalid phone format');
        }
        if (!address.email?.trim()) addrErrors.push('Email is required');
        if (address.email && !address.email.includes('@')) {
          addrErrors.push('Invalid email format');
        }
        
        if (addrErrors.length > 0) {
          errors[`address_${type}`] = addrErrors;
        }
      });
    }

    // Update field errors
    if (Object.keys(errors).length > 0) {
      setFieldErrors(prev => ({
        ...prev,
        [legId]: errors
      }));
    } else {
      setFieldErrors(prev => {
        const updated = { ...prev };
        delete updated[legId];
        return updated;
      });
    }
  };

  // Enhanced validation with field-specific errors
  const validateLegOptionsEnhanced = (options: DhlLegOptions, legId: string): { 
    isValid: boolean; 
    errors: string[]; 
    fieldErrors: Record<string, string[]> 
  } => {
    const generalErrors: string[] = [];
    const fieldErrors: Record<string, string[]> = {};

    // Package validation
    options.packages.forEach((pkg, index) => {
      const pkgErrors: string[] = [];
      if (pkg.weight <= 0) pkgErrors.push('Weight must be greater than 0');
      if (pkg.weight > 70) pkgErrors.push('Weight exceeds DHL limit (70kg)');
      if (pkg.dimensions.length <= 0 || pkg.dimensions.width <= 0 || pkg.dimensions.height <= 0) {
        pkgErrors.push('All dimensions must be greater than 0');
      }
      const maxDimension = Math.max(pkg.dimensions.length, pkg.dimensions.width, pkg.dimensions.height);
      if (maxDimension > 120) pkgErrors.push('Maximum dimension cannot exceed 120cm');
      
      if (pkgErrors.length > 0) {
        fieldErrors[`package_${index}`] = pkgErrors;
        generalErrors.push(`Package ${index + 1}: ${pkgErrors[0]}`);
      }
    });

    // Address validation
    Object.entries(options.addresses).forEach(([type, address]) => {
      const addrErrors: string[] = [];
      if (!address.name?.trim()) addrErrors.push('Name is required');
      if (!address.address1?.trim()) addrErrors.push('Address is required');
      if (!address.city?.trim()) addrErrors.push('City is required');
      if (!address.postcode?.trim()) addrErrors.push('Postcode is required');
      if (!address.phone?.trim()) addrErrors.push('Phone is required');
      if (!address.email?.trim()) addrErrors.push('Email is required');
      
      if (addrErrors.length > 0) {
        fieldErrors[`address_${type}`] = addrErrors;
        generalErrors.push(`${type} address: ${addrErrors[0]}`);
      }
    });

    // Customs validation
    if (options.customs?.isRequired) {
      const customsErrors: string[] = [];
      if (!options.customs.commercialInvoice.hsCode) customsErrors.push('HS code is required');
      if (!options.customs.commercialInvoice.incoterm) customsErrors.push('Incoterm is required');
      if (!options.customs.documents.invoiceAttached) customsErrors.push('Commercial invoice must be attached');
      
      if (customsErrors.length > 0) {
        fieldErrors.customs = customsErrors;
        generalErrors.push(`Customs: ${customsErrors[0]}`);
      }
    }

    return {
      isValid: generalErrors.length === 0,
      errors: generalErrors,
      fieldErrors
    };
  };

  const getLegOptions = (legId: string): DhlLegOptions | null => {
    return legOptions[legId] || null;
  };

  // Calculate updated cost breakdown based on current options
  const calculateUpdatedCosts = (leg: DhlLeg, options: DhlLegOptions): DhlCostBreakdown => {
    if (!leg.costBreakdown) return {
      baseCost: leg.leg_cost,
      fuelSurcharge: 0,
      remoteAreaSurcharge: 0,
      insuranceCost: 0,
      signatureCost: 0,
      total: leg.leg_cost,
      currency: 'EUR'
    };

    const baseCostAdjustment = options.serviceLevel !== leg.serviceType ? 
      (options.serviceLevel === 'express' ? 1.4 : 0.7) : 1.0;
    
    const adjustedBaseCost = leg.costBreakdown.baseCost * baseCostAdjustment;
    const fuelSurcharge = leg.costBreakdown.fuelSurcharge * baseCostAdjustment;
    const remoteAreaSurcharge = leg.costBreakdown.remoteAreaSurcharge * baseCostAdjustment;
    
    // Calculate insurance cost (0.2% of insured value)
    const insuranceCost = Math.round(options.insuredValue * 0.002);
    
    // Signature cost
    const signatureCost = options.signatureRequired ? 5 : 0;
    
    // Customs clearance (unchanged)
    const customsClearance = leg.costBreakdown.customsClearance || 0;
    
    const total = adjustedBaseCost + fuelSurcharge + remoteAreaSurcharge + 
                  insuranceCost + signatureCost + customsClearance;

    return {
      baseCost: adjustedBaseCost,
      fuelSurcharge,
      remoteAreaSurcharge,
      insuranceCost,
      signatureCost,
      customsClearance: leg.costBreakdown.customsClearance,
      total,
      currency: 'EUR'
    };
  };

  // Calculate variance vs plan
  const calculateVariance = (currentCost: number, provisionalCost: number) => {
    const variance = currentCost - provisionalCost;
    const percentageVariance = (variance / provisionalCost) * 100;
    return {
      amount: variance,
      percentage: percentageVariance,
      isSignificant: Math.abs(percentageVariance) > 15 // Amber if >15% variance
    };
  };

  // Event emission system for system integration
  const emitEvent = async (event: DhlEvent): Promise<void> => {
    try {
      // Track events locally for demo purposes
      setEmittedEvents(prev => [event, ...prev].slice(0, 10)); // Keep last 10 events
      
      // In a real application, this would send to an event bus/message queue
      // For demo purposes, we'll log and simulate API call
      console.log('[EVENT EMITTED]', event);
      
      // Simulate event API call - in demo mode, just log success
      // In production, would be: await fetch('/api/events', { ... })
      setTimeout(() => {
        console.log(`[EVENT PROCESSED] ${event.event} handled by downstream systems`);
      }, 500);
      
    } catch (error) {
      // Events are fire-and-forget, don't fail the main operation
      console.warn('[EVENT ERROR] Failed to emit event:', event.event, error);
    }
  };

  // Emit label purchased event
  const emitLabelPurchasedEvent = (
    legId: string, 
    leg: DhlLeg, 
    options: DhlLegOptions, 
    result: LabelPurchaseResult
  ) => {
    const event: DhlLabelPurchasedEvent = {
      event: 'dhl.label.purchased',
      data: {
        shipmentId: shipment?.shipment_id || '',
        legId,
        service: options.serviceLevel,
        costCts: Math.round(result.cost * 100), // Convert to cents
        trackingNumber: result.trackingNumber,
        actorId: 'user@aucta.com', // In real app, get from auth context
        ts: new Date().toISOString()
      }
    };
    emitEvent(event);
  };

  // Emit tracking added event
  const emitTrackingAddedEvent = (legId: string, trackingNumber: string) => {
    const event: DhlTrackingAddedEvent = {
      event: 'dhl.tracking.added',
      data: {
        shipmentId: shipment?.shipment_id || '',
        legId,
        trackingNumber,
        carrier: 'DHL',
        ts: new Date().toISOString()
      }
    };
    emitEvent(event);
  };

  // Emit pickup scheduled event
  const emitPickupScheduledEvent = (legId: string, pickupWindow: { date: string; timeWindow: string }) => {
    const [windowFrom, windowTo] = pickupWindow.timeWindow.split('-');
    const baseDate = pickupWindow.date;
    
    const event: DhlPickupScheduledEvent = {
      event: 'dhl.pickup.scheduled',
      data: {
        shipmentId: shipment?.shipment_id || '',
        legId,
        windowFrom: `${baseDate}T${windowFrom}:00.000Z`,
        windowTo: `${baseDate}T${windowTo}:00.000Z`,
        ts: new Date().toISOString()
      }
    };
    emitEvent(event);
  };

  // Telemetry Functions
  const emitTelemetry = async (eventType: DhlTelemetryEvent['event'], data: any) => {
    const telemetryEvent: DhlTelemetryEvent = {
      event: eventType,
      data,
      timestamp: new Date().toISOString(),
      sessionId
    };
    
    setTelemetryEvents(prev => [...prev, telemetryEvent]);
    
    // Send to real backend analytics
    try {
      await api.logDHLTelemetry(eventType, data, shipmentId || undefined, undefined, sessionId);
    } catch (error) {
      console.warn('Failed to log telemetry:', error);
    }
  };

  // Currency Conversion Helper
  const formatCurrencyDual = (amount: number, clientCurrency = 'GBP'): CurrencyDisplay => {
    const exchangeRates: Record<string, number> = {
      'GBP': 0.85,
      'USD': 1.10,
      'EUR': 1.00
    };
    
    const rate = exchangeRates[clientCurrency] || 1;
    const symbols: Record<string, string> = {
      'GBP': '£',
      'USD': '$',
      'EUR': '€'
    };
    
    return {
      client: {
        amount: amount / rate,
        currency: clientCurrency,
        symbol: symbols[clientCurrency] || clientCurrency
      },
      base: {
        amount,
        currency: 'EUR',
        symbol: '€'
      },
      exchangeRate: rate,
      lastUpdated: new Date().toISOString()
    };
  };

  // Remote Area Detection
  const detectRemoteAreaSurcharge = (location: string): RemoteAreaSurcharge => {
    const remoteAreas = [
      'Scottish Highlands', 'Northern Ireland', 'Channel Islands', 
      'Shetland Islands', 'Orkney Islands', 'Isle of Man'
    ];
    
    const isRemote = remoteAreas.some(area => 
      location.toLowerCase().includes(area.toLowerCase())
    );
    
    return {
      detected: isRemote,
      location,
      surcharge: isRemote ? 15.50 : 0,
      currency: 'EUR',
      reason: isRemote ? 'Remote area delivery surcharge' : ''
    };
  };

  // Address Validation with Suggestions
  const validateAddressWithSuggestions = (address: AddressData, type: string): AddressSuggestion[] => {
    const suggestions: AddressSuggestion[] = [];
    
    // Postcode format validation
    if (address.postcode) {
      const ukPostcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
      if (address.country?.toLowerCase() === 'uk' && !ukPostcodePattern.test(address.postcode)) {
        suggestions.push({
          field: 'postcode',
          current: address.postcode,
          suggested: address.postcode.replace(/\s/g, '').toUpperCase(),
          confidence: 0.8,
          reason: 'UK postcode should be in format: SW1A 1AA'
        });
      }
    }
    
    // Country mismatch detection
    if (address.city && address.country) {
      const cityCountryMap: Record<string, string> = {
        'london': 'uk',
        'paris': 'france',
        'berlin': 'germany',
        'amsterdam': 'netherlands'
      };
      
      const expectedCountry = cityCountryMap[address.city.toLowerCase()];
      if (expectedCountry && expectedCountry !== address.country.toLowerCase()) {
        suggestions.push({
          field: 'country',
          current: address.country,
          suggested: expectedCountry.toUpperCase(),
          confidence: 0.9,
          reason: `${address.city} is typically in ${expectedCountry.toUpperCase()}`
        });
      }
    }
    
    return suggestions;
  };

  // Multi-parcel Validation
  const validateMultiParcel = (packages: DhlPackage[]): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    
    const totalWeight = packages.reduce((sum, pkg) => sum + pkg.weight, 0);
    const totalVolume = packages.reduce((sum, pkg) => 
      sum + (pkg.dimensions.length * pkg.dimensions.width * pkg.dimensions.height), 0
    );
    
    if (totalWeight > 500) {
      issues.push({
        type: 'multi_parcel',
        message: `Total weight ${totalWeight}kg exceeds reasonable limit (500kg)`,
        canContinue: false
      });
    }
    
    if (totalVolume > 1000000) { // 1 cubic meter
      issues.push({
        type: 'multi_parcel',
        message: `Total volume ${(totalVolume / 1000000).toFixed(2)}m³ exceeds reasonable limit (1m³)`,
        canContinue: false
      });
    }
    
    return issues;
  };

  // Toast management
  const showToast = (message: string, type: 'success' | 'error' | 'info', actions?: ToastAction[]) => {
    const toastId = Date.now().toString();
    setToastQueue(prev => [...prev, { id: toastId, message, type, actions }]);
    
    // Auto-remove after 5 seconds if no actions
    if (!actions || actions.length === 0) {
      setTimeout(() => {
        setToastQueue(prev => prev.filter(toast => toast.id !== toastId));
      }, 5000);
    }
  };

  const removeToast = (toastId: string) => {
    setToastQueue(prev => prev.filter(toast => toast.id !== toastId));
  };

  // One-click Buy & Download action
  const buyAndDownload = async (legId: string): Promise<ActionResult> => {
    setBuyAndDownloading(legId);
    
    try {
      const result = await buyLabel(legId);
      if (result.success && result.data?.labelUrl) {
        // Immediately trigger download
        setTimeout(() => {
          window.open(result.data.labelUrl, '_blank');
          showToast('Label purchased and download started', 'success');
        }, 500);
      }
      return result;
    } finally {
      setBuyAndDownloading(null);
    }
  };

  // Primary Action: Buy Label (per leg) - Enhanced for UX
  const buyLabel = async (legId: string): Promise<ActionResult> => {
    const leg = dhlLegs.find(l => l.leg_order.toString() === legId);
    const options = legOptions[legId];
    
    if (!leg || !options) {
      return { success: false, message: 'Leg or options not found', error: 'INVALID_LEG' };
    }

    // Run enhanced validations & guardrails
    const validation = validateLegOptionsEnhanced(options, legId);
    if (!validation.isValid) {
      // Store field errors for UI display
      setFieldErrors(prev => ({
        ...prev,
        [legId]: validation.fieldErrors
      }));

      // Emit guardrail telemetry
      validation.errors.forEach(error => {
        const guardrailType = error.includes('address') ? 'address' :
                              error.includes('customs') ? 'customs' :
                              error.includes('insured') ? 'insured' :
                              error.includes('weight') || error.includes('dimensions') ? 'package' : 'other';
        
        emitTelemetry('dhl.guardrail.triggered', {
          legId,
          type: guardrailType,
          error,
          route: `${leg.from_location} → ${leg.to_location}`
        });
      });
      
      return { 
        success: false, 
        message: `Validation failed: ${validation.errors.slice(0, 2).join(', ')}${validation.errors.length > 2 ? '...' : ''}`, 
        error: 'VALIDATION_FAILED' 
      };
    }

    // Check rate TTL - refresh if stale
    if (leg.rateTtlStatus === 'stale') {
      const refreshResult = await refreshRate(legId);
      if (!refreshResult.success) {
        return { 
          success: false, 
          message: 'Rate refresh failed: ' + refreshResult.error, 
          error: 'RATE_REFRESH_FAILED' 
        };
      }
    }

    setPurchasing(legId);
    const purchaseStartTime = Date.now();

    try {
      // Call real backend API for label purchase
      const purchaseResult = await api.purchaseDHLLabel(shipmentId!, legId, options);

      if (!purchaseResult.success) {
        throw new Error(purchaseResult.error?.message || 'Failed to purchase label');
      }
      
      // Use backend response data
      const { tracking_number, dhl_reference, label_url, cost_breakdown } = purchaseResult.data;
      
      const result: LabelPurchaseResult = {
        success: true,
        trackingNumber: tracking_number,
        dhlReference: dhl_reference,
        labelUrl: label_url,
        estimatedDelivery: new Date(Date.now() + leg.estimatedTransitDays * 24 * 60 * 60 * 1000).toISOString(),
        costBreakdown: cost_breakdown
      };

      // Update leg status
      setDhlLegs(prev => prev.map(l => 
        l.leg_order.toString() === legId 
          ? {
              ...l,
              labelStatus: 'generated' as const,
              trackingNumber: result.trackingNumber,
              labelUrl: result.labelUrl,
              dhlReference: result.dhlReference
            }
          : l
      ));

      // Remove from saved drafts
      setSavedDrafts(prev => {
        const newSet = new Set(prev);
        newSet.delete(legId);
        return newSet;
      });

      // Emit business events for system integration
      emitLabelPurchasedEvent(legId, leg, options, result);
      emitTrackingAddedEvent(legId, result.trackingNumber);
      
      // Emit pickup scheduled event if pickup method is selected
      if (options.pickupMethod === 'pickup' && options.pickupWindow) {
        emitPickupScheduledEvent(legId, options.pickupWindow);
      }

      // Emit comprehensive telemetry
      const purchaseTime = Date.now() - purchaseStartTime;
      const variancePercent = leg.provisionalCost ? 
        ((result.costBreakdown.total - leg.provisionalCost) / leg.provisionalCost * 100) : 0;

      emitTelemetry('dhl.purchase.time_ms', {
        legId,
        timeMs: purchaseTime,
        route: `${leg.from_location} → ${leg.to_location}`,
        service: options.serviceLevel,
        cost: result.costBreakdown.total
      });

      emitTelemetry('dhl.variance.vs_plan_pct', {
        legId,
        variancePercent: Math.round(variancePercent * 100) / 100,
        plannedCost: leg.provisionalCost || 0,
        actualCost: result.costBreakdown.total,
        withinTolerance: Math.abs(variancePercent) <= 15
      });

      // Show success toast with quick actions
      const quickActions: ToastAction[] = [
        {
          label: 'Download',
          action: () => window.open(result.labelUrl, '_blank'),
          icon: Download
        },
        {
          label: 'Copy Tracking',
          action: () => {
            navigator.clipboard.writeText(result.trackingNumber);
            showToast('Tracking number copied to clipboard', 'success');
          },
          icon: Copy
        },
        {
          label: 'Email to Shipper',
          action: () => {
            // Simulate email action
            showToast('Label emailed to shipper successfully', 'success');
          },
          icon: Mail
        }
      ];

      // Calculate and display purchase time for UX feedback
      const purchaseTimeDisplay = (apiDelay / 1000).toFixed(1);
      
      showToast(
        `Label created in ${purchaseTimeDisplay}s: ${leg.from_location.split(',')[0]} → ${leg.to_location.split(',')[0]} (${result.trackingNumber})`,
        'success',
        quickActions
      );

      return { 
        success: true, 
        message: 'Label purchased successfully', 
        data: result 
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      return { 
        success: false, 
        message: `Label purchase failed: ${errorMessage}`, 
        error: 'PURCHASE_FAILED' 
      };
    } finally {
      setPurchasing(null);
    }
  };

  // Secondary Action: Refresh Rate
  const refreshRate = async (legId: string): Promise<ActionResult> => {
    const leg = dhlLegs.find(l => l.leg_order.toString() === legId);
    if (!leg) {
      return { success: false, message: 'Leg not found', error: 'INVALID_LEG' };
    }

    const startTime = Date.now();
    const wasStale = leg.rateTtlStatus === 'stale';
    
    // Emit telemetry for rate refresh
    emitTelemetry('dhl.rate.refresh', {
      legId,
      previousStatus: leg.rateTtlStatus,
      wasForced: wasStale,
      route: `${leg.from_location} → ${leg.to_location}`
    });

    setRefreshingRate(legId);

    try {
      // Call real backend API for rate refresh
      const refreshResult = await api.refreshDHLRate(shipmentId!, legId);

      if (!refreshResult.success) {
        throw new Error(refreshResult.error?.message || 'Rate refresh failed');
      }

      // Update leg with fresh rate status
      setDhlLegs(prev => prev.map(l => 
        l.leg_order.toString() === legId 
          ? { 
              ...l, 
              rateTtlStatus: 'fresh' as const
            }
          : l
      ));

      const refreshTime = Date.now() - startTime;
      showToast(
        `Rate refreshed in ${(refreshTime / 1000).toFixed(1)}s: ${leg.from_location.split(',')[0]} → ${leg.to_location.split(',')[0]}`, 
        'success'
      );
      
      return { success: true, message: 'Rate refreshed successfully' };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      showToast(`Rate refresh failed: ${errorMessage}`, 'error');
      return { 
        success: false, 
        message: `Rate refresh failed: ${errorMessage}`, 
        error: 'REFRESH_FAILED' 
      };
    } finally {
      setRefreshingRate(null);
    }
  };

  // Secondary Action: Save for Later
  const saveForLater = (legId: string): ActionResult => {
    const leg = dhlLegs.find(l => l.leg_order.toString() === legId);
    const options = legOptions[legId];
    
    if (!leg || !options) {
      return { success: false, message: 'Leg or options not found', error: 'INVALID_LEG' };
    }

    // Validate options before saving
    const validationErrors = validateLegOptions(options);
    if (validationErrors.length > 0) {
      showToast(`Cannot save: ${validationErrors.slice(0, 2).join(', ')}${validationErrors.length > 2 ? '...' : ''}`, 'error');
      return { 
        success: false, 
        message: `Validation failed: ${validationErrors.join(', ')}`, 
        error: 'VALIDATION_FAILED' 
      };
    }

    setSavedDrafts(prev => new Set([...prev, legId]));
    showToast(`Configuration saved for ${leg.from_location.split(',')[0]} → ${leg.to_location.split(',')[0]}`, 'success');
    
    return { success: true, message: 'Configuration saved successfully' };
  };

  // Secondary Action: Void Label
  const voidLabel = async (legId: string): Promise<ActionResult> => {
    const leg = dhlLegs.find(l => l.leg_order.toString() === legId);
    if (!leg || leg.labelStatus !== 'generated') {
      return { success: false, message: 'Label not found or not generated', error: 'INVALID_LABEL' };
    }

    // Check carrier void window (DHL allows 24 hours)
    const labelCreatedTime = leg.trackingNumber ? 
      new Date(parseInt(leg.trackingNumber.slice(-10)) + 1700000000000) : new Date();
    const hoursElapsed = (Date.now() - labelCreatedTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursElapsed > 24) {
      emitTelemetry('dhl.guardrail.triggered', {
        legId,
        type: 'void_window',
        error: 'Void window expired (>24 hours)',
        hoursElapsed: Math.round(hoursElapsed * 10) / 10
      });
      
      return { 
        success: false, 
        message: `Void window expired. Label created ${Math.round(hoursElapsed)}h ago (DHL allows 24h max)`, 
        error: 'VOID_WINDOW_EXPIRED' 
      };
    }

    setVoidingLabel(legId);

    try {
      // Call real backend API for label void
      const voidResult = await api.voidDHLLabel(shipmentId!, legId, reason);

      if (!voidResult.success) {
        throw new Error(voidResult.error?.message || 'Failed to void label');
      }

      // Update leg status and clear tracking info
      setDhlLegs(prev => prev.map(l => 
        l.leg_order.toString() === legId 
          ? {
              ...l,
              labelStatus: 'pending' as const,
              trackingNumber: undefined,
              labelUrl: undefined,
              dhlReference: undefined,
              rateTtlStatus: 'stale' as const // Force rate refresh after void
            }
          : l
      ));

      // Emit telemetry for void operation
      emitTelemetry('dhl.label.voided', {
        legId,
        reason: 'user_requested',
        withinWindow: true,
        hoursElapsed,
        costRecovered: leg.costBreakdown?.total || leg.leg_cost
      });

      showToast(
        `Label voided: ${leg.from_location.split(',')[0]} → ${leg.to_location.split(',')[0]} (${Math.round(hoursElapsed * 10) / 10}h after creation)`, 
        'success'
      );
      
      return { success: true, message: 'Label voided successfully' };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      showToast(`Void failed: ${errorMessage}`, 'error');
      return { 
        success: false, 
        message: `Void failed: ${errorMessage}`, 
        error: 'VOID_FAILED' 
      };
    } finally {
      setVoidingLabel(null);
    }
  };

  // Secondary Action: Download All Labels
  const downloadAllLabels = async (): Promise<ActionResult> => {
    const generatedLegs = dhlLegs.filter(leg => leg.labelStatus === 'generated' && leg.labelUrl);
    
    if (generatedLegs.length === 0) {
      return { success: false, message: 'No labels available for download', error: 'NO_LABELS' };
    }

    setDownloadingAll(true);

    try {
      // Simulate PDF merge API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate occasional failures (5% chance)
      if (Math.random() < 0.05) {
        throw new Error('PDF merge service temporarily unavailable');
      }

      // Generate combined PDF URL
      const combinedPdfUrl = `/api/labels/combined_${shipmentId}_${Date.now()}.pdf`;
      
      // Trigger download
      window.open(combinedPdfUrl, '_blank');

      showToast(`Downloaded ${generatedLegs.length} label${generatedLegs.length !== 1 ? 's' : ''} as combined PDF`, 'success');
      
      return { success: true, message: 'All labels downloaded successfully' };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      showToast(`Download failed: ${errorMessage}`, 'error');
      return { 
        success: false, 
        message: `Download failed: ${errorMessage}`, 
        error: 'DOWNLOAD_FAILED' 
      };
    } finally {
      setDownloadingAll(false);
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shipment and route data...</p>
        </div>
      </div>
    );
  }

  if (!shipmentId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Shipment ID Required</h2>
          <p className="text-yellow-600 mb-4">Please provide a shipment ID to access DHL labels.</p>
          <Link
            href="/sprint-8/logistics/dashboard"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (error || !shipment || !routeData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Cannot Load DHL Labels</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <Link
              href={`/sprint-8/logistics/plan/${shipmentId}`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Route Planning
            </Link>
            <Link
              href="/sprint-8/logistics/dashboard"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/sprint-8/logistics/dashboard"
              className="text-gray-600 hover:text-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">DHL Labels</h1>
              <p className="text-gray-600">Purchase and manage DHL shipping labels for {shipment.reference_sku}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 mb-1">Shipment ID</div>
            <div className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{shipment.shipment_id}</div>
          </div>
        </div>
      </div>

      {/* Context Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Info className="h-5 w-5 mr-2 text-blue-600" />
            Shipment Context
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            Route planned: {new Date(routeData.selectedAt).toLocaleDateString()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Classification</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Tier:</span>
                <span className="font-medium text-gray-900">{getTierName(shipment.assigned_tier)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Hub:</span>
                <span className="font-medium text-gray-900">{shipment.assigned_hub}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-3">Item Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Value:</span>
                <span className="font-medium text-gray-900">{formatCurrency(shipment.declared_value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Weight:</span>
                <span className="font-medium text-gray-900">{shipment.weight || 'TBD'} kg</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-3">Route</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">{shipment.sender_location}</span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{shipment.buyer_location}</span>
              </div>
              <div className="text-sm text-gray-600">
                {routeData.routeLabel} • {routeData.estimatedDays} days
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-3">Timeline</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Target:</span>
                <span className="font-medium text-gray-900">
                  {new Date(routeData.deliveryDate).toLocaleDateString()}
                </span>
              </div>
              {shipment.sla_target_date && (
                <div className="flex justify-between">
                  <span className="text-gray-600">SLA:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(shipment.sla_target_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* WG Legs Reminder Banner */}
      {wgLegs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-900 mb-1">
                White-Glove Legs Handled Separately
              </h3>
              <p className="text-blue-800 text-sm mb-3">
                This route includes {wgLegs.length} non-DHL leg(s) (white-glove/hub processing). 
                These are scheduled through WG Scheduling, not here.
              </p>
              <Link
                href={`/sprint-8/logistics/wg/${shipmentId}`}
                className="inline-flex items-center text-sm text-blue-700 hover:text-blue-800 underline"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Go to WG Scheduling
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Relevant Legs (per plan) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
          <Package className="h-6 w-6 mr-3 text-blue-600" />
          Relevant Legs (per plan)
        </h2>
        
        {dhlLegs.length === 0 ? (
          <div className="text-center py-8">
            <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No DHL Legs Found</h3>
            <p className="text-gray-600">This route doesn't include any DHL shipping segments.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dhlLegs.map((leg, index) => {
              const ServiceIcon = getServiceIcon(leg.serviceType);
              const isSelected = selectedLeg === leg.leg_order.toString();
              
              return (
                <div
                  key={leg.leg_order}
                  className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-300 hover:shadow-sm ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedLeg(isSelected ? null : leg.leg_order.toString())}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Service Icon */}
                      <div className={`p-2 rounded-lg ${getServiceColor(leg.serviceType)}`}>
                        <ServiceIcon className="h-5 w-5" />
                      </div>
                      
                      {/* Route Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">
                            {leg.from_location.split(',')[0]} ({leg.senderCountry})
                          </span>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {leg.to_location.split(',')[0]} ({leg.buyerCountry})
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Service: {leg.carrier} {leg.serviceType === 'express' ? 'Express' : 'Standard'}</span>
                          <span>ETA: {leg.etaBand}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Status Badges */}
                    <div className="flex items-center gap-3">
                      {/* Rate TTL Status */}
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getRateTtlColor(leg.rateTtlStatus)}`}>
                        Rate: {leg.rateTtlStatus}
                      </div>
                      
                      {/* Status Badge */}
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(leg.labelStatus)}`}>
                        {leg.labelStatus === 'pending' && 'Pending'}
                        {leg.labelStatus === 'purchasing' && 'Processing'}
                        {leg.labelStatus === 'generated' && `Label Created${leg.trackingNumber ? ` (${leg.trackingNumber})` : ''}`}
                        {leg.labelStatus === 'failed' && 'Failed'}
                      </div>
                      
                      {/* Validation Badge */}
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getValidationStatusColor(leg.validationStatus)}`}>
                        {leg.validationStatus === 'ready' ? 'Ready' : 'Missing Data'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Options Panel */}
                  {isSelected && (
                    <LegOptionsPanel 
                      leg={leg}
                      shipment={shipment}
                      options={getLegOptions(leg.leg_order.toString()) || createDefaultLegOptions(leg, shipment)}
                      onOptionsChange={(updates) => updateLegOptions(leg.leg_order.toString(), updates)}
                      onPurchaseLabel={() => handlePurchaseLabel(leg.leg_order.toString())}
                      isPurchasing={purchasing === leg.leg_order.toString()}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DHL Legs Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Tag className="h-6 w-6 mr-3 text-orange-600" />
            DHL Shipping Labels
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {dhlLegs.filter(leg => leg.labelStatus === 'generated').length} of {dhlLegs.length} labels generated
            </span>
            {dhlLegs.length > 1 && !allLabelsGenerated && (
              <button
                onClick={handlePurchaseAllLabels}
                disabled={dhlLegs.some(leg => leg.labelStatus === 'purchasing')}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Purchase All Labels
              </button>
            )}
          </div>
        </div>

        {dhlLegs.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No DHL Legs Found</h3>
            <p className="text-gray-600 mb-4">
              This route doesn't include any DHL shipping segments.
            </p>
            <Link
              href={`/sprint-8/logistics/plan/${shipmentId}`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Review Route Plan
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {dhlLegs.map((leg, index) => {
              const ServiceIcon = getServiceIcon(leg.serviceType);
              const StatusIcon = getLabelStatusIcon(leg.labelStatus);
              const isPurchasing = purchasing === leg.leg_order.toString();
              
              return (
                <div
                  key={leg.leg_order}
                  className={`border rounded-xl p-6 transition-all ${
                    leg.labelStatus === 'generated' 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Leg Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg border ${getServiceColor(leg.serviceType)}`}>
                        <ServiceIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          DHL {leg.serviceType === 'express' ? 'Express' : 'Standard'}
                        </h3>
                        <p className="text-gray-600">
                          {leg.from_location} → {leg.to_location}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getLabelStatusColor(leg.labelStatus)}`}>
                        <StatusIcon className={`h-4 w-4 mr-2 ${isPurchasing ? 'animate-spin' : ''}`} />
                        {leg.labelStatus === 'pending' && 'Ready to Purchase'}
                        {leg.labelStatus === 'purchasing' && 'Purchasing...'}
                        {leg.labelStatus === 'generated' && 'Label Generated'}
                        {leg.labelStatus === 'failed' && 'Purchase Failed'}
                      </div>
                    </div>
                  </div>

                  {/* Leg Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Service Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Service:</span>
                          <span className="font-medium">DHL {leg.serviceType === 'express' ? 'Express' : 'Standard'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Transit Time:</span>
                          <span className="font-medium">{leg.estimatedTransitDays} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cost:</span>
                          <span className="font-medium">{formatCurrency(leg.leg_cost)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Timeline</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Pickup:</span>
                          <span className="font-medium">{new Date(leg.start_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Delivery:</span>
                          <span className="font-medium">{new Date(leg.end_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">ETA:</span>
                          <span className="font-medium">{new Date(leg.provisional_eta).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Tracking Info</h4>
                      <div className="space-y-2 text-sm">
                        {leg.trackingNumber ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Tracking:</span>
                              <span className="font-mono text-blue-600">{leg.trackingNumber}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">DHL Ref:</span>
                              <span className="font-mono text-gray-700">{leg.dhlReference}</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-gray-500 italic">
                            Tracking details available after label purchase
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-4">
                      {leg.labelStatus === 'generated' && (
                        <>
                          <button
                            onClick={() => setShowLabelPreview(leg.leg_order.toString())}
                            className="flex items-center px-3 py-2 text-blue-600 hover:text-blue-700 text-sm"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview Label
                          </button>
                          <button
                            onClick={() => window.open(leg.labelUrl, '_blank')}
                            className="flex items-center px-3 py-2 text-green-600 hover:text-green-700 text-sm"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                          </button>
                          <button
                            onClick={() => window.print()}
                            className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-700 text-sm"
                          >
                            <Printer className="h-4 w-4 mr-2" />
                            Print
                          </button>
                        </>
                      )}
                    </div>
                    
                    <div>
                      {leg.labelStatus === 'pending' && (
                        <button
                          onClick={() => handlePurchaseLabel(leg.leg_order.toString())}
                          disabled={isPurchasing}
                          className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center"
                        >
                          {isPurchasing ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Purchasing...
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-4 w-4 mr-2" />
                              Purchase Label
                            </>
                          )}
                        </button>
                      )}
                      
                      {leg.labelStatus === 'failed' && (
                        <button
                          onClick={() => handlePurchaseLabel(leg.leg_order.toString())}
                          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Retry Purchase
                        </button>
                      )}
                      
                      {leg.labelStatus === 'generated' && (
                        <div className="flex items-center text-green-600">
                          <CheckCircle2 className="h-5 w-5 mr-2" />
                          <span className="font-medium">Ready to Ship</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* D) Cost Recap */}
      {dhlLegs.length > 0 && (
        <CostRecapPanel 
          dhlLegs={dhlLegs}
          legOptions={legOptions}
          calculateUpdatedCosts={calculateUpdatedCosts}
          calculateVariance={calculateVariance}
        />
      )}

      {/* Actions Panel */}
      {dhlLegs.length > 0 && (
        <ActionsPanel 
          dhlLegs={dhlLegs}
          legOptions={legOptions}
          purchasing={purchasing}
          refreshingRate={refreshingRate}
          voidingLabel={voidingLabel}
          downloadingAll={downloadingAll}
          savedDrafts={savedDrafts}
          buyLabel={buyLabel}
          buyAndDownload={buyAndDownload}
          buyAndDownloading={buyAndDownloading}
          refreshRate={refreshRate}
          saveForLater={saveForLater}
          voidLabel={voidLabel}
          downloadAllLabels={downloadAllLabels}
          fieldErrors={fieldErrors}
        />
      )}

      {/* Events Panel */}
      <EventsPanel events={emittedEvents} />

      {/* Definition of Done */}
      <DefinitionOfDonePanel 
        dhlLegs={dhlLegs}
        legOptions={legOptions}
        emittedEvents={emittedEvents}
      />

      {/* Toast Container */}
      <ToastContainer 
        toasts={toastQueue}
        removeToast={removeToast}
      />

      {/* Next Steps */}
      {allLabelsGenerated && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                All DHL Labels Generated Successfully!
              </h3>
              <p className="text-green-800 mb-4">
                Labels are ready for pickup and shipping. Tracking information has been integrated with 
                the Hub Console and Client App for live updates.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/sprint-8/logistics/hub"
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Hub Console
                </Link>
                <Link
                  href="/sprint-8/logistics/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-100"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
                <Link
                  href={`/sprint-2/passport/${shipment.reference_sku}`}
                  className="inline-flex items-center px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-100"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Client View
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg max-w-md">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-green-900">{successMessage}</div>
              <div className="text-xs text-green-700 mt-2">
                ✓ Tracking integrated with Hub Console<br/>
                ✓ Client app will show live updates<br/>
                ✓ ETA feed updated for delivery planning
              </div>
            </div>
            <button 
              onClick={() => setSuccessMessage(null)}
              className="text-green-400 hover:text-green-600 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
