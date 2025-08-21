'use client';

/**
 * DHL LABELS DEMO PAGE
 * 
 * Provides sample URLs and test scenarios for the DHL Labels functionality
 */

import React from 'react';
import Link from 'next/link';
import { 
  Tag, 
  ExternalLink, 
  Package, 
  Truck, 
  Plane,
  ArrowLeft,
  Info,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

export default function DhlLabelsDemo() {
  const sampleShipments = [
    {
      id: 'SHIP-001',
      sku: 'LUX-WATCH-001',
      tier: 'premium',
      route: 'Priority Route',
      status: 'planned',
      dhlLegs: 2,
      description: 'Luxury watch with DHL Express segments'
    },
    {
      id: 'SHIP-002', 
      sku: 'ART-PIECE-002',
      tier: 'platinum',
      route: 'White-Glove Route',
      status: 'planned',
      dhlLegs: 1,
      description: 'Art piece with mixed DHL Standard + WG segments'
    },
    {
      id: 'SHIP-003',
      sku: 'JEWELRY-003',
      tier: 'standard',
      route: 'Standard Route',
      status: 'planned',
      dhlLegs: 2,
      description: 'Standard jewelry with DHL Standard routing'
    }
  ];

  const integrationFeatures = [
    {
      icon: Tag,
      title: 'Label Generation',
      description: 'Purchase DHL labels with real-time API simulation',
      color: 'text-orange-600 bg-orange-100'
    },
    {
      icon: Truck,
      title: 'Tracking Integration',
      description: 'Automatic tracking number assignment and hub integration',
      color: 'text-blue-600 bg-blue-100'
    },
    {
      icon: Package,
      title: 'Route Separation',
      description: 'Clear distinction between DHL and White-Glove legs',
      color: 'text-green-600 bg-green-100'
    },
    {
      icon: CheckCircle,
      title: 'Leg Management',
      description: 'Detailed leg view with validation, rate TTL, and expandable options',
      color: 'text-indigo-600 bg-indigo-100'
    },
    {
      icon: Package,
      title: 'Cost Recap',
      description: 'Detailed per-leg breakdown with variance tracking vs plan',
      color: 'text-green-600 bg-green-100'
    },
    {
      icon: ExternalLink,
      title: 'System Integration',
      description: 'Updates Hub Console, Dashboard, and Client Apps',
      color: 'text-purple-600 bg-purple-100'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/sprint-8/logistics/dashboard"
            className="text-gray-600 hover:text-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">DHL Labels Demo</h1>
            <p className="text-gray-600">Test the DHL label generation and management system</p>
          </div>
        </div>
      </div>

      {/* Demo Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
        <div className="flex items-start gap-3">
          <Info className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">About DHL Labels</h3>
            <p className="text-blue-800 mb-3">
              The DHL Labels page handles shipping label purchase and management for DHL segments 
              of planned routes. It integrates with the broader logistics system while keeping 
              DHL and White-Glove operations separate.
            </p>
            <p className="text-blue-800 text-sm">
              <strong>URL Pattern:</strong> <code>/sprint-8/logistics/dhl?shipment=SHIPMENT_ID</code>
            </p>
          </div>
        </div>
      </div>

      {/* Sample Shipments */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Sample Shipments</h2>
        <div className="grid gap-6">
          {sampleShipments.map((shipment) => (
            <div key={shipment.id} className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{shipment.sku}</h3>
                  <p className="text-gray-600">{shipment.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Shipment ID</div>
                  <div className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{shipment.id}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Tier</div>
                  <div className="font-medium capitalize">{shipment.tier}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Route</div>
                  <div className="font-medium">{shipment.route}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">DHL Legs</div>
                  <div className="font-medium">{shipment.dhlLegs} segments</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Status</div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-green-600 font-medium capitalize">{shipment.status}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  href={`/sprint-8/logistics/dhl?shipment=${shipment.id}`}
                  className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  <Tag className="h-4 w-4 mr-2" />
                  DHL Labels
                </Link>
                <Link
                  href={`/sprint-8/logistics/plan/${shipment.id}`}
                  className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Route Plan
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Features */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Integration Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrationFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${feature.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Demo Scenarios */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Scenarios</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-gray-900">Complete Label Flow</div>
              <div className="text-sm text-gray-600">Purchase labels for all DHL segments in a route with detailed leg management</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-gray-900">Expandable Leg Options</div>
              <div className="text-sm text-gray-600">Click any leg to see detailed validation, rate status, and action options</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-gray-900">Mixed Route Handling</div>
              <div className="text-sm text-gray-600">Test routes with both DHL and White-Glove segments</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-gray-900">Error Handling</div>
              <div className="text-sm text-gray-600">Test API failures and retry mechanisms</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
