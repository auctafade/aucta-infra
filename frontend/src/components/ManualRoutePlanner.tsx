'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, Calculator, Euro, Clock, MapPin,
  AlertTriangle, Info, Download, Save, Check, FileText,
  Building2, User, Home, ToggleLeft, ToggleRight, ChevronDown
} from 'lucide-react';
import RouteSegmentEditor, { RouteSegment } from './RouteSegmentEditor';
import WGLaborCalculator from './WGLaborCalculator';
import { calculateHubFees } from '@/lib/hubPriceBook';
import { validateQuote, ValidationError, formatValidationMessage } from '@/lib/quoteValidation';
import { loadQuoteSettings } from '@/lib/quoteSettings';
import { Hub } from '@/lib/hubManagement';

// Helper function to filter hubs by type from real hub data
const filterHubsByType = (hubs: Hub[], type: 'authenticator' | 'couturier'): Hub[] => {
  return hubs.filter(hub => {
    if (type === 'authenticator') {
      return hub.capabilities.authentication && hub.status === 'active';
    }
    if (type === 'couturier') {
      return hub.capabilities.sewing && hub.status === 'active';
    }
    return false;
  });
};

// Helper function to calculate hub fees from selected hub pricing
const calculateHubFeesFromPricing = (selectedHub1: Hub | null, selectedHub2: Hub | null, tier: number, noSecondHub: boolean) => {
  const fees = {
    authentication: 0,
    sewing: 0,
    qaFee: 0,
    tag: 0,
    nfc: 0
  };

  // Get authentication pricing from Hub #1
  if (selectedHub1) {
    const authPricing = selectedHub1.pricing.find(p => p.serviceType === 'authentication');
    if (authPricing) {
      fees.authentication = authPricing.price;
    }

    // For tier 2, get tag pricing
    if (tier === 2) {
      const tagPricing = selectedHub1.pricing.find(p => p.serviceType === 'tagging' || p.serviceName.toLowerCase().includes('tag'));
      if (tagPricing) {
        fees.tag = tagPricing.price;
      }
    }

    // For tier 3, get NFC pricing
    if (tier === 3) {
      const nfcPricing = selectedHub1.pricing.find(p => p.serviceType === 'nfc' || p.serviceName.toLowerCase().includes('nfc'));
      if (nfcPricing) {
        fees.nfc = nfcPricing.price;
      }

      // If no second hub, get sewing and QA from Hub #1
      if (noSecondHub) {
        const sewingPricing = selectedHub1.pricing.find(p => p.serviceType === 'sewing' || p.serviceName.toLowerCase().includes('sewing'));
        const qaPricing = selectedHub1.pricing.find(p => p.serviceType === 'qa' || p.serviceName.toLowerCase().includes('qa') || p.serviceName.toLowerCase().includes('quality'));
        
        if (sewingPricing) {
          fees.sewing = sewingPricing.price;
        }
        if (qaPricing) {
          fees.qaFee = qaPricing.price;
        }
      }
    }
  }

  // Get sewing and QA pricing from Hub #2 if it exists
  if (selectedHub2 && tier === 3 && !noSecondHub) {
    const sewingPricing = selectedHub2.pricing.find(p => p.serviceType === 'sewing' || p.serviceName.toLowerCase().includes('sewing'));
    const qaPricing = selectedHub2.pricing.find(p => p.serviceType === 'qa' || p.serviceName.toLowerCase().includes('qa') || p.serviceName.toLowerCase().includes('quality'));
    
    if (sewingPricing) {
      fees.sewing = sewingPricing.price;
    }
    if (qaPricing) {
      fees.qaFee = qaPricing.price;
    }
  }

  return fees;
};

