'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, Shield, Calendar, User, Mail, Phone, 
  Upload, ChevronRight, AlertCircle, CheckCircle, 
  Clock, X, Plus, ExternalLink, FileCheck
} from 'lucide-react';
import { api, auth } from '@/lib/api';

interface InheritanceRequest {
  id: number;
  client_id: number;
  request_type: 'immediate' | 'post_mortem' | 'legal_mandate';
  status: string;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  admin_notes?: string;
  beneficiary_name: string;
  beneficiary_email: string;
  beneficiary_phone?: string;
  beneficiary_relationship: string;
  beneficiary_client_id?: number;
  beneficiary_kyc_status: string;
  proxy_assignment_id?: number;
  product_count: number;
  products: any[];
  documents: any[];
}

interface Product {
  id: number;
  nfc_uid: string;
  metadata: any;
  status: string;
  brand?: string;
  object_name?: string;
  product_image?: string;
  original_price?: string;
}

interface ProxyAssignment {
  id: number;
  proxy_name: string;
  proxy_email: string;
  relationship: string;
  role: string;
  status: string;
}

export default function InheritancePlan() {
  const [inheritanceRequests, setInheritanceRequests] = useState<InheritanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<any>(null);
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [formStep, setFormStep] = useState(1);
  
  // Form state
  const [requestType, setRequestType] = useState<'immediate' | 'post_mortem' | 'legal_mandate'>('post_mortem');
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [beneficiaryType, setBeneficiaryType] = useState<'new' | 'proxy'>('new');
  const [selectedProxy, setSelectedProxy] = useState<ProxyAssignment | null>(null);
  const [beneficiaryData, setBeneficiaryData] = useState({
    name: '',
    email: '',
    phone: '',
    relationship: ''
  });
  const [documents, setDocuments] = useState<Array<{ type: string; url: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Additional data
  const [vaultProducts, setVaultProducts] = useState<Product[]>([]);
  const [proxies, setProxies] = useState<ProxyAssignment[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchInheritanceData = async () => {
      try {
        const client = auth.getClientData();
        if (!client) {
          console.warn('No client data found');
          setLoading(false);
          return;
        }
        
        setClientData(client);
        
        if (!client.id) {
          console.warn('Client has no ID');
          setLoading(false);
          return;
        }
        
        // Fetch all required data in parallel
        const [inheritanceData, vaultData, proxyData, activityData] = await Promise.all([
          api.getInheritancePlan(client.id),
          api.getClientVault(client.id),
          api.getProxyAssignments(client.id),
          api.getInheritanceActivity(client.id, 10)
        ]);
        
        setInheritanceRequests(Array.isArray(inheritanceData) ? inheritanceData : []);
        setVaultProducts(Array.isArray(vaultData) ? vaultData : []);
        setProxies(Array.isArray(proxyData) ? proxyData.filter((p: ProxyAssignment) => p.status === 'active') : []);
        setActivityLogs(Array.isArray(activityData) ? activityData : []);
        
        // Show form if no inheritance requests exist
        if (!inheritanceData || inheritanceData.length === 0) {
          setShowNewRequestForm(true);
        }
      } catch (error) {
        console.error('Error fetching inheritance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInheritanceData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    try {
      const result = await api.uploadInheritanceDocument(file, docType);
      setDocuments([...documents, {
        type: docType,
        url: result.documentUrl,
        name: result.originalName
      }]);
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!clientData?.id) return;
    
    setSubmitting(true);
    try {
      const requestData = {
        request_type: requestType,
        product_ids: selectedProducts,
        beneficiary: beneficiaryType === 'proxy' && selectedProxy ? {
          name: selectedProxy.proxy_name,
          email: selectedProxy.proxy_email,
          phone: '',
          relationship: selectedProxy.relationship,
          is_existing_proxy: true,
          proxy_assignment_id: selectedProxy.id
        } : beneficiaryData,
        documents: documents
      };
      
      await api.submitInheritanceRequest(clientData.id, requestData);
      
      // Refresh data
      const updatedData = await api.getInheritancePlan(clientData.id);
      setInheritanceRequests(Array.isArray(updatedData) ? updatedData : []);
      setShowNewRequestForm(false);
      resetForm();
    } catch (error) {
      console.error('Error submitting inheritance request:', error);
      alert('Failed to submit inheritance request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!clientData?.id) return;
    
    if (!confirm('Are you sure you want to cancel this inheritance request?')) return;
    
    try {
      await api.cancelInheritanceRequest(clientData.id, requestId);
      
      // Refresh data
      const updatedData = await api.getInheritancePlan(clientData.id);
      setInheritanceRequests(Array.isArray(updatedData) ? updatedData : []);
    } catch (error) {
      console.error('Error cancelling request:', error);
      alert('Failed to cancel request. Please try again.');
    }
  };

  const handleLegalReview = async (requestId?: number) => {
    if (!clientData?.id) return;
    
    try {
      await api.requestInheritanceLegalReview(clientData.id, {
        inheritance_request_id: requestId,
        appointment_type: 'physical',
        notes: 'Request for inheritance plan legal review'
      });
      
      alert('Legal review appointment request submitted. AUCTA legal team will contact you within 48 hours.');
    } catch (error) {
      console.error('Error requesting legal review:', error);
      alert('Failed to submit legal review request. Please try again.');
    }
  };

  const resetForm = () => {
    setFormStep(1);
    setRequestType('post_mortem');
    setSelectedProducts([]);
    setBeneficiaryType('new');
    setSelectedProxy(null);
    setBeneficiaryData({ name: '', email: '', phone: '', relationship: '' });
    setDocuments([]);
  };

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return <Clock size={16} className="text-yellow-600" />;
      case 'APPROVED':
      case 'ACTIVE':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'REJECTED':
        return <X size={16} className="text-red-600" />;
      default:
        return <AlertCircle size={16} className="text-gray-600" />;
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
          <p style={{ color: '#666', fontSize: '14px' }}>Loading inheritance plan...</p>
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
            Digital Estate Planning
          </h1>
          <p style={{
            fontSize: '18px',
            opacity: 0.9,
            marginBottom: '32px'
          }}>
            Secure the future of your authenticated collection
          </p>
          
          <div style={{
            display: 'flex',
            gap: '32px',
            flexWrap: 'wrap'
          }}>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Active Plans</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>
                {inheritanceRequests.filter(r => r.status === 'APPROVED' || r.status === 'ACTIVE').length}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Pending Review</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>
                {inheritanceRequests.filter(r => r.status === 'PENDING_REVIEW').length}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Products Protected</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>
                {inheritanceRequests.reduce((sum, r) => sum + r.products.length, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {showNewRequestForm ? (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e0e0e0',
          padding: '40px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px'
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 500,
              letterSpacing: '-0.01em'
            }}>
              Create Inheritance Plan
            </h2>
            {inheritanceRequests.length > 0 && (
              <button
                onClick={() => {
                  setShowNewRequestForm(false);
                  resetForm();
                }}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <X size={16} />
                Cancel
              </button>
            )}
          </div>

          {/* Progress Steps */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '40px'
          }}>
            {['Select Products', 'Choose Beneficiary', 'Upload Documents', 'Review & Submit'].map((step, index) => (
              <div
                key={index}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  position: 'relative'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: formStep > index + 1 ? '#000' : formStep === index + 1 ? '#333' : '#e0e0e0',
                  color: formStep >= index + 1 ? '#fff' : '#999',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                  fontSize: '14px',
                  fontWeight: 500
                }}>
                  {index + 1}
                </div>
                <p style={{
                  fontSize: '12px',
                  color: formStep >= index + 1 ? '#000' : '#999'
                }}>
                  {step}
                </p>
                {index < 3 && (
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    left: '50%',
                    right: '-50%',
                    height: '1px',
                    background: formStep > index + 1 ? '#000' : '#e0e0e0',
                    zIndex: -1
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Form Steps */}
          {formStep === 1 && (
            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 500,
                marginBottom: '24px'
              }}>
                Select inheritance type and products
              </h3>

              <div style={{ marginBottom: '32px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '12px'
                }}>
                  Type of Transfer
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  {[
                    { value: 'post_mortem', label: 'Post-Mortem', desc: 'Transfer after death certificate' },
                    { value: 'immediate', label: 'Immediate', desc: 'Transfer now with conditions' },
                    { value: 'legal_mandate', label: 'Legal Mandate', desc: 'Court-ordered transfer' }
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setRequestType(type.value as any)}
                      style={{
                        flex: 1,
                        padding: '16px',
                        border: `1px solid ${requestType === type.value ? '#000' : '#e0e0e0'}`,
                        borderRadius: '8px',
                        background: requestType === type.value ? '#f5f5f5' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <p style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        marginBottom: '4px'
                      }}>
                        {type.label}
                      </p>
                      <p style={{
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        {type.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '12px'
                }}>
                  Select Products ({selectedProducts.length} selected)
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '16px'
                }}>
                  {vaultProducts.map((product) => {
                    const metadata = typeof product.metadata === 'string' 
                      ? JSON.parse(product.metadata) 
                      : product.metadata || {};
                    const isSelected = selectedProducts.includes(product.id);
                    
                    return (
                      <div
                        key={product.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                          } else {
                            setSelectedProducts([...selectedProducts, product.id]);
                          }
                        }}
                        style={{
                          padding: '16px',
                          border: `1px solid ${isSelected ? '#000' : '#e0e0e0'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isSelected ? '#f5f5f5' : '#fff',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '8px'
                        }}>
                          <div>
                            <p style={{
                              fontSize: '14px',
                              fontWeight: 500
                            }}>
                              {product.brand || metadata.brand || 'Unknown Brand'}
                            </p>
                            <p style={{
                              fontSize: '12px',
                              color: '#666'
                            }}>
                              {product.object_name || metadata.object_name || 'Unknown Product'}
                            </p>
                          </div>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            border: `2px solid ${isSelected ? '#000' : '#e0e0e0'}`,
                            background: isSelected ? '#000' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        </div>
                        <p style={{
                          fontSize: '12px',
                          color: '#999',
                          fontFamily: 'monospace'
                        }}>
                          {product.nfc_uid.slice(0, 12)}...
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => {
                  if (selectedProducts.length === 0) {
                    alert('Please select at least one product');
                    return;
                  }
                  setFormStep(2);
                }}
                style={{
                  marginTop: '32px',
                  padding: '16px 32px',
                  background: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginLeft: 'auto'
                }}
              >
                Continue
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {formStep === 2 && (
            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 500,
                marginBottom: '24px'
              }}>
                Designate beneficiary
              </h3>

              <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '32px'
              }}>
                <button
                  onClick={() => setBeneficiaryType('new')}
                  style={{
                    flex: 1,
                    padding: '16px',
                    border: `1px solid ${beneficiaryType === 'new' ? '#000' : '#e0e0e0'}`,
                    borderRadius: '8px',
                    background: beneficiaryType === 'new' ? '#f5f5f5' : '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <User size={20} style={{ marginBottom: '8px' }} />
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>New Beneficiary</p>
                  <p style={{ fontSize: '12px', color: '#666' }}>Add someone new</p>
                </button>
                <button
                  onClick={() => setBeneficiaryType('proxy')}
                  style={{
                    flex: 1,
                    padding: '16px',
                    border: `1px solid ${beneficiaryType === 'proxy' ? '#000' : '#e0e0e0'}`,
                    borderRadius: '8px',
                    background: beneficiaryType === 'proxy' ? '#f5f5f5' : '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <Shield size={20} style={{ marginBottom: '8px' }} />
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>Existing Proxy</p>
                  <p style={{ fontSize: '12px', color: '#666' }}>Select from your proxies</p>
                </button>
              </div>

              {beneficiaryType === 'new' ? (
                <div style={{ display: 'grid', gap: '24px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 500,
                      marginBottom: '8px'
                    }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={beneficiaryData.name}
                      onChange={(e) => setBeneficiaryData({ ...beneficiaryData, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                      placeholder="Enter beneficiary's full name"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 500,
                        marginBottom: '8px'
                      }}>
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={beneficiaryData.email}
                        onChange={(e) => setBeneficiaryData({ ...beneficiaryData, email: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                        placeholder="beneficiary@email.com"
                      />
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 500,
                        marginBottom: '8px'
                      }}>
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={beneficiaryData.phone}
                        onChange={(e) => setBeneficiaryData({ ...beneficiaryData, phone: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                        placeholder="+1 234 567 8900"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 500,
                      marginBottom: '8px'
                    }}>
                      Relationship *
                    </label>
                    <select
                      value={beneficiaryData.relationship}
                      onChange={(e) => setBeneficiaryData({ ...beneficiaryData, relationship: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: '#fff'
                      }}
                    >
                      <option value="">Select relationship</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Child">Child</option>
                      <option value="Parent">Parent</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Other Family">Other Family</option>
                      <option value="Business Partner">Business Partner</option>
                      <option value="Friend">Friend</option>
                      <option value="Charity">Charity/Organization</option>
                    </select>
                  </div>

                  <div style={{
                    padding: '16px',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                        Beneficiary KYC Required
                      </p>
                      <p style={{ fontSize: '12px', color: '#666' }}>
                        The beneficiary will receive an invitation to complete identity verification before they can receive any assets.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {proxies.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '40px',
                      background: '#f5f5f5',
                      borderRadius: '8px'
                    }}>
                      <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                        No active proxies found. Add a proxy first or select "New Beneficiary".
                      </p>
                      <button
                        onClick={() => window.location.href = '/sprint-2/proxy'}
                        style={{
                          padding: '12px 24px',
                          background: '#000',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        Manage Proxies
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '16px' }}>
                      {proxies.map((proxy) => (
                        <div
                          key={proxy.id}
                          onClick={() => setSelectedProxy(proxy)}
                          style={{
                            padding: '16px',
                            border: `1px solid ${selectedProxy?.id === proxy.id ? '#000' : '#e0e0e0'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            background: selectedProxy?.id === proxy.id ? '#f5f5f5' : '#fff'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <p style={{ fontSize: '14px', fontWeight: 500 }}>{proxy.proxy_name}</p>
                              <p style={{ fontSize: '12px', color: '#666' }}>{proxy.proxy_email}</p>
                              <p style={{ fontSize: '12px', color: '#999' }}>{proxy.relationship} • {proxy.role}</p>
                            </div>
                            <div style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              border: `2px solid ${selectedProxy?.id === proxy.id ? '#000' : '#e0e0e0'}`,
                              background: selectedProxy?.id === proxy.id ? '#000' : 'transparent'
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: '16px',
                marginTop: '32px'
              }}>
                <button
                  onClick={() => setFormStep(1)}
                  style={{
                    padding: '16px 32px',
                    background: 'none',
                    color: '#000',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (beneficiaryType === 'new') {
                      if (!beneficiaryData.name || !beneficiaryData.email || !beneficiaryData.relationship) {
                        alert('Please fill in all required fields');
                        return;
                      }
                    } else if (!selectedProxy) {
                      alert('Please select a proxy');
                      return;
                    }
                    setFormStep(3);
                  }}
                  style={{
                    padding: '16px 32px',
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginLeft: 'auto'
                  }}
                >
                  Continue
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {formStep === 3 && (
            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 500,
                marginBottom: '24px'
              }}>
                Upload supporting documents
              </h3>

              <div style={{ display: 'grid', gap: '24px' }}>
                {[
                  { type: 'heir_id', label: 'Heir ID Document', required: true },
                  { type: 'legal_mandate', label: 'Legal Mandate/Will', required: requestType === 'legal_mandate' },
                  { type: 'personal_note', label: 'Personal Note', required: false }
                ].map((docType) => (
                  <div key={docType.type}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 500,
                      marginBottom: '8px'
                    }}>
                      {docType.label} {docType.required && '*'}
                    </label>
                    
                    {documents.find(d => d.type === docType.type) ? (
                      <div style={{
                        padding: '16px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <FileCheck size={20} color="#10b981" />
                          <span style={{ fontSize: '14px' }}>
                            {documents.find(d => d.type === docType.type)?.name}
                          </span>
                        </div>
                        <button
                          onClick={() => setDocuments(documents.filter(d => d.type !== docType.type))}
                          style={{
                            padding: '4px 8px',
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label style={{
                        display: 'block',
                        padding: '40px',
                        border: '2px dashed #e0e0e0',
                        borderRadius: '8px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}>
                        <input
                          type="file"
                          onChange={(e) => handleFileUpload(e, docType.type)}
                          style={{ display: 'none' }}
                          accept="image/*,.pdf,.doc,.docx"
                        />
                        <Upload size={24} style={{ margin: '0 auto 8px', color: '#999' }} />
                        <p style={{ fontSize: '14px', color: '#666' }}>
                          Click to upload or drag and drop
                        </p>
                        <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                          PNG, JPG, PDF up to 10MB
                        </p>
                      </label>
                    )}
                  </div>
                ))}
              </div>

              <div style={{
                display: 'flex',
                gap: '16px',
                marginTop: '32px'
              }}>
                <button
                  onClick={() => setFormStep(2)}
                  style={{
                    padding: '16px 32px',
                    background: 'none',
                    color: '#000',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Back
                </button>
                <button
                  onClick={() => setFormStep(4)}
                  style={{
                    padding: '16px 32px',
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginLeft: 'auto'
                  }}
                >
                  Continue
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {formStep === 4 && (
            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 500,
                marginBottom: '24px'
              }}>
                Review inheritance plan
              </h3>

              <div style={{
                background: '#f5f5f5',
                borderRadius: '8px',
                padding: '24px',
                marginBottom: '24px'
              }}>
                <h4 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px' }}>
                  Plan Summary
                </h4>
                
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Transfer Type</p>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>
                      {requestType === 'post_mortem' ? 'Post-Mortem' : 
                       requestType === 'immediate' ? 'Immediate' : 'Legal Mandate'}
                    </p>
                  </div>

                  <div>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Products</p>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>
                      {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>

                  <div>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Beneficiary</p>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>
                      {beneficiaryType === 'proxy' && selectedProxy 
                        ? selectedProxy.proxy_name 
                        : beneficiaryData.name}
                    </p>
                    <p style={{ fontSize: '12px', color: '#999' }}>
                      {beneficiaryType === 'proxy' && selectedProxy 
                        ? selectedProxy.proxy_email 
                        : beneficiaryData.email}
                    </p>
                  </div>

                  <div>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Documents</p>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>
                      {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
                    </p>
                  </div>
                </div>
              </div>

              <div style={{
                padding: '16px',
                background: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                  Important Notice
                </p>
                <p style={{ fontSize: '12px', color: '#666' }}>
                  This inheritance plan will be reviewed by AUCTA's legal team within 5 business days. 
                  Both you and the designated beneficiary will be contacted for verification. 
                  The plan will only become active after approval and all required documentation is validated.
                </p>
              </div>

              <div style={{
                display: 'flex',
                gap: '16px',
                marginTop: '32px'
              }}>
                <button
                  onClick={() => setFormStep(3)}
                  style={{
                    padding: '16px 32px',
                    background: 'none',
                    color: '#000',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    padding: '16px 32px',
                    background: submitting ? '#999' : '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: submitting ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginLeft: 'auto'
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Inheritance Plan'}
                  {!submitting && <FileText size={16} />}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Existing Plans */}
          {inheritanceRequests.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 40px',
              background: '#fff',
              borderRadius: '16px',
              border: '1px solid #e0e0e0'
            }}>
              <Shield size={64} color="#e0e0e0" style={{ margin: '0 auto 24px' }} />
              <h2 style={{
                fontSize: '24px',
                fontWeight: 400,
                marginBottom: '16px',
                color: '#333'
              }}>
                No inheritance plans yet
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#666',
                maxWidth: '400px',
                margin: '0 auto 32px'
              }}>
                Secure the future of your authenticated collection by creating a digital inheritance plan.
              </p>
              <button
                onClick={() => setShowNewRequestForm(true)}
                style={{
                  padding: '16px 32px',
                  background: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Plus size={16} />
                Create Inheritance Plan
              </button>
            </div>
          ) : (
            <div>
              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '32px'
              }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em'
                }}>
                  Your Inheritance Plans
                </h2>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <button
                    onClick={() => handleLegalReview()}
                    style={{
                      padding: '12px 24px',
                      background: 'none',
                      border: '1px solid #000',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Request Legal Review
                  </button>
                  <button
                    onClick={() => setShowNewRequestForm(true)}
                    style={{
                      padding: '12px 24px',
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Plus size={16} />
                    New Plan
                  </button>
                </div>
              </div>

              {/* Plans List */}
              <div style={{ display: 'grid', gap: '24px' }}>
                {inheritanceRequests.map((request) => (
                  <div
                    key={request.id}
                    style={{
                      background: '#fff',
                      borderRadius: '12px',
                      border: '1px solid #e0e0e0',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Plan Header */}
                    <div style={{
                      padding: '24px',
                      borderBottom: '1px solid #e0e0e0'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                      }}>
                        <div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '8px'
                          }}>
                            <h3 style={{
                              fontSize: '20px',
                              fontWeight: 500
                            }}>
                              {request.request_type === 'post_mortem' ? 'Post-Mortem Transfer' :
                               request.request_type === 'immediate' ? 'Immediate Transfer' : 'Legal Mandate Transfer'}
                            </h3>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 12px',
                              background: request.status === 'PENDING_REVIEW' ? '#fef3c7' :
                                         request.status === 'APPROVED' || request.status === 'ACTIVE' ? '#d1fae5' :
                                         '#fee2e2',
                              borderRadius: '12px'
                            }}>
                              {getStatusIcon(request.status)}
                              <span style={{
                                fontSize: '12px',
                                fontWeight: 500,
                                color: request.status === 'PENDING_REVIEW' ? '#92400e' :
                                       request.status === 'APPROVED' || request.status === 'ACTIVE' ? '#065f46' :
                                       '#991b1b'
                              }}>
                                {request.status.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                          <p style={{
                            fontSize: '14px',
                            color: '#666'
                          }}>
                            Created {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {request.status === 'PENDING_REVIEW' && (
                          <button
                            onClick={() => handleCancelRequest(request.id)}
                            style={{
                              padding: '8px 16px',
                              background: 'none',
                              border: '1px solid #dc2626',
                              borderRadius: '8px',
                              color: '#dc2626',
                              fontSize: '14px',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel Request
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Beneficiary Info */}
                    <div style={{
                      padding: '24px',
                      borderBottom: '1px solid #e0e0e0'
                    }}>
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#666',
                        marginBottom: '16px'
                      }}>
                        Beneficiary Information
                      </h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '24px'
                      }}>
                        <div>
                          <p style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Name</p>
                          <p style={{ fontSize: '14px', fontWeight: 500 }}>{request.beneficiary_name}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Email</p>
                          <p style={{ fontSize: '14px' }}>{request.beneficiary_email}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Relationship</p>
                          <p style={{ fontSize: '14px' }}>{request.beneficiary_relationship}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>KYC Status</p>
                          <p style={{ fontSize: '14px' }}>
                            {request.beneficiary_kyc_status === 'KYC_VERIFIED' ? (
                              <span style={{ color: '#10b981' }}>✓ Verified</span>
                            ) : (
                              <span style={{ color: '#f59e0b' }}>⏳ Pending</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Products */}
                    <div style={{
                      padding: '24px',
                      borderBottom: '1px solid #e0e0e0'
                    }}>
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#666',
                        marginBottom: '16px'
                      }}>
                        Included Products ({request.products.length})
                      </h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                        gap: '16px'
                      }}>
                        {request.products.map((product) => {
                          const metadata = typeof product.metadata === 'string' 
                            ? JSON.parse(product.metadata) 
                            : product.metadata || {};
                          
                          return (
                            <div
                              key={product.id}
                              style={{
                                padding: '16px',
                                background: '#f5f5f5',
                                borderRadius: '8px'
                              }}
                            >
                              <p style={{
                                fontSize: '14px',
                                fontWeight: 500,
                                marginBottom: '4px'
                              }}>
                                {product.brand || metadata.brand || 'Unknown Brand'}
                              </p>
                              <p style={{
                                fontSize: '12px',
                                color: '#666',
                                marginBottom: '8px'
                              }}>
                                {product.object_name || metadata.object_name || 'Unknown Product'}
                              </p>
                              <p style={{
                                fontSize: '11px',
                                color: '#999',
                                fontFamily: 'monospace'
                              }}>
                                {product.nfc_uid.slice(0, 16)}...
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Documents & Actions */}
                    <div style={{
                      padding: '24px',
                      background: '#f9fafb'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                            {request.documents.length} Document{request.documents.length !== 1 ? 's' : ''} on File
                          </p>
                          <p style={{ fontSize: '12px', color: '#666' }}>
                            All documents securely stored and encrypted
                          </p>
                        </div>
                        <button
                          onClick={() => handleLegalReview(request.id)}
                          style={{
                            padding: '8px 16px',
                            background: 'none',
                            border: '1px solid #000',
                            borderRadius: '8px',
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          Request Review
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Activity Log */}
              {activityLogs.length > 0 && (
                <div style={{
                  marginTop: '40px',
                  background: '#fff',
                  borderRadius: '16px',
                  border: '1px solid #e0e0e0',
                  padding: '32px'
                }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: 500,
                    marginBottom: '24px'
                  }}>
                    Inheritance Activity Log
                  </h3>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {activityLogs.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          display: 'flex',
                          gap: '16px',
                          padding: '16px',
                          background: '#f9fafb',
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#000',
                          marginTop: '6px',
                          flexShrink: 0
                        }} />
                        <div style={{ flex: 1 }}>
                          <p style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            marginBottom: '4px'
                          }}>
                            {log.action.replace(/_/g, ' ')}
                          </p>
                          <p style={{
                            fontSize: '12px',
                            color: '#666'
                          }}>
                            {new Date(log.timestamp).toLocaleString()}
                          </p>
                          {log.details?.beneficiary_name && (
                            <p style={{
                              fontSize: '12px',
                              color: '#999',
                              marginTop: '4px'
                            }}>
                              Beneficiary: {log.details.beneficiary_name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
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