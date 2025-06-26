'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, User } from 'lucide-react';
import { usePathname } from 'next/navigation';

const Navigation = () => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownTimeout, setDropdownTimeout] = useState<NodeJS.Timeout | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (dropdownTimeout) clearTimeout(dropdownTimeout);
    };
  }, [dropdownTimeout]);

  const sprints = [
    {
      id: 'sprint-1',
      title: 'Sprint 1',
      subtitle: 'Core Infrastructure Setup',
      routes: [
        { name: 'Create Passport', path: '/sprint-1/create-passport' },
        { name: 'Register Client', path: '/sprint-1/register-client' },
        { name: 'Assign Passport', path: '/sprint-1/assign-passport' },
        { name: 'Mint SBT', path: '/sprint-1/mint-sbt' }
      ]
    },
    {
      id: 'sprint-2',
      title: 'Sprint 2',
      subtitle: 'Client Dashboard',
      routes: [
        { name: 'Login', path: '/sprint-2/Login-client' },
        { name: 'Vault', path: '/sprint-2/Vault-client' },
        { name: 'Profile', path: '/sprint-2/profile' },
        { name: 'Wallet', path: '/sprint-2/wallet' },
        { name: 'Security Settings', path: '/sprint-2/security-settings' },
        { name: 'Proxy', path: '/sprint-2/proxy' },
        { name: 'Activity Log', path: '/sprint-2/activity-log' },
        { name: 'Documents', path: '/sprint-2/documents' },
        { name: 'Transfer Request', path: '/sprint-2/transfer-request' },
        { name: 'Messages', path: '/sprint-2/messages' },
        { name: 'QR Access', path: '/sprint-2/qr-access' },
        { name: 'Valuation History', path: '/sprint-2/valuation-history' },
        { name: 'Rewards', path: '/sprint-2/rewards' },
        { name: 'Inheritance Plan', path: '/sprint-2/inheritance-plan' }
      ]
    },
    {
      id: 'sprint-3',
      title: 'Sprint 3',
      subtitle: 'Resale Engine',
      routes: []
    },
    {
      id: 'sprint-4',
      title: 'Sprint 4',
      subtitle: 'Repairs & Vaulting',
      routes: []
    },
    {
      id: 'sprint-5',
      title: 'Sprint 5',
      subtitle: 'Auctions & Inheritance',
      routes: []
    },
    {
      id: 'sprint-6',
      title: 'Sprint 6',
      subtitle: 'Admin Tools',
      routes: []
    },
    {
      id: 'sprint-7',
      title: 'Sprint 7',
      subtitle: 'Compliance Layer',
      routes: []
    },
    {
      id: 'sprint-8',
      title: 'Sprint 8',
      subtitle: 'System Control',
      routes: []
    }
  ];

  const handleDropdownToggle = (sprintId: string) => {
    if (dropdownTimeout) {
      clearTimeout(dropdownTimeout);
      setDropdownTimeout(null);
    }
    setOpenDropdown(openDropdown === sprintId ? null : sprintId);
  };

  const handleMouseEnterDropdown = (sprintId: string) => {
    if (dropdownTimeout) {
      clearTimeout(dropdownTimeout);
      setDropdownTimeout(null);
    }
    setOpenDropdown(sprintId);
  };

  const handleMouseLeaveDropdown = () => {
    const timeout = setTimeout(() => {
      setOpenDropdown(null);
    }, 300); // 300ms delay before closing
    setDropdownTimeout(timeout);
  };

  // Determine if we should show solid background (on internal pages)
  const isHomePage = pathname === '/';
  const shouldHaveSolidBg = !isHomePage || scrollY > 50;

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '80px',
      background: shouldHaveSolidBg ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
      backdropFilter: shouldHaveSolidBg ? 'blur(10px)' : 'none',
      transition: 'all 0.3s cubic-bezier(0.19, 1, 0.22, 1)',
      zIndex: 1000,
      borderBottom: shouldHaveSolidBg ? '1px solid rgba(0, 0, 0, 0.05)' : 'none'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 40px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Link href="/" style={{
          fontSize: '18px',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          cursor: 'pointer',
          color: 'inherit',
          textDecoration: 'none'
        }}>
          AUCTA
        </Link>
        
        <div style={{
          display: 'flex',
          gap: '20px',
          alignItems: 'center'
        }}>
          {/* Sprint Dropdowns */}
          {sprints.map((sprint) => (
            <div
              key={sprint.id}
              style={{ position: 'relative' }}
              onMouseLeave={handleMouseLeaveDropdown}
              onMouseEnter={() => handleMouseEnterDropdown(sprint.id)}
            >
              <button
                onClick={() => handleDropdownToggle(sprint.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'opacity 0.3s'
                }}
              >
                {sprint.title}
                <ChevronDown 
                  size={14} 
                  style={{
                    transform: openDropdown === sprint.id ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }}
                />
              </button>

              {openDropdown === sprint.id && (
                <>
                  {/* Invisible bridge to maintain hover */}
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    height: '8px',
                    background: 'transparent'
                  }} />
                  
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '8px',
                    width: '240px',
                    background: 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '16px',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.06)'
                    }}>
                      <p style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        margin: 0
                      }}>{sprint.title}</p>
                      <p style={{
                        fontSize: '11px',
                        color: '#666',
                        marginTop: '4px',
                        margin: '4px 0 0 0'
                      }}>{sprint.subtitle}</p>
                    </div>
                    
                    {sprint.routes.length > 0 ? (
                      <div style={{ padding: '8px' }}>
                        {sprint.routes.map((route, index) => (
                          <Link
                            key={index}
                            href={route.path}
                            style={{
                              display: 'block',
                              padding: '10px 12px',
                              fontSize: '13px',
                              color: pathname === route.path ? '#000' : '#333',
                              fontWeight: pathname === route.path ? 600 : 400,
                              textDecoration: 'none',
                              borderRadius: '4px',
                              transition: 'all 0.2s',
                              background: pathname === route.path ? 'rgba(0, 0, 0, 0.06)' : 'transparent'
                            }}
                            onClick={() => setOpenDropdown(null)}
                            onMouseEnter={(e) => {
                              if (pathname !== route.path) {
                                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
                                e.currentTarget.style.paddingLeft = '16px';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (pathname !== route.path) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.paddingLeft = '12px';
                              }
                            }}
                          >
                            {route.name}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        padding: '32px',
                        textAlign: 'center',
                        fontSize: '12px',
                        color: '#999'
                      }}>
                        Coming soon
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Login Button */}
          <Link href="/sprint-2/Login-client">
            <button style={{
              background: '#000',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <User size={16} />
              Client Login
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;