interface Address {
  name: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

interface LaborCosts {
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

interface RouteQuote {
  parties: {
    sender: Address;
    hub1?: Address;
    hub2?: Address;
    buyer: Address;
  };
  segments: RouteSegment[];
  laborCosts: LaborCosts;
  hubFees: {
    authentication: number;
    sewing: number;
    qaFee: number;
    tag: number;
    nfc: number;
  };
  insurance: number;
  margin: number;
  marginType: 'percentage' | 'amount';
  totalCost: number;
  clientPrice: number;
  noSecondHub: boolean;
  slaComment: string;
  currency: string;
}

interface ManualRoutePlannerProps {
  shipmentId: string;
  shipmentData: any;
  serviceModel: 'wg-full' | 'dhl-full' | 'hybrid';
  hybridVariant?: 'wg_to_dhl' | 'dhl_to_wg';
  tier: number;
  onSave: (quote: RouteQuote) => void;
}

export default function ManualRoutePlanner({
  shipmentId,
  shipmentData,
  serviceModel,
  hybridVariant,
  tier,
  onSave
}: ManualRoutePlannerProps) {
  // Initialize addresses from shipment data
  const [senderAddress, setSenderAddress] = useState<Address>({
    name: shipmentData?.sender_name || '',
    street: shipmentData?.sender_address || '',
    city: shipmentData?.sender_city || '',
    postalCode: '',
    country: shipmentData?.sender_country || ''
  });

  const [hub1Address, setHub1Address] = useState<Address>({
    name: '',
    street: '',
    city: '',
    postalCode: '',
    country: ''
  });

  const [hub2Address, setHub2Address] = useState<Address>({
    name: '',
    street: '',
    city: '',
    postalCode: '',
    country: ''
  });

  const [buyerAddress, setBuyerAddress] = useState<Address>({
    name: shipmentData?.buyer_name || '',
    street: shipmentData?.buyer_address || '',
    city: shipmentData?.buyer_city || '',
    postalCode: '',
    country: shipmentData?.buyer_country || ''
  });

  // Hub management states
  const [availableHubs, setAvailableHubs] = useState<Hub[]>([]);
  const [selectedHub1, setSelectedHub1] = useState<Hub | null>(null);
  const [selectedHub2, setSelectedHub2] = useState<Hub | null>(null);
  const [showHub1Dropdown, setShowHub1Dropdown] = useState(false);
  const [showHub2Dropdown, setShowHub2Dropdown] = useState(false);

  const [noSecondHub, setNoSecondHub] = useState(tier !== 3);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [laborCosts, setLaborCosts] = useState<LaborCosts>({
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
  
  // Initialize hub fees based on selected hubs and tier
  const initialHubFees = useMemo(() => {
    return calculateHubFeesFromPricing(selectedHub1, selectedHub2, tier, noSecondHub);
  }, [selectedHub1, selectedHub2, tier, noSecondHub]);
  
  const [hubFees, setHubFees] = useState(initialHubFees);
  const [margin, setMargin] = useState(30); // percentage
  const [marginType, setMarginType] = useState<'percentage' | 'amount'>('percentage');
  const [slaComment, setSlaComment] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const settings = loadQuoteSettings();
    setMargin(settings.defaults.marginPercentage);
    setCurrency(settings.defaults.currency);
  }, []);

  // Load available hubs on mount
  useEffect(() => {
    const loadHubs = async () => {
      try {
        const response = await fetch('/api/hubs');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Transform hub data from our database format to the expected format
            const transformedHubs: Hub[] = data.data.map((hub: any) => ({
              id: hub.id.toString(),
              name: hub.name,
              code: hub.code,
              type: hub.roles?.includes('couturier') ? 
                (hub.roles?.includes('authenticator') ? 'hybrid' : 'couturier') : 
                'authenticator',
              status: hub.status === 'active' ? 'active' : 'inactive',
              address: {
                street: hub.address?.street || '',
                city: hub.address?.city || hub.location?.split(',')[0] || '',
                postalCode: hub.address?.postal_code || '',
                country: hub.address?.country || hub.location?.split(',')[1]?.trim() || ''
              },
              contacts: [{
                id: '1',
                name: hub.contact_info?.name || '',
                role: 'Hub Manager',
                email: hub.contact_info?.email || '',
                phone: hub.contact_info?.phone || '',
                isPrimary: true
              }],
              pricing: [
                {
                  id: 'auth',
                  serviceType: 'authentication',
                  serviceName: tier === 2 ? 'Tier 2 Authentication' : 'Tier 3 Authentication',
                  price: tier === 2 ? (hub.pricing?.tier2_auth_fee || 0) : (hub.pricing?.tier3_auth_fee || 0),
                  currency: hub.pricing?.currency || 'EUR',
                  unit: 'item'
                },
                {
                  id: 'sewing',
                  serviceType: 'sewing',
                  serviceName: 'Sewing & NFC Installation',
                  price: hub.pricing?.sew_fee || 0,
                  currency: hub.pricing?.currency || 'EUR',
                  unit: 'item'
                },
                {
                  id: 'qa',
                  serviceType: 'qa',
                  serviceName: 'Quality Assurance',
                  price: hub.pricing?.qa_fee || 0,
                  currency: hub.pricing?.currency || 'EUR',
                  unit: 'item'
                }
              ],
              capabilities: {
                authentication: hub.roles?.includes('authenticator') || false,
                sewing: hub.roles?.includes('couturier') || false,
                nfc: hub.roles?.includes('couturier') || false,
                storage: true,
                maxCapacity: 100,
                operatingHours: 'Mon-Fri 9AM-6PM',
                specializations: hub.roles || []
              },
              createdAt: hub.created_at,
              updatedAt: hub.updated_at,
              notes: hub.notes || ''
            }));
            
            setAvailableHubs(transformedHubs);
          }
        }
      } catch (error) {
        console.error('Failed to load hubs:', error);
        // No fallback - rely on database only
        setAvailableHubs([]);
      }
    };
    
    loadHubs();
  }, [tier]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.hub-dropdown')) {
        setShowHub1Dropdown(false);
        setShowHub2Dropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update hub addresses when hubs are selected
  useEffect(() => {
    if (selectedHub1) {
      setHub1Address({
        name: selectedHub1.name,
        street: selectedHub1.address.street,
        city: selectedHub1.address.city,
        postalCode: selectedHub1.address.postalCode,
        country: selectedHub1.address.country
      });
    }
  }, [selectedHub1]);

