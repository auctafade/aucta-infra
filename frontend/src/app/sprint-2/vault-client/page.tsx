// frontend/src/app/sprint-2/vault-client/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Package, ExternalLink, Shield, Calendar, Hash } from 'lucide-react';
import { api, auth } from '@/lib/api';

export default function VaultClient() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<any>(null);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    const fetchVaultData = async () => {
      try {
        const client = auth.getClientData();
        if (!client) {
          console.warn('No client data found');
          setLoading(false);
          return;
        }
        
        console.log('Client data:', client); // Debug log
        setClientData(client);
        
        // Check if client has a valid ID
        if (!client.id) {
          console.warn('Client has no ID, cannot fetch vault');
          setProducts([]);
          setLoading(false);
          return;
        }
        
        try {
          // Try the protected endpoint first (with auth)
          console.log('Fetching vault for client ID:', client.id);
          let vaultData;
          
          try {
            // First try the protected endpoint
            vaultData = await api.getClientVaultProtected(client.id);
            console.log('Protected vault data:', vaultData);
            
            // If the protected endpoint returns data with client and products structure
            if (vaultData && vaultData.products) {
              setProducts(vaultData.products);
            } else {
              // Otherwise treat the response as a direct products array
              setProducts(Array.isArray(vaultData) ? vaultData : []);
            }
          } catch (protectedError) {
            console.warn('Protected endpoint failed, trying unprotected:', protectedError);
            // Fall back to unprotected endpoint
            const unprotectedData = await api.getClientVault(client.id);
            setProducts(Array.isArray(unprotectedData) ? unprotectedData : []);
          }
          
          // Calculate total value from all products
          const productsArray = Array.isArray(vaultData) ? vaultData : (vaultData?.products || []);
          const total = productsArray.reduce((sum: number, product: any) => {
            // Parse metadata if it's a string
            const metadata = typeof product.metadata === 'string' 
              ? JSON.parse(product.metadata) 
              : product.metadata;
            
            // Get the original_price from various possible locations
            const price = product.original_price || 
                         metadata?.original_price || 
                         metadata?.value ||
                         product.value;
            
            if (price) {
              // Remove any currency symbols and parse the number
              const numericPrice = parseFloat(price.toString().replace(/[^0-9.-]+/g, ''));
              return sum + (isNaN(numericPrice) ? 0 : numericPrice);
            }
            
            return sum;
          }, 0);
          
          setTotalValue(total);
          console.log('Total vault value:', total);
        } catch (vaultError) {
          console.error('Error fetching vault data:', vaultError);
          // Set empty products array if vault fetch fails
          setProducts([]);
          setTotalValue(0);
        }
      } catch (error) {
        console.error('Error in fetchVaultData:', error);
        setProducts([]);
        setTotalValue(0);
      } finally {
        setLoading(false);
      }
    };

    fetchVaultData();
  }, []);

  // Format currency with proper locale
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate last activity (most recent created_at date)
  const getLastActivity = () => {
    if (products.length === 0) return 'No activity';
    
    const mostRecent = products.reduce((latest, product) => {
      const productDate = new Date(product.created_at);
      return productDate > latest ? productDate : latest;
    }, new Date(products[0].created_at));
    
    const daysAgo = Math.floor((Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return '1 day ago';
    return `${daysAgo} days ago`;
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
          <p style={{ color: '#666', fontSize: '14px' }}>Loading your vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Section */}
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
            Welcome back, {clientData?.name || 'User'}
          </h1>
          <p style={{
            fontSize: '18px',
            opacity: 0.9,
            marginBottom: '32px'
          }}>
            You have {products.length} authenticated {products.length === 1 ? 'product' : 'products'} in your vault
          </p>
          
          <div style={{
            display: 'flex',
            gap: '32px',
            flexWrap: 'wrap'
          }}>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Total Value</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>{formatCurrency(totalValue)}</p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Last Activity</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>{getLastActivity()}</p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Security Score</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>100%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 40px',
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e0e0e0'
        }}>
          <Package size={64} color="#e0e0e0" style={{ margin: '0 auto 24px' }} />
          <h2 style={{
            fontSize: '24px',
            fontWeight: 400,
            marginBottom: '16px',
            color: '#333'
          }}>
            Your vault is empty
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#666',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            Products assigned to your account will appear here. Each product comes with blockchain authentication and lifetime tracking.
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
              : product.metadata || {};
            
            // Get price from various possible locations
            const price = product.original_price || 
                         metadata?.original_price || 
                         metadata?.value ||
                         product.value;
            
            // Get image URL with proper formatting
            const imageUrl = metadata.product_image || metadata.image;
            const fullImageUrl = imageUrl && !imageUrl.startsWith('http') 
              ? `http://localhost:4000${imageUrl}`
              : imageUrl;
            
            return (
              <div
                key={product.id}
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid #e0e0e0',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Product Image */}
                <div style={{
                  height: '240px',
                  background: fullImageUrl 
                    ? `url(${fullImageUrl}) center/cover`
                    : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: product.status === 'MINTED' ? '#000' : '#666',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 500
                  }}>
                    {product.status}
                  </div>
                </div>

                {/* Product Info */}
                <div style={{ padding: '24px' }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: 500,
                    marginBottom: '8px',
                    letterSpacing: '-0.01em'
                  }}>
                    {metadata.brand || 'Unknown Brand'}
                  </h3>
                  <p style={{
                    fontSize: '16px',
                    color: '#666',
                    marginBottom: '16px'
                  }}>
                    {metadata.object_name || 'Unknown Product'}
                  </p>

                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    marginBottom: '16px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      <Calendar size={16} />
                      {product.collection_year || metadata.collection_year || 'N/A'}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      <Hash size={16} />
                      {product.nfc_uid.slice(0, 8)}...
                    </div>
                  </div>

                  {/* Show price if available */}
                  {price && (
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      marginBottom: '16px',
                      color: '#000'
                    }}>
                      {formatCurrency(parseFloat(price.toString().replace(/[^0-9.-]+/g, '')))}
                    </div>
                  )}

                  {product.sbt_hash && (
                    <div style={{
                      padding: '12px',
                      background: '#f5f5f5',
                      borderRadius: '8px',
                      fontSize: '12px',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px'
                      }}>
                        <Shield size={14} />
                        <span style={{ fontWeight: 500 }}>Blockchain Verified</span>
                      </div>
                      <p style={{
                        color: '#666',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        wordBreak: 'break-all'
                      }}>
                        {product.sbt_hash.slice(0, 20)}...
                      </p>
                    </div>
                  )}

                  <button
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'none',
                      border: '1px solid #000',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#000';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = '#000';
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/sprint-2/passport/${product.id}`;
                    }}
                  >
                    View Details
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>
            );
          })}
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