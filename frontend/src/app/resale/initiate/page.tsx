"use client";

import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, CheckCircle, DollarSign, Package, User, TrendingUp, ExternalLink, ArrowRight, Info, Shield, Clock, Target } from 'lucide-react';

// Type definitions
interface Passport {
  id: string;
  nfc_uid: string;
  status: string;
  assigned_client_id: string | null;
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
  client_city?: string;
  client_country?: string;
}

interface Valuation {
  id: string;
  currency: string;
  valuation_amount: number;
  valuation_date: string;
  appraiser_name: string;
  confidence_level: string;
}

interface NewValuation {
  amount: string;
  currency: string;
  appraiser_name: string;
  confidence_level: string;
}

const ResaleInitiatePage = () => {
  // State management
  const [passportSearch, setPassportSearch] = useState('');
  const [searchType, setSearchType] = useState<'passport' | 'client' | 'product'>('passport');
  const [searchResults, setSearchResults] = useState<Passport[]>([]);
  const [selectedPassport, setSelectedPassport] = useState<Passport | null>(null);
  const [selectedPassportIds, setSelectedPassportIds] = useState<string[]>([]);
  const [ownershipValid, setOwnershipValid] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  const [currentValuation, setCurrentValuation] = useState<Valuation | null>(null);
  const [valuationMode, setValuationMode] = useState<'view' | 'request' | 'input'>('view');
  const [newValuation, setNewValuation] = useState<NewValuation>({
    amount: '',
    currency: 'EUR',
    appraiser_name: '',
    confidence_level: 'medium'
  });
  
  const [marketplace, setMarketplace] = useState('');
  const [externalRef, setExternalRef] = useState('');
  
  const [askingPrice, setAskingPrice] = useState('');
  const [minimumPrice, setMinimumPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

  // Mock marketplace options - replace with API call
  const marketplaces = [
    { id: 'farfetch', name: 'Farfetch', echo_enabled: true, logo: '🛍️' },
    { id: 'thefloorr', name: 'The Floorr', echo_enabled: true, logo: '🏢' },
    { id: 'vestiaire', name: 'Vestiaire Collective', echo_enabled: false, logo: '👗' },
    { id: 'rebag', name: 'Rebag', echo_enabled: false, logo: '👜' },
    { id: 'stockx', name: 'StockX', echo_enabled: true, logo: '📈' }
  ];

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

  // Search for passport
  const searchPassport = async () => {
    if (!passportSearch.trim()) return;
    
    setLoading(true);
    setValidationError('');
    setSearchResults([]);
    setSelectedPassport(null);
    setSelectedPassportIds([]);
    setOwnershipValid(false);
    
    try {
      const response = await fetch(`/api/sprint3/passport/search?q=${encodeURIComponent(passportSearch)}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Passport not found');
      }
      
      const data = await response.json();
      
      if (data.passports && Array.isArray(data.passports)) {
        setSearchResults(data.passports);
        console.log(`Found ${data.passports.length} passports for ${passportSearch.trim()}`);
      } else {
        // Handle single result for backward compatibility
        setSearchResults([data]);
      }
      
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to search passport');
    } finally {
      setLoading(false);
    }
  };

  // Handle passport selection
  const handlePassportSelection = (passportId: string, checked: boolean) => {
    if (checked) {
      setSelectedPassportIds(prev => [...prev, passportId]);
    } else {
      setSelectedPassportIds(prev => prev.filter(id => id !== passportId));
    }
  };

  // Validate selected passports
  const validateSelectedPassports = () => {
    if (selectedPassportIds.length === 0) {
      setValidationError('Please select at least one passport for resale');
      return;
    }
    
    const selectedPassports = searchResults.filter(p => selectedPassportIds.includes(p.id));
    const validPassports = selectedPassports.filter(p => 
      p.status === 'MINTED' || p.status === 'ASSIGNED'
    );
    
    if (validPassports.length === 0) {
      setValidationError('None of the selected passports are in a valid state for resale');
      return;
    }
    
    if (validPassports.length !== selectedPassports.length) {
      setValidationError(`Some selected passports are not valid for resale. ${validPassports.length}/${selectedPassports.length} are ready.`);
    }
    
    setSelectedPassport(validPassports[0]); // Use first valid passport for now
    setOwnershipValid(true);
    setValidationError('');
    
    // Fetch current valuation
    if (validPassports[0].id) {
      fetchValuation(validPassports[0].id);
    }
  };

  // Validate passport ownership and status
  const validatePassport = (passport: Passport) => {
    setOwnershipValid(false);
    setValidationError('');
    
    // Check if passport has an owner
    if (!passport.assigned_client_id) {
      setValidationError('This item has no assigned owner');
      return;
    }
    
    // Check status
    if (passport.status === 'FROZEN') {
      setValidationError('This item is frozen and cannot be resold');
      return;
    }
    
    if (passport.status === 'UNDER_DISPUTE') {
      setValidationError('This item is under dispute and cannot be resold');
      return;
    }
    
    // Allow MINTED and ASSIGNED statuses for resale
    // Allow MINTED and ASSIGNED statuses for resale
    if (passport.status !== 'ASSIGNED' && passport.status !== 'MINTED') {
      setValidationError(`This item has status "${passport.status}" and is not in a valid state for resale. Only MINTED or ASSIGNED items can be resold.`);
      return;
    }
    
    setOwnershipValid(true);
  };

  // Fetch current valuation
  const fetchValuation = async (passportId: string) => {
    try {
      const response = await fetch(`/api/sprint3/product-valuation/${passportId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentValuation(data);
      }
    } catch (error) {
      console.error('Failed to fetch valuation:', error);
    }
  };

  // Request new valuation
  const requestValuation = async () => {
    if (!selectedPassport?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/sprint3/valuation/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passport_id: selectedPassport.id,
          requested_by: 'admin',
          priority: 'normal'
        })
      });
      
      if (response.ok) {
        setValuationMode('view');
        setSubmitStatus('Valuation request created successfully');
        setTimeout(() => setSubmitStatus(''), 3000);
      }
    } catch (error) {
      setValidationError('Failed to request valuation');
    } finally {
      setLoading(false);
    }
  };

  // Input new appraisal
  const saveAppraisal = async () => {
    if (!selectedPassport?.id || !newValuation.amount) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/sprint3/valuation/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passport_id: selectedPassport.id,
          valuation_amount: parseFloat(newValuation.amount),
          currency: newValuation.currency,
          appraiser_name: newValuation.appraiser_name || 'Admin',
          confidence_level: newValuation.confidence_level,
          valuation_type: 'appraisal'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentValuation(data);
        setValuationMode('view');
        setSubmitStatus('Appraisal saved successfully');
        setTimeout(() => setSubmitStatus(''), 3000);
      }
    } catch (error) {
      setValidationError('Failed to save appraisal');
    } finally {
      setLoading(false);
    }
  };

  // Submit resale initiation
  const initiateResale = async () => {
    if (!ownershipValid || !selectedPassport || !askingPrice || !marketplace) {
      setValidationError('Please complete all required fields');
      return;
    }
    
    if (parseFloat(minimumPrice) > parseFloat(askingPrice)) {
      setValidationError('Minimum price cannot exceed asking price');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/sprint3/resale-console/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passport_id: selectedPassport.id,
          seller_id: selectedPassport.assigned_client_id,
          asking_price: parseFloat(askingPrice),
          minimum_price: parseFloat(minimumPrice) || parseFloat(askingPrice),
          currency: currency,
          marketplace_id: marketplace,
          external_listing_ref: externalRef || null,
          current_valuation_id: currentValuation?.id || null,
          metadata: {
            product_hash: selectedPassport.metadata?.hash,
            client_hash: selectedPassport.assigned_client_id,
            initiated_at: new Date().toISOString()
          }
        })
      });
      
      if (!response.ok) throw new Error('Failed to initiate resale');
      
      const data = await response.json();
      setSubmitStatus(`Resale initiated successfully. ID: ${data.resale_id}`);
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setSelectedPassport(null);
        setPassportSearch('');
        setAskingPrice('');
        setMinimumPrice('');
        setMarketplace('');
        setExternalRef('');
        setSubmitStatus('');
      }, 3000);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to initiate resale');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
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
          Initiate Resale
        </h1>
        <p style={{ color: "#666", fontSize: "16px", lineHeight: "1.5" }}>
          Transform your luxury items into resale opportunities. Follow the steps below to list your authenticated products.
        </p>
      </div>

      {/* Progress Indicator */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "8px", 
        marginBottom: "32px",
        padding: "16px",
        background: "#f8f9fa",
        borderRadius: "12px",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "8px",
          color: selectedPassport ? "#16a34a" : "#666"
        }}>
          <div style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: selectedPassport ? "#16a34a" : "#e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "12px",
            fontWeight: "600"
          }}>
            {selectedPassport ? "✓" : "1"}
          </div>
          <span style={{ fontWeight: "500" }}>Select Item</span>
        </div>
        
        <ArrowRight size={16} color="#ccc" />
        
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "8px",
          color: ownershipValid ? "#16a34a" : "#666"
        }}>
          <div style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: ownershipValid ? "#16a34a" : "#e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "12px",
            fontWeight: "600"
          }}>
            {ownershipValid ? "✓" : "2"}
          </div>
          <span style={{ fontWeight: "500" }}>Verify Ownership</span>
        </div>
        
        <ArrowRight size={16} color="#ccc" />
        
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "8px",
          color: askingPrice && marketplace ? "#16a34a" : "#666"
        }}>
          <div style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: askingPrice && marketplace ? "#16a34a" : "#e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "12px",
            fontWeight: "600"
          }}>
            {askingPrice && marketplace ? "✓" : "3"}
          </div>
          <span style={{ fontWeight: "500" }}>Set Price</span>
        </div>
      </div>

      {/* Step 1: Select Owned Item */}
      <div style={card}>
        <h2 style={sectionTitle}>
          <Package size={20} /> Step 1: Select Owned Item
        </h2>
        
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {[
              { key: 'passport', label: 'Passport ID/NFC', icon: Package },
              { key: 'client', label: 'Client Info', icon: User },
              { key: 'product', label: 'Product Details', icon: TrendingUp }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSearchType(key as any)}
                style={{
                  ...btnSecondary,
                  background: searchType === key ? "#f0f0f0" : "transparent",
                  borderColor: searchType === key ? "#000" : "#e0e0e0",
                  padding: "8px 16px",
                  fontSize: "13px"
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
          
          <div style={{ fontSize: "13px", color: "#666", marginBottom: "16px" }}>
            {searchType === 'passport' && 'Search by Passport ID, NFC UID, or Metadata Hash'}
            {searchType === 'client' && 'Search by client name, email, phone, city, or country'}
            {searchType === 'product' && 'Search by brand, model, collection year, or product metadata'}
          </div>
          
          <div style={{ fontSize: "12px", color: "#999", marginBottom: "16px" }}>
            <strong>Examples:</strong> {
              searchType === 'passport' ? '12345, NFC-ABC123, or hash...' :
              searchType === 'client' ? 'John Doe, john@email.com, or London...' :
              'Hermès, Birkin, 2023, or luxury...'
            }
          </div>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", marginBottom: "16px" }}>
          <input
            type="text"
            value={passportSearch}
            onChange={(e) => setPassportSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchPassport()}
            placeholder={
              searchType === 'passport' ? 'Enter Passport ID, NFC UID, or Hash' :
              searchType === 'client' ? 'Enter client name, email, or location' :
              'Enter brand, model, or product details'
            }
            style={input}
          />
          <button
            onClick={searchPassport}
            disabled={loading}
            style={{ ...btnPrimary, width: "120px" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#000")}
          >
            {loading ? (
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
                <Search size={16} />
                Search
              </>
            )}
          </button>
        </div>
        
        {/* Search Results */}
        {searchResults.length > 0 && (
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "12px",
              padding: "20px",
              background: "#f8f9fa",
              marginTop: "16px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white"
              }}>
                <Package size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 4px 0" }}>
                  Found {searchResults.length} Product{searchResults.length > 1 ? 's' : ''}
                </h3>
                <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
                  Select the product(s) you want to resell
                </p>
              </div>
            </div>
            
            {/* Product List with Checkboxes */}
            <div style={{ marginBottom: "16px" }}>
              {searchResults.map((passport) => {
                // Parse metadata to get product details
                const metadata = typeof passport.metadata === 'string' 
                  ? JSON.parse(passport.metadata) 
                  : passport.metadata || {};
                
                const brand = metadata.brand || 'Unknown Brand';
                const productName = metadata.object_name || 'Unknown Product';
                const productImage = metadata.product_image;
                const fullImageUrl = productImage && !productImage.startsWith('http') 
                  ? `http://localhost:4000${productImage}`
                  : productImage;
                
                return (
                  <div
                    key={passport.id}
                    style={{
                      border: "1px solid #e0e0e0",
                      borderRadius: "12px",
                      padding: "20px",
                      marginBottom: "16px",
                      background: "white",
                      display: "flex",
                      gap: "20px",
                      alignItems: "flex-start"
                    }}
                  >
                    <input
                      type="checkbox"
                      id={`passport-${passport.id}`}
                      checked={selectedPassportIds.includes(passport.id)}
                      onChange={(e) => handlePassportSelection(passport.id, e.target.checked)}
                      style={{
                        width: "20px",
                        height: "20px",
                        accentColor: "#000",
                        marginTop: "4px"
                      }}
                    />
                    
                    {/* Product Image */}
                    <div style={{
                      width: "120px",
                      height: "120px",
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: fullImageUrl 
                        ? `url(${fullImageUrl}) center/cover`
                        : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "32px",
                      color: "#999"
                    }}>
                      {!fullImageUrl && "🏆"}
                    </div>
                    
                    {/* Product Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: "16px" }}>
                        <h4 style={{ 
                          fontSize: "18px", 
                          fontWeight: "600", 
                          margin: "0 0 8px 0",
                          color: "#1a1a1a"
                        }}>
                          {brand} {productName}
                        </h4>
                        <p style={{ 
                          fontSize: "14px", 
                          color: "#666", 
                          margin: "0 0 12px 0" 
                        }}>
                          Collection Year: {metadata.collection_year || 'N/A'}
                        </p>
                      </div>
                      
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "16px"
                      }}>
                        <div>
                          <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Passport ID</p>
                          <p style={{ fontWeight: "600", margin: 0, fontFamily: "monospace" }}>#{passport.id}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>NFC UID</p>
                          <p style={{ fontSize: "13px", color: "#666", margin: 0, fontFamily: "monospace" }}>
                            {passport.nfc_uid.slice(0, 12)}...
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Status</p>
                          <p
                            style={{
                              fontWeight: "600",
                              color: passport.status === "ASSIGNED" || passport.status === "MINTED" ? "#16a34a" : "#dc2626",
                              margin: 0
                            }}
                          >
                            {passport.status}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Owner</p>
                          <p style={{ fontWeight: "500", margin: 0 }}>
                            {passport.client_name || 'Unknown'}
                          </p>
                        </div>
                        {passport.client_email && (
                          <div>
                            <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Email</p>
                            <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>{passport.client_email}</p>
                          </div>
                        )}
                        {passport.client_city && (
                          <div>
                            <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Location</p>
                            <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>
                              {passport.client_city}, {passport.client_country}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Validation Button */}
            <button
              onClick={validateSelectedPassports}
              disabled={selectedPassportIds.length === 0}
              style={{
                ...btnPrimary,
                opacity: selectedPassportIds.length === 0 ? 0.5 : 1,
                cursor: selectedPassportIds.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Validate Selected Products
            </button>
          </div>
        )}
        
        {/* Selected Product Display */}
        {selectedPassport && (
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "12px",
              padding: "20px",
              background: "#f8f9fa",
              marginTop: "16px"
            }}
          >
            <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
              {/* Product Image */}
              {(() => {
                const metadata = typeof selectedPassport.metadata === 'string' 
                  ? JSON.parse(selectedPassport.metadata) 
                  : selectedPassport.metadata || {};
                const productImage = metadata.product_image;
                const fullImageUrl = productImage && !productImage.startsWith('http') 
                  ? `http://localhost:4000${productImage}`
                  : productImage;
                
                return (
                  <div style={{
                    width: "120px",
                    height: "120px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: fullImageUrl 
                      ? `url(${fullImageUrl}) center/cover`
                      : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "32px",
                    color: "#999"
                  }}>
                    {!fullImageUrl && "🏆"}
                  </div>
                );
              })()}
              
              {/* Product Info */}
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: "16px" }}>
                  {(() => {
                    const metadata = typeof selectedPassport.metadata === 'string' 
                      ? JSON.parse(selectedPassport.metadata) 
                      : selectedPassport.metadata || {};
                    const brand = metadata.brand || 'Unknown Brand';
                    const productName = metadata.object_name || 'Unknown Product';
                    
                    return (
                      <>
                        <h3 style={{ 
                          fontSize: "20px", 
                          fontWeight: "600", 
                          margin: "0 0 8px 0",
                          color: "#1a1a1a"
                        }}>
                          {brand} {productName}
                        </h3>
                        <p style={{ 
                          fontSize: "14px", 
                          color: "#666", 
                          margin: "0 0 12px 0" 
                        }}>
                          Passport #{selectedPassport.id} - NFC: {selectedPassport.nfc_uid}
                        </p>
                        {metadata.collection_year && (
                          <p style={{ 
                            fontSize: "14px", 
                            color: "#666", 
                            margin: "0" 
                          }}>
                            Collection Year: {metadata.collection_year}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
                
                <div style={gridTwo}>
                  <div>
                    <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Status</p>
                    <p
                      style={{
                        fontWeight: "600",
                        color: selectedPassport.status === "ASSIGNED" || selectedPassport.status === "MINTED" ? "#16a34a" : "#dc2626",
                        margin: 0
                      }}
                    >
                      {selectedPassport.status}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Owner ID</p>
                    <p style={{ fontWeight: "500", margin: 0 }}>
                      {selectedPassport.assigned_client_id || 'No owner'}
                    </p>
                  </div>
                  {selectedPassport.client_name && (
                    <div>
                      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Owner Name</p>
                      <p style={{ fontWeight: "500", margin: 0 }}>{selectedPassport.client_name}</p>
                    </div>
                  )}
                  {selectedPassport.client_email && (
                    <div>
                      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Owner Email</p>
                      <p style={{ fontWeight: "500", margin: 0 }}>{selectedPassport.client_email}</p>
                    </div>
                  )}
                  {selectedPassport.client_city && (
                    <div>
                      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Owner Location</p>
                      <p style={{ fontWeight: "500", margin: 0 }}>
                        {selectedPassport.client_city}, {selectedPassport.client_country}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {ownershipValid && (
              <div style={{ 
                marginTop: "16px", 
                padding: "12px 16px", 
                background: "#ecfdf5", 
                border: "1px solid #d1fae5", 
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <CheckCircle size={16} color="#16a34a" />
                <span style={{ color: "#065f46", fontSize: "14px", fontWeight: "500" }}>
                  Ownership verified - Ready for resale
                </span>
              </div>
            )}
          </div>
        )}
        
        {validationError && (
          <div style={{ marginTop: "16px" }}>
            <div style={banner("error")}>
              <AlertCircle size={16} />
              {validationError}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: View/Edit Appraisal */}
      {selectedPassport && ownershipValid && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <TrendingUp size={20} /> Step 2: Product Appraisal
          </h2>
          
          {valuationMode === 'view' && (
            <>
              {currentValuation ? (
                <div style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "12px",
                  padding: "20px",
                  background: "#f8f9fa",
                  marginBottom: "20px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                    <div style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "8px",
                      background: "#16a34a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white"
                    }}>
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 4px 0" }}>
                        Current Valuation
                      </h3>
                      <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
                        Last updated: {new Date(currentValuation.valuation_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div style={gridTwo}>
                    <div>
                      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Valuation Amount</p>
                      <p style={{ fontSize: "20px", fontWeight: "600", color: "#16a34a", margin: 0 }}>
                        {currentValuation.currency} {currentValuation.valuation_amount?.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Appraiser</p>
                      <p style={{ fontWeight: "500", margin: 0 }}>{currentValuation.appraiser_name}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px 0" }}>Confidence Level</p>
                      <p style={{ 
                        fontWeight: "500", 
                        margin: 0,
                        textTransform: "capitalize",
                        color: currentValuation.confidence_level === 'high' ? '#16a34a' : 
                               currentValuation.confidence_level === 'medium' ? '#f59e0b' : '#dc2626'
                      }}>
                        {currentValuation.confidence_level}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "12px",
                  padding: "20px",
                  background: "#f8f9fa",
                  marginBottom: "20px",
                  textAlign: "center"
                }}>
                  <Clock size={32} color="#999" style={{ marginBottom: "8px" }} />
                  <p style={{ color: "#666", margin: "0 0 8px 0" }}>No current valuation available</p>
                  <p style={{ fontSize: "12px", color: "#999", margin: 0 }}>
                    Request a professional valuation or input an appraisal
                  </p>
                </div>
              )}
              
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => setValuationMode('request')}
                  style={{ ...btnWarning, padding: "12px 20px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#d97706")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#f59e0b")}
                >
                  <Clock size={16} />
                  Request Valuation
                </button>
                <button
                  onClick={() => setValuationMode('input')}
                  style={{ ...btnSuccess, padding: "12px 20px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#15803d")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#16a34a")}
                >
                  <Target size={16} />
                  Input Appraisal
                </button>
              </div>
            </>
          )}
          
          {valuationMode === 'request' && (
            <div style={{ padding: "20px", background: "#f8f9fa", borderRadius: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <Clock size={20} color="#f59e0b" />
                <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>Request Professional Valuation</h3>
              </div>
              <p style={{ color: "#666", margin: "0 0 16px 0", lineHeight: "1.5" }}>
                This will create a valuation request for this item. Our appraisal team will be notified and will review your item within 2-3 business days.
              </p>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={requestValuation}
                  disabled={loading}
                  style={{ ...btnWarning, padding: "12px 20px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#d97706")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#f59e0b")}
                >
                  {loading ? (
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
                      <Clock size={16} />
                      Confirm Request
                    </>
                  )}
                </button>
                <button
                  onClick={() => setValuationMode('view')}
                  style={{ ...btnSecondary, padding: "12px 20px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {valuationMode === 'input' && (
            <div style={{ padding: "20px", background: "#f8f9fa", borderRadius: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <Target size={20} color="#16a34a" />
                <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>Input Manual Appraisal</h3>
              </div>
              <p style={{ color: "#666", margin: "0 0 16px 0", lineHeight: "1.5" }}>
                Enter appraisal details manually. This will be recorded as an official valuation in our system.
              </p>
              
              <div style={gridTwo}>
                <div>
                  <label style={label}>Valuation Amount *</label>
                  <input
                    type="number"
                    value={newValuation.amount}
                    onChange={(e) => setNewValuation({...newValuation, amount: e.target.value})}
                    style={input}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label style={label}>Currency</label>
                  <select
                    value={newValuation.currency}
                    onChange={(e) => setNewValuation({...newValuation, currency: e.target.value})}
                    style={select}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Appraiser Name</label>
                  <input
                    type="text"
                    value={newValuation.appraiser_name}
                    onChange={(e) => setNewValuation({...newValuation, appraiser_name: e.target.value})}
                    placeholder="Enter appraiser name"
                    style={input}
                  />
                </div>
                <div>
                  <label style={label}>Confidence Level</label>
                  <select
                    value={newValuation.confidence_level}
                    onChange={(e) => setNewValuation({...newValuation, confidence_level: e.target.value})}
                    style={select}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="certified">Certified</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button
                  onClick={saveAppraisal}
                  disabled={loading || !newValuation.amount}
                  style={{ 
                    ...btnSuccess, 
                    padding: "12px 20px",
                    opacity: loading || !newValuation.amount ? 0.5 : 1,
                    cursor: loading || !newValuation.amount ? "not-allowed" : "pointer"
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && newValuation.amount) {
                      e.currentTarget.style.background = "#15803d";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && newValuation.amount) {
                      e.currentTarget.style.background = "#16a34a";
                    }
                  }}
                >
                  {loading ? (
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
                      <Target size={16} />
                      Save Appraisal
                    </>
                  )}
                </button>
                <button
                  onClick={() => setValuationMode('view')}
                  style={{ ...btnSecondary, padding: "12px 20px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Choose Marketplace */}
      {selectedPassport && ownershipValid && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <ExternalLink size={20} /> Step 3: Choose Resale Platform
          </h2>
          
          <div style={{ marginBottom: "20px" }}>
            <label style={label}>Select Marketplace *</label>
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              style={select}
            >
              <option value="">-- Select Marketplace --</option>
              {marketplaces.map(mp => (
                <option key={mp.id} value={mp.id}>
                  {mp.logo} {mp.name} {mp.echo_enabled && '(ECHO enabled)'}
                </option>
              ))}
            </select>
            <p style={{ fontSize: "12px", color: "#666", margin: "8px 0 0 0" }}>
              ECHO-enabled marketplaces provide enhanced authentication and verification features.
            </p>
          </div>
          
          <div>
            <label style={label}>External Listing Reference (Optional)</label>
            <input
              type="text"
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              placeholder="e.g., FARFETCH-123456"
              style={input}
            />
            <p style={{ fontSize: "12px", color: "#666", margin: "8px 0 0 0" }}>
              Reference number from the external marketplace listing.
            </p>
          </div>
        </div>
      )}

      {/* Step 4: Set Pricing */}
      {selectedPassport && ownershipValid && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <DollarSign size={20} /> Step 4: Set Accepted Price
          </h2>
          
          <div style={gridThree}>
            <div>
              <label style={label}>Asking Price *</label>
              <input
                type="number"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="0.00"
                style={input}
              />
            </div>
            
            <div>
              <label style={label}>Minimum Acceptable</label>
              <input
                type="number"
                value={minimumPrice}
                onChange={(e) => setMinimumPrice(e.target.value)}
                placeholder="0.00"
                style={input}
              />
            </div>
            
            <div>
              <label style={label}>Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={select}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
          </div>
          
          {currentValuation && askingPrice && (
            <div style={{
              marginTop: "20px",
              padding: "16px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "8px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Info size={16} color="#1e40af" />
                <span style={{ fontSize: "14px", fontWeight: "500", color: "#1e40af" }}>
                  Price Analysis
                </span>
              </div>
              <p style={{ fontSize: "14px", color: "#1e40af", margin: 0, lineHeight: "1.4" }}>
                <strong>Valuation:</strong> {currentValuation.currency} {currentValuation.valuation_amount?.toLocaleString()} | 
                <strong> Asking:</strong> {currency} {parseFloat(askingPrice).toLocaleString()} 
                ({((parseFloat(askingPrice) / currentValuation.valuation_amount) * 100).toFixed(0)}% of valuation)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 5: Confirm Intent */}
      {selectedPassport && ownershipValid && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Shield size={20} /> Step 5: Confirm Intent to Transfer
          </h2>
          
          <div style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "20px"
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <AlertCircle size={20} color="#92400e" style={{ marginTop: "2px" }} />
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 12px 0", color: "#92400e" }}>
                  Important: What happens when you initiate resale?
                </h3>
                <ul style={{ margin: 0, paddingLeft: "20px", color: "#92400e", lineHeight: "1.6" }}>
                  <li>The product will be marked as "ready_for_resale"</li>
                  <li>A resale event will be created in the system</li>
                  <li>ECHO activation will be triggered for supported marketplaces</li>
                  <li>The current valuation and product data will be snapshot</li>
                  <li>Transfer protocols will be initiated</li>
                </ul>
              </div>
            </div>
          </div>
          
          <button
            onClick={initiateResale}
            disabled={loading || !askingPrice || !marketplace}
            style={{
              ...btnPrimary,
              width: "100%",
              padding: "16px 24px",
              fontSize: "16px",
              fontWeight: "600",
              opacity: loading || !askingPrice || !marketplace ? 0.5 : 1,
              cursor: loading || !askingPrice || !marketplace ? "not-allowed" : "pointer"
            }}
            onMouseEnter={(e) => {
              if (!loading && askingPrice && marketplace) {
                e.currentTarget.style.background = "#333";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && askingPrice && marketplace) {
                e.currentTarget.style.background = "#000";
              }
            }}
          >
            {loading ? (
              <div style={{
                width: "20px",
                height: "20px",
                border: "2px solid #fff",
                borderTop: "2px solid transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite"
              }} />
            ) : (
              <>
                <Shield size={20} />
                Initiate Resale
              </>
            )}
          </button>
          
          {submitStatus && (
            <div style={{ marginTop: "20px" }}>
              <div style={banner("success")}>
                <CheckCircle size={16} />
                {submitStatus}
              </div>
            </div>
          )}
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

export default ResaleInitiatePage;
