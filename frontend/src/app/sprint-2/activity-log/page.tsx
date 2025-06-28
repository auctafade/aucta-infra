'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Search, Download, CheckCircle, Clock, AlertCircle, FileText, Shield, Package, Users, Settings } from 'lucide-react';
import { api, auth } from '@/lib/api';

// Type definitions
interface ActivityDetails {
  status?: string;
  proxy_name?: string;
  amount?: number;
  transactionId?: string;
}

interface Activity {
  id?: string;
  timestamp: string | number | Date;
  action: string;
  details?: ActivityDetails;
  product?: string;
}

interface ClientData {
  id: string;
  name: string;
}

interface StatusBadge {
  color: string;
  icon: React.ComponentType<{ size?: number }>;
  text: string;
}

// Helper function to format timestamps
const formatTimestamp = (timestamp: string | number | Date): string => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// Helper function to get icon for action type
const getActionIcon = (action: string) => {
  const iconMap = {
    'SBT_MINTED': Package,
    'PASSPORT_ASSIGNED': Package,
    'CLIENT_LOGIN': Shield,
    'CLIENT_LOGOUT': Shield,
    'PROFILE_UPDATE': Settings,
    'PROXY_REQUEST_SUBMITTED': Users,
    'SECURITY_REQUEST': Shield,
    'WALLET_EXPORT': FileText,
    'KEY_ROTATION': Shield,
    'MONEYSBT_WITHDRAWAL': FileText,
  };
  
  // Check for partial matches
  if (action.includes('PROXY')) return Users;
  if (action.includes('SECURITY')) return Shield;
  if (action.includes('PRODUCT')) return Package;
  
  return (action in iconMap ? iconMap[action as keyof typeof iconMap] : FileText);
};

// Helper function to get status badge
const getStatusBadge = (action: string, details?: ActivityDetails): StatusBadge => {
  // Determine status based on action type and details
  if (action.includes('REQUEST') && details?.status === 'pending') {
    return { color: '#FFA500', icon: Clock, text: 'Pending' };
  }
  if (action.includes('FAILED') || action.includes('ERROR')) {
    return { color: '#DC3545', icon: AlertCircle, text: 'Failed' };
  }
  return { color: '#28A745', icon: CheckCircle, text: 'Success' };
};

// Helper function to format action description
const formatActionDescription = (action: string, details?: ActivityDetails): string => {
  const descriptions = {
    'SBT_MINTED': 'Soulbound Token minted on blockchain',
    'PASSPORT_ASSIGNED': 'Digital passport assigned to vault',
    'CLIENT_LOGIN': 'Vault access authenticated',
    'CLIENT_LOGOUT': 'Session ended securely',
    'PROFILE_UPDATE': 'Profile information updated',
    'PROXY_REQUEST_SUBMITTED': 'Proxy authorization requested',
    'WALLET_EXPORT': 'Wallet data exported',
    'KEY_ROTATION': 'Security key rotated',
    'MONEYSBT_WITHDRAWAL': 'Cashback funds withdrawn',
  };
  
  // Add specific details if available
  let description = descriptions[action as keyof typeof descriptions] || action.replace(/_/g, ' ').toLowerCase();
  
  if (details?.proxy_name) {
    description += ` for ${details.proxy_name}`;
  }
  if (details?.amount) {
    description += ` - €${details.amount}`;
  }
  
  return description;
};

