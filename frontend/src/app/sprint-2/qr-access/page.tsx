'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, Clock, Shield, X } from 'lucide-react';
import { api, auth } from '@/lib/api';
import QRCodeGenerator from 'qrcode';

// Extend the api object with QR access methods
declare module '@/lib/api' {
  interface API {
    getQRAccessTokens(clientId: number): Promise<any>;
    createQRAccessToken(clientId: number, data: any): Promise<any>;
    revokeQRAccessToken(clientId: number, tokenId: number): Promise<any>;
  }
}

interface Product {
  id: number;
  nfc_uid: string;
  metadata: any;
  status: string;
  original_price?: string;
  collection_year?: string;
  created_at: string;
  sbt_hash?: string;
}

interface QRAccessToken {
  id: number;
  client_id: number;
  passport_id: number;
  token: string;
  access_reason: string;
  validity_duration: string;
  expires_at: string;
  authorized_email?: string;
  authorized_name?: string;
  usage_type: string;
  used_at?: string;
  revoked_at?: string;
  status: string;
  created_at: string;
  product?: Product;
}

export default function QRAccess() {
  const [products, setProducts] = useState<Product[]>([]);
  const [qrTokens, setQrTokens] = useState<QRAccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<{ dataUrl: string; token: QRAccessToken } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    access_reason: '',
    validity_duration: '',
    custom_duration: '',
    authorized_email: '',
    authorized_name: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const client = auth.getClientData();
      if (!client) return;
      
      setClientData(client);
      
      // Fetch products
      const vaultProducts = await api.getClientVault(client.id);
      setProducts(vaultProducts);
      
      // Fetch existing QR tokens
      try {
        const tokens = await api.getQRAccessTokens(client.id);
        setQrTokens(tokens);
      } catch (error) {
        console.warn('QR access tokens endpoint not implemented yet');
        setQrTokens([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (url: string): Promise<string> => {
    try {
      return await QRCodeGenerator.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  const handleGenerateQR = async (product: Product) => {
    setSelectedProduct(product);
    setShowForm(true);
    setGeneratedQR(null);
    setFormData({
      access_reason: '',
      validity_duration: '',
      custom_duration: '',
      authorized_email: '',
      authorized_name: ''
    });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct || !clientData) return;
    
    try {
      // Calculate expiration based on duration
      let expiresIn = 3600; // default 1 hour in seconds
      switch (formData.validity_duration) {
        case '15min':
          expiresIn = 900;
          break;
        case '1h':
          expiresIn = 3600;
          break;
        case '24h':
          expiresIn = 86400;
          break;
        case 'custom':
          expiresIn = parseInt(formData.custom_duration) * 3600;
          break;
      }

      const tokenData = {
        passport_id: selectedProduct.id,
        access_reason: formData.access_reason,
        validity_duration: formData.validity_duration,
        expires_in: expiresIn,
        authorized_email: formData.authorized_email || undefined,
        authorized_name: formData.authorized_name || undefined
      };

      // Create QR token via API
      const response = await api.createQRAccessToken(clientData.id, tokenData);
      
      // Generate QR code with the access URL
      const accessUrl = `${window.location.origin}/access/verify?token=${response.token}`;
      const qrDataUrl = await generateQRCode(accessUrl);
      
      setGeneratedQR({
        dataUrl: qrDataUrl,
        token: response
      });
      
      // Refresh tokens list
      fetchData();
    } catch (error) {
      console.error('Error creating QR access token:', error);
      alert('Failed to generate QR code. Please try again.');
    }
  };

  const handleRevokeToken = async (tokenId: number) => {
    if (!clientData) return;
    
    if (!confirm('Are you sure you want to revoke this access?')) return;
    
    try {
      await api.revokeQRAccessToken(clientData.id, tokenId);
      fetchData();
    } catch (error) {
      console.error('Error revoking token:', error);
      alert('Failed to revoke access. Please try again.');
    }
  };

  const getTokenStatus = (token: QRAccessToken) => {
    if (token.revoked_at) return 'revoked';
    if (token.used_at && token.usage_type === 'single') return 'used';
    if (new Date(token.expires_at) < new Date()) return 'expired';
    return 'active';
  };

  const formatDuration = (duration: string) => {
    switch (duration) {
      case '15min': return '15 minutes';
      case '1h': return '1 hour';
      case '24h': return '24 hours';
      case 'custom': return 'Custom';
      default: return duration;
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
          <p style={{ color: '#666', fontSize: '14px' }}>Loading QR access...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div style={{
        background: 'linear-gradient(135deg, #000 0%, #333 100%)',
        borderRadius: '16px',
        padding: '48px',
        color: '#fff',
        marginBottom: '40px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: 300,
            marginBottom: '16px',
            letterSpacing: '-0.02em'
          }}>
            QR Access Control
          </h1>
          <p style={{
            fontSize: '18px',
            opacity: 0.9,
            marginBottom: '32px'
          }}>
            Generate secure, temporary access to your authenticated products
          </p>
          
          <div style={{
            display: 'flex',
            gap: '32px',
            flexWrap: 'wrap'
          }}>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Active Tokens</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>
                {qrTokens.filter(t => getTokenStatus(t) === 'active').length}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Total Generated</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>{qrTokens.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div style={{ marginBottom: '48px' }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 400,
          marginBottom: '24px',
          letterSpacing: '-0.01em'
        }}>
          Select a Product
        </h2>

        {products.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 40px',
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #e0e0e0'
          }}>
            <QrCode size={64} color="#e0e0e0" style={{ margin: '0 auto 24px' }} />
            <h3 style={{
              fontSize: '20px',
              fontWeight: 400,
              marginBottom: '16px',
              color: '#333'
            }}>
              No products available
            </h3>
            <p style={{
              fontSize: '16px',
              color: '#666',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              You need authenticated products in your vault to generate QR access codes.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '24px'
          }}>
            {products.map((product) => {
              const metadata = typeof product.metadata === 'string' 
                ? JSON.parse(product.metadata) 
                : product.metadata;
              
              return (
                <div
                  key={product.id}
                  style={{
                    background: '#fff',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid #e0e0e0',
                    transition: 'all 0.3s'
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    {metadata.product_image && (
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        background: `url(http://localhost:4000${metadata.product_image}) center/cover`,
                        flexShrink: 0
                      }} />
                    )}
                    
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: 500,
                        marginBottom: '4px'
                      }}>
                        {metadata.brand}
                      </h3>
                      <p style={{
                        fontSize: '14px',
                        color: '#666',
                        marginBottom: '8px'
                      }}>
                        {metadata.object_name}
                      </p>
                      <p style={{
                        fontSize: '12px',
                        color: '#999',
                        fontFamily: 'monospace'
                      }}>
                        {product.nfc_uid}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleGenerateQR(product)}
                    style={{
                      width: '100%',
                      marginTop: '16px',
                      padding: '12px',
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'opacity 0.3s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    Generate QR Access
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Tokens Section */}
      <div>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 400,
          marginBottom: '24px',
          letterSpacing: '-0.01em'
        }}>
          Access History
        </h2>

        {qrTokens.length === 0 ? (
          <div style={{
            padding: '40px',
            background: '#f8f8f8',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#666'
          }}>
            No QR access tokens generated yet
          </div>
        ) : (
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
            overflow: 'hidden'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 500 }}>Product</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 500 }}>Reason</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 500 }}>Created</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 500 }}>Expires</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 500 }}>Status</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 500 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {qrTokens.map((token) => {
                  const status = getTokenStatus(token);
                  const product = products.find(p => p.id === token.passport_id);
                  const metadata = product && (typeof product.metadata === 'string' 
                    ? JSON.parse(product.metadata) 
                    : product.metadata);
                  
                  return (
                    <tr key={token.id} style={{
                      borderBottom: '1px solid #f0f0f0'
                    }}>
                      <td style={{ padding: '16px' }}>
                        {metadata ? `${metadata.brand} ${metadata.object_name}` : 'Unknown'}
                      </td>
                      <td style={{ padding: '16px', textTransform: 'capitalize' }}>
                        {token.access_reason.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#666' }}>
                        {new Date(token.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#666' }}>
                        {new Date(token.expires_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: status === 'active' ? '#e8f5e9' :
                                     status === 'used' ? '#fff3e0' :
                                     status === 'expired' ? '#fafafa' : '#ffebee',
                          color: status === 'active' ? '#2e7d32' :
                                 status === 'used' ? '#e65100' :
                                 status === 'expired' ? '#666' : '#c62828'
                        }}>
                          {status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        {status === 'active' && (
                          <button
                            onClick={() => handleRevokeToken(token.id)}
                            style={{
                              padding: '6px 16px',
                              background: 'none',
                              border: '1px solid #000',
                              borderRadius: '6px',
                              fontSize: '13px',
                              cursor: 'pointer',
                              transition: 'all 0.3s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#000';
                              e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'none';
                              e.currentTarget.style.color = '#000';
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Generation Form Modal */}
      {showForm && selectedProduct && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '32px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 400
              }}>
                Generate QR Access
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setGeneratedQR(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X size={24} />
              </button>
            </div>

            {!generatedQR ? (
              <form onSubmit={handleSubmitForm}>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 500
                  }}>
                    Access Reason *
                  </label>
                  <select
                    value={formData.access_reason}
                    onChange={(e) => setFormData({ ...formData, access_reason: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                  >
                    <option value="">Select reason</option>
                    <option value="resale">Resale</option>
                    <option value="verification">Verification</option>
                    <option value="consignment">Consignment</option>
                    <option value="expertise">Expertise</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 500
                  }}>
                    Validity Duration *
                  </label>
                  <select
                    value={formData.validity_duration}
                    onChange={(e) => setFormData({ ...formData, validity_duration: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                  >
                    <option value="">Select duration</option>
                    <option value="15min">15 minutes</option>
                    <option value="1h">1 hour</option>
                    <option value="24h">24 hours</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {formData.validity_duration === 'custom' && (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '14px',
                      fontWeight: 500
                    }}>
                      Custom Duration (hours) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={formData.custom_duration}
                      onChange={(e) => setFormData({ ...formData, custom_duration: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                )}

                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 500
                  }}>
                    Authorized Person (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.authorized_name}
                    onChange={(e) => setFormData({ ...formData, authorized_name: e.target.value })}
                    placeholder="Name"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      marginBottom: '12px'
                    }}
                  />
                  <input
                    type="email"
                    value={formData.authorized_email}
                    onChange={(e) => setFormData({ ...formData, authorized_email: e.target.value })}
                    placeholder="Email"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'opacity 0.3s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Generate QR Code
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  display: 'inline-block',
                  padding: '24px',
                  background: '#f8f8f8',
                  borderRadius: '12px',
                  marginBottom: '24px'
                }}>
                  <img
                    src={generatedQR.dataUrl}
                    alt="QR Code"
                    style={{
                      display: 'block',
                      margin: '0 auto'
                    }}
                  />
                </div>
                
                <div style={{
                  marginBottom: '24px',
                  padding: '16px',
                  background: '#f0f0f0',
                  borderRadius: '8px',
                  textAlign: 'left'
                }}>
                  <p style={{ fontSize: '14px', marginBottom: '8px' }}>
                    <strong>Access URL:</strong>
                  </p>
                  <p style={{
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    color: '#666'
                  }}>
                    {`${window.location.origin}/access/verify?token=${generatedQR.token.token}`}
                  </p>
                </div>
                
                <div style={{
                  display: 'flex',
                  gap: '12px'
                }}>
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = generatedQR.dataUrl;
                      link.download = `QR-${selectedProduct.id}-${Date.now()}.png`;
                      link.click();
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'opacity 0.3s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    Download QR
                  </button>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setGeneratedQR(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'none',
                      border: '1px solid #000',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#000';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = '#000';
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
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