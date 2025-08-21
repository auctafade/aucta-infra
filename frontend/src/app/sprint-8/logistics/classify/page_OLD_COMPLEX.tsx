'use client';

/**
 * LOGISTICS CLASSIFICATION PAGE - TIER GATE LIST
 * 
 * Simple list of shipments needing tier assignment.
 * Clicking a shipment takes you to the individual tier assignment page.
 * No hub selection, reservations, or route planning here.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  MapPin,
  Clock,
  User,
  AlertTriangle,
  Info,
  CheckCircle,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';

interface ShipmentDetails {
  shipment_id: string;
  reference_sku: string;
  brand: string;
  declared_value: number;
  currency: string;
  weight: number;
  weight_unit: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  fragility_score?: number;
  urgency_level: string;
  sender_name: string;
  sender_city: string;
  sender_country: string;
  buyer_name: string;
  buyer_city: string;
  buyer_country: string;
  status: string;
  created_at: string;
  materials?: string[];
  customs_required?: boolean;
  expected_delivery_date?: string;
  shipping_method?: 'white_glove_p2p' | 'dhl_standard';
  requires_white_glove?: boolean;
}

interface PricingBreakdown {
  base_price: number;
  distance_factor: number;
  hub_demand_factor: number;
  tier_complexity: number;
  seasonal_adjustment: number;
  capacity_surge: number;
  total_price: number;
  currency: string;
  shipping_method: 'white_glove_p2p' | 'dhl_standard';
  is_white_glove_eligible: boolean;
  dhl_rate?: number;
  alternative_options?: Array<{
    hub: string;
    tier: string;
    price: number;
    savings: number;
    delivery_impact: string;
    shipping_method: string;
  }>;
}

interface Hub {
  id: string;
  name: string;
  city: string;
  country: string;
  available_tags: number;
  tag_threshold: number;
  available_nfc: number;
  nfc_threshold: number;
  sewing_capacity: number;
  sewing_booked: number;
  sewing_slots_per_day: number;
  next_available_day: string;
  icon: React.ComponentType<any>;
}

const tiers = [
  {
    id: '1',
    name: 'Tier 1',
    description: 'Digital only',
    full_description: 'Remote verification only',
    rules: 'T1: no Hub; remote verification only.',
    icon: Shield,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    selectedBgColor: 'bg-blue-100',
    selectedBorderColor: 'border-blue-500'
  },
  {
    id: '2',
    name: 'Tier 2', 
    description: 'Tag',
    full_description: 'Physical tag attachment with enhanced verification',
    rules: 'T2: Hub → authenticator + Tag inventory.',
    icon: Tag,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    selectedBgColor: 'bg-purple-100',
    selectedBorderColor: 'border-purple-500'
  },
  {
    id: '3',
    name: 'Tier 3',
    description: 'NFC + sewing',
    full_description: 'NFC chip integration with full activation',
    rules: 'T3: Hub → authenticator + sewing capacity + NFC inventory.',
    icon: Zap,
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    selectedBgColor: 'bg-yellow-100',
    selectedBorderColor: 'border-yellow-500'
  }
];

const hubs: Hub[] = [
  {
    id: 'paris',
    name: 'Paris Hub',
    city: 'Paris',
    country: 'France',
    available_tags: 150,
    tag_threshold: 20, // Amber warning below 20
    available_nfc: 75,
    nfc_threshold: 10, // Amber warning below 10
    sewing_capacity: 200,
    sewing_booked: 120,
    sewing_slots_per_day: 50,
    next_available_day: '2024-01-15',
    icon: Building2
  },
  {
    id: 'london',
    name: 'London Hub',
    city: 'London', 
    country: 'United Kingdom',
    available_tags: 120,
    tag_threshold: 15, // Amber warning below 15
    available_nfc: 60,
    nfc_threshold: 8, // Amber warning below 8
    sewing_capacity: 180,
    sewing_booked: 160,
    sewing_slots_per_day: 40,
    next_available_day: '2024-01-16',
    icon: Building2
  }
];

export default function ClassifyPage() {
  const router = useRouter();
  const { toasts, showSuccess, showError, removeToast } = useToast();
  
  const [shipments, setShipments] = useState<ShipmentDetails[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showDelayDialog, setShowDelayDialog] = useState(false);
  const [showAdminOverride, setShowAdminOverride] = useState(false);
  const [priceHistory, setPriceHistory] = useState<{[key: string]: number[]}>({});
  const [showPriceAlert, setShowPriceAlert] = useState(false);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<'white_glove_p2p' | 'dhl_standard' | null>(null);
  const [decisionReason, setDecisionReason] = useState<string>('');
  const [justificationNote, setJustificationNote] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<'ops' | 'hub_tech' | 'ops_admin'>('ops'); // TODO: Get from auth context
  const [showSuggestDialog, setShowSuggestDialog] = useState(false);
  const [suggestionNote, setSuggestionNote] = useState('');
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  
  // Edge case handling state
  const [selectedDelayDate, setSelectedDelayDate] = useState('');
  const [showDualApprovalDialog, setShowDualApprovalDialog] = useState(false);
  const [secondApprover, setSecondApprover] = useState('');
  const [approvalJustification, setApprovalJustification] = useState('');
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const [previousTier, setPreviousTier] = useState<string | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Event emission helper
  const emitEvent = (eventType: string, data: any) => {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent(eventType, {
        detail: {
          ...data,
          timestamp: new Date().toISOString(),
          source: 'logistics_classification'
        }
      }));
      console.log(`[Events] Emitted ${eventType}:`, data);
    }
  };

  // Determine specific failure reason for resource blocks
  const getResourceFailureReason = (tier: string, hubId: string): string | null => {
    if (!hubId || tier === '1') return null;
    
    const hubData = hubs.find(h => h.id === hubId);
    if (!hubData) return 'capacity_full';

    if (tier === '2') {
      if (hubData.available_tags <= 0) return 'no_tag';
    }

    if (tier === '3') {
      if (hubData.available_nfc <= 0) return 'no_nfc';
      
      const availableSewingSlots = hubData.sewing_slots_per_day - hubData.sewing_booked;
      if (availableSewingSlots <= 0) return 'no_sewing';
    }

    return null; // No resource constraint
  };

  // EDGE CASE 1: Check if both hubs are unavailable
  const checkBothHubsUnavailable = (tier: string): boolean => {
    if (tier === '1') return false; // T1 doesn't need hubs
    
    return hubs.every(hub => {
      const availability = getAvailabilityStatus(hub.id, tier);
      return availability?.status === 'red';
    });
  };

  // EDGE CASE 2: Check if high-value shipment requires dual approval
  const requiresDualApproval = (shipment: ShipmentDetails, tier: string): boolean => {
    const HIGH_VALUE_THRESHOLD = 50000; // €50,000 - configurable
    return shipment.declared_value > HIGH_VALUE_THRESHOLD && tier === '3';
  };

  // EDGE CASE 3: Handle tier downgrades with warnings
  const handleTierChange = (newTier: string) => {
    if (selectedTier && newTier !== selectedTier) {
      const oldTierNumber = parseInt(selectedTier);
      const newTierNumber = parseInt(newTier);
      
      if (newTierNumber < oldTierNumber) {
        // This is a downgrade - show warning
        setPreviousTier(selectedTier);
        setShowDowngradeWarning(true);
        return; // Don't change tier yet, wait for confirmation
      }
    }
    
    setSelectedTier(newTier);
    // Hub will be auto-selected by useEffect
  };

  // Confirm tier downgrade after warning
  const confirmTierDowngrade = (newTier: string, reason: string) => {
    // Log the downgrade for audit
    if (currentShipment) {
      emitEvent('tier.downgraded', {
        shipmentId: currentShipment.shipment_id,
        fromTier: previousTier,
        toTier: newTier,
        reason: reason,
        actorId: 'current_user',
        securityImpact: 'reduced_verification_level'
      });
    }
    
    setSelectedTier(newTier);
    setPreviousTier(null);
    setShowDowngradeWarning(false);
    
    // Clear hub selection if downgrading to T1
    if (newTier === '1') {
      setSelectedHub(null);
    }
    
    showSuccess(
      'Tier Downgraded',
      `Security level reduced from Tier ${previousTier} to Tier ${newTier}. Previous resources have been freed.`,
      4000
    );
  };

  // EDGE CASE 4: Retry logic for API failures
  const retryReservation = async (retryCount: number = 0): Promise<any> => {
    const MAX_RETRIES = 3;
    
    try {
      const result = await api.classifyAndReserveResources({
        shipment_id: selectedShipment!,
        tier: selectedTier!,
        hub: selectedHub || '',
        status: 'TierAssigned'
      });
      
      return result;
    } catch (error) {
      if (retryCount < MAX_RETRIES && error instanceof Error && 
          (error.message.includes('network') || error.message.includes('timeout'))) {
        
        setRetryAttempts(retryCount + 1);
        setLastError(error.message);
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return retryReservation(retryCount + 1);
      }
      throw error;
    }
  };

  // Get next available dates when both hubs are unavailable
  const getNextAvailableDates = (): string[] => {
    const dates: string[] = [];
    const today = new Date();
    
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      dates.push(checkDate.toISOString().split('T')[0]);
    }
    
    return dates;
  };

  useEffect(() => {
    const fetchPendingShipments = async () => {
      try {
        setLoading(true);
        // Fetch shipments that need classification
        const response = await api.getShipments({ status: 'pending_classification' });
        setShipments(response.shipments || []);
      } catch (error) {
        console.error('Error fetching shipments:', error);
        showError(
          'Failed to Load Shipments',
          'Could not load shipments awaiting classification'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPendingShipments();
  }, []);

  // Real-time validation when form fields change
  useEffect(() => {
    if (selectedTier || selectedHub || decisionReason || justificationNote || attachedFiles.length > 0) {
      const validation = validateAssignmentRequirements();
      setValidationErrors(validation.errors);
    }
  }, [selectedTier, selectedHub, decisionReason, justificationNote, attachedFiles]);

  const currentShipment = useMemo(() => {
    return shipments.find(s => s.shipment_id === selectedShipment);
  }, [shipments, selectedShipment]);

  

  // Track price changes outside of render to avoid re-render loops
  useEffect(() => {
    if (!currentShipment || !selectedTier || !selectedHub) return;
    const pricing = calculateDynamicPricing(currentShipment, selectedTier, selectedHub);
    const key = `${currentShipment.shipment_id}-${selectedTier}-${selectedHub}`;
    const newPrice = pricing.total_price;
    setPriceHistory(prev => {
      const history = prev[key] || [];
      if (history.length > 0 && history[history.length - 1] === newPrice) {
        return prev;
      }
      return {
        ...prev,
        [key]: [...history, newPrice].slice(-7)
      };
    });
  }, [currentShipment, selectedTier, selectedHub]);

  // Smart hub defaulting based on lane
  const getDefaultHub = (shipment: ShipmentDetails) => {
    if (!shipment) return null;
    
    const isUKInvolved = shipment.sender_country === 'UK' || 
                        shipment.buyer_country === 'UK' ||
                        shipment.sender_country === 'United Kingdom' || 
                        shipment.buyer_country === 'United Kingdom';
    
    return isUKInvolved ? 'london' : 'paris';
  };

  // Auto-select hub when shipment changes
  useEffect(() => {
    if (currentShipment && selectedTier && selectedTier !== '1' && !selectedHub) {
      const defaultHub = getDefaultHub(currentShipment);
      if (defaultHub) {
        setSelectedHub(defaultHub);
      }
    }
  }, [currentShipment, selectedTier, selectedHub]);

  // Reset hub selection when tier changes to T1
  useEffect(() => {
    if (selectedTier === '1') {
      setSelectedHub(null);
    }
  }, [selectedTier]);

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRiskBadges = (shipment: ShipmentDetails) => {
    const badges = [];

    // High value threshold
    if (shipment.declared_value > 10000) {
      badges.push({ text: 'High Value', color: 'bg-red-100 text-red-700', icon: DollarSign });
    } else if (shipment.declared_value > 5000) {
      badges.push({ text: 'Medium Value', color: 'bg-yellow-100 text-yellow-700', icon: DollarSign });
    }

    // Fragility
    if (shipment.fragility_score && shipment.fragility_score > 7) {
      badges.push({ text: 'Fragile', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle });
    }

    // Customs (UK/EU)
    if (shipment.customs_required || 
        (shipment.sender_country === 'UK' && shipment.buyer_country !== 'UK') ||
        (shipment.sender_country !== 'UK' && shipment.buyer_country === 'UK')) {
      badges.push({ text: 'Customs Required', color: 'bg-blue-100 text-blue-700', icon: Globe });
    }

    // Unusual dimensions
    if (shipment.dimensions) {
      const { length, width, height } = shipment.dimensions;
      const maxDimension = Math.max(length, width, height);
      if (maxDimension > 100 || (length * width * height) > 50000) {
        badges.push({ text: 'Oversized', color: 'bg-purple-100 text-purple-700', icon: Package });
      }
    }

    // Heavy weight
    if (shipment.weight > 20) {
      badges.push({ text: 'Heavy', color: 'bg-gray-100 text-gray-700', icon: Weight });
    }

    return badges;
  };

  const getHubCapacity = (hubId: string, tier: string) => {
    const hub = hubs.find(h => h.id === hubId);
    if (!hub) return null;

    switch (tier) {
      case '1':
        return null; // T1 requires no Hub resources
      case '2':
        return { available: hub.available_tags, type: 'Tags' };
      case '3':
        return { available: hub.available_nfc, type: 'NFC chips', sewing: hub.sewing_capacity };
      default:
        return null;
    }
  };

  const getAvailabilityStatus = (hubId: string, tier: string) => {
    const hub = hubs.find(h => h.id === hubId);
    if (!hub || tier === '1') return null;

    if (tier === '2') {
      // Tag availability
      if (hub.available_tags <= 0) {
        return { status: 'red', message: 'No tags available' };
      } else if (hub.available_tags <= hub.tag_threshold) {
        return { status: 'amber', message: `Low tag stock (${hub.available_tags} remaining)` };
      } else {
        return { status: 'green', message: `${hub.available_tags} tags available` };
      }
    } else if (tier === '3') {
      // NFC and sewing availability
      const nfcStatus = hub.available_nfc <= 0 ? 'red' : 
                       hub.available_nfc <= hub.nfc_threshold ? 'amber' : 'green';
      
      const sewingAvailable = hub.sewing_capacity - hub.sewing_booked;
      const sewingStatus = sewingAvailable <= 0 ? 'red' : 
                          sewingAvailable <= 10 ? 'amber' : 'green';
      
      // Overall status is worst of the two
      const overallStatus = nfcStatus === 'red' || sewingStatus === 'red' ? 'red' :
                           nfcStatus === 'amber' || sewingStatus === 'amber' ? 'amber' : 'green';
      
      let message = `${hub.available_nfc} NFC chips, ${sewingAvailable} sewing slots`;
      if (overallStatus === 'red') {
        message = sewingAvailable <= 0 ? 'No sewing capacity' : 'No NFC chips available';
      }
      
      return { 
        status: overallStatus, 
        message,
        nfcCount: hub.available_nfc,
        sewingAvailable,
        nextAvailable: hub.next_available_day
      };
    }

    return null;
  };

  const switchToAlternativeHub = () => {
    const currentHub = selectedHub;
    const alternativeHub = currentHub === 'paris' ? 'london' : 'paris';
    setSelectedHub(alternativeHub);
  };

  // Determine White Glove P2P eligibility
  const isWhiteGloveEligible = (shipment: ShipmentDetails, tier: string) => {
    if (!shipment) return false;
    
    // White Glove P2P criteria
    const highValue = shipment.declared_value > 10000; // >€10K requires White Glove
    const premiumTier = tier === '3'; // Tier 3 always uses White Glove
    const fragilityRequirement = shipment.fragility_score && shipment.fragility_score > 7;
    const premiumBrands = ['Rolex', 'Patek Philippe', 'Hermès', 'Chanel', 'Louis Vuitton'];
    const isPremiumBrand = premiumBrands.some(brand => 
      shipment.brand.toLowerCase().includes(brand.toLowerCase())
    );
    
    return highValue || premiumTier || fragilityRequirement || isPremiumBrand;
  };

  // Get DHL standard rates (simplified)
  const getDHLRate = (shipment: ShipmentDetails, tier: string) => {
    if (!shipment) return 0;
    
    // Simplified DHL pricing based on tier
    const dhlRates = {
      '1': 25, // DHL digital verification
      '2': 45, // DHL with tracking  
      '3': 85  // DHL premium with insurance
    };
    
    return dhlRates[tier as keyof typeof dhlRates] || 45;
  };

  // Google Flights-style dynamic pricing calculation (White Glove P2P only)
  function calculateDynamicPricing(
    shipment: ShipmentDetails,
    tier: string,
    hubId: string,
    forceMethod?: 'white_glove_p2p' | 'dhl_standard',
    skipAlternatives: boolean = false
  ): PricingBreakdown {
    if (!shipment) {
      return {
        base_price: 0,
        distance_factor: 0,
        hub_demand_factor: 0,
        tier_complexity: 0,
        seasonal_adjustment: 0,
        capacity_surge: 0,
        total_price: 0,
        currency: 'EUR',
        shipping_method: 'dhl_standard',
        is_white_glove_eligible: false
      };
    }

    const whiteGloveEligible = isWhiteGloveEligible(shipment, tier);
    const shippingMethod = forceMethod || (whiteGloveEligible ? 'white_glove_p2p' : 'dhl_standard');
    
    // If using DHL, return simple pricing
    if (shippingMethod === 'dhl_standard') {
      const dhlRate = getDHLRate(shipment, tier);
      return {
        base_price: dhlRate,
        distance_factor: 0,
        hub_demand_factor: 0,
        tier_complexity: 0,
        seasonal_adjustment: 0,
        capacity_surge: 0,
        total_price: dhlRate,
        currency: 'EUR',
        shipping_method: 'dhl_standard',
        is_white_glove_eligible: whiteGloveEligible,
        dhl_rate: dhlRate
      };
    }

    const hub = hubs.find(h => h.id === hubId);
    
    // Base pricing by tier
    const basePrices = {
      '1': 50,  // Digital only
      '2': 150, // Tag + processing
      '3': 350  // NFC + sewing + premium
    };
    
    const basePrice = basePrices[tier as keyof typeof basePrices] || 100;

    // Distance factor (similar to flight distance pricing)
    const getDistance = (from: string, to: string) => {
      const distances: { [key: string]: number } = {
        'france-uk': 344, 'france-germany': 654, 'france-italy': 687,
        'uk-france': 344, 'uk-germany': 933, 'uk-italy': 1434,
        'germany-france': 654, 'germany-uk': 933, 'germany-italy': 522,
        'italy-france': 687, 'italy-uk': 1434, 'italy-germany': 522,
        'spain-france': 623, 'spain-uk': 1056, 'spain-germany': 1165,
        'netherlands-france': 431, 'netherlands-uk': 498, 'netherlands-germany': 358
      };
      
      const key = `${from.toLowerCase()}-${to.toLowerCase()}`;
      return distances[key] || distances[`${to.toLowerCase()}-${from.toLowerCase()}`] || 500;
    };

    const distance = getDistance(shipment.sender_country, shipment.buyer_country);
    const distanceFactor = Math.round(distance * 0.08); // €0.08 per km

    // Hub demand factor (like flight hub pricing)
    const hubDemandFactors = {
      'paris': 1.0,  // Standard EU hub
      'london': 1.15 // Brexit/customs premium
    };
    const hubFactor = Math.round(basePrice * (hubDemandFactors[hubId as keyof typeof hubDemandFactors] - 1));

    // Tier complexity multiplier
    const tierComplexity = {
      '1': 0,   // No additional complexity
      '2': 25,  // Tag handling
      '3': 75   // NFC + sewing complexity
    };
    const complexityFee = tierComplexity[tier as keyof typeof tierComplexity] || 0;

    // Seasonal adjustment (like flight seasonality)
    const currentDate = new Date();
    const month = currentDate.getMonth();
    const seasonalMultipliers = {
      0: 0.9,   // January - low demand
      1: 0.9,   // February
      2: 1.0,   // March
      3: 1.1,   // April - spring peak
      4: 1.15,  // May - peak
      5: 1.2,   // June - summer peak
      6: 1.25,  // July - highest
      7: 1.2,   // August
      8: 1.1,   // September
      9: 1.05,  // October
      10: 0.95, // November
      11: 1.3   // December - holiday rush
    };
    const seasonalAdjustment = Math.round(basePrice * ((seasonalMultipliers[month as keyof typeof seasonalMultipliers] || 1) - 1));

    // Capacity surge pricing (like Uber surge)
    let capacitySurge = 0;
    if (hub) {
      const availability = getAvailabilityStatus(hubId, tier);
      if (availability?.status === 'red') {
        capacitySurge = Math.round(basePrice * 0.4); // 40% surge for no capacity
      } else if (availability?.status === 'amber') {
        capacitySurge = Math.round(basePrice * 0.15); // 15% surge for tight capacity
      }
    }

    const totalPrice = basePrice + distanceFactor + hubFactor + complexityFee + seasonalAdjustment + capacitySurge;

    // Generate alternative options (like Google Flights alternatives)
    const alternatives = [];
    
    if (!skipAlternatives) {
      // Alternative hub option for White Glove
      const altHub = hubId === 'paris' ? 'london' : 'paris';
      const altHubPricing = calculateDynamicPricing(shipment, tier, altHub, 'white_glove_p2p', true);
      if (altHubPricing.total_price !== totalPrice) {
        alternatives.push({
          hub: altHub === 'paris' ? 'Paris Hub' : 'London Hub',
          tier: tier,
          price: altHubPricing.total_price,
          savings: totalPrice - altHubPricing.total_price,
          delivery_impact: altHubPricing.total_price < totalPrice ? '+0 days' : '+1 day',
          shipping_method: 'White Glove P2P'
        });
      }

      // DHL alternative if White Glove is not mandatory
      if (!isWhiteGloveEligible(shipment, tier) || shipment.declared_value < 15000) {
        const dhlPricing = calculateDynamicPricing(shipment, tier, hubId, 'dhl_standard', true);
        alternatives.push({
          hub: 'DHL Network',
          tier: tier,
          price: dhlPricing.total_price,
          savings: totalPrice - dhlPricing.total_price,
          delivery_impact: '+1-2 days',
          shipping_method: 'DHL Standard'
        });
      }

      // Alternative tier options
      if (tier !== '2') {
        const tier2Pricing = calculateDynamicPricing(shipment, '2', hubId, 'white_glove_p2p', true);
        alternatives.push({
          hub: hub?.name || '',
          tier: '2',
          price: tier2Pricing.total_price,
          savings: totalPrice - tier2Pricing.total_price,
          delivery_impact: tier === '3' ? '+0 days' : '+1 day',
          shipping_method: 'White Glove P2P'
        });
      }
    }

    return {
      base_price: basePrice,
      distance_factor: distanceFactor,
      hub_demand_factor: hubFactor,
      tier_complexity: complexityFee,
      seasonal_adjustment: seasonalAdjustment,
      capacity_surge: capacitySurge,
      total_price: totalPrice,
      currency: 'EUR',
      shipping_method: 'white_glove_p2p',
      is_white_glove_eligible: whiteGloveEligible,
      dhl_rate: getDHLRate(shipment, tier),
      alternative_options: alternatives.filter(alt => alt.savings > 0)
    };
  }

  const getTierRecommendation = (shipment: ShipmentDetails) => {
    if (!shipment) return null;

    // Value-based recommendations
    if (shipment.declared_value > 50000) {
      return { tier: '3', reason: `high value (${formatCurrency(shipment.declared_value, shipment.currency)})` };
    }
    if (shipment.declared_value > 15000) {
      return { tier: '3', reason: `value > €15K` };
    }
    if (shipment.declared_value > 5000) {
      return { tier: '2', reason: `value > €5K` };
    }

    // Fragility-based recommendations
    if (shipment.fragility_score && shipment.fragility_score > 8) {
      return { tier: '3', reason: 'high fragility score' };
    }
    if (shipment.fragility_score && shipment.fragility_score > 6) {
      return { tier: '2', reason: 'moderate fragility' };
    }

    // Brand policy (example brands that require higher tiers)
    const premiumBrands = ['Rolex', 'Patek Philippe', 'Hermès', 'Chanel', 'Louis Vuitton'];
    if (premiumBrands.some(brand => shipment.brand.toLowerCase().includes(brand.toLowerCase()))) {
      return { tier: '3', reason: 'premium brand policy' };
    }

    // Customs/marketplace rules
    if (shipment.customs_required || 
        (shipment.sender_country === 'UK' && shipment.buyer_country !== 'UK') ||
        (shipment.sender_country !== 'UK' && shipment.buyer_country === 'UK')) {
      return { tier: '2', reason: 'customs requirements' };
    }

    // Default recommendation for low-value, low-risk items
    if (shipment.declared_value < 1000 && (!shipment.fragility_score || shipment.fragility_score < 4)) {
      return { tier: '1', reason: 'low value, low risk' };
    }

    return { tier: '2', reason: 'standard processing recommended' };
  };

  // Price tracking and alerts (Google Flights style)
  const trackPrice = (shipment: ShipmentDetails, tier: string, hub: string, price: number) => {
    const key = `${shipment.shipment_id}-${tier}-${hub}`;
    setPriceHistory(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), price].slice(-7) // Keep last 7 price points
    }));
  };

  const getPriceTrend = (shipment: ShipmentDetails, tier: string, hub: string) => {
    const key = `${shipment.shipment_id}-${tier}-${hub}`;
    const history = priceHistory[key] || [];
    if (history.length < 2) return null;
    
    const current = history[history.length - 1];
    const previous = history[history.length - 2];
    const change = current - previous;
    const changePercent = Math.round((change / previous) * 100);
    
    return {
      change,
      changePercent,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      lowest: Math.min(...history),
      highest: Math.max(...history)
    };
  };

  // File upload validation and handling
  const validateFile = (file: File): string | null => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain'
    ];

    if (file.size > maxSize) {
      return `File "${file.name}" is too large. Maximum size is 10MB.`;
    }

    if (!allowedTypes.includes(file.type)) {
      return `File "${file.name}" has unsupported format. Please use images or PDF files.`;
    }

    return null;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const errors: string[] = [];
    const validFiles: File[] = [];

    files.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    setUploadErrors(errors);
    setAttachedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'application/pdf') return '📄';
    return '📎';
  };

  const reasonOptions = [
    { value: 'client_request', label: 'Client Request', description: 'Specific client requirement or request' },
    { value: 'brand_policy', label: 'Brand Policy', description: 'Brand guidelines mandate this tier' },
    { value: 'risk_profile', label: 'Risk Profile', description: 'Item value/fragility requires this tier' },
    { value: 'ops_decision', label: 'Operations Decision', description: 'Operational considerations (capacity, routing)' },
    { value: 'other', label: 'Other', description: 'Other business justification' }
  ];

  // Comprehensive validation that must pass to enable "Assign"
  const validateAssignmentRequirements = (): { valid: boolean; errors: {[key: string]: string} } => {
    const errors: {[key: string]: string} = {};

    // 1. One Tier is selected
    if (!selectedTier) {
      errors.tier = 'Please select a tier (1, 2, or 3)';
    }

    // 2. Hub selected (T2/T3 only)
    if (selectedTier && (selectedTier === '2' || selectedTier === '3') && !selectedHub) {
      errors.hub = `Hub selection is required for ${tiers.find(t => t.id === selectedTier)?.name}`;
    }

    // 3. Availability is Green/Amber; if Red, user must pick alternative or override as ops_admin
    if (selectedTier && selectedHub && (selectedTier === '2' || selectedTier === '3')) {
      const availability = getAvailabilityStatus(selectedHub, selectedTier);
      if (availability?.status === 'red') {
        if (userRole === 'ops_admin') {
          errors.availability = 'Red availability detected. Admin override required to proceed.';
        } else {
          errors.availability = 'Insufficient resources. Please select an alternative or contact ops_admin for override.';
        }
      }
    }

    // 4. Reason chosen
    if (!decisionReason) {
      errors.reason = 'Please select a classification reason';
    }

    // 5. Note present
    if (!justificationNote.trim()) {
      errors.note = 'Please provide a justification note explaining your decision';
    } else if (justificationNote.trim().length < 10) {
      errors.note = 'Justification note must be at least 10 characters';
    }

    // 6. At least one attachment uploaded successfully (EDGE CASE: No evidence)
    if (attachedFiles.length === 0) {
      errors.attachments = 'Evidence is required for audit - please upload at least one supporting document';
    }

    // Check for upload errors
    if (uploadErrors.length > 0) {
      errors.attachments = `Upload errors: ${uploadErrors.join(', ')}`;
    }

    // EDGE CASE: Both hubs unavailable
    if (selectedTier && selectedTier !== '1' && checkBothHubsUnavailable(selectedTier)) {
      errors.availability = 'All hubs lack capacity. Select delay date or request admin override.';
    }

    // EDGE CASE: High-value T3 requires dual approval
    if (currentShipment && selectedTier === '3' && requiresDualApproval(currentShipment, selectedTier)) {
      if (userRole !== 'ops_admin') {
        errors.approval = 'High-value Tier 3 assignment requires ops_admin approval';
      } else if (!secondApprover || !approvalJustification) {
        errors.approval = 'Dual approval required: select second approver and provide justification';
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  };

  const isFormValid = () => {
    const validation = validateAssignmentRequirements();
    return validation.valid;
  };

  const validateAndUpdateErrors = () => {
    const validation = validateAssignmentRequirements();
    setValidationErrors(validation.errors);
    return validation.valid;
  };

  // Core validation rules (enforced) - these BLOCK assignment
  const validateCoreRules = (): { valid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!currentShipment || !selectedTier) {
      errors.push('Invalid shipment or tier selection');
      return { valid: false, errors, warnings };
    }

    // CORE RULE 1: T1 → needsHub=false. No Tag/NFC reservations.
    if (selectedTier === '1') {
      if (selectedHub) {
        warnings.push('Tier 1 does not require hub selection (remote verification only)');
      }
      // T1 is always valid from resource perspective
      return { valid: true, errors, warnings };
    }

    // CORE RULE 2 & 3: T2/T3 require hub selection
    if (!selectedHub) {
      errors.push('Hub selection required for Tier 2 and Tier 3');
      return { valid: false, errors, warnings };
    }

    const selectedHubData = hubs.find(h => h.id === selectedHub);
    if (!selectedHubData) {
      errors.push('Invalid hub selection');
      return { valid: false, errors, warnings };
    }

    // CORE RULE 2: T2 → require Tag stock > 0 at chosen Hub
    if (selectedTier === '2') {
      if (selectedHubData.available_tags <= 0) {
        errors.push(`BLOCKED: No Tag inventory available at ${selectedHubData.name}. Cannot assign Tier 2.`);
        
        // Emit failure event for resource block
        if (currentShipment) {
          emitEvent('tier.assignment.failed', {
            shipmentId: currentShipment.shipment_id,
            attemptedTier: selectedTier,
            hubId: selectedHub,
            reason: 'no_tag',
            actorId: 'current_user' // TODO: Get from auth context
          });
        }
      } else if (selectedHubData.available_tags <= selectedHubData.tag_threshold) {
        warnings.push(`Low Tag inventory at ${selectedHubData.name} (${selectedHubData.available_tags} remaining)`);
      }
    }

    // CORE RULE 3: T3 → require NFC stock > 0 and sewing capacity > 0
    if (selectedTier === '3') {
      if (selectedHubData.available_nfc <= 0) {
        errors.push(`BLOCKED: No NFC chip inventory available at ${selectedHubData.name}. Cannot assign Tier 3.`);
        
        // Emit failure event for NFC shortage
        if (currentShipment) {
          emitEvent('tier.assignment.failed', {
            shipmentId: currentShipment.shipment_id,
            attemptedTier: selectedTier,
            hubId: selectedHub,
            reason: 'no_nfc',
            actorId: 'current_user' // TODO: Get from auth context
          });
        }
      }
      
      const availableSewingSlots = selectedHubData.sewing_slots_per_day - selectedHubData.sewing_booked;
      if (availableSewingSlots <= 0) {
        errors.push(`BLOCKED: No sewing capacity available at ${selectedHubData.name}. Cannot assign Tier 3.`);
        
        // Emit failure event for sewing capacity shortage
        if (currentShipment) {
          emitEvent('tier.assignment.failed', {
            shipmentId: currentShipment.shipment_id,
            attemptedTier: selectedTier,
            hubId: selectedHub,
            reason: 'no_sewing',
            actorId: 'current_user' // TODO: Get from auth context
          });
        }
      }

      // Warnings for tight resources
      if (selectedHubData.available_nfc > 0 && selectedHubData.available_nfc <= selectedHubData.nfc_threshold) {
        warnings.push(`Low NFC inventory at ${selectedHubData.name} (${selectedHubData.available_nfc} remaining)`);
      }
      if (availableSewingSlots > 0 && availableSewingSlots <= 2) {
        warnings.push(`Limited sewing capacity at ${selectedHubData.name} (${availableSewingSlots} slots remaining today)`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  };

  // Business rule validations (advisory warnings, don't block)
  const validateBusinessRules = (): string[] => {
    const warnings: string[] = [];
    
    if (!currentShipment || !selectedTier) return warnings;

    if (selectedTier === '3' && currentShipment.declared_value < 5000) {
      warnings.push('Tier 3 typically not justified for items under €5,000');
    }

    if (selectedTier === '1' && currentShipment.declared_value > 15000) {
      warnings.push('Tier 1 not recommended for high-value items (>€15,000)');
    }

    if (selectedTier === '1' && currentShipment.fragility_score && currentShipment.fragility_score > 8) {
      warnings.push('Tier 1 not suitable for highly fragile items');
    }

    return warnings;
  };

  // Combined validation for assignment
  const validateTierAssignment = (): { valid: boolean; errors: string[]; warnings: string[] } => {
    const coreValidation = validateCoreRules();
    const businessWarnings = validateBusinessRules();
    
    return {
      valid: coreValidation.valid,
      errors: coreValidation.errors,
      warnings: [...coreValidation.warnings, ...businessWarnings]
    };
  };

  const handleSuggestChange = async () => {
    if (!currentShipment || !suggestionNote.trim()) {
      showError('Missing Information', 'Please provide a suggestion note');
      return;
    }

    try {
      await api.submitTierSuggestion({
        shipment_id: currentShipment.shipment_id,
        suggested_tier: selectedTier || '',
        suggested_hub: selectedHub || undefined,
        suggestion_note: suggestionNote,
        suggested_reason: decisionReason,
        attachments: attachedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }))
      });

      showSuccess(
        'Suggestion Submitted',
        'Your tier suggestion has been sent to the Ops team for review',
        3000
      );

      setShowSuggestDialog(false);
      setSuggestionNote('');
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      showError(
        'Suggestion Failed',
        error instanceof Error ? error.message : 'Could not submit suggestion'
      );
    }
  };

  const handleConfirmClassification = async () => {
    if (!selectedShipment || !selectedTier || !currentShipment) {
      return;
    }

    // For Tier 2 and 3, a hub is required (unless both hubs unavailable)
    if ((selectedTier === '2' || selectedTier === '3') && !selectedHub) {
      // Check if both hubs are unavailable
      if (checkBothHubsUnavailable(selectedTier)) {
        setShowDelayDialog(true);
        return;
      } else {
        return; // Normal hub selection required
      }
    }

    // EDGE CASE: High-value T3 requires dual approval
    if (requiresDualApproval(currentShipment, selectedTier)) {
      if (userRole !== 'ops_admin') {
        showError(
          'Authorization Required',
          'High-value Tier 3 assignments require ops_admin privileges'
        );
        return;
      }
      
      if (!secondApprover || !approvalJustification) {
        setShowDualApprovalDialog(true);
        return;
      }
    }

    // Validate all assignment requirements (this also updates inline errors)
    if (!validateAndUpdateErrors()) {
      const validation = validateAssignmentRequirements();
      const errorMessages = Object.values(validation.errors);
      
      // EDGE CASE: No attachments - specific audit message
      if (attachedFiles.length === 0) {
        showError(
          'Evidence Required for Audit',
          'All tier assignments must include supporting documentation for compliance and future disputes. Please upload at least one file.'
        );
        return;
      }
      
      showError(
        'Validation Failed',
        errorMessages.length > 0 ? errorMessages.join('. ') : 'Please complete all required fields before proceeding.'
      );
      return; // Preserve all form state - do not clear inputs or attachments
    }

    // Validate tier assignment rules (CORE RULES - ENFORCED)
    const validation = validateTierAssignment();
    if (!validation.valid) {
      // Emit failure event for resource constraint blocks during assignment attempt
      if (currentShipment && selectedTier && selectedHub) {
        const failureReason = getResourceFailureReason(selectedTier, selectedHub);
        if (failureReason) {
          emitEvent('tier.assignment.failed', {
            shipmentId: currentShipment.shipment_id,
            attemptedTier: selectedTier,
            hubId: selectedHub,
            reason: failureReason,
            actorId: 'current_user' // TODO: Get from auth context
          });
        }
      }
      
      showError(
        'Assignment Blocked',
        `Cannot assign tier due to resource constraints: ${validation.errors.join('. ')}`
      );
      return;
    }

    setConfirming(true);
    try {
      // Upload files first
      const uploadedFileUrls = [];
      for (const file of attachedFiles) {
        try {
          const uploadResult = await api.uploadImage(file);
          uploadedFileUrls.push({
            url: uploadResult.url,
            filename: file.name,
            type: file.type,
            size: file.size
          });
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          throw new Error(`Failed to upload ${file.name}`);
        }
      }

      // EDGE CASE: Use retry logic for network resilience
      setRetryAttempts(0);
      setLastError(null);
      
      const reservationResult = await retryReservation();

      // Emit tier.assigned success event
      emitEvent('tier.assigned', {
        shipmentId: selectedShipment,
        tier: selectedTier,
        hubId: selectedHub || null, // null for Tier 1
        actorId: 'current_user' // TODO: Get from auth context
      });

      showSuccess(
        'Tier Assignment Complete!',
        `Shipment ${currentShipment.reference_sku} successfully assigned to ${tiers.find(t => t.id === selectedTier)?.name}${selectedHub ? ` at ${hubs.find(h => h.id === selectedHub)?.name}` : ' (remote verification)'}`
      );

      // Redirect to Plan page after short delay
      setTimeout(() => {
        router.push(`/sprint-8/logistics/plan/${selectedShipment}`);
      }, 2000);

    } catch (error) {
      console.error('Error confirming classification:', error);
      
      // EDGE CASE: Handle network/API failures with retry option
      if (error instanceof Error && 
          (error.message.includes('network') || error.message.includes('timeout')) &&
          retryAttempts < 3) {
        setShowRetryDialog(true);
        setLastError(error.message);
        return; // Don't mark as failed yet
      }
      
      // Emit failure event for API/system errors
      if (currentShipment && selectedTier) {
        const failureReason = getResourceFailureReason(selectedTier, selectedHub || '');
        emitEvent('tier.assignment.failed', {
          shipmentId: currentShipment.shipment_id,
          attemptedTier: selectedTier,
          hubId: selectedHub || null,
          reason: failureReason || 'capacity_full',
          actorId: 'current_user', // TODO: Get from auth context
          error: error instanceof Error ? error.message : 'System error'
        });
      }
      
      showError(
        'Classification Failed',
        error instanceof Error ? error.message : 'Could not confirm classification. Shipment status unchanged until successful reservation.'
      );
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shipments awaiting classification...</p>
        </div>
      </div>
    );
  }

  // Shared styles - wallet-like design pattern matching new page
  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: "16px",
    border: "1px solid #e0e0e0",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 500,
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#1a1a1a",
  };

  const label: React.CSSProperties = {
    fontSize: "14px",
    fontWeight: 500,
    color: "#333",
    marginBottom: "8px",
    display: "block",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    fontSize: "14px",
    background: "#fff",
    transition: "border-color 0.2s",
  };

  const btnBase: React.CSSProperties = {
    padding: "12px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: "#000",
    color: "#fff",
  };

  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: "none",
    color: "#000",
    border: "1px solid #e0e0e0",
  };

  const banner = (type: "error" | "warn" | "success" | "info") => {
    const map = {
      error: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c", icon: AlertCircle },
      warn: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", icon: AlertTriangle },
      success: { bg: "#ecfdf5", border: "#d1fae5", color: "#065f46", icon: CheckCircle },
      info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af", icon: Info },
    }[type];
    const Icon = map.icon;
    return {
      background: map.bg,
      border: `1px solid ${map.border}`,
      borderRadius: "8px",
      padding: "16px",
      color: map.color,
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    } as React.CSSProperties;
  };

  return (
    <>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
      {/* Header */}
      <div style={{ margin: "32px 0" }}>
        <Link 
          href="/sprint-8/logistics/dashboard" 
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: "#666",
            textDecoration: "none",
            fontSize: "14px",
            marginBottom: "16px",
            transition: "color 0.2s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#000")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
        >
          <ArrowLeft style={{ width: "16px", height: "16px", marginRight: "4px" }} />
          Back to Dashboard
        </Link>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 300,
            marginBottom: "8px",
            letterSpacing: "-0.02em",
            color: "#1a1a1a",
          }}
        >
          Shipment Classification
        </h1>
        <p style={{ color: "#666", fontSize: "16px", lineHeight: "1.5", marginBottom: "16px" }}>
          Mandatory lock before planning or bookings. Confirm Tier and Hub to reserve resources.
        </p>
        <div style={banner("info")}>
          <Info size={16} />
          <div>
            <p style={{ fontWeight: "500", marginBottom: "4px" }}>
              Tier selection will reserve Hub resources and determine the next steps:
            </p>
            <p style={{ fontSize: "12px", lineHeight: "1.4", marginBottom: "2px" }}>
              • Sprint 4: unlocks Quote & Plan and WG/DHL steps
            </p>
            <p style={{ fontSize: "12px", lineHeight: "1.4", marginBottom: "2px" }}>
              • Sprint 1: sets expected passport path
            </p>
            <p style={{ fontSize: "12px", lineHeight: "1.4" }}>
              • Sprint 2: enables "Classification confirmed" in client timeline
            </p>
          </div>
        </div>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Shipment Selection */}
          <div>
            <div style={card}>
              <h2 style={sectionTitle}>
                <Package size={20} />
                Pending Classification ({shipments.length})
              </h2>
              
              {shipments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <CheckCircle style={{ width: "48px", height: "48px", color: "#16a34a", margin: "0 auto 16px auto" }} />
                  <p style={{ color: "#666" }}>All shipments classified!</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {shipments.map((shipment) => {
                    const isSelected = selectedShipment === shipment.shipment_id;
                    const riskBadges = getRiskBadges(shipment);
                    
                    return (
                      <div
                        key={shipment.shipment_id}
                        style={{
                          padding: "16px",
                          border: isSelected ? "2px solid #2563eb" : "1px solid #e0e0e0",
                          borderRadius: "12px",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          background: isSelected ? "#eff6ff" : "#fff",
                        }}
                        onClick={() => setSelectedShipment(shipment.shipment_id)}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = "#d1d5db";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = "#e0e0e0";
                          }
                        }}
                      >
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "space-between", 
                          marginBottom: "8px" 
                        }}>
                          <h3 style={{ fontWeight: 500, color: "#1a1a1a", fontSize: "14px" }}>
                            {shipment.reference_sku}
                          </h3>
                          {isSelected && <CheckCircle style={{ width: "20px", height: "20px", color: "#2563eb" }} />}
                        </div>
                        
                        <div style={{ fontSize: "14px", color: "#666", lineHeight: "1.4" }}>
                          <p style={{ marginBottom: "4px" }}>{shipment.brand}</p>
                          <p style={{ 
                            fontWeight: 600, 
                            color: "#16a34a", 
                            marginBottom: "4px" 
                          }}>
                            {formatCurrency(shipment.declared_value, shipment.currency)}
                          </p>
                          <p>{shipment.sender_city} → {shipment.buyer_city}</p>
                        </div>
                        
                        {riskBadges.length > 0 && (
                          <div style={{ 
                            display: "flex", 
                            flexWrap: "wrap", 
                            gap: "4px", 
                            marginTop: "8px" 
                          }}>
                            {riskBadges.slice(0, 2).map((badge, index) => {
                              const Icon = badge.icon;
                              const badgeColors = badge.color.includes('red') 
                                ? { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" }
                                : badge.color.includes('yellow')
                                ? { bg: "#fffbeb", border: "#fde68a", color: "#92400e" }
                                : { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af" };
                              
                              return (
                                <span
                                  key={index}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    background: badgeColors.bg,
                                    border: `1px solid ${badgeColors.border}`,
                                    color: badgeColors.color,
                                  }}
                                >
                                  <Icon style={{ width: "12px", height: "12px", marginRight: "4px" }} />
                                  {badge.text}
                                </span>
                              );
                            })}
                            {riskBadges.length > 2 && (
                              <span style={{ fontSize: "12px", color: "#666" }}>
                                +{riskBadges.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Classification Details */}
          <div>
            {currentShipment ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Product Summary */}
                <div style={card}>
                  <h2 style={sectionTitle}>
                    <Package size={20} />
                    Product Summary
                  </h2>
                  
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
                    gap: "24px" 
                  }}>
                    <div>
                      <h3 style={{ 
                        fontWeight: 500, 
                        color: "#1a1a1a", 
                        marginBottom: "12px",
                        fontSize: "16px"
                      }}>
                        Product Details
                      </h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px" }}>
                        <p>
                          <span style={{ color: "#666" }}>Shipment ID:</span> 
                          <span style={{ marginLeft: "8px", fontFamily: "monospace" }}>{currentShipment.shipment_id}</span>
                        </p>
                        <p>
                          <span style={{ color: "#666" }}>Reference:</span> 
                          <span style={{ marginLeft: "8px", fontFamily: "monospace" }}>{currentShipment.reference_sku}</span>
                        </p>
                        <p>
                          <span style={{ color: "#666" }}>Brand:</span> 
                          <span style={{ marginLeft: "8px" }}>{currentShipment.brand}</span>
                        </p>
                        <p>
                          <span style={{ color: "#666" }}>Value:</span> 
                          <span style={{ marginLeft: "8px", fontWeight: 600, color: "#16a34a" }}>
                            {formatCurrency(currentShipment.declared_value, currentShipment.currency)}
                          </span>
                        </p>
                        <p>
                          <span style={{ color: "#666" }}>Weight:</span> 
                          <span style={{ marginLeft: "8px" }}>{currentShipment.weight} {currentShipment.weight_unit}</span>
                        </p>
                        {currentShipment.dimensions && (
                          <p>
                            <span style={{ color: "#666" }}>Dimensions:</span> 
                            <span style={{ marginLeft: "8px" }}>
                              {currentShipment.dimensions.length}×{currentShipment.dimensions.width}×{currentShipment.dimensions.height} {currentShipment.dimensions.unit}
                            </span>
                          </p>
                        )}
                        {currentShipment.fragility_score && (
                          <p>
                            <span style={{ color: "#666" }}>Fragility:</span> 
                            <span style={{ marginLeft: "8px" }}>{currentShipment.fragility_score}/10</span>
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h3 style={{ 
                        fontWeight: 500, 
                        color: "#1a1a1a", 
                        marginBottom: "12px",
                        fontSize: "16px"
                      }}>
                        Route
                      </h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px" }}>
                        <div>
                          <p style={{ color: "#666" }}>From:</p>
                          <p style={{ fontWeight: 500, marginBottom: "2px" }}>{currentShipment.sender_name}</p>
                          <p>{currentShipment.sender_city}, {currentShipment.sender_country}</p>
                        </div>
                        <div style={{ paddingTop: "8px" }}>
                          <p style={{ color: "#666" }}>To:</p>
                          <p style={{ fontWeight: 500, marginBottom: "2px" }}>{currentShipment.buyer_name}</p>
                          <p>{currentShipment.buyer_city}, {currentShipment.buyer_country}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 style={{ 
                        fontWeight: 500, 
                        color: "#1a1a1a", 
                        marginBottom: "12px",
                        fontSize: "16px"
                      }}>
                        Timeline
                      </h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px" }}>
                        <p>
                          <span style={{ color: "#666" }}>Created:</span> 
                          <span style={{ marginLeft: "8px" }}>{formatDate(currentShipment.created_at)}</span>
                        </p>
                        <p>
                          <span style={{ color: "#666" }}>Priority:</span> 
                          <span style={{ marginLeft: "8px", textTransform: "capitalize" }}>{currentShipment.urgency_level}</span>
                        </p>
                        <p>
                          <span style={{ color: "#666" }}>Status:</span> 
                          <span style={{ marginLeft: "8px", textTransform: "capitalize", color: "#ca8a04" }}>
                            {currentShipment.status.replace('_', ' ')}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Risk Hints */}
                  {getRiskBadges(currentShipment).length > 0 && (
                    <div style={{
                      marginTop: "24px",
                      padding: "16px",
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: "12px"
                    }}>
                      <h4 style={{
                        fontWeight: 500,
                        color: "#92400e",
                        marginBottom: "8px",
                        display: "flex",
                        alignItems: "center",
                        fontSize: "14px"
                      }}>
                        <AlertTriangle style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                        Risk Indicators
                      </h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {getRiskBadges(currentShipment).map((badge, index) => {
                          const Icon = badge.icon;
                          const badgeColors = badge.color.includes('red') 
                            ? { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" }
                            : badge.color.includes('yellow')
                            ? { bg: "#fffbeb", border: "#fde68a", color: "#92400e" }
                            : badge.color.includes('green')
                            ? { bg: "#ecfdf5", border: "#d1fae5", color: "#065f46" }
                            : { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af" };
                          
                          return (
                            <span
                              key={index}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "6px 12px",
                                borderRadius: "16px",
                                fontSize: "14px",
                                fontWeight: 500,
                                background: badgeColors.bg,
                                border: `1px solid ${badgeColors.border}`,
                                color: badgeColors.color,
                              }}
                            >
                              <Icon style={{ width: "16px", height: "16px", marginRight: "4px" }} />
                              {badge.text}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tier Selection */}
                <div style={card}>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between", 
                    marginBottom: "16px" 
                  }}>
                    <h2 style={sectionTitle}>
                      <Shield size={20} />
                      Tier Choice (Manual)
                    </h2>
                    {validationErrors.tier && (
                      <span style={{
                        fontSize: "14px",
                        color: "#dc2626",
                        background: "#fef2f2",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "1px solid #fecaca"
                      }}>
                        {validationErrors.tier}
                      </span>
                    )}
                  </div>
                  
                  {/* Auto-suggestion */}
                  {currentShipment && (() => {
                    const recommendation = getTierRecommendation(currentShipment);
                    return recommendation ? (
                      <div style={{
                        marginBottom: "24px",
                        padding: "12px",
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: "8px"
                      }}>
                        <p style={{ fontSize: "14px", color: "#1e40af" }}>
                          <span style={{ fontWeight: 500 }}>💡 Recommended: </span>
                          Tier {recommendation.tier} due to {recommendation.reason}
                        </p>
                      </div>
                    ) : null;
                  })()}
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {tiers.map((tier) => {
                      const Icon = tier.icon;
                      const isSelected = selectedTier === tier.id;
                      
                      // Define tier colors inline
                      const tierColors = {
                        "text-blue-700": "#1d4ed8",
                        "text-purple-700": "#7c3aed", 
                        "text-yellow-700": "#a16207"
                      };
                      
                      const tierBgColors = {
                        "bg-blue-50": "#eff6ff",
                        "bg-purple-50": "#faf5ff",
                        "bg-yellow-50": "#fffbeb"
                      };
                      
                      const tierBorderColors = {
                        "border-blue-200": "#bfdbfe",
                        "border-purple-200": "#e9d5ff",
                        "border-yellow-200": "#fde68a"
                      };
                      
                      const tierSelectedBorderColors = {
                        "border-blue-500": "#3b82f6",
                        "border-purple-500": "#8b5cf6",
                        "border-yellow-500": "#eab308"
                      };

                      return (
                        <div
                          key={tier.id}
                          style={{
                            border: isSelected 
                              ? `2px solid ${tierSelectedBorderColors[tier.selectedBorderColor as keyof typeof tierSelectedBorderColors] || "#3b82f6"}` 
                              : `1px solid ${tierBorderColors[tier.borderColor as keyof typeof tierBorderColors] || "#d1d5db"}`,
                            borderRadius: "12px",
                            padding: "16px",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            background: isSelected 
                              ? tierBgColors[tier.selectedBgColor as keyof typeof tierBgColors] || "#f3f4f6"
                              : tierBgColors[tier.bgColor as keyof typeof tierBgColors] || "#f3f4f6",
                            boxShadow: isSelected 
                              ? "0 4px 6px -1px rgba(0, 0, 0, 0.1)" 
                              : "0 1px 3px rgba(0,0,0,0.1)"
                          }}
                          onClick={() => handleTierChange(tier.id)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
                            }
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start" }}>
                            {/* Radio Button */}
                            <div style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              marginRight: "16px", 
                              marginTop: "4px" 
                            }}>
                              <div style={{
                                width: "16px",
                                height: "16px",
                                border: isSelected 
                                  ? `2px solid ${tierSelectedBorderColors[tier.selectedBorderColor as keyof typeof tierSelectedBorderColors] || "#3b82f6"}`
                                  : `2px solid ${tierBorderColors[tier.borderColor as keyof typeof tierBorderColors] || "#d1d5db"}`,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isSelected 
                                  ? tierBgColors[tier.selectedBgColor as keyof typeof tierBgColors] || "#f3f4f6"
                                  : "#fff"
                              }}>
                                {isSelected && (
                                  <div style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    background: tierColors[tier.color as keyof typeof tierColors] || "#1d4ed8"
                                  }}></div>
                                )}
                              </div>
                            </div>
                            
                            {/* Tier Content */}
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                marginBottom: "8px" 
                              }}>
                                <Icon style={{ 
                                  width: "20px", 
                                  height: "20px", 
                                  marginRight: "8px", 
                                  color: tierColors[tier.color as keyof typeof tierColors] || "#1d4ed8" 
                                }} />
                                <h3 style={{ 
                                  fontWeight: 600, 
                                  color: tierColors[tier.color as keyof typeof tierColors] || "#1d4ed8",
                                  fontSize: "16px"
                                }}>
                                  {tier.name}
                                </h3>
                                <span style={{ 
                                  marginLeft: "8px", 
                                  fontSize: "14px", 
                                  color: tierColors[tier.color as keyof typeof tierColors] || "#1d4ed8" 
                                }}>
                                  ({tier.description})
                                </span>
                              </div>
                              
                              <p style={{ 
                                fontSize: "14px", 
                                color: "#666", 
                                marginBottom: "8px",
                                lineHeight: "1.4"
                              }}>
                                {tier.full_description}
                              </p>
                              
                              {/* Rules reminder */}
                              <p style={{ 
                                fontSize: "12px", 
                                color: "#9ca3af", 
                                fontStyle: "italic",
                                lineHeight: "1.3"
                              }}>
                                {tier.rules}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Pricing Section */}
                {selectedTier && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Processing Cost</h2>
                      <div className="text-sm text-gray-500">Prices updated in real-time</div>
                    </div>

                    {selectedTier !== '1' && selectedHub ? (
                      (() => {
                        const pricing = calculateDynamicPricing(currentShipment!, selectedTier, selectedHub);
                        const isWhiteGlove = pricing.shipping_method === 'white_glove_p2p';
                        return (
                          <div>
                            {/* Shipping Method Indicator */}
                            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className={`w-3 h-3 rounded-full mr-3 ${
                                    isWhiteGlove ? 'bg-purple-500' : 'bg-blue-500'
                                  }`}></div>
                                  <div>
                                    <h3 className="font-medium text-gray-900">
                                      {isWhiteGlove ? 'White Glove P2P Service' : 'DHL Standard Network'}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                      {isWhiteGlove 
                                        ? 'Premium peer-to-peer logistics with dynamic pricing'
                                        : 'Standard DHL rates with fixed pricing'
                                      }
                                    </p>
                                  </div>
                                </div>
                                {!isWhiteGlove && (
                                  <div className="text-right">
                                    <div className="text-sm text-blue-600 font-medium">Fixed Rate</div>
                                    <div className="text-xs text-blue-500">No surge pricing</div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Main Price Display */}
                            <div className={`flex items-center justify-between mb-4 p-4 border rounded-lg ${
                              isWhiteGlove 
                                ? 'bg-purple-50 border-purple-200' 
                                : 'bg-blue-50 border-blue-200'
                            }`}>
                              <div>
                                <div className="flex items-center">
                                  <div className="text-2xl font-bold text-blue-900">
                                    €{pricing.total_price}
                                  </div>
                                  {(() => {
                                    if (currentShipment) {
                                      const trend = getPriceTrend(currentShipment, selectedTier, selectedHub);
                                      return trend ? (
                                        <div className="ml-3 flex items-center">
                                          {trend.trend === 'up' && (
                                            <span className="text-red-600 text-sm flex items-center">
                                              ↗ +{trend.changePercent}%
                                            </span>
                                          )}
                                          {trend.trend === 'down' && (
                                            <span className="text-green-600 text-sm flex items-center">
                                              ↘ {trend.changePercent}%
                                            </span>
                                          )}
                                          {trend.trend === 'stable' && (
                                            <span className="text-gray-600 text-sm">→ Stable</span>
                                          )}
                                        </div>
                                      ) : null;
                                    }
                                    return null;
                                  })()}
                                </div>
                                <div className={`text-sm ${isWhiteGlove ? 'text-purple-700' : 'text-blue-700'}`}>
                                  {tiers.find(t => t.id === selectedTier)?.name} 
                                  {isWhiteGlove ? ` at ${hubs.find(h => h.id === selectedHub)?.name}` : ' via DHL Network'}
                                </div>
                                {currentShipment && (() => {
                                  const trend = getPriceTrend(currentShipment, selectedTier, selectedHub);
                                  return trend && (
                                    <div className="text-xs text-gray-600 mt-1">
                                      Recent range: €{trend.lowest} - €{trend.highest}
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="text-right">
                                {pricing.capacity_surge > 0 ? (
                                  <div>
                                    <div className="text-sm text-red-600 font-medium">⚡ High Demand</div>
                                    <div className="text-xs text-red-500">+€{pricing.capacity_surge} surge</div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="text-sm text-green-600">✓ Normal pricing</div>
                                    {pricing.seasonal_adjustment < 0 && (
                                      <div className="text-xs text-green-500">Off-peak discount</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Pricing Breakdown - Only for White Glove */}
                            {isWhiteGlove && (
                              <div className="space-y-2 mb-4">
                                <h3 className="font-medium text-gray-900 mb-2">White Glove P2P Price Breakdown</h3>
                                <div className="text-sm space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Base price ({tiers.find(t => t.id === selectedTier)?.name})</span>
                                    <span>€{pricing.base_price}</span>
                                  </div>
                                {pricing.distance_factor > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Distance ({currentShipment?.sender_country} → {currentShipment?.buyer_country})</span>
                                    <span>€{pricing.distance_factor}</span>
                                  </div>
                                )}
                                {pricing.hub_demand_factor > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Hub premium ({hubs.find(h => h.id === selectedHub)?.name})</span>
                                    <span>€{pricing.hub_demand_factor}</span>
                                  </div>
                                )}
                                {pricing.tier_complexity > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Processing complexity</span>
                                    <span>€{pricing.tier_complexity}</span>
                                  </div>
                                )}
                                {pricing.seasonal_adjustment !== 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">
                                      {pricing.seasonal_adjustment > 0 ? 'Peak season' : 'Off-peak discount'}
                                    </span>
                                    <span className={pricing.seasonal_adjustment > 0 ? 'text-red-600' : 'text-green-600'}>
                                      {pricing.seasonal_adjustment > 0 ? '+' : ''}€{pricing.seasonal_adjustment}
                                    </span>
                                  </div>
                                )}
                                {pricing.capacity_surge > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Capacity surge</span>
                                    <span className="text-red-600">+€{pricing.capacity_surge}</span>
                                  </div>
                                )}
                                  <div className="border-t pt-1 flex justify-between font-medium">
                                    <span>Total</span>
                                    <span>€{pricing.total_price}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* DHL Simple Pricing Display */}
                            {!isWhiteGlove && (
                              <div className="space-y-2 mb-4">
                                <h3 className="font-medium text-gray-900 mb-2">DHL Standard Rate</h3>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-sm text-blue-700 font-medium">Fixed DHL Rate</div>
                                      <div className="text-xs text-blue-600">No dynamic pricing • Standard processing</div>
                                    </div>
                                    <div className="text-lg font-bold text-blue-900">€{pricing.total_price}</div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Price Alerts */}
                            {currentShipment && (() => {
                              const trend = getPriceTrend(currentShipment, selectedTier, selectedHub);
                              const showAlert = trend && (trend.trend === 'up' && trend.changePercent > 10);
                              return showAlert && (
                                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                                      <div>
                                        <div className="font-medium text-yellow-800">Price Alert</div>
                                        <div className="text-sm text-yellow-700">
                                          Prices have increased {trend.changePercent}% recently. Consider booking soon or try alternatives.
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => setShowPriceAlert(true)}
                                      className="text-yellow-600 hover:text-yellow-700 text-sm underline"
                                    >
                                      Set Alert
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Alternative Options (Google Flights style) */}
                            {pricing.alternative_options && pricing.alternative_options.length > 0 && (
                              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <h3 className="font-medium text-green-800 mb-3 flex items-center">
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  Save Money - Alternative Options
                                </h3>
                                <div className="space-y-2">
                                  {pricing.alternative_options.map((option, index) => (
                                    <div key={index} className="flex items-center justify-between bg-white p-3 rounded border">
                                      <div>
                                        <div className="font-medium text-sm">
                                          Tier {option.tier} • {option.hub}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                          {option.shipping_method} • Delivery: {option.delivery_impact}
                                        </div>
                                        {option.shipping_method === 'DHL Standard' && (
                                          <div className="text-xs text-blue-600 mt-1">✓ Fixed pricing • No surge</div>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div className="font-bold text-green-700">€{option.price}</div>
                                        <div className="text-xs text-green-600">
                                          Save €{option.savings}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : selectedTier === '1' ? (
                      // Tier 1 pricing (no hub needed)
                      (() => {
                        const pricing = calculateDynamicPricing(currentShipment!, selectedTier, 'paris'); // Dummy hub for calculation
                        return (
                          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div>
                              <div className="text-2xl font-bold text-blue-900">€{pricing.total_price}</div>
                              <div className="text-sm text-blue-700">Remote verification only</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-green-600">✓ No surge pricing</div>
                              <div className="text-xs text-green-500">Always available</div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Select a hub to see pricing</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Hub Selection */}
                {selectedTier && selectedTier !== '1' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-gray-900">Select Hub</h2>
                        {validationErrors.hub && (
                          <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                            {validationErrors.hub}
                          </span>
                        )}
                        {validationErrors.availability && (
                          <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                            {validationErrors.availability}
                          </span>
                        )}
                      </div>
                      {currentShipment && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Lane default: </span>
                          {getDefaultHub(currentShipment) === 'paris' ? 'Paris (EU↔EU)' : 'London (UK involved)'}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      {selectedTier === '2' ? 'Required for tag inventory and authenticator access.' : 
                       selectedTier === '3' ? 'Required for NFC inventory, sewing capacity, and authenticator access.' : ''}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {hubs.map((hub) => {
                        const Icon = hub.icon;
                        const isSelected = selectedHub === hub.id;
                        const availability = getAvailabilityStatus(hub.id, selectedTier);
                        const isDefault = currentShipment && getDefaultHub(currentShipment) === hub.id;
                        
                        return (
                          <div
                            key={hub.id}
                            className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setSelectedHub(hub.id)}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center">
                                <Icon className="h-5 w-5 text-blue-600 mr-2" />
                                <div>
                                  <div className="flex items-center">
                                    <h3 className="font-semibold text-gray-900">{hub.name}</h3>
                                    {isDefault && (
                                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">{hub.city}, {hub.country}</p>
                                </div>
                              </div>
                              {isSelected && <CheckCircle className="h-5 w-5 text-blue-600" />}
                            </div>
                            
                            {/* Live Availability Panel */}
                            {availability && (
                              <div className={`mt-3 p-3 rounded-lg border ${
                                availability.status === 'green' ? 'bg-green-50 border-green-200' :
                                availability.status === 'amber' ? 'bg-yellow-50 border-yellow-200' :
                                'bg-red-50 border-red-200'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <div className={`w-3 h-3 rounded-full mr-2 ${
                                      availability.status === 'green' ? 'bg-green-500' :
                                      availability.status === 'amber' ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}></div>
                                    <span className={`text-sm font-medium ${
                                      availability.status === 'green' ? 'text-green-700' :
                                      availability.status === 'amber' ? 'text-yellow-700' :
                                      'text-red-700'
                                    }`}>
                                      {availability.status === 'green' ? 'Available' :
                                       availability.status === 'amber' ? 'Tight' : 'Insufficient'}
                                    </span>
                                  </div>
                                </div>
                                
                                <p className={`text-sm mt-1 ${
                                  availability.status === 'green' ? 'text-green-600' :
                                  availability.status === 'amber' ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  {availability.message}
                                </p>
                                
                                {/* Detailed T3 info */}
                                {selectedTier === '3' && availability.nfcCount !== undefined && (
                                  <div className="mt-2 text-xs text-gray-600">
                                    <p>• NFC chips: {availability.nfcCount}</p>
                                    <p>• Sewing slots: {availability.sewingAvailable}/{hub.sewing_capacity}</p>
                                    <p>• Next available: {new Date(availability.nextAvailable).toLocaleDateString()}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Alternative Actions for Insufficient Resources */}
                    {selectedHub && selectedTier && (() => {
                      const availability = getAvailabilityStatus(selectedHub, selectedTier);
                      return availability?.status === 'red' ? (
                        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                          <h3 className="font-medium text-red-800 mb-3 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Insufficient Resources - Choose Alternative
                          </h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Switch Hub */}
                            <button
                              onClick={switchToAlternativeHub}
                              className="flex items-center justify-center px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                            >
                              <Truck className="h-4 w-4 mr-2" />
                              Switch Hub
                            </button>
                            
                            {/* Transfer Stock */}
                            <button
                              onClick={() => setShowTransferDialog(true)}
                              className="flex items-center justify-center px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                            >
                              <Package className="h-4 w-4 mr-2" />
                              Transfer Stock
                            </button>
                            
                            {/* Delay */}
                            <button
                              onClick={() => setShowDelayDialog(true)}
                              className="flex items-center justify-center px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Delay
                            </button>
                            
                            {/* Admin Override */}
                            <button
                              onClick={() => setShowAdminOverride(true)}
                              className="flex items-center justify-center px-3 py-2 bg-yellow-100 border border-yellow-300 rounded-lg text-sm hover:bg-yellow-200 transition-colors text-yellow-800"
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Admin Override
                            </button>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Tier 1 No Hub Required Notice */}
                {selectedTier === '1' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center">
                      <Info className="h-5 w-5 text-blue-600 mr-2" />
                      <div>
                        <h3 className="font-medium text-gray-900">No Hub Required</h3>
                        <p className="text-sm text-gray-600">Tier 1 uses remote verification only - no physical hub resources needed.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reason & Attachments (Mandatory) */}
                {selectedTier && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Decision Justification</h2>
                      <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                        Required
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-6">
                      All tier decisions must be documented for audit purposes and future dispute resolution.
                    </p>

                    <div className="space-y-6">
                      {/* Reason Selection */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Reason for Classification *
                          </label>
                          {validationErrors.reason && (
                            <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                              {validationErrors.reason}
                            </span>
                          )}
                        </div>
                        <select
                          value={decisionReason}
                          onChange={(e) => setDecisionReason(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select a reason...</option>
                          {reasonOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {decisionReason && (
                          <p className="mt-1 text-sm text-gray-600">
                            {reasonOptions.find(opt => opt.value === decisionReason)?.description}
                          </p>
                        )}
                      </div>

                      {/* Justification Note */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Justification Note *
                          </label>
                          {validationErrors.note && (
                            <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                              {validationErrors.note}
                            </span>
                          )}
                        </div>
                        <textarea
                          value={justificationNote}
                          onChange={(e) => setJustificationNote(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                          placeholder={`Concise explanation for choosing ${selectedTier ? tiers.find(t => t.id === selectedTier)?.name : 'this tier'}${selectedHub ? ` at ${hubs.find(h => h.id === selectedHub)?.name}` : ''}...`}
                        />
                        <div className="mt-1 flex justify-between text-sm text-gray-500">
                          <span>Be specific about why this tier and hub combination is appropriate</span>
                          <span>{justificationNote.length}/500</span>
                        </div>
                      </div>

                      {/* File Upload */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Supporting Documents *
                          </label>
                          {validationErrors.attachments && (
                            <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                              {validationErrors.attachments}
                            </span>
                          )}
                        </div>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                          <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.txt"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="file-upload"
                          />
                          <label htmlFor="file-upload" className="cursor-pointer">
                            <div className="text-gray-400 mb-2">
                              <Upload className="h-8 w-8 mx-auto" />
                            </div>
                            <p className="text-sm text-gray-600 font-medium">Click to upload files</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Images, PDF, or text files • Max 10MB each
                            </p>
                          </label>
                        </div>

                        {/* Upload Guidelines */}
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <h4 className="text-sm font-medium text-blue-800 mb-2">Required Evidence Examples:</h4>
                          <ul className="text-xs text-blue-700 space-y-1">
                            <li>• Client Request: Email screenshot, chat log, signed request</li>
                            <li>• Brand Policy: Brand guideline document, policy excerpt</li>
                            <li>• Risk Profile: Product photos, valuation certificate, fragility assessment</li>
                            <li>• Ops Decision: Capacity report, routing analysis, cost breakdown</li>
                          </ul>
                        </div>

                        {/* Upload Errors */}
                        {uploadErrors.length > 0 && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <h4 className="text-sm font-medium text-red-800 mb-2">Upload Errors:</h4>
                            <ul className="text-xs text-red-700 space-y-1">
                              {uploadErrors.map((error, index) => (
                                <li key={index}>• {error}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Uploaded Files */}
                        {attachedFiles.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                              Attached Files ({attachedFiles.length})
                            </h4>
                            <div className="space-y-2">
                              {attachedFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                                  <div className="flex items-center">
                                    <span className="text-lg mr-2">{getFileIcon(file.type)}</span>
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                      <p className="text-xs text-gray-500">
                                        {formatFileSize(file.size)} • {file.type}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => removeFile(index)}
                                    className="text-red-600 hover:text-red-700 p-1"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {selectedTier && (selectedTier === '1' || selectedHub) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
                    
                    {/* Assignment Summary */}
                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-2">Assignment Summary</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><strong>Shipment:</strong> {currentShipment.reference_sku}</p>
                        <p><strong>Tier:</strong> {tiers.find(t => t.id === selectedTier)?.name}</p>
                        {selectedHub && <p><strong>Hub:</strong> {hubs.find(h => h.id === selectedHub)?.name}</p>}
                        {selectedTier === '1' && <p><strong>Processing:</strong> Remote verification only</p>}
                        {selectedTier !== '1' && (
                          <p><strong>Resources:</strong> 
                            {selectedTier === '2' && ' 1 Tag will be reserved'}
                            {selectedTier === '3' && ' 1 NFC chip + 1 sewing slot will be reserved'}
                          </p>
                        )}
                        <p><strong>Reason:</strong> {reasonOptions.find(r => r.value === decisionReason)?.label}</p>
                        <p><strong>Attachments:</strong> {attachedFiles.length} file(s)</p>
                      </div>
                      
                      {/* Tier Change Warning */}
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-gray-600">
                            <strong>Important:</strong> Changing tier later (from Plan or subsequent stages) will require re-validation 
                            of resource availability, re-reservation of new resources, and automatic release of currently reserved resources. 
                            A warning will be displayed before making such changes.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Validation Messages */}
                    {(() => {
                      const validation = validateTierAssignment();
                      const hasErrors = validation.errors.length > 0;
                      const hasWarnings = validation.warnings.length > 0;
                      
                      if (!hasErrors && !hasWarnings) return null;

                      return (
                        <div className="mb-4 space-y-3">
                          {/* Blocking Errors */}
                          {hasErrors && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <h4 className="font-medium text-red-800 mb-2 flex items-center">
                                <XCircle className="h-4 w-4 mr-2" />
                                Assignment Blocked
                              </h4>
                              <ul className="text-sm text-red-700 space-y-1">
                                {validation.errors.map((error, index) => (
                                  <li key={index}>• {error}</li>
                                ))}
                              </ul>
                              {hasErrors && selectedTier !== '1' && (
                                <div className="mt-3 pt-3 border-t border-red-200">
                                  <p className="text-sm text-red-800 font-medium mb-2">Available alternatives:</p>
                                  <div className="flex gap-2">
                                    {selectedHub && hubs.find(h => h.id !== selectedHub) && (
                                      <button
                                        onClick={() => {
                                          const otherHub = hubs.find(h => h.id !== selectedHub);
                                          if (otherHub) setSelectedHub(otherHub.id);
                                        }}
                                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded border border-red-300 hover:bg-red-200"
                                      >
                                        Switch to {hubs.find(h => h.id !== selectedHub)?.name}
                                      </button>
                                    )}
                                    {selectedTier === '3' && (
                                      <button
                                        onClick={() => handleTierChange('2')}
                                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded border border-red-300 hover:bg-red-200"
                                      >
                                        Downgrade to Tier 2
                                      </button>
                                    )}
                                    {(selectedTier === '2' || selectedTier === '3') && (
                                      <button
                                        onClick={() => {
                                          setSelectedTier('1');
                                          setSelectedHub(null);
                                        }}
                                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded border border-red-300 hover:bg-red-200"
                                      >
                                        Use Tier 1 (Remote)
                                      </button>
                                    )}
                                    {userRole === 'ops_admin' && (
                                      <button
                                        onClick={() => setShowOverrideDialog(true)}
                                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded border border-red-300 hover:bg-red-200"
                                      >
                                        Admin Override
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Advisory Warnings */}
                          {hasWarnings && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <h4 className="font-medium text-yellow-800 mb-2 flex items-center">
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Advisory Warnings
                              </h4>
                              <ul className="text-sm text-yellow-700 space-y-1">
                                {validation.warnings.map((warning, index) => (
                                  <li key={index}>• {warning}</li>
                                ))}
                              </ul>
                              <p className="text-xs text-yellow-600 mt-2">
                                These warnings don't block assignment but require justification.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between">
                      {/* Cancel/Back */}
                      <Link
                        href="/sprint-8/logistics/dashboard"
                        className="text-gray-600 hover:text-gray-700 font-medium flex items-center"
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to Dashboard
                      </Link>

                      <div className="flex items-center gap-3">
                        {/* Secondary Action - Suggest Change (for hub_tech) */}
                        {userRole === 'hub_tech' && (
                          <button
                            onClick={() => setShowSuggestDialog(true)}
                            disabled={!isFormValid()}
                            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Info className="h-4 w-4 mr-2" />
                            Suggest Change
                          </button>
                        )}

                        {/* Primary Action - Assign */}
                        <button
                          onClick={handleConfirmClassification}
                          disabled={confirming || !isFormValid()}
                          style={{
                            ...btnPrimary,
                            padding: "12px 24px",
                            fontSize: "16px",
                            fontWeight: 600,
                            background: confirming || !isFormValid() ? "#9ca3af" : "#16a34a",
                            cursor: confirming || !isFormValid() ? "not-allowed" : "pointer",
                            opacity: confirming || !isFormValid() ? 0.7 : 1
                          }}
                          onMouseEnter={(e) => {
                            if (!confirming && isFormValid()) {
                              e.currentTarget.style.background = "#15803d";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!confirming && isFormValid()) {
                              e.currentTarget.style.background = "#16a34a";
                            }
                          }}
                        >
                          {confirming ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              Assigning...
                            </>
                          ) : (
                            <>
                              <CheckCircle style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                              Assign Tier & Reserve Resources
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Select a Shipment</h2>
                <p className="text-gray-600">Choose a shipment from the list to begin classification</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

        {/* Transfer Stock Dialog */}
        {showTransferDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Transfer Stock</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transfer from {selectedHub === 'paris' ? 'London' : 'Paris'} Hub
                  </label>
                  <p className="text-sm text-gray-600">
                    Suggested: {selectedTier === '2' ? '50 tags' : '20 NFC chips'} by tomorrow
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowTransferDialog(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowTransferDialog(false);
                      showSuccess('Transfer Requested', 'Stock transfer initiated');
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Request Transfer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delay Dialog */}
        {showDelayDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delay Shipment</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">
                    Next available capacity: {selectedHub && hubs.find(h => h.id === selectedHub)?.next_available_day}
                  </p>
                  <p className="text-sm text-yellow-600 mt-2">
                    ⚠️ This may impact SLA by 1-2 days
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDelayDialog(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowDelayDialog(false);
                      showSuccess('Delay Scheduled', 'Shipment rescheduled to next available slot');
                    }}
                    className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    Schedule Delay
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Override Dialog */}
        {showAdminOverride && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Override</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deviation Reason
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    rows={3}
                    placeholder="Explain why this override is necessary..."
                  />
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    ⚠️ This action will be logged and requires ops_admin permissions
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAdminOverride(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowAdminOverride(false);
                      showSuccess('Override Applied', 'Admin override logged and applied');
                    }}
                    className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    Apply Override
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Price Alert Dialog */}
        {showPriceAlert && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Set Price Alert</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alert me when price drops below
                  </label>
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-2">€</span>
                    <input
                      type="number"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter target price"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notification method
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option>Email notification</option>
                    <option>Dashboard alert</option>
                    <option>SMS (premium)</option>
                  </select>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    💡 We'll track prices for this route and tier combination and notify you when better rates become available.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPriceAlert(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowPriceAlert(false);
                      showSuccess('Price Alert Set', 'We\'ll notify you when prices drop for this route');
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Set Alert
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suggest Change Dialog */}
        {showSuggestDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggest Tier Change</h3>
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Current Selection:</strong> {tiers.find(t => t.id === selectedTier)?.name}
                    {selectedHub && ` at ${hubs.find(h => h.id === selectedHub)?.name}`}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Suggestion Details
                  </label>
                  <textarea
                    value={suggestionNote}
                    onChange={(e) => setSuggestionNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={4}
                    placeholder="Explain why you suggest this tier/hub combination and provide supporting reasoning..."
                  />
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    💡 This suggestion will be sent to the Ops team for review. The shipment will remain unassigned until an Ops user makes the final decision.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowSuggestDialog(false);
                      setSuggestionNote('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSuggestChange}
                    disabled={!suggestionNote.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Suggestion
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Override Dialog */}
        {showOverrideDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Admin Override Required
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>⚠️ Warning:</strong> You are about to override resource constraints for {tiers.find(t => t.id === selectedTier)?.name} at {hubs.find(h => h.id === selectedHub)?.name}.
                  </p>
                  <p className="text-sm text-red-700 mt-2">
                    This will assign the tier despite insufficient resources and will be logged for audit purposes.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Override Justification *
                  </label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    rows={3}
                    placeholder="Explain why this override is necessary (e.g., emergency shipment, stock transfer incoming, etc.)"
                  />
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    🔒 This action will be logged with your admin credentials and timestamp for compliance tracking.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowOverrideDialog(false);
                      setOverrideReason('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (overrideReason.trim()) {
                        // Clear the availability error to allow assignment
                        setValidationErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.availability;
                          return newErrors;
                        });
                        setShowOverrideDialog(false);
                        setOverrideReason('');
                        showSuccess('Override Applied', 'Admin override has been applied. You may now proceed with assignment.', 3000);
                      }
                    }}
                    disabled={!overrideReason.trim()}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply Override
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EDGE CASE DIALOGS */}

        {/* Both Hubs Unavailable - Delay Dialog */}
        {showDelayDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                All Hubs Unavailable
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>⚠️ Capacity Issue:</strong> Both Paris and London hubs lack sufficient resources for {tiers.find(t => t.id === selectedTier)?.name}.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Delay Date
                  </label>
                  <select
                    value={selectedDelayDate}
                    onChange={(e) => setSelectedDelayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Select Date --</option>
                    {getNextAvailableDates().map(date => (
                      <option key={date} value={date}>
                        {new Date(date).toLocaleDateString()} (estimated)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    💡 Delaying will reserve a future slot and notify the client of the revised timeline.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDelayDialog(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  {userRole === 'ops_admin' && (
                    <button
                      onClick={() => {
                        setShowDelayDialog(false);
                        setShowOverrideDialog(true);
                      }}
                      className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                    >
                      Admin Override
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (selectedDelayDate) {
                        // Handle delay scheduling
                        showSuccess('Delay Scheduled', `Shipment delayed until ${new Date(selectedDelayDate).toLocaleDateString()}`);
                        setShowDelayDialog(false);
                      }
                    }}
                    disabled={!selectedDelayDate}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Schedule Delay
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* High-Value Dual Approval Dialog */}
        {showDualApprovalDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Dual Approval Required
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>High-Value Alert:</strong> €{currentShipment?.declared_value.toLocaleString()} shipment requires two-person approval for Tier 3 assignment.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Second Approver *
                  </label>
                  <select
                    value={secondApprover}
                    onChange={(e) => setSecondApprover(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Select Approver --</option>
                    <option value="ops_manager_1">Sarah Chen (Ops Manager)</option>
                    <option value="ops_manager_2">James Rodriguez (Ops Manager)</option>
                    <option value="senior_ops_1">Alex Kim (Senior Ops)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Approval Justification *
                  </label>
                  <textarea
                    value={approvalJustification}
                    onChange={(e) => setApprovalJustification(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Explain why Tier 3 is necessary for this high-value shipment..."
                  />
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    🔒 This decision will be logged with both approvers' IDs for compliance audit.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDualApprovalDialog(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (secondApprover && approvalJustification.trim()) {
                        setShowDualApprovalDialog(false);
                        // Now proceed with normal assignment
                        handleConfirmClassification();
                      }
                    }}
                    disabled={!secondApprover || !approvalJustification.trim()}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    Approve & Assign
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tier Downgrade Warning Dialog */}
        {showDowngradeWarning && previousTier && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Security Level Downgrade
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Warning:</strong> You are downgrading from Tier {previousTier} to Tier {selectedTier}. This will reduce the security and verification level.
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>Security Impact:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Reduced verification capabilities</li>
                    <li>Lower authentication security</li>
                    <li>Previously reserved resources will be freed</li>
                    <li>Action will be logged for audit</li>
                  </ul>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Downgrade Reason *
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    onChange={(e) => {
                      if (e.target.value) {
                        confirmTierDowngrade(selectedTier!, e.target.value);
                      }
                    }}
                  >
                    <option value="">-- Select Reason --</option>
                    <option value="capacity_constraints">Hub capacity constraints</option>
                    <option value="cost_optimization">Cost optimization</option>
                    <option value="client_request">Client request</option>
                    <option value="operational_efficiency">Operational efficiency</option>
                    <option value="other">Other business reason</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDowngradeWarning(false);
                      setPreviousTier(null);
                      // Revert to previous tier
                      setSelectedTier(previousTier);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel Downgrade
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Network Retry Dialog */}
        {showRetryDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
                <RefreshCw className="h-5 w-5 mr-2" />
                Connection Issue
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Network Error:</strong> {lastError}
                  </p>
                  <p className="text-sm text-red-700 mt-2">
                    Reservation failed. Shipment status unchanged.
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    💡 You can retry the assignment or return to fix any issues. Your form data is preserved.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRetryDialog(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowRetryDialog(false);
                      handleConfirmClassification(); // Retry
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Assignment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
