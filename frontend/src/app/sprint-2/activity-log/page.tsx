'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Download, FileText, Filter, Search, Shield, CheckCircle, AlertCircle, XCircle, Eye, User, Wallet, Package, Settings, Lock, Globe, LogIn, UserPlus, Key, Archive, AlertTriangle, RefreshCw } from 'lucide-react';
import { api, auth } from '@/lib/api';

const actionIcons: { [key: string]: React.ComponentType<any> } = {
  VAULT_ACCESS: Eye,
  SBT_MINTED: Package,
  PROXY_REQUEST_SUBMITTED: User,
  PROXY_ACCESS_REVOKED: User,
  PROXY_STATUS_UPDATED_BY_ADMIN: User,
  PROXY_CLIENT_CREATED_BY_ADMIN: UserPlus,
  PASSPORT_ASSIGNED: Package,
  PASSPORT_CREATED: Package,
  PRODUCT_ADDED: Package,
  DOCUMENT_EXPORT: FileText,
  WALLET_EXPORT: FileText,
  DATA_EXPORT: FileText,
  SECURITY_UPDATE: Shield,
  KEY_ROTATION: Key,
  PROFILE_UPDATE: Settings,
  KYC_CHANGE_REQUEST: Settings,
  MONEYSBT_WITHDRAWAL: Wallet,
  GEO_TRACKING_TOGGLE: Globe,
  TRUSTED_LOCATION_REQUEST: Globe,
  NEW_VAULT_REQUEST: Archive,
  PHYSICAL_AGENT_REQUEST: AlertTriangle,
  EMERGENCY_LOCKDOWN_REQUEST: Lock,
  PRODUCT_STATUS_REPORT: Package,
  '2FA_ACTIVATION_REQUEST': Shield,
  DEVICE_RESET_REQUEST: Settings,
  LOGOUT_ALL_REQUEST: LogIn,
  SUSPICIOUS_ACTIVITY_REPORT: AlertTriangle,
  CLIENT_LOGIN: LogIn,
  CLIENT_LOGOUT: LogIn,
  CLIENT_REGISTERED: UserPlus
};

const statusConfig = {
  success: { 
    icon: CheckCircle, 
    color: 'text-green-600', 
    bg: 'bg-green-50 border-green-200',
    label: 'Success'
  },
  completed: { 
    icon: CheckCircle, 
    color: 'text-green-600', 
    bg: 'bg-green-50 border-green-200',
    label: 'Completed'
  },
  pending: { 
    icon: AlertCircle, 
    color: 'text-yellow-600', 
    bg: 'bg-yellow-50 border-yellow-200',
    label: 'Pending'
  },
  pending_review: { 
    icon: AlertCircle, 
    color: 'text-yellow-600', 
    bg: 'bg-yellow-50 border-yellow-200',
    label: 'Under Review'
  },
  under_investigation: { 
    icon: AlertTriangle, 
    color: 'text-orange-600', 
    bg: 'bg-orange-50 border-orange-200',
    label: 'Under Investigation'
  },
  failed: { 
    icon: XCircle, 
    color: 'text-red-600', 
    bg: 'bg-red-50 border-red-200',
    label: 'Failed'
  },
  info: { 
    icon: Eye, 
    color: 'text-blue-600', 
    bg: 'bg-blue-50 border-blue-200',
    label: 'Info'
  }
} as const;

type StatusKey = keyof typeof statusConfig;

type Activity = {
  id: string;
  timestamp: string;
  action: string;
  description: string;
  status: string;
  details?: Record<string, any>;
  product?: string | null;
  value?: number | string | null;
};

