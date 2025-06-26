// frontend/src/app/sprint-1/create-passport/page.tsx
'use client';

import React, { useState, useRef } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

type Step = 'welcome' | 'role' | 'nfc' | 'basic' | 'details' | 'image' | 'review' | 'success';

interface Metadata {
  [key: string]: string;
}

interface PassportData {
  role: string;
  nfcUID: string;
  metadata: Metadata;
  imageBase64: string;
}

export default function CreatePassport() {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [passportData, setPassportData] = useState<PassportData>({
    role: '',
    nfcUID: '',
    metadata: {},
    imageBase64: ''
  });
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [createdPassportId, setCreatedPassportId] = useState<number | null>(null);

  // File input ref
  const imageInputRef = useRef<HTMLInputElement>(null);

  // User roles with better organization
  const userRoles = [
    { id: 'luxury_house', label: 'Luxury House', icon: '🏛️', description: 'Official brand representative' },
    { id: 'authorized_dealer', label: 'Authorized Dealer', icon: '🤝', description: 'Certified retailer' },
    { id: 'auction_house', label: 'Auction House', icon: '🔨', description: 'Licensed auctioneer' },
    { id: 'marketplace', label: 'Marketplace', icon: '🏪', description: 'Verified platform' },
    { id: 'aucta_admin', label: 'AUCTA Admin', icon: '👑', description: 'System administrator' },
    { id: 'independent_collector', label: 'Collector', icon: '💎', description: 'Private owner' }
  ];

  // Navigation
  const steps: Step[] = ['welcome', 'role', 'nfc', 'basic', 'details', 'image', 'review', 'success'];
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

  // Progress indicator
  const ProgressIndicator = () => {
    const totalSteps = 6; // Excluding welcome and success
    let currentProgress = 0;
    
    if (currentStep === 'role') currentProgress = 1;
    else if (currentStep === 'nfc') currentProgress = 2;
    else if (currentStep === 'basic') currentProgress = 3;
    else if (currentStep === 'details') currentProgress = 4;
    else if (currentStep === 'image') currentProgress = 5;
    else if (currentStep === 'review') currentProgress = 6;

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
            {[1, 2, 3, 4, 5, 6].map((step) => (
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
                    if (step === 1) goToStep('role');
                    else if (step === 2) goToStep('nfc');
                    else if (step === 3) goToStep('basic');
                    else if (step === 4) goToStep('details');
                    else if (step === 5) goToStep('image');
                  }
                }}>
                  {step < currentProgress ? '✓' : step}
                </div>
                {step < 6 && (
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
            <span>Role</span>
            <span>NFC</span>
            <span>Basic Info</span>
            <span>Details</span>
            <span>Image</span>
            <span>Review</span>
          </div>
        </div>
      </div>
    );
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProductImage(file);
        setImagePreviewUrl(e.target?.result as string);
        setPassportData({ ...passportData, imageBase64: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit passport
  const submitPassport = async () => {
    setProcessing(true);
    try {
      const metadata = {
        ...passportData.metadata,
        created_by_role: passportData.role,
        created_at: new Date().toISOString(),
        product_image: passportData.imageBase64
      };

      const result = await api.createPassport(passportData.nfcUID, metadata);
      setCreatedPassportId(result.passport.id);
      goToStep('success');
    } catch (error) {
      console.error('Error creating passport:', error);
      alert('Error creating passport. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Welcome screen
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
              STEP 02 OF 04
            </p>
            <h1 style={{
              fontSize: '64px',
              fontWeight: 300,
              letterSpacing: '-0.03em',
              lineHeight: 0.9,
              marginBottom: '32px'
            }}>
              Create Digital
              <br />
              <span style={{ fontWeight: 500 }}>Passport</span>
            </h1>
            <p style={{
              fontSize: '20px',
              color: '#666',
              lineHeight: 1.6,
              marginBottom: '48px',
              maxWidth: '600px',
              margin: '0 auto 48px'
            }}>
              Establish a permanent digital identity for a luxury item, 
              creating an immutable record on the blockchain.
            </p>
            
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '40px',
              marginBottom: '48px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: '#fafafa',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: '24px'
                }}>
                  🔐
                </div>
                <p style={{ fontSize: '14px', color: '#666' }}>Blockchain Security</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: '#fafafa',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: '24px'
                }}>
                  📱
                </div>
                <p style={{ fontSize: '14px', color: '#666' }}>NFC Integration</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: '#fafafa',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: '24px'
                }}>
                  🌐
                </div>
                <p style={{ fontSize: '14px', color: '#666' }}>Global Network</p>
              </div>
            </div>
            
            <button
              onClick={() => goToStep('role')}
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
              Begin Creation
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Role selection
  if (currentStep === 'role') {
    return (
      <Layout>
        <ProgressIndicator />
        <div style={{
          minHeight: 'calc(100vh - 200px)',
          padding: '60px 40px'
        }}>
          <div style={{
            maxWidth: '1000px',
            margin: '0 auto'
          }}>
            <h2 style={{
              fontSize: '40px',
              fontWeight: 300,
              marginBottom: '16px'
            }}>
              Select Your Role
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#666',
              marginBottom: '48px'
            }}>
              Your role determines the verification level and permissions for this passport.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {userRoles.map(role => (
                <button
                  key={role.id}
                  onClick={() => {
                    setPassportData({ ...passportData, role: role.id });
                    nextStep();
                  }}
                  style={{
                    background: 'white',
                    border: '2px solid #e5e5e5',
                    borderRadius: '12px',
                    padding: '32px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '20px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#000';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e5e5';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    fontSize: '32px',
                    flexShrink: 0
                  }}>
                    {role.icon}
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: 500,
                      marginBottom: '4px'
                    }}>
                      {role.label}
                    </h3>
                    <p style={{
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      {role.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>

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
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // NFC UID
  if (currentStep === 'nfc') {
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
              NFC Chip Identification
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#666',
              marginBottom: '48px'
            }}>
              Enter the unique identifier from the NFC chip embedded in the product.
            </p>

            <div style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '16px',
              padding: '48px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '120px',
                height: '120px',
                background: '#fafafa',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 32px',
                fontSize: '48px',
                position: 'relative'
              }}>
                <span>📡</span>
                <div style={{
                  position: 'absolute',
                  inset: '-20px',
                  border: '2px solid #e5e5e5',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite'
                }} />
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: '8px'
                }}>
                  NFC UID
                </label>
                <input
                  type="text"
                  value={passportData.nfcUID}
                  onChange={(e) => setPassportData({ ...passportData, nfcUID: e.target.value })}
                  placeholder="e.g., 04:E1:2C:A9:B3:4D:80"
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    fontFamily: 'monospace',
                    border: '2px solid #e5e5e5',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    textAlign: 'center'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              <p style={{
                fontSize: '14px',
                color: '#666',
                lineHeight: 1.6
              }}>
                This unique identifier permanently links the digital passport to the physical item.
              </p>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '48px'
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
                  if (passportData.nfcUID.length >= 6) {
                    nextStep();
                  } else {
                    alert('Please enter a valid NFC UID (at least 6 characters)');
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

  // Basic information
  if (currentStep === 'basic') {
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
              Basic Information
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#666',
              marginBottom: '48px'
            }}>
              Provide the essential details about the luxury item.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px'
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
                  Brand Name *
                </label>
                <input
                  type="text"
                  value={passportData.metadata.brand || ''}
                  onChange={(e) => setPassportData({
                    ...passportData,
                    metadata: { ...passportData.metadata, brand: e.target.value }
                  })}
                  placeholder="e.g., Rolex, Louis Vuitton, Hermès"
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
                  Product Name *
                </label>
                <input
                  type="text"
                  value={passportData.metadata.object_name || ''}
                  onChange={(e) => setPassportData({
                    ...passportData,
                    metadata: { ...passportData.metadata, object_name: e.target.value }
                  })}
                  placeholder="e.g., Submariner, Neverfull MM, Birkin 30"
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
                  Collection Year
                </label>
                <input
                  type="text"
                  value={passportData.metadata.collection_year || ''}
                  onChange={(e) => setPassportData({
                    ...passportData,
                    metadata: { ...passportData.metadata, collection_year: e.target.value }
                  })}
                  placeholder="e.g., 2023"
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
                  Serial Number
                </label>
                <input
                  type="text"
                  value={passportData.metadata.serial_number || ''}
                  onChange={(e) => setPassportData({
                    ...passportData,
                    metadata: { ...passportData.metadata, serial_number: e.target.value }
                  })}
                  placeholder="e.g., 116610LN"
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
                  Description
                </label>
                <textarea
                  value={passportData.metadata.description || ''}
                  onChange={(e) => setPassportData({
                    ...passportData,
                    metadata: { ...passportData.metadata, description: e.target.value }
                  })}
                  placeholder="Provide a detailed description of the item..."
                  rows={4}
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
              justifyContent: 'space-between',
              marginTop: '48px'
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
                  if (passportData.metadata.brand && passportData.metadata.object_name) {
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

  // Additional details
  if (currentStep === 'details') {
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
              Additional Details
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#666',
              marginBottom: '48px'
            }}>
              Optional information to enhance the passport's completeness.
            </p>

            <div style={{ marginBottom: '40px' }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 500,
                marginBottom: '24px'
              }}>
                Physical Characteristics
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    color: '#666',
                    marginBottom: '8px'
                  }}>
                    Dimensions
                  </label>
                  <input
                    type="text"
                    value={passportData.metadata.dimensions || ''}
                    onChange={(e) => setPassportData({
                      ...passportData,
                      metadata: { ...passportData.metadata, dimensions: e.target.value }
                    })}
                    placeholder="e.g., 40mm x 12.5mm"
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
                    Weight
                  </label>
                  <input
                    type="text"
                    value={passportData.metadata.weight || ''}
                    onChange={(e) => setPassportData({
                      ...passportData,
                      metadata: { ...passportData.metadata, weight: e.target.value }
                    })}
                    placeholder="e.g., 155g"
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
                    Main Color
                  </label>
                  <input
                    type="text"
                    value={passportData.metadata.main_color || ''}
                    onChange={(e) => setPassportData({
                      ...passportData,
                      metadata: { ...passportData.metadata, main_color: e.target.value }
                    })}
                    placeholder="e.g., Black, Gold, Silver"
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
                    Materials
                  </label>
                  <input
                    type="text"
                    value={passportData.metadata.main_materials || ''}
                    onChange={(e) => setPassportData({
                      ...passportData,
                      metadata: { ...passportData.metadata, main_materials: e.target.value }
                    })}
                    placeholder="e.g., Stainless Steel, Leather"
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
              </div>
            </div>

            <div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 500,
                marginBottom: '24px'
              }}>
                Commercial Information
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    color: '#666',
                    marginBottom: '8px'
                  }}>
                    Original Price
                  </label>
                  <input
                    type="text"
                    value={passportData.metadata.original_price || ''}
                    onChange={(e) => setPassportData({
                      ...passportData,
                      metadata: { ...passportData.metadata, original_price: e.target.value }
                    })}
                    placeholder="e.g., $12,500"
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
                    Edition Info
                  </label>
                  <input
                    type="text"
                    value={passportData.metadata.edition_info || ''}
                    onChange={(e) => setPassportData({
                      ...passportData,
                      metadata: { ...passportData.metadata, edition_info: e.target.value }
                    })}
                    placeholder="e.g., Limited to 500 pieces"
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
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '48px'
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
                onClick={nextStep}
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

  // Product image
  if (currentStep === 'image') {
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
              Product Image
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#666',
              marginBottom: '48px'
            }}>
              Upload a high-quality photograph of the luxury item.
            </p>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />

            <div
              onClick={() => imageInputRef.current?.click()}
              style={{
                background: 'white',
                border: '2px dashed #e5e5e5',
                borderRadius: '16px',
                padding: imagePreviewUrl ? '24px' : '80px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!imagePreviewUrl) {
                  e.currentTarget.style.borderColor = '#000';
                  e.currentTarget.style.background = '#fafafa';
                }
              }}
              onMouseLeave={(e) => {
                if (!imagePreviewUrl) {
                  e.currentTarget.style.borderColor = '#e5e5e5';
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              {!imagePreviewUrl ? (
                <>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '24px'
                  }}>
                    📷
                  </div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: 500,
                    marginBottom: '8px'
                  }}>
                    Click to upload image
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#666'
                  }}>
                    JPG, PNG up to 10MB • Minimum 1000x1000px
                  </p>
                </>
              ) : (
                <div>
                  <img
                    src={imagePreviewUrl}
                    alt="Product preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '400px',
                      borderRadius: '8px',
                      marginBottom: '24px'
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProductImage(null);
                      setImagePreviewUrl('');
                      setPassportData({ ...passportData, imageBase64: '' });
                    }}
                    style={{
                      padding: '10px 24px',
                      border: '1px solid #e5e5e5',
                      background: 'white',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Remove Image
                  </button>
                </div>
              )}
            </div>

            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: '#fafafa',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#666',
              lineHeight: 1.6
            }}>
              <strong>Tips for best results:</strong>
              <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
                <li>Use natural lighting or professional photography</li>
                <li>Include the entire product in frame</li>
                <li>Ensure serial numbers are visible if applicable</li>
                <li>Avoid filters or heavy editing</li>
              </ul>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '48px'
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
                  if (imagePreviewUrl) {
                    nextStep();
                  } else {
                    alert('Please upload a product image');
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

  // Review
  if (currentStep === 'review') {
    const selectedRole = userRoles.find(r => r.id === passportData.role);
    
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
              Review Passport
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#666',
              marginBottom: '48px'
            }}>
              Please review all information before creating the passport.
            </p>

            <div style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '16px',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                padding: '32px',
                borderBottom: '1px solid #e5e5e5',
                background: '#fafafa'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}>
                  <div>
                    <h3 style={{
                      fontSize: '28px',
                      fontWeight: 300,
                      marginBottom: '8px'
                    }}>
                      {passportData.metadata.brand} {passportData.metadata.object_name}
                    </h3>
                    <p style={{
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      Digital Passport • UID: {passportData.nfcUID}
                    </p>
                  </div>
                  <div style={{
                    textAlign: 'right'
                  }}>
                    <p style={{
                      fontSize: '12px',
                      color: '#666',
                      marginBottom: '4px'
                    }}>
                      Created by
                    </p>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: 500
                    }}>
                      {selectedRole?.label}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: imagePreviewUrl ? '1fr 1fr' : '1fr',
                gap: '32px',
                padding: '32px'
              }}>
                {imagePreviewUrl && (
                  <div>
                    <img
                      src={imagePreviewUrl}
                      alt="Product"
                      style={{
                        width: '100%',
                        borderRadius: '8px'
                      }}
                    />
                  </div>
                )}

                <div>
                  {/* Basic Info */}
                  <div style={{ marginBottom: '32px' }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: 500,
                      marginBottom: '16px'
                    }}>
                      Basic Information
                    </h4>
                    <div style={{ fontSize: '14px' }}>
                      {passportData.metadata.collection_year && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: '1px solid #f5f5f5'
                        }}>
                          <span style={{ color: '#666' }}>Collection Year</span>
                          <span>{passportData.metadata.collection_year}</span>
                        </div>
                      )}
                      {passportData.metadata.serial_number && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: '1px solid #f5f5f5'
                        }}>
                          <span style={{ color: '#666' }}>Serial Number</span>
                          <span>{passportData.metadata.serial_number}</span>
                        </div>
                      )}
                      {passportData.metadata.description && (
                        <div style={{
                          padding: '8px 0'
                        }}>
                          <span style={{ color: '#666', display: 'block', marginBottom: '4px' }}>Description</span>
                          <span style={{ lineHeight: 1.6 }}>{passportData.metadata.description}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Physical Characteristics */}
                  {(passportData.metadata.dimensions || passportData.metadata.weight || 
                    passportData.metadata.main_color || passportData.metadata.main_materials) && (
                    <div style={{ marginBottom: '32px' }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: 500,
                        marginBottom: '16px'
                      }}>
                        Physical Characteristics
                      </h4>
                      <div style={{ fontSize: '14px' }}>
                        {passportData.metadata.dimensions && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 0',
                            borderBottom: '1px solid #f5f5f5'
                          }}>
                            <span style={{ color: '#666' }}>Dimensions</span>
                            <span>{passportData.metadata.dimensions}</span>
                          </div>
                        )}
                        {passportData.metadata.weight && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 0',
                            borderBottom: '1px solid #f5f5f5'
                          }}>
                            <span style={{ color: '#666' }}>Weight</span>
                            <span>{passportData.metadata.weight}</span>
                          </div>
                        )}
                        {passportData.metadata.main_color && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 0',
                            borderBottom: '1px solid #f5f5f5'
                          }}>
                            <span style={{ color: '#666' }}>Main Color</span>
                            <span>{passportData.metadata.main_color}</span>
                          </div>
                        )}
                        {passportData.metadata.main_materials && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 0'
                          }}>
                            <span style={{ color: '#666' }}>Materials</span>
                            <span>{passportData.metadata.main_materials}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Commercial Info */}
                  {(passportData.metadata.original_price || passportData.metadata.edition_info) && (
                    <div>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: 500,
                        marginBottom: '16px'
                      }}>
                        Commercial Information
                      </h4>
                      <div style={{ fontSize: '14px' }}>
                        {passportData.metadata.original_price && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 0',
                            borderBottom: '1px solid #f5f5f5'
                          }}>
                            <span style={{ color: '#666' }}>Original Price</span>
                            <span>{passportData.metadata.original_price}</span>
                          </div>
                        )}
                        {passportData.metadata.edition_info && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 0'
                          }}>
                            <span style={{ color: '#666' }}>Edition</span>
                            <span>{passportData.metadata.edition_info}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '24px 32px',
                background: '#fafafa',
                borderTop: '1px solid #e5e5e5',
                textAlign: 'center',
                fontSize: '14px',
                color: '#666'
              }}>
                This passport will be permanently recorded on the AUCTA blockchain
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '48px'
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
                onClick={submitPassport}
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
                {processing ? 'Creating Passport...' : 'Create Passport'}
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Success
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
              Passport Created
            </h1>
            <p style={{
              fontSize: '20px',
              color: '#666',
              marginBottom: '40px',
              lineHeight: 1.6
            }}>
              The digital passport has been successfully created and recorded on the blockchain.
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
                Passport ID
              </p>
              <p style={{
                fontSize: '32px',
                fontFamily: 'monospace',
                fontWeight: 300
              }}>
                #{String(createdPassportId).padStart(6, '0')}
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => window.location.href = '/sprint-1/assign-passport'}
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
                Assign to Owner
              </button>
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
                Create Another
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Add keyframe animation for pulse
  return (
    <>
      <style>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.5;
          }
          100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}