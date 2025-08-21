"use client";

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  AlertCircle, 
  CheckCircle, 
  Package, 
  User, 
  UserPlus, 
  Shield, 
  ExternalLink,
  ArrowRight,
  Info,
  Mail,
  Phone,
  MapPin,
  Clock,
  Target,
  UserCheck,
  Plus,
  Eye,
  X
} from 'lucide-react';

// Type definitions
interface ResaleEvent {
  id: string;
  resale_id: string;
  passport_id: number;
  seller_id: number;
  asking_price: number;
  currency: string;
  status: string;
  marketplace_id: string;
  initiated_at: string;
  passport?: {
    id: number;
    nfc_uid: string;
    status: string;
    metadata?: {
      brand?: string;
      object_name?: string;
      product_image?: string;
      collection_year?: string;
      original_price?: string;
      [key: string]: any;
    };
  };
  seller?: {
    id: number;
    name: string;
    email?: string;
  };
  buyer_id?: number;
  buyer?: {
    id: number;
    name: string;
    email?: string;
    kyc_status?: string;
    vault_status?: string;
  };
}

interface Client {
  id: number;
  name: string;
  email?: string;
  wallet_address: string;
  kyc_info?: {
    email?: string;
    phone?: string;
    city?: string;
    country?: string;
    kyc_status?: string;
    [key: string]: any;
  };
  kyc_status?: string;
  vault_status?: string;
  created_at: string;
}

