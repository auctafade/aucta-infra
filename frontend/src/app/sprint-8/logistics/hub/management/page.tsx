'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, Search, Edit, Trash2, MapPin, Phone, Mail, 
  DollarSign, Clock, Users, Globe, Save, X, CheckCircle,
  AlertTriangle, Package, Copy, Star, Eye, Map, List, 
  Settings, Download, Upload, Filter, MoreHorizontal,
  ChevronDown, Tag, Smartphone, FileText, Camera,
  Shield, Zap, ChevronRight, AlertCircle, Navigation,
  ArrowLeft, Info
} from 'lucide-react';

// Types for Hub Management
interface Hub {
  id: string;
  code: string;
  name: string;
  location: string;
  timezone: string;
  status: 'active' | 'archived' | 'test';
  roles: ('authenticator' | 'couturier')[];
  logo?: string;
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
  auth_capacity?: number;
  sewing_capacity?: number;
  qa_capacity?: number;
  working_days?: string[];
  working_hours_start?: string;
  working_hours_end?: string;
  operating_hours?: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
  time_per_product?: {
    tier2_auth_minutes: number;
    tier3_auth_minutes: number;
    sewing_minutes: number;
    qa_minutes: number;
  };
  notes?: string;
  attachments?: any[];
  created_at: string;
  updated_at: string;
}

