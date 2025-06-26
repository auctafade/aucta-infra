// frontend/src/components/ClientDashboardLayout.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, 
  User, 
  Wallet, 
  Shield, 
  Users, 
  FileText, 
  Activity, 
  LogOut,
  Menu,
  X,
  Bell,
  Settings,
  ChevronRight,
  MessageCirclePlus,
  QrCodeIcon,
  HistoryIcon,
  CrownIcon,
  FileArchiveIcon,
  SendIcon
} from 'lucide-react';
import { api, auth } from '@/lib/api';

interface ClientLayoutProps {
  children: React.ReactNode;
}

const ClientDashboardLayout: React.FC<ClientLayoutProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [clientData, setClientData] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  const menuItems = [
    { name: 'Vault', path: '/sprint-2/vault-client', icon: Package },
    { name: 'Profile', path: '/sprint-2/profile', icon: User },
    { name: 'Wallet', path: '/sprint-2/wallet', icon: Wallet },
    { name: 'Security', path: '/sprint-2/security-settings', icon: Shield },
    { name: 'Proxy', path: '/sprint-2/proxy', icon: Users },
    { name: 'Activity', path: '/sprint-2/activity-log', icon: Activity },
    { name: 'Documents', path: '/sprint-2/documents', icon: FileText },
    { name: 'Transfer Request', path: '/sprint-2/transfer-request' , icon: SendIcon },
    { name: 'Messages', path: '/sprint-2/messages' , icon: MessageCirclePlus },
    { name: 'QR Access', path: '/sprint-2/qr-access' , icon: QrCodeIcon },
    { name: 'Valuation History', path: '/sprint-2/valuation-history' , icon: HistoryIcon },
    { name: 'Rewards', path: '/sprint-2/rewards' , icon: CrownIcon },
    { name: 'Inheritance Plan', path: '/sprint-2/inheritance-plan' , icon: FileArchiveIcon },
  ];

  useEffect(() => {
    // Check authentication on mount
    const checkAuth = async () => {
      console.log('Checking authentication...');
      
      if (!auth.isAuthenticated()) {
        console.log('Not authenticated, redirecting to login...');
        router.push('/sprint-2/login-client');
        return;
      }

      const storedClientData = auth.getClientData();
      console.log('Client data:', storedClientData);
      
      if (storedClientData) {
        setClientData(storedClientData);
        setLoading(false);
      } else {
        // If no client data, redirect to login
        console.log('No client data found, redirecting to login...');
        router.push('/sprint-2/login-client');
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      // Try to call logout API if token exists
      const token = auth.getToken();
      if (token) {
        try {
          await api.logout();
        } catch (error) {
          // If logout API fails, just continue with local cleanup
          console.log('Logout API call failed, proceeding with local cleanup');
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local auth data regardless of API call result
      auth.clearAuth();
      router.push('/sprint-2/login-client');
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa'
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
          <p style={{ color: '#666', fontSize: '14px' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fafafa' }}>
      {/* Sidebar */}
      <aside style={{
        width: isSidebarOpen ? '280px' : '80px',
        background: '#fff',
        borderRight: '1px solid #e0e0e0',
        transition: 'width 0.3s ease',
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
          padding: '24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Link href="/sprint-2/vault-client" style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            color: '#000',
            transition: 'opacity 0.3s',
            opacity: isSidebarOpen ? 1 : 0,
            width: isSidebarOpen ? 'auto' : 0,
            overflow: 'hidden'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '-0.02em'
            }}>
              AUCTA
            </h2>
          </Link>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: '#666',
              transition: 'color 0.3s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#000'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Client Info */}
        {clientData && (
          <div style={{
            padding: '24px',
            borderBottom: '1px solid #e0e0e0'
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
                background: 'linear-gradient(135deg, #333 0%, #000 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <span style={{
                  color: '#fff',
                  fontSize: '18px',
                  fontWeight: 500
                }}>
                  {clientData.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              {isSidebarOpen && (
                <div style={{ overflow: 'hidden' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    marginBottom: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {clientData.name}
                  </h3>
                  <p style={{
                    fontSize: '12px',
                    color: '#666',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {clientData.email}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
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
                  gap: '16px',
                  padding: '12px 24px',
                  color: isActive ? '#000' : '#666',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  background: isActive ? '#f5f5f5' : 'transparent',
                  borderLeft: isActive ? '3px solid #000' : '3px solid transparent',
                  fontSize: '14px',
                  fontWeight: isActive ? 500 : 400
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#fafafa';
                    e.currentTarget.style.color = '#000';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#666';
                  }
                }}
              >
                {Icon && <Icon size={20} />}
                {isSidebarOpen && (
                  <span>{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid #e0e0e0'
        }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarOpen ? 'flex-start' : 'center',
              gap: '16px',
              padding: '12px 16px',
              background: 'none',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              color: '#666',
              cursor: 'pointer',
              transition: 'all 0.3s',
              fontSize: '14px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#000';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.borderColor = '#000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = '#666';
              e.currentTarget.style.borderColor = '#e0e0e0';
            }}
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{
        flex: 1,
        marginLeft: isSidebarOpen ? '280px' : '80px',
        transition: 'margin-left 0.3s ease',
        minHeight: '100vh'
      }}>
        {/* Top Bar */}
        <header style={{
          height: '80px',
          background: '#fff',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 300,
              letterSpacing: '-0.02em',
              marginBottom: '4px'
            }}>
              {menuItems.find(item => item.path === pathname)?.name || 'Dashboard'}
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#666'
            }}>
              Manage your luxury assets
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px'
          }}>
            {/* Notifications */}
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                color: '#666',
                position: 'relative',
                transition: 'color 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#000'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
            >
              <Bell size={20} />
              <span style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '8px',
                height: '8px',
                background: '#ff4444',
                borderRadius: '50%',
                border: '2px solid #fff'
              }} />
            </button>

            {/* Settings */}
            <Link href="/sprint-2/security-settings">
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  color: '#666',
                  transition: 'color 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#000'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
              >
                <Settings size={20} />
              </button>
            </Link>

            {/* Products Count */}
            <div style={{
              padding: '8px 16px',
              background: '#f5f5f5',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              {clientData?.ownedProducts || 0} Products
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div style={{
          padding: '40px',
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

export default ClientDashboardLayout;