'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, Search, Edit, Trash2, MapPin, Phone, Mail, 
  DollarSign, Clock, Users, Globe, Save, X, CheckCircle,
  AlertTriangle, Package, Copy, Star, Eye, Map, List, 
  Settings, Download, Upload, Filter, MoreHorizontal,
  ChevronDown, Tag, Smartphone, FileText, Camera,
  Shield, Zap, ChevronRight, AlertCircle, Navigation
} from 'lucide-react';
import { api } from '@/lib/api';

// Types for Hub Management
interface Hub {
  id: string;
  code: string;
  name: string;
  location: string;
  timezone: string;
  status: 'active' | 'archived' | 'test';
  roles: ('authenticator' | 'couturier')[];
  address: {
    street: string;
    city: string;
    postal_code: string;
    country: string;
    coordinates?: { lat: number; lng: number };
  };
  contact_info: {
    name?: string;
    email?: string;
    phone?: string;
  };
  // Pricing information
  tier2_auth_fee?: number;
  tag_unit_cost?: number;
  tier3_auth_fee?: number;
  nfc_unit_cost?: number;
  sew_fee?: number;
  qa_fee?: number;
  internal_rollout_cost?: number;
  currency?: string;
  special_surcharges?: {
    rush_percent?: number;
    fragile_fee?: number;
    weekend_fee?: number;
  };
  // Capacity information
  auth_capacity?: number;
  sewing_capacity?: number;
  qa_capacity?: number;
  working_days?: string[];
  working_hours_start?: string;
  working_hours_end?: string;
  created_at: string;
  updated_at: string;
}

interface HubFormData {
  name: string;
  code: string;
  roles: ('authenticator' | 'couturier')[];
  status: 'active' | 'archived' | 'test';
  address: {
    street: string;
    city: string;
    postal_code: string;
    country: string;
    coordinates?: { lat: number; lng: number };
  };
  timezone: string;
  contact_info: {
    name: string;
    email: string;
    phone: string;
  };
  pricing: {
    tier2_auth_fee: number;
    tag_unit_cost: number;
    tier3_auth_fee: number;
    nfc_unit_cost: number;
    sew_fee: number;
    qa_fee: number;
    internal_rollout_cost: number;
    currency: string;
    special_surcharges: {
      rush_percent: number;
      fragile_fee: number;
      weekend_fee: number;
    };
  };
  notes: string;
}

interface Filters {
  role: string;
  country: string;
  city: string;
  status: string;
  currency: string;
  search: string;
}

