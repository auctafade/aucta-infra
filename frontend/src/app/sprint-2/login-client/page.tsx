// frontend/src/app/sprint-2/login-client/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Fingerprint, ArrowRight } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginClient() {
  const router = useRouter();
  const { login, error: authError } = useAuth();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleBiometricLogin = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    setLoading(true);
    setIsScanning(true);

    try {
      // Simulate biometric scan animation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Use the auth context login
      const result = await login(email);
      
      if (!result.success) {
        setError(result.error || 'Authentication failed');
        setIsScanning(false);
        setLoading(false);
      }
      // If successful, the auth context will handle navigation
      
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your email.');
      setIsScanning(false);
      setLoading(false);
    }
  };

  return (
    <>
      <Navigation />
      <div style={{
        minHeight: '100vh',
        background: '#fafafa',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: '80px'
      }}>
        {/* Subtle animated background */}
        <div 
          style={{
            position: 'absolute',
            top: '20%',
            left: '-10%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(0,0,0,0.03) 0%, transparent 70%)',
            borderRadius: '50%',
            transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
            transition: 'transform 0.3s ease-out'
          }}
        />
        <div 
          style={{
            position: 'absolute',
            bottom: '10%',
            right: '-5%',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(0,0,0,0.02) 0%, transparent 70%)',
            borderRadius: '50%',
            transform: `translate(${mousePosition.x * -0.03}px, ${mousePosition.y * -0.03}px)`,
            transition: 'transform 0.3s ease-out'
          }}
        />

        <div style={{
          maxWidth: '440px',
          margin: '0 auto',
          padding: '80px 20px',
          position: 'relative',
          zIndex: 1
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h1 style={{
              fontSize: '48px',
              fontWeight: 300,
              letterSpacing: '-0.03em',
              marginBottom: '16px',
              color: '#000'
            }}>
              Welcome Back
            </h1>
            <p style={{
              fontSize: '18px',
              color: '#666',
              fontWeight: 300
            }}>
              Access your luxury vault
            </p>
          </div>

          {/* Biometric Section */}
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '40px',
            boxShadow: '0 2px 20px rgba(0,0,0,0.06)'
          }}>
            {/* Email Input */}
            <div style={{ marginBottom: '40px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: '#333',
                marginBottom: '12px',
                letterSpacing: '0.02em'
              }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: focusedField === 'email' ? '#000' : '#999',
                  transition: 'color 0.3s'
                }}>
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  onKeyPress={(e) => e.key === 'Enter' && handleBiometricLogin()}
                  placeholder="your@email.com"
                  style={{
                    width: '100%',
                    padding: '20px 20px 20px 56px',
                    fontSize: '16px',
                    border: '1px solid',
                    borderColor: focusedField === 'email' ? '#000' : '#e0e0e0',
                    borderRadius: '12px',
                    background: '#fff',
                    outline: 'none',
                    transition: 'all 0.3s',
                    fontWeight: 300
                  }}
                />
              </div>
            </div>

            {/* Biometric Icon */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px'
            }}>
              <div style={{
                width: '100px',
                height: '100px',
                background: isScanning 
                  ? 'linear-gradient(135deg, #000 0%, #333 100%)' 
                  : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.5s ease-out',
                transform: isScanning ? 'scale(1.1)' : 'scale(1)'
              }}>
                <Fingerprint 
                  size={40} 
                  color={isScanning ? '#fff' : '#666'} 
                  style={{
                    transition: 'all 0.5s',
                    transform: isScanning ? 'scale(1.2)' : 'scale(1)'
                  }}
                />
                {loading && (
                  <div style={{
                    position: 'absolute',
                    inset: '-4px',
                    border: '2px solid transparent',
                    borderRadius: '50%',
                    borderTopColor: isScanning ? '#fff' : '#000',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}
                {isScanning && (
                  <div style={{
                    position: 'absolute',
                    inset: '-20px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '50%',
                    animation: 'pulse 2s ease-out infinite'
                  }} />
                )}
              </div>

              <div style={{ textAlign: 'center' }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 400,
                  marginBottom: '8px',
                  color: '#000'
                }}>
                  Use Touch ID or Face ID
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#666',
                  fontWeight: 300
                }}>
                  Authenticate with your biometric data
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                marginTop: '24px',
                padding: '16px',
                background: '#ffebee',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#c62828',
                textAlign: 'center',
                animation: 'fadeIn 0.3s ease-out'
              }}>
                {error}
              </div>
            )}

            {/* Authenticate Button */}
            <button
              onClick={handleBiometricLogin}
              disabled={loading}
              style={{
                width: '100%',
                marginTop: '32px',
                padding: '18px',
                background: loading ? '#999' : '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                letterSpacing: '0.02em',
                transform: loading ? 'scale(0.98)' : 'scale(1)'
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {loading ? (isScanning ? 'Scanning...' : 'Authenticating...') : 'Authenticate'}
              {!loading && <ArrowRight size={20} />}
            </button>
          </div>

          {/* Links */}
          <div style={{
            marginTop: '32px',
            textAlign: 'center'
          }}>
            <Link 
              href="/sprint-1/register-client"
              style={{
                fontSize: '14px',
                color: '#666',
                textDecoration: 'none',
                transition: 'color 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#000'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
            >
              Don't have an account? Register here
            </Link>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: '64px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#999'
          }}>
            <p>Protected by military-grade encryption</p>
            <p style={{ marginTop: '4px' }}>© 2025 AUCTA. All rights reserved.</p>
          </div>
        </div>
      </div>

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

        @keyframes pulse {
          0% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 0.3;
            transform: scale(1.1);
          }
          100% {
            opacity: 0;
            transform: scale(1.2);
          }
        }
      `}</style>
    </>
  );
}