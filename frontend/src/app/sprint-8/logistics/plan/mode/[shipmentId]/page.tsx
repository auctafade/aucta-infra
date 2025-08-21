'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronRight, Truck, Package, Shuffle,
  Info, Check, Loader2, AlertCircle
} from 'lucide-react';
import { theme } from '@/lib/theme';

interface ServiceModel {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  subOptions?: {
    id: string;
    name: string;
    description: string;
  }[];
}

export default function ServiceSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.shipmentId as string;
  
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<number>(3);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [hybridVariant, setHybridVariant] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchShipmentDetails();
  }, [shipmentId]);

  const fetchShipmentDetails = async () => {
    try {
      setLoading(true);
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${base}/api/sprint8/logistics/shipments/${shipmentId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch shipment');
      }
      
      const data = await response.json();
      if (data.success && data.data?.shipment) {
        setShipment(data.data.shipment);
        setSelectedTier(data.data.shipment.tier || 3);
      }
    } catch (err) {
      console.error('Error fetching shipment:', err);
      setError('Unable to load shipment details');
    } finally {
      setLoading(false);
    }
  };

  const getServiceModels = (): ServiceModel[] => {
    if (selectedTier === 2) {
      // Tier 2: No hybrid option
      return [
        {
          id: 'wg-full',
          name: 'Full White-Glove',
          description: 'Professional operators handle the entire journey',
          icon: <Truck className="h-8 w-8" />,
          available: true
        },
        {
          id: 'dhl-full',
          name: 'Full DHL',
          description: 'Complete DHL express shipping service',
          icon: <Package className="h-8 w-8" />,
          available: true
        }
      ];
    }

    // Tier 3: All options including hybrid
    return [
      {
        id: 'wg-full',
        name: 'Full White-Glove',
        description: 'Professional operators handle the entire journey',
        icon: <Truck className="h-8 w-8" />,
        available: true
      },
      {
        id: 'dhl-full',
        name: 'Full DHL',
        description: 'Complete DHL express shipping service',
        icon: <Package className="h-8 w-8" />,
        available: true
      },
      {
        id: 'hybrid',
        name: 'Hybrid Service',
        description: 'Combination of White-Glove and DHL services',
        icon: <Shuffle className="h-8 w-8" />,
        available: true,
        subOptions: [
          {
            id: 'wg_to_dhl',
            name: 'WG → DHL',
            description: 'White-Glove to hubs, then DHL to client'
          },
          {
            id: 'dhl_to_wg',
            name: 'DHL → WG',
            description: 'DHL to hub, then White-Glove to client'
          }
        ]
      }
    ];
  };

  const handleContinue = () => {
    if (!selectedService) return;

    // Store the selection in session
    sessionStorage.setItem(`quote_${shipmentId}_tier`, selectedTier.toString());
    sessionStorage.setItem(`quote_${shipmentId}_service`, selectedService);
    if (hybridVariant) {
      sessionStorage.setItem(`quote_${shipmentId}_variant`, hybridVariant);
    }

    // Navigate to the appropriate manual planner
    if (selectedService === 'wg-full') {
      router.push(`/sprint-8/logistics/plan/manual/wg-full/${shipmentId}`);
    } else if (selectedService === 'dhl-full') {
      router.push(`/sprint-8/logistics/plan/manual/dhl-full/${shipmentId}`);
    } else if (selectedService === 'hybrid' && hybridVariant) {
      router.push(`/sprint-8/logistics/plan/manual/hybrid/${shipmentId}?variant=${hybridVariant}`);
    }
  };

  const isValid = selectedService && (selectedService !== 'hybrid' || hybridVariant);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading shipment details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-semibold mb-2">Error Loading Shipment</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link
            href="/sprint-8/logistics/plan/start"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Shipments
          </Link>
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
                <div className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full text-sm font-medium">
                  <Check className="h-5 w-5" />
                </div>
                <span className="ml-3 text-sm text-gray-600">Select Shipment</span>
              </div>
              
              <ChevronRight className="h-5 w-5 text-gray-400" />
              
              <div className="flex items-center">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-medium">
                  2
                </div>
                <span className="ml-3 text-sm font-medium text-gray-900">Choose Service</span>
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
            <h1 className="text-3xl font-light text-gray-900">Choose Service Model</h1>
            <p className="mt-2 text-gray-600">Select tier and service type for shipment {shipmentId}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Shipment Summary */}
        {shipment && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Shipment</p>
                <p className="font-semibold text-gray-900">{shipment.id}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-1">Route</p>
                <p className="font-semibold text-gray-900">
                  {shipment.sender_city} → {shipment.buyer_city}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-1">Value</p>
                <p className="font-semibold text-gray-900">
                  €{shipment.declared_value?.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tier Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Confirm Tier</h2>
          <p className="text-sm text-gray-600 mb-4">
            The tier determines hub requirements and available service options
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedTier(2)}
              className={`
                p-4 rounded-xl border-2 transition-all text-left
                ${selectedTier === 2
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-semibold text-gray-900">Tier 2</span>
                {selectedTier === 2 && (
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600">
                Single hub authentication • Security tag • No hybrid options
              </p>
            </button>

            <button
              onClick={() => setSelectedTier(3)}
              className={`
                p-4 rounded-xl border-2 transition-all text-left
                ${selectedTier === 3
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-semibold text-gray-900">Tier 3</span>
                {selectedTier === 3 && (
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600">
                Dual hub option • NFC chip • All service models available
              </p>
            </button>
          </div>
        </div>

        {/* Service Model Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Service Model</h2>
          <p className="text-sm text-gray-600 mb-4">
            Choose how the shipment will be transported
          </p>

          <div className="space-y-4">
            {getServiceModels().map((model) => (
              <div key={model.id}>
                <button
                  onClick={() => {
                    setSelectedService(model.id);
                    if (model.id !== 'hybrid') {
                      setHybridVariant(null);
                    }
                  }}
                  disabled={!model.available}
                  className={`
                    w-full p-4 rounded-xl border-2 transition-all text-left
                    ${selectedService === model.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                    ${!model.available ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <div className="flex items-start">
                    <div className={`
                      p-3 rounded-lg mr-4
                      ${selectedService === model.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
                    `}>
                      {model.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">{model.name}</h3>
                        {selectedService === model.id && (
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                    </div>
                  </div>
                </button>

                {/* Hybrid Sub-options */}
                {model.id === 'hybrid' && selectedService === 'hybrid' && model.subOptions && (
                  <div className="ml-20 mt-4 space-y-3">
                    {model.subOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setHybridVariant(option.id)}
                        className={`
                          w-full p-3 rounded-lg border-2 transition-all text-left
                          ${hybridVariant === option.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{option.name}</p>
                            <p className="text-sm text-gray-600">{option.description}</p>
                          </div>
                          {hybridVariant === option.id && (
                            <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-8">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Next Step: Manual Quote Entry</p>
              <p>
                After selecting your service model, you'll enter the Manual Planner where you can 
                input transport prices, calculate labor costs, and generate a professional PDF quote.
              </p>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex justify-between items-center">
          <Link
            href="/sprint-8/logistics/plan/start"
            className="inline-flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>

          <button
            onClick={handleContinue}
            disabled={!isValid}
            className={`
              inline-flex items-center px-8 py-3 font-medium rounded-xl transition-all
              ${isValid
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Open Manual Planner
            <ChevronRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}