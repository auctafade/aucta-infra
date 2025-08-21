'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck, Package, Building2, Plane, Train, Car, User,
  Clock, Calendar, Euro, FileText, Paperclip,
  Plus, Trash2, ChevronDown, ChevronUp, Info
} from 'lucide-react';

export interface SegmentAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  file?: File;
}

export interface RouteSegment {
  id: string;
  mode: 'wg' | 'dhl' | 'internal';
  serviceProvider: 'chauffeur' | 'dhl' | 'wg';
  from: string;
  to: string;
  departureDateTime: string;
  arrivalDateTime: string;
  duration: number; // in hours
  
  // WG-specific pricing
  wgPricing?: {
    flights: number;
    trains: number;
    ground: number;
    other: number;
    otherNotes?: string;
  };
  
  // DHL-specific pricing
  dhlPricing?: {
    quote: number;
    serviceLevel: 'express' | 'standard';
    trackingNumber?: string;
  };
  
  // Chauffeur-specific pricing
  chauffeurPricing?: {
    quote: number;
    serviceLevel: 'standard' | 'premium' | 'luxury';
    vehicleType?: string;
    driverNotes?: string;
  };
  
  // Internal rollout pricing
  internalPricing?: {
    perItemCost: number;
    itemCount: number;
  };
  
  notes: string;
  attachments: SegmentAttachment[];
}

interface RouteSegmentEditorProps {
  segments: RouteSegment[];
  serviceModel: 'wg-full' | 'dhl-full' | 'hybrid';
  hybridVariant?: 'wg_to_dhl' | 'dhl_to_wg';
  tier: number;
  parties: {
    sender: { name: string; city: string };
    hub1?: { name: string; city: string };
    hub2?: { name: string; city: string };
    buyer: { name: string; city: string };
  };
  noSecondHub: boolean;
  onSegmentsChange: (segments: RouteSegment[]) => void;
}

