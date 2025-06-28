"use client";

import React, { useState, useEffect } from 'react';
import { TrendingUp, Download, Calendar, User, AlertCircle, Check, Clock, MapPin } from 'lucide-react';
import { api, auth } from '@/lib/api';

interface ValuationRecord {
  id: number;
  client_id: number;
  product_id: number;
  valuation_date: string;
  appraised_value: number;
  appraised_value_eth?: number;
  appraiser_name: string;
  appraiser_type: 'aucta_admin' | 'external_expert' | 'auction_partner';
  valuation_method?: string;
  certificate_url?: string;
  status: 'completed' | 'expired' | 'pending';
  notes?: string;
  brand: string;
  object_name: string;
  product_image?: string;
  metadata: any;
}

interface ValuationRequest {
  id: number;
  product_id: number;
  reason?: string;
  status: string;
  assigned_expert?: string;
  created_at: string;
  brand: string;
  object_name: string;
}

export default function ValuationHistory() {
  const [valuationHistory, setValuationHistory] = useState<ValuationRecord[]>([]);
  const [valuationRequests, setValuationRequests] = useState<ValuationRequest[]>([]);
  const [clientProducts, setClientProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [connectAuthenticator, setConnectAuthenticator] = useState(false);
  const [preferredRegion, setPreferredRegion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [clientData, setClientData] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const client = auth.getClientData();
      if (!client) {
        setLoading(false);
        return;
      }
      
      setClientData(client);
      
      // Fetch products with comprehensive error handling
      try {
        const products = await api.getClientVault(client.id);
        setClientProducts(Array.isArray(products) ? products : []);
      } catch (error) {
        console.warn('Could not load client products:', error);
        setClientProducts([]);
      }
      
      // Try to fetch valuation history with improved error handling
      try {
        const history = await api.getValuationHistory(client.id);
        setValuationHistory(Array.isArray(history) ? history : []);
      } catch (error: any) {
        console.warn('Could not load valuation history:', error);
        // Check for specific API error structure
        if (error?.message?.includes('404') || 
            error?.response?.status === 404 || 
            (typeof error === 'string' && error.includes('404'))) {
          console.warn('Valuation history endpoint not found - this may be expected for new features');
        }
        setValuationHistory([]);
      }
      
      // Try to fetch valuation requests with improved error handling
      try {
        const requests = await api.getValuationRequests(client.id);
        setValuationRequests(Array.isArray(requests) ? requests : []);
      } catch (error: any) {
        console.warn('Could not load valuation requests:', error);
        // Check for specific API error structure
        if (error?.message?.includes('404') || 
            error?.response?.status === 404 || 
            (typeof error === 'string' && error.includes('404'))) {
          console.warn('Valuation requests endpoint not found - this may be expected for new features');
        }
        setValuationRequests([]);
      }
      
    } catch (error) {
      console.error('Error in fetchData:', error);
      // Ensure we have default values even if everything fails
      setClientProducts([]);
      setValuationHistory([]);
      setValuationRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!selectedProduct || !clientData) return;
    
    setSubmitting(true);
    try {
      await api.submitValuationRequest(clientData.id, {
        product_id: selectedProduct,
        reason: requestReason || undefined,
        connect_authenticator: connectAuthenticator,
        preferred_region: connectAuthenticator ? preferredRegion : undefined
      });
      
      // Reset form and refresh data
      setShowRequestForm(false);
      setSelectedProduct(null);
      setRequestReason('');
      setConnectAuthenticator(false);
      setPreferredRegion('');
      
      await fetchData();
      
      // Show success message
      alert('Valuation request submitted successfully!');
    } catch (error: any) {
      console.error('Error submitting valuation request:', error);
      // Improved error handling for API responses
      if (error?.message?.includes('404') || 
          error?.response?.status === 404 || 
          (typeof error === 'string' && error.includes('404'))) {
        alert('Valuation request feature is not yet available. Please contact support.');
      } else if (error?.message) {
        alert(error.message);
      } else {
        alert('Failed to submit valuation request. Please try again.');
      }
    } finally {
      setSubmitting(false);
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getAppraiserTypeLabel = (type: string) => {
    switch (type) {
      case 'aucta_admin':
        return 'AUCTA Team';
      case 'external_expert':
        return 'External Expert';
      case 'auction_partner':
        return 'Auction Partner';
      default:
        return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#22c55e';
      case 'pending':
        return '#f59e0b';
      case 'expired':
        return '#ef4444';
      default:
        return '#666';
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
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
          <p style={{ color: '#666', fontSize: '14px' }}>Loading valuation history...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div style={{
        marginBottom: '32px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 400,
          marginBottom: '12px',
          letterSpacing: '-0.02em'
        }}>
          Valuation History
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '24px',
          lineHeight: '1.6'
        }}>
          Track the evolution of your product values over time, download past certificates, and request new professional appraisals from AUCTA-certified experts.
        </p>

        <button
          onClick={() => setShowRequestForm(true)}
          style={{
            padding: '16px 32px',
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <TrendingUp size={20} />
          Request New Valuation
        </button>
      </div>

      {/* Active Requests Section */}
      {valuationRequests.filter(r => r.status === 'pending' || r.status === 'in_progress').length > 0 && (
        <div style={{
          marginBottom: '40px',
          padding: '24px',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '12px'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 500,
            marginBottom: '16px',
            color: '#92400e'
          }}>
            Active Valuation Requests
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {valuationRequests
              .filter(r => r.status === 'pending' || r.status === 'in_progress')
              .map(request => (
                <div key={request.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #fde68a'
                }}>
                  <div>
                    <p style={{ fontWeight: 500, marginBottom: '4px' }}>
                      {request.brand} {request.object_name}
                    </p>
                    <p style={{ fontSize: '14px', color: '#666' }}>
                      Requested on {formatDate(request.created_at)}
                    </p>
                    {request.assigned_expert && (
                      <p style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                        Expert: {request.assigned_expert}
                      </p>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#fef3c7',
                    borderRadius: '20px',
                    fontSize: '14px',
                    color: '#92400e'
                  }}>
                    <Clock size={14} />
                    {request.status === 'in_progress' ? 'In Progress' : 'Pending Review'}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Valuation Timeline */}
      <div>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 500,
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Calendar size={20} />
          Complete Valuation Timeline
        </h2>

        {valuationHistory.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 40px',
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #e0e0e0'
          }}>
            <TrendingUp size={48} color="#e0e0e0" style={{ margin: '0 auto 16px' }} />
            <p style={{
              fontSize: '16px',
              color: '#666',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              No valuation history yet. Request your first product appraisal to start tracking value evolution.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {valuationHistory.map((valuation, index) => {
              const metadata = typeof valuation.metadata === 'string' 
                ? JSON.parse(valuation.metadata) 
                : valuation.metadata;
              
              return (
                <div
                  key={valuation.id}
                  style={{
                    background: '#fff',
                    borderRadius: '12px',
                    border: '1px solid #e0e0e0',
                    overflow: 'hidden',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex' }}>
                    {/* Product Image */}
                    <div style={{
                      width: '120px',
                      height: '120px',
                      background: valuation.product_image || metadata?.product_image
                        ? `url(http://localhost:4000${valuation.product_image || metadata?.product_image}) center/cover`
                        : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                      flexShrink: 0
                    }} />

                    {/* Valuation Details */}
                    <div style={{
                      flex: 1,
                      padding: '20px 24px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <h3 style={{
                          fontSize: '18px',
                          fontWeight: 500,
                          marginBottom: '4px'
                        }}>
                          {valuation.brand} {valuation.object_name}
                        </h3>
                        
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          marginTop: '12px'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '14px',
                            color: '#666'
                          }}>
                            <Calendar size={14} />
                            {formatDate(valuation.valuation_date)}
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '14px',
                            color: '#666'
                          }}>
                            <User size={14} />
                            {valuation.appraiser_name} • {getAppraiserTypeLabel(valuation.appraiser_type)}
                          </div>
                          {valuation.valuation_method && (
                            <div style={{
                              fontSize: '14px',
                              color: '#666'
                            }}>
                              Method: {valuation.valuation_method}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{
                        textAlign: 'right',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        <div>
                          <p style={{
                            fontSize: '24px',
                            fontWeight: 600,
                            marginBottom: '4px'
                          }}>
                            {formatCurrency(valuation.appraised_value)}
                          </p>
                          {valuation.appraised_value_eth && (
                            <p style={{
                              fontSize: '14px',
                              color: '#666'
                            }}>
                              ≈ {valuation.appraised_value_eth} ETH
                            </p>
                          )}
                        </div>

                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                          justifyContent: 'flex-end'
                        }}>
                          <div style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 500,
                            background: `${getStatusColor(valuation.status)}20`,
                            color: getStatusColor(valuation.status),
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {valuation.status === 'completed' && <Check size={12} />}
                            {valuation.status === 'pending' && <Clock size={12} />}
                            {valuation.status === 'expired' && <AlertCircle size={12} />}
                            {valuation.status.charAt(0).toUpperCase() + valuation.status.slice(1)}
                          </div>

                          {valuation.certificate_url ? (
                            <button
                              onClick={() => api.downloadValuationCertificate(clientData.id, valuation.id)}
                              style={{
                                padding: '6px 12px',
                                background: 'none',
                                border: '1px solid #e0e0e0',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#000';
                                e.currentTarget.style.background = '#000';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#e0e0e0';
                                e.currentTarget.style.background = 'none';
                                e.currentTarget.style.color = '#000';
                              }}
                            >
                              <Download size={12} />
                              Certificate
                            </button>
                          ) : (
                            <span style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              color: '#999'
                            }}>
                              Pending certificate
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Export Buttons */}
      <div style={{
        marginTop: '40px',
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end'
      }}>
        <button
          style={{
            padding: '10px 20px',
            background: 'none',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#666'
          }}
          disabled
        >
          <Download size={16} />
          Export PDF
        </button>
        <button
          style={{
            padding: '10px 20px',
            background: 'none',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#666'
          }}
          disabled
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Request Form Modal */}
      {showRequestForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 500,
              marginBottom: '24px'
            }}>
              Request New Valuation
            </h2>

            {/* Product Selection */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                marginBottom: '8px'
              }}>
                Select Product
              </label>
              <select
                value={selectedProduct || ''}
                onChange={(e) => setSelectedProduct(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  background: '#fff',
                  cursor: 'pointer'
                }}
              >
                <option value="">Choose a product...</option>
                {clientProducts.length === 0 ? (
                  <option disabled>No products available</option>
                ) : (
                  clientProducts.map(product => {
                    const metadata = typeof product.metadata === 'string' 
                      ? JSON.parse(product.metadata) 
                      : product.metadata;
                    return (
                      <option key={product.id} value={product.id}>
                        {metadata?.brand || 'Unknown Brand'} {metadata?.object_name || 'Unknown Product'} - {product.nfc_uid?.slice(0, 8) || 'Unknown'}...
                      </option>
                    );
                  })
                )}
              </select>
              
              {clientProducts.length === 0 && (
                <p style={{
                  fontSize: '14px',
                  color: '#999',
                  marginTop: '8px',
                  fontStyle: 'italic'
                }}>
                  No products found in your vault. Please add products to request valuations.
                </p>
              )}
            </div>

            {/* Reason */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                marginBottom: '8px'
              }}>
                Reason for Revaluation (Optional)
              </label>
              <textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="e.g., Insurance update, potential sale, annual review..."
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Authenticator Connection */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={connectAuthenticator}
                  onChange={(e) => setConnectAuthenticator(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ fontSize: '16px' }}>
                  Connect with AUCTA-certified authenticator in my region
                </span>
              </label>
            </div>

            {connectAuthenticator && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px'
                }}>
                  Preferred Region
                </label>
                <select
                  value={preferredRegion}
                  onChange={(e) => setPreferredRegion(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Select region...</option>
                  <option value="europe-west">Western Europe</option>
                  <option value="europe-east">Eastern Europe</option>
                  <option value="north-america">North America</option>
                  <option value="asia-pacific">Asia Pacific</option>
                  <option value="middle-east">Middle East</option>
                  <option value="latin-america">Latin America</option>
                </select>

                {/* Static Map Placeholder */}
                <div style={{
                  marginTop: '16px',
                  height: '200px',
                  background: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <MapPin size={32} style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '14px' }}>
                      Authenticator network map
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowRequestForm(false);
                  setSelectedProduct(null);
                  setRequestReason('');
                  setConnectAuthenticator(false);
                  setPreferredRegion('');
                }}
                style={{
                  padding: '12px 24px',
                  background: 'none',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={!selectedProduct || submitting}
                style={{
                  padding: '12px 24px',
                  background: selectedProduct && !submitting ? '#000' : '#e0e0e0',
                  color: selectedProduct && !submitting ? '#fff' : '#999',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: selectedProduct && !submitting ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s'
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

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