  useEffect(() => {
    if (selectedHub2) {
      setHub2Address({
        name: selectedHub2.name,
        street: selectedHub2.address.street,
        city: selectedHub2.address.city,
        postalCode: selectedHub2.address.postalCode,
        country: selectedHub2.address.country
      });
    }
  }, [selectedHub2]);

  // Update hub fees when hubs are selected
  useEffect(() => {
    const newFees = calculateHubFeesFromPricing(selectedHub1, selectedHub2, tier, noSecondHub);
    setHubFees(newFees);
  }, [selectedHub1, selectedHub2, tier, noSecondHub]);

  // Validate quote on changes
  useEffect(() => {
    const quote = {
      tier,
      serviceModel,
      parties: {
        sender: senderAddress,
        hub1: hub1Address,
        hub2: hub2Address,
        buyer: buyerAddress
      },
      segments,
      hubFees,
      margin,
      noSecondHub
    };
    
    const validation = validateQuote(quote);
    setValidationErrors([...validation.errors, ...validation.warnings]);
  }, [tier, serviceModel, hub1Address, hub2Address, segments, hubFees, margin, noSecondHub]);

  // Calculate insurance based on settings
  const settings = loadQuoteSettings();
  const insurance = shipmentData?.declared_value ? shipmentData.declared_value * settings.defaults.insuranceRate : 0;

  // Calculate transport total from segments
  const calculateTransportTotal = () => {
    return segments.reduce((sum, seg) => {
      if (seg.mode === 'wg' && seg.wgPricing) {
        return sum + seg.wgPricing.flights + seg.wgPricing.trains + 
               seg.wgPricing.ground + seg.wgPricing.other;
      } else if (seg.mode === 'dhl' && seg.dhlPricing) {
        return sum + seg.dhlPricing.quote;
      } else if (seg.mode === 'internal' && seg.internalPricing) {
        return sum + (seg.internalPricing.perItemCost * seg.internalPricing.itemCount);
      }
      return sum;
    }, 0);
  };

  const transportTotal = calculateTransportTotal();
  const hubTotal = hubFees.authentication + hubFees.sewing + hubFees.qaFee + hubFees.tag + hubFees.nfc;
  const totalCost = transportTotal + laborCosts.totalLaborCost + hubTotal + insurance;
  
  // Calculate margin based on type
  const marginAmount = marginType === 'percentage' 
    ? totalCost * (margin / 100)
    : margin;
  const marginPercentage = marginType === 'percentage'
    ? margin
    : (margin / totalCost) * 100;
  const clientPrice = totalCost + marginAmount;

  const handleLaborCostChange = (totalLaborCost: number, details: LaborCosts) => {
    setLaborCosts(details);
  };



  const handleSave = async (preview: boolean = false) => {
    const quote: RouteQuote = {
      parties: {
        sender: senderAddress,
        hub1: tier > 1 ? hub1Address : undefined,
        hub2: tier === 3 && !noSecondHub ? hub2Address : undefined,
        buyer: buyerAddress
      },
      segments,
      laborCosts,
      hubFees,
      insurance,
      margin,
      marginType,
      totalCost,
      clientPrice,
      noSecondHub,
      slaComment,
      currency
    };

    // Validate before saving
    const validation = validateQuote(quote);
    if (!validation.isValid && !preview) {
      // Show errors but don't block
      const errorMsg = validation.errors.map(e => e.message).join('\n');
      if (!confirm(`There are validation issues:\n\n${errorMsg}\n\nContinue anyway?`)) {
        return;
      }
    }

    if (preview) {
      setShowPreview(true);
      // Open preview in new window
      const previewWindow = window.open('', '_blank');
      if (previewWindow) {
        // Generate preview HTML (simplified version of PDF)
        previewWindow.document.write(`
          <html>
            <head><title>Quote Preview</title></head>
            <body style="font-family: Arial; padding: 20px;">
              <h1>Quote Preview</h1>
              <p>Shipment: ${shipmentData?.id}</p>
              <p>Service: ${serviceModel}</p>
              <p>Client Price: €${clientPrice.toFixed(2)}</p>
              <p><em>This is a preview. Close this window to continue editing.</em></p>
            </body>
          </html>
        `);
      }
      return;
    }

    setSaving(true);
    try {
      await onSave(quote);
    } finally {
      setSaving(false);
    }
  };

