'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, Package, MapPin, Euro, Scale, AlertTriangle,
  ChevronRight, Loader2, Info
} from 'lucide-react';
import { theme, componentStyles } from '@/lib/theme';

interface Shipment {
  id: string;
  sender_name: string;
  sender_city: string;
  sender_country: string;
  buyer_name: string;
  buyer_city: string;
  buyer_country: string;
  declared_value: number;
  weight: number;
  dimensions?: string;
  fragility_level: number;
  tier: number;
  status: string;
  created_at: string;
}

export default function SelectShipmentPage() {
  const router = useRouter();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchShipments();
  }, []);

  useEffect(() => {
    // Filter shipments based on search
    const filtered = shipments.filter(shipment => {
      const search = searchTerm.toLowerCase();
      return (
        shipment.id.toLowerCase().includes(search) ||
        shipment.sender_city.toLowerCase().includes(search) ||
        shipment.buyer_city.toLowerCase().includes(search) ||
        shipment.sender_name.toLowerCase().includes(search) ||
        shipment.buyer_name.toLowerCase().includes(search)
      );
    });
    setFilteredShipments(filtered);
  }, [searchTerm, shipments]);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(
        `${base}/api/sprint8/logistics/shipments?status=classified,pending_quote,quote_expired`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch shipments');
      }

      const data = await response.json();
      if (data.success && data.data?.shipments) {
        setShipments(data.data.shipments);
        setFilteredShipments(data.data.shipments);
      }
    } catch (err) {
      console.error('Error fetching shipments:', err);
      setError('Unable to load shipments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (selectedShipment) {
      router.push(`/sprint-8/logistics/plan/mode/${selectedShipment}`);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getFragilityLabel = (level: number) => {
    const labels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
    return labels[level - 1] || 'Unknown';
  };

  const getFragilityColor = (level: number) => {
    if (level <= 2) return 'text-green-600 bg-green-50';
    if (level === 3) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getTierBadge = (tier: number) => {
    return (
      <span className={`
        inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
        ${tier === 3 ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}
      `}>
        Tier {tier}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading shipments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-8">
              <div className="flex items-center">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-medium">
                  1
                </div>
                <span className="ml-3 text-sm font-medium text-gray-900">Select Shipment</span>
              </div>
              
              <ChevronRight className="h-5 w-5 text-gray-400" />
              
              <div className="flex items-center">
                <div className="flex items-center justify-center w-8 h-8 bg-gray-200 text-gray-500 rounded-full text-sm font-medium">
                  2
                </div>
                <span className="ml-3 text-sm text-gray-500">Choose Service</span>
              </div>
              
              <ChevronRight className="h-5 w-5 text-gray-400" />
              
              <div className="flex items-center">
                <div className="flex items-center justify-center w-8 h-8 bg-gray-200 text-gray-500 rounded-full text-sm font-medium">
                  3
                </div>
                <span className="ml-3 text-sm text-gray-500">Create Quote</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-light text-gray-900">Select Shipment</h1>
            <p className="mt-2 text-gray-600">Choose a shipment to create a manual quote</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, city, or name..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Shipments Grid */}
        <div className="grid gap-4">
          {filteredShipments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No shipments found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search criteria</p>
            </div>
          ) : (
            filteredShipments.map((shipment) => (
              <div
                key={shipment.id}
                onClick={() => setSelectedShipment(shipment.id)}
                className={`
                  bg-white rounded-xl border-2 p-6 cursor-pointer transition-all
                  ${selectedShipment === shipment.id 
                    ? 'border-blue-500 shadow-lg' 
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">{shipment.id}</h3>
                      {getTierBadge(shipment.tier)}
                      <span className={`
                        inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                        ${getFragilityColor(shipment.fragility_level)}
                      `}>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {getFragilityLabel(shipment.fragility_level)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="flex items-start space-x-2 mb-3">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">From</p>
                            <p className="text-sm text-gray-900">{shipment.sender_name}</p>
                            <p className="text-sm text-gray-500">
                              {shipment.sender_city}, {shipment.sender_country}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-start space-x-2 mb-3">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">To</p>
                            <p className="text-sm text-gray-900">{shipment.buyer_name}</p>
                            <p className="text-sm text-gray-500">
                              {shipment.buyer_city}, {shipment.buyer_country}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6 mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center space-x-2">
                        <Euro className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Value</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(shipment.declared_value)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Scale className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Weight</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {shipment.weight} kg
                          </p>
                        </div>
                      </div>

                      {shipment.dimensions && (
                        <div className="flex items-center space-x-2">
                          <Package className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Dimensions</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {shipment.dimensions}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedShipment === shipment.id && (
                    <div className="ml-4 flex-shrink-0">
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Bar */}
        <div className="mt-8 flex justify-between items-center">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Info className="h-4 w-4" />
            <span>{filteredShipments.length} shipment{filteredShipments.length !== 1 ? 's' : ''} available</span>
          </div>

          <button
            onClick={handleContinue}
            disabled={!selectedShipment}
            className={`
              inline-flex items-center px-8 py-3 font-medium rounded-xl transition-all
              ${selectedShipment
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Continue
            <ChevronRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}