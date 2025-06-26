'use client';

import React, { useState, useEffect } from 'react';
import { User, Shield, Clock, AlertTriangle, Check, Upload, FileText, Eye, Scale, Heart, ChevronRight, X, Lock, Users } from 'lucide-react';
import { api, auth } from '@/lib/api';

type ProxyAssignment = {
  id: string;
  proxy_name: string;
  proxy_email?: string;
  proxy_wallet_address?: string;
  relationship: string;
  role: string;
  country: string;
  additional_notes?: string;
  id_document_url?: string;
  legal_document_url?: string;
  status: string;
  activated_at?: string;
  requested_at?: string;
};

const ProxyPage = () => {
  const [proxyAssignments, setProxyAssignments] = useState<ProxyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);

  const [selectedProxy, setSelectedProxy] = useState<ProxyAssignment | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formData, setFormData] = useState<{
    proxy_name: string;
    proxy_email: string;
    proxy_wallet_address: string;
    relationship: string;
    role: string;
    country: string;
    additional_notes: string;
    id_document: File | null;
    legal_document: File | null;
    id_document_url: string;
    legal_document_url: string;
  }>({
    proxy_name: '',
    proxy_email: '',
    proxy_wallet_address: '',
    relationship: '',
    role: '',
    country: '',
    additional_notes: '',
    id_document: null,
    legal_document: null,
    id_document_url: '',
    legal_document_url: ''
  });

  const clientData = auth.getClientData();
  const clientId = clientData?.id;

  useEffect(() => {
    if (clientId) {
      loadProxyData();
    }
  }, [clientId]);

  const loadProxyData = async () => {
    if (!clientId) return;
    
    try {
      setLoading(true);
      const assignments = await api.getProxyAssignments(clientId);
      setProxyAssignments(assignments);
    } catch (error) {
      console.error('Error loading proxy data:', error);
      setProxyAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (field: string, file: File) => {
    if (!file) return;
    
    try {
      const documentType = field === 'id_document' ? 'id_document' : 'legal_document';
      const result = await api.uploadProxyDocument(file, documentType);
      
      setFormData(prev => ({
        ...prev,
        [field]: file,
        [`${field}_url`]: result.documentUrl
      }));
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document. Please try again.');
    }
  };

  const handleSubmitForm = () => {
    setShowConfirmModal(true);
  };

  const confirmProxyRequest = async () => {
    if (!clientId) {
      alert('Authentication required. Please log in again.');
      return;
    }

    try {
      setSubmitLoading(true);
      await api.submitProxyRequest(clientId, {
        proxy_name: formData.proxy_name,
        proxy_email: formData.proxy_email || undefined,
        proxy_wallet_address: formData.proxy_wallet_address || undefined,
        relationship: formData.relationship,
        role: formData.role,
        country: formData.country,
        additional_notes: formData.additional_notes || undefined,
        id_document_url: formData.id_document_url || undefined,
        legal_document_url: formData.legal_document_url || undefined
      });
      
      setShowConfirmModal(false);
      setShowForm(false);
      setFormData({
        proxy_name: '',
        proxy_email: '',
        proxy_wallet_address: '',
        relationship: '',
        role: '',
        country: '',
        additional_notes: '',
        id_document: null,
        legal_document: null,
        id_document_url: '',
        legal_document_url: ''
      });
      
      await loadProxyData();
      alert('Proxy request submitted successfully. AUCTA will review and contact both parties before activation.');
    } catch (error) {
      console.error('Error submitting proxy request:', error);
      alert('Failed to submit proxy request. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleRevokeProxy = async () => {
    if (!selectedProxy) {
      alert('No proxy selected to revoke.');
      return;
    }
    try {
      await api.revokeProxyAccess(clientId, Number(selectedProxy.id));
      setShowRevokeModal(false);
      setSelectedProxy(null);
      await loadProxyData();
      alert('Proxy access revoked successfully.');
    } catch (error) {
      console.error('Error revoking proxy:', error);
      alert('Failed to revoke proxy access. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'pending_review': return '#f59e0b';
      case 'revoked': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Check size={14} />;
      case 'pending_review': return <Clock size={14} />;
      case 'revoked': return <X size={14} />;
      default: return <AlertTriangle size={14} />;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'viewer': return <Eye size={20} color="#666" />;
      case 'legal_proxy': return <Scale size={20} color="#666" />;
      case 'inheritance_heir': return <Heart size={20} color="#666" />;
      default: return <User size={20} color="#666" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'viewer': return 'Viewer';
      case 'legal_proxy': return 'Legal Proxy';
      case 'inheritance_heir': return 'Inheritance Heir';
      default: return role;
    }
  };

  if (!clientId) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        flexDirection: 'column'
      }}>
        <Lock size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
        <h3 style={{ color: '#ef4444', fontSize: '18px', marginBottom: '8px' }}>Authentication Required</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>Please log in to manage proxy assignments.</p>
      </div>
    );
  }

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
            border: '2px solid #f3f4f6',
            borderTopColor: '#000',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#666', fontSize: '14px' }}>Loading proxy management...</p>
        </div>
      </div>
    );
  }

  const activeProxies = proxyAssignments.filter(p => p.status === 'active');
  const pendingProxies = proxyAssignments.filter(p => p.status === 'pending_review');

  return (
    <div style={{ padding: '0' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 400,
          marginBottom: '8px',
          color: '#000'
        }}>
          Proxy & Legal Delegation
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#666',
          margin: 0
        }}>
          Securely assign trusted delegates, legal representatives, or heirs to manage your AUCTA vault.
        </p>
      </div>

      {/* Active Proxy Section */}
      {activeProxies.length > 0 ? (
        <div style={{
          background: '#fff',
          border: '1px solid #f0f0f0',
          borderRadius: '12px',
          marginBottom: '24px'
        }}>
          <div style={{
            padding: '24px 24px 0 24px',
            borderBottom: '1px solid #f0f0f0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{
                fontSize: '16px',
                fontWeight: 500,
                margin: 0,
                color: '#000'
              }}>
                Active Delegation
              </h2>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                background: '#f0fdf4',
                borderRadius: '20px'
              }}>
                <Check size={12} color="#22c55e" />
                <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 500 }}>Active</span>
              </div>
            </div>
          </div>

          {activeProxies.map(proxy => (
            <div key={proxy.id} style={{ padding: '24px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: '#f9fafb',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #f0f0f0'
                  }}>
                    {getRoleIcon(proxy.role)}
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: 500,
                      margin: 0,
                      marginBottom: '2px',
                      color: '#000'
                    }}>
                      {proxy.proxy_name}
                    </h3>
                    <p style={{
                      fontSize: '14px',
                      color: '#666',
                      margin: 0
                    }}>
                      {getRoleLabel(proxy.role)} • {proxy.relationship}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedProxy(proxy);
                    setShowRevokeModal(true);
                  }}
                  style={{
                    padding: '6px 12px',
                    background: 'none',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.target as HTMLButtonElement;
                    target.style.background = '#ef4444';
                    target.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.target as HTMLButtonElement;
                    target.style.background = 'none';
                    target.style.color = '#ef4444';
                  }}
                >
                  Revoke Access
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '16px',
                padding: '16px',
                background: '#f9fafb',
                borderRadius: '8px'
              }}>
                <div>
                  <p style={{ fontSize: '11px', color: '#666', margin: 0, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</p>
                  <p style={{ fontSize: '14px', fontWeight: 400, margin: 0, color: '#000' }}>{proxy.proxy_email || 'Not provided'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#666', margin: 0, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Country</p>
                  <p style={{ fontSize: '14px', fontWeight: 400, margin: 0, color: '#000' }}>{proxy.country}</p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#666', margin: 0, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Activated</p>
                  <p style={{ fontSize: '14px', fontWeight: 400, margin: 0, color: '#000' }}>
                    {proxy.activated_at ? new Date(proxy.activated_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              {proxy.additional_notes && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '11px', color: '#666', margin: 0, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</p>
                  <p style={{ fontSize: '14px', color: '#333', margin: 0 }}>{proxy.additional_notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          background: '#fff',
          border: '1px solid #f0f0f0',
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <Users size={40} color="#e5e7eb" style={{ margin: '0 auto 16px' }} />
          <h3 style={{
            fontSize: '16px',
            fontWeight: 400,
            marginBottom: '8px',
            color: '#000'
          }}>
            No Active Delegation
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#666',
            margin: 0
          }}>
            You haven't assigned any trusted proxy or legal delegate yet.
          </p>
        </div>
      )}

      {/* Pending Requests */}
      {pendingProxies.length > 0 && (
        <div style={{
          background: '#fff',
          border: '1px solid #f0f0f0',
          borderRadius: '12px',
          marginBottom: '24px'
        }}>
          <div style={{
            padding: '24px 24px 0 24px',
            borderBottom: '1px solid #f0f0f0'
          }}>
            <h2 style={{
              fontSize: '16px',
              fontWeight: 500,
              margin: 0,
              color: '#000'
            }}>
              Pending Requests
            </h2>
          </div>
          <div style={{ padding: '24px' }}>
            {pendingProxies.map(proxy => (
              <div key={proxy.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                background: '#f9fafb',
                borderRadius: '8px',
                marginBottom: '12px'
              }}>
                <div>
                  <h4 style={{ margin: 0, marginBottom: '4px', fontSize: '14px', fontWeight: 500, color: '#000' }}>{proxy.proxy_name}</h4>
                  <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                    {getRoleLabel(proxy.role)} • Submitted {proxy.requested_at ? new Date(proxy.requested_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  background: '#fef3c7',
                  borderRadius: '20px'
                }}>
                  <Clock size={12} color="#f59e0b" />
                  <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 500 }}>Under Review</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign New Proxy */}
      <div style={{
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: '12px'
      }}>
        <div style={{
          padding: '24px 24px 0 24px',
          borderBottom: showForm ? '1px solid #f0f0f0' : 'none'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{
                fontSize: '16px',
                fontWeight: 500,
                margin: 0,
                marginBottom: '4px',
                color: '#000'
              }}>
                Assign New Proxy
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#666',
                margin: 0
              }}>
                Create a new proxy assignment to grant trusted access to your AUCTA vault.
              </p>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                style={{
                  padding: '8px 16px',
                  background: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.background = '#333'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.background = '#000'}
              >
                New Assignment
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <div style={{ padding: '24px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              marginBottom: '20px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  value={formData.proxy_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, proxy_name: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: '#fff'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Country of Residence *
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: '#fff'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Relationship *
                </label>
                <select
                  value={formData.relationship}
                  onChange={(e) => setFormData(prev => ({ ...prev, relationship: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: '#fff'
                  }}
                >
                  <option value="">Select relationship...</option>
                  <option value="Family">Family</option>
                  <option value="Lawyer">Lawyer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: '#fff'
                  }}
                >
                  <option value="">Select role...</option>
                  <option value="viewer">Viewer — read-only vault access</option>
                  <option value="legal_proxy">Legal Proxy — can submit legal requests</option>
                  <option value="inheritance_heir">Inheritance Heir — receive ownership trigger</option>
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.proxy_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, proxy_email: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: '#fff'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Wallet Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.proxy_wallet_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, proxy_wallet_address: e.target.value }))}
                  placeholder="0x..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'SF Mono, Monaco, monospace',
                    boxSizing: 'border-box',
                    background: '#fff'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                marginBottom: '6px',
                color: '#374151',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Additional Notes
              </label>
              <textarea
                value={formData.additional_notes}
                onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  background: '#fff'
                }}
                placeholder="Any additional context or instructions..."
              />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  ID Document (Optional)
                </label>
                <div style={{
                  border: '2px dashed #e5e7eb',
                  borderRadius: '6px',
                  padding: '16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: '#fafafa'
                }}
                onClick={() => {
                  const input = document.getElementById('id-document');
                  if (input) input.click();
                }}
                onMouseEnter={(e) => ((e.target as HTMLDivElement).style.borderColor = '#000')}
                onMouseLeave={(e) => ((e.target as HTMLDivElement).style.borderColor = '#e5e7eb')}
                >
                  <Upload size={20} color="#9ca3af" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                    {formData.id_document ? formData.id_document.name : 'Upload ID (PDF/JPG)'}
                  </p>
                  <input
                    id="id-document"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload('id_document', e.target.files[0]);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Legal Document (Optional)
                </label>
                <div style={{
                  border: '2px dashed #e5e7eb',
                  borderRadius: '6px',
                  padding: '16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: '#fafafa'
                }}
                onClick={() => {
                  const input = document.getElementById('legal-document');
                  if (input) input.click();
                }}
                onMouseEnter={(e) => ((e.target as HTMLDivElement).style.borderColor = '#000')}
                onMouseLeave={(e) => ((e.target as HTMLDivElement).style.borderColor = '#e5e7eb')}
                >
                  <FileText size={20} color="#9ca3af" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                    {formData.legal_document ? formData.legal_document.name : 'Upload Legal Doc (PDF)'}
                  </p>
                  <input
                    id="legal-document"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload('legal_document', e.target.files[0]);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              paddingTop: '16px',
              borderTop: '1px solid #f0f0f0'
            }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitForm}
                disabled={!formData.proxy_name || !formData.relationship || !formData.role || !formData.country || submitLoading}
                style={{
                  padding: '8px 16px',
                  background: (formData.proxy_name && formData.relationship && formData.role && formData.country && !submitLoading) ? '#000' : '#e5e7eb',
                  color: (formData.proxy_name && formData.relationship && formData.role && formData.country && !submitLoading) ? '#fff' : '#9ca3af',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: (formData.proxy_name && formData.relationship && formData.role && formData.country && !submitLoading) ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {submitLoading && (
                  <div style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid currentColor',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}
                {submitLoading ? 'Submitting...' : 'Submit Proxy Request'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
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
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '480px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 500,
              marginBottom: '16px',
              color: '#000'
            }}>
              Confirm Proxy Assignment
            </h3>
            
            <div style={{
              background: '#f9fafb',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>Name:</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#000' }}>{formData.proxy_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>Role:</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#000' }}>{getRoleLabel(formData.role)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>Relationship:</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#000' }}>{formData.relationship}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>Country:</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#000' }}>{formData.country}</span>
                </div>
                {formData.proxy_email && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', color: '#666' }}>Email:</span>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#000' }}>{formData.proxy_email}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <AlertTriangle size={16} color="#f59e0b" />
                <strong style={{ color: '#f59e0b', fontSize: '14px' }}>Security Notice</strong>
              </div>
              <p style={{ fontSize: '14px', margin: 0, color: '#92400e' }}>
                This request will be reviewed by AUCTA's security team. Both parties will be contacted before activation.
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmProxyRequest}
                style={{
                  padding: '8px 16px',
                  background: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {showRevokeModal && selectedProxy && (
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
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 500,
              marginBottom: '16px',
              color: '#000'
            }}>
              Revoke Proxy Access
            </h3>
            
            <p style={{ marginBottom: '20px', fontSize: '14px', color: '#666' }}>
              Are you sure you want to revoke proxy access for <strong style={{ color: '#000' }}>{selectedProxy.proxy_name}</strong>? 
              This action cannot be undone.
            </p>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowRevokeModal(false);
                  setSelectedProxy(null);
                }}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeProxy}
                style={{
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ProxyPage;