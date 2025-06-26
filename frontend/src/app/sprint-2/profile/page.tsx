'use client';

import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Globe, Shield, Download, Edit3, Lock, Check, AlertCircle, X, ChevronRight } from 'lucide-react';

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [profile, setProfile] = useState({
    // Identity (KYC-locked)
    fullName: 'Tom Holland',
    dateOfBirth: '1985-03-15',
    placeOfBirth: 'Geneva, Switzerland',
    nationality: 'Swiss',
    clientId: '0x7a9f...3f2d',
    kycStatus: 'verified',
    
    // Contact (editable)
    email: 'tom.holland@example.com',
    phone: '+41 79 123 4567',
    preferredContact: 'email',
    
    // Address (editable)
    streetAddress: 'Rue du Rhône 114',
    zipCode: '1204',
    city: 'Geneva',
    country: 'Switzerland',
    proofOfAddressStatus: 'verified',
    
    // Preferences
    language: 'EN',
    currency: 'EUR',
    enableNotifications: true,
    allowQrAccess: true
  });

  const [editedProfile, setEditedProfile] = useState(profile);

  const handleSave = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    setProfile(editedProfile);
    setIsEditing(false);
  };

  const getKycStatusIcon = (status: string) => {
    switch(status) {
      case 'verified':
        return <Check size={16} style={{ color: '#22c55e' }} />;
      case 'pending':
        return <AlertCircle size={16} style={{ color: '#f59e0b' }} />;
      case 'rejected':
        return <X size={16} style={{ color: '#ef4444' }} />;
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Profile Header Section */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '32px' }}>
            <div>
              <h1 style={{
                fontSize: '36px',
                fontWeight: 300,
                marginBottom: '8px',
                letterSpacing: '-0.02em'
              }}>
                {profile.fullName}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', opacity: 0.9 }}>
                <span>Client ID: {profile.clientId}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }} />
                  <span>KYC Verified</span>
                </div>
              </div>
            </div>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 300
            }}>
              TH
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '32px',
            flexWrap: 'wrap'
          }}>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Member Since</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>January 2024</p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Products Owned</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>2 Items</p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Total Value</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>€4,290</p>
            </div>
          </div>
        </div>
      </div>

      {/* Identity Information Card */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        marginBottom: '24px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <User size={20} style={{ color: '#666' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Identity Information</h2>
            <span style={{
              padding: '4px 12px',
              background: '#f0fdf4',
              color: '#22c55e',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Lock size={12} />
              KYC Verified
            </span>
          </div>
          {profile.kycStatus === 'verified' && !isEditing && (
            <button
              onClick={() => setShowChangeRequest(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 0',
                transition: 'color 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#000'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
            >
              Request Change
              <ChevronRight size={16} />
            </button>
          )}
        </div>
        
        <div style={{ padding: '24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px'
          }}>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Full Name
              </label>
              <div style={{
                padding: '12px 16px',
                background: '#f5f5f5',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: '#333' }}>{profile.fullName}</span>
                <Lock size={14} style={{ color: '#999' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Date of Birth
              </label>
              <div style={{
                padding: '12px 16px',
                background: '#f5f5f5',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: '#333' }}>{new Date(profile.dateOfBirth).toLocaleDateString()}</span>
                <Lock size={14} style={{ color: '#999' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Place of Birth
              </label>
              <div style={{
                padding: '12px 16px',
                background: '#f5f5f5',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: '#333' }}>{profile.placeOfBirth}</span>
                <Lock size={14} style={{ color: '#999' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Nationality
              </label>
              <div style={{
                padding: '12px 16px',
                background: '#f5f5f5',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: '#333' }}>{profile.nationality}</span>
                <Lock size={14} style={{ color: '#999' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information Card */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        marginBottom: '24px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Mail size={20} style={{ color: '#666' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Contact Information</h2>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 0',
                transition: 'color 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#000'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
            >
              Edit
              <Edit3 size={16} />
            </button>
          )}
        </div>
        
        <div style={{ padding: '24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px'
          }}>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Email Address
              </label>
              {isEditing ? (
                <input
                  type="email"
                  value={editedProfile.email}
                  onChange={(e) => setEditedProfile({...editedProfile, email: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.3s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                />
              ) : (
                <div style={{
                  padding: '12px 16px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  color: '#333'
                }}>
                  {profile.email}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Phone Number
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editedProfile.phone}
                  onChange={(e) => setEditedProfile({...editedProfile, phone: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.3s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                />
              ) : (
                <div style={{
                  padding: '12px 16px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  color: '#333'
                }}>
                  {profile.phone}
                </div>
              )}
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Preferred Contact Method
              </label>
              {isEditing ? (
                <select
                  value={editedProfile.preferredContact}
                  onChange={(e) => setEditedProfile({...editedProfile, preferredContact: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.3s',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="inapp">In-app only</option>
                </select>
              ) : (
                <div style={{
                  padding: '12px 16px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  color: '#333',
                  textTransform: 'capitalize'
                }}>
                  {profile.preferredContact}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Address Information Card */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        marginBottom: '24px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <MapPin size={20} style={{ color: '#666' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Address & Residency</h2>
          <span style={{
            padding: '4px 12px',
            background: '#f5f5f5',
            color: '#666',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 500
          }}>
            Proof Verified
          </span>
        </div>
        
        <div style={{ padding: '24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px'
          }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Street Address
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedProfile.streetAddress}
                  onChange={(e) => setEditedProfile({...editedProfile, streetAddress: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.3s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                />
              ) : (
                <div style={{
                  padding: '12px 16px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  color: '#333'
                }}>
                  {profile.streetAddress}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                City
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedProfile.city}
                  onChange={(e) => setEditedProfile({...editedProfile, city: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.3s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                />
              ) : (
                <div style={{
                  padding: '12px 16px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  color: '#333'
                }}>
                  {profile.city}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Postal Code
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedProfile.zipCode}
                  onChange={(e) => setEditedProfile({...editedProfile, zipCode: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.3s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                />
              ) : (
                <div style={{
                  padding: '12px 16px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  color: '#333'
                }}>
                  {profile.zipCode}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Country
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedProfile.country}
                  onChange={(e) => setEditedProfile({...editedProfile, country: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.3s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                />
              ) : (
                <div style={{
                  padding: '12px 16px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  color: '#333'
                }}>
                  {profile.country}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* App Preferences Card */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        marginBottom: '24px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Globe size={20} style={{ color: '#666' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>App Preferences</h2>
        </div>
        
        <div style={{ padding: '24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px'
          }}>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Language
              </label>
              {isEditing ? (
                <select
                  value={editedProfile.language}
                  onChange={(e) => setEditedProfile({...editedProfile, language: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.3s',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                >
                  <option value="EN">English</option>
                  <option value="FR">Français</option>
                  <option value="DE">Deutsch</option>
                  <option value="IT">Italiano</option>
                </select>
              ) : (
                <div style={{
                  padding: '12px 16px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  color: '#333'
                }}>
                  {profile.language}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Display Currency
              </label>
              {isEditing ? (
                <select
                  value={editedProfile.currency}
                  onChange={(e) => setEditedProfile({...editedProfile, currency: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.3s',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="CHF">CHF (Fr.)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              ) : (
                <div style={{
                  padding: '12px 16px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  color: '#333'
                }}>
                  {profile.currency}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                Value Notifications
              </label>
              <div style={{
                padding: '12px 16px',
                background: '#f5f5f5',
                borderRadius: '8px'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: isEditing ? 'pointer' : 'default'
                }}>
                  <span style={{ color: '#333' }}>Enable notifications</span>
                  <input
                    type="checkbox"
                    checked={isEditing ? editedProfile.enableNotifications : profile.enableNotifications}
                    onChange={(e) => isEditing && setEditedProfile({...editedProfile, enableNotifications: e.target.checked})}
                    disabled={!isEditing}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: isEditing ? 'pointer' : 'default'
                    }}
                  />
                </label>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
                QR Vault Access
              </label>
              <div style={{
                padding: '12px 16px',
                background: '#f5f5f5',
                borderRadius: '8px'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: isEditing ? 'pointer' : 'default'
                }}>
                  <span style={{ color: '#333' }}>Allow QR access</span>
                  <input
                    type="checkbox"
                    checked={isEditing ? editedProfile.allowQrAccess : profile.allowQrAccess}
                    onChange={(e) => isEditing && setEditedProfile({...editedProfile, allowQrAccess: e.target.checked})}
                    disabled={!isEditing}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: isEditing ? 'pointer' : 'default'
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {isEditing ? (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '16px',
          marginBottom: '40px'
        }}>
          <button
            onClick={() => {
              setEditedProfile(profile);
              setIsEditing(false);
            }}
            style={{
              padding: '14px 24px',
              background: 'none',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '14px 24px',
              background: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Save Changes
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '40px'
        }}>
          <button
            style={{
              padding: '14px 24px',
              background: 'none',
              border: '1px solid #000',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
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
          >
            <Download size={16} />
            Download My Data
          </button>
          <button
            style={{
              padding: '14px 24px',
              background: 'none',
              border: '1px solid #000',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
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
          >
            <Shield size={16} />
            Security Settings
          </button>
        </div>
      )}

      {/* Change Request Modal */}
      {showChangeRequest && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <h3 style={{
              fontSize: '24px',
              fontWeight: 500,
              marginBottom: '16px'
            }}>Request Identity Change</h3>
            <p style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '24px',
              lineHeight: 1.6
            }}>
              To change KYC-verified information, please describe your request and our compliance team will contact you within 24 hours.
            </p>
            <textarea
              style={{
                width: '100%',
                padding: '16px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                resize: 'none',
                height: '120px',
                outline: 'none',
                transition: 'border-color 0.3s'
              }}
              placeholder="Please describe what information needs to be updated..."
              onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
            />
            <div style={{
              display: 'flex',
              gap: '16px',
              marginTop: '24px'
            }}>
              <button
                onClick={() => setShowChangeRequest(false)}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'none',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#000';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e0e0e0';
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowChangeRequest(false);
                  // Handle request submission
                }}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;