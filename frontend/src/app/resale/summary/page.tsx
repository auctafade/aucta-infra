"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  CheckCircle, 
  FileText, 
  User, 
  Package, 
  DollarSign, 
  Hash, 
  Calendar, 
  ExternalLink,
  Download,
  Share2,
  Eye,
  Blocks,
  Archive,
  Wallet,
  Clock,
  MapPin,
  TrendingUp
} from 'lucide-react';
import { api } from '@/lib/api';

// Type definitions
interface FinalizedResale {
  id: string;
  resale_id: string;
  passport_id: number;
  seller_id: number;
  buyer_id: number;
  asking_price: number;
  currency: string;
  finalization_data: {
    ownership_transfer: boolean;
    sbt_minted: boolean;
    passport_updated: boolean;
    blockchain_anchored: boolean;
    metadata_archived: boolean;
  };
  finalization_timestamp: string;
  blockchain_tx_hash?: string;
  passport: {
    id: number;
    nfc_uid: string;
    status: string;
    metadata: {
      hash: string;
      brand: string;
      object_name: string;
      product_image?: string;
      collection_year?: string;
      original_price?: string;
      [key: string]: any;
    };
  };
  seller: {
    id: number;
    name: string;
    email: string;
    wallet_address?: string;
    city?: string;
    country?: string;
  };
  buyer: {
    id: number;
    name: string;
    email: string;
    wallet_address?: string;
    city?: string;
    country?: string;
  };
  transaction_history: {
    timestamp: string;
    action: string;
    details: string;
    status: string;
  }[];
}

const ResaleSummaryPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resaleId = searchParams.get('id');

  // State management
  const [resaleData, setResaleData] = useState<FinalizedResale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data for development - replace with API calls
  const mockResaleData: FinalizedResale = {
    id: '1',
    resale_id: 'RESALE_001',
    passport_id: 123,
    seller_id: 456,
    buyer_id: 789,
    asking_price: 2500.00,
    currency: 'EUR',
    finalization_data: {
      ownership_transfer: true,
      sbt_minted: true,
      passport_updated: true,
      blockchain_anchored: true,
      metadata_archived: true
    },
    finalization_timestamp: '2024-01-16T15:30:00Z',
    blockchain_tx_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    passport: {
      id: 123,
      nfc_uid: 'NFC_123456789',
      status: 'transferred',
      metadata: {
        hash: '0x1234567890abcdef...',
        brand: 'Hermès',
        object_name: 'Birkin 30 Handbag',
        product_image: '/uploads/passports/birkin-30.jpg',
        collection_year: '2020',
        original_price: '8500.00'
      }
    },
    seller: {
      id: 456,
      name: 'Marie Dubois',
      email: 'marie.dubois@email.com',
      wallet_address: '0x1234567890abcdef...',
      city: 'Paris',
      country: 'France'
    },
    buyer: {
      id: 789,
      name: 'Alexander Chen',
      email: 'alex.chen@email.com',
      wallet_address: '0xabcdef1234567890...',
      city: 'Singapore',
      country: 'Singapore'
    },
    transaction_history: [
      {
        timestamp: '2024-01-15T10:00:00Z',
        action: 'Resale Initiated',
        details: 'Product listed for resale at €2,500',
        status: 'completed'
      },
      {
        timestamp: '2024-01-16T14:30:00Z',
        action: 'Buyer Assigned',
        details: 'Alexander Chen confirmed as buyer',
        status: 'completed'
      },
      {
        timestamp: '2024-01-16T15:00:00Z',
        action: 'Payment Confirmed',
        details: 'Funds received and verified',
        status: 'completed'
      },
      {
        timestamp: '2024-01-16T15:30:00Z',
        action: 'Finalization Complete',
        details: 'Ownership transferred and blockchain anchored',
        status: 'completed'
      }
    ]
  };

  useEffect(() => {
    if (resaleId) {
      loadResaleSummary(resaleId);
    } else {
      // For development, use mock data
      setResaleData(mockResaleData);
      setLoading(false);
    }
  }, [resaleId]);

  const loadResaleSummary = async (id: string) => {
    try {
      setLoading(true);
      // Call the actual API to get resale summary
      const response = await api.getResaleSummary(id);
      if (response.success) {
        setResaleData(response.resale_summary);
      } else {
        throw new Error('Failed to load resale summary');
      }
    } catch (err) {
      setError('Failed to load resale summary');
      console.error('Error loading resale summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const downloadSummary = () => {
    if (!resaleData) return;
    
    const summaryText = `
AUCTA Resale Summary
====================

Resale ID: ${resaleData.resale_id}
Date: ${formatTimestamp(resaleData.finalization_timestamp)}

Product Details:
- Brand: ${resaleData.passport.metadata.brand}
- Model: ${resaleData.passport.metadata.object_name}
- Passport ID: ${resaleData.passport.id}
- NFC UID: ${resaleData.passport.nfc_uid}

Transaction Details:
- Sale Price: ${formatCurrency(resaleData.asking_price, resaleData.currency)}
- Seller: ${resaleData.seller.name} (${resaleData.seller.email})
- Buyer: ${resaleData.buyer.name} (${resaleData.buyer.email})

Blockchain Details:
- Transaction Hash: ${resaleData.blockchain_tx_hash}
- Status: Finalized and Immutable

Finalization Steps:
${resaleData.transaction_history.map(step => 
  `- ${step.action}: ${step.details}`
).join('\n')}
    `;

    const blob = new Blob([summaryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resale-summary-${resaleData.resale_id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '2px solid #e9ecef',
          borderTopColor: '#007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#6c757d', fontSize: '14px' }}>Loading resale summary...</p>
      </div>
    );
  }

  if (!resaleData) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <p style={{ color: '#dc3545', fontSize: '16px' }}>Resale summary not found</p>
        <button
          onClick={() => router.back()}
          style={{
            padding: '8px 16px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Success Header */}
      <div style={{
        background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '24px',
        color: 'white',
        textAlign: 'center'
      }}>
        <CheckCircle size={48} style={{ marginBottom: '16px' }} />
        <h1 style={{
          fontSize: '28px',
          fontWeight: '600',
          margin: '0 0 8px 0'
        }}>
          Resale Successfully Completed!
        </h1>
        <p style={{
          fontSize: '16px',
          margin: '0 0 24px 0',
          opacity: 0.9
        }}>
          The ownership transfer has been finalized and recorded on the blockchain
        </p>
        
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={downloadSummary}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            <Download size={16} />
            Download Summary
          </button>
          
          <button
            onClick={() => navigator.share && navigator.share({
              title: 'AUCTA Resale Completed',
              text: `Resale ${resaleData.resale_id} has been successfully completed`,
              url: window.location.href
            })}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            <Share2 size={16} />
            Share
          </button>
        </div>
      </div>

      {/* Transaction Overview */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e0e0e0',
        padding: '32px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '500',
          margin: '0 0 24px 0',
          color: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <FileText size={20} />
          Transaction Overview
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px'
        }}>
          {/* Product Information */}
          <div style={{
            padding: '20px',
            background: '#f8f9fa',
            borderRadius: '12px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '500',
              margin: '0 0 16px 0',
              color: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Package size={18} />
              Product Details
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Brand:</span>
                <span>{resaleData.passport.metadata.brand}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Model:</span>
                <span>{resaleData.passport.metadata.object_name}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Passport ID:</span>
                <span style={{ fontFamily: 'monospace' }}>#{resaleData.passport.id}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>NFC UID:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{resaleData.passport.nfc_uid}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Year:</span>
                <span>{resaleData.passport.metadata.collection_year}</span>
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div style={{
            padding: '20px',
            background: '#f8f9fa',
            borderRadius: '12px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '500',
              margin: '0 0 16px 0',
              color: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <DollarSign size={18} />
              Transaction Details
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Resale ID:</span>
                <span style={{ fontFamily: 'monospace' }}>{resaleData.resale_id}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Price:</span>
                <span style={{ fontWeight: '600', fontSize: '16px' }}>
                  {formatCurrency(resaleData.asking_price, resaleData.currency)}
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Date:</span>
                <span>{formatTimestamp(resaleData.finalization_timestamp)}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Status:</span>
                <span style={{
                  padding: '4px 8px',
                  background: '#d4edda',
                  color: '#155724',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  Finalized
                </span>
              </div>
            </div>
          </div>

          {/* Blockchain Details */}
          <div style={{
            padding: '20px',
            background: '#f8f9fa',
            borderRadius: '12px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '500',
              margin: '0 0 16px 0',
              color: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
                              <Blocks size={18} />
                Blockchain Details
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Status:</span>
                <span style={{
                  padding: '4px 8px',
                  background: '#d4edda',
                  color: '#155724',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  Anchored
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>TX Hash:</span>
                <span style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '12px',
                  wordBreak: 'break-all'
                }}>
                  {resaleData.blockchain_tx_hash}
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Immutable:</span>
                <span style={{
                  padding: '4px 8px',
                  background: '#d4edda',
                  color: '#155724',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  Yes
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Parties Information */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e0e0e0',
        padding: '32px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '500',
          margin: '0 0 24px 0',
          color: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <User size={20} />
          Parties Information
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px'
        }}>
          {/* Seller */}
          <div style={{
            padding: '20px',
            background: '#f8f9fa',
            borderRadius: '12px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '500',
              margin: '0 0 16px 0',
              color: '#1a1a1a'
            }}>
              Previous Owner (Seller)
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Name:</span>
                <span>{resaleData.seller.name}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Email:</span>
                <span>{resaleData.seller.email}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Location:</span>
                <span>{resaleData.seller.city}, {resaleData.seller.country}</span>
              </div>
              {resaleData.seller.wallet_address && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontWeight: '500', minWidth: '80px' }}>Wallet:</span>
                  <span style={{ 
                    fontFamily: 'monospace', 
                    fontSize: '12px',
                    wordBreak: 'break-all'
                  }}>
                    {resaleData.seller.wallet_address}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Buyer */}
          <div style={{
            padding: '20px',
            background: '#f8f9fa',
            borderRadius: '12px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '500',
              margin: '0 0 16px 0',
              color: '#1a1a1a'
            }}>
              New Owner (Buyer)
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Name:</span>
                <span>{resaleData.buyer.name}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Email:</span>
                <span>{resaleData.buyer.email}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500', minWidth: '80px' }}>Location:</span>
                <span>{resaleData.buyer.city}, {resaleData.buyer.country}</span>
              </div>
              {resaleData.buyer.wallet_address && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontWeight: '500', minWidth: '80px' }}>Wallet:</span>
                  <span style={{ 
                    fontFamily: 'monospace', 
                    fontSize: '12px',
                    wordBreak: 'break-all'
                  }}>
                    {resaleData.buyer.wallet_address}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Timeline */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e0e0e0',
        padding: '32px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '500',
          margin: '0 0 24px 0',
          color: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Clock size={20} />
          Transaction Timeline
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {resaleData.transaction_history.map((step, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #e9ecef',
                background: '#f8f9fa'
              }}
            >
              {/* Step Number */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#28a745',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'white',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                <CheckCircle size={16} />
              </div>

              {/* Step Content */}
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '500',
                    margin: 0,
                    color: '#1a1a1a'
                  }}>
                    {step.action}
                  </h3>
                  <span style={{
                    padding: '4px 8px',
                    background: '#d4edda',
                    color: '#155724',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {step.status}
                  </span>
                </div>
                <p style={{
                  fontSize: '14px',
                  color: '#6c757d',
                  margin: '0 0 8px 0'
                }}>
                  {step.details}
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#6c757d',
                  margin: 0,
                  fontStyle: 'italic'
                }}>
                  {formatTimestamp(step.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Finalization Steps Summary */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e0e0e0',
        padding: '32px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '500',
          margin: '0 0 24px 0',
          color: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Archive size={20} />
          Finalization Steps Completed
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          {Object.entries(resaleData.finalization_data).map(([key, value]) => (
            <div
              key={key}
              style={{
                padding: '16px',
                background: value ? '#f8fff9' : '#fff8f8',
                borderRadius: '8px',
                border: `1px solid ${value ? '#d4edda' : '#f8d7da'}`,
                textAlign: 'center'
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: value ? '#28a745' : '#dc3545',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: 'white'
              }}>
                {value ? <CheckCircle size={20} /> : <span>✕</span>}
              </div>
              <h4 style={{
                fontSize: '14px',
                fontWeight: '500',
                margin: '0 0 4px 0',
                color: value ? '#155724' : '#721c24',
                textTransform: 'capitalize'
              }}>
                {key.replace(/_/g, ' ')}
              </h4>
              <p style={{
                fontSize: '12px',
                color: value ? '#155724' : '#721c24',
                margin: 0
              }}>
                {value ? 'Completed' : 'Failed'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '16px',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => router.push('/resale/initiate')}
          style={{
            padding: '12px 24px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#0056b3'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#007bff'}
        >
          <Package size={16} />
          Initiate New Resale
        </button>

        <button
          onClick={() => router.push('/admin/resale-dashboard')}
          style={{
            padding: '12px 24px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#5a6268'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#6c757d'}
        >
          <Eye size={16} />
          View Dashboard
        </button>

        <button
          onClick={() => router.push('/resale/traceability')}
          style={{
            padding: '12px 24px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#218838'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#28a745'}
        >
          <TrendingUp size={16} />
          View Traceability
        </button>
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
};

export default ResaleSummaryPage;