export default function RouteSegmentEditor({
  segments,
  serviceModel,
  hybridVariant,
  tier,
  parties,
  noSecondHub,
  onSegmentsChange
}: RouteSegmentEditorProps) {
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
  const [internalRolloutCost, setInternalRolloutCost] = useState(50); // Default cost per item

  // Auto-generate segments based on service model and route
  useEffect(() => {
    if (segments.length === 0) {
      generateDefaultSegments();
    }
  }, [serviceModel, tier, noSecondHub]);

  const generateDefaultSegments = () => {
    const newSegments: RouteSegment[] = [];
    const now = new Date();
    let currentTime = new Date(now);

    if (tier === 2) {
      if (serviceModel === 'wg-full') {
        // A → Hub #1 (WG)
        newSegments.push(createSegment('wg', parties.sender.city, parties.hub1?.name || 'Hub Authenticator', currentTime));
        currentTime = addHours(currentTime, 4);
        
        // Hub #1 → B (WG)
        newSegments.push(createSegment('wg', parties.hub1?.name || 'Hub Authenticator', parties.buyer.city, currentTime));
      } else if (serviceModel === 'dhl-full') {
        // A → Hub #1 (DHL)
        newSegments.push(createSegment('dhl', parties.sender.city, parties.hub1?.name || 'Hub Authenticator', currentTime));
        currentTime = addHours(currentTime, 24);
        
        // Hub #1 → B (DHL)
        newSegments.push(createSegment('dhl', parties.hub1?.name || 'Hub Authenticator', parties.buyer.city, currentTime));
      }
    } else if (tier === 3) {
      if (serviceModel === 'wg-full') {
        // A → Hub #1 (WG)
        newSegments.push(createSegment('wg', parties.sender.city, parties.hub1?.name || 'Hub Authenticator', currentTime));
        currentTime = addHours(currentTime, 4);
        
        if (!noSecondHub && parties.hub2) {
          // Hub #1 → Hub #2 (Internal)
          newSegments.push(createSegment('internal', parties.hub1?.name || 'Hub Authenticator', parties.hub2.name || 'Hub Couturier', currentTime));
          currentTime = addHours(currentTime, 24);
          
          // Hub #2 → B (WG)
          newSegments.push(createSegment('wg', parties.hub2.name || 'Hub Couturier', parties.buyer.city, currentTime));
        } else {
          // Hub #1 → B (WG)
          newSegments.push(createSegment('wg', parties.hub1?.name || 'Hub Authenticator', parties.buyer.city, currentTime));
        }
      } else if (serviceModel === 'dhl-full') {
        // A → Hub #1 (DHL)
        newSegments.push(createSegment('dhl', parties.sender.city, parties.hub1?.name || 'Hub Authenticator', currentTime));
        currentTime = addHours(currentTime, 24);
        
        if (!noSecondHub && parties.hub2) {
          // Hub #1 → Hub #2 (Internal)
          newSegments.push(createSegment('internal', parties.hub1?.name || 'Hub Authenticator', parties.hub2.name || 'Hub Couturier', currentTime));
          currentTime = addHours(currentTime, 24);
          
          // Hub #2 → B (DHL)
          newSegments.push(createSegment('dhl', parties.hub2.name || 'Hub Couturier', parties.buyer.city, currentTime));
        } else {
          // Hub #1 → B (DHL)
          newSegments.push(createSegment('dhl', parties.hub1?.name || 'Hub Authenticator', parties.buyer.city, currentTime));
        }
      } else if (serviceModel === 'hybrid') {
        if (hybridVariant === 'wg_to_dhl') {
          // A → Hub #1 (WG)
          newSegments.push(createSegment('wg', parties.sender.city, parties.hub1?.name || 'Hub Authenticator', currentTime));
          currentTime = addHours(currentTime, 4);
          
          if (!noSecondHub && parties.hub2) {
            // Hub #1 → Hub #2 (Internal)
            newSegments.push(createSegment('internal', parties.hub1?.name || 'Hub Authenticator', parties.hub2.name || 'Hub Couturier', currentTime));
            currentTime = addHours(currentTime, 24);
            
            // Hub #2 → B (DHL)
            newSegments.push(createSegment('dhl', parties.hub2.name || 'Hub Couturier', parties.buyer.city, currentTime));
          } else {
            // Hub #1 → B (DHL)
            newSegments.push(createSegment('dhl', parties.hub1?.name || 'Hub Authenticator', parties.buyer.city, currentTime));
          }
        } else if (hybridVariant === 'dhl_to_wg') {
          // A → Hub #1 (DHL)
          newSegments.push(createSegment('dhl', parties.sender.city, parties.hub1?.name || 'Hub Authenticator', currentTime));
          currentTime = addHours(currentTime, 24);
          
          if (!noSecondHub && parties.hub2) {
            // Hub #1 → Hub #2 (Internal)
            newSegments.push(createSegment('internal', parties.hub1?.name || 'Hub Authenticator', parties.hub2.name || 'Hub Couturier', currentTime));
            currentTime = addHours(currentTime, 24);
            
            // Hub #2 → B (WG)
            newSegments.push(createSegment('wg', parties.hub2.name || 'Hub Couturier', parties.buyer.city, currentTime));
          } else {
            // Hub #1 → B (WG)
            newSegments.push(createSegment('wg', parties.hub1?.name || 'Hub Authenticator', parties.buyer.city, currentTime));
          }
        }
      }
    }

    onSegmentsChange(newSegments);
  };

  const createSegment = (mode: 'wg' | 'dhl' | 'internal', from: string, to: string, departureTime: Date): RouteSegment => {
    const duration = mode === 'dhl' ? 24 : mode === 'internal' ? 24 : 4;
    const arrivalTime = addHours(departureTime, duration);
    
    // Set default service provider based on mode
    let serviceProvider: 'chauffeur' | 'dhl' | 'wg';
    if (mode === 'dhl') {
      serviceProvider = 'dhl';
    } else if (mode === 'internal') {
      serviceProvider = 'wg'; // Internal defaults to WG
    } else {
      serviceProvider = 'wg'; // WG mode defaults to WG
    }
    
    const segment: RouteSegment = {
      id: Date.now().toString() + Math.random(),
      mode,
      serviceProvider,
      from,
      to,
      departureDateTime: formatDateTime(departureTime),
      arrivalDateTime: formatDateTime(arrivalTime),
      duration,
      notes: '',
      attachments: []
    };

    // Initialize mode-specific pricing
    if (mode === 'wg') {
      segment.wgPricing = { flights: 0, trains: 0, ground: 0, other: 0 };
    } else if (mode === 'dhl') {
      segment.dhlPricing = { quote: 0, serviceLevel: 'standard' };
    } else if (mode === 'internal') {
      segment.internalPricing = { perItemCost: internalRolloutCost, itemCount: 1 };
    }

    return segment;
  };

  const addHours = (date: Date, hours: number): Date => {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() + hours);
    return newDate;
  };

  const formatDateTime = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const calculateDuration = (departure: string, arrival: string): number => {
    if (!departure || !arrival) return 0;
    const depTime = new Date(departure).getTime();
    const arrTime = new Date(arrival).getTime();
    const diffMs = arrTime - depTime;
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60) * 10) / 10); // Round to 1 decimal
  };

  const updateSegment = (id: string, updates: Partial<RouteSegment>) => {
    const updatedSegments = segments.map(seg => {
      if (seg.id === id) {
        const updated = { ...seg, ...updates };
        
        // Auto-calculate duration if both times are set
        if (updates.departureDateTime || updates.arrivalDateTime) {
          const departure = updates.departureDateTime || seg.departureDateTime;
          const arrival = updates.arrivalDateTime || seg.arrivalDateTime;
          if (departure && arrival) {
            updated.duration = calculateDuration(departure, arrival);
          }
        }
        
        return updated;
      }
      return seg;
    });
    onSegmentsChange(updatedSegments);
  };

  const removeSegment = (id: string) => {
    onSegmentsChange(segments.filter(seg => seg.id !== id));
  };

  const addSegment = () => {
    const lastSegment = segments[segments.length - 1];
    const newSegment = createSegment(
      'wg',
      lastSegment ? lastSegment.to : parties.sender.city,
      parties.buyer.city,
      lastSegment ? new Date(lastSegment.arrivalDateTime) : new Date()
    );
    onSegmentsChange([...segments, newSegment]);
  };

  const toggleSegmentExpansion = (id: string) => {
    const newExpanded = new Set(expandedSegments);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSegments(newExpanded);
  };

  const handleFileUpload = (segmentId: string, files: FileList) => {
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) return;

    const newAttachments: SegmentAttachment[] = Array.from(files).map(file => ({
      id: Date.now().toString() + Math.random(),
      name: file.name,
      type: file.type,
      size: file.size,
      file
    }));

    updateSegment(segmentId, {
      attachments: [...segment.attachments, ...newAttachments]
    });
  };

  const removeAttachment = (segmentId: string, attachmentId: string) => {
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) return;

    updateSegment(segmentId, {
      attachments: segment.attachments.filter(a => a.id !== attachmentId)
    });
  };

  const getModeIcon = (mode: 'wg' | 'dhl' | 'internal') => {
    switch (mode) {
      case 'wg': return <Truck className="h-4 w-4" />;
      case 'dhl': return <Package className="h-4 w-4" />;
      case 'internal': return <Building2 className="h-4 w-4" />;
    }
  };

  const getServiceProviderIcon = (serviceProvider: 'chauffeur' | 'dhl' | 'wg') => {
    switch (serviceProvider) {
      case 'chauffeur': return <User className="h-4 w-4" />;
      case 'dhl': return <Package className="h-4 w-4" />;
      case 'wg': return <Truck className="h-4 w-4" />;
    }
  };

  const getModeName = (mode: 'wg' | 'dhl' | 'internal') => {
    switch (mode) {
      case 'wg': return 'White-Glove';
      case 'dhl': return 'DHL';
      case 'internal': return 'Internal Rollout';
    }
  };

  const getServiceProviderName = (serviceProvider: 'chauffeur' | 'dhl' | 'wg') => {
    switch (serviceProvider) {
      case 'chauffeur': return 'Chauffeur';
      case 'dhl': return 'DHL';
      case 'wg': return 'White-Glove';
    }
  };

  const getModeColor = (mode: 'wg' | 'dhl' | 'internal') => {
    switch (mode) {
      case 'wg': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'dhl': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'internal': return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getServiceProviderColor = (serviceProvider: 'chauffeur' | 'dhl' | 'wg') => {
    switch (serviceProvider) {
      case 'chauffeur': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'dhl': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'wg': return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const calculateSegmentCost = (segment: RouteSegment): number => {
    if (segment.serviceProvider === 'chauffeur' && segment.chauffeurPricing) {
      return segment.chauffeurPricing.quote;
    } else if (segment.serviceProvider === 'dhl' && segment.dhlPricing) {
      return segment.dhlPricing.quote;
    } else if (segment.serviceProvider === 'wg' && segment.wgPricing) {
      return segment.wgPricing.flights + segment.wgPricing.trains + 
             segment.wgPricing.ground + segment.wgPricing.other;
    } else if (segment.mode === 'internal' && segment.internalPricing) {
      return segment.internalPricing.perItemCost * segment.internalPricing.itemCount;
    }
    return 0;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Route Segments</h3>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-600">
            Internal Rollout Cost: €
            <input
              type="number"
              value={internalRolloutCost}
              onChange={(e) => setInternalRolloutCost(parseFloat(e.target.value) || 0)}
              className="w-20 ml-1 px-2 py-1 border border-gray-300 rounded text-sm"
            />
            /item
          </div>
          <button
            onClick={addSegment}
            className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Segment
          </button>
        </div>
      </div>

      {segments.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600">No segments defined</p>
          <p className="text-sm text-gray-500 mt-1">Segments will be auto-generated based on your service model</p>
          <button
            onClick={generateDefaultSegments}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Generate Default Segments
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {segments.map((segment, index) => (
            <div key={segment.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Segment Header */}
              <div className="p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-700">
                      Segment {index + 1}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getServiceProviderColor(segment.serviceProvider)}`}>
                      {getServiceProviderIcon(segment.serviceProvider)}
                      <span className="ml-1">{getServiceProviderName(segment.serviceProvider)}</span>
                    </span>
                    <div className="flex items-center space-x-1 text-sm">
                      <input
                        type="text"
                        value={segment.from}
                        onChange={(e) => updateSegment(segment.id, { from: e.target.value })}
                        className="px-2 py-1 border border-gray-200 rounded text-gray-600 hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                        placeholder="From"
                        style={{ width: `${Math.max(8, segment.from.length) * 8}px` }}
                      />
                      <span className="text-gray-400">→</span>
                      <input
                        type="text"
                        value={segment.to}
                        onChange={(e) => updateSegment(segment.id, { to: e.target.value })}
                        className="px-2 py-1 border border-gray-200 rounded text-gray-600 hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                        placeholder="To"
                        style={{ width: `${Math.max(8, segment.to.length) * 8}px` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      €{calculateSegmentCost(segment).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleSegmentExpansion(segment.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      {expandedSegments.has(segment.id) ? 
                        <ChevronUp className="h-4 w-4" /> : 
                        <ChevronDown className="h-4 w-4" />
                      }
                    </button>
                    <button
                      onClick={() => removeSegment(segment.id)}
                      className="p-1 hover:bg-red-50 text-red-600 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedSegments.has(segment.id) && (
                <div className="p-4 space-y-4">
                  {/* Timing */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Timing
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Departure (Local Time)</label>
                        <input
                          type="datetime-local"
                          value={segment.departureDateTime}
                          onChange={(e) => updateSegment(segment.id, { departureDateTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Arrival (Local Time)</label>
                        <input
                          type="datetime-local"
                          value={segment.arrivalDateTime}
                          onChange={(e) => updateSegment(segment.id, { arrivalDateTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Duration (hours)</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm">
                          {segment.duration.toFixed(1)}h
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Service Provider */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      {getServiceProviderIcon(segment.serviceProvider)}
                      <span className="ml-1">Service Provider</span>
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Choose Service Provider</label>
                        <select
                          value={segment.serviceProvider}
                          onChange={(e) => {
                            const newServiceProvider = e.target.value as 'chauffeur' | 'dhl' | 'wg';
                            const updates: Partial<RouteSegment> = { serviceProvider: newServiceProvider };
                            
                            // Initialize pricing structure based on new service provider
                            if (newServiceProvider === 'chauffeur' && !segment.chauffeurPricing) {
                              updates.chauffeurPricing = { quote: 0, serviceLevel: 'standard' };
                            } else if (newServiceProvider === 'dhl' && !segment.dhlPricing) {
                              updates.dhlPricing = { quote: 0, serviceLevel: 'standard' };
                            } else if (newServiceProvider === 'wg' && !segment.wgPricing) {
                              updates.wgPricing = { flights: 0, trains: 0, ground: 0, other: 0 };
                            }
                            
                            updateSegment(segment.id, updates);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="chauffeur">Chauffeur Service</option>
                          <option value="dhl">DHL Shipping</option>
                          <option value="wg">White-Glove Service</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Service Provider-specific Pricing */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Euro className="h-4 w-4 mr-1" />
                      Pricing Details
                    </h4>
                    
                    {segment.serviceProvider === 'chauffeur' && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Chauffeur Quote (€)</label>
                          <input
                            type="number"
                            value={segment.chauffeurPricing?.quote || 0}
                            onChange={(e) => updateSegment(segment.id, {
                              chauffeurPricing: { ...segment.chauffeurPricing!, quote: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Service Level</label>
                          <select
                            value={segment.chauffeurPricing?.serviceLevel || 'standard'}
                            onChange={(e) => updateSegment(segment.id, {
                              chauffeurPricing: { ...segment.chauffeurPricing!, serviceLevel: e.target.value as 'standard' | 'premium' | 'luxury' }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="standard">Standard</option>
                            <option value="premium">Premium</option>
                            <option value="luxury">Luxury</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Vehicle Type (Optional)</label>
                          <input
                            type="text"
                            value={segment.chauffeurPricing?.vehicleType || ''}
                            onChange={(e) => updateSegment(segment.id, {
                              chauffeurPricing: { ...segment.chauffeurPricing!, vehicleType: e.target.value }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="e.g., Mercedes S-Class"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-xs text-gray-600 mb-1">Driver/Service Notes</label>
                          <input
                            type="text"
                            value={segment.chauffeurPricing?.driverNotes || ''}
                            onChange={(e) => updateSegment(segment.id, {
                              chauffeurPricing: { ...segment.chauffeurPricing!, driverNotes: e.target.value }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="Special instructions, driver contact, etc."
                          />
                        </div>
                      </div>
                    )}
                    
                    {segment.serviceProvider === 'wg' && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            <Plane className="inline h-3 w-3 mr-1" />
                            Flights (€)
                          </label>
                          <input
                            type="number"
                            value={segment.wgPricing?.flights || 0}
                            onChange={(e) => updateSegment(segment.id, {
                              wgPricing: { ...segment.wgPricing!, flights: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            <Train className="inline h-3 w-3 mr-1" />
                            Trains (€)
                          </label>
                          <input
                            type="number"
                            value={segment.wgPricing?.trains || 0}
                            onChange={(e) => updateSegment(segment.id, {
                              wgPricing: { ...segment.wgPricing!, trains: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            <Car className="inline h-3 w-3 mr-1" />
                            Ground (€)
                          </label>
                          <input
                            type="number"
                            value={segment.wgPricing?.ground || 0}
                            onChange={(e) => updateSegment(segment.id, {
                              wgPricing: { ...segment.wgPricing!, ground: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Other (€)</label>
                          <input
                            type="number"
                            value={segment.wgPricing?.other || 0}
                            onChange={(e) => updateSegment(segment.id, {
                              wgPricing: { ...segment.wgPricing!, other: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="0"
                          />
                        </div>
                        {segment.wgPricing?.other ? (
                          <div className="col-span-2 md:col-span-4">
                            <label className="block text-xs text-gray-600 mb-1">Other Costs Notes</label>
                            <input
                              type="text"
                              value={segment.wgPricing?.otherNotes || ''}
                              onChange={(e) => updateSegment(segment.id, {
                                wgPricing: { ...segment.wgPricing!, otherNotes: e.target.value }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              placeholder="Describe other costs..."
                            />
                          </div>
                        ) : null}
                      </div>
                    )}

                    {segment.serviceProvider === 'dhl' && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">DHL Quote (€)</label>
                          <input
                            type="number"
                            value={segment.dhlPricing?.quote || 0}
                            onChange={(e) => updateSegment(segment.id, {
                              dhlPricing: { ...segment.dhlPricing!, quote: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Service Level</label>
                          <select
                            value={segment.dhlPricing?.serviceLevel || 'standard'}
                            onChange={(e) => updateSegment(segment.id, {
                              dhlPricing: { ...segment.dhlPricing!, serviceLevel: e.target.value as 'express' | 'standard' }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="standard">Standard</option>
                            <option value="express">Express</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Tracking # (Optional)</label>
                          <input
                            type="text"
                            value={segment.dhlPricing?.trackingNumber || ''}
                            onChange={(e) => updateSegment(segment.id, {
                              dhlPricing: { ...segment.dhlPricing!, trackingNumber: e.target.value }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="DHL tracking number"
                          />
                        </div>
                      </div>
                    )}

                    {segment.mode === 'internal' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Cost per Item (€)</label>
                          <input
                            type="number"
                            value={segment.internalPricing?.perItemCost || 0}
                            onChange={(e) => updateSegment(segment.id, {
                              internalPricing: { ...segment.internalPricing!, perItemCost: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Number of Items</label>
                          <input
                            type="number"
                            value={segment.internalPricing?.itemCount || 1}
                            onChange={(e) => updateSegment(segment.id, {
                              internalPricing: { ...segment.internalPricing!, itemCount: parseInt(e.target.value) || 1 }
                            })}
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <FileText className="inline h-4 w-4 mr-1" />
                      Notes
                    </label>
                    <textarea
                      value={segment.notes}
                      onChange={(e) => updateSegment(segment.id, { notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      rows={2}
                      placeholder="e.g., Gare du Nord → 10 Rue de la Paix taxi, specific flight details, etc."
                    />
                  </div>

                  {/* Attachments */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Paperclip className="inline h-4 w-4 mr-1" />
                      Attachments (Screenshots of fares/quotes)
                    </label>
                    <div className="space-y-2">
                      {segment.attachments.map(attachment => (
                        <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm text-gray-700">{attachment.name}</span>
                          <button
                            onClick={() => removeAttachment(segment.id, attachment.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf"
                        onChange={(e) => e.target.files && handleFileUpload(segment.id, e.target.files)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Total Cost Summary */}
      {segments.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Total Transport Cost:</span>
            <span className="text-lg font-semibold text-gray-900">
              €{segments.reduce((sum, seg) => sum + calculateSegmentCost(seg), 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-semibold mb-1">Segment Tips:</p>
            <ul className="space-y-0.5">
              <li>• Choose service provider: Chauffeur (premium car service), DHL (shipping), or WG (White-Glove)</li>
              <li>• Enter prices from external sites (Skyscanner, Trainline, DHL.com, Uber, etc.)</li>
              <li>• Attach screenshots of quotes for documentation</li>
              <li>• Duration auto-calculates when both times are entered</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