interface HubFormData {
  name: string;
  code: string;
  roles: ('authenticator' | 'couturier')[];
  status: 'active' | 'archived' | 'test';
  logo?: string;
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
  operating_hours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
  time_per_product: {
    tier2_auth_minutes: number;
    tier3_auth_minutes: number;
    sewing_minutes: number;
    qa_minutes: number;
  };
  notes: string;
  attachments: any[];
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
    logo: '',
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
    operating_hours: {
      monday: { open: '09:00', close: '17:00', closed: false },
      tuesday: { open: '09:00', close: '17:00', closed: false },
      wednesday: { open: '09:00', close: '17:00', closed: false },
      thursday: { open: '09:00', close: '17:00', closed: false },
      friday: { open: '09:00', close: '17:00', closed: false },
      saturday: { open: '09:00', close: '13:00', closed: false },
      sunday: { open: '09:00', close: '17:00', closed: true }
    },
    time_per_product: {
      tier2_auth_minutes: 45,
      tier3_auth_minutes: 60,
      sewing_minutes: 120,
      qa_minutes: 30
    },
    notes: '',
    attachments: []
  });

  // Shared styles - matching the new shipment page
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

  const inputError: React.CSSProperties = {
    ...input,
    border: "1px solid #dc2626",
  };

  const select: React.CSSProperties = {
    ...input,
    appearance: "none",
    backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg width=\"12\" height=\"8\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1.41.59 6 5.17 10.59.59 12 2 6 8 0 2z\" fill=\"%23666\"/></svg>')",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: "40px",
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

  const gridTwo: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  };

  const gridThree: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "16px",
  };

  const gridFour: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
  };

  const badge = (color: 'green' | 'blue' | 'yellow' | 'gray' | 'purple'): React.CSSProperties => {
    const colors = {
      green: { bg: "#dcfce7", text: "#166534" },
      blue: { bg: "#dbeafe", text: "#1e40af" },
      yellow: { bg: "#fef3c7", text: "#92400e" },
      gray: { bg: "#f3f4f6", text: "#374151" },
      purple: { bg: "#ede9fe", text: "#5b21b6" }
    };
    const selected = colors[color];
    return {
      padding: "4px 8px",
      borderRadius: "12px",
      fontSize: "12px",
      fontWeight: 500,
      background: selected.bg,
      color: selected.text,
      display: "inline-block"
    };
  };

  const banner = (type: "error" | "warn" | "success" | "info") => {
    const map = {
      error: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c", icon: AlertCircle },
      warn: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", icon: AlertTriangle },
      success: { bg: "#ecfdf5", border: "#d1fae5", color: "#065f46", icon: CheckCircle },
      info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af", icon: Info },
    }[type];
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

  useEffect(() => {
    loadHubs();
  }, [filters]);

  const loadHubs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/hubs');
      
      if (!response.ok) {
        throw new Error('Failed to fetch hubs');
      }
      
      const data = await response.json();
      console.log('Loaded hubs data:', data); // Debug log
      
      // Handle both array format and wrapped format
      let hubsArray;
      if (Array.isArray(data)) {
        hubsArray = data;
      } else if (data && Array.isArray(data.data)) {
        hubsArray = data.data;
      } else if (data && data.success && Array.isArray(data.data)) {
        hubsArray = data.data;
      } else {
        console.error('API returned unexpected data format:', data);
        hubsArray = [];
      }
      
      setHubs(hubsArray);
      setLoading(false);
    } catch (error) {
      console.error('Error loading hubs:', error);
      setHubs([]);
      setLoading(false);
    }
  };

  const handleCreateHub = () => {
    setEditingHub(null);
    setFormData({
      name: '',
      code: '',
      roles: ['authenticator'],
      status: 'active',
      logo: '',
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
      operating_hours: {
        monday: { open: '09:00', close: '17:00', closed: false },
        tuesday: { open: '09:00', close: '17:00', closed: false },
        wednesday: { open: '09:00', close: '17:00', closed: false },
        thursday: { open: '09:00', close: '17:00', closed: false },
        friday: { open: '09:00', close: '17:00', closed: false },
        saturday: { open: '09:00', close: '13:00', closed: false },
        sunday: { open: '09:00', close: '17:00', closed: true }
      },
      time_per_product: {
        tier2_auth_minutes: 45,
        tier3_auth_minutes: 60,
        sewing_minutes: 120,
        qa_minutes: 30
      },
      notes: '',
      attachments: []
    });
    setShowHubDetail(true);
  };

  const handleEditHub = (hub: Hub) => {
    setEditingHub(hub);
    setFormData({
      name: hub.name,
      code: hub.code,
      roles: hub.roles || ['authenticator'],
      status: hub.status,
      logo: hub.logo || '',
      address: hub.address || {
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: ''
      },
      timezone: hub.timezone,
      contact_info: {
        name: (hub.contact_info as any)?.name || '',
        email: (hub.contact_info as any)?.email || '',
        phone: (hub.contact_info as any)?.phone || ''
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
          rush_percent: hub.special_surcharges?.rush_percent || 25,
          fragile_fee: hub.special_surcharges?.fragile_fee || 15,
          weekend_fee: hub.special_surcharges?.weekend_fee || 50,
        }
      },
      operating_hours: hub.operating_hours || {
        monday: { open: '09:00', close: '17:00', closed: false },
        tuesday: { open: '09:00', close: '17:00', closed: false },
        wednesday: { open: '09:00', close: '17:00', closed: false },
        thursday: { open: '09:00', close: '17:00', closed: false },
        friday: { open: '09:00', close: '17:00', closed: false },
        saturday: { open: '09:00', close: '13:00', closed: false },
        sunday: { open: '09:00', close: '17:00', closed: true }
      },
      time_per_product: hub.time_per_product || {
        tier2_auth_minutes: 45,
        tier3_auth_minutes: 60,
        sewing_minutes: 120,
        qa_minutes: 30
      },
      notes: hub.notes || '',
      attachments: hub.attachments || []
    });
    setShowHubDetail(true);
  };

  const handleSaveHub = async () => {
    try {
      setSaving(true);
      
      console.log('🔧 Starting hub save process...');
      console.log('📋 Form data:', formData);
      
      // Client-side validation
      if (!formData.code || formData.code.length > 10) {
        alert('Hub code is required and must be 10 characters or less.');
        setSaving(false);
        return;
      }
      
      if (!formData.name || formData.name.length > 100) {
        alert('Hub name is required and must be 100 characters or less.');
        setSaving(false);
        return;
      }
      
      if (!formData.address.city || !formData.address.country) {
        alert('City and country are required.');
        setSaving(false);
        return;
      }
      
      // Prepare data for API
      const hubData = {
        code: formData.code || '',
        name: formData.name || '',
        location: `${formData.address?.city || ''}, ${formData.address?.country || ''}`,
        timezone: formData.timezone || 'Europe/London',
        status: formData.status || 'active',
        roles: formData.roles || ['authenticator'],
        logo: formData.logo || null,
        address: formData.address || {
          street: '',
          city: '',
          postal_code: '',
          country: ''
        },
        contact_info: formData.contact_info || {
          name: '',
          email: '',
          phone: ''
        },
        pricing: formData.pricing || {},
        operating_hours: formData.operating_hours || {},
        time_per_product: formData.time_per_product || {},
        special_surcharges: formData.pricing?.special_surcharges || {},
        notes: formData.notes || '',
        attachments: formData.attachments || []
      };
      
      console.log('📤 Hub data to send:', hubData);
      
      const url = editingHub ? `/api/hubs/${editingHub.id}` : '/api/hubs';
      const method = editingHub ? 'PUT' : 'POST';
      
      console.log(`🌐 Making ${method} request to:`, url);
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(hubData),
      });
      
      console.log('📥 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Hub save failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        // Check for specific error types
        if (errorText.includes('value too long')) {
          throw new Error('One or more fields are too long. Please check field limits (e.g., Hub Code max 10 characters).');
        } else if (errorText.includes('duplicate key')) {
          throw new Error('A hub with this code already exists. Please use a different code.');
        } else {
          throw new Error(`Failed to save hub: ${response.status} ${response.statusText}`);
        }
      }
      
      const result = await response.json();
      console.log('📥 Response data:', result);
      
      if (result.success !== false) {
        console.log('✅ Hub saved successfully');
        setShowHubDetail(false);
        loadHubs(); // Reload hubs from database
        setSaving(false);
      } else {
        console.error('❌ Backend returned success: false');
        throw new Error(result.error || 'Failed to save hub');
      }
    } catch (error) {
      console.error('❌ Error in handleSaveHub:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        editingHub: editingHub ? editingHub.id : 'NEW HUB'
      });
      const errorMessage = error instanceof Error ? error.message : 'Failed to save hub. Please try again.';
      alert(errorMessage);
      setSaving(false);
    }
  };

  const handleDeleteHub = async (hubId: string) => {
    if (!confirm('Are you sure you want to permanently delete this hub? This action cannot be undone.')) return;
    
    try {
      console.log('🗑️ Starting hub deletion process for ID:', hubId);
      
      const response = await fetch(`/api/hubs/${hubId}`, {
        method: 'DELETE',
      });
      
      console.log('📥 Delete response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Hub deletion failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Failed to delete hub: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('📥 Delete response data:', result);
      
      if (result.success) {
        console.log('✅ Hub deleted successfully');
        loadHubs(); // Reload hubs from database
      } else {
        console.error('❌ Backend returned success: false for deletion');
        throw new Error(result.error || 'Failed to delete hub');
      }
    } catch (error) {
      console.error('❌ Error in handleDeleteHub:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        hubId: hubId
      });
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete hub. Please try again.';
      alert(errorMessage);
    }
  };

  const handleDuplicateHub = async (hub: Hub) => {
    try {
      // Create duplicate with modified name and code
      const duplicateData = {
        code: hub.code + '-COPY',
        name: hub.name + ' (Copy)',
        location: hub.location,
        timezone: hub.timezone,
        status: hub.status,
        roles: hub.roles || ['authenticator'],
        logo: hub.logo,
        address: hub.address || {
          street: '',
          city: '',
          state: '',
          postal_code: '',
          country: ''
        },
        contact_info: hub.contact_info || {
          name: '',
          email: '',
          phone: ''
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
          special_surcharges: hub.special_surcharges || {}
        },
        operating_hours: hub.operating_hours || {
          monday: { open: '09:00', close: '17:00', closed: false },
          tuesday: { open: '09:00', close: '17:00', closed: false },
          wednesday: { open: '09:00', close: '17:00', closed: false },
          thursday: { open: '09:00', close: '17:00', closed: false },
          friday: { open: '09:00', close: '17:00', closed: false },
          saturday: { open: '09:00', close: '13:00', closed: false },
          sunday: { open: '09:00', close: '17:00', closed: true }
        },
        time_per_product: hub.time_per_product || {
          tier2_auth_minutes: 45,
          tier3_auth_minutes: 60,
          sewing_minutes: 120,
          qa_minutes: 30
        }
      };
      
      const response = await fetch('/api/hubs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(duplicateData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to duplicate hub');
      }
      
      const result = await response.json();
      
      if (result.success) {
        loadHubs(); // Reload hubs from database
      } else {
        throw new Error(result.error || 'Failed to duplicate hub');
      }
    } catch (error) {
      console.error('Error duplicating hub:', error);
      alert('Failed to duplicate hub. Please try again.');
    }
  };

  const getRoleColor = (role: string) => {
    return role === 'authenticator' ? 'green' : 'blue';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'test': return 'yellow';
      case 'archived': return 'gray';
      default: return 'gray';
    }
  };

  const filteredHubs = (Array.isArray(hubs) ? hubs : []).filter(hub => {
    if (filters.role && !(hub.roles || []).includes(filters.role as any)) return false;
    if (filters.status && hub.status !== filters.status) return false;
    if (filters.country && !(hub.address?.country || '').toLowerCase().includes(filters.country.toLowerCase())) return false;
    if (filters.city && !(hub.address?.city || '').toLowerCase().includes(filters.city.toLowerCase())) return false;
    if (filters.currency && hub.currency !== filters.currency) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return hub.name.toLowerCase().includes(searchLower) ||
             hub.code.toLowerCase().includes(searchLower) ||
             (hub.address?.street || '').toLowerCase().includes(searchLower) ||
             (hub.address?.city || '').toLowerCase().includes(searchLower);
    }
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e0", marginBottom: "32px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: "32px", fontWeight: 300, marginBottom: "8px", letterSpacing: "-0.02em", color: "#1a1a1a" }}>
                Hubs Manager
              </h1>
              <p style={{ color: "#666", fontSize: "16px" }}>Add, Map, Categorize, Price</p>
            </div>
            
            {/* Tab Navigation */}
            <div style={{ display: "flex", gap: "4px", background: "#f3f4f6", borderRadius: "8px", padding: "4px" }}>
              <button
                onClick={() => setCurrentTab('directory')}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: currentTab === 'directory' ? "#fff" : "transparent",
                  color: currentTab === 'directory' ? "#111" : "#6b7280",
                  boxShadow: currentTab === 'directory' ? "0 1px 2px rgba(0,0,0,0.05)" : "none"
                }}
              >
                Hubs Directory
              </button>
              <button
                onClick={() => setCurrentTab('jobs')}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: currentTab === 'jobs' ? "#fff" : "transparent",
                  color: currentTab === 'jobs' ? "#111" : "#6b7280",
                  boxShadow: currentTab === 'jobs' ? "0 1px 2px rgba(0,0,0,0.05)" : "none"
                }}
              >
                Jobs
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {currentTab === 'directory' && (
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
          {/* Actions Bar */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {/* View Toggle */}
                <div style={{ display: "flex", gap: "4px", background: "#f3f4f6", borderRadius: "8px", padding: "4px" }}>
                  <button
                    onClick={() => setViewMode('list')}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      background: viewMode === 'list' ? "#fff" : "transparent",
                      boxShadow: viewMode === 'list' ? "0 1px 2px rgba(0,0,0,0.05)" : "none"
                    }}
                  >
                    <List size={16} color={viewMode === 'list' ? "#111" : "#6b7280"} />
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      background: viewMode === 'map' ? "#fff" : "transparent",
                      boxShadow: viewMode === 'map' ? "0 1px 2px rgba(0,0,0,0.05)" : "none"
                    }}
                  >
                    <Map size={16} color={viewMode === 'map' ? "#111" : "#6b7280"} />
                  </button>
                </div>

                {/* Search */}
                <div style={{ position: "relative" }}>
                  <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} size={16} />
                  <input
                    type="text"
                    placeholder="Search hubs..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    style={{
                      paddingLeft: "36px",
                      paddingRight: "16px",
                      padding: "8px 16px 8px 36px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      minWidth: "200px"
                    }}
                  />
                </div>

                {/* Filters */}
                <select
                  value={filters.role}
                  onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                  style={{ ...select, width: "auto", minWidth: "140px" }}
                >
                  <option value="">All Roles</option>
                  <option value="authenticator">HubId (Auth)</option>
                  <option value="couturier">HubCou (Sew)</option>
                </select>

                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  style={{ ...select, width: "auto", minWidth: "120px" }}
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="test">Test</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Primary Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={handleCreateHub}
                  style={btnPrimary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#000")}
                >
                  <Plus size={16} />
                  New Hub
                </button>
                
                <button 
                  style={btnSecondary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Download size={16} />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Results Summary */}
            <div style={{ padding: "12px 16px", background: "#f9fafb", borderRadius: "8px", fontSize: "14px", color: "#6b7280" }}>
              {filteredHubs.length} hub{filteredHubs.length !== 1 ? 's' : ''} found
            </div>
          </div>

          {/* Content Area */}
          {viewMode === 'list' ? (
            <div style={card}>
              {loading ? (
                <div style={{ padding: "48px", textAlign: "center" }}>
                  <div style={{
                    width: "32px",
                    height: "32px",
                    border: "3px solid #e0e0e0",
                    borderTop: "3px solid #2563eb",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 16px"
                  }}></div>
                  <p style={{ color: "#6b7280" }}>Loading hubs...</p>
                </div>
              ) : filteredHubs.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center" }}>
                  <Building2 size={48} color="#9ca3af" style={{ margin: "0 auto 16px" }} />
                  <h3 style={{ fontSize: "18px", fontWeight: 500, color: "#111", marginBottom: "8px" }}>
                    No hubs found
                  </h3>
                  <p style={{ color: "#6b7280", marginBottom: "24px" }}>
                    Get started by creating your first hub.
                  </p>
                  <button
                    onClick={handleCreateHub}
                    style={{ ...btnPrimary, margin: "0 auto" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#000")}
                  >
                    Create Hub
                  </button>
                </div>
              ) : (
                <div>
                  {filteredHubs.map((hub, index) => (
                    <div key={hub.id} style={{
                      padding: "24px",
                      borderBottom: index < filteredHubs.length - 1 ? "1px solid #e0e0e0" : "none",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "16px" }}>
                          {/* Hub Logo */}
                          <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "8px",
                            background: hub.logo ? "transparent" : "#f3f4f6",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid #e5e7eb",
                            overflow: "hidden"
                          }}>
                            {hub.logo ? (
                              <img 
                                src={hub.logo} 
                                alt={`${hub.name} logo`} 
                                style={{ 
                                  width: "100%", 
                                  height: "100%", 
                                  objectFit: "cover" 
                                }} 
                              />
                            ) : (
                              <Building2 size={20} style={{ color: "#9ca3af" }} />
                            )}
                          </div>
                          
                          {/* Hub Details */}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                              <h3 style={{ fontSize: "18px", fontWeight: 500, color: "#111" }}>
                                {hub.name}
                              </h3>
                              <span style={{ fontSize: "14px", color: "#6b7280", fontFamily: "monospace" }}>
                                {hub.code}
                              </span>
                              <div style={{ display: "flex", gap: "4px" }}>
                                {(hub.roles || []).map((role) => (
                                  <span
                                    key={role}
                                    style={badge(getRoleColor(role))}
                                  >
                                    {role === 'authenticator' ? 'Id' : 'Cou'}
                                  </span>
                                ))}
                              </div>
                              <span style={badge(getStatusColor(hub.status))}>
                                {hub.status === 'test' && '🧪 '}
                                {hub.status}
                              </span>
                            </div>
                            
                            <div style={{ display: "flex", alignItems: "center", gap: "24px", fontSize: "14px", color: "#6b7280" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <MapPin size={16} />
                                <span>{hub.address?.city || 'Unknown'}, {hub.address?.country || 'Unknown'}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <DollarSign size={16} />
                                <span>{hub.currency}</span>
                              </div>
                              {hub.tier2_auth_fee && (
                                <span>From {hub.currency} {hub.tier2_auth_fee} (auth fee)</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            onClick={() => handleEditHub(hub)}
                            style={{ padding: "8px", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", transition: "color 0.2s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#4b5563")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDuplicateHub(hub)}
                            style={{ padding: "8px", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", transition: "color 0.2s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#4b5563")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteHub(hub.id)}
                            style={{ padding: "8px", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", transition: "color 0.2s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
                          >
                            <Trash2 size={16} />
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
            <div style={card}>
              <div style={{ height: "400px", background: "#f3f4f6", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <Map size={48} color="#9ca3af" style={{ margin: "0 auto 16px" }} />
                  <h3 style={{ fontSize: "18px", fontWeight: 500, color: "#111", marginBottom: "8px" }}>Map View</h3>
                  <p style={{ color: "#6b7280", marginBottom: "8px" }}>Interactive map showing all hub locations</p>
                  <p style={{ fontSize: "14px", color: "#9ca3af" }}>Map integration coming soon</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Jobs Tab Content */}
      {currentTab === 'jobs' && (
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
          <div style={card}>
            <div style={{ textAlign: "center", padding: "48px" }}>
              <Settings size={48} color="#9ca3af" style={{ margin: "0 auto 16px" }} />
              <h3 style={{ fontSize: "18px", fontWeight: 500, color: "#111", marginBottom: "8px" }}>Hub Jobs Console</h3>
              <p style={{ color: "#6b7280", marginBottom: "8px" }}>Manage hub operations and job execution</p>
              <p style={{ fontSize: "14px", color: "#9ca3af" }}>
                Link to existing hub console functionality
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hub Detail Modal */}
      {showHubDetail && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
          padding: "16px"
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
            maxWidth: "900px",
            width: "100%",
            maxHeight: "90vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "24px",
              borderBottom: "1px solid #e0e0e0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <h2 style={{ fontSize: "24px", fontWeight: 500, color: "#111" }}>
                {editingHub ? 'Edit Hub' : 'New Hub'}
              </h2>
              <button
                onClick={() => setShowHubDetail(false)}
                style={{
                  padding: "8px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9ca3af",
                  transition: "color 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#4b5563")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                {/* Section 1: Identity & Status */}
                <div>
                  <h3 style={sectionTitle}>
                    <Building2 size={20} />
                    Identity & Status
                  </h3>
                  <div style={gridTwo}>
                    <div>
                      <label style={label}>Hub Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        style={input}
                        placeholder="Enter hub name"
                      />
                    </div>
                    
                    <div>
                      <label style={label}>Short Code * (max 10 chars)</label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.slice(0, 10) })}
                        style={input}
                        placeholder="PAR-Id-01"
                        maxLength={10}
                      />
                    </div>

                    <div>
                      <label style={label}>Hub Logo</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                setFormData({ ...formData, logo: event.target?.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          style={{
                            ...input,
                            padding: "8px",
                            cursor: "pointer"
                          }}
                        />
                        {formData.logo && (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <img 
                              src={formData.logo} 
                              alt="Hub logo preview" 
                              style={{ 
                                width: "40px", 
                                height: "40px", 
                                objectFit: "cover", 
                                borderRadius: "4px",
                                border: "1px solid #e5e7eb"
                              }} 
                            />
                            <span style={{ fontSize: "12px", color: "#6b7280" }}>Logo preview</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label style={label}>Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        style={select}
                      >
                        <option value="active">Active</option>
                        <option value="test">Test</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <div>
                      <label style={label}>Roles *</label>
                      <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                        <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
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
                            style={{ marginRight: "8px" }}
                          />
                          <span style={{ fontSize: "14px", color: "#374151" }}>HubId</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
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
                            style={{ marginRight: "8px" }}
                          />
                          <span style={{ fontSize: "14px", color: "#374151" }}>HubCou</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div style={{ marginTop: "24px" }}>
                    <h4 style={{ fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "12px" }}>
                      Contact (Optional)
                    </h4>
                    <div style={gridThree}>
                      <input
                        type="text"
                        value={formData.contact_info.name}
                        onChange={(e) => setFormData({
                          ...formData,
                          contact_info: { ...formData.contact_info, name: e.target.value }
                        })}
                        placeholder="Contact Name"
                        style={input}
                      />
                      <input
                        type="email"
                        value={formData.contact_info.email}
                        onChange={(e) => setFormData({
                          ...formData,
                          contact_info: { ...formData.contact_info, email: e.target.value }
                        })}
                        placeholder="Email"
                        style={input}
                      />
                      <input
                        type="tel"
                        value={formData.contact_info.phone}
                        onChange={(e) => setFormData({
                          ...formData,
                          contact_info: { ...formData.contact_info, phone: e.target.value }
                        })}
                        placeholder="Phone"
                        style={input}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Address & Geo */}
                <div>
                  <h3 style={sectionTitle}>
                    <MapPin size={20} />
                    Address & Geo
                  </h3>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={label}>Street Address *</label>
                    <input
                      type="text"
                      value={formData.address.street}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, street: e.target.value }
                      })}
                      style={input}
                      placeholder="123 Main Street"
                    />
                  </div>
                  
                  <div style={gridThree}>
                    <div>
                      <label style={label}>City *</label>
                      <input
                        type="text"
                        value={formData.address.city}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: { ...formData.address, city: e.target.value }
                        })}
                        style={input}
                        placeholder="Paris"
                      />
                    </div>

                    <div>
                      <label style={label}>Postal Code *</label>
                      <input
                        type="text"
                        value={formData.address.postal_code}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: { ...formData.address, postal_code: e.target.value }
                        })}
                        style={input}
                        placeholder="75001"
                      />
                    </div>

                    <div>
                      <label style={label}>Country *</label>
                      <input
                        type="text"
                        value={formData.address.country}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: { ...formData.address, country: e.target.value }
                        })}
                        style={input}
                        placeholder="France"
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: "16px" }}>
                    <label style={label}>Timezone</label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      style={{ ...select, maxWidth: "300px" }}
                    >
                      <option value="Europe/London">Europe/London</option>
                      <option value="Europe/Paris">Europe/Paris</option>
                      <option value="Europe/Rome">Europe/Rome</option>
                      <option value="Europe/Berlin">Europe/Berlin</option>
                      <option value="Europe/Madrid">Europe/Madrid</option>
                      <option value="Europe/Amsterdam">Europe/Amsterdam</option>
                      <option value="Europe/Zurich">Europe/Zurich</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="America/Los_Angeles">America/Los_Angeles</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                      <option value="Asia/Shanghai">Asia/Shanghai</option>
                      <option value="Asia/Dubai">Asia/Dubai</option>
                    </select>
                  </div>
                </div>

                {/* Section 3: Price Book */}
                <div>
                  <h3 style={sectionTitle}>
                    <DollarSign size={20} />
                    Price Book
                    <span style={{ fontSize: "12px", color: "#9ca3af", fontWeight: 400, marginLeft: "8px" }}>
                      (effective immediately)
                    </span>
                  </h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div>
                      <label style={label}>Currency</label>
                      <select
                        value={formData.pricing.currency}
                        onChange={(e) => setFormData({
                          ...formData,
                          pricing: { ...formData.pricing, currency: e.target.value }
                        })}
                        style={{ ...select, width: "150px" }}
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="CHF">CHF</option>
                        <option value="JPY">JPY</option>
                        <option value="CNY">CNY</option>
                        <option value="AED">AED</option>
                      </select>
                    </div>

                    {/* Authenticator Fees */}
                    {formData.roles.includes('authenticator') && (
                      <div>
                        <h4 style={{ fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <Shield size={16} />
                          Authenticator Fees
                        </h4>
                        <div style={gridTwo}>
                          <div>
                            <label style={{ ...label, fontSize: "12px", color: "#6b7280" }}>Tier 2: Auth Fee</label>
                            <input
                              type="number"
                              value={formData.pricing.tier2_auth_fee}
                              onChange={(e) => setFormData({
                                ...formData,
                                pricing: { ...formData.pricing, tier2_auth_fee: Number(e.target.value) }
                              })}
                              style={input}
                              placeholder="150"
                            />
                          </div>
                          <div>
                            <label style={{ ...label, fontSize: "12px", color: "#6b7280" }}>Tier 2: Tag Unit Cost</label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.pricing.tag_unit_cost}
                              onChange={(e) => setFormData({
                                ...formData,
                                pricing: { ...formData.pricing, tag_unit_cost: Number(e.target.value) }
                              })}
                              style={input}
                              placeholder="12.50"
                            />
                          </div>
                          <div>
                            <label style={{ ...label, fontSize: "12px", color: "#6b7280" }}>Tier 3: Auth Fee</label>
                            <input
                              type="number"
                              value={formData.pricing.tier3_auth_fee}
                              onChange={(e) => setFormData({
                                ...formData,
                                pricing: { ...formData.pricing, tier3_auth_fee: Number(e.target.value) }
                              })}
                              style={input}
                              placeholder="175"
                            />
                          </div>
                          <div>
                            <label style={{ ...label, fontSize: "12px", color: "#6b7280" }}>Tier 3: NFC Unit Cost</label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.pricing.nfc_unit_cost}
                              onChange={(e) => setFormData({
                                ...formData,
                                pricing: { ...formData.pricing, nfc_unit_cost: Number(e.target.value) }
                              })}
                              style={input}
                              placeholder="25.00"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Couturier Fees */}
                    {formData.roles.includes('couturier') && (
                      <div>
                        <h4 style={{ fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <Zap size={16} />
                          Couturier Fees
                        </h4>
                        <div style={gridTwo}>
                          <div>
                            <label style={{ ...label, fontSize: "12px", color: "#6b7280" }}>Sewing Fee</label>
                            <input
                              type="number"
                              value={formData.pricing.sew_fee}
                              onChange={(e) => setFormData({
                                ...formData,
                                pricing: { ...formData.pricing, sew_fee: Number(e.target.value) }
                              })}
                              style={input}
                              placeholder="125"
                            />
                          </div>
                          <div>
                            <label style={{ ...label, fontSize: "12px", color: "#6b7280" }}>QA Fee</label>
                            <input
                              type="number"
                              value={formData.pricing.qa_fee}
                              onChange={(e) => setFormData({
                                ...formData,
                                pricing: { ...formData.pricing, qa_fee: Number(e.target.value) }
                              })}
                              style={input}
                              placeholder="75"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Internal Costs */}
                    <div>
                      <h4 style={{ fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "16px" }}>
                        Internal Costs
                      </h4>
                      <div>
                        <label style={{ ...label, fontSize: "12px", color: "#6b7280" }}>
                          Internal Rollout Cost (per shipment)
                          <span style={{ color: "#9ca3af", marginLeft: "8px" }}>— used for HubId → HubCou leg</span>
                        </label>
                        <input
                          type="number"
                          value={formData.pricing.internal_rollout_cost}
                          onChange={(e) => setFormData({
                            ...formData,
                            pricing: { ...formData.pricing, internal_rollout_cost: Number(e.target.value) }
                          })}
                          style={{ ...input, maxWidth: "200px" }}
                          placeholder="35"
                        />
                      </div>
                    </div>

                    {/* Special Surcharges */}
                    <div>
                      <h4 style={{ fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "16px" }}>
                        Special Requests / Surcharges
                      </h4>
                      <div style={gridThree}>
                        <div>
                          <label style={{ ...label, fontSize: "12px", color: "#6b7280" }}>Rush %</label>
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
                            style={input}
                            placeholder="25"
                          />
                        </div>
                        <div>
                          <label style={{ ...label, fontSize: "12px", color: "#6b7280" }}>
                            Fragile Handling {formData.pricing.currency}
                          </label>
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
                            style={input}
                            placeholder="15"
                          />
                        </div>
                        <div>
                          <label style={{ ...label, fontSize: "12px", color: "#6b7280" }}>
                            Weekend {formData.pricing.currency}
                          </label>
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
                            style={input}
                            placeholder="50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Operations */}
                <div>
                  <h3 style={sectionTitle}>
                    <Settings size={20} />
                    Operations
                  </h3>
                  
                  {/* Operating Hours */}
                  <div style={{ marginBottom: "24px" }}>
                    <label style={label}>Operating Hours</label>
                    <div style={{ display: "grid", gap: "12px" }}>
                      {Object.entries(formData.operating_hours).map(([day, hours]) => (
                        <div key={day} style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: "12px",
                          padding: "8px",
                          background: "#f9fafb",
                          borderRadius: "6px"
                        }}>
                          <div style={{ minWidth: "90px", textTransform: "capitalize", fontSize: "14px", fontWeight: "500" }}>
                            {day}
                          </div>
                          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
                            <input
                              type="checkbox"
                              checked={hours.closed}
                              onChange={(e) => setFormData({
                                ...formData,
                                operating_hours: {
                                  ...formData.operating_hours,
                                  [day]: { ...hours, closed: e.target.checked }
                                }
                              })}
                            />
                            Closed
                          </label>
                          {!hours.closed && (
                            <>
                              <input
                                type="time"
                                value={hours.open}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  operating_hours: {
                                    ...formData.operating_hours,
                                    [day]: { ...hours, open: e.target.value }
                                  }
                                })}
                                style={{ ...input, width: "120px" }}
                              />
                              <span style={{ fontSize: "14px", color: "#6b7280" }}>to</span>
                              <input
                                type="time"
                                value={hours.close}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  operating_hours: {
                                    ...formData.operating_hours,
                                    [day]: { ...hours, close: e.target.value }
                                  }
                                })}
                                style={{ ...input, width: "120px" }}
                              />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Time Per Product */}
                  <div>
                    <label style={label}>Time Needed Per Product (minutes)</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div>
                        <label style={{ ...label, fontSize: "14px", marginBottom: "4px" }}>Tier 2 Authentication</label>
                        <input
                          type="number"
                          value={formData.time_per_product.tier2_auth_minutes}
                          onChange={(e) => setFormData({
                            ...formData,
                            time_per_product: {
                              ...formData.time_per_product,
                              tier2_auth_minutes: Number(e.target.value)
                            }
                          })}
                          style={input}
                          placeholder="45"
                          min="1"
                        />
                      </div>
                      <div>
                        <label style={{ ...label, fontSize: "14px", marginBottom: "4px" }}>Tier 3 Authentication</label>
                        <input
                          type="number"
                          value={formData.time_per_product.tier3_auth_minutes}
                          onChange={(e) => setFormData({
                            ...formData,
                            time_per_product: {
                              ...formData.time_per_product,
                              tier3_auth_minutes: Number(e.target.value)
                            }
                          })}
                          style={input}
                          placeholder="60"
                          min="1"
                        />
                      </div>
                      <div>
                        <label style={{ ...label, fontSize: "14px", marginBottom: "4px" }}>Sewing</label>
                        <input
                          type="number"
                          value={formData.time_per_product.sewing_minutes}
                          onChange={(e) => setFormData({
                            ...formData,
                            time_per_product: {
                              ...formData.time_per_product,
                              sewing_minutes: Number(e.target.value)
                            }
                          })}
                          style={input}
                          placeholder="120"
                          min="1"
                        />
                      </div>
                      <div>
                        <label style={{ ...label, fontSize: "14px", marginBottom: "4px" }}>Quality Assurance</label>
                        <input
                          type="number"
                          value={formData.time_per_product.qa_minutes}
                          onChange={(e) => setFormData({
                            ...formData,
                            time_per_product: {
                              ...formData.time_per_product,
                              qa_minutes: Number(e.target.value)
                            }
                          })}
                          style={input}
                          placeholder="30"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 5: Notes & Attachments */}
                <div>
                  <h3 style={sectionTitle}>
                    <FileText size={20} />
                    Notes & Attachments
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <label style={label}>Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        style={{ ...input, resize: "vertical" }}
                        placeholder="Additional notes about this hub..."
                      />
                    </div>
                    
                    <div>
                      <label style={label}>Attachments</label>
                      <div style={{
                        border: "2px dashed #d1d5db",
                        borderRadius: "8px",
                        padding: "24px",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "border-color 0.2s"
                      }}>
                        <Camera size={32} color="#9ca3af" style={{ margin: "0 auto 8px" }} />
                        <p style={{ fontSize: "14px", color: "#4b5563", marginBottom: "4px" }}>
                          Attach photos/docs (e.g., door instructions)
                        </p>
                        <button style={{ fontSize: "14px", color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>
                          Choose files
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "24px",
              borderTop: "1px solid #e0e0e0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#f9fafb"
            }}>
              <button
                onClick={() => setShowHubDetail(false)}
                style={btnSecondary}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHub}
                disabled={saving}
                style={{
                  ...btnPrimary,
                  background: saving ? "#9ca3af" : "#16a34a",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!saving) {
                    e.currentTarget.style.background = "#15803d";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saving) {
                    e.currentTarget.style.background = "#16a34a";
                  }
                }}
              >
                {saving && (
                  <div style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #fff",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }}></div>
                )}
                <Save size={16} />
                Save Hub
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}