// Helper function to export data as CSV
const exportToCSV = (data: Activity[], filename: string): void => {
  const headers = ['Timestamp', 'Action', 'Description', 'Status', 'Reference'];
  const csvContent = [
    headers.join(','),
    ...data.map(log => {
      const status = getStatusBadge(log.action, log.details);
      const description = formatActionDescription(log.action, log.details);
      const reference = log.product || log.details?.proxy_name || log.details?.transactionId || '-';
      
      return [
        formatTimestamp(log.timestamp),
        log.action,
        `"${description}"`,
        status.text,
        reference
      ].join(',');
    })
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

// Helper function to export data as PDF
const exportToPDF = (data: Activity[], clientName: string): void => {
  // Create a simple HTML representation for PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { font-size: 24px; margin-bottom: 10px; }
        .subtitle { color: #666; font-size: 14px; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
        td { padding: 10px; border-bottom: 1px solid #eee; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
        .status-success { background: #d4edda; color: #155724; }
        .status-pending { background: #fff3cd; color: #856404; }
        .status-failed { background: #f8d7da; color: #721c24; }
      </style>
    </head>
    <body>
      <h1>AUCTA Activity Log</h1>
      <div class="subtitle">${clientName} - Exported on ${new Date().toLocaleDateString()}</div>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Description</th>
            <th>Status</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(log => {
            const status = getStatusBadge(log.action, log.details);
            const description = formatActionDescription(log.action, log.details);
            const reference = log.product || log.details?.proxy_name || log.details?.transactionId || '-';
            const statusClass = status.text.toLowerCase();
            
            return `
              <tr>
                <td>${formatTimestamp(log.timestamp)}</td>
                <td>${log.action.replace(/_/g, ' ')}</td>
                <td>${description}</td>
                <td><span class="status status-${statusClass}">${status.text}</span></td>
                <td>${reference}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  
  // Open in new window for printing/saving as PDF
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
};

export default function ActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [clientData, setClientData] = useState<ClientData | null>(null);

  useEffect(() => {
    fetchActivityData();
  }, []);

  useEffect(() => {
    filterActivities();
  }, [activities, searchTerm, dateFrom, dateTo]);

  const fetchActivityData = async (): Promise<void> => {
    try {
      const client = auth.getClientData();
      if (!client) return;
      
      setClientData(client);
      
      // Fetch activity logs from the backend
      const activityData: Activity[] = await api.getClientActivity(client.id, 100);
      setActivities(activityData);
      setFilteredActivities(activityData);
    } catch (error) {
      console.error('Error fetching activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterActivities = (): void => {
    let filtered = [...activities];
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(activity => {
        const description = formatActionDescription(activity.action, activity.details).toLowerCase();
        const action = activity.action.toLowerCase();
        const reference = (activity.product || activity.details?.proxy_name || '').toLowerCase();
        
        return description.includes(search) || 
               action.includes(search) || 
               reference.includes(search);
      });
    }
    
    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(activity => new Date(activity.timestamp) >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      filtered = filtered.filter(activity => new Date(activity.timestamp) <= toDate);
    }
    
    setFilteredActivities(filtered);
  };

  const handleExportCSV = (): void => {
    const filename = `aucta-activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(filteredActivities, filename);
  };

  const handleExportPDF = (): void => {
    exportToPDF(filteredActivities, clientData?.name || 'Client');
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
          <p style={{ color: '#666', fontSize: '14px' }}>Loading activity log...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div style={{
        marginBottom: '32px'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 300,
          marginBottom: '8px',
          letterSpacing: '-0.02em'
        }}>
          Activity Log
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#666'
        }}>
          Complete audit trail of all actions in your vault
        </p>
      </div>

      {/* Filters and Export Section */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #e0e0e0'
      }}>
        <div style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Search and Date Filters */}
          <div style={{
            display: 'flex',
            gap: '16px',
            flex: 1,
            flexWrap: 'wrap',
            minWidth: '300px'
          }}>
            {/* Search Field */}
            <div style={{
              position: 'relative',
              flex: '1 1 300px'
            }}>
              <Search size={20} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#666'
              }} />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 10px 10px 44px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#000'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            {/* Date From */}
            <div style={{
              position: 'relative',
              flex: '0 0 160px'
            }}>
              <Calendar size={20} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#666',
                pointerEvents: 'none'
              }} />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 10px 10px 44px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#000'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            {/* Date To */}
            <div style={{
              position: 'relative',
              flex: '0 0 160px'
            }}>
              <Calendar size={20} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#666',
                pointerEvents: 'none'
              }} />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 10px 10px 44px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#000'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>
          </div>

          {/* Export Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px'
          }}>
            <button
              onClick={handleExportPDF}
              style={{
                padding: '10px 20px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background 0.3s'
              }}
              onMouseEnter={(e) => (e.target as HTMLButtonElement).style.background = '#333'}
              onMouseLeave={(e) => (e.target as HTMLButtonElement).style.background = '#000'}
            >
              <Download size={16} />
              Export as PDF
            </button>
            <button
              onClick={handleExportCSV}
              style={{
                padding: '10px 20px',
                background: '#fff',
                color: '#000',
                border: '1px solid #000',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = '#000';
                target.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = '#fff';
                target.style.color = '#000';
              }}
            >
              <Download size={16} />
              Export as CSV
            </button>
          </div>
        </div>

        {/* Results count */}
        <div style={{
          marginTop: '16px',
          fontSize: '14px',
          color: '#666'
        }}>
          Showing {filteredActivities.length} of {activities.length} activities
        </div>
      </div>

      {/* Activity List */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        overflow: 'hidden'
      }}>
        {filteredActivities.length === 0 ? (
          <div style={{
            padding: '60px',
            textAlign: 'center'
          }}>
            <FileText size={48} color="#e0e0e0" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: '#666', fontSize: '16px' }}>
              No activities found matching your filters
            </p>
          </div>
        ) : (
          <div>
            {filteredActivities.map((activity, index) => {
              const Icon = getActionIcon(activity.action);
              const status = getStatusBadge(activity.action, activity.details);
              const StatusIcon = status.icon;
              const description = formatActionDescription(activity.action, activity.details);
              const reference = activity.product || activity.details?.proxy_name || activity.details?.transactionId;
              
              return (
                <div
                  key={activity.id || `activity-${index}`}
                  style={{
                    padding: '20px 24px',
                    borderBottom: index < filteredActivities.length - 1 ? '1px solid #e0e0e0' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    transition: 'background 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLElement;
                    target.style.background = '#f8f8f8';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLElement;
                    target.style.background = '#fff';
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={20} color="#666" />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#000'
                      }}>
                        {activity.action.replace(/_/g, ' ')}
                      </span>
                      {reference && (
                        <span style={{
                          fontSize: '12px',
                          color: '#666',
                          background: '#f5f5f5',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          {reference}
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontSize: '14px',
                      color: '#666',
                      margin: 0
                    }}>
                      {description}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div style={{
                    fontSize: '14px',
                    color: '#999',
                    whiteSpace: 'nowrap'
                  }}>
                    {formatTimestamp(activity.timestamp)}
                  </div>

                  {/* Status */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    background: status.color + '20',
                    color: status.color,
                    fontSize: '12px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap'
                  }}>
                    <StatusIcon size={14} />
                    {status.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
}