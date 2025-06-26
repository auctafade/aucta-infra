// frontend/src/app/sprint-1/assign-passport/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';
import { Loading } from '@/components/ModernComponents';

interface Client {
  id: number;
  name: string;
  wallet_address: string;
  kyc_info: any;
  email?: string;
  created_at: string;
}

interface Passport {
  id: number;
  nfc_uid: string;
  metadata: any;
  status: string;
  collection_year?: string;
  created_at: string;
}

export default function AssignPassport() {
  const [clients, setClients] = useState<Client[]>([]);
  const [passports, setPassports] = useState<Passport[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedPassport, setSelectedPassport] = useState<Passport | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [passportSearch, setPassportSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientsData, passportsData] = await Promise.all([
        api.getClients(),
        api.getPassports()
      ]);

      setClients(clientsData);
      setPassports(passportsData.filter((p: Passport) => p.status === 'VACANT'));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseMetadata = (metadata: any) => {
    if (!metadata) return {};
    if (typeof metadata === 'object') return metadata;
    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata);
      } catch (e) {
        return {};
      }
    }
    return {};
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredClients = clients.filter(client => {
    const search = clientSearch.toLowerCase();
    return client.name.toLowerCase().includes(search) ||
           (client.email && client.email.toLowerCase().includes(search));
  });

  const filteredPassports = passports.filter(passport => {
    const search = passportSearch.toLowerCase();
    const metadata = parseMetadata(passport.metadata);
    const productName = metadata.object_name || metadata.product_name || metadata.model || '';
    
    return (metadata.brand && metadata.brand.toLowerCase().includes(search)) ||
           productName.toLowerCase().includes(search) ||
           passport.nfc_uid.toLowerCase().includes(search);
  });

  const handleAssignment = async () => {
    if (!selectedClient || !selectedPassport) return;

    setProcessing(true);
    try {
      await api.assignPassport(selectedPassport.id, selectedClient.id);
      setShowConfirmModal(false);
      
      // Reset and reload
      setSelectedClient(null);
      setSelectedPassport(null);
      loadData();
      
    } catch (error) {
      console.error('Assignment error:', error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner spinner-large"></div>
            <p style={{ marginTop: '20px', color: '#666' }}>Loading data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Main Container */}
      <div style={{ 
        minHeight: '100vh',
        background: '#fafafa'
      }}>
        {/* Header */}
        <div style={{
          background: 'white',
          borderBottom: '1px solid #e5e5e5',
          padding: '60px 0 40px'
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 40px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '40px'
            }}>
              <div>
                <p style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '12px'
                }}>
                  STEP 03 OF 04
                </p>
                <h1 style={{
                  fontSize: '48px',
                  fontWeight: 300,
                  letterSpacing: '-0.03em',
                  marginBottom: '12px'
                }}>
                  Assign Passport
                </h1>
                <p style={{
                  fontSize: '20px',
                  color: '#666',
                  fontWeight: 300
                }}>
                  Link a verified owner to their luxury product
                </p>
              </div>
              
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={!selectedClient || !selectedPassport}
                style={{
                  marginTop: '40px',
                  background: selectedClient && selectedPassport ? '#000' : '#f5f5f5',
                  color: selectedClient && selectedPassport ? '#fff' : '#999',
                  border: 'none',
                  padding: '16px 40px',
                  fontSize: '14px',
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  cursor: selectedClient && selectedPassport ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s',
                  opacity: selectedClient && selectedPassport ? 1 : 0.5
                }}
              >
                {selectedClient && selectedPassport ? 'Review & Confirm' : 'Select Items First'}
              </button>
            </div>

            {/* Selection Status */}
            {(selectedClient || selectedPassport) && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
                background: '#f5f5f5',
                padding: '20px',
                borderRadius: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: selectedClient ? '#000' : '#e5e5e5',
                    color: selectedClient ? '#fff' : '#999',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px'
                  }}>
                    {selectedClient ? '✓' : '1'}
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>SELECTED CLIENT</p>
                    <p style={{ fontWeight: 500 }}>
                      {selectedClient ? selectedClient.name : 'None selected'}
                    </p>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: selectedPassport ? '#000' : '#e5e5e5',
                    color: selectedPassport ? '#fff' : '#999',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px'
                  }}>
                    {selectedPassport ? '✓' : '2'}
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>SELECTED PRODUCT</p>
                    <p style={{ fontWeight: 500 }}>
                      {selectedPassport 
                        ? `${parseMetadata(selectedPassport.metadata).brand || 'Unknown'} - ${parseMetadata(selectedPassport.metadata).object_name || 'Unknown'}`
                        : 'None selected'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '40px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '40px'
        }}>
          {/* Clients Section */}
          <div>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: 400,
                  marginBottom: '8px'
                }}>
                  Verified Clients
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: '#666'
                }}>
                  {clients.length} total • {filteredClients.length} shown
                </p>
              </div>

              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search clients..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '14px',
                  marginBottom: '24px',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#000'}
                onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
              />

              <div style={{
                maxHeight: '500px',
                overflowY: 'auto',
                marginRight: '-16px',
                paddingRight: '16px'
              }}>
                {filteredClients.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '60px 0',
                    color: '#999'
                  }}>
                    <p>No clients found</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredClients.map(client => {
                      const isSelected = selectedClient?.id === client.id;
                      const clientKycInfo = typeof client.kyc_info === 'string' 
                        ? JSON.parse(client.kyc_info) 
                        : client.kyc_info;
                      
                      return (
                        <div
                          key={client.id}
                          onClick={() => setSelectedClient(client)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '16px',
                            background: isSelected ? '#000' : '#fafafa',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            border: `2px solid ${isSelected ? '#000' : 'transparent'}`
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = '#f0f0f0';
                              e.currentTarget.style.transform = 'translateX(4px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = '#fafafa';
                              e.currentTarget.style.transform = 'translateX(0)';
                            }
                          }}
                        >
                          {/* Profile Image */}
                          <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: isSelected ? '#333' : '#e5e5e5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            fontWeight: 500,
                            color: isSelected ? '#fff' : '#666',
                            flexShrink: 0,
                            overflow: 'hidden'
                          }}>
                            {clientKycInfo?.documents?.selfie ? (
                              <img 
                                src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${clientKycInfo.documents.selfie}`}
                                alt={client.name}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.parentElement!.innerHTML = getInitials(client.name);
                                }}
                              />
                            ) : (
                              getInitials(client.name)
                            )}
                          </div>

                          {/* Client Info */}
                          <div style={{ flex: 1 }}>
                            <h3 style={{
                              fontSize: '16px',
                              fontWeight: 500,
                              marginBottom: '4px',
                              color: isSelected ? '#fff' : '#000'
                            }}>
                              {client.name}
                            </h3>
                            <p style={{
                              fontSize: '14px',
                              color: isSelected ? '#ccc' : '#666',
                              marginBottom: '4px'
                            }}>
                              {client.email || 'No email'}
                            </p>
                            <p style={{
                              fontSize: '12px',
                              color: isSelected ? '#999' : '#999',
                              fontFamily: 'monospace'
                            }}>
                              #{String(client.id).padStart(6, '0')}
                            </p>
                          </div>

                          {/* Selection Indicator */}
                          {isSelected && (
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#fff',
                              color: '#000',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px'
                            }}>
                              ✓
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: 400,
                  marginBottom: '8px'
                }}>
                  Available Products
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: '#666'
                }}>
                  {passports.length} vacant passports
                </p>
              </div>

              <input
                type="text"
                value={passportSearch}
                onChange={(e) => setPassportSearch(e.target.value)}
                placeholder="Search products..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '14px',
                  marginBottom: '24px',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#000'}
                onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
              />

              <div style={{
                maxHeight: '500px',
                overflowY: 'auto',
                marginRight: '-16px',
                paddingRight: '16px'
              }}>
                {filteredPassports.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '60px 0',
                    color: '#999'
                  }}>
                    <p>No vacant passports found</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredPassports.map(passport => {
                      const metadata = parseMetadata(passport.metadata);
                      const isSelected = selectedPassport?.id === passport.id;
                      
                      return (
                        <div
                          key={passport.id}
                          onClick={() => setSelectedPassport(passport)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '16px',
                            background: isSelected ? '#000' : '#fafafa',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            border: `2px solid ${isSelected ? '#000' : 'transparent'}`
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = '#f0f0f0';
                              e.currentTarget.style.transform = 'translateX(4px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = '#fafafa';
                              e.currentTarget.style.transform = 'translateX(0)';
                            }
                          }}
                        >
                          {/* Product Image Placeholder */}
                          <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '8px',
                            background: isSelected ? '#333' : '#e5e5e5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                            flexShrink: 0
                          }}>
                            💎
                          </div>

                          {/* Product Info */}
                          <div style={{ flex: 1 }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '4px'
                            }}>
                              <h3 style={{
                                fontSize: '16px',
                                fontWeight: 500,
                                color: isSelected ? '#fff' : '#000'
                              }}>
                                {metadata.brand || 'Unknown Brand'}
                              </h3>
                              <span style={{
                                fontSize: '10px',
                                padding: '2px 8px',
                                background: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,255,0,0.1)',
                                color: isSelected ? '#fff' : '#00a000',
                                borderRadius: '4px',
                                fontWeight: 500
                              }}>
                                VACANT
                              </span>
                            </div>
                            <p style={{
                              fontSize: '14px',
                              color: isSelected ? '#ccc' : '#666',
                              marginBottom: '4px'
                            }}>
                              {metadata.object_name || metadata.product_name || 'Unknown Model'}
                            </p>
                            <p style={{
                              fontSize: '12px',
                              color: isSelected ? '#999' : '#999',
                              fontFamily: 'monospace'
                            }}>
                              {passport.nfc_uid}
                            </p>
                          </div>

                          {/* Selection Indicator */}
                          {isSelected && (
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#fff',
                              color: '#000',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px'
                            }}>
                              ✓
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedClient && selectedPassport && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '90%',
            padding: '40px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: 300,
              marginBottom: '32px'
            }}>
              Confirm Assignment
            </h2>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '32px'
            }}>
              <div style={{
                padding: '24px',
                background: '#fafafa',
                borderRadius: '12px'
              }}>
                <p style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '12px'
                }}>
                  Client
                </p>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 500,
                  marginBottom: '8px'
                }}>
                  {selectedClient.name}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#666'
                }}>
                  {selectedClient.email || 'No email'}
                </p>
              </div>
              
              <div style={{
                padding: '24px',
                background: '#fafafa',
                borderRadius: '12px'
              }}>
                <p style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '12px'
                }}>
                  Product
                </p>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 500,
                  marginBottom: '8px'
                }}>
                  {parseMetadata(selectedPassport.metadata).brand || 'Unknown'}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#666'
                }}>
                  {parseMetadata(selectedPassport.metadata).object_name || 'Unknown Model'}
                </p>
              </div>
            </div>

            <div style={{
              padding: '20px',
              background: '#f5f5f5',
              borderRadius: '8px',
              marginBottom: '32px'
            }}>
              <p style={{
                fontSize: '14px',
                textAlign: 'center',
                color: '#666'
              }}>
                This action will create an immutable blockchain record linking
                <strong> {selectedClient.name} </strong>
                as the verified owner of this
                <strong> {parseMetadata(selectedPassport.metadata).brand} </strong>
                product.
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  flex: 1,
                  padding: '14px',
                  border: '1px solid #e5e5e5',
                  background: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fafafa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignment}
                disabled={processing}
                style={{
                  flex: 1,
                  padding: '14px',
                  border: 'none',
                  background: '#000',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: processing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: processing ? 0.5 : 1
                }}
              >
                {processing ? 'Processing...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}