const AssignBuyerPage = () => {
  // State management
  const [resaleSearch, setResaleSearch] = useState('');
  const [selectedResale, setSelectedResale] = useState<ResaleEvent | null>(null);
  const [searchResults, setSearchResults] = useState<ResaleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  // Buyer selection
  const [buyerMode, setBuyerMode] = useState<'existing' | 'new'>('existing');
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  
  // Assignment state
  const [assigning, setAssigning] = useState(false);
  const [assignmentComplete, setAssignmentComplete] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

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

  // Search for resale events
  const searchResaleEvents = async () => {
    setLoading(true);
    setValidationError('');
    setSearchResults([]);
    setSelectedResale(null);
    
    try {
      // If no search term, get recent resale events
      const searchQuery = resaleSearch.trim() || '*';
      const response = await fetch(`/api/sprint3/resale-console/search?q=${encodeURIComponent(searchQuery)}&status=ready_for_resale&limit=10`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Resale events not found');
      }
      
      const data = await response.json();
      setSearchResults(data.resale_events || []);
      
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to search resale events');
    } finally {
      setLoading(false);
    }
  };

  // Load recent resale events on component mount
  useEffect(() => {
    searchResaleEvents();
  }, []);

  // Search for clients
  const searchClients = async () => {
    if (!clientSearch.trim()) return;
    
    setClientSearchLoading(true);
    setClientResults([]);
    
    try {
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(clientSearch)}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Clients not found');
      }
      
      const data = await response.json();
      setClientResults(data.clients || []);
      
    } catch (error) {
      console.error('Client search error:', error);
      setClientResults([]);
    } finally {
      setClientSearchLoading(false);
    }
  };

  // Handle resale selection
  const handleResaleSelection = async (resale: ResaleEvent) => {
    setSelectedResale(resale);
    setValidationError('');
    
    // Validate resale status
    if (resale.status !== 'ready_for_resale') {
      setValidationError(`This resale event has status "${resale.status}" and is not ready for buyer assignment`);
      return;
    }
    
    // Check if buyer already assigned
    if (resale.buyer_id) {
      setValidationError('This resale event already has a buyer assigned');
      return;
    }
  };

  // Assign buyer to resale event
  const assignBuyer = async () => {
    if (!selectedResale || !selectedClient) {
      setValidationError('Please select both a resale event and a buyer');
      return;
    }
    
    setAssigning(true);
    setValidationError('');
    
    try {
      console.log('🔄 Sending assignment request:', {
        resale_id: selectedResale.resale_id,
        buyer_id: selectedClient.id,
        assignment_method: buyerMode
      });

      const response = await fetch('/api/sprint3/resale-console/assign-buyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resale_id: selectedResale.resale_id,
          buyer_id: selectedClient.id,
          assignment_metadata: {
            assigned_at: new Date().toISOString(),
            assignment_method: buyerMode,
            client_kyc_status: selectedClient.kyc_info?.kyc_status || selectedClient.kyc_status || 'pending',
            client_vault_status: selectedClient.vault_status || 'inactive'
          }
        })
      });
      
      console.log('📡 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorMessage = 'Failed to assign buyer';
        try {
          const errorData = await response.json();
          console.error('❌ Assignment error response:', errorData);
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (e) {
          console.error('Could not parse error response:', e);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('✅ Assignment successful:', data);
      setSubmitStatus(`Buyer assigned successfully! Assignment ID: ${data.assignment_id}`);
      setAssignmentComplete(true);
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setSelectedResale(null);
        setSelectedClient(null);
        setResaleSearch('');
        setClientSearch('');
        setSubmitStatus('');
        setAssignmentComplete(false);
      }, 5000);
      
    } catch (error) {
      console.error('Assignment error details:', error);
      let errorMessage = 'Failed to assign buyer';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Try to extract more specific error from response
      if (error instanceof Response) {
        try {
          const errorData = await error.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          console.error('Could not parse error response:', e);
        }
      }
      
      setValidationError(`Assignment failed: ${errorMessage}`);
    } finally {
      setAssigning(false);
    }
  };

  // Open new client registration in new window
  const openClientRegistration = () => {
    const registrationUrl = '/sprint-1/register-client';
    window.open(registrationUrl, '_blank', 'width=1200,height=800');
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
          Assign Buyer
        </h1>
        <p style={{ color: "#666", fontSize: "16px", lineHeight: "1.5" }}>
          Officially attach a buyer to an ongoing resale event. The buyer must be either an existing verified client or complete the standard onboarding process.
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
          color: selectedResale ? "#16a34a" : "#666"
        }}>
          <div style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: selectedResale ? "#16a34a" : "#e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "12px",
            fontWeight: "600"
          }}>
            {selectedResale ? "✓" : "1"}
          </div>
          <span style={{ fontWeight: "500" }}>Select Resale</span>
        </div>
        
        <ArrowRight size={16} color="#ccc" />
        
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "8px",
          color: selectedClient ? "#16a34a" : "#666"
        }}>
          <div style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: selectedClient ? "#16a34a" : "#e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "12px",
            fontWeight: "600"
          }}>
            {selectedClient ? "✓" : "2"}
          </div>
          <span style={{ fontWeight: "500" }}>Select Buyer</span>
        </div>
        
        <ArrowRight size={16} color="#ccc" />
        
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "8px",
          color: assignmentComplete ? "#16a34a" : "#666"
        }}>
          <div style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: assignmentComplete ? "#16a34a" : "#e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "12px",
            fontWeight: "600"
          }}>
            {assignmentComplete ? "✓" : "3"}
          </div>
          <span style={{ fontWeight: "500" }}>Confirm Assignment</span>
        </div>
      </div>

      {/* Step 1: Resale Item Overview */}
      <div style={card}>
        <h2 style={sectionTitle}>
          <Package size={20} /> Step 1: Select Resale Event
        </h2>
        
        <p style={{ color: "#666", marginBottom: "20px", lineHeight: "1.5" }}>
          {searchResults.length > 0 && !resaleSearch ? 
            `Showing ${searchResults.length} recent resale events ready for buyer assignment.` :
            "Search for a resale event that is ready for buyer assignment. Only events with status \"ready_for_resale\" can have buyers assigned."
          }
        </p>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", marginBottom: "16px" }}>
          <input
            type="text"
            value={resaleSearch}
            onChange={(e) => setResaleSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchResaleEvents()}
            placeholder="Search by Resale ID, Passport ID, or Product details (leave empty to see recent events)"
            style={input}
          />
          <button
            onClick={searchResaleEvents}
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
                {resaleSearch ? 'Search' : 'Refresh'}
              </>
            )}
          </button>
        </div>
        
        {/* Search Results */}
        {searchResults.length > 0 && (
          <div style={{
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            padding: "20px",
            background: "#f8f9fa",
            marginTop: "16px"
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>
              {resaleSearch ? 
                `Found ${searchResults.length} Resale Event${searchResults.length > 1 ? 's' : ''}` :
                `Recent Resale Events (${searchResults.length} available)`
              }
            </h3>
            
            {searchResults.map((resale) => {
              const metadata = resale.passport?.metadata || {};
              const brand = metadata.brand || 'Unknown Brand';
              const productName = metadata.object_name || 'Unknown Product';
              const productImage = metadata.product_image;
              const fullImageUrl = productImage && !productImage.startsWith('http') 
                ? `http://localhost:4000${productImage}`
                : productImage;
              
              return (
                <div
                  key={resale.id}
                  style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: "12px",
                    padding: "20px",
                    marginBottom: "16px",
                    background: "white",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    borderColor: selectedResale?.id === resale.id ? "#000" : "#e0e0e0"
                  }}
                  onClick={() => handleResaleSelection(resale)}
                >
                  <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
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
                      color: "#999",
                      border: "2px solid #f0f0f0"
                    }}>
                      {!fullImageUrl && "🏆"}
                    </div>
                    
                    {/* Resale Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                        <h4 style={{ 
                          fontSize: "16px", 
                          fontWeight: "600", 
                          margin: 0,
                          color: "#1a1a1a"
                        }}>
                          {brand} {productName}
                        </h4>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "500",
                          background: resale.status === 'ready_for_resale' ? "#ecfdf5" : "#fef2f2",
                          color: resale.status === 'ready_for_resale' ? "#065f46" : "#b91c1c",
                          border: `1px solid ${resale.status === 'ready_for_resale' ? "#d1fae5" : "#fecaca"}`
                        }}>
                          {resale.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "12px",
                        fontSize: "13px"
                      }}>
                        <div>
                          <p style={{ color: "#666", margin: "0 0 2px 0" }}>Resale ID</p>
                          <p style={{ fontWeight: "600", margin: 0, fontFamily: "monospace" }}>{resale.resale_id}</p>
                        </div>
                        <div>
                          <p style={{ color: "#666", margin: "0 0 2px 0" }}>Asking Price</p>
                          <p style={{ fontWeight: "600", margin: 0, color: "#16a34a" }}>
                            {resale.currency} {resale.asking_price?.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p style={{ color: "#666", margin: "0 0 2px 0" }}>Marketplace</p>
                          <p style={{ fontWeight: "500", margin: 0 }}>{resale.marketplace_id}</p>
                        </div>
                        <div>
                          <p style={{ color: "#666", margin: "0 0 2px 0" }}>Seller</p>
                          <p style={{ fontWeight: "500", margin: 0 }}>{resale.seller?.name || `ID: ${resale.seller_id}`}</p>
                        </div>
                        <div>
                          <p style={{ color: "#666", margin: "0 0 2px 0" }}>Initiated</p>
                          <p style={{ fontWeight: "500", margin: 0 }}>
                            {new Date(resale.initiated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Selected Resale Display */}
        {selectedResale && (
          <div style={{
            border: "1px solid #16a34a",
            borderRadius: "12px",
            padding: "20px",
            background: "#ecfdf5",
            marginTop: "16px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <CheckCircle size={16} color="#16a34a" />
              <span style={{ color: "#065f46", fontSize: "14px", fontWeight: "500" }}>
                Resale Event Selected - Ready for Buyer Assignment
              </span>
            </div>
            
            <div style={{ fontSize: "13px", color: "#065f46", lineHeight: "1.4" }}>
              <strong>Resale ID:</strong> {selectedResale.resale_id} | 
              <strong> Status:</strong> {selectedResale.status} | 
              <strong> Asking Price:</strong> {selectedResale.currency} {selectedResale.asking_price?.toLocaleString()}
            </div>
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

      {/* Step 2: Select Buyer */}
      {selectedResale && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <User size={20} /> Step 2: Select Buyer
          </h2>
          
          <p style={{ color: "#666", marginBottom: "20px", lineHeight: "1.5" }}>
            Choose an existing verified client or start the onboarding process for a new client.
          </p>
          
          {/* Buyer Mode Toggle */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <button
              onClick={() => setBuyerMode('existing')}
              style={{
                ...btnSecondary,
                background: buyerMode === 'existing' ? "#f0f0f0" : "transparent",
                borderColor: buyerMode === 'existing' ? "#000" : "#e0e0e0",
                padding: "12px 20px"
              }}
            >
              <UserCheck size={16} />
              Existing Client
            </button>
            <button
              onClick={() => setBuyerMode('new')}
              style={{
                ...btnSecondary,
                background: buyerMode === 'new' ? "#f0f0f0" : "transparent",
                borderColor: buyerMode === 'new' ? "#000" : "#e0e0e0",
                padding: "12px 20px"
              }}
            >
              <UserPlus size={16} />
              New Client
            </button>
          </div>
          
          {buyerMode === 'existing' && (
            <div>
              <div style={{ marginBottom: "20px" }}>
                <label style={label}>Search for Existing Client</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px" }}>
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchClients()}
                    placeholder="Enter client name, email, wallet address, or ID"
                    style={input}
                  />
                  <button
                    onClick={searchClients}
                    disabled={clientSearchLoading}
                    style={{ ...btnPrimary, width: "100px" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#000")}
                  >
                    {clientSearchLoading ? (
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
              </div>
              
              {/* Client Search Results */}
              {clientResults.length > 0 && (
                <div style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "12px",
                  padding: "20px",
                  background: "#f8f9fa",
                  marginBottom: "20px"
                }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>
                    Found {clientResults.length} Client{clientResults.length > 1 ? 's' : ''}
                  </h3>
                  
                  {clientResults.map((client) => {
                    const kycInfo = client.kyc_info || {};
                    // Prioritize direct kyc_status field, fall back to kyc_info nested status
                    const kycStatus = kycInfo.kyc_status || client.kyc_status || 'pending';
                    const vaultStatus = client.vault_status || 'inactive';
                    
                    return (
                      <div
                        key={client.id}
                        style={{
                          border: "1px solid #e0e0e0",
                          borderRadius: "12px",
                          padding: "16px",
                          marginBottom: "12px",
                          background: "white",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          borderColor: selectedClient?.id === client.id ? "#000" : "#e0e0e0"
                        }}
                        onClick={() => setSelectedClient(client)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "12px",
                            background: "#f0f0f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "18px"
                          }}>
                            <User size={20} color="#666" />
                          </div>
                          
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                              <h4 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>
                                {client.name}
                              </h4>
                              <span style={{
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "600",
                                background: "#f0f9ff",
                                color: "#0369a1",
                                border: "1px solid #bae6fd"
                              }}>
                                ID: {client.id}
                              </span>
                              <span style={{
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "500",
                                background: 
                                  kycStatus === 'verified' || kycStatus === 'completed' ? "#ecfdf5" :
                                  kycStatus === 'pending' ? "#fffbeb" : "#fef2f2",
                                color: 
                                  kycStatus === 'verified' || kycStatus === 'completed' ? "#065f46" :
                                  kycStatus === 'pending' ? "#92400e" : "#b91c1c"
                              }}>
                                KYC: {kycStatus.toUpperCase()}
                              </span>
                              <span style={{
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "500",
                                background: vaultStatus === 'active' ? "#ecfdf5" : "#fffbeb",
                                color: vaultStatus === 'active' ? "#065f46" : "#92400e"
                              }}>
                                VAULT: {vaultStatus.toUpperCase()}
                              </span>
                            </div>
                            
                            <div style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                              gap: "8px",
                              fontSize: "12px",
                              color: "#666"
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <User size={12} />
                                Client ID: {client.id}
                              </div>
                              {kycInfo.email && (
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                  <Mail size={12} />
                                  {kycInfo.email}
                                </div>
                              )}
                              {kycInfo.phone && (
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                  <Phone size={12} />
                                  {kycInfo.phone}
                                </div>
                              )}
                              {kycInfo.city && (
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                  <MapPin size={12} />
                                  {kycInfo.city}, {kycInfo.country}
                                </div>
                              )}
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <Clock size={12} />
                                Registered: {new Date(client.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Selected Client Display */}
              {selectedClient && (
                <div style={{
                  border: "1px solid #16a34a",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "#ecfdf5"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <CheckCircle size={16} color="#16a34a" />
                    <span style={{ color: "#065f46", fontSize: "14px", fontWeight: "500" }}>
                      Client Selected as Buyer
                    </span>
                  </div>
                  
                  <div style={{ fontSize: "13px", color: "#065f46", lineHeight: "1.4" }}>
                    <div style={{ marginBottom: "4px" }}>
                      <strong>Name:</strong> {selectedClient.name} | <strong>Client ID:</strong> {selectedClient.id}
                    </div>
                    <div>
                      <strong>KYC:</strong> {selectedClient.kyc_info?.kyc_status || selectedClient.kyc_status || 'pending'} | 
                      <strong> Vault:</strong> {selectedClient.vault_status || 'inactive'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {buyerMode === 'new' && (
            <div style={{
              border: "1px solid #f59e0b",
              borderRadius: "12px",
              padding: "20px",
              background: "#fffbeb"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <UserPlus size={20} color="#f59e0b" />
                <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0, color: "#92400e" }}>
                  Register New Client
                </h3>
              </div>
              
              <p style={{ color: "#92400e", margin: "0 0 16px 0", lineHeight: "1.5" }}>
                This will open the client registration process in a new window. Complete the onboarding process there, then return here to assign the new client as the buyer.
              </p>
              
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={openClientRegistration}
                  style={{ ...btnWarning, padding: "12px 20px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#d97706")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#f59e0b")}
                >
                  <ExternalLink size={16} />
                  Open Registration
                </button>
                <button
                  onClick={() => setBuyerMode('existing')}
                  style={{ ...btnSecondary, padding: "12px 20px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Back to Existing Clients
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Confirm Assignment */}
      {selectedResale && selectedClient && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Shield size={20} /> Step 3: Confirm Assignment
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
                  Assignment Summary
                </h3>
                <div style={{ color: "#92400e", lineHeight: "1.6" }}>
                  <p style={{ margin: "0 0 8px 0" }}>
                    <strong>Resale Event:</strong> {selectedResale.resale_id}
                  </p>
                  <p style={{ margin: "0 0 8px 0" }}>
                    <strong>Product:</strong> {selectedResale.passport?.metadata?.brand} {selectedResale.passport?.metadata?.object_name}
                  </p>
                  <p style={{ margin: "0 0 8px 0" }}>
                    <strong>Price:</strong> {selectedResale.currency} {selectedResale.asking_price?.toLocaleString()}
                  </p>
                  <p style={{ margin: "0 0 8px 0" }}>
                    <strong>Buyer:</strong> {selectedClient.name}
                  </p>
                  <p style={{ margin: "0 0 8px 0" }}>
                    <strong>Client ID:</strong> {selectedClient.id}
                  </p>
                  <p style={{ margin: "0 0 12px 0" }}>
                    <strong>KYC Status:</strong> {selectedClient.kyc_info?.kyc_status || selectedClient.kyc_status || 'pending'}
                  </p>
                  
                  <div style={{ marginTop: "16px" }}>
                    <strong>What happens during assignment:</strong>
                    <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                      <li>Buyer identity is locked into the resale event</li>
                      <li>Assignment is recorded in the system logs</li>
                      <li>Product status is updated to "BUYER_ASSIGNED"</li>
                      <li>Ready for contract creation between seller and buyer</li>
                    </ul>
                    
                    <div style={{ marginTop: "12px", fontSize: "13px", color: "#92400e" }}>
                      <strong>Note:</strong> No SBT minting occurs at this stage. Contracts and validation come next.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <button
            onClick={assignBuyer}
            disabled={assigning || assignmentComplete}
            style={{
              ...btnPrimary,
              width: "100%",
              padding: "16px 24px",
              fontSize: "16px",
              fontWeight: "600",
              opacity: assigning || assignmentComplete ? 0.5 : 1,
              cursor: assigning || assignmentComplete ? "not-allowed" : "pointer"
            }}
            onMouseEnter={(e) => {
              if (!assigning && !assignmentComplete) {
                e.currentTarget.style.background = "#333";
              }
            }}
            onMouseLeave={(e) => {
              if (!assigning && !assignmentComplete) {
                e.currentTarget.style.background = "#000";
              }
            }}
          >
            {assigning ? (
              <div style={{
                width: "20px",
                height: "20px",
                border: "2px solid #fff",
                borderTop: "2px solid transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite"
              }} />
            ) : assignmentComplete ? (
              <>
                <CheckCircle size={20} />
                Assignment Complete
              </>
            ) : (
              <>
                <Target size={20} />
                Confirm Buyer Assignment
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

export default AssignBuyerPage;
