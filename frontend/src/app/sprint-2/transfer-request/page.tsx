// frontend/src/app/sprint-2/transfer-request/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Package, AlertCircle, Send, Clock, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { api, auth } from '@/lib/api';

interface Product {
  id: number;
  nfc_uid: string;
  metadata: any;
  status: string;
  original_price?: string;
  collection_year?: string;
  sbt_hash?: string;
}

interface TransferRequest {
  id: number;
  client_id: number;
  product_id: number;
  reason: string;
  is_resale: boolean;
  recipient_wallet_address?: string;
  recipient_first_name?: string;
  recipient_last_name?: string;
  recipient_email?: string;
  status: string;
  admin_notes?: string;
  blockchain_tx_hash?: string;
  created_at: string;
  completed_at?: string;
  // Joined product data
  brand?: string;
  object_name?: string;
  product_image?: string;
  original_price?: string;
}

export default function TransferRequest() {
  const [products, setProducts] = useState<Product[]>([]);
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clientData, setClientData] = useState<any>(null);
  
  // Form state
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isResale, setIsResale] = useState(false);
  const [recipientType, setRecipientType] = useState<'wallet' | 'email'>('wallet');
  const [recipientWallet, setRecipientWallet] = useState('');
  const [recipientFirstName, setRecipientFirstName] = useState('');
  const [recipientLastName, setRecipientLastName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const client = auth.getClientData();
      if (!client) {
        window.location.href = '/sprint-2/login';
        return;
      }
      
      setClientData(client);
      
      // Fetch owned products first (this should work)
      let vaultProducts = [];
      let requests = [];
      
      try {
        vaultProducts = await api.getClientVault(client.id);
      } catch (vaultError) {
        console.error('Error fetching vault products:', vaultError);
        setError('Failed to load products from vault');
        vaultProducts = [];
      }

      // Try to fetch transfer requests separately
      try {
        requests = await api.getTransferRequests(client.id);
      } catch (transferError) {
        console.warn('Transfer requests not available:', transferError);
        requests = [];
      }
      
      // Only show products that are not already in transfer
      const activeTransferProductIds = requests
        .filter((r: TransferRequest) => ['pending', 'reviewing', 'approved', 'waiting_recipient'].includes(r.status))
        .map((r: TransferRequest) => r.product_id);
      
      const availableProducts = vaultProducts.filter((p: Product) => 
        !activeTransferProductIds.includes(p.id)
      );
      
      setProducts(availableProducts);
      setTransferRequests(requests);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Some features may be unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const client = auth.getClientData();
      if (!client) return;

      const transferData: any = {
        product_id: parseInt(selectedProduct),
        reason,
        is_resale: isResale
      };

      if (recipientType === 'wallet') {
        transferData.recipient_wallet_address = recipientWallet;
      } else {
        transferData.recipient_first_name = recipientFirstName;
        transferData.recipient_last_name = recipientLastName;
        transferData.recipient_email = recipientEmail;
      }

      try {
        const result = await api.submitTransferRequest(client.id, transferData);
        setSuccess(result.message || 'Transfer request submitted successfully');
        
        // Reset form
        setSelectedProduct('');
        setReason('');
        setIsResale(false);
        setRecipientWallet('');
        setRecipientFirstName('');
        setRecipientLastName('');
        setRecipientEmail('');
        
        // Refresh data
        await fetchData();
      } catch (submitError: any) {
        if (submitError.message?.includes('404') || submitError.message?.includes('Not Found')) {
          setError('Transfer request feature is not yet available on the backend. Please check back later.');
        } else {
          throw submitError;
        }
      }
    } catch (error: any) {
      console.error('Error submitting transfer request:', error);
      setError(error.message || 'Failed to submit transfer request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (requestId: number) => {
    try {
      const client = auth.getClientData();
      if (!client) return;

      try {
        await api.cancelTransferRequest(client.id, requestId);
        await fetchData();
      } catch (cancelError: any) {
        if (cancelError.message?.includes('404') || cancelError.message?.includes('Not Found')) {
          console.warn('Cancel endpoint not available');
          setError('Cancel feature is not yet available on the backend.');
        } else {
          throw cancelError;
        }
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
      setError('Failed to cancel request');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'reviewing':
      case 'waiting_recipient':
        return <Clock size={16} className="text-yellow-600" />;
      case 'approved':
      case 'completed':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'rejected':
        return <XCircle size={16} className="text-red-600" />;
      default:
        return <AlertCircle size={16} className="text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'reviewing': return 'Under Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'completed': return 'Completed';
      case 'waiting_recipient': return 'Waiting for Recipient';
      default: return status;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
          <p style={{ color: '#666', fontSize: '14px' }}>Loading transfer requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section - Same style as vault */}
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
            Transfer Request
          </h1>
          <p style={{
            fontSize: '18px',
            opacity: 0.9,
            marginBottom: '32px'
          }}>
            Initiate secure transfer requests for your authenticated products
          </p>
          
          <div style={{
            display: 'flex',
            gap: '32px',
            flexWrap: 'wrap'
          }}>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Available Products</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>{products.length}</p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Active Requests</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>
                {transferRequests.filter(r => ['pending', 'reviewing', 'approved', 'waiting_recipient'].includes(r.status)).length}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Completed Transfers</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>
                {transferRequests.filter(r => r.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Request Form */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e0e0e0',
        padding: '32px',
        marginBottom: '40px'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 400,
          marginBottom: '24px',
          color: '#333'
        }}>
          New Transfer Request
        </h2>

        {error && (
          <div style={{
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            color: '#c00',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#efe',
            border: '1px solid #cfc',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            color: '#060',
            fontSize: '14px'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Product Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '8px',
              color: '#333'
            }}>
              Select Product
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="">Choose a product to transfer</option>
              {products.map((product) => {
                const metadata = typeof product.metadata === 'string' 
                  ? JSON.parse(product.metadata) 
                  : product.metadata;
                return (
                  <option key={product.id} value={product.id}>
                    {metadata.brand} {metadata.object_name} - {product.nfc_uid.slice(0, 8)}...
                  </option>
                );
              })}
            </select>
          </div>

          {/* Transfer Reason */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '8px',
              color: '#333'
            }}>
              Reason for Transfer
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="">Select reason</option>
              <option value="resale">Resale</option>
              <option value="inheritance">Inheritance</option>
              <option value="gift">Gift</option>
              <option value="legal_assignment">Legal Assignment</option>
            </select>
          </div>

          {/* Resale Checkbox */}
          {reason === 'resale' && (
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              background: '#f5f5f5',
              borderRadius: '8px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="checkbox"
                  checked={isResale}
                  onChange={(e) => setIsResale(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Confirm this is a resale transaction (2% royalty will apply)
              </label>
            </div>
          )}

          {/* Recipient Type Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '8px',
              color: '#333'
            }}>
              Recipient Information
            </label>
            <div style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '16px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="radio"
                  name="recipientType"
                  value="wallet"
                  checked={recipientType === 'wallet'}
                  onChange={() => setRecipientType('wallet')}
                  style={{ cursor: 'pointer' }}
                />
                I have their wallet address
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="radio"
                  name="recipientType"
                  value="email"
                  checked={recipientType === 'email'}
                  onChange={() => setRecipientType('email')}
                  style={{ cursor: 'pointer' }}
                />
                I have their name and email
              </label>
            </div>
          </div>

          {/* Wallet Address Input */}
          {recipientType === 'wallet' && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                marginBottom: '8px',
                color: '#333'
              }}>
                Recipient Wallet Address
              </label>
              <input
                type="text"
                value={recipientWallet}
                onChange={(e) => setRecipientWallet(e.target.value)}
                placeholder="0x..."
                required
                pattern="^0x[a-fA-F0-9]{40}$"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
            </div>
          )}

          {/* Name and Email Inputs */}
          {recipientType === 'email' && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    marginBottom: '8px',
                    color: '#333'
                  }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={recipientFirstName}
                    onChange={(e) => setRecipientFirstName(e.target.value)}
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
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    marginBottom: '8px',
                    color: '#333'
                  }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={recipientLastName}
                    onChange={(e) => setRecipientLastName(e.target.value)}
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
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: '#333'
                }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  marginTop: '8px'
                }}>
                  An invitation will be sent to this email address to join AUCTA
                </p>
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !selectedProduct || !reason}
            style={{
              background: '#000',
              color: '#fff',
              padding: '14px 24px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.background = '#333';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#000';
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={16} />
                Submit Transfer Request
              </>
            )}
          </button>
        </form>
      </div>

      {/* Transfer History */}
      <div>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 400,
          marginBottom: '24px',
          color: '#333'
        }}>
          Transfer History
        </h2>

        {transferRequests.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 40px',
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #e0e0e0'
          }}>
            <Package size={64} color="#e0e0e0" style={{ margin: '0 auto 24px' }} />
            <h3 style={{
              fontSize: '24px',
              fontWeight: 400,
              marginBottom: '16px',
              color: '#333'
            }}>
              No transfer requests yet
            </h3>
            <p style={{
              fontSize: '16px',
              color: '#666',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              When you submit transfer requests for your products, they will appear here for tracking.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {transferRequests.map((request) => (
              <div
                key={request.id}
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #e0e0e0',
                  padding: '24px',
                  display: 'flex',
                  gap: '24px',
                  alignItems: 'center'
                }}
              >
                {/* Product Image */}
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '8px',
                  background: request.product_image 
                    ? `url(http://localhost:4000${request.product_image}) center/cover`
                    : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                  flexShrink: 0
                }} />

                {/* Request Details */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px'
                  }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: 500,
                      margin: 0
                    }}>
                      {request.brand} {request.object_name}
                    </h3>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      background: '#f5f5f5',
                      borderRadius: '16px',
                      fontSize: '12px'
                    }}>
                      {getStatusIcon(request.status)}
                      {getStatusText(request.status)}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '24px',
                    fontSize: '14px',
                    color: '#666'
                  }}>
                    <span>Reason: {request.reason.replace('_', ' ')}</span>
                    <span>Requested: {formatDate(request.created_at)}</span>
                    {request.is_resale && <span>• Resale</span>}
                  </div>

                  {/* Recipient Info */}
                  <div style={{
                    marginTop: '8px',
                    fontSize: '14px',
                    color: '#666'
                  }}>
                    Recipient: {request.recipient_wallet_address 
                      ? `${request.recipient_wallet_address.slice(0, 6)}...${request.recipient_wallet_address.slice(-4)}`
                      : `${request.recipient_first_name} ${request.recipient_last_name} (${request.recipient_email})`
                    }
                  </div>

                  {/* Admin Notes */}
                  {request.admin_notes && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      background: '#f5f5f5',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#666'
                    }}>
                      <strong>AUCTA Note:</strong> {request.admin_notes}
                    </div>
                  )}

                  {/* Blockchain Info */}
                  {request.blockchain_tx_hash && (
                    <div style={{
                      marginTop: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px'
                    }}>
                      <ExternalLink size={14} />
                      <a
                        href={`#tx-${request.blockchain_tx_hash}`}
                        style={{
                          color: '#0066cc',
                          textDecoration: 'none'
                        }}
                      >
                        View on blockchain
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ flexShrink: 0 }}>
                  {['pending', 'waiting_recipient'].includes(request.status) && (
                    <button
                      onClick={() => handleCancel(request.id)}
                      style={{
                        padding: '8px 16px',
                        background: 'none',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        color: '#666',
                        transition: 'all 0.3s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#c00';
                        e.currentTarget.style.color = '#c00';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.color = '#666';
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}