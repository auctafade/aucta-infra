// frontend/src/components/LogisticsDashboardLayout.tsx
'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, 
  User, 
  Truck, 
  Shield, 
  Users, 
  FileText, 
  Activity, 
  LogOut,
  Menu,
  X,
  Bell,
  Settings,
  Search,
  Clock,
  MapPin,
  AlertTriangle,
  DollarSign,
  Building2,
  Tag,
  QrCode,
  MessageCircle,
  BarChart3
} from 'lucide-react';

interface LogisticsLayoutProps {
  children: React.ReactNode;
}

const LogisticsDashboardLayout: React.FC<LogisticsLayoutProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock user data for RBAC
  const mockUser = {
    name: 'John Doe',
    email: 'john.doe@aucta.com',
    role: 'ops_admin', // ops_admin, hub_tech, wg_operator, exec
    avatar: 'JD'
  };

  // Navigation structure with RBAC
  const navigation = [
    {
      section: 'Logistics',
      items: [
        { name: 'Dashboard', path: '/sprint-8/logistics/dashboard', icon: BarChart3, roles: ['ops_admin', 'hub_tech', 'wg_operator', 'exec'] },
        { name: 'New Shipment', path: '/sprint-8/logistics/new', icon: Package, roles: ['ops_admin', 'hub_tech'] },
        { name: 'Tier Gate', path: '/sprint-8/logistics/classify', icon: Shield, roles: ['ops_admin', 'hub_tech'] },
        { name: 'Quote & Plan', path: '/sprint-8/logistics/plan', icon: FileText, roles: ['ops_admin', 'hub_tech'] },
        { name: 'WG Scheduling', path: '/sprint-8/logistics/wg', icon: Truck, roles: ['ops_admin', 'wg_operator'] },
        { name: 'DHL Labels', path: '/sprint-8/logistics/dhl', icon: Tag, roles: ['ops_admin', 'hub_tech'] },
        { name: 'Hub Console', path: '/sprint-8/logistics/hub/management', icon: Building2, roles: ['ops_admin', 'hub_tech'] },
        { name: 'Incidents', path: '/sprint-8/logistics/incidents', icon: AlertTriangle, roles: ['ops_admin', 'hub_tech', 'wg_operator'] }
      ]
    },
    {
      section: 'Inventory',
      items: [
        { name: 'Tags', path: '/sprint-8/inventory/tags', icon: Tag, roles: ['ops_admin', 'hub_tech'] },
        { name: 'NFC', path: '/sprint-8/inventory/nfc', icon: QrCode, roles: ['ops_admin', 'hub_tech'] }
      ]
    },
    {
      section: 'People',
      items: [
        { name: 'Contacts', path: '/sprint-8/people/contacts', icon: Users, roles: ['ops_admin', 'hub_tech', 'wg_operator', 'exec'] }
      ]
    },
    {
      section: 'Billing',
      items: [
        { name: 'Quotes', path: '/sprint-8/billing/quotes', icon: DollarSign, roles: ['ops_admin', 'exec'] }
      ]
    },
    {
      section: 'Settings',
      items: [
        { name: 'Settings Overview', path: '/sprint-8/settings', icon: Settings, roles: ['ops_admin', 'hub_tech', 'exec'] },
        { name: 'SLA & Margins', path: '/sprint-8/settings/sla-margins', icon: BarChart3, roles: ['ops_admin', 'exec'] },
        { name: 'Hub Capacity', path: '/sprint-8/settings/hub-capacity', icon: Building2, roles: ['ops_admin', 'hub_tech'] },
        { name: 'Thresholds & Risk', path: '/sprint-8/settings/thresholds-risk', icon: Shield, roles: ['ops_admin', 'exec'] }
      ]
    }
  ];

  const handleLogout = () => {
    // Mock logout - in real app would clear auth and redirect
    router.push('/');
  };

  const getCurrentPageTitle = () => {
    for (const section of navigation) {
      const item = section.items.find(item => pathname.startsWith(item.path));
      if (item) return item.name;
    }
    return 'Logistics Dashboard';
  };

  const getCurrentPageDescription = () => {
    for (const section of navigation) {
      const item = section.items.find(item => pathname.startsWith(item.path));
      if (item) {
        switch (item.name) {
          case 'Dashboard': return 'Monitor shipments and operations';
          case 'New Shipment': return 'Create and track new shipments';
          case 'Tier Gate': return 'Classify and route shipments';
          case 'Quote & Plan': return 'Generate quotes and planning';
          case 'WG Scheduling': return 'Schedule warehouse operations';
          case 'DHL Labels': return 'Generate shipping labels';
          case 'Hub Console': return 'Monitor hub operations';
          case 'Incidents': return 'Track and resolve issues';
          case 'Tags': return 'Manage inventory tags';
          case 'NFC': return 'NFC tag management';
          case 'Contacts': return 'Manage business contacts';
          case 'Quotes': return 'Track billing quotes';
          case 'SLA & Margins': return 'Service level agreements';
          case 'Hub Capacity': return 'Hub capacity management';
          case 'Thresholds & Risk': return 'Risk management settings';
          default: return 'Logistics operations management';
        }
      }
    }
    return 'Logistics operations management';
  };

  const canAccessItem = (item: any) => {
    return item.roles.includes(mockUser.role);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--off-white)' }}>
      {/* Sidebar */}
      <aside style={{
        width: isSidebarOpen ? '280px' : '80px',
        background: 'var(--pure-white)',
        borderRight: '1px solid var(--light-gray)',
        transition: 'width var(--transition-fast)',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: 'var(--space-md)',
          borderBottom: '1px solid var(--light-gray)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Link href="/sprint-8/logistics" style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            color: 'var(--true-black)',
            transition: 'opacity var(--transition-fast)',
            opacity: isSidebarOpen ? 1 : 0,
            width: isSidebarOpen ? 'auto' : 0,
            overflow: 'hidden'
          }}>
            <h2 style={{
              fontSize: 'var(--font-medium)',
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
              color: 'var(--muted)',
              transition: 'color var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--true-black)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* User Info */}
        <div style={{
          padding: 'var(--space-md)',
          borderBottom: '1px solid var(--light-gray)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--charcoal) 0%, var(--true-black) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span style={{
                color: 'var(--pure-white)',
                fontSize: 'var(--font-medium)',
                fontWeight: 500
              }}>
                {mockUser.avatar}
              </span>
            </div>
            {isSidebarOpen && (
              <div style={{ overflow: 'hidden' }}>
                <h3 style={{
                  fontSize: 'var(--font-base)',
                  fontWeight: 500,
                  marginBottom: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {mockUser.name}
                </h3>
                <p style={{
                  fontSize: 'var(--font-tiny)',
                  color: 'var(--muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {mockUser.role.replace('_', ' ').toUpperCase()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: 'var(--space-sm) 0', overflowY: 'auto' }}>
          {navigation.map((section) => (
            <div key={section.section}>
              {isSidebarOpen && (
                <div style={{
                  padding: 'var(--space-xs) var(--space-md)',
                  fontSize: 'var(--font-tiny)',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: 'var(--space-sm)',
                  marginBottom: 'var(--space-xs)'
                }}>
                  {section.section}
                </div>
              )}
              {section.items.filter(canAccessItem).map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.path);
                
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '12px var(--space-md)',
                      color: isActive ? 'var(--true-black)' : 'var(--muted)',
                      textDecoration: 'none',
                      transition: 'all var(--transition-fast)',
                      background: isActive ? 'var(--smoke)' : 'transparent',
                      borderLeft: isActive ? '3px solid var(--true-black)' : '3px solid transparent',
                      fontSize: 'var(--font-small)',
                      fontWeight: isActive ? 500 : 400
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--off-white)';
                        e.currentTarget.style.color = 'var(--true-black)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--muted)';
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
            </div>
          ))}
        </nav>

        {/* Logout Button */}
        <div style={{
          padding: 'var(--space-sm)',
          borderTop: '1px solid var(--light-gray)'
        }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarOpen ? 'flex-start' : 'center',
              gap: 'var(--space-sm)',
              padding: '12px var(--space-sm)',
              background: 'none',
              border: '1px solid var(--light-gray)',
              borderRadius: '8px',
              color: 'var(--muted)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              fontSize: 'var(--font-small)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--true-black)';
              e.currentTarget.style.color = 'var(--pure-white)';
              e.currentTarget.style.borderColor = 'var(--true-black)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--muted)';
              e.currentTarget.style.borderColor = 'var(--light-gray)';
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
          height: 'var(--nav-height)',
          background: 'var(--pure-white)',
          borderBottom: '1px solid var(--light-gray)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-lg)',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}>
          <div>
            <h1 style={{
              fontSize: 'var(--font-large)',
              fontWeight: 300,
              letterSpacing: '-0.02em',
              marginBottom: '4px'
            }}>
              {getCurrentPageTitle()}
            </h1>
            <p style={{
              fontSize: 'var(--font-small)',
              color: 'var(--muted)'
            }}>
              {getCurrentPageDescription()}
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px'
          }}>
            {/* Global Search */}
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Search size={20} style={{ position: 'absolute', left: '12px', color: '#666' }} />
              <input
                type="text"
                placeholder="Search shipments, contacts, UID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '8px 12px 8px 40px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '20px',
                  fontSize: '14px',
                  width: '300px',
                  background: '#fafafa'
                }}
              />
            </div>

            {/* Clock */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: '#f5f5f5',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              <Clock size={16} />
              {new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              })}
            </div>

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

            {/* User Avatar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              transition: 'background 0.3s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #333 0%, #000 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500
              }}>
                {mockUser.avatar}
              </div>
              {isSidebarOpen && (
                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                  {mockUser.name}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div style={{
          padding: 'var(--space-lg)',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          minHeight: 'calc(100vh - var(--nav-height))',
          background: 'transparent'
        }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default LogisticsDashboardLayout;
