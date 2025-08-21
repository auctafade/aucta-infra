'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, Package, Truck, Users, AlertTriangle, CheckCircle, TrendingUp, MapPin, Clock, Plus, Tag } from 'lucide-react';
import { api } from '@/lib/api';

interface ShipmentToClassify {
  id: number;
  shipment_id: string;
  reference_sku: string;
  brand: string;
  declared_value: number;
  currency: string;
  urgency_level: string;
  status: string;
  created_at: string;
  sender_name: string;
  sender_city: string;
  sender_country: string;
  buyer_name: string;
  buyer_city: string;
  buyer_country: string;
  document_count: number;
}

export default function LogisticsDashboard() {
  const [shipmentsToClassify, setShipmentsToClassify] = useState<ShipmentToClassify[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalShipments: 0,
    draftCount: 0,
    classifiedCount: 0,
    inTransitCount: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [shipmentsResponse, statsResponse] = await Promise.all([
          api.getShipmentsToClassify(10, 0),
          api.getLogisticsStats()
        ]);
        
        setShipmentsToClassify(shipmentsResponse.shipments || []);
        
        // Process stats
        const statusStats = statsResponse.statusStats || [];
        const totalShipments = statusStats.reduce((sum: number, stat: any) => sum + parseInt(stat.count), 0);
        const draftCount = statusStats.find((s: any) => s.status === 'draft')?.count || 0;
        const classifiedCount = statusStats.find((s: any) => s.status === 'classified')?.count || 0;
        const inTransitCount = statusStats.find((s: any) => s.status === 'in-transit')?.count || 0;
        
        setStats({ totalShipments, draftCount, classifiedCount, inTransitCount });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'express': return 'text-red-600 bg-red-100';
      case 'expedited': return 'text-orange-600 bg-orange-100';
      default: return 'text-green-600 bg-green-100';
    }
  };
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/sprint-8" className="hover:text-gray-700">Sprint 8</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/sprint-8/logistics" className="hover:text-gray-700">Logistics</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900">Dashboard</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Logistics Dashboard</h1>
          <p className="text-gray-600 mt-2">Real-time overview of logistics operations</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Export Report
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Shipments</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.totalShipments.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="h-4 w-4 mr-1" />
                Last 30 days
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Transit</p>
              <p className="text-2xl font-bold text-gray-900">89</p>
              <p className="text-sm text-blue-600 flex items-center mt-1">
                <Truck className="h-4 w-4 mr-1" />
                Active deliveries
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Truck className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">SLA Compliance</p>
              <p className="text-2xl font-bold text-green-600">98.5%</p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <CheckCircle className="h-4 w-4 mr-1" />
                Above target
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Actions</p>
              <p className="text-2xl font-bold text-yellow-600">23</p>
              <p className="text-sm text-yellow-600 flex items-center mt-1">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Requires attention
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* To Classify Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">To Classify</h2>
            <p className="text-sm text-gray-500">Draft shipments awaiting tier assignment</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {loading ? '...' : `${stats.draftCount} pending`}
            </span>
            <Link 
              href="/sprint-8/logistics/new" 
              className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Shipment
            </Link>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Loading shipments...
            </div>
          ) : shipmentsToClassify.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No shipments awaiting classification
            </div>
          ) : (
            shipmentsToClassify.map((shipment, index) => (
              <div key={shipment.shipment_id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-sm font-medium text-gray-900">{shipment.reference_sku}</h3>
                      <span className="text-xs text-gray-500">• {shipment.brand}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getUrgencyColor(shipment.urgency_level)}`}>
                        {shipment.urgency_level}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="font-medium text-green-600">
                        {formatCurrency(shipment.declared_value, shipment.currency)}
                      </span>
                      <span>
                        {shipment.sender_city}, {shipment.sender_country} → {shipment.buyer_city}, {shipment.buyer_country}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>Created {new Date(shipment.created_at).toLocaleDateString()}</span>
                      {shipment.document_count > 0 && (
                        <>
                          <span>•</span>
                          <span>{shipment.document_count} document{shipment.document_count > 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/sprint-8/logistics/classify/${shipment.shipment_id}`}
                      className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Classify
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <Link 
            href="/sprint-8/logistics/classify" 
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View all classification queue →
          </Link>
        </div>
      </div>

      {/* Map Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Global Operations</h2>
        <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Interactive map view</p>
            <p className="text-sm text-gray-400">Showing active shipments and hub locations</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            { action: 'Shipment #12345 delivered', time: '2 minutes ago', status: 'success' },
            { action: 'New shipment created from Hong Kong', time: '15 minutes ago', status: 'info' },
            { action: 'SLA warning for shipment #12346', time: '1 hour ago', status: 'warning' },
            { action: 'Hub capacity updated', time: '2 hours ago', status: 'info' },
            { action: 'Inventory tags restocked', time: '3 hours ago', status: 'success' }
          ].map((activity, index) => (
            <div key={index} className="px-6 py-4 flex items-center space-x-3">
              <div className={`w-2 h-2 rounded-full ${
                activity.status === 'success' ? 'bg-green-500' :
                activity.status === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
              }`}></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{activity.action}</p>
                <p className="text-xs text-gray-500 flex items-center mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  {activity.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/logistics/new" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center">
            <Plus className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">New Shipment</p>
          </Link>
          <Link href="/logistics/incidents" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Report Issue</p>
          </Link>
          <Link href="/inventory/tags" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center">
            <Tag className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Manage Tags</p>
          </Link>
          <Link href="/people/contacts" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center">
            <Users className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Add Contact</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
