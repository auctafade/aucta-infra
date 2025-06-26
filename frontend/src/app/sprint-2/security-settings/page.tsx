'use client';

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  MapPin, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  User, 
  Globe, 
  Clock, 
  FileText, 
  Upload, 
  Phone, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  Camera,
  Smartphone,
  Wifi,
  LogOut,
  RotateCcw,
  Flag,
  Search,
  Settings,
  Bell
} from 'lucide-react';

interface Product {
  id: number;
  brand: string;
  object_name: string;
  status: string;
  nfc_uid: string;
  created_at: string;
}

interface SecuritySettings {
  kycStatus: 'Verified' | 'Pending' | 'Flagged';
  walletType: 'Custodial' | 'External';
  deviceId: string;
  geoTracking: boolean;
  trustedLocations: Array<{
    id: string;
    name: string;
    address: string;
    status: 'Approved' | 'Pending' | 'Rejected';
  }>;
  twoFactorEnabled: boolean;
  sessionLogs: Array<{
    timestamp: string;
    location: string;
    ip: string;
    device: string;
    trusted: boolean;
  }>;
}

export default function SecuritySettings() {
  const [products, setProducts] = useState<Product[]>([]);
  const [securityData, setSecurityData] = useState<SecuritySettings>({
    kycStatus: 'Verified',
    walletType: 'Custodial',
    deviceId: 'iPhone 15 Pro • Touch ID',
    geoTracking: false,
    trustedLocations: [
      { id: '1', name: 'Home Safe', address: 'Paris, France', status: 'Approved' },
      { id: '2', name: 'Office Vault', address: 'London, UK', status: 'Pending' }
    ],
    twoFactorEnabled: false,
    sessionLogs: [
      { timestamp: '2 minutes ago', location: 'Paris, FR', ip: '192.168.1.1', device: 'iPhone 15 Pro', trusted: true },
      { timestamp: '1 hour ago', location: 'Paris, FR', ip: '192.168.1.1', device: 'MacBook Pro', trusted: true },
      { timestamp: '2 days ago', location: 'London, UK', ip: '10.0.0.1', device: 'iPhone 15 Pro', trusted: false }
    ]
  });

  const [showGeoModal, setShowGeoModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showLockdownModal, setShowLockdownModal] = useState(false);
  const [showProductReportModal, setShowProductReportModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [reportStatus, setReportStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Simulate loading client products and security data
    const mockProducts: Product[] = [
      { id: 1, brand: 'Saffiano', object_name: 'Briefcase', status: 'MINTED', nfc_uid: 'HID5671', created_at: '2024-01-15' },
      { id: 2, brand: 'Spinto', object_name: 'Wallet', status: 'MINTED', nfc_uid: 'FHZRH416', created_at: '2024-01-10' }
    ];
    setProducts(mockProducts);
  }, []);

  const handleGeoTracking = async () => {
    setShowGeoModal(true);
  };

  const confirmGeoTracking = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setSecurityData(prev => ({ ...prev, geoTracking: !prev.geoTracking }));
      setLoading(false);
      setShowGeoModal(false);
    }, 2000);
  };

  const handleProductReport = (product: Product) => {
    setSelectedProduct(product);
    setShowProductReportModal(true);
  };

  const submitProductReport = async () => {
    if (!selectedProduct || !reportStatus) return;
    
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setShowProductReportModal(false);
      setSelectedProduct(null);
      setReportStatus('');
      // Show success message
    }, 1500);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      'Verified': { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
      'Pending': { bg: '#fffbeb', color: '#d97706', border: '#fed7aa' },
      'Flagged': { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
      'Approved': { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
      'Rejected': { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
    };

    const style = styles[status as keyof typeof styles] || { bg: '#f9fafb', color: '#374151', border: '#e5e7eb' };

    return (
      <span 
        style={{
          backgroundColor: style.bg,
          color: style.color,
          border: `1px solid ${style.border}`,
          padding: '4px 12px',
          borderRadius: '16px',
          fontSize: '12px',
          fontWeight: '500'
        }}
      >
        {status}
      </span>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
      {/* Header */}
      <div style={{ 
        borderBottom: '1px solid #f3f4f6', 
        backgroundColor: 'white',
        padding: '24px 0'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '400',
              color: '#111827',
              margin: '0 0 8px 0',
              letterSpacing: '-0.025em'
            }}>
              Security Settings
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
              margin: 0
            }}>
              Manage your account security and vault access
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 16px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <Shield size={16} style={{ color: '#059669' }} />
            <span style={{ fontSize: '14px', color: '#111827', fontWeight: '500' }}>
              Security Score: 98%
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Security Overview */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '32px',
          marginBottom: '32px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '500',
            color: '#111827',
            margin: '0 0 24px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Shield size={20} />
            Security Overview
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px'
          }}>
            {/* KYC Status */}
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '24px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#111827', margin: 0 }}>
                  Identity Verification
                </h3>
                {getStatusBadge(securityData.kycStatus)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={14} style={{ color: '#6b7280' }} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>Full KYC Verified</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={14} style={{ color: '#6b7280' }} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>Documents: Complete</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Camera size={14} style={{ color: '#6b7280' }} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>Biometric: Active</span>
                </div>
              </div>
            </div>

            {/* Wallet Status */}
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '24px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#111827', margin: 0 }}>
                  Wallet Security
                </h3>
                <span style={{
                  backgroundColor: '#dbeafe',
                  color: '#1d4ed8',
                  border: '1px solid #93c5fd',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {securityData.walletType}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lock size={14} style={{ color: '#6b7280' }} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>Multi-sig Protected</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Smartphone size={14} style={{ color: '#6b7280' }} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>{securityData.deviceId}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wifi size={14} style={{ color: '#6b7280' }} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>Encrypted Connection</span>
                </div>
              </div>
            </div>

            {/* Recent Access */}
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '24px',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#111827', margin: '0 0 16px 0' }}>
                Recent Vault Access
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {securityData.sessionLogs.slice(0, 3).map((log, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                        {log.timestamp}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {log.location}
                      </div>
                    </div>
                    {log.trusted ? (
                      <CheckCircle size={16} style={{ color: '#059669' }} />
                    ) : (
                      <AlertCircle size={16} style={{ color: '#d97706' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          gap: '32px'
        }}>
          {/* Geo-Tracking & Locations */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '500',
              color: '#111827',
              margin: '0 0 24px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <MapPin size={20} />
              Location Management
            </h2>

            {/* Geo-Tracking Toggle */}
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #e5e7eb',
              marginBottom: '24px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#111827', margin: '0 0 4px 0' }}>
                    Geo-Tracking
                  </h3>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                    Track product locations and movements
                  </p>
                </div>
                <button
                  onClick={handleGeoTracking}
                  style={{
                    position: 'relative',
                    display: 'inline-flex',
                    height: '24px',
                    width: '44px',
                    alignItems: 'center',
                    borderRadius: '12px',
                    backgroundColor: securityData.geoTracking ? '#111827' : '#d1d5db',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    height: '16px',
                    width: '16px',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    transform: securityData.geoTracking ? 'translateX(24px)' : 'translateX(4px)',
                    transition: 'transform 0.2s'
                  }} />
                </button>
              </div>
              {securityData.geoTracking && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#059669',
                  fontSize: '14px'
                }}>
                  <CheckCircle size={14} />
                  <span>Active tracking for all vault items</span>
                </div>
              )}
            </div>

            {/* Trusted Locations */}
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #e5e7eb',
              marginBottom: '24px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#111827', margin: 0 }}>
                  Trusted Vault Locations
                </h3>
                <button
                  onClick={() => setShowLocationModal(true)}
                  style={{
                    fontSize: '14px',
                    color: '#111827',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <MapPin size={14} />
                  Add Location
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {securityData.trustedLocations.map((location) => (
                  <div key={location.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    backgroundColor: 'white',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {location.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {location.address}
                      </div>
                    </div>
                    {getStatusBadge(location.status)}
                  </div>
                ))}
              </div>
            </div>

            {/* Request New Vault */}
            <button style={{
              width: '100%',
              backgroundColor: '#111827',
              color: 'white',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#111827'}
            >
              Request New Vault Location
            </button>
          </div>

          {/* Security Escalation */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '500',
              color: '#111827',
              margin: '0 0 24px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <AlertTriangle size={20} />
              Security Escalation
            </h2>

            {/* Physical Agent Request */}
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #e5e7eb',
              marginBottom: '24px'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#111827', margin: '0 0 8px 0' }}>
                Physical Agent Support
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0' }}>
                Request immediate physical intervention for your products
              </p>
              <button
                onClick={() => setShowAgentModal(true)}
                style={{
                  width: '100%',
                  backgroundColor: '#111827',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#111827'}
              >
                Request Physical Agent
              </button>
            </div>

            {/* Emergency Lockdown */}
            <div style={{
              backgroundColor: '#fef2f2',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #fecaca',
              marginBottom: '24px'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '500',
                color: '#111827',
                margin: '0 0 8px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Lock style={{ color: '#dc2626' }} size={16} />
                Emergency Product Lockdown
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0' }}>
                Immediately disable product visibility until AUCTA intervention
              </p>
              <button
                onClick={() => setShowLockdownModal(true)}
                style={{
                  width: '100%',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                Emergency Lockdown
              </button>
            </div>

            {/* Report Suspicious Activity */}
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#111827', margin: '0 0 8px 0' }}>
                Report Suspicious Activity
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0' }}>
                Flag any unusual account or session activity
              </p>
              <button style={{
                width: '100%',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                color: '#111827',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
              >
                Report Activity
              </button>
            </div>
          </div>
        </div>

        {/* Product Status Management */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '32px',
          marginTop: '32px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '500',
            color: '#111827',
            margin: '0 0 24px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Flag size={20} />
            Product Status Reporting
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px'
          }}>
            {products.map((product) => (
              <div key={product.id} style={{
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                padding: '20px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#111827', margin: '0 0 4px 0' }}>
                      {product.brand}
                    </h3>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                      {product.object_name}
                    </p>
                  </div>
                  <span style={{
                    backgroundColor: '#dcfce7',
                    color: '#166534',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {product.status}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>
                    {product.nfc_uid}
                  </span>
                  <button
                    onClick={() => handleProductReport(product)}
                    style={{
                      fontSize: '14px',
                      color: '#111827',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <AlertTriangle size={14} />
                    Report Status
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Session & Identity Controls */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '32px',
          marginTop: '32px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '500',
            color: '#111827',
            margin: '0 0 24px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <User size={20} />
            Session & Identity Controls
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px'
          }}>
            {/* 2FA Management */}
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#111827', margin: 0 }}>
                  Two-Factor Authentication
                </h3>
                {securityData.twoFactorEnabled ? (
                  <span style={{
                    backgroundColor: '#dcfce7',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    Active
                  </span>
                ) : (
                  <span style={{
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    Inactive
                  </span>
                )}
              </div>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0' }}>
                {securityData.twoFactorEnabled ? 
                  'Your account is protected with 2FA' : 
                  'Enable additional security for your account'
                }
              </p>
              <button style={{
                width: '100%',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                color: '#111827',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
              >
                {securityData.twoFactorEnabled ? 'Manage 2FA' : 'Request 2FA Activation'}
              </button>
            </div>

            {/* Session Management */}
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#111827', margin: '0 0 16px 0' }}>
                Active Sessions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                {securityData.sessionLogs.slice(0, 2).map((session, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                        {session.device}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {session.location} • {session.timestamp}
                      </div>
                    </div>
                    {session.trusted ? (
                      <span style={{ fontSize: '12px', color: '#059669' }}>Current</span>
                    ) : (
                      <button style={{
                        fontSize: '12px',
                        color: '#dc2626',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer'
                      }}>
                        Terminate
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button style={{
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#111827',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <LogOut size={12} />
                  Log Out All
                </button>
                <button style={{
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#111827',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <RotateCcw size={12} />
                  Reset Device
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showGeoModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                backgroundColor: '#111827',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <MapPin size={24} style={{ color: 'white' }} />
              </div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '500',
                color: '#111827',
                margin: '0 0 8px 0'
              }}>
                {securityData.geoTracking ? 'Disable' : 'Enable'} Geo-Tracking
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                {securityData.geoTracking ? 
                  'This will stop tracking your product locations. You can re-enable this at any time.' :
                  'This will enable real-time tracking of your product locations for enhanced security.'
                }
              </p>
            </div>
            
            {loading && (
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '2px solid #e5e7eb',
                  borderTopColor: '#111827',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 8px'
                }} />
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                  Processing biometric verification...
                </p>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowGeoModal(false)}
                disabled={loading}
                style={{
                  flex: 1,
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#111827',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#f9fafb')}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = 'white')}
              >
                Cancel
              </button>
              <button
                onClick={confirmGeoTracking}
                disabled={loading}
                style={{
                  flex: 1,
                  backgroundColor: '#111827',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#374151')}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#111827')}
              >
                {loading ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProductReportModal && selectedProduct && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '500',
              color: '#111827',
              margin: '0 0 24px 0'
            }}>
              Report Product Status
            </h3>
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '500',
                color: '#111827',
                margin: '0 0 8px 0'
              }}>
                {selectedProduct.brand} {selectedProduct.object_name}
              </h4>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                NFC ID: {selectedProduct.nfc_uid}
              </p>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#111827',
                marginBottom: '12px'
              }}>
                Status
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px'
              }}>
                {['Safe', 'Lost', 'Stolen', 'In Repair', 'Archived'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setReportStatus(status)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: '1px solid',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      ...(reportStatus === status
                        ? {
                            backgroundColor: '#111827',
                            color: 'white',
                            borderColor: '#111827'
                          }
                        : {
                            backgroundColor: 'white',
                            color: '#111827',
                            borderColor: '#d1d5db'
                          }
                      )
                    }}
                    onMouseEnter={(e) => {
                      if (reportStatus !== status) {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (reportStatus !== status) {
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#111827',
                marginBottom: '8px'
              }}>
                Supporting Document (Optional)
              </label>
              <div style={{
                border: '2px dashed #d1d5db',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#9ca3af'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
              >
                <Upload size={24} style={{ color: '#9ca3af', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                  Click to upload PDF or image
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowProductReportModal(false);
                  setSelectedProduct(null);
                  setReportStatus('');
                }}
                style={{
                  flex: 1,
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#111827',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
              >
                Cancel
              </button>
              <button
                onClick={submitProductReport}
                disabled={!reportStatus || loading}
                style={{
                  flex: 1,
                  backgroundColor: !reportStatus || loading ? '#9ca3af' : '#111827',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: !reportStatus || loading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (reportStatus && !loading) {
                    e.currentTarget.style.backgroundColor = '#374151';
                  }
                }}
                onMouseLeave={(e) => {
                  if (reportStatus && !loading) {
                    e.currentTarget.style.backgroundColor = '#111827';
                  }
                }}
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}