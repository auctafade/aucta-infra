// SettingsNavigation.tsx - Centralized navigation and access control for settings
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, AlertTriangle, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SettingsPageConfig {
  id: string;
  name: string;
  path: string;
  description: string;
  scope: string[];
  requiredRoles: string[];
  crossLinks?: {
    name: string;
    path: string;
    description: string;
  }[];
}

const SETTINGS_PAGES: SettingsPageConfig[] = [
  {
    id: 'sla-margins',
    name: 'SLA & Margins',
    path: '/sprint-8/settings/sla-margins',
    description: 'Configure SLA targets and margin thresholds for operational scoring',
    scope: [
      'SLA timing targets (classification, pickups, hub processing, delivery)',
      'Global and component margin thresholds',
      'Risk management buffers and escalation',
      'Publishing and change management'
    ],
    requiredRoles: ['ops_admin', 'exec'],
    crossLinks: [
      {
        name: 'Hub Capacity Settings',
        path: '/sprint-8/settings/hub-capacity',
        description: 'Configure capacity limits that feed into SLA calculations'
      },
      {
        name: 'Risk Thresholds',
        path: '/sprint-8/settings/thresholds-risk',
        description: 'Set value bands and risk factors that influence margin scoring'
      }
    ]
  },
  {
    id: 'hub-capacity',
    name: 'Hub Capacity',
    path: '/sprint-8/settings/hub-capacity',
    description: 'Manage hub operational capacity, calendars, and availability',
    scope: [
      'Auth, sewing, and QA capacity slots per day',
      'Seasonality multipliers and overbooking rules',
      'Blackout periods and maintenance windows', 
      'Calendar views and slot utilization'
    ],
    requiredRoles: ['ops_admin', 'hub_tech'],
    crossLinks: [
      {
        name: 'SLA & Margins',
        path: '/sprint-8/settings/sla-margins',
        description: 'Set SLA targets that depend on capacity availability'
      }
    ]
  },
  {
    id: 'thresholds-risk',
    name: 'Thresholds & Risk',
    path: '/sprint-8/settings/thresholds-risk',
    description: 'Configure value bands, risk models, and operational thresholds',
    scope: [
      'Value bands and fragility rules for tier recommendations',
      'Brand overrides and customs lane risk levels',
      'Inventory thresholds and security defaults',
      'Risk model weights and incident automation'
    ],
    requiredRoles: ['ops_admin', 'exec'],
    crossLinks: [
      {
        name: 'SLA & Margins',
        path: '/sprint-8/settings/sla-margins',
        description: 'Configure margin policies that use these risk factors'
      },
      {
        name: 'Quote & Plan System',
        path: '/sprint-8/logistics/plan',
        description: 'See how these thresholds affect route scoring'
      }
    ]
  }
];

interface SettingsNavigationProps {
  currentUser?: {
    role: string;
  };
}

