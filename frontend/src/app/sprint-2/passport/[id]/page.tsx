// frontend/src/app/sprint-2/passport/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Shield, 
  ArrowLeft, 
  Calendar, 
  Hash, 
  User, 
  Package,
  Clock,
  CheckCircle,
  Link as LinkIcon,
  Download,
  Share2,
  QrCode,
  Fingerprint,
  Award
} from 'lucide-react';
import { api } from '@/lib/api';

export default function PassportDetail() {
  const params = useParams();
  const router = useRouter();
  const [passport, setPassport] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    const fetchPassportData = async () => {
      try {
        const passportId = parseInt(params.id as string);
        
        // Fetch passport details
        const passportData = await api.getPassport(passportId);
        setPassport(passportData);
        
        // Fetch owner details if assigned
        if (passportData.assigned_client_id) {
          const clientData = await api.getClient(passportData.assigned_client_id);
          setOwner(clientData);
        }
        
        // Fetch action history
        const logs = await api.getAdminLogs();
        const passportHistory = logs.filter((log: any) => log.passport_id === passportId);
        setHistory(passportHistory);
      } catch (error) {
        console.error('Error fetching passport data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPassportData();
  }, [params.id]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '2px solid #e0e0e0',
            borderTopColor: '#000',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#666', fontSize: '14px' }}>Loading passport...</p>
        </div>
      </div>
    );
  }

  if (!passport) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Passport not found</p>
      </div>
    );
  }

  const metadata = typeof passport.metadata === 'string' 
    ? JSON.parse(passport.metadata) 
    : passport.metadata;

  const kycInfo = owner?.kyc_info 
    ? (typeof owner.kyc_info === 'string' ? JSON.parse(owner.kyc_info) : owner.kyc_info)
    : null;

  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#f8f9fa'
    }}>
      {/* Header */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e0e0e0',
        padding: '20px 40px',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <button
            onClick={() => router.back()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#333'
            }}
          >
            <ArrowLeft size={20} />
            Back
          </button>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{
              padding: '8px 16px',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Share2 size={18} />
              Share
            </button>
            <button style={{
              padding: '8px 16px',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Download size={18} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px'
      }}>
        {/* Passport Header Card */}
        <div style={{
          background: 'linear-gradient(135deg, #000 0%, #333 100%)',
          borderRadius: '16px',
          padding: '40px',
          color: '#fff',
          marginBottom: '32px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Background Pattern */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              rgba(255,255,255,0.1) 10px,
              rgba(255,255,255,0.1) 20px
            )`
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* AUCTA Protection Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '32px'
            }}>
              <Shield size={24} />
              <span style={{ 
                fontSize: '14px', 
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Protected by AUCTA
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '40px', alignItems: 'start' }}>
              <div>
                <h1 style={{
                  fontSize: '36px',
                  fontWeight: 300,
                  marginBottom: '12px',
                  letterSpacing: '-0.02em'
                }}>
                  {metadata.brand}
                </h1>
                <p style={{
                  fontSize: '20px',
                  opacity: 0.9,
                  marginBottom: '24px'
                }}>
                  {metadata.object_name}
                </p>

                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Status</p>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      background: passport.status === 'MINTED' ? '#4CAF50' : '#2196F3',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: 500
                    }}>
                      <CheckCircle size={16} />
                      {passport.status}
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Value</p>
                    <p style={{ fontSize: '20px', fontWeight: 500 }}>
                      {metadata.original_price ? formatCurrency(metadata.original_price) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Collection Year</p>
                    <p style={{ fontSize: '20px', fontWeight: 500 }}>
                      {metadata.collection_year || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* QR Code Placeholder */}
              <div style={{
                width: '120px',
                height: '120px',
                background: '#fff',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000'
              }}>
                <QrCode size={60} />
              </div>
            </div>
          </div>
        </div>

        {/* Owner Section */}
        {owner && (
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '32px',
            marginBottom: '32px',
            border: '1px solid #e0e0e0'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 500,
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <User size={20} />
              Current Owner
            </h2>

            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              {/* Profile Picture */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: kycInfo?.selfie 
                  ? `url(http://localhost:4000${kycInfo.selfie}) center/cover`
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '32px',
                fontWeight: 300,
                border: '3px solid #f0f0f0'
              }}>
                {!kycInfo?.selfie && owner.name.charAt(0).toUpperCase()}
              </div>

              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '24px', fontWeight: 500, marginBottom: '8px' }}>
                  {owner.name}
                </h3>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Email</p>
                    <p style={{ fontSize: '14px' }}>{kycInfo?.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Wallet Address</p>
                    <p style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                      {owner.wallet_address.slice(0, 6)}...{owner.wallet_address.slice(-4)}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Member Since</p>
                    <p style={{ fontSize: '14px' }}>{new Date(owner.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #e0e0e0'
          }}>
            {['details', 'authentication', 'history'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '16px',
                  background: activeTab === tab ? '#f8f9fa' : '#fff',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #000' : 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: activeTab === tab ? 500 : 400,
                  textTransform: 'capitalize'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ padding: '32px' }}>
            {/* Details Tab */}
            {activeTab === 'details' && (
              <div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: metadata.product_image ? '1fr 300px' : '1fr',
                  gap: '40px'
                }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>
                      Product Information
                    </h3>
                    
                    <div style={{ display: 'grid', gap: '20px' }}>
                      {Object.entries({
                        'Brand': metadata.brand,
                        'Product Name': metadata.object_name,
                        'Shape': metadata.shape,
                        'Main Color': metadata.main_color,
                        'Secondary Colors': metadata.secondary_colors,
                        'Description': metadata.description,
                        'Dimensions': metadata.dimensions,
                        'Weight': metadata.weight,
                        'Craftsman': metadata.craftsman,
                        'Manufacturing Location': metadata.manufacturing_location,
                        'Leather': metadata.leather,
                        'Surface Finish': metadata.surface_finish,
                        'Leather Briefcase': metadata.leather_briefcase,
                        'Serial Number': metadata.serial_number,
                        'Product ID': metadata.product_id,
                        'Product URL': metadata.product_url,
                        'Edition Info': metadata.edition_info,
                        'Materials': metadata.materials
                      }).filter(([_, value]) => value).map(([key, value]) => (
                        <div key={key}>
                          <p style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>{key}</p>
                          <p style={{ fontSize: '16px' }}>
                            {key === 'Product URL' && value ? (
                              <a href={value as string} target="_blank" rel="noopener noreferrer" style={{
                                color: '#2196F3',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                View Product <LinkIcon size={14} />
                              </a>
                            ) : (
                              value
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {metadata.product_image && (
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>
                        Product Image
                      </h3>
                      <div style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: '1px solid #e0e0e0'
                      }}>
                        <img 
                          src={`http://localhost:4000${metadata.product_image}`}
                          alt={metadata.object_name}
                          style={{
                            width: '100%',
                            height: 'auto',
                            display: 'block'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Authentication Tab */}
            {activeTab === 'authentication' && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>
                  Blockchain Authentication
                </h3>

                <div style={{ display: 'grid', gap: '24px' }}>
                  <div style={{
                    padding: '20px',
                    background: '#f8f9fa',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <Fingerprint size={32} color="#2196F3" />
                    <div>
                      <p style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>NFC UID</p>
                      <p style={{ fontSize: '16px', fontFamily: 'monospace' }}>{passport.nfc_uid}</p>
                    </div>
                  </div>

                  <div style={{
                    padding: '20px',
                    background: '#f8f9fa',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <Hash size={32} color="#4CAF50" />
                    <div>
                      <p style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Metadata Hash</p>
                      <p style={{ fontSize: '14px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {passport.metadata_hash}
                      </p>
                    </div>
                  </div>

                  {passport.sbt_hash && (
                    <div style={{
                      padding: '20px',
                      background: '#f8f9fa',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <Award size={32} color="#9C27B0" />
                      <div>
                        <p style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>SBT Hash</p>
                        <p style={{ fontSize: '14px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {passport.sbt_hash}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>
                  Ownership History
                </h3>

                <div style={{ position: 'relative' }}>
                  {/* Timeline line */}
                  <div style={{
                    position: 'absolute',
                    left: '20px',
                    top: '20px',
                    bottom: '20px',
                    width: '2px',
                    background: '#e0e0e0'
                  }} />

                  {/* History items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {history.map((event, index) => (
                      <div key={event.id} style={{
                        display: 'flex',
                        gap: '24px',
                        position: 'relative'
                      }}>
                        {/* Timeline dot */}
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: index === 0 ? '#000' : '#fff',
                          border: '2px solid #000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          zIndex: 1
                        }}>
                          <Clock size={18} color={index === 0 ? '#fff' : '#000'} />
                        </div>

                        <div style={{
                          flex: 1,
                          padding: '16px',
                          background: '#f8f9fa',
                          borderRadius: '12px'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'start',
                            marginBottom: '8px'
                          }}>
                            <h4 style={{ fontSize: '16px', fontWeight: 500 }}>
                              {event.action.replace(/_/g, ' ')}
                            </h4>
                            <span style={{ fontSize: '14px', color: '#666' }}>
                              {formatDate(event.timestamp)}
                            </span>
                          </div>
                          {event.client_name && (
                            <p style={{ fontSize: '14px', color: '#666' }}>
                              By {event.client_name}
                            </p>
                          )}
                          {event.details && typeof event.details === 'object' && (
                            <div style={{ marginTop: '8px' }}>
                              {Object.entries(event.details).map(([key, value]) => (
                                <p key={key} style={{ fontSize: '14px', color: '#666' }}>
                                  {key}: {String(value)}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}