// frontend/src/app/sprint-1/register-client/page.tsx
'use client';

import React, { useState, useRef } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

type Step = 'welcome' | 'search' | 'identity' | 'documents' | 'wallet' | 'review' | 'success';

interface FormData {
  // Personal Information
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  citizenship: string;
  secondaryCitizenship: string;
  
  // Contact Information
  email: string;
  phone: string;
  address: string;
  
  // Wallet
  walletOption: 'generate' | 'existing' | null;
  walletAddress: string;
}

interface UploadedFiles {
  govId: File | null;
  proofAddress: File | null;
  selfie: File | null;
}

interface UploadedFilesBase64 {
  govId: string | null;
  proofAddress: string | null;
  selfie: string | null;
}

export default function RegisterClient() {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [existingClient, setExistingClient] = useState<any>(null);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    dateOfBirth: '',
    placeOfBirth: '',
    citizenship: '',
    secondaryCitizenship: '',
    email: '',
    phone: '',
    address: '',
    walletOption: null,
    walletAddress: ''
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({
    govId: null,
    proofAddress: null,
    selfie: null
  });
  const [uploadedFilesBase64, setUploadedFilesBase64] = useState<UploadedFilesBase64>({
    govId: null,
    proofAddress: null,
    selfie: null
  });
  const [processing, setProcessing] = useState(false);
  const [newClientId, setNewClientId] = useState<number | null>(null);

  // File input refs
  const govIdRef = useRef<HTMLInputElement>(null);
  const proofAddressRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  // Step navigation
  const steps: Step[] = ['welcome', 'search', 'identity', 'documents', 'wallet', 'review', 'success'];
  const currentStepIndex = steps.indexOf(currentStep);
  
  const goToStep = (step: Step) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      goToStep(steps[currentStepIndex + 1]);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      goToStep(steps[currentStepIndex - 1]);
    }
  };

  // Search for existing client
  const searchClient = async () => {
    if (searchTerm.length < 3) return;

    setSearchLoading(true);
    try {
      const clients = await api.getClients();
      const found = clients.find((client: any) => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.id.toString() === searchTerm ||
        (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      if (found) {
        setExistingClient(found);
      } else {
        setExistingClient(null);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Generate wallet
  const generateWallet = () => {
    const chars = '0123456789abcdef';
    let wallet = '0x';
    for (let i = 0; i < 40; i++) {
      wallet += chars[Math.floor(Math.random() * chars.length)];
    }
    setFormData({ ...formData, walletAddress: wallet, walletOption: 'generate' });
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fileType: keyof UploadedFiles) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFiles(prev => ({ ...prev, [fileType]: file }));
      
      // Convert to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedFilesBase64(prev => ({ 
          ...prev, 
          [fileType]: event.target?.result as string 
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit registration
  const submitRegistration = async () => {
    setProcessing(true);
    try {
      const kycInfo = {
        dateOfBirth: formData.dateOfBirth,
        placeOfBirth: formData.placeOfBirth,
        citizenship: formData.citizenship,
        secondaryCitizenship: formData.secondaryCitizenship,
        address: formData.address,
        email: formData.email,
        phone: formData.phone,
        documents: {
          govId: uploadedFiles.govId?.name,
          proofAddress: uploadedFiles.proofAddress?.name,
          selfie: uploadedFiles.selfie?.name
        },
        verificationDate: new Date().toISOString(),
        verificationMethod: 'Manual KYC',
        documentType: 'Government ID',
        status: 'VERIFIED'
      };

      const result = await api.registerClientWithSelfie(
        formData.fullName,
        formData.walletAddress,
        kycInfo,
        uploadedFilesBase64.selfie!
      );
      
      setNewClientId(result.clientId);
      goToStep('success');
    } catch (error: any) {
      console.error('Registration error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // Progress indicator
  const ProgressIndicator = () => {
    const totalSteps = 5; // Excluding welcome and success
    let currentProgress = 0;
    
    if (currentStep === 'search') currentProgress = 1;
    else if (currentStep === 'identity') currentProgress = 2;
    else if (currentStep === 'documents') currentProgress = 3;
    else if (currentStep === 'wallet') currentProgress = 4;
    else if (currentStep === 'review') currentProgress = 5;

    if (currentStep === 'welcome' || currentStep === 'success') return null;

    return (
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e5e5e5',
        padding: '20px 0'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 40px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {[1, 2, 3, 4, 5].map((step) => (
              <React.Fragment key={step}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: step <= currentProgress ? '#000' : '#e5e5e5',
                  color: step <= currentProgress ? '#fff' : '#999',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: step < currentProgress ? 'pointer' : 'default',
                  transition: 'all 0.3s'
                }}
                onClick={() => {
                  if (step < currentProgress) {
                    if (step === 1) goToStep('search');
                    else if (step === 2) goToStep('identity');
                    else if (step === 3) goToStep('documents');
                    else if (step === 4) goToStep('wallet');
                  }
                }}>
                  {step < currentProgress ? '✓' : step}
                </div>
                {step < 5 && (
                  <div style={{
                    flex: 1,
                    height: '2px',
                    background: step < currentProgress ? '#000' : '#e5e5e5',
                    transition: 'all 0.3s'
                  }} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '12px',
            fontSize: '12px',
            color: '#666'
          }}>
            <span>Search</span>
            <span>Identity</span>
            <span>Documents</span>
            <span>Wallet</span>
            <span>Review</span>
          </div>
        </div>
      </div>
    );
  };

  // Render welcome screen
  if (currentStep === 'welcome') {
    return (
      <Layout>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px'
        }}>
          <div style={{
            maxWidth: '800px',
            textAlign: 'center'
          }}>
            <p style={{
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#666',
              marginBottom: '24px'
            }}>
              STEP 01 OF 04
            </p>
            <h1 style={{
              fontSize: '64px',
              fontWeight: 300,
              letterSpacing: '-0.03em',
              lineHeight: 0.9,
              marginBottom: '32px'
            }}>
              Register a
              <br />
              <span style={{ fontWeight: 500 }}>Custodian</span>
            </h1>
            <p style={{
              fontSize: '20px',
              color: '#666',
              lineHeight: 1.6,
              marginBottom: '48px',
              maxWidth: '600px',
              margin: '0 auto 48px'
            }}>
              Begin the identity verification process to become a trusted guardian 
              of luxury assets on the AUCTA blockchain.
            </p>
            <button
              onClick={() => goToStep('search')}
              style={{
                background: '#000',
                color: '#fff',
                border: 'none',
                padding: '16px 48px',
                fontSize: '16px',
                fontWeight: 400,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Begin Registration
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Render search screen
  if (currentStep === 'search') {
    return (
      <Layout>
        <ProgressIndicator />
        <div style={{
          minHeight: 'calc(100vh - 200px)',
          padding: '60px 40px'
        }}>
          <div style={{
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <h2 style={{
              fontSize: '40px',
              fontWeight: 300,
              marginBottom: '16px'
            }}>
              Check Existing Records
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#666',
              marginBottom: '48px'
            }}>
              First, let's verify if this custodian already exists in our system.
            </p>

            <div style={{ marginBottom: '40px' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value.length >= 3) {
                    searchClient();
                  }
                }}
                placeholder="Search by name, email, or ID..."
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  fontSize: '16px',
                  border: '2px solid #e5e5e5',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#000'}
                onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
              />
              <p style={{
                fontSize: '14px',
                color: '#666',
                marginTop: '8px'
              }}>
                Enter at least 3 characters to search
              </p>
            </div>

            {searchLoading && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: '#666'
              }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '16px' }}>Searching...</p>
              </div>
            )}

            {existingClient && (
              <div style={{
                background: '#fafafa',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '32px'
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 500,
                  marginBottom: '16px'
                }}>
                  Client Found
                </h3>
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontWeight: 500 }}>{existingClient.name}</p>
                  <p style={{ color: '#666', fontSize: '14px' }}>{existingClient.email}</p>
                  <p style={{ color: '#666', fontSize: '12px', fontFamily: 'monospace' }}>
                    ID: AUCTA-{String(existingClient.id).padStart(6, '0')}
                  </p>
                </div>
                <div style={{
                  padding: '12px',
                  background: '#e8f5e9',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#2e7d32'
                }}>
                  ✓ KYC Verified
                </div>
              </div>
            )}

            {searchTerm.length >= 3 && !searchLoading && !existingClient && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                background: '#fafafa',
                borderRadius: '12px',
                marginBottom: '32px'
              }}>
                <p style={{ color: '#666' }}>
                  No existing client found with "{searchTerm}"
                </p>
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '48px'
            }}>
              <button
                onClick={() => goToStep('welcome')}
                style={{
                  padding: '14px 32px',
                  border: '1px solid #e5e5e5',
                  background: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Back
              </button>
              <button
                onClick={() => goToStep('identity')}
                disabled={existingClient !== null}
                style={{
                  padding: '14px 32px',
                  border: 'none',
                  background: existingClient ? '#e5e5e5' : '#000',
                  color: existingClient ? '#999' : '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: existingClient ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Register New Client
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Render identity screen
  if (currentStep === 'identity') {
    return (
      <Layout>
        <ProgressIndicator />
        <div style={{
          minHeight: 'calc(100vh - 200px)',
          padding: '60px 40px'
        }}>
          <div style={{
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <h2 style={{
              fontSize: '40px',
              fontWeight: 300,
              marginBottom: '16px'
            }}>
              Personal Information
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#666',
              marginBottom: '48px'
            }}>
              Provide the custodian's identity details as they appear on official documents.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '48px'
            }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '8px'
                }}>
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="As it appears on government ID"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '8px'
                }}>
                  Date of Birth *
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '8px'
                }}>
                  Place of Birth *
                </label>
                <input
                  type="text"
                  value={formData.placeOfBirth}
                  onChange={(e) => setFormData({ ...formData, placeOfBirth: e.target.value })}
                  placeholder="City, Country"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '8px'
                }}>
                  Primary Citizenship *
                </label>
                <input
                  type="text"
                  value={formData.citizenship}
                  onChange={(e) => setFormData({ ...formData, citizenship: e.target.value })}
                  placeholder="Country"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '8px'
                }}>
                  Secondary Citizenship
                </label>
                <input
                  type="text"
                  value={formData.secondaryCitizenship}
                  onChange={(e) => setFormData({ ...formData, secondaryCitizenship: e.target.value })}
                  placeholder="If applicable"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '8px'
                }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Primary contact email"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '8px'
                }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Include country code"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '8px'
                }}>
                  Residential Address *
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full address including street, city, state/province, postal code, country"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    resize: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={prevStep}
                style={{
                  padding: '14px 32px',
                  border: '1px solid #e5e5e5',
                  background: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Back
              </button>
              <button
                onClick={() => {
                  const required = formData.fullName && formData.dateOfBirth && 
                                 formData.placeOfBirth && formData.citizenship && 
                                 formData.address && formData.email;
                  if (required) {
                    nextStep();
                  } else {
                    alert('Please fill in all required fields');
                  }
                }}
                style={{
                  padding: '14px 32px',
                  border: 'none',
                  background: '#000',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Render documents screen
  if (currentStep === 'documents') {
    return (
      <Layout>
        <ProgressIndicator />
        <div style={{
          minHeight: 'calc(100vh - 200px)',
          padding: '60px 40px'
        }}>
          <div style={{
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <h2 style={{
              fontSize: '40px',
              fontWeight: 300,
              marginBottom: '16px'
            }}>
              Identity Verification
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#666',
              marginBottom: '48px'
            }}>
              Upload required documents for KYC verification.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '48px'
            }}>
              {/* Government ID */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '12px'
                }}>
                  Government-Issued ID *
                </label>
                <input
                  ref={govIdRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileUpload(e, 'govId')}
                  style={{ display: 'none' }}
                />
                <div
                  onClick={() => govIdRef.current?.click()}
                  style={{
                    border: `2px dashed ${uploadedFiles.govId ? '#00a000' : '#e5e5e5'}`,
                    borderRadius: '12px',
                    padding: '40px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: uploadedFiles.govId ? '#f0fff4' : 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (!uploadedFiles.govId) {
                      e.currentTarget.style.borderColor = '#000';
                      e.currentTarget.style.background = '#fafafa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!uploadedFiles.govId) {
                      e.currentTarget.style.borderColor = '#e5e5e5';
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                    {uploadedFiles.govId ? '✓' : '📄'}
                  </div>
                  <p style={{
                    fontSize: '14px',
                    color: uploadedFiles.govId ? '#00a000' : '#666'
                  }}>
                    {uploadedFiles.govId ? uploadedFiles.govId.name : 'Passport or National ID'}
                  </p>
                </div>
              </div>

              {/* Proof of Address */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '12px'
                }}>
                  Proof of Address *
                </label>
                <input
                  ref={proofAddressRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileUpload(e, 'proofAddress')}
                  style={{ display: 'none' }}
                />
                <div
                  onClick={() => proofAddressRef.current?.click()}
                  style={{
                    border: `2px dashed ${uploadedFiles.proofAddress ? '#00a000' : '#e5e5e5'}`,
                    borderRadius: '12px',
                    padding: '40px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: uploadedFiles.proofAddress ? '#f0fff4' : 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (!uploadedFiles.proofAddress) {
                      e.currentTarget.style.borderColor = '#000';
                      e.currentTarget.style.background = '#fafafa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!uploadedFiles.proofAddress) {
                      e.currentTarget.style.borderColor = '#e5e5e5';
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                    {uploadedFiles.proofAddress ? '✓' : '🏠'}
                  </div>
                  <p style={{
                    fontSize: '14px',
                    color: uploadedFiles.proofAddress ? '#00a000' : '#666'
                  }}>
                    {uploadedFiles.proofAddress ? uploadedFiles.proofAddress.name : 'Utility Bill or Bank Statement'}
                  </p>
                </div>
              </div>

              {/* Selfie */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '12px'
                }}>
                  Live Verification Photo *
                </label>
                <input
                  ref={selfieRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'selfie')}
                  style={{ display: 'none' }}
                />
                <div
                  onClick={() => selfieRef.current?.click()}
                  style={{
                    border: `2px dashed ${uploadedFiles.selfie ? '#00a000' : '#e5e5e5'}`,
                    borderRadius: '12px',
                    padding: '40px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: uploadedFiles.selfie ? '#f0fff4' : 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (!uploadedFiles.selfie) {
                      e.currentTarget.style.borderColor = '#000';
                      e.currentTarget.style.background = '#fafafa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!uploadedFiles.selfie) {
                      e.currentTarget.style.borderColor = '#e5e5e5';
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  {uploadedFilesBase64.selfie ? (
                    <div>
                      <img
                        src={uploadedFilesBase64.selfie}
                        alt="Selfie preview"
                        style={{
                          maxWidth: '200px',
                          maxHeight: '200px',
                          borderRadius: '8px',
                          marginBottom: '12px'
                        }}
                      />
                      <p style={{ fontSize: '14px', color: '#00a000' }}>
                        {uploadedFiles.selfie?.name}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📸</div>
                      <p style={{ fontSize: '14px', color: '#666' }}>
                        Clear photo of the custodian
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={prevStep}
                style={{
                  padding: '14px 32px',
                  border: '1px solid #e5e5e5',
                  background: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (uploadedFiles.govId && uploadedFiles.proofAddress && uploadedFiles.selfie) {
                    nextStep();
                  } else {
                    alert('Please upload all required documents');
                  }
                }}
                style={{
                  padding: '14px 32px',
                  border: 'none',
                  background: '#000',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Render wallet screen
  if (currentStep === 'wallet') {
    return (
      <Layout>
        <ProgressIndicator />
        <div style={{
          minHeight: 'calc(100vh - 200px)',
          padding: '60px 40px'
        }}>
          <div style={{
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <h2 style={{
              fontSize: '40px',
              fontWeight: 300,
              marginBottom: '16px'
            }}>
              Digital Wallet Setup
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#666',
              marginBottom: '48px'
            }}>
              Configure the blockchain wallet for asset management.
            </p>

            <div style={{ marginBottom: '32px' }}>
              <button
                onClick={() => {
                  setFormData({ ...formData, walletOption: 'generate' });
                  generateWallet();
                }}
                style={{
                  width: '100%',
                  padding: '24px',
                  border: `2px solid ${formData.walletOption === 'generate' ? '#000' : '#e5e5e5'}`,
                  background: formData.walletOption === 'generate' ? '#fafafa' : 'white',
                  borderRadius: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: '16px'
                }}
              >
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 500,
                  marginBottom: '8px'
                }}>
                  Generate New Wallet
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#666'
                }}>
                  Create a new secure wallet address within AUCTA
                </p>
              </button>

              <button
                onClick={() => setFormData({ ...formData, walletOption: 'existing' })}
                style={{
                  width: '100%',
                  padding: '24px',
                  border: `2px solid ${formData.walletOption === 'existing' ? '#000' : '#e5e5e5'}`,
                  background: formData.walletOption === 'existing' ? '#fafafa' : 'white',
                  borderRadius: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 500,
                  marginBottom: '8px'
                }}>
                  Use Existing Wallet
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#666'
                }}>
                  Link an existing Ethereum-compatible wallet
                </p>
              </button>
            </div>

            {formData.walletOption === 'generate' && formData.walletAddress && (
              <div style={{
                padding: '24px',
                background: '#fafafa',
                borderRadius: '12px',
                marginBottom: '32px'
              }}>
                <p style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '12px'
                }}>
                  Generated Wallet Address
                </p>
                <p style={{
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  wordBreak: 'break-all',
                  lineHeight: 1.6
                }}>
                  {formData.walletAddress}
                </p>
                <button
                  onClick={() => navigator.clipboard.writeText(formData.walletAddress)}
                  style={{
                    marginTop: '12px',
                    padding: '8px 16px',
                    border: '1px solid #e5e5e5',
                    background: 'white',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Copy Address
                </button>
              </div>
            )}

            {formData.walletOption === 'existing' && (
              <div style={{ marginBottom: '32px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '8px'
                }}>
                  Wallet Address *
                </label>
                <input
                  type="text"
                  value={formData.walletAddress}
                  onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                  placeholder="0x..."
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={prevStep}
                style={{
                  padding: '14px 32px',
                  border: '1px solid #e5e5e5',
                  background: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (formData.walletOption && formData.walletAddress) {
                    nextStep();
                  } else {
                    alert('Please configure a wallet');
                  }
                }}
                style={{
                  padding: '14px 32px',
                  border: 'none',
                  background: '#000',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Render review screen
  if (currentStep === 'review') {
    return (
      <Layout>
        <ProgressIndicator />
        <div style={{
          minHeight: 'calc(100vh - 200px)',
          padding: '60px 40px'
        }}>
          <div style={{
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <h2 style={{
              fontSize: '40px',
              fontWeight: 300,
              marginBottom: '16px'
            }}>
              Review & Confirm
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#666',
              marginBottom: '48px'
            }}>
              Please review all information before submitting.
            </p>

            {/* Identity Summary */}
            <div style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '12px',
              padding: '32px',
              marginBottom: '24px'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 500,
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                Personal Information
                <button
                  onClick={() => goToStep('identity')}
                  style={{
                    fontSize: '14px',
                    color: '#666',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Edit
                </button>
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
                fontSize: '14px'
              }}>
                <div>
                  <p style={{ color: '#666', marginBottom: '4px' }}>Full Name</p>
                  <p style={{ fontWeight: 500 }}>{formData.fullName}</p>
                </div>
                <div>
                  <p style={{ color: '#666', marginBottom: '4px' }}>Date of Birth</p>
                  <p style={{ fontWeight: 500 }}>{new Date(formData.dateOfBirth).toLocaleDateString()}</p>
                </div>
                <div>
                  <p style={{ color: '#666', marginBottom: '4px' }}>Place of Birth</p>
                  <p style={{ fontWeight: 500 }}>{formData.placeOfBirth}</p>
                </div>
                <div>
                  <p style={{ color: '#666', marginBottom: '4px' }}>Citizenship</p>
                  <p style={{ fontWeight: 500 }}>
                    {formData.citizenship}
                    {formData.secondaryCitizenship && ` / ${formData.secondaryCitizenship}`}
                  </p>
                </div>
                <div>
                  <p style={{ color: '#666', marginBottom: '4px' }}>Email</p>
                  <p style={{ fontWeight: 500 }}>{formData.email}</p>
                </div>
                <div>
                  <p style={{ color: '#666', marginBottom: '4px' }}>Phone</p>
                  <p style={{ fontWeight: 500 }}>{formData.phone || 'Not provided'}</p>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <p style={{ color: '#666', marginBottom: '4px' }}>Address</p>
                  <p style={{ fontWeight: 500 }}>{formData.address}</p>
                </div>
              </div>
            </div>

            {/* Documents Summary */}
            <div style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '12px',
              padding: '32px',
              marginBottom: '24px'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 500,
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                Verification Documents
                <button
                  onClick={() => goToStep('documents')}
                  style={{
                    fontSize: '14px',
                    color: '#666',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Edit
                </button>
              </h3>
              <div style={{ fontSize: '14px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <span style={{ color: '#00a000', fontSize: '18px' }}>✓</span>
                  <span style={{ color: '#666' }}>Government ID:</span>
                  <span style={{ fontWeight: 500 }}>{uploadedFiles.govId?.name}</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <span style={{ color: '#00a000', fontSize: '18px' }}>✓</span>
                  <span style={{ color: '#666' }}>Proof of Address:</span>
                  <span style={{ fontWeight: 500 }}>{uploadedFiles.proofAddress?.name}</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ color: '#00a000', fontSize: '18px' }}>✓</span>
                  <span style={{ color: '#666' }}>Live Photo:</span>
                  <span style={{ fontWeight: 500 }}>{uploadedFiles.selfie?.name}</span>
                </div>
              </div>
            </div>

            {/* Wallet Summary */}
            <div style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '12px',
              padding: '32px',
              marginBottom: '48px'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 500,
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                Digital Wallet
                <button
                  onClick={() => goToStep('wallet')}
                  style={{
                    fontSize: '14px',
                    color: '#666',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Edit
                </button>
              </h3>
              <div style={{ fontSize: '14px' }}>
                <p style={{ color: '#666', marginBottom: '4px' }}>Wallet Type</p>
                <p style={{ fontWeight: 500, marginBottom: '12px' }}>
                  {formData.walletOption === 'generate' ? 'AUCTA Generated' : 'Existing Wallet'}
                </p>
                <p style={{ color: '#666', marginBottom: '4px' }}>Wallet Address</p>
                <p style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  wordBreak: 'break-all',
                  lineHeight: 1.6,
                  background: '#fafafa',
                  padding: '12px',
                  borderRadius: '6px'
                }}>
                  {formData.walletAddress}
                </p>
              </div>
            </div>

            {/* Terms Notice */}
            <div style={{
              padding: '24px',
              background: '#fafafa',
              borderRadius: '8px',
              marginBottom: '32px',
              fontSize: '14px',
              lineHeight: 1.6
            }}>
              <p>
                By submitting this registration, you confirm that all provided information is accurate 
                and you consent to AUCTA's identity verification process. Your data will be securely 
                stored and used solely for authentication purposes within the AUCTA ecosystem.
              </p>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={prevStep}
                style={{
                  padding: '14px 32px',
                  border: '1px solid #e5e5e5',
                  background: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Back
              </button>
              <button
                onClick={submitRegistration}
                disabled={processing}
                style={{
                  padding: '14px 48px',
                  border: 'none',
                  background: processing ? '#e5e5e5' : '#000',
                  color: processing ? '#999' : '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: processing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {processing ? 'Registering...' : 'Submit Registration'}
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Render success screen
  if (currentStep === 'success') {
    return (
      <Layout>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px'
        }}>
          <div style={{
            maxWidth: '600px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: '#e8f5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 40px',
              fontSize: '60px',
              color: '#2e7d32'
            }}>
              ✓
            </div>
            <h1 style={{
              fontSize: '48px',
              fontWeight: 300,
              marginBottom: '24px'
            }}>
              Registration Complete
            </h1>
            <p style={{
              fontSize: '20px',
              color: '#666',
              marginBottom: '40px',
              lineHeight: 1.6
            }}>
              The custodian has been successfully registered and verified in the AUCTA ecosystem.
            </p>
            
            <div style={{
              padding: '32px',
              background: '#fafafa',
              borderRadius: '12px',
              marginBottom: '40px'
            }}>
              <p style={{
                fontSize: '14px',
                color: '#666',
                marginBottom: '8px'
              }}>
                Client ID
              </p>
              <p style={{
                fontSize: '32px',
                fontFamily: 'monospace',
                fontWeight: 300
              }}>
                AUCTA-{String(newClientId).padStart(6, '0')}
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '14px 32px',
                  border: '1px solid #e5e5e5',
                  background: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Register Another
              </button>
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  padding: '14px 32px',
                  border: 'none',
                  background: '#000',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return null;
}