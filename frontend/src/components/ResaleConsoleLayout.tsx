'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  ShoppingCart, 
  Settings, 
  UserCheck, 
  FileCheck, 
  FileText, 
  DollarSign, 
  Shuffle, 
  Eye, 
  Truck,
  LogOut,
  X,
  Bell,
  LayoutDashboard,
  AlertCircle,
  ExternalLink,
  MoreHorizontal
} from 'lucide-react';
import { api, auth } from '@/lib/api';

interface ResaleLayoutProps {
  children: React.ReactNode;
}

const ResaleConsoleLayout: React.FC<ResaleLayoutProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const menuItems = [
    { name: 'Dashboard', path: '/admin/resale-dashboard', icon: LayoutDashboard },
    { name: 'Initiate', path: '/resale/initiate', icon: ShoppingCart },
    { name: 'Configure', path: '/resale/configure', icon: Settings },
    { name: 'Assign Buyer', path: '/resale/assign-buyer', icon: UserCheck },
    { name: 'Finalize', path: '/resale/finalize', icon: FileCheck },
    { name: 'Summary', path: '/resale/summary', icon: FileText },
    { name: 'Royalty', path: '/royalty/finalize', icon: DollarSign },
    { name: 'Split Engine', path: '/royalty/split-engine', icon: Shuffle },
    { name: 'Preview', path: '/resale/contract-preview', icon: Eye },
    { name: 'Traceability', path: '/resale/traceability', icon: Truck },
  ];

  useEffect(() => {
    const checkAuth = async () => {
      // Temporarily bypass auth for development
      // if (!auth.isAuthenticated()) {
      //   router.push('/admin/login');
      //   return;
      // }

      const storedUserData = auth.getClientData();
      if (storedUserData) {
        setUserData(storedUserData);
      } else {
        // Set mock user data for development
        setUserData({
          name: 'Admin User',
          email: 'admin@aucta.com'
        });
      }
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      const token = auth.getToken();
      if (token) {
        try {
          await api.logout();
        } catch (error) {
          console.log('Logout API call failed, proceeding with local cleanup');
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      auth.clearAuth();
      router.push('/admin/login');
    }
  };

  const getCurrentPageName = () => {
    const currentItem = menuItems.find(item => item.path === pathname);
    return currentItem?.name || 'Resale Console';
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '2px solid #e9ecef',
            borderTopColor: '#343a40',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6c757d', fontSize: '14px' }}>Loading Console...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Sidebar */}
      <aside style={{
        width: '200px',
        background: '#fff',
        borderRight: '1px solid #e9ecef',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Link href="/admin/resale-dashboard" style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            color: '#212529'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              margin: 0
            }}>
              AUCTA
            </h2>
          </Link>
          <button
            onClick={() => {}}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#6c757d'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Admin Info */}
        {userData && (
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #e9ecef'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#212529',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <span style={{
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 500
                }}>
                  {userData.name?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: '#212529'
                }}>
                  {userData.name || 'Admin User'}
                </h3>
                <p style={{
                  fontSize: '12px',
                  color: '#6c757d',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  margin: 0
                }}>
                  {userData.email || 'admin@aucta.com'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            
            return (
              <Link
                key={item.path}
                href={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 20px',
                  color: isActive ? '#212529' : '#6c757d',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  background: isActive ? '#f8f9fa' : 'transparent',
                  fontSize: '14px',
                  fontWeight: isActive ? 500 : 400
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#f8f9fa';
                    e.currentTarget.style.color = '#212529';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#6c757d';
                  }
                }}
              >
                {Icon && <Icon size={16} />}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #e9ecef'
        }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              color: '#6c757d',
              cursor: 'pointer',
              transition: 'color 0.2s',
              fontSize: '14px',
              borderRadius: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8f9fa';
              e.currentTarget.style.color = '#212529';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = '#6c757d';
            }}
          >
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#212529',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{
                color: '#fff',
                fontSize: '10px',
                fontWeight: 500
              }}>
                {userData?.name?.charAt(0).toUpperCase() || 'A'}
              </span>
            </div>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{
        flex: 1,
        marginLeft: '200px',
        minHeight: '100vh'
      }}>
        {/* Top Bar */}
        <header style={{
          height: '64px',
          background: '#fff',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}>
          <div>
            <h1 style={{
              fontSize: '16px',
              fontWeight: 400,
              margin: 0,
              color: '#212529'
            }}>
              {getCurrentPageName()}
            </h1>
            <p style={{
              fontSize: '13px',
              color: '#6c757d',
              margin: '2px 0 0 0'
            }}>
              Manage luxury asset resales
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            {/* Refresh Icon */}
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                color: '#6c757d',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#212529'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6c757d'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>

            {/* Settings Icon */}
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                color: '#6c757d',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#212529'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6c757d'}
            >
              <Settings size={16} />
            </button>

            {/* Active Resales Count */}
            <div style={{
              padding: '4px 12px',
              background: '#f8f9fa',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#212529'
            }}>
              3 Active Resales
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div style={{
          padding: '32px',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {children}
        </div>
      </main>

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
};

export default ResaleConsoleLayout;