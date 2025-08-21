"use client";

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  AlertCircle, 
  CheckCircle, 
  Settings, 
  Package, 
  DollarSign, 
  QrCode, 
  ExternalLink, 
  Users, 
  Shield, 
  Zap,
  Eye,
  Download,
  Copy,
  RefreshCw,
  Filter,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Info,
  Crown,
  Percent,
  CreditCard,
  Gift,
  X
} from 'lucide-react';

// Type definitions
interface ReadyToResaleProduct {
  id: string;
  passport_id: string;
  nfc_uid: string;
  status: string;
  assigned_client_id: string | null;
  ownership_depth?: number;
  buyer_levels?: string[];
  metadata?: {
    hash?: string;
    brand?: string;
    object_name?: string;
    product_image?: string;
    collection_year?: string;
    original_price?: string;
    [key: string]: any;
  };
  client_name?: string;
  client_email?: string;
  resale_config?: {
    resale_type: 'private' | 'auction' | 'delegated';
    royalties_enabled: boolean;
    cashback_enabled: boolean;
    brand_participation: boolean;
    brand_revenue_share?: number;
    qr_access_generated: boolean;
    qr_access_url?: string;
    configured_at?: string;
    ownership_depth?: number;
    royalty_tiers?: { [key: string]: number };
    cashback_tiers?: { [key: string]: number };
  };
  current_valuation?: {
    amount: number;
    currency: string;
    date: string;
  };
}

interface ResaleConfiguration {
  resale_type: 'private' | 'auction' | 'delegated';
  royalties_enabled: boolean;
  cashback_enabled: boolean;
  brand_participation: boolean;
  brand_revenue_share: number;
  qr_access_enabled: boolean;
  qr_access_expiry_hours: number;
  royalty_tiers: { [key: string]: number };
  cashback_tiers: { [key: string]: number };
}