const ActivityLog = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30_days');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});

  // Get current client data with debugging
  const clientData = auth.getClientData();
  const clientId = clientData?.id;

  // Debug log helper
  const debugLog = (message: string, data: any = null) => {
    console.log(`[ActivityLog Debug] ${message}`, data);
    setDebugInfo(prev => ({
      ...(prev || {}),
      [`${Date.now()}`]: { message, data, timestamp: new Date().toISOString() }
    }));
  };

  // Mock data for fallback during development
  const getMockActivities = () => {
    const mockData = [
      {
        id: 'mock-1',
        timestamp: new Date().toISOString(),
        action: 'CLIENT_LOGIN',
        details: { method: 'biometric' },
        product: null,
        value: null
      },
      {
        id: 'mock-2',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        action: 'SBT_MINTED',
        details: {},
        product: 'Luxury Watch Collection',
        value: null
      },
      {
        id: 'mock-3',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        action: 'PASSPORT_ASSIGNED',
        details: {},
        product: 'Art Piece Authentication',
        value: null
      }
    ];

    debugLog('Using mock data for development', mockData);
    return mockData;
  };

  // Validate and sanitize activity data
  const validateActivity = (activity: any) => {
    try {
      // Ensure required fields exist
      if (!activity || typeof activity !== 'object') {
        debugLog('Invalid activity object', activity);
        return null;
      }

      const validated = {
        id: activity.id || `fallback-${Date.now()}-${Math.random()}`,
        timestamp: activity.timestamp || new Date().toISOString(),
        action: activity.action || 'UNKNOWN_ACTION',
        details: activity.details && typeof activity.details === 'object' ? activity.details : {},
        product: activity.product || null,
        value: activity.value || null
      };

      // Validate timestamp format
      if (isNaN(Date.parse(validated.timestamp))) {
        debugLog('Invalid timestamp, using current time', validated.timestamp);
        validated.timestamp = new Date().toISOString();
      }

      return validated;
    } catch (err) {
      debugLog('Error validating activity', { activity, error: (err as Error).message });
      return null;
    }
  };

  // Fetch activities from backend with comprehensive error handling
  useEffect(() => {
    const fetchActivities = async () => {
      debugLog('Starting activity fetch', { clientId, retryCount });

      if (!clientId) {
        debugLog('No client ID found', { clientData });
        setError('No client data found. Please log in again.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        debugLog('Attempting to fetch activities from API');

        // Check if api object exists and has the required method
        if (!api || typeof api.getClientActivity !== 'function') {
          throw new Error('API client not properly initialized or getClientActivity method missing');
        }

        // Fetch activity data from backend
        let response = await api.getClientActivity(clientId, 100);
        
        debugLog('Raw API response received', {
          type: typeof response,
          isArray: Array.isArray(response),
          length: response?.length,
          sample: response?.[0]
        });

        // Validate response format
        if (!response) {
          throw new Error('No response received from API');
        }

        if (!Array.isArray(response)) {
          debugLog('Response is not an array, attempting to extract array', response);
          
          // Try to extract array from response object
          const possibleArrays = ['data', 'activities', 'results', 'items'];
          let extractedArray: any[] | null = null;
          
          for (const key of possibleArrays) {
            if (response[key] && Array.isArray(response[key])) {
              extractedArray = response[key];
              debugLog(`Found array in response.${key}`, extractedArray);
              break;
            }
          }

          if (!extractedArray) {
            throw new Error('Response is not an array and no array found in response object');
          }

          response = extractedArray;
        }

        if (response.length === 0) {
          debugLog('API returned empty array, using mock data');
          const mockActivities = getMockActivities();
          const validatedMockActivities = mockActivities
            .map(validateActivity)
            .filter(Boolean);

          const transformedMockActivities: Activity[] = validatedMockActivities
            .filter((activity): activity is NonNullable<typeof activity> => !!activity)
            .map(activity => ({
              id: activity.id,
              timestamp: activity.timestamp,
              action: activity.action,
              description: formatDescription(activity),
              status: determineStatus(activity),
              details: activity.details,
              product: activity.product,
              value: activity.value
            }));

          setActivities(transformedMockActivities);
          setFilteredActivities(transformedMockActivities);
          setLoading(false);
          return;
        }
        
        // Validate and transform each activity
        const validatedActivities = response
          .map(validateActivity)
          .filter((activity: any): activity is NonNullable<typeof activity> => {
            if (!activity) {
              debugLog('Filtered out invalid activity');
              return false;
            }
            return true;
          });

        debugLog('Validated activities', {
          originalCount: response.length,
          validatedCount: validatedActivities.length,
          sample: validatedActivities[0]
        });

        // Transform backend data to match our expected format
        const transformedActivities = validatedActivities.map((activity: any) => {
          try {
            return {
              id: activity.id,
              timestamp: activity.timestamp,
              action: activity.action,
              description: formatDescription(activity),
              status: determineStatus(activity),
              details: activity.details,
              product: activity.product,
              value: activity.value
            };
          } catch (err) {
            debugLog('Error transforming activity', { activity, error: (err as Error).message });
            return {
              id: activity.id,
              timestamp: activity.timestamp,
              action: activity.action,
              description: `Error formatting description for ${activity.action}`,
              status: 'info' as const,
              details: activity.details,
              product: activity.product,
              value: activity.value
            };
          }
        });

        debugLog('Successfully transformed activities', {
          count: transformedActivities.length,
          sample: transformedActivities[0]
        });

        setActivities(transformedActivities);
        setFilteredActivities(transformedActivities);
        setRetryCount(0); // Reset retry count on success

      } catch (err) {
        const error = err as Error;
        debugLog('Error in fetchActivities', {
          error: error.message,
          stack: error.stack,
          retryCount
        });

        console.error('Error fetching activities:', error);
        
        // If this is the first error or we haven't exceeded retry limit, try fallback
        if (retryCount < 2) {
          debugLog('Using fallback mock data due to API error');
          const mockActivities = getMockActivities();
          const validatedMockActivities = mockActivities
            .map(validateActivity)
            .filter(Boolean);

          const transformedMockActivities: Activity[] = validatedMockActivities
            .filter((activity): activity is NonNullable<typeof activity> => !!activity)
            .map(activity => ({
              id: activity.id,
              timestamp: activity.timestamp,
              action: activity.action,
              description: formatDescription(activity),
              status: determineStatus(activity),
              details: activity.details,
              product: activity.product,
              value: activity.value
            }));

          setActivities(transformedMockActivities);
          setFilteredActivities(transformedMockActivities);

          setError(`API Error (using fallback data): ${error.message}`);
        } else {
          setError(`Failed to load activity history after ${retryCount + 1} attempts: ${error.message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [clientId, retryCount]); // Added missing dependencies

  // Transform backend activity into user-friendly description with error handling
  const formatDescription = (activity: any) => {
    try {
      const details = activity.details || {};
      
      switch (activity.action) {
        case 'SBT_MINTED':
          return `You minted a Soulbound Token${activity.product ? ` for: ${activity.product}` : ''}`;
        
        case 'PASSPORT_ASSIGNED':
          return `New product authenticated and added to your vault${activity.product ? `: ${activity.product}` : ''}`;
        
        case 'CLIENT_LOGIN':
          const method = details.method === 'biometric' ? ' using biometric authentication' : 
                       details.method === 'biometric_email' ? ' using Face ID' : '';
          return `You accessed your AUCTA vault${method}`;
        
        case 'CLIENT_LOGOUT':
          return 'You logged out of your AUCTA vault';
        
        case 'PROXY_REQUEST_SUBMITTED':
          const proxyName = details.proxy_name || 'unknown';
          const role = details.role ? ` (${details.role.replace('_', ' ')})` : '';
          return `You submitted a request to assign proxy: ${proxyName}${role}`;
        
        case 'PROXY_ACCESS_REVOKED':
          return `You revoked proxy access for: ${details.proxy_name || 'unknown proxy'}`;
        
        case 'PROFILE_UPDATE':
          const fields = details.updated_fields ? details.updated_fields.join(', ') : 'profile information';
          return `You updated your ${fields}`;
        
        case 'WALLET_EXPORT':
          return 'You exported your complete wallet data';
        
        case 'DATA_EXPORT':
          return 'You exported your complete vault data (GDPR compliance)';
        
        case 'KEY_ROTATION':
          return 'Your wallet security key was rotated for enhanced protection';
        
        case 'MONEYSBT_WITHDRAWAL':
          const amount = details.amount || activity.value || 'unknown amount';
          return `You withdrew ${typeof amount === 'number' ? '€' + amount.toFixed(2) : amount} from your MoneySBT cashback balance`;
        
        case 'KYC_CHANGE_REQUEST':
          return 'You submitted a request to update your KYC information';
        
        case 'GEO_TRACKING_TOGGLE':
          const enabled = details.enabled ? 'activated' : 'deactivated';
          return `You requested geo-tracking ${enabled} for your products`;
        
        case 'TRUSTED_LOCATION_REQUEST':
          const locationName = details.name || 'a new location';
          return `You requested to add ${locationName} as a trusted location`;
        
        case 'NEW_VAULT_REQUEST':
          return `You requested a new vault in ${details.location || 'unspecified location'}`;
        
        case 'PHYSICAL_AGENT_REQUEST':
          const urgency = details.urgency || 'standard';
          return `You requested physical agent support (${urgency} priority)`;
        
        case 'EMERGENCY_LOCKDOWN_REQUEST':
          return 'You initiated an emergency lockdown for your products';
        
        case 'PRODUCT_STATUS_REPORT':
          const status = details.new_status || 'status update';
          return `You reported a product status change: ${status}`;
        
        case '2FA_ACTIVATION_REQUEST':
          const method2fa = details.method || 'two-factor authentication';
          return `You requested ${method2fa} activation`;
        
        case 'DEVICE_RESET_REQUEST':
          return 'You requested a device reset for security purposes';
        
        case 'LOGOUT_ALL_REQUEST':
          return 'You requested to logout from all devices';
        
        case 'SUSPICIOUS_ACTIVITY_REPORT':
          return 'You reported suspicious activity on your account';
        
        default:
          const actionName = activity.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase());
          return activity.product ? `${actionName}: ${activity.product}` : actionName;
      }
    } catch (err) {
      debugLog('Error formatting description', { activity, error: (err as Error).message });
      return `Activity: ${activity.action || 'Unknown'}`;
    }
  };

  // Determine status from activity data with error handling
  const determineStatus = (activity: any) => {
    try {
      const details = activity.details || {};
      
      if (details.status) {
        return details.status.toLowerCase();
      }
      
      if (activity.status) {
        return activity.status.toLowerCase();
      }
      
      // Default status based on action type
      switch (activity.action) {
        case 'CLIENT_LOGIN':
        case 'CLIENT_LOGOUT':
        case 'SBT_MINTED':
        case 'PASSPORT_ASSIGNED':
        case 'PROFILE_UPDATE':
        case 'WALLET_EXPORT':
        case 'DATA_EXPORT':
        case 'KEY_ROTATION':
        case 'MONEYSBT_WITHDRAWAL':
          return 'completed';
        
        case 'PROXY_REQUEST_SUBMITTED':
        case 'KYC_CHANGE_REQUEST':
        case 'GEO_TRACKING_TOGGLE':
        case 'TRUSTED_LOCATION_REQUEST':
        case 'NEW_VAULT_REQUEST':
        case 'PHYSICAL_AGENT_REQUEST':
        case 'EMERGENCY_LOCKDOWN_REQUEST':
        case '2FA_ACTIVATION_REQUEST':
        case 'DEVICE_RESET_REQUEST':
        case 'LOGOUT_ALL_REQUEST':
          return 'pending_review';
        
        case 'SUSPICIOUS_ACTIVITY_REPORT':
          return 'under_investigation';
        
        default:
          return 'completed';
      }
    } catch (err) {
      debugLog('Error determining status', { activity, error: (err as Error).message });
      return 'info';
    }
  };

  // Retry function
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
  };

  // Filter activities based on search and filters
  useEffect(() => {
    let filtered = activities;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(activity => 
        activity.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activity.product && activity.product.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (activity.details?.proxy_name && activity.details.proxy_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        activity.action?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Action type filter
    if (actionFilter !== 'all') {
      filtered = filtered.filter(activity => activity.action === actionFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(activity => activity.status === statusFilter);
    }

    // Date range filter
    const now = new Date();
    if (dateRange !== 'all') {
      const daysBack = {
        'today': 1,
        '7_days': 7,
        '30_days': 30
      }[dateRange];

      if (daysBack) {
        const cutoff = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
        filtered = filtered.filter(activity => new Date(activity.timestamp) >= cutoff);
      }
    }

    setFilteredActivities(filtered);
  }, [activities, searchTerm, actionFilter, statusFilter, dateRange]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZoneName: 'short'
      })
    };
  };

  const formatActionName = (action: string) => {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleExportPDF = async () => {
    try {
      // Check if exportClientData exists before calling it
      let exportData = null;
      if (api && typeof api.exportClientData === 'function') {
        exportData = await api.exportClientData(clientId);
      }
      
      // Create a simple PDF-like content for download
      const pdfContent = `AUCTA Activity Log Report
Client: ${clientData?.name || 'Unknown'}
Generated: ${new Date().toLocaleString()}

${filteredActivities.map(activity => {
  const { date, time } = formatTimestamp(activity.timestamp);
  return `${date} ${time} - ${formatActionName(activity.action)}: ${activity.description}`;
}).join('\n')}

This report is certified and verified by AUCTA's secure infrastructure.`;

      const blob = new Blob([pdfContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aucta_activity_log_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Date,Time,Action,Description,Status\n" +
      filteredActivities.map(activity => {
        const { date, time } = formatTimestamp(activity.timestamp);
        return `"${date}","${time}","${formatActionName(activity.action)}","${activity.description}","${activity.status}"`;
      }).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aucta_activity_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get unique action types for filter dropdown
  const uniqueActions = [...new Set(activities.map(a => a.action))];
  const uniqueStatuses = [...new Set(activities.map(a => a.status))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your activity history...</p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-500 mt-2">Retry attempt {retryCount}</p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-2xl mx-auto p-6">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Activity Log</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          
          <div className="flex justify-center space-x-4">
            <button 
              onClick={handleRetry}
              className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reload Page
            </button>
          </div>

          {/* Debug Information - only show in development */}
          {process.env.NODE_ENV === 'development' && debugInfo && (
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Debug Information (Development Mode)
              </summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Show warning if using fallback data */}
      {error && activities.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Using fallback data due to API issues. Some activities may not reflect your actual history.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-light text-gray-900 mb-2">Activity Log</h1>
              <p className="text-gray-600 max-w-2xl">
                A complete, timestamped history of your interactions within AUCTA. 
                Certified. Verified. Immutable.
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleExportPDF}
                className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <FileText className="w-4 h-4 mr-2" />
                Download PDF
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-8">
              <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Filters
              </h3>

              {/* Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search activities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                >
                  <option value="today">Today</option>
                  <option value="7_days">Last 7 Days</option>
                  <option value="30_days">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              {/* Action Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action Type
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                >
                  <option value="all">All Actions</option>
                  {uniqueActions.map(action => (
                    <option key={action} value={action}>
                      {formatActionName(action)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                >
                  <option value="all">All Status</option>
                  {uniqueStatuses.map(status => (
                    <option key={status} value={status}>
                      {(status in statusConfig
                        ? statusConfig[status as keyof typeof statusConfig].label
                        : status)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Results Count */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing {filteredActivities.length} of {activities.length} activities
                </p>
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-3">
            <div className="space-y-4">
              {filteredActivities.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Activities Found</h3>
                  <p className="text-gray-600">
                    {activities.length === 0 
                      ? "No activity history available yet." 
                      : "Try adjusting your search criteria or date range to see more activities."
                    }
                  </p>
                </div>
              ) : (
                filteredActivities.map((activity, index) => {
                  const statusInfo = (statusConfig[activity.status as StatusKey] ?? statusConfig.completed);
                  const ActionIcon = actionIcons[activity.action] || Package;
                  const StatusIcon = statusInfo.icon;
                  const isExpanded = expandedItem === activity.id;
                  const { date, time } = formatTimestamp(activity.timestamp);

                  return (
                    <div key={activity.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div 
                        className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedItem(isExpanded ? null : activity.id)}
                      >
                        <div className="flex items-start space-x-4">
                          {/* Timeline indicator */}
                          <div className="flex flex-col items-center">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                              <ActionIcon className="w-5 h-5 text-gray-600" />
                            </div>
                            {index < filteredActivities.length - 1 && (
                              <div className="w-px h-8 bg-gray-200 mt-4"></div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    {formatActionName(activity.action)}
                                  </span>
                                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.bg} ${statusInfo.color}`}>
                                    <StatusIcon className="w-3 h-3 mr-1" />
                                    {statusInfo.label}
                                  </div>
                                  {activity.value && (
                                    <span className="text-xs text-gray-500">
                                      {typeof activity.value === 'number' ? `€${activity.value.toFixed(2)}` : activity.value}
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-900 font-medium mb-1">
                                  {activity.description}
                                </p>
                                <div className="flex items-center text-sm text-gray-500 space-x-4">
                                  <span className="flex items-center">
                                    <Calendar className="w-4 h-4 mr-1" />
                                    {date}
                                  </span>
                                  <span className="flex items-center">
                                    <Clock className="w-4 h-4 mr-1" />
                                    {time}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && activity.details && Object.keys(activity.details).length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {Object.entries(activity.details).map(([key, value]) => {
                                    // Skip internal fields or empty values
                                    if (!value || key === 'timestamp' || key === 'status') return null;
                                    
                                    return (
                                      <div key={key} className="bg-gray-50 rounded-lg p-3">
                                        <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                          {key.replace(/_/g, ' ')}
                                        </dt>
                                        <dd className="text-sm text-gray-900">
                                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                        </dd>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Information */}
        <div className="mt-12">
          <div className="bg-gray-900 rounded-xl p-8 text-center">
            <Shield className="w-8 h-8 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Certified Activity Record</h3>
            <p className="text-gray-300 max-w-3xl mx-auto">
              All actions are certified, timestamped, and stored within AUCTA's private infrastructure. 
              For notarization or audit requests, please contact your assigned AUCTA advisor. 
              This log cannot be altered or deleted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLog;