'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shield, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function VerifyAccess() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setError('No access token provided');
      setLoading(false);
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`http://localhost:4000/access/verify?token=${token}`);
      const data = await response.json();
      
      if (response.ok) {
        setVerificationResult(data);
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (err) {
      setError('Failed to verify access token');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Shield size={48} style={{ margin: '0 auto 16px', animation: 'pulse 2s infinite' }} />
          <p>Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        background: '#fff',
        borderRadius: '16px',
        padding: '40px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        {error ? (
          <>
            <XCircle size={64} color="#dc3545" style={{ margin: '0 auto 24px', display: 'block' }} />
            <h1 style={{ textAlign: 'center', marginBottom: '16px' }}>Access Denied</h1>
            <p style={{ textAlign: 'center', color: '#666' }}>{error}</p>
          </>
        ) : verificationResult && (
          <>
            <CheckCircle size={64} color="#28a745" style={{ margin: '0 auto 24px', display: 'block' }} />
            <h1 style={{ textAlign: 'center', marginBottom: '32px' }}>Access Granted</h1>
            
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Product Details</h2>
              <div style={{
                background: '#f8f9fa',
                padding: '20px',
                borderRadius: '8px'
              }}>
                <p><strong>Brand:</strong> {verificationResult.product.metadata?.brand}</p>
                <p><strong>Product:</strong> {verificationResult.product.metadata?.object_name}</p>
                <p><strong>NFC UID:</strong> {verificationResult.product.nfc_uid}</p>
                <p><strong>Status:</strong> {verificationResult.product.status}</p>
              </div>
            </div>
            
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Access Information</h2>
              <div style={{
                background: '#f8f9fa',
                padding: '20px',
                borderRadius: '8px'
              }}>
                <p><strong>Reason:</strong> {verificationResult.product.access_info.reason}</p>
                <p><strong>Authorized to:</strong> {verificationResult.product.access_info.authorized_to}</p>
                <p><strong>Owner:</strong> {verificationResult.product.owner.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                  <Clock size={16} />
                  <span style={{ fontSize: '14px', color: '#666' }}>
                    Expires: {new Date(verificationResult.product.access_info.expires_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}