const ResaleConfigurePage = () => {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'configured' | 'unconfigured'>('all');
  const [products, setProducts] = useState<ReadyToResaleProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ReadyToResaleProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ReadyToResaleProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  
  // Configuration state
  const [config, setConfig] = useState<ResaleConfiguration>({
    resale_type: 'private',
    royalties_enabled: true,
    cashback_enabled: false,
    brand_participation: false,
    brand_revenue_share: 5,
    qr_access_enabled: false,
    qr_access_expiry_hours: 24,
    royalty_tiers: {},
    cashback_tiers: {}
  });

  // QR Code state
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [qrCodeExpiry, setQrCodeExpiry] = useState<string>('');

  // ---- Helpers: shared wallet-like styles ----
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

  const btnSuccess: React.CSSProperties = {
    ...btnBase,
    background: "#16a34a",
    color: "#fff",
  };

  const btnWarning: React.CSSProperties = {
    ...btnBase,
    background: "#f59e0b",
    color: "#fff",
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

  const banner = (type: "error" | "warn" | "success" | "info") => {
    const map = {
      error: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c", icon: AlertCircle },
      warn: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", icon: AlertCircle },
      success: { bg: "#ecfdf5", border: "#d1fae5", color: "#065f46", icon: CheckCircle },
      info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af", icon: Info },
    }[type];
    const Icon = map.icon;
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

  // Load ready-to-resale products
  const loadReadyToResaleProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:4000/api/sprint3/resale-console/ready-to-resale');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      } else {
        // Mock data for development
        setProducts([
          {
            id: '1',
            passport_id: 'PASSPORT-001',
            nfc_uid: 'NFC-ABC123456789',
            status: 'READY_FOR_RESALE',
            assigned_client_id: 'CLIENT-001',
            metadata: {
              brand: 'Hermès',
              object_name: 'Birkin 30',
              product_image: '/uploads/passports/product-1750216941484-690715619.webp',
              collection_year: '2023',
              original_price: '15000'
            },
            client_name: 'John Doe',
            client_email: 'john@example.com',
            resale_config: {
              resale_type: 'private',
              royalties_enabled: true,
              cashback_enabled: false,
              brand_participation: true,
              brand_revenue_share: 5,
              qr_access_generated: true,
              qr_access_url: 'https://aucta.com/preview/abc123',
              configured_at: '2024-01-15T10:30:00Z'
            },
            current_valuation: {
              amount: 18000,
              currency: 'EUR',
              date: '2024-01-10'
            }
          },
          {
            id: '2',
            passport_id: 'PASSPORT-002',
            nfc_uid: 'NFC-DEF987654321',
            status: 'READY_FOR_RESALE',
            assigned_client_id: 'CLIENT-002',
            metadata: {
              brand: 'Chanel',
              object_name: 'Classic Flap Bag',
              product_image: '/uploads/passports/product-1750230054095-321542983.avif',
              collection_year: '2022',
              original_price: '12000'
            },
            client_name: 'Jane Smith',
            client_email: 'jane@example.com',
            resale_config: null,
            current_valuation: {
              amount: 14000,
              currency: 'EUR',
              date: '2024-01-12'
            }
          },
          {
            id: '3',
            passport_id: 'PASSPORT-003',
            nfc_uid: 'NFC-GHI456789123',
            status: 'READY_FOR_RESALE',
            assigned_client_id: 'CLIENT-003',
            metadata: {
              brand: 'Louis Vuitton',
              object_name: 'Neverfull MM',
              product_image: '/uploads/passports/product-1750232407167-817294797.avif',
              collection_year: '2021',
              original_price: '1800'
            },
            client_name: 'Mike Johnson',
            client_email: 'mike@example.com',
            resale_config: {
              resale_type: 'auction',
              royalties_enabled: true,
              cashback_enabled: true,
              brand_participation: false,
              qr_access_generated: false,
              configured_at: '2024-01-14T15:45:00Z'
            },
            current_valuation: {
              amount: 2200,
              currency: 'EUR',
              date: '2024-01-13'
            }
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter products based on search and status
  useEffect(() => {
    let filtered = products;
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(product => 
        product.passport_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.metadata?.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.metadata?.object_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply status filter
    if (filterStatus === 'configured') {
      filtered = filtered.filter(product => product.resale_config !== null);
    } else if (filterStatus === 'unconfigured') {
      filtered = filtered.filter(product => product.resale_config === null);
    }
    
    setFilteredProducts(filtered);
  }, [products, searchQuery, filterStatus]);

  // Load products on component mount
  useEffect(() => {
    loadReadyToResaleProducts();
  }, []);

  // Handle product selection for configuration
  const handleConfigureProduct = (product: ReadyToResaleProduct) => {
    setSelectedProduct(product);
    
    // Initialize default royalty/cashback tiers based on ownership depth
    const buyerLevels = product.buyer_levels || ['FB'];
    const defaultRoyaltyTiers: { [key: string]: number } = {};
    const defaultCashbackTiers: { [key: string]: number } = {};
    
    // Set default percentages for each buyer level
    buyerLevels.forEach((level, index) => {
      defaultRoyaltyTiers[level] = Math.max(5 - index, 1); // 5%, 4%, 3%, etc., minimum 1%
      defaultCashbackTiers[level] = Math.max(2 - index * 0.5, 0.5); // 2%, 1.5%, 1%, etc., minimum 0.5%
    });
    
    if (product.resale_config) {
      setConfig({
        resale_type: product.resale_config.resale_type,
        royalties_enabled: product.resale_config.royalties_enabled,
        cashback_enabled: product.resale_config.cashback_enabled,
        brand_participation: product.resale_config.brand_participation,
        brand_revenue_share: product.resale_config.brand_revenue_share || 5,
        qr_access_enabled: product.resale_config.qr_access_generated,
        qr_access_expiry_hours: 24,
        royalty_tiers: product.resale_config.royalty_tiers || defaultRoyaltyTiers,
        cashback_tiers: product.resale_config.cashback_tiers || defaultCashbackTiers
      });
    } else {
      setConfig({
        resale_type: 'private',
        royalties_enabled: true,
        cashback_enabled: false,
        brand_participation: false,
        brand_revenue_share: 5,
        qr_access_enabled: false,
        qr_access_expiry_hours: 24,
        royalty_tiers: defaultRoyaltyTiers,
        cashback_tiers: defaultCashbackTiers
      });
    }
    setShowConfigPanel(true);
  };

  // Save configuration
  const saveConfiguration = async () => {
    if (!selectedProduct) return;
    
    setConfiguring(true);
    try {
      const response = await fetch(`http://localhost:4000/api/sprint3/resale-console/configure/${selectedProduct.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          configured_by: 'admin',
          configured_at: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Configuration saved successfully:', data);
        
        // Update the product in the list
        setProducts(prev => prev.map(p => 
          p.id === selectedProduct.id 
            ? { ...p, resale_config: { ...config, configured_at: new Date().toISOString() } }
            : p
        ));
        setShowConfigPanel(false);
        setSelectedProduct(null);
        
        // Reload products to get fresh data
        loadReadyToResaleProducts();
      } else {
        const errorData = await response.json();
        console.error('Configuration save failed:', errorData);
        alert(`Failed to save configuration: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
      alert(`Error saving configuration: ${error.message}`);
    } finally {
      setConfiguring(false);
    }
  };

  // Generate QR access
  const generateQRAccess = async () => {
    if (!selectedProduct) return;
    
    try {
      const response = await fetch(`http://localhost:4000/api/sprint3/resale-console/qr-access/${selectedProduct.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiry_hours: config.qr_access_expiry_hours,
          include_metadata: true
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setQrCodeData(data.qr_url);
        setQrCodeExpiry(data.expires_at);
        
        // Update the product configuration
        setConfig(prev => ({ ...prev, qr_access_enabled: true }));
      }
    } catch (error) {
      console.error('Failed to generate QR access:', error);
    }
  };

  // Copy QR URL to clipboard
  const copyQRUrl = () => {
    if (qrCodeData) {
      navigator.clipboard.writeText(qrCodeData);
    }
  };

  // Get status badge style
  const getStatusBadge = (product: ReadyToResaleProduct) => {
    if (product.resale_config) {
      return {
        background: '#ecfdf5',
        color: '#065f46',
        border: '1px solid #d1fae5'
      };
    } else {
      return {
        background: '#fffbeb',
        color: '#92400e',
        border: '1px solid #fde68a'
      };
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ margin: "32px 0" }}>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 300,
            marginBottom: "8px",
            letterSpacing: "-0.02em",
            color: "#1a1a1a",
          }}
        >
          Resale Configuration
        </h1>
        <p style={{ color: "#666", fontSize: "16px", lineHeight: "1.5" }}>
          Configure resale options for ready-to-resale products. Set up royalties, cashback, brand participation, and generate preview access.
        </p>
      </div>

      {/* Search and Filter Bar */}
      <div style={card}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={16} style={{ 
              position: "absolute", 
              left: "12px", 
              top: "50%", 
              transform: "translateY(-50%)", 
              color: "#666" 
            }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by passport ID, brand, product name, or owner..."
              style={{
                ...input,
                paddingLeft: "40px"
              }}
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            style={select}
          >
            <option value="all">All Products</option>
            <option value="configured">Configured</option>
            <option value="unconfigured">Unconfigured</option>
          </select>
          
          <button
            onClick={loadReadyToResaleProducts}
            disabled={loading}
            style={{ ...btnSecondary, padding: "12px 16px" }}
          >
            <RefreshCw size={16} style={{ 
              animation: loading ? "spin 1s linear infinite" : "none" 
            }} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div style={gridThree}>
          <div style={{
            padding: "16px",
            background: "#f8f9fa",
            borderRadius: "8px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "24px", fontWeight: "600", color: "#1a1a1a" }}>
              {products.length}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>Total Ready</div>
          </div>
          <div style={{
            padding: "16px",
            background: "#f8f9fa",
            borderRadius: "8px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "24px", fontWeight: "600", color: "#16a34a" }}>
              {products.filter(p => p.resale_config).length}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>Configured</div>
          </div>
          <div style={{
            padding: "16px",
            background: "#f8f9fa",
            borderRadius: "8px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "24px", fontWeight: "600", color: "#f59e0b" }}>
              {products.filter(p => !p.resale_config).length}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>Pending</div>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div style={card}>
        <h2 style={sectionTitle}>
          <Package size={20} /> Ready to Resale Products
        </h2>
        
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              border: "2px solid #e9ecef",
              borderTopColor: "#343a40",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px"
            }} />
            <p style={{ color: "#6c757d" }}>Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <Package size={48} color="#ccc" style={{ marginBottom: "16px" }} />
            <p style={{ color: "#666", margin: "0 0 8px 0" }}>No products found</p>
            <p style={{ fontSize: "14px", color: "#999" }}>
              {searchQuery ? 'Try adjusting your search criteria' : 'No ready-to-resale products available'}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filteredProducts.map((product) => {
              const metadata = typeof product.metadata === 'string' 
                ? JSON.parse(product.metadata) 
                : product.metadata || {};
              
              const productImage = metadata.product_image;
              const fullImageUrl = productImage && !productImage.startsWith('http') 
                ? `http://localhost:4000${productImage}`
                : productImage;
              
              return (
                <div
                  key={product.id}
                  style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: "12px",
                    padding: "20px",
                    background: "white",
                    display: "flex",
                    gap: "20px",
                    alignItems: "flex-start"
                  }}
                >
                  {/* Product Image */}
                  <div style={{
                    width: "100px",
                    height: "100px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    background: fullImageUrl 
                      ? `url(${fullImageUrl}) center/cover`
                      : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    color: "#999"
                  }}>
                    {!fullImageUrl && "🏆"}
                  </div>
                  
                  {/* Product Details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div>
                        <h3 style={{ 
                          fontSize: "18px", 
                          fontWeight: "600", 
                          margin: "0 0 4px 0",
                          color: "#1a1a1a"
                        }}>
                          {metadata.brand} {metadata.object_name}
                        </h3>
                        <p style={{ 
                          fontSize: "14px", 
                          color: "#666", 
                          margin: "0 0 8px 0" 
                        }}>
                          Passport #{product.passport_id} • {metadata.collection_year}
                        </p>
                      </div>
                      
                      <div style={{
                        padding: "4px 12px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "500",
                        ...getStatusBadge(product)
                      }}>
                        {product.resale_config ? 'Configured' : 'Pending'}
                      </div>
                    </div>
                    
                    <div style={gridThree}>
                      <div>
                        <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Owner</p>
                        <p style={{ fontWeight: "500", margin: 0 }}>{product.client_name}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Current Valuation</p>
                        <p style={{ fontWeight: "500", margin: 0 }}>
                          {product.current_valuation?.currency} {product.current_valuation?.amount?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Resale Type</p>
                        <p style={{ fontWeight: "500", margin: 0 }}>
                          {product.resale_config?.resale_type ? 
                            product.resale_config.resale_type.charAt(0).toUpperCase() + product.resale_config.resale_type.slice(1) : 
                            'Not set'
                          }
                        </p>
                      </div>
                    </div>
                    
                    {/* Configuration Summary */}
                    {product.resale_config && (
                      <div style={{
                        marginTop: "12px",
                        padding: "12px",
                        background: "#f8f9fa",
                        borderRadius: "8px",
                        display: "flex",
                        gap: "16px",
                        alignItems: "center"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Crown size={14} color="#16a34a" />
                          <span style={{ fontSize: "12px", color: "#666" }}>
                            Royalties: {product.resale_config.royalties_enabled ? 'On' : 'Off'}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Gift size={14} color="#f59e0b" />
                          <span style={{ fontSize: "12px", color: "#666" }}>
                            Cashback: {product.resale_config.cashback_enabled ? 'On' : 'Off'}
                          </span>
                        </div>
                        {product.resale_config.brand_participation && (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Percent size={14} color="#1e40af" />
                            <span style={{ fontSize: "12px", color: "#666" }}>
                              Brand Share: {product.resale_config.brand_revenue_share}%
                            </span>
                          </div>
                        )}
                        {product.resale_config.qr_access_generated && (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <QrCode size={14} color="#7c3aed" />
                            <span style={{ fontSize: "12px", color: "#666" }}>
                              QR Access: Active
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <button
                      onClick={() => handleConfigureProduct(product)}
                      style={{ ...btnPrimary, padding: "8px 16px", fontSize: "13px" }}
                    >
                      <Settings size={14} />
                      {product.resale_config ? 'Edit Config' : 'Configure'}
                    </button>
                    
                    {product.resale_config?.qr_access_generated && (
                      <button
                        onClick={() => {
                          setQrCodeData(product.resale_config!.qr_access_url!);
                          setQrCodeExpiry(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
                        }}
                        style={{ ...btnSecondary, padding: "8px 16px", fontSize: "13px" }}
                      >
                        <QrCode size={14} />
                        View QR
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Configuration Panel */}
      {showConfigPanel && selectedProduct && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "800px",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto"
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>
                Configure Resale Options
              </h2>
              <button
                onClick={() => setShowConfigPanel(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "8px",
                  color: "#666"
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Product Info */}
            <div style={{
              padding: "16px",
              background: "#f8f9fa",
              borderRadius: "8px",
              marginBottom: "24px"
            }}>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                {(() => {
                  const metadata = typeof selectedProduct.metadata === 'string' 
                    ? JSON.parse(selectedProduct.metadata) 
                    : selectedProduct.metadata || {};
                  const productImage = metadata.product_image;
                  const fullImageUrl = productImage && !productImage.startsWith('http') 
                    ? `http://localhost:4000${productImage}`
                    : productImage;
                  
                  return (
                    <div style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "8px",
                      overflow: "hidden",
                      background: fullImageUrl 
                        ? `url(${fullImageUrl}) center/cover`
                        : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      color: "#999"
                    }}>
                      {!fullImageUrl && "🏆"}
                    </div>
                  );
                })()}
                
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "600", margin: "0 0 4px 0" }}>
                    {selectedProduct.metadata?.brand} {selectedProduct.metadata?.object_name}
                  </h3>
                  <p style={{ fontSize: "14px", color: "#666", margin: "0 0 4px 0" }}>
                    Passport #{selectedProduct.passport_id}
                  </p>
                  <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
                    Owner: {selectedProduct.client_name}
                  </p>
                </div>
              </div>
            </div>

            {/* Configuration Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Resale Type */}
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>
                  Resale Options
                </h3>
                <div style={gridThree}>
                  {[
                    { value: 'private', label: 'Private Sale', icon: Users, desc: 'Direct buyer-seller transaction' },
                    { value: 'auction', label: 'Auction', icon: Zap, desc: 'Competitive bidding process' },
                    { value: 'delegated', label: 'Delegated', icon: Shield, desc: 'Platform-managed sale' }
                  ].map(({ value, label, icon: Icon, desc }) => (
                    <label
                      key={value}
                      style={{
                        border: `2px solid ${config.resale_type === value ? '#000' : '#e0e0e0'}`,
                        borderRadius: "8px",
                        padding: "16px",
                        cursor: "pointer",
                        background: config.resale_type === value ? '#f8f9fa' : 'white',
                        transition: "all 0.2s"
                      }}
                    >
                      <input
                        type="radio"
                        name="resale_type"
                        value={value}
                        checked={config.resale_type === value}
                        onChange={(e) => setConfig({...config, resale_type: e.target.value as any})}
                        style={{ display: "none" }}
                      />
                      <div style={{ textAlign: "center" }}>
                        <Icon size={24} color={config.resale_type === value ? '#000' : '#666'} style={{ marginBottom: "8px" }} />
                        <div style={{ fontWeight: "500", marginBottom: "4px" }}>{label}</div>
                        <div style={{ fontSize: "12px", color: "#666" }}>{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

                             {/* Revenue Options */}
               <div>
                 <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>
                   Revenue Options
                 </h3>
                 
                 {/* Ownership Information */}
                 <div style={{
                   padding: "12px",
                   background: "#f8f9fa",
                   borderRadius: "8px",
                   marginBottom: "16px",
                   border: "1px solid #e0e0e0"
                 }}>
                   <div style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>
                     Ownership History: {selectedProduct?.ownership_depth || 1} owner(s)
                   </div>
                   <div style={{ fontSize: "12px", color: "#666" }}>
                     This product is going to: <strong>{selectedProduct?.buyer_levels?.[selectedProduct.buyer_levels.length - 1] || 'FB'}</strong> 
                     {selectedProduct?.buyer_levels?.length === 1 ? ' (First Buyer)' : 
                      selectedProduct?.buyer_levels?.length === 2 ? ' (Second Buyer)' : 
                      selectedProduct?.buyer_levels?.length === 3 ? ' (Third Buyer)' : 
                      ` (${selectedProduct?.buyer_levels?.length}th Buyer)`}
                   </div>
                 </div>
                 
                 {/* Royalties Section */}
                 <div style={{ marginBottom: "20px" }}>
                   <label style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "12px",
                     padding: "12px",
                     border: "1px solid #e0e0e0",
                     borderRadius: "8px",
                     cursor: "pointer",
                     marginBottom: "12px"
                   }}>
                     <input
                       type="checkbox"
                       checked={config.royalties_enabled}
                       onChange={(e) => setConfig({...config, royalties_enabled: e.target.checked})}
                       style={{ width: "16px", height: "16px" }}
                     />
                     <Crown size={16} color="#16a34a" />
                     <div>
                       <div style={{ fontWeight: "500" }}>Enable Royalties</div>
                       <div style={{ fontSize: "12px", color: "#666" }}>Share revenue with previous owners</div>
                     </div>
                   </label>
                   
                   {config.royalties_enabled && selectedProduct?.buyer_levels && (
                     <div style={{
                       border: "1px solid #e0e0e0",
                       borderRadius: "8px",
                       padding: "16px",
                       background: "#f8f9fa"
                     }}>
                       <div style={{ fontSize: "14px", fontWeight: "500", marginBottom: "12px" }}>
                         Royalty Distribution by Buyer Level
                       </div>
                       <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                         {selectedProduct.buyer_levels.map((level, index) => (
                           <div key={level}>
                             <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>
                               {level} {index === 0 ? '(First Buyer)' : index === 1 ? '(Second Buyer)' : index === 2 ? '(Third Buyer)' : `(${index + 1}th Buyer)`}
                             </label>
                             <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                               <input
                                 type="number"
                                 value={config.royalty_tiers[level] || 0}
                                 onChange={(e) => setConfig({
                                   ...config,
                                   royalty_tiers: {
                                     ...config.royalty_tiers,
                                     [level]: parseFloat(e.target.value) || 0
                                   }
                                 })}
                                 min="0"
                                 max="20"
                                 step="0.1"
                                 style={{
                                   ...input,
                                   width: "80px",
                                   fontSize: "12px",
                                   padding: "6px 8px"
                                 }}
                               />
                               <span style={{ fontSize: "12px", color: "#666" }}>%</span>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
                 
                 {/* Cashback Section */}
                 <div>
                   <label style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "12px",
                     padding: "12px",
                     border: "1px solid #e0e0e0",
                     borderRadius: "8px",
                     cursor: "pointer",
                     marginBottom: "12px"
                   }}>
                     <input
                       type="checkbox"
                       checked={config.cashback_enabled}
                       onChange={(e) => setConfig({...config, cashback_enabled: e.target.checked})}
                       style={{ width: "16px", height: "16px" }}
                     />
                     <Gift size={16} color="#f59e0b" />
                     <div>
                       <div style={{ fontWeight: "500" }}>Enable Cashback</div>
                       <div style={{ fontSize: "12px", color: "#666" }}>Reward buyers with cashback</div>
                     </div>
                   </label>
                   
                   {config.cashback_enabled && selectedProduct?.buyer_levels && (
                     <div style={{
                       border: "1px solid #e0e0e0",
                       borderRadius: "8px",
                       padding: "16px",
                       background: "#f8f9fa"
                     }}>
                       <div style={{ fontSize: "14px", fontWeight: "500", marginBottom: "12px" }}>
                         Cashback Rewards by Buyer Level
                       </div>
                       <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                         {selectedProduct.buyer_levels.map((level, index) => (
                           <div key={level}>
                             <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>
                               {level} {index === 0 ? '(First Buyer)' : index === 1 ? '(Second Buyer)' : index === 2 ? '(Third Buyer)' : `(${index + 1}th Buyer)`}
                             </label>
                             <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                               <input
                                 type="number"
                                 value={config.cashback_tiers[level] || 0}
                                 onChange={(e) => setConfig({
                                   ...config,
                                   cashback_tiers: {
                                     ...config.cashback_tiers,
                                     [level]: parseFloat(e.target.value) || 0
                                   }
                                 })}
                                 min="0"
                                 max="10"
                                 step="0.1"
                                 style={{
                                   ...input,
                                   width: "80px",
                                   fontSize: "12px",
                                   padding: "6px 8px"
                                 }}
                               />
                               <span style={{ fontSize: "12px", color: "#666" }}>%</span>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
               </div>

              {/* Brand Participation */}
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>
                  Brand Participation
                </h3>
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  cursor: "pointer",
                  marginBottom: "12px"
                }}>
                  <input
                    type="checkbox"
                    checked={config.brand_participation}
                    onChange={(e) => setConfig({...config, brand_participation: e.target.checked})}
                    style={{ width: "16px", height: "16px" }}
                  />
                  <Percent size={16} color="#1e40af" />
                  <div>
                    <div style={{ fontWeight: "500" }}>Enable Brand Revenue Share</div>
                    <div style={{ fontSize: "12px", color: "#666" }}>Allow brand to participate in revenue</div>
                  </div>
                </label>
                
                {config.brand_participation && (
                  <div>
                    <label style={label}>Brand Revenue Share Percentage</label>
                    <input
                      type="number"
                      value={config.brand_revenue_share}
                      onChange={(e) => setConfig({...config, brand_revenue_share: parseInt(e.target.value)})}
                      min="1"
                      max="20"
                      style={input}
                    />
                    <p style={{ fontSize: "12px", color: "#666", margin: "8px 0 0 0" }}>
                      Percentage of resale revenue that goes to the brand (1-20%)
                    </p>
                  </div>
                )}
              </div>

              {/* QR Access */}
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>
                  Preview Access
                </h3>
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  cursor: "pointer",
                  marginBottom: "12px"
                }}>
                  <input
                    type="checkbox"
                    checked={config.qr_access_enabled}
                    onChange={(e) => setConfig({...config, qr_access_enabled: e.target.checked})}
                    style={{ width: "16px", height: "16px" }}
                  />
                  <QrCode size={16} color="#7c3aed" />
                  <div>
                    <div style={{ fontWeight: "500" }}>Generate QR Access</div>
                    <div style={{ fontSize: "12px", color: "#666" }}>Create temporary QR code for buyer preview</div>
                  </div>
                </label>
                
                {config.qr_access_enabled && (
                  <div>
                    <label style={label}>QR Access Expiry (hours)</label>
                    <input
                      type="number"
                      value={config.qr_access_expiry_hours}
                      onChange={(e) => setConfig({...config, qr_access_expiry_hours: parseInt(e.target.value)})}
                      min="1"
                      max="168"
                      style={input}
                    />
                    <p style={{ fontSize: "12px", color: "#666", margin: "8px 0 0 0" }}>
                      How long the QR access remains valid (1-168 hours)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
              <button
                onClick={saveConfiguration}
                disabled={configuring}
                style={{ ...btnPrimary, flex: 1 }}
              >
                {configuring ? (
                  <div style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #fff",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }} />
                ) : (
                  <>
                    <Settings size={16} />
                    Save Configuration
                  </>
                )}
              </button>
              
              {config.qr_access_enabled && (
                <button
                  onClick={generateQRAccess}
                  style={{ ...btnSuccess }}
                >
                  <QrCode size={16} />
                  Generate QR
                </button>
              )}
              
              <button
                onClick={() => setShowConfigPanel(false)}
                style={{ ...btnSecondary }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrCodeData && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1001,
          padding: "20px"
        }}>
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "400px",
            width: "100%",
            textAlign: "center"
          }}>
            <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>
              QR Access Generated
            </h3>
            
            <div style={{
              width: "200px",
              height: "200px",
              background: "#f8f9fa",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <QrCode size={80} color="#666" />
            </div>
            
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "16px" }}>
              Expires: {new Date(qrCodeExpiry).toLocaleString()}
            </p>
            
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                onClick={copyQRUrl}
                style={{ ...btnSecondary, padding: "8px 16px" }}
              >
                <Copy size={14} />
                Copy URL
              </button>
              <button
                onClick={() => setQrCodeData('')}
                style={{ ...btnPrimary, padding: "8px 16px" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ResaleConfigurePage;
