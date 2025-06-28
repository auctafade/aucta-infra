// frontend/src/app/sprint-2/profile/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Globe, Shield, Download, Edit3, Lock, Check, AlertCircle, X, ChevronRight } from 'lucide-react';
import { api, auth } from '@/lib/api';

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changeRequestText, setChangeRequestText] = useState('');
  
  // Initialize with empty profile
  const [profile, setProfile] = useState({
    // Identity (KYC-locked)
    fullName: '',
    dateOfBirth: '',
    placeOfBirth: '',
    nationality: '',
    clientId: '',
    kycStatus: 'pending',
    
    // Contact (editable)
    email: '',
    phone: '',
    preferredContact: 'email',
    
    // Address (editable)
    streetAddress: '',
    zipCode: '',
    city: '',
    country: '',
    proofOfAddressStatus: 'pending',
    
    // Preferences
    language: 'EN',
    currency: 'EUR',
    enableNotifications: true,
    allowQrAccess: true,
    
    // Stats
    memberSince: new Date().toISOString(),
    productCount: 0,
    totalValue: 0
  });

  const [editedProfile, setEditedProfile] = useState(profile);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const client = auth.getClientData();
      if (!client) {
        console.warn('No client data found');
        setLoading(false);
        return;
      }

      // Fetch full profile data from API
      const profileData = await api.getClient(client.id);
      console.log('Profile data from API:', profileData);

      // Parse KYC info for identity fields
      type KycData = {
        dateOfBirth?: string;
        placeOfBirth?: string;
        nationality?: string;
        email?: string;
        phone?: string;
        streetAddress?: string;
        zipCode?: string;
        city?: string;
        country?: string;
        [key: string]: any;
      };
      let kycData: KycData = {};
      if (profileData.kyc_info) {
        try {
          kycData = typeof profileData.kyc_info === 'string' 
            ? JSON.parse(profileData.kyc_info) 
            : profileData.kyc_info;
        } catch (e) {
          console.warn('Failed to parse KYC info:', e);
        }
      }

      // Map API data to profile structure
      const mappedProfile = {
        // Identity (from KYC data)
        fullName: profileData.full_name || profileData.name || '',
        dateOfBirth: kycData.dateOfBirth || profileData.date_of_birth || '',
        placeOfBirth: kycData.placeOfBirth || profileData.place_of_birth || '',
        nationality: kycData.nationality || profileData.nationality || '',
        clientId: profileData.wallet_address || client.walletAddress || '',
        kycStatus: profileData.kyc_status || 'verified',
        
        // Contact (editable fields)
        email: profileData.email || kycData.email || '',
        phone: profileData.phone || kycData.phone || '',
        preferredContact: profileData.preferred_contact || 'email',
        
        // Address
        streetAddress: profileData.street_address || kycData.streetAddress || '',
        zipCode: profileData.zip_code || kycData.zipCode || '',
        city: profileData.city || kycData.city || '',
        country: profileData.country || kycData.country || '',
        proofOfAddressStatus: profileData.proof_of_address_status || 'verified',
        
        // Preferences
        language: profileData.language || 'EN',
        currency: profileData.currency || 'EUR',
        enableNotifications: profileData.enable_notifications !== false,
        allowQrAccess: profileData.allow_qr_access !== false,
        
        // Stats
        memberSince: profileData.created_at || new Date().toISOString(),
        productCount: profileData.product_count || 0,
        totalValue: profileData.total_value || 0
      };

      setProfile(mappedProfile);
      setEditedProfile(mappedProfile);
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const client = auth.getClientData();
      if (!client) {
        throw new Error('No client data found');
      }

      // Prepare update data (only editable fields)
      const updateData = {
        email: editedProfile.email,
        phone: editedProfile.phone,
        preferred_contact: editedProfile.preferredContact,
        street_address: editedProfile.streetAddress,
        zip_code: editedProfile.zipCode,
        city: editedProfile.city,
        country: editedProfile.country,
        language: editedProfile.language,
        currency: editedProfile.currency,
        enable_notifications: editedProfile.enableNotifications,
        allow_qr_access: editedProfile.allowQrAccess
      };

      // Update profile via API
      await api.updateClientProfile(client.id, updateData);
      
      // Update local state
      setProfile(editedProfile);
      setIsEditing(false);
      
      // Show success message (you could add a toast notification here)
      console.log('Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRequest = async () => {
    try {
      const client = auth.getClientData();
      if (!client || !changeRequestText.trim()) {
        return;
      }

      await api.submitKycChangeRequest(client.id, changeRequestText);
      setShowChangeRequest(false);
      setChangeRequestText('');
      alert('Your change request has been submitted. Our compliance team will contact you within 24 hours.');
    } catch (error) {
      console.error('Error submitting change request:', error);
      alert('Failed to submit change request. Please try again.');
    }
  };

  const handleDownloadData = async () => {
    try {
      const client = auth.getClientData();
      if (!client) return;

      const exportData = await api.exportClientData(client.id);
      
      // Create and download JSON file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aucta-profile-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    }
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[parts.length - 1][0];
    }
    return name.slice(0, 2).toUpperCase();
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
          <p style={{ color: '#666', fontSize: '14px' }}>Loading profile...</p>
        </div>
      </div>
    );
  }

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
                {profile.fullName || 'Loading...'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', opacity: 0.9 }}>
                <span>Wallet: {profile.clientId ? `${profile.clientId.slice(0, 6)}...${profile.clientId.slice(-4)}` : ''}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    background: profile.kycStatus === 'verified' ? '#22c55e' : '#f59e0b', 
                    borderRadius: '50%' 
                  }} />
                  <span>KYC {profile.kycStatus}</span>
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
              {getInitials(profile.fullName)}
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '32px',
            flexWrap: 'wrap'
          }}>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Member Since</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>{formatDate(profile.memberSince)}</p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Products Owned</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>{profile.productCount} Items</p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Total Value</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>{formatCurrency(profile.totalValue)}</p>
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
              background: profile.kycStatus === 'verified' ? '#f0fdf4' : '#fef3c7',
              color: profile.kycStatus === 'verified' ? '#22c55e' : '#f59e0b',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Lock size={12} />
              KYC {profile.kycStatus}
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
                <span style={{ color: '#333' }}>{profile.fullName || 'Not provided'}</span>
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
                <span style={{ color: '#333' }}>
                  {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : 'Not provided'}
                </span>
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
                <span style={{ color: '#333' }}>{profile.placeOfBirth || 'Not provided'}</span>
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
                <span style={{ color: '#333' }}>{profile.nationality || 'Not provided'}</span>
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
                  {profile.email || 'Not provided'}
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
                  {profile.phone || 'Not provided'}
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
          {profile.proofOfAddressStatus === 'verified' && (
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
          )}
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
                  {profile.streetAddress || 'Not provided'}
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
                  {profile.city || 'Not provided'}
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
                  {profile.zipCode || 'Not provided'}
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
                  {profile.country || 'Not provided'}
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
            disabled={saving}
            style={{
              padding: '14px 24px',
              background: saving ? '#666' : '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '40px'
        }}>
          <button
            onClick={handleDownloadData}
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
            onClick={() => window.location.href = '/sprint-2/security'}
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
              value={changeRequestText}
              onChange={(e) => setChangeRequestText(e.target.value)}
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
                onClick={() => {
                  setShowChangeRequest(false);
                  setChangeRequestText('');
                }}
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
                onClick={handleChangeRequest}
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
};

export default ProfilePage;