export default function HubsManagerPage() {
  const [currentTab, setCurrentTab] = useState<'directory' | 'jobs'>('directory');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHubDetail, setShowHubDetail] = useState(false);
  const [editingHub, setEditingHub] = useState<Hub | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<Filters>({
    role: '',
    country: '',
    city: '',
    status: '',
    currency: '',
    search: ''
  });

  // Form data
  const [formData, setFormData] = useState<HubFormData>({
    name: '',
    code: '',
    roles: ['authenticator'],
    status: 'active',
    address: {
      street: '',
      city: '',
      postal_code: '',
      country: '',
    },
    timezone: 'Europe/London',
    contact_info: {
      name: '',
      email: '',
      phone: '',
    },
    pricing: {
      tier2_auth_fee: 0,
      tag_unit_cost: 0,
      tier3_auth_fee: 0,
      nfc_unit_cost: 0,
      sew_fee: 0,
      qa_fee: 0,
      internal_rollout_cost: 0,
      currency: 'EUR',
      special_surcharges: {
        rush_percent: 25,
        fragile_fee: 15,
        weekend_fee: 50,
      }
    },
    notes: ''
  });

  useEffect(() => {
    loadHubs();
  }, [filters]);

  const loadHubs = async () => {
    try {
      setLoading(true);
      const response = await api.getHubsManagement(filters);
      setHubs(response.hubs);
    } catch (error) {
      console.error('Error loading hubs:', error);
      // Use mock data for now
      setHubs(getMockHubs());
    } finally {
      setLoading(false);
    }
  };

  const getMockHubs = (): Hub[] => [
    {
      id: '1',
      code: 'PAR-Id-01',
      name: 'Paris Authenticator Hub',
      location: 'Paris, France',
      timezone: 'Europe/Paris',
      status: 'active',
      roles: ['authenticator'],
      address: {
        street: '45 Rue de Rivoli',
        city: 'Paris',
        postal_code: '75001',
        country: 'France',
        coordinates: { lat: 48.8566, lng: 2.3522 }
      },
      contact_info: {
        name: 'Marie Dubois',
        email: 'marie.dubois@aucta.com',
        phone: '+33 1 42 60 30 30'
      },
      tier2_auth_fee: 150,
      tag_unit_cost: 12.50,
      tier3_auth_fee: 175,
      nfc_unit_cost: 25,
      internal_rollout_cost: 35,
      currency: 'EUR',
      special_surcharges: {
        rush_percent: 25,
        fragile_fee: 15,
        weekend_fee: 50
      },
      auth_capacity: 50,
      sewing_capacity: 0,
      qa_capacity: 0,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      code: 'LON-Cou-01',
      name: 'London Couturier Hub',
      location: 'London, United Kingdom',
      timezone: 'Europe/London',
      status: 'active',
      roles: ['couturier'],
      address: {
        street: '123 Savile Row',
        city: 'London',
        postal_code: 'W1S 3PJ',
        country: 'United Kingdom',
        coordinates: { lat: 51.5074, lng: -0.1278 }
      },
      contact_info: {
        name: 'James Wilson',
        email: 'james.wilson@aucta.com',
        phone: '+44 20 7946 0958'
      },
      tier3_auth_fee: 200,
      nfc_unit_cost: 30,
      sew_fee: 125,
      qa_fee: 75,
      internal_rollout_cost: 40,
      currency: 'GBP',
      special_surcharges: {
        rush_percent: 30,
        fragile_fee: 20,
        weekend_fee: 60
      },
      auth_capacity: 0,
      sewing_capacity: 30,
      qa_capacity: 15,
      created_at: '2024-01-20T14:00:00Z',
      updated_at: '2024-01-20T14:00:00Z'
    },
    {
      id: '3',
      code: 'NYC-Hub-01',
      name: 'New York Hybrid Hub',
      location: 'New York, United States',
      timezone: 'America/New_York',
      status: 'active',
      roles: ['authenticator', 'couturier'],
      address: {
        street: '350 Fifth Avenue',
        city: 'New York',
        postal_code: '10118',
        country: 'United States',
        coordinates: { lat: 40.7484, lng: -73.9857 }
      },
      contact_info: {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@aucta.com',
        phone: '+1 212 555 0123'
      },
      tier2_auth_fee: 175,
      tag_unit_cost: 15,
      tier3_auth_fee: 225,
      nfc_unit_cost: 35,
      sew_fee: 150,
      qa_fee: 85,
      internal_rollout_cost: 45,
      currency: 'USD',
      special_surcharges: {
        rush_percent: 25,
        fragile_fee: 25,
        weekend_fee: 75
      },
      auth_capacity: 75,
      sewing_capacity: 45,
      qa_capacity: 25,
      created_at: '2024-02-01T16:00:00Z',
      updated_at: '2024-02-01T16:00:00Z'
    }
  ];

  const handleCreateHub = () => {
    setEditingHub(null);
    setFormData({
      name: '',
      code: '',
      roles: ['authenticator'],
      status: 'active',
      address: {
        street: '',
        city: '',
        postal_code: '',
        country: '',
      },
      timezone: 'Europe/London',
      contact_info: {
        name: '',
        email: '',
        phone: '',
      },
      pricing: {
        tier2_auth_fee: 0,
        tag_unit_cost: 0,
        tier3_auth_fee: 0,
        nfc_unit_cost: 0,
        sew_fee: 0,
        qa_fee: 0,
        internal_rollout_cost: 0,
        currency: 'EUR',
        special_surcharges: {
          rush_percent: 25,
          fragile_fee: 15,
          weekend_fee: 50,
        }
      },
      notes: ''
    });
    setShowHubDetail(true);
  };

  const handleEditHub = (hub: Hub) => {
    setEditingHub(hub);
    setFormData({
      name: hub.name,
      code: hub.code,
      roles: hub.roles,
      status: hub.status,
      address: hub.address,
      timezone: hub.timezone,
      contact_info: {
        name: hub.contact_info.name ?? '',
        email: hub.contact_info.email ?? '',
        phone: hub.contact_info.phone ?? '',
      },
      pricing: {
        tier2_auth_fee: hub.tier2_auth_fee || 0,
        tag_unit_cost: hub.tag_unit_cost || 0,
        tier3_auth_fee: hub.tier3_auth_fee || 0,
        nfc_unit_cost: hub.nfc_unit_cost || 0,
        sew_fee: hub.sew_fee || 0,
        qa_fee: hub.qa_fee || 0,
        internal_rollout_cost: hub.internal_rollout_cost || 0,
        currency: hub.currency || 'EUR',
        special_surcharges: {
          rush_percent: hub.special_surcharges?.rush_percent ?? 25,
          fragile_fee: hub.special_surcharges?.fragile_fee ?? 15,
          weekend_fee: hub.special_surcharges?.weekend_fee ?? 50,
        }
      },
      notes: ''
    });
    setShowHubDetail(true);
  };

  const handleSaveHub = async () => {
    try {
      setSaving(true);
      
      const hubData = {
        ...formData,
        roles: formData.roles,
        contact: formData.contact_info,
        pricing: formData.pricing,
      };

      if (editingHub) {
        await api.updateHubManagement(editingHub.id, hubData);
      } else {
        await api.createHubManagement(hubData);
      }

      setShowHubDetail(false);
      loadHubs();
    } catch (error) {
      console.error('Error saving hub:', error);
      alert('Failed to save hub. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveHub = async (hubId: string) => {
    if (!confirm('Are you sure you want to archive this hub?')) return;
    
    try {
      await api.archiveHubManagement(hubId);
      loadHubs();
    } catch (error) {
      console.error('Error archiving hub:', error);
      alert('Failed to archive hub. Please try again.');
    }
  };

  const handleDuplicateHub = async (hub: Hub) => {
    const newHubData = {
      ...hub,
      name: `${hub.name} (Copy)`,
      code: `${hub.code}-COPY`,
    };
    
    try {
      await api.duplicateHubManagement(hub.id, newHubData);
      loadHubs();
    } catch (error) {
      console.error('Error duplicating hub:', error);
      alert('Failed to duplicate hub. Please try again.');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'authenticator': return 'bg-green-100 text-green-800';
      case 'couturier': return 'bg-blue-100 text-blue-800';
      default: return 'bg-purple-100 text-purple-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'test': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredHubs = hubs.filter(hub => {
    if (filters.role && !hub.roles.includes(filters.role as any)) return false;
    if (filters.status && hub.status !== filters.status) return false;
    if (filters.country && !hub.address.country.toLowerCase().includes(filters.country.toLowerCase())) return false;
    if (filters.city && !hub.address.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
    if (filters.currency && hub.currency !== filters.currency) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return hub.name.toLowerCase().includes(searchLower) ||
             hub.code.toLowerCase().includes(searchLower) ||
             hub.address.street.toLowerCase().includes(searchLower) ||
             hub.address.city.toLowerCase().includes(searchLower);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Hubs Manager</h1>
              <p className="text-sm text-gray-600 mt-1">Add, Map, Categorize, Price</p>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setCurrentTab('directory')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentTab === 'directory'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Hubs Directory
              </button>
              <button
                onClick={() => setCurrentTab('jobs')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentTab === 'jobs'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Jobs
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {currentTab === 'directory' && (
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Actions Bar */}
          <div className="bg-white rounded-lg shadow-sm border mb-6">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* View Toggle */}
                  <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === 'list'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('map')}
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === 'map'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Map className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search hubs..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Filters */}
                  <select
                    value={filters.role}
                    onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Roles</option>
                    <option value="authenticator">HubId (Authenticator)</option>
                    <option value="couturier">HubCou (Couturier)</option>
                  </select>

                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="test">Test</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                {/* Primary Actions */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleCreateHub}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Hub</span>
                  </button>
                  
                  <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Results Summary */}
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600">
              {filteredHubs.length} hub{filteredHubs.length !== 1 ? 's' : ''} found
            </div>
          </div>

          {/* Content Area */}
          {viewMode === 'list' ? (
            <div className="bg-white rounded-lg shadow-sm border">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading hubs...</p>
                </div>
              ) : filteredHubs.length === 0 ? (
                <div className="p-8 text-center">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hubs found</h3>
                  <p className="text-gray-600 mb-4">Get started by creating your first hub.</p>
                  <button
                    onClick={handleCreateHub}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create Hub
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredHubs.map((hub) => (
                    <div key={hub.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-medium text-gray-900">
                              {hub.name}
                            </h3>
                            <span className="text-sm text-gray-500 font-mono">
                              {hub.code}
                            </span>
                            <div className="flex space-x-1">
                              {hub.roles.map((role) => (
                                <span
                                  key={role}
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(role)}`}
                                >
                                  {role === 'authenticator' ? 'Id' : 'Cou'}
                                </span>
                              ))}
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(hub.status)}`}>
                              {hub.status === 'test' && '🧪 '}
                              {hub.status}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-6 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-4 h-4" />
                              <span>{hub.address.city}, {hub.address.country}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <DollarSign className="w-4 h-4" />
                              <span>{hub.currency}</span>
                            </div>
                            {hub.tier2_auth_fee && (
                              <span>From {hub.currency} {hub.tier2_auth_fee} (auth fee)</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditHub(hub)}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicateHub(hub)}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchiveHub(hub.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Map View */
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Map className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Map View</h3>
                  <p className="text-gray-600">Interactive map showing all hub locations</p>
                  <p className="text-sm text-gray-500 mt-2">Map integration coming soon</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Jobs Tab Content */}
      {currentTab === 'jobs' && (
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-center">
              <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Hub Jobs Console</h3>
              <p className="text-gray-600">Manage hub operations and job execution</p>
              <p className="text-sm text-gray-500 mt-2">
                Link to existing hub console functionality
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hub Detail Modal */}
      {showHubDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingHub ? 'Edit Hub' : 'New Hub'}
              </h2>
              <button
                onClick={() => setShowHubDetail(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-8">
                {/* Section 1: Identity & Status */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Identity & Status</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hub Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Paris Authenticator Hub"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Short Code *
                      </label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="PAR-Id-01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="active">Active</option>
                        <option value="test">Test</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Roles *
                      </label>
                      <div className="flex space-x-4 mt-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.roles.includes('authenticator')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  roles: [...formData.roles, 'authenticator']
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  roles: formData.roles.filter(r => r !== 'authenticator')
                                });
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">HubId</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.roles.includes('couturier')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  roles: [...formData.roles, 'couturier']
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  roles: formData.roles.filter(r => r !== 'couturier')
                                });
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">HubCou</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Contact (Optional)</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <input
                        type="text"
                        value={formData.contact_info.name}
                        onChange={(e) => setFormData({
                          ...formData,
                          contact_info: { ...formData.contact_info, name: e.target.value }
                        })}
                        placeholder="Contact Name"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="email"
                        value={formData.contact_info.email}
                        onChange={(e) => setFormData({
                          ...formData,
                          contact_info: { ...formData.contact_info, email: e.target.value }
                        })}
                        placeholder="Email"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="tel"
                        value={formData.contact_info.phone}
                        onChange={(e) => setFormData({
                          ...formData,
                          contact_info: { ...formData.contact_info, phone: e.target.value }
                        })}
                        placeholder="Phone"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Address & Geo */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Address & Geo</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        value={formData.address.street}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: { ...formData.address, street: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="123 Main Street"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        value={formData.address.city}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: { ...formData.address, city: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Paris"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Postal Code *
                      </label>
                      <input
                        type="text"
                        value={formData.address.postal_code}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: { ...formData.address, postal_code: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="75001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Country *
                      </label>
                      <input
                        type="text"
                        value={formData.address.country}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: { ...formData.address, country: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="France"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Timezone
                      </label>
                      <select
                        value={formData.timezone}
                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="Europe/London">Europe/London</option>
                        <option value="Europe/Paris">Europe/Paris</option>
                        <option value="America/New_York">America/New_York</option>
                        <option value="Asia/Tokyo">Asia/Tokyo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Price Book */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    Price Book
                    <span className="ml-2 text-xs text-gray-500">(effective immediately)</span>
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Currency
                      </label>
                      <select
                        value={formData.pricing.currency}
                        onChange={(e) => setFormData({
                          ...formData,
                          pricing: { ...formData.pricing, currency: e.target.value }
                        })}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>

                    {/* Authenticator Fees */}
                    {formData.roles.includes('authenticator') && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                          <Shield className="w-4 h-4 mr-2" />
                          Authenticator Fees
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Tier 2: Auth Fee</label>
                            <input
                              type="number"
                              value={formData.pricing.tier2_auth_fee}
                              onChange={(e) => setFormData({
                                ...formData,
                                pricing: { ...formData.pricing, tier2_auth_fee: Number(e.target.value) }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="150"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Tier 2: Tag Unit Cost</label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.pricing.tag_unit_cost}
                              onChange={(e) => setFormData({
                                ...formData,
                                pricing: { ...formData.pricing, tag_unit_cost: Number(e.target.value) }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="12.50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Tier 3: Auth Fee</label>
                            <input
                              type="number"
                              value={formData.pricing.tier3_auth_fee}
                              onChange={(e) => setFormData({
                                ...formData,
                                pricing: { ...formData.pricing, tier3_auth_fee: Number(e.target.value) }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="175"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Tier 3: NFC Unit Cost</label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.pricing.nfc_unit_cost}
                              onChange={(e) => setFormData({
                                ...formData,
                                pricing: { ...formData.pricing, nfc_unit_cost: Number(e.target.value) }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="25.00"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Couturier Fees */}
                    {formData.roles.includes('couturier') && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                          <Zap className="w-4 h-4 mr-2" />
                          Couturier Fees
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Sewing Fee</label>
                            <input
                              type="number"
                              value={formData.pricing.sew_fee}
                              onChange={(e) => setFormData({
                                ...formData,
                                pricing: { ...formData.pricing, sew_fee: Number(e.target.value) }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="125"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">QA Fee</label>
                            <input
                              type="number"
                              value={formData.pricing.qa_fee}
                              onChange={(e) => setFormData({
                                ...formData,
                                pricing: { ...formData.pricing, qa_fee: Number(e.target.value) }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="75"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Internal Costs */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Internal Costs</h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Internal Rollout Cost (per shipment)
                            <span className="text-gray-400 ml-1">— used for HubId → HubCou leg</span>
                          </label>
                          <input
                            type="number"
                            value={formData.pricing.internal_rollout_cost}
                            onChange={(e) => setFormData({
                              ...formData,
                              pricing: { ...formData.pricing, internal_rollout_cost: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="35"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Special Surcharges */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Special Requests / Surcharges</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Rush %</label>
                          <input
                            type="number"
                            value={formData.pricing.special_surcharges.rush_percent}
                            onChange={(e) => setFormData({
                              ...formData,
                              pricing: {
                                ...formData.pricing,
                                special_surcharges: {
                                  ...formData.pricing.special_surcharges,
                                  rush_percent: Number(e.target.value)
                                }
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="25"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Fragile Handling {formData.pricing.currency}</label>
                          <input
                            type="number"
                            value={formData.pricing.special_surcharges.fragile_fee}
                            onChange={(e) => setFormData({
                              ...formData,
                              pricing: {
                                ...formData.pricing,
                                special_surcharges: {
                                  ...formData.pricing.special_surcharges,
                                  fragile_fee: Number(e.target.value)
                                }
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="15"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Weekend {formData.pricing.currency}</label>
                          <input
                            type="number"
                            value={formData.pricing.special_surcharges.weekend_fee}
                            onChange={(e) => setFormData({
                              ...formData,
                              pricing: {
                                ...formData.pricing,
                                special_surcharges: {
                                  ...formData.pricing.special_surcharges,
                                  weekend_fee: Number(e.target.value)
                                }
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Operations (Read-only summaries) */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Operations</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Hours</span>
                      <a href="#" className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                        Link to Hub Capacity page
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Capacity today/7d</span>
                      <span className="text-sm text-gray-900">Auth: 50/350, Sewing: 30/210</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Inventory snapshot</span>
                      <span className="text-sm text-gray-900">Tags: 150/200, NFC: 75/100</span>
                    </div>
                  </div>
                </div>

                {/* Section 5: Notes & Attachments */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Notes & Attachments</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Additional notes about this hub..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Attachments
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          Attach photos/docs (e.g., door instructions)
                        </p>
                        <button className="mt-2 text-sm text-blue-600 hover:text-blue-800">
                          Choose files
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <button
                onClick={() => setShowHubDetail(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHub}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