export const SettingsNavigation: React.FC<SettingsNavigationProps> = ({ 
  currentUser = { role: 'ops_admin' } 
}) => {
  const pathname = usePathname();
  
  const getCurrentPage = () => {
    return SETTINGS_PAGES.find(page => pathname.startsWith(page.path));
  };

  const canAccessPage = (page: SettingsPageConfig) => {
    return page.requiredRoles.includes(currentUser.role);
  };

  const getAccessiblePages = () => {
    return SETTINGS_PAGES.filter(canAccessPage);
  };

  const currentPage = getCurrentPage();

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      {/* Breadcrumb */}
      <nav style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 'var(--space-xs)', 
        fontSize: 'var(--font-small)', 
        color: 'var(--muted)',
        marginBottom: 'var(--space-md)'
      }}>
        <Link href="/sprint-8" style={{ 
          color: 'inherit', 
          textDecoration: 'none', 
          transition: 'color var(--transition-fast)' 
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--charcoal)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}>
          Sprint 8
        </Link>
        <ChevronRight style={{ width: '16px', height: '16px' }} />
        <Link href="/sprint-8/settings" style={{ 
          color: 'inherit', 
          textDecoration: 'none', 
          transition: 'color var(--transition-fast)' 
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--charcoal)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}>
          Settings
        </Link>
        <ChevronRight style={{ width: '16px', height: '16px' }} />
        <span style={{ color: 'var(--true-black)' }}>
          {currentPage?.name || 'Unknown Page'}
        </span>
      </nav>

      {/* Access Control Warning */}
      {currentPage && !canAccessPage(currentPage) && (
        <Alert style={{ 
          borderColor: 'var(--light-gray)', 
          backgroundColor: '#fef2f2',
          marginBottom: 'var(--space-lg)' 
        }}>
          <Lock style={{ width: '16px', height: '16px', color: '#dc2626' }} />
          <AlertDescription style={{ color: '#dc2626' }}>
            <strong>Access Denied:</strong> You don't have permission to access this settings page. 
            Required roles: {currentPage.requiredRoles.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Page Context */}
      {currentPage && canAccessPage(currentPage) && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div style={{ padding: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <h2 style={{ 
                fontSize: 'var(--font-large)', 
                fontWeight: 500, 
                marginBottom: 'var(--space-xs)' 
              }}>
                {currentPage.name}
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: 'var(--font-base)' }}>
                {currentPage.description}
              </p>
            </div>

            {/* Scope Definition */}
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <h3 style={{ 
                fontSize: 'var(--font-small)', 
                fontWeight: 600, 
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--muted)',
                marginBottom: 'var(--space-xs)' 
              }}>
                This Page Controls
              </h3>
              <ul style={{ 
                listStyle: 'none', 
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-xs)'
              }}>
                {currentPage.scope.map((item, index) => (
                  <li key={index} style={{ 
                    fontSize: 'var(--font-small)',
                    color: 'var(--charcoal)',
                    position: 'relative',
                    paddingLeft: 'var(--space-sm)'
                  }}>
                    <span style={{
                      position: 'absolute',
                      left: 0,
                      top: '0.1em',
                      width: '4px',
                      height: '4px',
                      backgroundColor: 'var(--muted)',
                      borderRadius: '50%'
                    }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Cross Links */}
            {currentPage.crossLinks && currentPage.crossLinks.length > 0 && (
              <div>
                <h3 style={{ 
                  fontSize: 'var(--font-small)', 
                  fontWeight: 600, 
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--muted)',
                  marginBottom: 'var(--space-xs)' 
                }}>
                  Related Settings
                </h3>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 'var(--space-xs)' 
                }}>
                  {currentPage.crossLinks.map((link, index) => (
                    <Link 
                      key={index}
                      href={link.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-xs)',
                        padding: 'var(--space-xs) var(--space-sm)',
                        border: '1px solid var(--light-gray)',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        color: 'var(--true-black)',
                        transition: 'all var(--transition-fast)',
                        fontSize: 'var(--font-small)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--smoke)';
                        e.currentTarget.style.borderColor = 'var(--muted)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = 'var(--light-gray)';
                      }}
                    >
                      <ChevronRight style={{ width: '14px', height: '14px', color: 'var(--muted)' }} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{link.name}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 'var(--font-tiny)' }}>
                          {link.description}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Overview for /settings root */}
      {pathname === '/sprint-8/settings' && (
        <div className="card">
          <div style={{ padding: 'var(--space-lg)' }}>
            <h2 style={{ 
              fontSize: 'var(--font-large)', 
              fontWeight: 500, 
              marginBottom: 'var(--space-sm)' 
            }}>
              Settings Overview
            </h2>
            <p style={{ 
              color: 'var(--muted)', 
              marginBottom: 'var(--space-lg)' 
            }}>
              Configure operational parameters that drive system behavior across the platform.
            </p>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
              gap: 'var(--space-md)' 
            }}>
              {getAccessiblePages().map((page) => (
                <Link
                  key={page.id}
                  href={page.path}
                  style={{
                    display: 'block',
                    padding: 'var(--space-lg)',
                    border: '1px solid var(--light-gray)',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: 'var(--true-black)',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.borderColor = 'var(--muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'var(--light-gray)';
                  }}
                >
                  <h3 style={{ 
                    fontSize: 'var(--font-medium)', 
                    fontWeight: 500, 
                    marginBottom: 'var(--space-xs)' 
                  }}>
                    {page.name}
                  </h3>
                  <p style={{ 
                    color: 'var(--muted)', 
                    fontSize: 'var(--font-small)',
                    marginBottom: 'var(--space-sm)' 
                  }}>
                    {page.description}
                  </p>
                  <div style={{ 
                    fontSize: 'var(--font-tiny)',
                    color: 'var(--muted)'
                  }}>
                    Access: {page.requiredRoles.join(', ')}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Hook for RBAC enforcement
export const useSettingsAccess = (pageId?: string) => {
  const pathname = usePathname();
  const currentUser = { role: 'ops_admin' }; // Mock - should come from auth context
  
  const currentPage = pageId 
    ? SETTINGS_PAGES.find(p => p.id === pageId)
    : SETTINGS_PAGES.find(page => pathname.startsWith(page.path));
    
  const hasAccess = currentPage ? currentPage.requiredRoles.includes(currentUser.role) : false;
  
  return {
    hasAccess,
    currentPage,
    currentUser,
    requiredRoles: currentPage?.requiredRoles || []
  };
};

export default SettingsNavigation;
