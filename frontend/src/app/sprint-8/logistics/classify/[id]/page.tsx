'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  MapPin,
  Clock,
  User,
  Tag,
  Cpu,
  CheckCircle,
  AlertCircle,
  Info,
  FileText,
  Upload,
  AlertTriangle,
  X,
  Shield,
  Zap,
  Globe,
  Weight,
  ChevronRight
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
  urgency_level: string;
  sender_name: string;
  sender_city: string;
  sender_country: string;
  buyer_name: string;
  buyer_city: string;
  buyer_country: string;
  status: string;
  tier?: string;
  documents: any[];
  warnings: any[];
  fragility_level?: string;
  high_value?: boolean;
  temperature_sensitive?: boolean;
  photo_proof_required?: boolean;
  product_image?: string;
  category?: string;
}

interface JustificationReason {
  code: string;
  label: string;
  description: string;
}

const tiers = [
  {
    id: 'T1',
    name: 'Tier 1',
    subtitle: 'Essential Protection',
    description: 'Digital certificates and basic tracking',
    icon: Shield,
    color: '#2563eb',
    features: [
      'Digital authentication certificate',
      'Standard delivery timeline',
      'Email notifications',
      'Basic security protocols'
    ],
    hint: 'Perfect for standard items with digital verification needs'
  },
  {
    id: 'T2',
    name: 'Tier 2',
    subtitle: 'Physical Verification',
    description: 'Physical tags with enhanced tracking',
    icon: Tag,
    color: '#7c3aed',
    features: [
      'Physical security tags',
      'Real-time tracking updates',
      'Priority handling',
      'SMS & Email alerts'
    ],
    hint: 'Ideal for valuable items requiring physical authentication'
  },
  {
    id: 'T3',
    name: 'Tier 3',
    subtitle: 'Maximum Security',
    description: 'NFC technology with white-glove service',
    icon: Cpu,
    color: '#dc2626',
    features: [
      'NFC chip integration',
      'Secure textile attachment',
      'Real-time telemetry',
      'Dedicated handling team'
    ],
    hint: 'Required for luxury items and high-security shipments'
  }
];

const justificationReasons: JustificationReason[] = [
  { code: 'VALUE_BASED', label: 'Value-based classification', description: 'Tier selected based on declared value thresholds' },
  { code: 'FRAGILITY', label: 'Fragility requirements', description: 'Tier required due to fragile/delicate nature' },
  { code: 'BRAND_POLICY', label: 'Brand policy requirement', description: 'Brand-specific handling requirements' },
  { code: 'SECURITY_RISK', label: 'Security risk assessment', description: 'Elevated security needs identified' },
  { code: 'CUSTOMER_REQUEST', label: 'Customer requested upgrade', description: 'Customer specifically requested higher tier' },
  { code: 'CLIENT_PREFERENCE', label: 'Client preference', description: 'Classification based on client-specified service requirements' },
  { code: 'REGULATORY', label: 'Regulatory compliance', description: 'Regulatory requirements mandate this tier' },
  { code: 'OPERATIONAL', label: 'Operational considerations', description: 'Operational factors favor this tier choice' },
  { code: 'OTHER', label: 'Other reason', description: 'Other justification (specify in notes)' }
];

