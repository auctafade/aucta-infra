'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, User, ChevronRight } from 'lucide-react';

export default function ModernHomepage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownTimeout, setDropdownTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
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
        { name: 'Login', path: '/sprint-2/login-client' },
        { name: 'Vault', path: '/sprint-2/vault-client' },
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
      routes: [
        { name: 'Resale Initiate', path: 'sprint-3/resale-initiate' },
        { name: 'Configure Resale', path: '/sprint-3/resale-configure' },
        { name: 'Assign Buyer', path: '/sprint-3/resale-assign-buyer' },
        { name: 'Finalize Resale', path: '/sprint-3/resale-finalize' },
        { name: 'Resale Summary', path: '/sprint-3/resale-summary' },
        { name: 'Contract Preview', path: '/sprint-3/resale-contract-preview' },
        { name: 'Royalty Finalize', path: '/sprint-3/royalty-finalize' },
        { name: 'Royalty Split Engine', path: '/sprint-3/royalty-split-engine' },
        { name: 'Resale Traceability', path: '/sprint-3/resale-traceability' },
        { name: 'Cashback Wallet', path: '/sprint-3/cashback-wallet' },
        { name: 'Admin Resale Dashboard', path: '/sprint-3/admin-resale-dashboard' }
      ]
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

  return (
    <>
      {/* Parallax Background */}
      <div className="parallax-wrapper" style={{
        height: '80px',
      }}>
        <div 
          className="parallax-element"
          style={{
            transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
            top: '20%',
            left: '10%'
          }}
        />
        <div 
          className="parallax-element"
          style={{
            transform: `translate(${mousePosition.x * -0.03}px, ${mousePosition.y * -0.03}px)`,
            top: '60%',
            right: '20%',
            width: '400px',
            height: '400px'
          }}
        />
      </div>

      {/* Navigation */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '80px',
        background: scrollY > 50 ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
        backdropFilter: scrollY > 50 ? 'blur(10px)' : 'none',
        transition: 'all 0.3s cubic-bezier(0.19, 1, 0.22, 1)',
        zIndex: 1000,
        borderBottom: scrollY > 50 ? '1px solid rgba(0, 0, 0, 0.05)' : 'none'
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
                              color: '#333',
                              textDecoration: 'none',
                              borderRadius: '4px',
                              transition: 'all 0.2s'
                            }}
                            onClick={() => setOpenDropdown(null)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
                              e.currentTarget.style.paddingLeft = '16px';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.paddingLeft = '12px';
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
            <Link href="/sprint-2/login-client">
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

      {/* Hero Section */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        padding: '0 40px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
          transform: `translateY(${scrollY * -0.2}px)`,
          opacity: 1 - (scrollY * 0.001)
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '80px',
            alignItems: 'center'
          }}>
            <div>
              <h1 style={{
                fontSize: 'clamp(48px, 8vw, 96px)',
                fontWeight: 300,
                letterSpacing: '-0.04em',
                lineHeight: 0.9,
                marginBottom: '40px'
              }}>
                Immutable
                <br />
                Luxury
                <br />
                <span style={{ fontWeight: 500 }}>Authentication</span>
              </h1>
              
              <p style={{
                fontSize: '24px',
                fontWeight: 300,
                lineHeight: 1.4,
                color: '#666',
                marginBottom: '48px',
                maxWidth: '500px'
              }}>
                Creating permanent blockchain records for the world's most precious objects.
              </p>
              
              <div style={{
                display: 'flex',
                gap: '24px',
                alignItems: 'center'
              }}>
                <Link href="/sprint-2/login-client">
                  <button style={{
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    padding: '16px 48px',
                    fontSize: '16px',
                    fontWeight: 400,
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}>
                    Login as Client
                    <ChevronRight size={20} />
                  </button>
                </Link>
                
                <Link href="/sprint-1/register-client">
                  <button style={{
                    background: 'transparent',
                    color: '#000',
                    border: '1px solid #000',
                    padding: '16px 48px',
                    fontSize: '16px',
                    fontWeight: 400,
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#000';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#000';
                  }}>
                    Register Now
                  </button>
                </Link>
              </div>
            </div>
            
            <div style={{
              position: 'relative',
              height: '600px',
              background: '#f5f5f5',
              overflow: 'hidden',
              transform: `translateY(${mousePosition.y * 0.02}px) translateX(${mousePosition.x * 0.02}px)`
            }}>
              <div style={{
                position: 'absolute',
                inset: '40px',
                background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '120px',
                fontWeight: 200,
                color: '#e0e0e0',
                letterSpacing: '-0.05em'
              }}>
                AUCTA
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sprint Progress Section */}
      <section style={{
        padding: '128px 40px',
        background: '#fafafa'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          <div style={{
            marginBottom: '96px'
          }}>
            <p style={{
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#666',
              marginBottom: '24px'
            }}>
              DEVELOPMENT PROGRESS
            </p>
            <h2 style={{
              fontSize: 'clamp(32px, 5vw, 64px)',
              color: 'black',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              maxWidth: '800px'
            }}>
              Building the future of luxury authentication
            </h2>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px'
          }}>
            <div style={{
              background: '#e8f5e9',
              border: '1px solid #c8e6c9',
              padding: '32px',
              borderRadius: '8px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                marginBottom: '16px'
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em'
                }}>
                  Sprint 1: Core Infrastructure
                </h3>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#2e7d32',
                  background: '#c8e6c9',
                  padding: '4px 12px',
                  borderRadius: '20px'
                }}>
                  COMPLETE
                </span>
              </div>
              <p style={{
                fontSize: '14px',
                color: '#555',
                lineHeight: 1.6
              }}>
                Passport creation, client registration, assignment, and SBT minting
              </p>
            </div>

            <div style={{
              background: '#e3f2fd',
              border: '1px solid #bbdefb',
              padding: '32px',
              borderRadius: '8px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                marginBottom: '16px'
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em'
                }}>
                  Sprint 2: Client Dashboard
                </h3>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1565c0',
                  background: '#bbdefb',
                  padding: '4px 12px',
                  borderRadius: '20px'
                }}>
                  IN PROGRESS
                </span>
              </div>
              <p style={{
                fontSize: '14px',
                color: '#555',
                lineHeight: 1.6
              }}>
                Secure login, vault access, profile management, and client tools
              </p>
            </div>

            <div style={{
              background: '#f5f5f5',
              border: '1px solid #e0e0e0',
              padding: '32px',
              borderRadius: '8px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                marginBottom: '16px'
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em'
                }}>
                  Sprint 3-8: Advanced Features
                </h3>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#757575',
                  background: '#e0e0e0',
                  padding: '4px 12px',
                  borderRadius: '20px'
                }}>
                  UPCOMING
                </span>
              </div>
              <p style={{
                fontSize: '14px',
                color: '#666',
                lineHeight: 1.6
              }}>
                Resale engine, repairs, auctions, admin tools, and compliance layer
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section style={{
        padding: '128px 40px',
        background: 'white'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          <div style={{
            marginBottom: '96px'
          }}>
            <p style={{
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#666',
              marginBottom: '24px'
            }}>
              OUR PROCESS
            </p>
            <h2 style={{
              fontSize: 'clamp(32px, 5vw, 64px)',
              color: 'black',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              maxWidth: '800px'
            }}>
              Four steps to permanent authentication
            </h2>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '2px'
          }}>
            {[
              { num: '01', title: 'Register Client', desc: 'KYC verification and wallet creation', link: '/sprint-1/register-client' },
              { num: '02', title: 'Create Passport', desc: 'Digital identity for luxury items', link: '/sprint-1/create-passport' },
              { num: '03', title: 'Assign Owner', desc: 'Link product to verified client', link: '/sprint-1/assign-passport' },
              { num: '04', title: 'Mint Token', desc: 'Blockchain inscription forever', link: '/sprint-1/mint-sbt' }
            ].map((item, idx) => (
              <Link href={item.link} key={idx} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div 
                  style={{
                    background: '#fff',
                    padding: '48px 32px',
                    cursor: 'pointer',
                    transition: 'all 0.6s cubic-bezier(0.19, 1, 0.22, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    height: '100%',
                    border: '1px solid #f0f0f0'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    fontSize: '48px',
                    fontWeight: 200,
                    color: '#606060',
                    marginBottom: '24px',
                    letterSpacing: '-0.02em'
                  }}>
                    {item.num}
                  </div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: 500,
                    marginBottom: '12px',
                    letterSpacing: '-0.01em'
                  }}>
                    {item.title}
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#666',
                    lineHeight: 1.6
                  }}>
                    {item.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section style={{
        padding: '128px 40px'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr',
            gap: '120px',
            alignItems: 'start'
          }}>
            <div style={{
              position: 'sticky',
              top: '120px'
            }}>
              <p style={{
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#666',
                marginBottom: '24px'
              }}>
                FEATURES
              </p>
              <h2 style={{
                fontSize: '48px',
                fontWeight: 400,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                marginBottom: '32px'
              }}>
                Built for the luxury ecosystem
              </h2>
              <p style={{
                fontSize: '18px',
                color: '#666',
                lineHeight: 1.6
              }}>
                Every feature designed with authentication, provenance, and permanence in mind.
              </p>
            </div>
            
            <div>
              {[
                {
                  title: 'Blockchain Security',
                  desc: 'Immutable records on a private Substrate chain with enterprise-grade encryption.',
                  icon: '🔐'
                },
                {
                  title: 'NFC Integration',
                  desc: 'Physical-digital link through embedded NFC chips in luxury products.',
                  icon: '📡'
                },
                {
                  title: 'Soulbound Tokens',
                  desc: 'Non-transferable tokens that create permanent ownership records.',
                  icon: '💎'
                },
                {
                  title: 'Global Network',
                  desc: 'Trusted by auction houses, brands, and collectors worldwide.',
                  icon: '🌍'
                }
              ].map((feature, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: '32px',
                    padding: '48px 0',
                    borderBottom: '1px solid #e5e5e5',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.paddingLeft = '24px';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.paddingLeft = '0';
                  }}
                >
                  <div style={{
                    fontSize: '48px',
                    flexShrink: 0
                  }}>
                    {feature.icon}
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '24px',
                      fontWeight: 400,
                      marginBottom: '12px',
                      letterSpacing: '-0.01em'
                    }}>
                      {feature.title}
                    </h3>
                    <p style={{
                      fontSize: '16px',
                      color: '#666',
                      lineHeight: 1.6
                    }}>
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '160px 40px',
        background: '#0a0a0a',
        color: '#fff',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          <h2 style={{
            fontSize: 'clamp(48px, 8vw, 96px)',
            fontWeight: 300,
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
            marginBottom: '48px'
          }}>
            Begin your
            <br />
            <span style={{ fontWeight: 500 }}>authentication</span>
            <br />
            journey
          </h2>
          
          <p style={{
            fontSize: '24px',
            fontWeight: 300,
            lineHeight: 1.4,
            color: '#999',
            marginBottom: '64px'
          }}>
            Join the world's leading platform for luxury product authentication.
          </p>
          
          <div style={{
            display: 'flex',
            gap: '24px',
            justifyContent: 'center'
          }}>
            <Link href="/sprint-2/login-client">
              <button style={{
                background: 'white',
                color: 'black',
                border: 'none',
                padding: '20px 60px',
                fontSize: '18px',
                fontWeight: 400,
                cursor: 'pointer',
                transition: 'all 0.3s',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}>
                <User size={20} />
                Client Access
              </button>
            </Link>

            <Link href="/sprint-1/register-client">
              <button style={{
                background: 'transparent',
                color: 'white',
                border: '1px solid white',
                padding: '20px 60px',
                fontSize: '18px',
                fontWeight: 400,
                cursor: 'pointer',
                transition: 'all 0.3s',
                letterSpacing: '0.02em',
                textTransform: 'uppercase'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.color = 'black';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'white';
              }}>
                Register →
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '64px 40px',
        borderTop: '1px solid #e5e5e5'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#666'
          }}>
            © 2025 AUCTA. All rights reserved.
          </div>
          
          <div style={{
            display: 'flex',
            gap: '40px'
          }}>
            <a href="#" style={{
              fontSize: '14px',
              color: '#666',
              textDecoration: 'none',
              transition: 'color 0.3s'
            }}>
              Privacy
            </a>
            <a href="#" style={{
              fontSize: '14px',
              color: '#666',
              textDecoration: 'none',
              transition: 'color 0.3s'
            }}>
              Terms
            </a>
            <a href="#" style={{
              fontSize: '14px',
              color: '#666',
              textDecoration: 'none',
              transition: 'color 0.3s'
            }}>
              Contact
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}