  const getServiceModelDescription = () => {
    if (serviceModel === 'wg-full') {
      return 'Full White-Glove Service - Professional operators handle entire journey';
    } else if (serviceModel === 'dhl-full') {
      return 'Full DHL Service - Complete shipping via DHL network';
    } else if (serviceModel === 'hybrid') {
      return hybridVariant === 'wg_to_dhl' 
        ? 'Hybrid: WG to Hub → DHL to Client'
        : 'Hybrid: DHL to Hub → WG to Client';
    }
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Service Model Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-1">
          {getServiceModelDescription()}
        </h3>
        <p className="text-sm text-blue-700">
          Tier {tier} • {senderAddress.city || 'Origin'} → {buyerAddress.city || 'Destination'}
        </p>
      </div>

      {/* Parties & Hubs Addresses */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Parties & Hubs</h3>
          <a 
            href="/sprint-8/logistics/hub" 
            target="_blank"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            Manage Hubs →
          </a>
        </div>
        
        {/* Sender Address */}
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <User className="h-5 w-5 text-gray-600 mr-2" />
            <h4 className="font-medium text-gray-900">Sender (A)</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={senderAddress.name}
                onChange={(e) => setSenderAddress({ ...senderAddress, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Sender name"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Street Address</label>
              <input
                type="text"
                value={senderAddress.street}
                onChange={(e) => setSenderAddress({ ...senderAddress, street: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Street address"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={senderAddress.city}
                onChange={(e) => setSenderAddress({ ...senderAddress, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Postal Code</label>
              <input
                type="text"
                value={senderAddress.postalCode}
                onChange={(e) => setSenderAddress({ ...senderAddress, postalCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Postal code"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                value={senderAddress.country}
                onChange={(e) => setSenderAddress({ ...senderAddress, country: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Country"
              />
            </div>
          </div>
        </div>

        {/* Hub #1 (Authenticator) - Required for Tier 2 & 3 */}
        {tier > 1 && (
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <Building2 className="h-5 w-5 text-gray-600 mr-2" />
              <h4 className="font-medium text-gray-900">Hub #1 (Authenticator)</h4>
              <span className="ml-2 text-xs text-red-600">*Required for Tier {tier}</span>
            </div>
            
            {/* Hub Selection Dropdown */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Select Hub</label>
              <div className="relative hub-dropdown">
                <button
                  onClick={() => setShowHub1Dropdown(!showHub1Dropdown)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left bg-white hover:bg-gray-50 flex items-center justify-between"
                >
                  <span className={selectedHub1 ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedHub1 ? `${selectedHub1.name} (${selectedHub1.code})` : 'Choose an authenticator hub...'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                
                {showHub1Dropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filterHubsByType(availableHubs, 'authenticator').map((hub) => (
                      <button
                        key={hub.id}
                        onClick={() => {
                          setSelectedHub1(hub);
                          setShowHub1Dropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex flex-col border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{hub.name} ({hub.code})</div>
                        <div className="text-xs text-gray-500">{hub.address.city}, {hub.address.country}</div>
                        <div className="text-xs text-blue-600">
                          {hub.capabilities.authentication ? 'Authentication' : ''} 
                          {hub.capabilities.nfc ? ' • NFC' : ''}
                          {hub.capabilities.storage ? ' • Storage' : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Hub Address Display (read-only when hub selected) */}
            {selectedHub1 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hub Name</label>
                  <input
                    type="text"
                    value={hub1Address.name}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={hub1Address.street}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={hub1Address.city}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={hub1Address.postalCode}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={hub1Address.country}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                  />
                </div>
              </div>
            )}
            
            {/* Hub Contact & Pricing Info */}
            {selectedHub1 && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-2">Primary Contact</h5>
                  {selectedHub1.contacts.find(c => c.isPrimary) && (
                    <div className="text-sm text-blue-800">
                      <div>{selectedHub1.contacts.find(c => c.isPrimary)?.name}</div>
                      <div>{selectedHub1.contacts.find(c => c.isPrimary)?.role}</div>
                      <div>{selectedHub1.contacts.find(c => c.isPrimary)?.email}</div>
                      <div>{selectedHub1.contacts.find(c => c.isPrimary)?.phone}</div>
                    </div>
                  )}
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <h5 className="font-medium text-green-900 mb-2">Pricing</h5>
                  <div className="text-sm text-green-800">
                    {selectedHub1.pricing.filter(p => p.serviceType === 'authentication').map(pricing => (
                      <div key={pricing.id} className="flex justify-between">
                        <span>{pricing.serviceName}:</span>
                        <span>€{pricing.price}/{pricing.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hub #2 (Couturier) - Optional for Tier 3 only */}
        {tier === 3 && (
          <>
            <div className="mb-4">
              <button
                onClick={() => setNoSecondHub(!noSecondHub)}
                className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {noSecondHub ? (
                  <ToggleLeft className="h-5 w-5 text-gray-400" />
                ) : (
                  <ToggleRight className="h-5 w-5 text-blue-600" />
                )}
                <span>No second hub for this quote</span>
              </button>
            </div>

        {/* Hub #2 (Couturier) - Optional for Tier 3 only */}
        {tier === 3 && (
          <>
            <div className="mb-4">
              <button
                onClick={() => setNoSecondHub(!noSecondHub)}
                className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {noSecondHub ? (
                  <ToggleLeft className="h-5 w-5 text-gray-400" />
                ) : (
                  <ToggleRight className="h-5 w-5 text-blue-600" />
                )}
                <span>No second hub for this quote</span>
              </button>
            </div>

            {!noSecondHub && (
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <Building2 className="h-5 w-5 text-gray-600 mr-2" />
                  <h4 className="font-medium text-gray-900">Hub #2 (Couturier)</h4>
                  <span className="ml-2 text-xs text-gray-500">Optional for sewing</span>
                </div>
                
                {/* Hub Selection Dropdown */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Select Hub</label>
                  <div className="relative hub-dropdown">
                    <button
                      onClick={() => setShowHub2Dropdown(!showHub2Dropdown)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left bg-white hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className={selectedHub2 ? 'text-gray-900' : 'text-gray-500'}>
                        {selectedHub2 ? `${selectedHub2.name} (${selectedHub2.code})` : 'Choose a couturier hub...'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </button>
                    
                    {showHub2Dropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filterHubsByType(availableHubs, 'couturier').map((hub) => (
                          <button
                            key={hub.id}
                            onClick={() => {
                              setSelectedHub2(hub);
                              setShowHub2Dropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex flex-col border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{hub.name} ({hub.code})</div>
                            <div className="text-xs text-gray-500">{hub.address.city}, {hub.address.country}</div>
                            <div className="text-xs text-purple-600">
                              {hub.capabilities.sewing ? 'Sewing' : ''} 
                              {hub.capabilities.nfc ? ' • NFC' : ''}
                              {hub.capabilities.storage ? ' • Storage' : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Hub Address Display (read-only when hub selected) */}
                {selectedHub2 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hub Name</label>
                      <input
                        type="text"
                        value={hub2Address.name}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Street Address</label>
                      <input
                        type="text"
                        value={hub2Address.street}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={hub2Address.city}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={hub2Address.postalCode}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                      <input
                        type="text"
                        value={hub2Address.country}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                      />
                    </div>
                  </div>
                )}
                
                {/* Hub Contact & Pricing Info */}
                {selectedHub2 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <h5 className="font-medium text-purple-900 mb-2">Primary Contact</h5>
                      {selectedHub2.contacts.find(c => c.isPrimary) && (
                        <div className="text-sm text-purple-800">
                          <div>{selectedHub2.contacts.find(c => c.isPrimary)?.name}</div>
                          <div>{selectedHub2.contacts.find(c => c.isPrimary)?.role}</div>
                          <div>{selectedHub2.contacts.find(c => c.isPrimary)?.email}</div>
                          <div>{selectedHub2.contacts.find(c => c.isPrimary)?.phone}</div>
                        </div>
                      )}
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <h5 className="font-medium text-green-900 mb-2">Pricing</h5>
                      <div className="text-sm text-green-800">
                        {selectedHub2.pricing.filter(p => p.serviceType === 'sewing').map(pricing => (
                          <div key={pricing.id} className="flex justify-between">
                            <span>{pricing.serviceName}:</span>
                            <span>€{pricing.price}/{pricing.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
          </>
        )}

        {/* Buyer Address */}
        <div>
          <div className="flex items-center mb-3">
            <Home className="h-5 w-5 text-gray-600 mr-2" />
            <h4 className="font-medium text-gray-900">Buyer (B)</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={buyerAddress.name}
                onChange={(e) => setBuyerAddress({ ...buyerAddress, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Buyer name"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Street Address</label>
              <input
                type="text"
                value={buyerAddress.street}
                onChange={(e) => setBuyerAddress({ ...buyerAddress, street: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Street address"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={buyerAddress.city}
                onChange={(e) => setBuyerAddress({ ...buyerAddress, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Postal Code</label>
              <input
                type="text"
                value={buyerAddress.postalCode}
                onChange={(e) => setBuyerAddress({ ...buyerAddress, postalCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Postal code"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                value={buyerAddress.country}
                onChange={(e) => setBuyerAddress({ ...buyerAddress, country: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Country"
              />
            </div>
          </div>
        </div>

        {/* Routing Info */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">Route Path:</p>
          <p className="text-sm text-gray-600">
            {tier === 1 && 'A → B (Direct delivery, no hub required)'}
            {tier === 2 && serviceModel === 'wg-full' && 'A → Hub #1 → B (Full WG)'}
            {tier === 2 && serviceModel === 'dhl-full' && 'A → Hub #1 (DHL) → B (DHL)'}
            {tier === 3 && serviceModel === 'wg-full' && !noSecondHub && 'A → Hub #1 → Hub #2 → B (Full WG)'}
            {tier === 3 && serviceModel === 'wg-full' && noSecondHub && 'A → Hub #1 → B (Full WG)'}
            {tier === 3 && serviceModel === 'dhl-full' && !noSecondHub && 'A → Hub #1 (DHL) → Hub #2 (Internal) → B (DHL)'}
            {tier === 3 && serviceModel === 'dhl-full' && noSecondHub && 'A → Hub #1 (DHL) → B (DHL)'}
            {tier === 3 && serviceModel === 'hybrid' && hybridVariant === 'wg_to_dhl' && !noSecondHub && 'A → Hub #1 (WG) → Hub #2 (Internal) → B (DHL)'}
            {tier === 3 && serviceModel === 'hybrid' && hybridVariant === 'wg_to_dhl' && noSecondHub && 'A → Hub #1 (WG) → B (DHL)'}
            {tier === 3 && serviceModel === 'hybrid' && hybridVariant === 'dhl_to_wg' && !noSecondHub && 'A → Hub #1 (DHL) → Hub #2 (Internal) → B (WG)'}
            {tier === 3 && serviceModel === 'hybrid' && hybridVariant === 'dhl_to_wg' && noSecondHub && 'A → Hub #1 (DHL) → B (WG)'}
          </p>
        </div>
      </div>

      {/* Transport Segments - Using New Enhanced Editor */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <RouteSegmentEditor
          segments={segments}
          serviceModel={serviceModel}
          hybridVariant={hybridVariant}
          tier={tier}
          parties={{
            sender: { name: senderAddress.name, city: senderAddress.city },
            hub1: hub1Address.name ? { name: hub1Address.name, city: hub1Address.city } : undefined,
            hub2: hub2Address.name && !noSecondHub ? { name: hub2Address.name, city: hub2Address.city } : undefined,
            buyer: { name: buyerAddress.name, city: buyerAddress.city }
          }}
          noSecondHub={noSecondHub}
          onSegmentsChange={setSegments}
        />
      </div>

      {/* WG Labor Calculator (only for WG services) */}
      {(serviceModel === 'wg-full' || (serviceModel === 'hybrid' && hybridVariant)) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">White-Glove Labor Costs</h3>
          <WGLaborCalculator
            segments={segments}
            onLaborCostChange={handleLaborCostChange}
          />
        </div>
      )}

      {/* Hub Processing Costs - Auto-included by Tier */}
      {tier >= 2 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Hub Processing Costs</h3>
            <span className="text-sm text-gray-500">Auto-calculated from hub price book</span>
          </div>
          
          {/* Hub #1 (Authenticator) */}
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-3">
              Hub #1 (Authenticator): {hub1Address.name || 'Not specified'}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Authentication Fee (€)
                </label>
                <input
                  type="number"
                  value={hubFees.authentication}
                  onChange={(e) => setHubFees({ ...hubFees, authentication: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              
              {tier === 2 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Security Tag Unit (€)
                  </label>
                  <input
                    type="number"
                    value={hubFees.tag}
                    onChange={(e) => setHubFees({ ...hubFees, tag: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}
              
              {tier === 3 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    NFC Chip Unit (€)
                  </label>
                  <input
                    type="number"
                    value={hubFees.nfc}
                    onChange={(e) => setHubFees({ ...hubFees, nfc: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}
              
              {tier === 3 && noSecondHub && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Sewing Fee (€)
                    </label>
                    <input
                      type="number"
                      value={hubFees.sewing}
                      onChange={(e) => setHubFees({ ...hubFees, sewing: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      QA Fee (€)
                    </label>
                    <input
                      type="number"
                      value={hubFees.qaFee}
                      onChange={(e) => setHubFees({ ...hubFees, qaFee: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="mt-2 text-xs text-gray-600">
              Hub #1 Subtotal: €{(hubFees.authentication + (tier === 2 ? hubFees.tag : hubFees.nfc) + 
                (tier === 3 && noSecondHub ? hubFees.sewing + hubFees.qaFee : 0)).toFixed(2)}
            </div>
          </div>

          {/* Hub #2 (Couturier) - Tier 3 only */}
          {tier === 3 && !noSecondHub && (
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="text-sm font-semibold text-purple-900 mb-3">
                Hub #2 (Couturier): {hub2Address.name || 'Not specified'}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Sewing Fee (€)
                  </label>
                  <input
                    type="number"
                    value={hubFees.sewing}
                    onChange={(e) => setHubFees({ ...hubFees, sewing: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Quality Assurance (€)
                  </label>
                  <input
                    type="number"
                    value={hubFees.qaFee}
                    onChange={(e) => setHubFees({ ...hubFees, qaFee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Hub #2 Subtotal: €{(hubFees.sewing + hubFees.qaFee).toFixed(2)}
              </div>
            </div>
          )}

          <div className="mt-4 p-3 bg-gray-100 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Total Hub Fees:</span>
              <span className="text-lg font-semibold text-gray-900">€{hubTotal.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-gray-500">
            <Info className="inline h-3 w-3 mr-1" />
            Fees are auto-populated from hub price book but can be overridden
          </div>
        </div>
      )}

      {/* Totals & Margin - Comprehensive Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown & Pricing</h3>
        
        {/* Detailed Breakdown Table */}
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium text-gray-700">Category</th>
                <th className="text-right py-2 font-medium text-gray-700">Amount (€)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Transport Breakdown */}
              {segments.length > 0 && (
                <>
                  <tr className="font-medium bg-gray-50">
                    <td className="py-2">Transport</td>
                    <td className="text-right py-2">€{transportTotal.toFixed(2)}</td>
                  </tr>
                  {segments.map((seg, idx) => {
                    const segCost = seg.mode === 'wg' && seg.wgPricing ? 
                      (seg.wgPricing.flights + seg.wgPricing.trains + seg.wgPricing.ground + seg.wgPricing.other) :
                      seg.mode === 'dhl' && seg.dhlPricing ? seg.dhlPricing.quote :
                      seg.mode === 'internal' && seg.internalPricing ? 
                        (seg.internalPricing.perItemCost * seg.internalPricing.itemCount) : 0;
                    
                    if (segCost > 0) {
                      return (
                        <tr key={seg.id} className="text-xs text-gray-600">
                          <td className="py-1 pl-4">
                            Segment {idx + 1}: {seg.from} → {seg.to} ({seg.mode.toUpperCase()})
                          </td>
                          <td className="text-right py-1">€{segCost.toFixed(2)}</td>
                        </tr>
                      );
                    }
                    return null;
                  })}
                </>
              )}
              
              {/* WG Labor Breakdown */}
              {laborCosts.totalLaborCost > 0 && (
                <>
                  <tr className="font-medium bg-gray-50">
                    <td className="py-2">WG Labor</td>
                    <td className="text-right py-2">€{laborCosts.totalLaborCost.toFixed(2)}</td>
                  </tr>
                  <tr className="text-xs text-gray-600">
                    <td className="py-1 pl-4">Base Labor ({laborCosts.regularHours.toFixed(1)}h)</td>
                    <td className="text-right py-1">€{laborCosts.baseLaborCost.toFixed(2)}</td>
                  </tr>
                  {laborCosts.overtimeCost > 0 && (
                    <tr className="text-xs text-gray-600">
                      <td className="py-1 pl-4">Overtime ({laborCosts.overtimeHours.toFixed(1)}h)</td>
                      <td className="text-right py-1">€{laborCosts.overtimeCost.toFixed(2)}</td>
                    </tr>
                  )}
                  {laborCosts.perDiemCost > 0 && (
                    <tr className="text-xs text-gray-600">
                      <td className="py-1 pl-4">Per Diem</td>
                      <td className="text-right py-1">€{laborCosts.perDiemCost.toFixed(2)}</td>
                    </tr>
                  )}
                </>
              )}
              
              {/* Hub Fees Breakdown */}
              {hubTotal > 0 && (
                <>
                  <tr className="font-medium bg-gray-50">
                    <td className="py-2">Hub Processing</td>
                    <td className="text-right py-2">€{hubTotal.toFixed(2)}</td>
                  </tr>
                  {hubFees.authentication > 0 && (
                    <tr className="text-xs text-gray-600">
                      <td className="py-1 pl-4">Authentication (Hub #1)</td>
                      <td className="text-right py-1">€{hubFees.authentication.toFixed(2)}</td>
                    </tr>
                  )}
                  {hubFees.tag > 0 && (
                    <tr className="text-xs text-gray-600">
                      <td className="py-1 pl-4">Security Tag</td>
                      <td className="text-right py-1">€{hubFees.tag.toFixed(2)}</td>
                    </tr>
                  )}
                  {hubFees.nfc > 0 && (
                    <tr className="text-xs text-gray-600">
                      <td className="py-1 pl-4">NFC Chip</td>
                      <td className="text-right py-1">€{hubFees.nfc.toFixed(2)}</td>
                    </tr>
                  )}
                  {hubFees.sewing > 0 && (
                    <tr className="text-xs text-gray-600">
                      <td className="py-1 pl-4">Sewing (Hub #{noSecondHub ? '1' : '2'})</td>
                      <td className="text-right py-1">€{hubFees.sewing.toFixed(2)}</td>
                    </tr>
                  )}
                  {hubFees.qaFee > 0 && (
                    <tr className="text-xs text-gray-600">
                      <td className="py-1 pl-4">Quality Assurance</td>
                      <td className="text-right py-1">€{hubFees.qaFee.toFixed(2)}</td>
                    </tr>
                  )}
                </>
              )}
              
              {/* Insurance */}
              <tr>
                <td className="py-2">Insurance (0.3% of value)</td>
                <td className="text-right py-2">€{insurance.toFixed(2)}</td>
              </tr>
              
              {/* Total Cost */}
              <tr className="font-bold text-base border-t-2">
                <td className="py-3">Internal Cost Total</td>
                <td className="text-right py-3">€{totalCost.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Margin Calculator */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Markup / Margin</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Margin Type
              </label>
              <select
                value={marginType}
                onChange={(e) => setMarginType(e.target.value as 'percentage' | 'amount')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="amount">Fixed Amount (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {marginType === 'percentage' ? 'Margin %' : 'Margin €'}
              </label>
              <input
                type="number"
                value={margin}
                onChange={(e) => setMargin(parseFloat(e.target.value) || 0)}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Calculated Margin
              </label>
              <div className="px-3 py-2 bg-green-100 border border-green-300 rounded-lg text-sm font-medium text-green-800">
                €{marginAmount.toFixed(2)} ({marginPercentage.toFixed(1)}%)
              </div>
            </div>
          </div>
        </div>
        
        {/* Client Price */}
        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-900">Client Price</p>
              <p className="text-xs text-blue-700 mt-1">
                Internal Cost + Margin = Final Quote
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">€{clientPrice.toFixed(2)}</p>
              {currency !== 'EUR' && (
                <p className="text-sm text-blue-700 mt-1">
                  Currency: {currency}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* SLA Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SLA Comment (Optional)
          </label>
          <textarea
            value={slaComment}
            onChange={(e) => setSlaComment(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            rows={3}
            placeholder="Add any SLA commitments, special conditions, or notes for the client..."
          />
        </div>
      </div>

      {/* Validation Messages */}
      {validationErrors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-yellow-900 mb-2">Validation Notes</p>
              <ul className="text-sm text-yellow-800 space-y-1">
                {validationErrors.slice(0, 5).map((error, idx) => (
                  <li key={idx}>{formatValidationMessage(error)}</li>
                ))}
                {validationErrors.length > 5 && (
                  <li className="text-yellow-600">...and {validationErrors.length - 5} more</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* PDF Generation - Primary CTA */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Generate Quote PDF</h3>
            <p className="text-sm text-gray-600 mb-4">
              Generate a clean route sheet and attach it to the shipment. No reservations or bookings will be made.
            </p>
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span className="flex items-center">
                <Check className="h-3 w-3 mr-1 text-green-600" />
                PDF attached to shipment
              </span>
              <span className="flex items-center">
                <Download className="h-3 w-3 mr-1 text-blue-600" />
                Download link provided
              </span>
              <span className="flex items-center">
                <Info className="h-3 w-3 mr-1 text-gray-400" />
                No side effects
              </span>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => handleSave(true)}
              className="inline-flex items-center px-6 py-3 font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FileText className="h-5 w-5 mr-2" />
              Preview PDF
            </button>
            
            <button
              onClick={() => handleSave(false)}
              disabled={saving || segments.length === 0}
              className={`inline-flex items-center px-8 py-3 font-medium rounded-lg transition-all transform hover:scale-105 ${
                saving || segments.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
              }`}
            >
              {saving ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5 mr-2" />
                  Generate Quote PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold mb-1">Manual Entry Tips</p>
            <ul className="space-y-1">
              <li>• Use external sites (Skyscanner, Trainline, etc.) to find real prices</li>
              <li>• Include all segments from pickup to delivery</li>
              <li>• Don't forget return journey costs for operators</li>
              <li>• Standard WG rate: €65/hour, Overtime: €97.50/hour</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