export default function ClassifyShipmentPage() {
  const params = useParams();
  const router = useRouter();
  const { toasts, showSuccess, showError, removeToast } = useToast();
  
  const [shipment, setShipment] = useState<ShipmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [wgDelivery, setWgDelivery] = useState(false);

  // Add spin animation for loading state
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Shared styles - wallet-like design pattern
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

  useEffect(() => {
    const fetchShipment = async () => {
      try {
        setLoading(true);
        console.log('Fetching shipment with ID:', params.id);
        const response = await api.getShipmentById(params.id as string);
        console.log('API response:', response);
        if (response.shipment) {
          setShipment(response.shipment);
          console.log('Shipment loaded successfully:', response.shipment.shipment_id);
        } else {
          console.error('No shipment data in response');
          showError('No Shipment Data', 'API returned empty shipment data');
        }
      } catch (error) {
        console.error('Error fetching shipment:', error);
        showError(
          'Failed to Load Shipment',
          error instanceof Error ? error.message : 'Could not load shipment details'
        );
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchShipment();
    }
  }, [params.id]);

  const handleTierSelection = (tier: string) => {
    setSelectedTier(tier);
  };

  const handleClassify = async () => {
    if (!selectedTier || !shipment || !selectedReason || attachments.length === 0) return;

    setClassifying(true);
    try {
      const justification = {
        reason: selectedReason,
        notes: notes,
        attachments: attachments.map(f => f.name),
        wgDelivery: wgDelivery
      };

      await api.classifyShipment(shipment.shipment_id, selectedTier, JSON.stringify(justification));
      
      const wgText = wgDelivery ? ' with WG delivery' : '';
      showSuccess(
        'Tier Assigned Successfully!',
        `${selectedTier}${wgText} has been assigned. Redirecting to Quote & Plan...`,
        3000
      );

      setTimeout(() => {
        router.push(`/sprint-8/logistics/plan/${shipment.shipment_id}`);
      }, 1500);
    } catch (error) {
      console.error('Error classifying shipment:', error);
      showError(
        'Classification Failed',
        error instanceof Error ? error.message : 'Could not assign tier'
      );
    } finally {
      setClassifying(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getTierColor = (tierId: string) => {
    const tier = tiers.find(t => t.id === tierId);
    return tier?.color || '#666';
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
        <div style={{ margin: "32px 0" }}>
          <div style={{ textAlign: "center", paddingTop: "80px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              border: "3px solid #e0e0e0",
              borderTop: "3px solid #000",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px auto"
            }}></div>
            <p style={{ color: "#666", fontSize: "16px" }}>Loading shipment details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
        <div style={{ margin: "32px 0" }}>
          <div style={card}>
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <AlertCircle style={{ width: "48px", height: "48px", color: "#dc2626", margin: "0 auto 16px auto" }} />
              <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#1a1a1a", marginBottom: "8px" }}>
                Shipment Not Found
              </h2>
              <p style={{ color: "#666", fontSize: "14px", marginBottom: "24px" }}>
                The requested shipment could not be found.
              </p>
              <Link
                href="/sprint-8/logistics/classify"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "12px 24px",
                  background: "#000",
                  color: "#fff",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: "500"
                }}
              >
                Back to Tier Gate
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
      {/* Header */}
      <div style={{ margin: "32px 0" }}>
        <Link 
          href="/sprint-8/logistics/classify" 
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
          Back to Tier Gate
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
          Classify Shipment
        </h1>
        <p style={{ color: "#666", fontSize: "16px", lineHeight: "1.5" }}>
          Assign the appropriate processing tier based on shipment requirements.
        </p>
      </div>

      {/* Product Information */}
      <div style={card}>
        <h3 style={sectionTitle}>
          <Package size={20} />
          Product Information
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "24px" }}>
          {/* Product Image */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: "120px",
              height: "120px",
              background: "#f5f5f5",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #e0e0e0",
              overflow: "hidden",
              position: "relative"
            }}>
              {shipment.product_image ? (
                <img 
                  src={shipment.product_image} 
                  alt={shipment.brand}
                  style={{ 
                    width: "100%", 
                    height: "100%", 
                    objectFit: "cover",
                    borderRadius: "12px"
                  }}
                  onError={(e) => {
                    console.log('Image failed to load:', shipment.product_image);
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      const fallback = parent.querySelector('.fallback-icon') as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }
                  }}
                  onLoad={() => {
                    console.log('Image loaded successfully:', shipment.product_image);
                  }}
                />
              ) : null}
              <div 
                className="fallback-icon"
                style={{ 
                  width: "100%", 
                  height: "100%", 
                  display: shipment.product_image ? "none" : "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: shipment.product_image ? "absolute" : "static",
                  top: 0,
                  left: 0
                }}
              >
                <Package style={{ width: "48px", height: "48px", color: "#999" }} />
              </div>
            </div>
            {shipment.product_image && (
              <p style={{ 
                fontSize: "10px", 
                color: "#999", 
                marginTop: "4px", 
                textAlign: "center",
                wordBreak: "break-all" 
              }}>
                {shipment.product_image.split('/').pop()}
              </p>
            )}
          </div>

          {/* Product Details */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "24px", fontWeight: "600", color: "#1a1a1a", marginBottom: "4px" }}>
                  {shipment.brand}
                </h2>
                <p style={{ color: "#666", marginBottom: "8px" }}>{shipment.category || 'Luxury Item'}</p>
                <div style={{ display: "flex", gap: "12px" }}>
                  <span style={{ 
                    fontSize: "12px", 
                    color: "#666", 
                    fontFamily: "monospace",
                    background: "#f5f5f5",
                    padding: "4px 8px",
                    borderRadius: "4px"
                  }}>
                    {shipment.reference_sku}
                  </span>
                  <span style={{ 
                    fontSize: "12px", 
                    color: "#2563eb", 
                    fontFamily: "monospace",
                    background: "#eff6ff",
                    padding: "4px 8px",
                    borderRadius: "4px"
                  }}>
                    ID: {shipment.shipment_id}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "12px", color: "#666", marginBottom: "2px" }}>Declared Value</p>
                <p style={{ fontSize: "20px", fontWeight: "600", color: "#16a34a" }}>
                  {formatCurrency(shipment.declared_value, shipment.currency)}
                </p>
                <div style={{ 
                  marginTop: "8px", 
                  padding: "4px 12px", 
                  background: "#f0fdf4", 
                  borderRadius: "6px",
                  color: "#166534",
                  fontSize: "12px",
                  fontWeight: "500"
                }}>
                  Awaiting Classification
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" }}>
              <div style={{ background: "#f8f9fa", borderRadius: "8px", padding: "12px", border: "1px solid #e9ecef" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                  <AlertTriangle style={{ width: "14px", height: "14px", marginRight: "6px", color: "#dc2626" }} />
                  <span style={{ fontSize: "12px", fontWeight: "500", color: "#666" }}>Fragility</span>
                </div>
                <p style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "13px", textTransform: "capitalize" }}>
                  {shipment.fragility_level || 'Standard'}
                </p>
              </div>
              
              <div style={{ background: "#f8f9fa", borderRadius: "8px", padding: "12px", border: "1px solid #e9ecef" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                  <Globe style={{ width: "14px", height: "14px", marginRight: "6px", color: "#2563eb" }} />
                  <span style={{ fontSize: "12px", fontWeight: "500", color: "#666" }}>Route</span>
                </div>
                <p style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "13px" }}>
                  {shipment.sender_country.substring(0, 3)} → {shipment.buyer_country.substring(0, 3)}
                </p>
              </div>
              
              <div style={{ background: "#f8f9fa", borderRadius: "8px", padding: "12px", border: "1px solid #e9ecef" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                  <Weight style={{ width: "14px", height: "14px", marginRight: "6px", color: "#7c3aed" }} />
                  <span style={{ fontSize: "12px", fontWeight: "500", color: "#666" }}>Weight</span>
                </div>
                <p style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "13px" }}>
                  {shipment.weight} {shipment.weight_unit}
                </p>
              </div>
              
              <div style={{ background: "#f8f9fa", borderRadius: "8px", padding: "12px", border: "1px solid #e9ecef" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                  <Clock style={{ width: "14px", height: "14px", marginRight: "6px", color: "#f59e0b" }} />
                  <span style={{ fontSize: "12px", fontWeight: "500", color: "#666" }}>SLA</span>
                </div>
                <p style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "13px", textTransform: "capitalize" }}>
                  {shipment.urgency_level}
                </p>
              </div>
              
              <div style={{ background: "#f8f9fa", borderRadius: "8px", padding: "12px", border: "1px solid #e9ecef" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                  <User style={{ width: "14px", height: "14px", marginRight: "6px", color: "#16a34a" }} />
                  <span style={{ fontSize: "12px", fontWeight: "500", color: "#666" }}>From</span>
                </div>
                <p style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "13px" }}>
                  {shipment.sender_city}
                </p>
              </div>
              
              <div style={{ background: "#f8f9fa", borderRadius: "8px", padding: "12px", border: "1px solid #e9ecef" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                  <MapPin style={{ width: "14px", height: "14px", marginRight: "6px", color: "#6366f1" }} />
                  <span style={{ fontSize: "12px", fontWeight: "500", color: "#666" }}>To</span>
                </div>
                <p style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "13px" }}>
                  {shipment.buyer_city}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tier Selection */}
      <div style={card}>
        <h3 style={sectionTitle}>
          <Tag size={20} />
          Select Processing Tier
        </h3>
        <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.5", marginBottom: "24px" }}>
          Choose the security level that best matches this shipment's requirements
        </p>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const isSelected = selectedTier === tier.id;
            
            return (
              <div
                key={tier.id}
                style={{
                  border: isSelected ? `2px solid ${tier.color}` : '2px solid #e5e7eb',
                  borderRadius: "12px",
                  padding: "20px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: isSelected ? `${tier.color}08` : '#fff',
                  position: "relative"
                }}
                onClick={() => handleTierSelection(tier.id)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                {isSelected && (
                  <div style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    background: tier.color,
                    borderRadius: "50%",
                    padding: "6px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}>
                    <CheckCircle style={{ width: "16px", height: "16px", color: "#fff" }} />
                  </div>
                )}

                <div style={{ marginBottom: "16px" }}>
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "48px",
                    height: "48px",
                    background: tier.color,
                    borderRadius: "8px",
                    marginBottom: "12px"
                  }}>
                    <Icon style={{ width: "24px", height: "24px", color: "#fff" }} />
                  </div>
                  <h4 style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a", marginBottom: "4px" }}>
                    {tier.name}
                  </h4>
                  <p style={{ fontSize: "12px", fontWeight: "500", color: "#666" }}>{tier.subtitle}</p>
                </div>
                
                <p style={{ color: "#666", fontSize: "14px", marginBottom: "16px" }}>{tier.description}</p>
                
                <div style={{ marginBottom: "16px" }}>
                  {tier.features.map((feature, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: tier.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: "8px",
                        marginTop: "2px",
                        flexShrink: 0
                      }}>
                        <div style={{ width: "6px", height: "6px", background: "#fff", borderRadius: "50%" }}></div>
                      </div>
                      <p style={{ fontSize: "13px", color: "#555", lineHeight: "1.4" }}>{feature}</p>
                    </div>
                  ))}
                </div>
                
                <div style={{ 
                  background: "#f8f9fa", 
                  borderRadius: "8px", 
                  padding: "12px",
                  border: "1px solid #e9ecef"
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start" }}>
                    <Info style={{ width: "14px", height: "14px", color: "#999", marginTop: "2px", marginRight: "8px", flexShrink: 0 }} />
                    <p style={{ fontSize: "12px", color: "#666", lineHeight: "1.3" }}>{tier.hint}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Decision Justification */}
      <div style={card}>
        <h3 style={sectionTitle}>
          <FileText size={20} />
          Decision Justification
        </h3>
        <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.5", marginBottom: "24px" }}>
          Document your tier selection for audit compliance
        </p>
        
        <div style={{ marginBottom: "32px" }}>
          {/* Reason Selection */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ 
              display: "block", 
              fontSize: "14px", 
              fontWeight: "500", 
              color: "#333", 
              marginBottom: "8px" 
            }}>
              Classification Reason <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                style={{
                  ...input,
                  appearance: "none",
                  backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg width=\"12\" height=\"8\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1.41.59 6 5.17 10.59.59 12 2 6 8 0 2z\" fill=\"%23666\"/></svg>')",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  paddingRight: "40px"
                }}
              >
                <option value="">Select a reason...</option>
                {justificationReasons.map((reason) => (
                  <option key={reason.code} value={reason.code}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>
            {selectedReason && (
              <p style={{ fontSize: "12px", color: "#666", marginTop: "8px", lineHeight: "1.4" }}>
                {justificationReasons.find(r => r.code === selectedReason)?.description}
              </p>
            )}
          </div>

          {/* WG Delivery Checkbox */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              fontSize: "14px", 
              fontWeight: "500", 
              color: "#333", 
              cursor: "pointer",
              padding: "12px",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              background: wgDelivery ? "#f0f9ff" : "#fff",
              transition: "all 0.2s"
            }}>
              <input
                type="checkbox"
                checked={wgDelivery}
                onChange={(e) => setWgDelivery(e.target.checked)}
                style={{
                  marginRight: "12px",
                  width: "16px",
                  height: "16px",
                  accentColor: "#2563eb"
                }}
              />
              <div>
                <div style={{ fontWeight: "500", marginBottom: "2px" }}>
                  WG Delivery Required
                </div>
                <div style={{ fontSize: "12px", color: "#666", fontWeight: "400" }}>
                  This shipment requires white-glove delivery service with specialized handling
                </div>
              </div>
            </label>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ 
              display: "block", 
              fontSize: "14px", 
              fontWeight: "500", 
              color: "#333", 
              marginBottom: "8px" 
            }}>
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                ...input,
                resize: "none",
                minHeight: "100px"
              }}
              rows={4}
              placeholder="Add any additional context for this tier assignment..."
            />
          </div>

          {/* File Attachments */}
          <div>
            <label style={{ 
              display: "block", 
              fontSize: "14px", 
              fontWeight: "500", 
              color: "#333", 
              marginBottom: "8px" 
            }}>
              Supporting Documents <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <div style={{
              border: "2px dashed #d1d5db",
              borderRadius: "8px",
              padding: "24px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s"
            }}>
              <input
                type="file"
                id="file-upload"
                style={{ display: "none" }}
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="file-upload"
                style={{ cursor: "pointer" }}
              >
                <div style={{
                  background: "#f0f9ff",
                  borderRadius: "8px",
                  padding: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "12px"
                }}>
                  <Upload style={{ width: "24px", height: "24px", color: "#2563eb" }} />
                </div>
                <p style={{ fontSize: "14px", color: "#333", marginBottom: "4px", fontWeight: "500" }}>
                  Click to upload supporting documents
                </p>
                <p style={{ fontSize: "12px", color: "#666" }}>
                  PDF, JPG, PNG, DOC, DOCX (max 10MB each)
                </p>
              </label>
            </div>
            
            {attachments.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                {attachments.map((file, index) => (
                  <div key={index} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#f8f9fa",
                    padding: "12px",
                    borderRadius: "8px",
                    marginBottom: "8px",
                    border: "1px solid #e9ecef"
                  }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{
                        background: "#000",
                        borderRadius: "6px",
                        padding: "6px",
                        marginRight: "12px"
                      }}>
                        <FileText style={{ width: "16px", height: "16px", color: "#fff" }} />
                      </div>
                      <div>
                        <p style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "14px" }}>{file.name}</p>
                        <p style={{ fontSize: "12px", color: "#666" }}>
                          {Math.round(file.size / 1024)}KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeAttachment(index)}
                      style={{
                        color: "#dc2626",
                        background: "none",
                        border: "none",
                        padding: "4px",
                        borderRadius: "4px",
                        cursor: "pointer"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <X style={{ width: "16px", height: "16px" }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        ...card,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <Link
          href="/sprint-8/logistics/classify"
          style={{
            color: "#666",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: "500",
            transition: "color 0.2s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#000")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
        >
          Cancel
        </Link>
        
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Validation messages */}
          {(!selectedTier || !selectedReason || attachments.length === 0) && (
            <div style={{
              fontSize: "12px",
              color: "#f59e0b",
              display: "flex",
              alignItems: "center",
              background: "#fffbeb",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #fde68a"
            }}>
              <AlertCircle style={{ width: "14px", height: "14px", marginRight: "6px" }} />
              {!selectedTier 
                ? 'Select a tier'
                : !selectedReason 
                  ? 'Select a reason'
                  : 'Add supporting documents'
              }
            </div>
          )}
          
          <button
            onClick={handleClassify}
            disabled={!selectedTier || !selectedReason || attachments.length === 0 || classifying}
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: selectedTier && selectedReason && attachments.length > 0 && !classifying ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              border: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: selectedTier && selectedReason && attachments.length > 0 && !classifying 
                ? getTierColor(selectedTier) 
                : '#e5e7eb',
              color: selectedTier && selectedReason && attachments.length > 0 && !classifying 
                ? '#fff' 
                : '#9ca3af'
            }}
            onMouseEnter={(e) => {
              if (selectedTier && selectedReason && attachments.length > 0 && !classifying) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTier && selectedReason && attachments.length > 0 && !classifying) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {classifying ? (
              <>
                <div style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid #fff",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }}></div>
                Assigning Tier...
              </>
            ) : (
              <>
                <CheckCircle style={{ width: "16px", height: "16px" }} />
                Assign {selectedTier || 'Tier'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}