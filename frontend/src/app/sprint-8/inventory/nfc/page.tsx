'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { nfcInventoryAPI, type HubOverview, type NFCUnit } from '@/lib/nfcInventoryApi';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  ArrowRight,
  Search,
  Filter,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Calendar,
  MapPin,
  Info,
  Plus,
  AlertCircle,
  Activity,
  MoreHorizontal,
  History,
  Ban,
  ShieldAlert,
  FileText,
  Download,
  Upload,
  Send,
  Edit,
  Trash2,
  CheckSquare,
  AlertOctagon,
  Copy,
  UserCheck
} from 'lucide-react';





export default function NFCInventoryPage() {
  const [selectedHub, setSelectedHub] = useState<number | null>(null);
  const [hubData, setHubData] = useState<HubOverview[]>([]);
  const [nfcUnits, setNfcUnits] = useState<NFCUnit[]>([]);
  const [availableLots, setAvailableLots] = useState<string[]>([]);
  // Load sticky filters from localStorage
  const loadFiltersFromStorage = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nfc-inventory-filters');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.warn('Failed to parse saved filters:', e);
        }
      }
    }
    return {
      status: 'all',
      lot: 'all',
      search: '',
      dateFrom: '',
      dateTo: '',
      reservedOnly: false,
      failureHistory: false
    };
  };

  const [filters, setFilters] = useState(loadFiltersFromStorage());
  const [selectedUIDs, setSelectedUIDs] = useState<string[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRMAModal, setShowRMAModal] = useState(false);
  const [showQuarantineModal, setShowQuarantineModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [showTransferStuckModal, setShowTransferStuckModal] = useState(false);
  const [showSupplierRecallModal, setShowSupplierRecallModal] = useState(false);
  const [showDuplicateUIDModal, setShowDuplicateUIDModal] = useState(false);
  
  // Movement wizard states
  const [receiveForm, setReceiveForm] = useState({
    lotId: '',
    quantity: '',
    supplierRef: '',
    uidList: '',
    evidenceFiles: [] as File[]
  });
  const [assignForm, setAssignForm] = useState({
    shipmentId: '',
    note: '',
    hubCapacityWarning: false
  });
  const [transferForm, setTransferForm] = useState({
    fromHubId: 0,
    toHubId: 0,
    selectedUIDs: [] as string[],
    quantity: '',
    reason: '',
    eta: '',
    transferMode: 'uids' as 'uids' | 'quantity'
  });
  const [rmaForm, setRMAForm] = useState({
    uid: '',
    reasonCode: '',
    notes: '',
    replacementUID: '',
    autoSuggestedReplacements: [] as string[]
  });

  // Edge case handling states
  const [notFoundForm, setNotFoundForm] = useState({
    missingUID: '',
    shipmentId: '',
    replacementUID: '',
    reason: '',
    suggestedReplacements: [] as string[]
  });
  const [transferStuckForm, setTransferStuckForm] = useState({
    transferId: '',
    expectedUIDs: [] as string[],
    arrivedUIDs: [] as string[],
    missingUIDs: [] as string[],
    actionType: 'mark_arrived' as 'mark_arrived' | 'open_incident'
  });
  const [supplierRecallForm, setSupplierRecallForm] = useState({
    lot: '',
    supplier: '',
    recallReason: '',
    impactAnalysis: {
      affectedUIDs: 0,
      reservedShipments: 0,
      installedUnits: 0,
      customerImpact: []
    }
  });
  const [duplicateUIDForm, setDuplicateUIDForm] = useState({
    uploadedUIDs: [] as string[],
    duplicateUIDs: [] as string[],
    validUIDs: [] as string[],
    resolution: 'block' as 'block' | 'append_after_fix'
  });
  const [currentAction, setCurrentAction] = useState<{
    type: string;
    uid?: string;
    lot?: string;
    data?: any;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [userRole] = useState<'ops' | 'tech' | 'admin'>('ops'); // Mock user role
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  // Telemetry tracking
  const [telemetryData, setTelemetryData] = useState({
    assignmentStartTime: null as number | null,
    transferStartTimes: {} as Record<string, number>,
    quarantineStartTimes: {} as Record<string, number>
  });

  // Load initial data
  useEffect(() => {
    loadHubData();
  }, []);

  // Save filters to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nfc-inventory-filters', JSON.stringify(filters));
    }
  }, [filters]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefreshEnabled) {
      const interval = setInterval(() => {
        loadHubData();
        if (selectedHub) {
          loadDetailData(selectedHub);
        }
        setLastRefresh(new Date());
      }, 15000); // 15 second refresh

      setRefreshInterval(interval);

      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [autoRefreshEnabled, selectedHub]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  const loadHubData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await nfcInventoryAPI.getHubOverview();
      if (response.success) {
        setHubData(response.data);
        
        // Track telemetry for days of cover by hub
        response.data.forEach((hub: HubOverview) => {
          trackTelemetry('nfc.cover.days_by_hub', {
            hubId: hub.id,
            hubName: hub.name,
            daysOfCover: hub.daysOfCover,
            stockLevel: hub.status.stock,
            burnRate7d: hub.burnRate7d
          });
        });
        
        // Track failure rates by lot (mock data - would come from real API)
        const mockLotFailureRates = [
          { lot: 'LOT-2024-001', readFailures: 5, writeFailures: 3, totalTests: 487 },
          { lot: 'LOT-2024-002', readFailures: 1, writeFailures: 2, totalTests: 234 },
        ];
        
        mockLotFailureRates.forEach(lotData => {
          const failureRate = ((lotData.readFailures + lotData.writeFailures) / lotData.totalTests) * 100;
          trackTelemetry('nfc.failure.rate_by_lot', {
            lot: lotData.lot,
            readFailures: lotData.readFailures,
            writeFailures: lotData.writeFailures,
            totalTests: lotData.totalTests,
            failureRate: failureRate
          });
        });
      } else {
        setError(response.error || 'Failed to load hub data');
      }
    } catch (error) {
      console.error('Error loading hub data:', error);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const loadHubDetail = async (hubId: number) => {
    setLoading(true);
    setError(null);
    try {
      const [detailResponse, lotsResponse] = await Promise.all([
        nfcInventoryAPI.getHubDetail(hubId, filters),
        nfcInventoryAPI.getHubLots(hubId)
      ]);
      
      if (detailResponse.success) {
        setNfcUnits(detailResponse.data);
      } else {
        setError(detailResponse.error || 'Failed to load hub detail');
      }
      
      if (lotsResponse.success) {
        setAvailableLots(lotsResponse.data.map(lot => lot.lot));
      }
    } catch (error) {
      console.error('Error loading hub detail:', error);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      stock: <Badge className="bg-blue-100 text-blue-800 border-blue-200">Stock</Badge>,
      reserved: <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Reserved</Badge>,
      installed: <Badge className="bg-green-100 text-green-800 border-green-200">Installed</Badge>,
      rma: <Badge className="bg-red-100 text-red-800 border-red-200">RMA</Badge>,
      quarantined: <Badge className="bg-orange-100 text-orange-800 border-orange-200">Quarantined</Badge>
    };
    return badges[status as keyof typeof badges] || <Badge variant="secondary">{status}</Badge>;
  };

  const getHubStatusIcon = (hub: HubOverview) => {
    if (hub.statusColor === 'red') return <XCircle className="h-5 w-5 text-red-500" />;
    if (hub.statusColor === 'amber') return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  const calculateStockProgress = (current: number, threshold: number) => {
    return Math.min((current / threshold) * 100, 100);
  };

  // Calculation helpers with transparent formulas
  const calculateBurnRate = (installs: number, days: number) => {
    return days > 0 ? installs / days : 0;
  };

  const calculateDaysOfCover = (freeStock: number, burnRate7d: number) => {
    return burnRate7d > 0 ? Math.round(freeStock / burnRate7d) : Infinity;
  };

  const calculateFailureRate = (failedTests: number, totalAttempts: number) => {
    return totalAttempts > 0 ? ((failedTests / totalAttempts) * 100) : 0;
  };

  // Smart defaults and suggestions helpers
  const getSmartDefaults = () => {
    const selectedHubData = hubData.find(h => h.id === selectedHub);
    
    return {
      // Suggested transfer quantity based on low stock
      suggestedTransferQty: (toHubId: number) => {
        const toHub = hubData.find(h => h.id === toHubId);
        if (!toHub || !selectedHubData) return 50; // Default
        
        const deficit = Math.max(0, toHub.threshold - toHub.status.stock);
        const safetyBuffer = Math.ceil(toHub.burnRate7d * 3); // 3 days buffer
        return Math.min(selectedHubData.status.stock, deficit + safetyBuffer);
      },

      // Suggested replacement UID for RMA
      suggestedReplacementUID: (currentLot: string) => {
        // Filter NFCs by same lot and available status
        const sameLinefUnits = nfcUnits.filter(nfc => 
          nfc.lot === currentLot && 
          nfc.status === 'stock' && 
          !isQuarantined(nfc)
        );
        return sameLinefUnits.slice(0, 3).map(nfc => nfc.uid); // Top 3 suggestions
      },

      // Suggested ETA for transfers
      suggestedETA: (toHubId: number) => {
        const toHub = hubData.find(h => h.id === toHubId);
        if (!toHub) return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // +1 day default
        
        // Smart ETA based on hub location/distance
        const hubDistances: { [key: string]: number } = {
          'London': 1, 'Paris': 1, 'Frankfurt': 2, 'New York': 5, 'Milan': 2, 'Zurich': 2
        };
        
        const days = hubDistances[toHub.name.split(' ')[0]] || 2;
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
    };
  };

  // Error message helpers for forbidden transitions
  // Telemetry tracking functions
  const trackTelemetry = (eventType: string, data: any) => {
    const telemetryEvent = {
      type: eventType,
      timestamp: Date.now(),
      hubId: selectedHub,
      userRole,
      ...data
    };
    
    console.log('Telemetry Event:', telemetryEvent);
    
    // In production, this would send to analytics service
    // analytics.track(telemetryEvent);
  };

  const startTelemetryTimer = (type: 'assignment' | 'transfer' | 'quarantine', id?: string) => {
    const startTime = Date.now();
    
    switch (type) {
      case 'assignment':
        setTelemetryData(prev => ({ ...prev, assignmentStartTime: startTime }));
        break;
      case 'transfer':
        if (id) {
          setTelemetryData(prev => ({ 
            ...prev, 
            transferStartTimes: { ...prev.transferStartTimes, [id]: startTime } 
          }));
        }
        break;
      case 'quarantine':
        if (id) {
          setTelemetryData(prev => ({ 
            ...prev, 
            quarantineStartTimes: { ...prev.quarantineStartTimes, [id]: startTime } 
          }));
        }
        break;
    }
  };

  const endTelemetryTimer = (type: 'assignment' | 'transfer' | 'quarantine', id?: string, additionalData?: any) => {
    const endTime = Date.now();
    let duration = 0;
    
    switch (type) {
      case 'assignment':
        if (telemetryData.assignmentStartTime) {
          duration = endTime - telemetryData.assignmentStartTime;
          trackTelemetry('nfc.assign.time_ms', { duration, ...additionalData });
          setTelemetryData(prev => ({ ...prev, assignmentStartTime: null }));
        }
        break;
      case 'transfer':
        if (id && telemetryData.transferStartTimes[id]) {
          duration = endTime - telemetryData.transferStartTimes[id];
          trackTelemetry('nfc.transfer.time_to_arrive_ms', { duration, transferId: id, ...additionalData });
          setTelemetryData(prev => {
            const newTimes = { ...prev.transferStartTimes };
            delete newTimes[id];
            return { ...prev, transferStartTimes: newTimes };
          });
        }
        break;
      case 'quarantine':
        if (id && telemetryData.quarantineStartTimes[id]) {
          duration = endTime - telemetryData.quarantineStartTimes[id];
          trackTelemetry('nfc.quarantine.time_to_clear_ms', { duration, lot: id, ...additionalData });
          setTelemetryData(prev => {
            const newTimes = { ...prev.quarantineStartTimes };
            delete newTimes[id];
            return { ...prev, quarantineStartTimes: newTimes };
          });
        }
        break;
    }
  };

  // Edge case detection and handling
  const detectEdgeCases = () => {
    // Check for stuck transfers (over 3 days)
    const stuckTransfers = []; // Would be populated from real data
    
    // Check for cross-hub assignment attempts
    const crossHubAttempts = []; // Would be populated from validation
    
    // Check for duplicate UIDs in recent imports
    const duplicateUIDs = []; // Would be populated from import validation
    
    return {
      stuckTransfers,
      crossHubAttempts,
      duplicateUIDs
    };
  };

  const getTransitionError = (action: string, currentStatus: string, reason?: string) => {
    const errors = {
      'assign_quarantined': 'Cannot assign quarantined NFC. Lift quarantine first or select a different UID.',
      'assign_reserved': 'NFC is already reserved. Unreserve first if needed.',
      'assign_installed': 'NFC is already installed and cannot be reassigned.',
      'transfer_reserved': 'Cannot transfer reserved NFCs. Unreserve them first.',
      'transfer_quarantined': 'Cannot transfer quarantined NFCs. Lift quarantine first.',
      'unreserve_started': 'Cannot unreserve: Hub job has already started. Ops override required.',
      'rma_terminal': 'NFC is already in RMA status (terminal state).',
      'no_stock': 'No available stock for this operation. Consider receiving more inventory or transferring from another hub.',
      'capacity_exceeded': 'Hub capacity would be exceeded. Consider transferring to a different hub.'
    };
    
    return errors[reason as keyof typeof errors] || `Invalid transition: Cannot ${action} NFC with status '${currentStatus}'`;
  };

  const getCalculationTooltip = (type: 'burnRate7d' | 'burnRate30d' | 'daysOfCover' | 'failureRate' | 'upcomingDemand', data: any) => {
    switch (type) {
      case 'burnRate7d':
        return (
          <div className="space-y-2">
            <div className="font-medium">7-Day Burn Rate Calculation</div>
            <div className="text-sm space-y-1">
              <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                burn_rate_7d = installs_last_7_days ÷ 7
              </div>
              <div>Installs (7 days): {data.installs7d}</div>
              <div>Formula: {data.installs7d} ÷ 7 = {data.burnRate7d}/day</div>
              <div className="text-gray-600 text-xs mt-1">
                Measures average daily NFC installation rate
              </div>
            </div>
          </div>
        );
      
      case 'burnRate30d':
        return (
          <div className="space-y-2">
            <div className="font-medium">30-Day Burn Rate Calculation</div>
            <div className="text-sm space-y-1">
              <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                burn_rate_30d = installs_last_30_days ÷ 30
              </div>
              <div>Installs (30 days): {data.installs30d}</div>
              <div>Formula: {data.installs30d} ÷ 30 = {data.burnRate30d}/day</div>
              <div className="text-gray-600 text-xs mt-1">
                Longer-term trend for capacity planning
              </div>
            </div>
          </div>
        );

      case 'daysOfCover':
        return (
          <div className="space-y-2">
            <div className="font-medium">Days of Cover Calculation</div>
            <div className="text-sm space-y-1">
              <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                days_of_cover = free_stock ÷ burn_rate_7d
              </div>
              <div>Free Stock: {data.freeStock}</div>
              <div>7d Burn Rate: {data.burnRate7d}/day</div>
              {data.burnRate7d > 0 ? (
                <div>Formula: {data.freeStock} ÷ {data.burnRate7d} = {data.daysOfCover} days</div>
              ) : (
                <div className="text-amber-600">
                  ∞ (no recent installs) - Consider reviewing demand forecast
                </div>
              )}
              <div className="text-gray-600 text-xs mt-1">
                Estimated days until stock depletion at current rate
              </div>
            </div>
          </div>
        );

      case 'failureRate':
        return (
          <div className="space-y-2">
            <div className="font-medium">Failure Rate Calculation (Rolling)</div>
            <div className="text-sm space-y-1">
              <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                failure_rate = failed_tests ÷ total_attempted_installs × 100
              </div>
              <div>Failed Tests: {data.failedTests}</div>
              <div>Total Attempts: {data.totalAttempts}</div>
              <div>Formula: {data.failedTests} ÷ {data.totalAttempts} × 100 = {data.failureRate.toFixed(1)}%</div>
              <div className="text-gray-600 text-xs mt-1">
                Rolling window includes read/write test failures during installation
              </div>
            </div>
          </div>
        );

      case 'upcomingDemand':
        return (
          <div className="space-y-2">
            <div className="font-medium">Upcoming Demand Calculation</div>
            <div className="text-sm space-y-1">
              <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                upcoming_demand = COUNT(T3_shipments WHERE planned_intake ≤ window)
              </div>
              <div>T3 Shipments (7d): {data.demand7d}</div>
              <div>T3 Shipments (14d): {data.demand14d}</div>
              <div className="text-gray-600 text-xs mt-1">
                Planned Tier 3 shipments assigned to this hub within timeframe
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Action validation helpers
  const validateAction = (action: string, uid?: string, targetStatus?: string): string | null => {
    if (!uid) return null;
    
    const nfc = nfcUnits.find(n => n.uid === uid);
    if (!nfc) return 'NFC not found';
    
    setActionError(null); // Clear previous errors
    
    switch (action) {
      case 'assign':
        if (nfc.status === 'quarantined') {
          return getTransitionError('assign', nfc.status, 'assign_quarantined');
        }
        if (nfc.status === 'reserved') {
          return getTransitionError('assign', nfc.status, 'assign_reserved');
        }
        if (nfc.status === 'installed') {
          return getTransitionError('assign', nfc.status, 'assign_installed');
        }
        // Check for cross-hub assignment attempt
        if (nfc.hub !== selectedHub) {
          return `Cannot assign NFC from different hub. NFC is at ${hubData.find(h => h.id === nfc.hub)?.name || 'Unknown Hub'}, but you're managing ${hubData.find(h => h.id === selectedHub)?.name || 'Current Hub'}. Transfer the NFC first, then assign.`;
        }
        break;
        
      case 'transfer':
        if (nfc.status === 'reserved') {
          return getTransitionError('transfer', nfc.status, 'transfer_reserved');
        }
        if (nfc.status === 'quarantined') {
          return getTransitionError('transfer', nfc.status, 'transfer_quarantined');
        }
        break;
        
      case 'unreserve':
        if (nfc.status !== 'reserved') {
          return `Cannot unreserve NFC with status '${nfc.status}'. Only reserved NFCs can be unreserved.`;
        }
        // Mock check for started hub job
        const hubJobStarted = Math.random() > 0.8; // 20% chance job started
        if (hubJobStarted && userRole !== 'ops') {
          return getTransitionError('unreserve', nfc.status, 'unreserve_started');
        }
        break;
        
      case 'rma':
        if (nfc.status === 'rma') {
          return getTransitionError('rma', nfc.status, 'rma_terminal');
        }
        break;
    }
    
    return null;
  };

  // Helper functions for actions
  const handleSelectUID = (uid: string, checked: boolean) => {
    if (checked) {
      setSelectedUIDs(prev => [...prev, uid]);
    } else {
      setSelectedUIDs(prev => prev.filter(id => id !== uid));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUIDs(nfcUnits.map(unit => unit.uid));
    } else {
      setSelectedUIDs([]);
    }
  };

  const getLastAction = (unit: NFCUnit) => {
    if (unit.status === 'installed' && unit.installedAt) {
      return `Install (${new Date(unit.installedAt).toLocaleDateString()})`;
    } else if (unit.status === 'reserved' && unit.reservedFor) {
      return `Reserve for ${unit.reservedFor}`;
    } else if (unit.status === 'rma') {
      return `RMA: ${unit.rmaReason || 'Unknown'}`;
    } else if (unit.status === 'quarantined') {
      return 'Quarantined';
    } else {
      return `Intake (${new Date(unit.receivedDate).toLocaleDateString()})`;
    }
  };

  const canAssignToShipment = (unit: NFCUnit) => {
    return unit.status === 'stock' && unit.testResults.readTest && unit.testResults.writeTest;
  };



  const exportToCSV = () => {
    const headers = ['UID', 'Lot', 'Status', 'Reserved For', 'Last Action', 'Test Results', 'Received Date', 'Notes'];
    const csvData = [
      headers.join(','),
      ...nfcUnits.map(unit => [
        unit.uid,
        unit.lot,
        unit.status,
        unit.reservedFor || '',
        getLastAction(unit),
        `R:${unit.testResults.readTest ? 'PASS' : 'FAIL'} W:${unit.testResults.writeTest ? 'PASS' : 'FAIL'}`,
        new Date(unit.receivedDate).toLocaleDateString(),
        (unit.notes || '').replace(/,/g, ';')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nfc-inventory-hub-${selectedHub}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Movement validation functions
  const validateShipmentAssignment = async (shipmentId: string, hubId: number) => {
    // Mock validation - in real implementation, check if shipment is T3 and same hub
    const mockValidation = {
      isT3: true,
      isCorrectHub: true,
      hubCapacityHeld: false,
      message: mockValidation.hubCapacityHeld ? '' : 'Warning: Hub sewing capacity not confirmed for this shipment'
    };
    return mockValidation;
  };

  const canTransferUID = (unit: NFCUnit) => {
    return unit.status === 'stock' && !isQuarantined(unit);
  };

  const isQuarantined = (unit: NFCUnit) => {
    return unit.status === 'quarantined' || (unit.notes && unit.notes.includes('quarantine'));
  };

  const canUnreserve = (unit: NFCUnit) => {
    // Mock job started check - in real implementation, check hub_processing_jobs
    const hubJobStarted = false;
    return unit.status === 'reserved' && (userRole === 'ops' || !hubJobStarted);
  };

  const getSuggestedReplacements = (unit: NFCUnit) => {
    return nfcUnits
      .filter(u => u.lot === unit.lot && u.status === 'stock' && u.testResults.readTest && u.testResults.writeTest)
      .slice(0, 5)
      .map(u => u.uid);
  };

  const parseUIDList = (uidText: string) => {
    return uidText
      .split(/[\n,;]/)
      .map(uid => uid.trim())
      .filter(uid => uid.length > 0);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, field: keyof typeof receiveForm) => {
    const files = event.target.files;
    if (files) {
      if (field === 'evidenceFiles') {
        setReceiveForm(prev => ({
          ...prev,
          evidenceFiles: Array.from(files)
        }));
      } else if (field === 'uidList' && files[0]) {
        const file = files[0];
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = e.target?.result as string;
            setReceiveForm(prev => ({
              ...prev,
              uidList: text
            }));
          };
          reader.readAsText(file);
        }
      }
    }
  };

  const renderHubOverview = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hubs</p>
                <p className="text-2xl font-bold">{hubData.length}</p>
              </div>
              <MapPin className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical Hubs</p>
                <p className="text-2xl font-bold text-red-600">
                  {hubData.filter(h => h.statusColor === 'red').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Stock</p>
                <p className="text-2xl font-bold">
                  {hubData.reduce((sum, hub) => sum + hub.status.stock, 0).toLocaleString()}
                </p>
              </div>
              <Package className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-1 cursor-help">
                      <p className="text-sm font-medium text-gray-600">Avg Burn Rate</p>
                      <Info className="h-3 w-3 text-gray-400" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-2">
                      <div className="font-medium">Average Burn Rate Calculation</div>
                      <div className="text-sm space-y-1">
                        <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                          avg_burn_rate = SUM(hub_burn_rates) ÷ total_hubs
                        </div>
                        <div>Total Hubs: {hubData.length}</div>
                        <div>Average: {(hubData.reduce((sum, hub) => sum + hub.burnRate7d, 0) / hubData.length).toFixed(1)}/day</div>
                        <div className="text-gray-600 text-xs mt-1">
                          Network-wide average daily installation rate
                        </div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
                <p className="text-2xl font-bold">
                  {(hubData.reduce((sum, hub) => sum + hub.burnRate7d, 0) / hubData.length).toFixed(1)}/day
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hub Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hubData.map((hub) => (
          <Card key={hub.id} className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
            hub.statusColor === 'red' ? 'border-red-200 bg-red-50/50' : 
            hub.statusColor === 'amber' ? 'border-yellow-200 bg-yellow-50/50' : 
            'border-green-200 bg-green-50/50'
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">{hub.name}</CardTitle>
                  <p className="text-sm text-gray-600">{hub.code} • {hub.location}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {getHubStatusIcon(hub)}
                  {hub.lowStock && (
                    <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Status Counts */}
              <div className="grid grid-cols-5 gap-2 text-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Stock</p>
                  <p className="text-lg font-bold text-blue-800">{hub.status.stock}</p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <p className="text-xs text-yellow-600 font-medium">Reserved</p>
                  <p className="text-lg font-bold text-yellow-800">{hub.status.reserved}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">Installed</p>
                  <p className="text-lg font-bold text-green-800">{hub.status.installed}</p>
                </div>
                <div className="p-2 bg-red-100 rounded-lg">
                  <p className="text-xs text-red-600 font-medium">RMA</p>
                  <p className="text-lg font-bold text-red-800">{hub.status.rma}</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <p className="text-xs text-orange-600 font-medium">Quarantined</p>
                  <p className="text-lg font-bold text-orange-800">{hub.status.quarantined}</p>
                </div>
              </div>

              {/* Stock Level Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Stock Level</span>
                  <span>{hub.status.stock} / {hub.threshold}</span>
                </div>
                <Progress 
                  value={calculateStockProgress(hub.status.stock, hub.threshold)}
                  className={`h-2 ${
                    hub.statusColor === 'red' ? '[&>div]:bg-red-500' :
                    hub.statusColor === 'amber' ? '[&>div]:bg-yellow-500' :
                    '[&>div]:bg-green-500'
                  }`}
                />
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2 cursor-help">
                        <TrendingUp className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">Burn Rate (7d)</span>
                        <Info className="h-3 w-3 text-gray-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {getCalculationTooltip('burnRate7d', {
                        installs7d: hub.status.installed, // Mock data - would be actual 7d installs
                        burnRate7d: hub.burnRate7d
                      })}
                    </TooltipContent>
                  </Tooltip>
                  <p className="font-semibold">{hub.burnRate7d}/day</p>
                </div>
                <div className="space-y-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2 cursor-help">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">Days of Cover</span>
                        <Info className="h-3 w-3 text-gray-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {getCalculationTooltip('daysOfCover', {
                        freeStock: hub.status.stock,
                        burnRate7d: hub.burnRate7d,
                        daysOfCover: hub.daysOfCover
                      })}
                    </TooltipContent>
                  </Tooltip>
                  <p className="font-semibold">
                    {hub.daysOfCover === 'infinite' ? (
                      <span className="text-amber-600">∞</span>
                    ) : (
                      `${hub.daysOfCover} days`
                    )}
                  </p>
                </div>
              </div>

              {/* Upcoming Demand */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-1 cursor-help mb-1">
                      <p className="text-xs text-gray-600">Upcoming T3 Demand</p>
                      <Info className="h-3 w-3 text-gray-400" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {getCalculationTooltip('upcomingDemand', {
                      demand7d: hub.upcomingDemand7d,
                      demand14d: hub.upcomingDemand14d
                    })}
                  </TooltipContent>
                </Tooltip>
                <div className="flex justify-between text-sm">
                  <span>Next 7 days: <strong>{hub.upcomingDemand7d}</strong></span>
                  <span>Next 14 days: <strong>{hub.upcomingDemand14d}</strong></span>
                </div>
              </div>

              {/* Lot Health & Alerts */}
              {(hub.lotHealth.quarantinedLots > 0 || hub.lotHealth.highFailureLots > 0) && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-sm space-y-2">
                    {hub.lotHealth.quarantinedLots > 0 && (
                      <div className="flex items-center justify-between">
                        <span>{hub.lotHealth.quarantinedLots} lot(s) under quarantine</span>
                        <Button 
                          size="xs" 
                          variant="outline"
                          onClick={() => {
                            setCurrentAction({ type: 'investigate_lot', data: { hubId: hub.id, alertType: 'quarantine' } });
                            setShowAlertModal(true);
                          }}
                        >
                          Investigate
                        </Button>
                      </div>
                    )}
                    {hub.lotHealth.highFailureLots > 0 && (
                      <div className="flex items-center justify-between">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1 cursor-help">
                              <span>{hub.lotHealth.highFailureLots} lot(s) with high failure rate</span>
                              <Info className="h-3 w-3 text-gray-400" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {getCalculationTooltip('failureRate', {
                              failedTests: 15, // Mock data
                              totalAttempts: 65, // Mock data
                              failureRate: 23.1 // Mock data
                            })}
                          </TooltipContent>
                        </Tooltip>
                        <Button 
                          size="xs" 
                          variant="outline"
                          onClick={() => {
                            setCurrentAction({ type: 'investigate_lot', data: { hubId: hub.id, alertType: 'failure_rate' } });
                            setShowAlertModal(true);
                          }}
                        >
                          Review
                        </Button>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Low Stock Alert */}
              {hub.lowStock && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-sm">
                    <div className="flex items-center justify-between">
                      <span>Low stock alert - {hub.daysOfCover} days of cover remaining</span>
                      <Button 
                        size="xs"
                        onClick={() => {
                          setTransferForm(prev => ({ 
                            ...prev, 
                            toHubId: hub.id,
                            quantity: Math.max(hub.threshold - hub.status.stock, 100).toString(),
                            reason: 'Low stock replenishment'
                          }));
                          setShowTransferModal(true);
                        }}
                      >
                        Create Transfer
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedHub(hub.id);
                    loadHubDetail(hub.id);
                  }}
                  className="flex items-center space-x-1"
                >
                  <Info className="h-4 w-4" />
                  <span>View Details</span>
                </Button>
                
                {hub.lowStock && (
                  <Button
                    size="sm"
                    onClick={() => setShowTransferModal(true)}
                    className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Transfer</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderHubDetail = () => {
    const hub = hubData.find(h => h.id === selectedHub);
    if (!hub) return null;

    const filteredUnits = nfcUnits.filter(unit => {
      const matchesStatus = filters.status === 'all' || unit.status === filters.status;
      const matchesLot = filters.lot === 'all' || unit.lot === filters.lot;
      const matchesSearch = !filters.search || 
        unit.uid.toLowerCase().includes(filters.search.toLowerCase()) ||
        unit.lot.toLowerCase().includes(filters.search.toLowerCase()) ||
        (unit.reservedFor && unit.reservedFor.toLowerCase().includes(filters.search.toLowerCase()));
      
      const matchesReserved = !filters.reservedOnly || !!unit.reservedFor;
      
      const matchesFailure = !filters.failureHistory || 
        (!unit.testResults.readTest || !unit.testResults.writeTest || unit.status === 'rma');
      
      const matchesDateRange = (!filters.dateFrom || new Date(unit.receivedDate) >= new Date(filters.dateFrom)) &&
                              (!filters.dateTo || new Date(unit.receivedDate) <= new Date(filters.dateTo));
      
      return matchesStatus && matchesLot && matchesSearch && matchesReserved && matchesFailure && matchesDateRange;
    });

          // Use the availableLots state instead of deriving from nfcUnits

    return (
      <div className="space-y-6">
        {/* Hub Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedHub(null)}
              className="flex items-center space-x-1"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              <span>Back to Overview</span>
            </Button>
            <div>
              <h2 className="text-2xl font-bold">{hub.name}</h2>
              <p className="text-gray-600">{hub.code} • {hub.location}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {getHubStatusIcon(hub)}
            <Badge variant={hub.statusColor === 'red' ? 'destructive' : 
                          hub.statusColor === 'amber' ? 'secondary' : 'default'}>
              {hub.statusColor === 'red' ? 'Critical' :
               hub.statusColor === 'amber' ? 'Warning' : 'Healthy'}
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Primary Filters Row */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Filters:</span>
                </div>
                
                <Select value={filters.status} onValueChange={(value) => 
                  setFilters(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="installed">Installed</SelectItem>
                    <SelectItem value="rma">RMA</SelectItem>
                    <SelectItem value="quarantined">Quarantined</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.lot} onValueChange={(value) => 
                  setFilters(prev => ({ ...prev, lot: value }))}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Lots" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Lots</SelectItem>
                    {availableLots.map(lot => (
                      <SelectItem key={lot} value={lot}>{lot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search UID, Lot, or Shipment..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-64"
                  />
                </div>
              </div>

              {/* Secondary Filters Row */}
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Date received:</span>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-40"
                    placeholder="From"
                  />
                  <span className="text-sm text-gray-400">to</span>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="w-40"
                    placeholder="To"
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="reserved-only"
                      checked={filters.reservedOnly}
                      onCheckedChange={(checked) => 
                        setFilters(prev => ({ ...prev, reservedOnly: !!checked }))}
                    />
                    <Label htmlFor="reserved-only" className="text-sm">Reserved only</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="failure-history"
                      checked={filters.failureHistory}
                      onCheckedChange={(checked) => 
                        setFilters(prev => ({ ...prev, failureHistory: !!checked }))}
                    />
                    <Label htmlFor="failure-history" className="text-sm">Failure history</Label>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({ 
                    status: 'all', 
                    lot: 'all', 
                    search: '', 
                    dateFrom: '', 
                    dateTo: '', 
                    reservedOnly: false, 
                    failureHistory: false 
                  })}
                  className="flex items-center space-x-1"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Reset</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedUIDs.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium">{selectedUIDs.length} UIDs selected</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUIDs([])}
                  >
                    Clear Selection
                  </Button>
                </div>
                
                {userRole === 'ops' && (
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      onClick={() => setShowReceiveModal(true)}
                      className="flex items-center space-x-1"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Receive Batch</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowTransferModal(true)}
                      className="flex items-center space-x-1"
                    >
                      <Send className="h-4 w-4" />
                      <span>Transfer UIDs</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToCSV}
                      className="flex items-center space-x-1"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export CSV</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* NFC Units Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>NFC Units ({filteredUnits.length})</CardTitle>
            {userRole === 'ops' && (
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  onClick={exportToCSV}
                  variant="outline"
                  className="flex items-center space-x-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUIDs.length === filteredUnits.length && filteredUnits.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>UID</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reserved For</TableHead>
                    <TableHead>Last Action</TableHead>
                    <TableHead>Test Results</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnits.map((unit) => (
                    <TableRow key={unit.uid} className="group">
                      <TableCell>
                        <Checkbox
                          checked={selectedUIDs.includes(unit.uid)}
                          onCheckedChange={(checked) => handleSelectUID(unit.uid, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">{unit.uid}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{unit.lot}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(unit.status)}</TableCell>
                      <TableCell>
                        {unit.reservedFor ? (
                          <span className="text-sm font-mono bg-yellow-100 px-2 py-1 rounded text-yellow-800">
                            {unit.reservedFor}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="max-w-32 truncate" title={getLastAction(unit)}>
                          {getLastAction(unit)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            {unit.testResults.readTest ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-xs font-medium">R</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            {unit.testResults.writeTest ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-xs font-medium">W</span>
                          </div>
                          <span className="text-xs text-gray-500 ml-2">
                            {new Date(unit.testResults.lastTest).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-48">
                        <div className="truncate text-sm" title={unit.notes}>
                          {unit.notes || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            
                            {canAssignToShipment(unit) && (
                              <DropdownMenuItem
                                                                    onClick={() => {
                                      // Start telemetry timer for assignment
                                      startTelemetryTimer('assignment');
                                      
                                      // Validate assignment before opening modal
                                      const validationError = validateAction('assign', unit.uid);
                                      if (validationError) {
                                        setActionError(validationError);
                                        return;
                                      }
                                      
                                      setCurrentAction({ type: 'assign', uid: unit.uid });
                                      setShowAssignModal(true);
                                    }}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                Assign to Shipment
                              </DropdownMenuItem>
                            )}
                            
                            {canUnreserve(unit) && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setCurrentAction({ type: 'unreserve', uid: unit.uid });
                                  // Handle unreserve logic
                                }}
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Unreserve
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuItem
                              onClick={() => {
                                setCurrentAction({ type: 'rma', uid: unit.uid });
                                setShowRMAModal(true);
                              }}
                            >
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              Mark RMA
                            </DropdownMenuItem>
                            
                            {userRole === 'ops' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setCurrentAction({ type: 'quarantine', lot: unit.lot });
                                    setShowQuarantineModal(true);
                                  }}
                                >
                                  <ShieldAlert className="mr-2 h-4 w-4" />
                                  Quarantine Lot
                                </DropdownMenuItem>
                                
                                {unit.status === 'quarantined' && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setCurrentAction({ type: 'lift_quarantine', lot: unit.lot });
                                      // Handle lift quarantine
                                    }}
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Lift Quarantine
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setCurrentAction({ type: 'history', uid: unit.uid });
                                setShowHistoryModal(true);
                              }}
                            >
                              <History className="mr-2 h-4 w-4" />
                              View History
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredUnits.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No NFC units found matching the current filters.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">NFC Inventory (Tier 3)</h1>
              <p className="text-gray-600 mt-2">
                Maintain end-to-end control of NFC chips by UID and lot to prevent T3 job stalls
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Auto-refresh controls */}
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Checkbox 
                  id="auto-refresh"
                  checked={autoRefreshEnabled}
                  onCheckedChange={setAutoRefreshEnabled}
                />
                <Label htmlFor="auto-refresh">Auto-refresh (15s)</Label>
                <span className="text-xs text-gray-400">
                  Last: {lastRefresh.toLocaleTimeString()}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadHubData();
                    setLastRefresh(new Date());
                  }}
                  disabled={loading}
                  className="flex items-center space-x-1"
                >
                  <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh Now</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

              {/* Error Display */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Action Error Display */}
      {actionError && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Action Blocked:</strong> {actionError}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      {selectedHub ? renderHubDetail() : renderHubOverview()}

      {/* Action Modals */}
      {/* Assign to Shipment (T3) Wizard */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5" />
              <span>Assign NFC to Tier 3 Shipment</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="assign-uid">NFC UID</Label>
              <Input 
                id="assign-uid" 
                value={currentAction?.uid || ''} 
                disabled 
                className="font-mono bg-gray-50"
              />
            </div>
            
            <div>
              <Label htmlFor="assign-shipment">Shipment ID</Label>
              <Input 
                id="assign-shipment" 
                placeholder="SHIP-YYYYMMDD-XXX" 
                className="font-mono"
                value={assignForm.shipmentId}
                onChange={(e) => setAssignForm(prev => ({ ...prev, shipmentId: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="assign-note">Assignment Note (Optional)</Label>
              <Textarea 
                id="assign-note" 
                placeholder="Add any special handling notes..."
                rows={2}
                value={assignForm.note}
                onChange={(e) => setAssignForm(prev => ({ ...prev, note: e.target.value }))}
              />
            </div>

            {/* Validation Alerts */}
            {assignForm.shipmentId && (
              <div className="space-y-2">
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    ✓ Shipment validated as Tier 3 and assigned to this hub
                  </AlertDescription>
                </Alert>
                
                {!assignForm.hubCapacityWarning && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      ⚠ Warning: Hub sewing capacity not yet confirmed for this shipment. 
                      Proceed only if capacity is secured.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Guard Conditions */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Assignment Conditions:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>NFC status must be <strong>stock</strong></li>
                  <li>Read/write tests must be passed</li>
                  <li>Shipment must be Tier 3 and hub-matched</li>
                  <li>No double-assignments allowed</li>
                  <li>Quarantined UIDs cannot be assigned</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAssignModal(false);
                setAssignForm({ shipmentId: '', note: '', hubCapacityWarning: false });
              }}
            >
              Cancel
            </Button>
            <Button 
              disabled={!assignForm.shipmentId}
              onClick={() => {
                // Handle assignment logic with validation
                console.log('Assigning to shipment:', { uid: currentAction?.uid, ...assignForm });
                setShowAssignModal(false);
              }}
            >
              Assign & Reserve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Inter-Hub Wizard */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Send className="h-5 w-5" />
              <span>Transfer NFCs Between Hubs</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Hub Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="from-hub">From Hub</Label>
                <Select 
                  value={transferForm.fromHubId.toString()} 
                  onValueChange={(value) => setTransferForm(prev => ({ ...prev, fromHubId: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source hub" />
                  </SelectTrigger>
                  <SelectContent>
                    {hubData.map(hub => (
                      <SelectItem key={hub.id} value={hub.id.toString()}>
                        {hub.name} ({hub.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="to-hub">To Hub</Label>
                <Select 
                  value={transferForm.toHubId.toString()} 
                  onValueChange={(value) => setTransferForm(prev => ({ ...prev, toHubId: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination hub" />
                  </SelectTrigger>
                  <SelectContent>
                    {hubData.filter(hub => hub.id !== transferForm.fromHubId).map(hub => (
                      <SelectItem key={hub.id} value={hub.id.toString()}>
                        {hub.name} ({hub.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Transfer Mode */}
            <div className="space-y-3">
              <Label>Transfer Method</Label>
              <Tabs 
                value={transferForm.transferMode} 
                onValueChange={(value) => setTransferForm(prev => ({ ...prev, transferMode: value as 'uids' | 'quantity' }))}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="uids">Specific UIDs</TabsTrigger>
                  <TabsTrigger value="quantity">By Quantity</TabsTrigger>
                </TabsList>
                <TabsContent value="uids" className="space-y-2">
                  <div className="text-sm text-gray-600">
                    {selectedUIDs.length > 0 ? (
                      <>Selected UIDs ({selectedUIDs.length}): {selectedUIDs.slice(0, 3).join(', ')}{selectedUIDs.length > 3 && '...'}</>
                    ) : (
                      'No UIDs selected. Select UIDs from the table first.'
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="quantity" className="space-y-2">
                  <Input
                    type="number"
                    placeholder="Number of NFCs to transfer"
                    value={transferForm.quantity}
                    onChange={(e) => setTransferForm(prev => ({ ...prev, quantity: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500">
                    Will automatically select available stock NFCs
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            {/* Transfer Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="transfer-reason">Transfer Reason</Label>
                <Select 
                  value={transferForm.reason} 
                  onValueChange={(value) => setTransferForm(prev => ({ ...prev, reason: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low_stock">Low Stock Replenishment</SelectItem>
                    <SelectItem value="capacity_balancing">Capacity Balancing</SelectItem>
                    <SelectItem value="quality_issue">Quality Issue Response</SelectItem>
                    <SelectItem value="planned_redistribution">Planned Redistribution</SelectItem>
                    <SelectItem value="emergency">Emergency Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="transfer-eta">Expected Arrival (ETA)</Label>
                <Input
                  type="datetime-local"
                  value={transferForm.eta}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, eta: e.target.value }))}
                />
              </div>
            </div>

            {/* Transfer Summary */}
            {(transferForm.fromHubId && transferForm.toHubId) && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Transfer Summary:</strong> Moving{' '}
                  {transferForm.transferMode === 'uids' 
                    ? `${selectedUIDs.length} selected UIDs` 
                    : `${transferForm.quantity || '0'} NFCs`
                  } from {hubData.find(h => h.id === transferForm.fromHubId)?.name} 
                  to {hubData.find(h => h.id === transferForm.toHubId)?.name}.
                  <br />
                  Status progression: <strong>stock → in_transit → stock@destination</strong>
                </AlertDescription>
              </Alert>
            )}

            {/* Guardrails */}
            <Alert className="border-orange-200 bg-orange-50">
              <ShieldAlert className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Transfer Restrictions:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
                  <li>Only <strong>stock</strong> status NFCs can be transferred</li>
                  <li>Quarantined or reserved NFCs are blocked</li>
                  <li>Transfer creates audit trail and incident record</li>
                  <li>Overdue transfers will trigger alerts</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowTransferModal(false);
                setTransferForm({ fromHubId: 0, toHubId: 0, selectedUIDs: [], quantity: '', reason: '', eta: '', transferMode: 'uids' });
              }}
            >
              Cancel
            </Button>
            <Button 
              disabled={!transferForm.fromHubId || !transferForm.toHubId || !transferForm.reason || 
                       (transferForm.transferMode === 'uids' && selectedUIDs.length === 0) ||
                       (transferForm.transferMode === 'quantity' && !transferForm.quantity)}
              onClick={() => {
                // Handle transfer logic
                console.log('Creating transfer:', transferForm);
                setShowTransferModal(false);
              }}
            >
              Create Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced RMA/Replace UID Modal */}
      <Dialog open={showRMAModal} onOpenChange={setShowRMAModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span>Mark NFC as RMA & Replace</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* RMA Details */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="rma-uid">NFC UID</Label>
                <Input 
                  id="rma-uid" 
                  value={currentAction?.uid || ''} 
                  disabled 
                  className="font-mono bg-gray-50"
                />
              </div>
              
              <div>
                <Label htmlFor="rma-reason">Reason Code</Label>
                <Select 
                  value={rmaForm.reasonCode} 
                  onValueChange={(value) => setRMAForm(prev => ({ ...prev, reasonCode: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select failure reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read_fail">Read Test Failure</SelectItem>
                    <SelectItem value="write_fail">Write Test Failure</SelectItem>
                    <SelectItem value="physical_defect">Physical Defect</SelectItem>
                    <SelectItem value="other">Other Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="rma-notes">Detailed Description</Label>
                <Textarea 
                  id="rma-notes" 
                  placeholder="Describe the issue in detail for supplier feedback..."
                  rows={3}
                  value={rmaForm.notes}
                  onChange={(e) => setRMAForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            {/* Replacement Options */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="auto-replace"
                  checked={!!rmaForm.replacementUID}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      const suggestions = getSuggestedReplacements(nfcUnits.find(u => u.uid === currentAction?.uid) || nfcUnits[0]);
                      setRMAForm(prev => ({ 
                        ...prev, 
                        autoSuggestedReplacements: suggestions,
                        replacementUID: suggestions[0] || ''
                      }));
                    } else {
                      setRMAForm(prev => ({ ...prev, replacementUID: '', autoSuggestedReplacements: [] }));
                    }
                  }}
                />
                <Label htmlFor="auto-replace" className="font-medium">
                  Auto-replace with same lot NFC
                </Label>
              </div>

              {rmaForm.replacementUID && (
                <div className="space-y-3 bg-blue-50 p-4 rounded-lg">
                  <Label htmlFor="replacement-uid">Replacement NFC UID</Label>
                  <Select 
                    value={rmaForm.replacementUID} 
                    onValueChange={(value) => setRMAForm(prev => ({ ...prev, replacementUID: value }))}
                  >
                    <SelectTrigger className="font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rmaForm.autoSuggestedReplacements.map(uid => (
                        <SelectItem key={uid} value={uid} className="font-mono">
                          {uid} ✓ Same lot, tested
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Alert>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Replacement will inherit the same shipment assignment if the original was reserved.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>

            {/* Impact Summary */}
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>RMA Impact:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
                  <li>Original UID → RMA status (removed from stock)</li>
                  <li>Supplier notification generated</li>
                  {rmaForm.replacementUID && (
                    <li>Replacement UID assigned to same shipment</li>
                  )}
                  <li>Quality metrics updated for lot tracking</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRMAModal(false);
                setRMAForm({ uid: '', reasonCode: '', notes: '', replacementUID: '', autoSuggestedReplacements: [] });
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              disabled={!rmaForm.reasonCode}
              onClick={() => {
                // Handle RMA with optional replacement
                console.log('Processing RMA:', { uid: currentAction?.uid, ...rmaForm });
                setShowRMAModal(false);
              }}
            >
              {rmaForm.replacementUID ? 'RMA & Replace' : 'Mark as RMA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quarantine Lot Modal */}
      <Dialog open={showQuarantineModal} onOpenChange={setShowQuarantineModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quarantine Lot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="quarantine-lot">Lot ID</Label>
              <Input id="quarantine-lot" value={currentAction?.lot || ''} disabled />
            </div>
            <div>
              <Label htmlFor="quarantine-reason">Quarantine Reason</Label>
              <Textarea 
                id="quarantine-reason" 
                placeholder="Describe the quality issue affecting this lot..."
                rows={3}
              />
            </div>
            <Alert className="border-orange-200 bg-orange-50">
              <ShieldAlert className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                This will move all non-installed UIDs in this lot to quarantined status.
                Only Ops personnel can perform this action.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuarantineModal(false)}>
              Cancel
            </Button>
            <Button className="bg-orange-600 hover:bg-orange-700">Quarantine Lot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>NFC Movement History</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>UID: <span className="font-mono">{currentAction?.uid}</span></Label>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-sm">2024-01-16 14:30</TableCell>
                    <TableCell>Reserved</TableCell>
                    <TableCell>ops.user@aucta.com</TableCell>
                    <TableCell>Reserved for SHIP-001</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">2024-01-15 09:15</TableCell>
                    <TableCell>Test Passed</TableCell>
                    <TableCell>tech.user@aucta.com</TableCell>
                    <TableCell>Read/Write tests passed</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">2024-01-10 16:45</TableCell>
                    <TableCell>Received</TableCell>
                    <TableCell>system</TableCell>
                    <TableCell>Batch LOT-2024-001 intake</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive NFCs Wizard */}
      <Dialog open={showReceiveModal} onOpenChange={setShowReceiveModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Receive NFC Batch</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="receive-lot">Lot ID</Label>
                <Input 
                  id="receive-lot" 
                  placeholder="LOT-2024-XXX"
                  value={receiveForm.lotId}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, lotId: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="receive-quantity">Quantity</Label>
                <Input 
                  id="receive-quantity" 
                  type="number" 
                  placeholder="100"
                  value={receiveForm.quantity}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="receive-supplier">Supplier Reference</Label>
              <Input 
                id="receive-supplier" 
                placeholder="Supplier invoice/ref number..."
                value={receiveForm.supplierRef}
                onChange={(e) => setReceiveForm(prev => ({ ...prev, supplierRef: e.target.value }))}
              />
            </div>

            {/* UID List Import */}
            <div className="space-y-3">
              <Label>UID List (Optional)</Label>
              <Tabs defaultValue="manual" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                  <TabsTrigger value="import">CSV Import</TabsTrigger>
                </TabsList>
                <TabsContent value="manual" className="space-y-2">
                  <Textarea 
                    placeholder="Paste UIDs here (one per line)..."
                    rows={4}
                    value={receiveForm.uidList}
                    onChange={(e) => setReceiveForm(prev => ({ ...prev, uidList: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500">
                    Leave empty to auto-generate UIDs: {receiveForm.quantity ? `${receiveForm.quantity} UIDs will be created` : 'Enter quantity first'}
                  </p>
                </TabsContent>
                <TabsContent value="import" className="space-y-2">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => handleFileUpload(e, 'uidList')}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Upload CSV file with UIDs (one per row)
                    </p>
                  </div>
                  {receiveForm.uidList && (
                    <div className="text-sm text-green-600">
                      ✓ {parseUIDList(receiveForm.uidList).length} UIDs loaded
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Evidence Attachments */}
            <div className="space-y-3">
              <Label>Evidence Files</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => handleFileUpload(e, 'evidenceFiles')}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Upload delivery notes, QC files, or other evidence (PDF, images, documents)
                </p>
              </div>
              {receiveForm.evidenceFiles.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Attached files:</p>
                  {receiveForm.evidenceFiles.map((file, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      <FileText className="h-4 w-4" />
                      <span>{file.name}</span>
                      <span className="text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Summary:</strong> Receiving {receiveForm.quantity || '0'} NFC units in lot {receiveForm.lotId || '[Not specified]'} 
                {receiveForm.uidList && ` with ${parseUIDList(receiveForm.uidList).length} pre-defined UIDs`}
                {receiveForm.evidenceFiles.length > 0 && ` and ${receiveForm.evidenceFiles.length} evidence file(s)`}.
                All units will be marked as <strong>stock</strong> and available for assignment.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowReceiveModal(false);
                setReceiveForm({ lotId: '', quantity: '', supplierRef: '', uidList: '', evidenceFiles: [] });
              }}
            >
              Cancel
            </Button>
            <Button 
              disabled={!receiveForm.lotId || !receiveForm.quantity}
              onClick={() => {
                // Handle receive batch logic
                console.log('Receiving batch:', receiveForm);
                setShowReceiveModal(false);
              }}
            >
              Receive Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Investigation Modal */}
      <Dialog open={showAlertModal} onOpenChange={setShowAlertModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span>
                {currentAction?.data?.alertType === 'quarantine' ? 'Investigate Quarantined Lots' : 'Review High Failure Rate Lots'}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Alert Details */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Affected Lots</h4>
                <div className="space-y-2">
                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-mono">LOT-2024-001</span>
                      <Badge variant="destructive">Quarantined</Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      45 NFCs affected • 12 in shipments • Issue: Read failures
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-mono">LOT-2024-003</span>
                      <Badge className="bg-orange-100 text-orange-800">High Failure Rate</Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      23% failure rate • 15 of 65 NFCs • Trending upward
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Impact Analysis</h4>
                <div className="space-y-3">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Affected Shipments:</strong> 8 T3 shipments may be delayed
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Supplier:</strong> NFC-Tech Ltd. • Last delivery: 2024-01-10
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </div>

            {/* Resolution Actions */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">Resolution Actions</h4>
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  className="h-auto p-4 flex flex-col items-start space-y-2"
                  onClick={() => {
                    setCurrentAction({ type: 'quarantine', lot: 'LOT-2024-003' });
                    setShowAlertModal(false);
                    setShowQuarantineModal(true);
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="h-4 w-4" />
                    <span className="font-medium">Quarantine Lot</span>
                  </div>
                  <span className="text-sm text-left">
                    Move all remaining LOT-2024-003 NFCs to quarantine status
                  </span>
                </Button>
                
                <Button 
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start space-y-2"
                  onClick={() => {
                    setShowAlertModal(false);
                    // Open supplier ticket workflow
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Supplier Ticket</span>
                  </div>
                  <span className="text-sm text-left">
                    Create quality issue ticket for NFC-Tech Ltd.
                  </span>
                </Button>
                
                <Button 
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start space-y-2"
                  onClick={() => {
                    // Lift quarantine workflow
                    setShowAlertModal(false);
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Lift Quarantine</span>
                  </div>
                  <span className="text-sm text-left">
                    Return quarantined NFCs to stock after investigation
                  </span>
                </Button>
                
                <Button 
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start space-y-2"
                  onClick={() => {
                    // Adjust threshold workflow
                    setShowAlertModal(false);
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <Edit className="h-4 w-4" />
                    <span className="font-medium">Adjust Threshold</span>
                  </div>
                  <span className="text-sm text-left">
                    Modify failure rate alert threshold if appropriate
                  </span>
                </Button>
              </div>
            </div>

            {/* Investigation Notes */}
            <div className="space-y-2">
              <Label htmlFor="investigation-notes">Investigation Notes</Label>
              <Textarea 
                id="investigation-notes"
                placeholder="Document findings, root cause analysis, and resolution plan..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlertModal(false)}>
              Close Investigation
            </Button>
            <Button>
              Mark Alert Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UID Not Found at Install Modal */}
      <Dialog open={showNotFoundModal} onOpenChange={setShowNotFoundModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-red-600" />
              <span>UID Not Found at Install</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Installation Issue:</strong> UID not found during sewing process. Quick replacement needed to prevent shipment delay.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="missing-uid">Missing UID</Label>
                <Input
                  id="missing-uid"
                  value={notFoundForm.missingUID}
                  onChange={(e) => setNotFoundForm(prev => ({ ...prev, missingUID: e.target.value }))}
                  placeholder="NFC-567890"
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="shipment-id">Shipment ID</Label>
                <Input
                  id="shipment-id"
                  value={notFoundForm.shipmentId}
                  onChange={(e) => setNotFoundForm(prev => ({ ...prev, shipmentId: e.target.value }))}
                  placeholder="T3-2024-045"
                  className="font-mono"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="replacement-uid">Replacement UID (Same Lot Preferred)</Label>
              <Select 
                value={notFoundForm.replacementUID} 
                onValueChange={(value) => setNotFoundForm(prev => ({ ...prev, replacementUID: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select replacement NFC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NFC-567891">NFC-567891 (Same Lot: LOT-2024-001)</SelectItem>
                  <SelectItem value="NFC-567892">NFC-567892 (Same Lot: LOT-2024-001)</SelectItem>
                  <SelectItem value="NFC-568001">NFC-568001 (Different Lot: LOT-2024-002)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-600 mt-1">
                Suggested: {notFoundForm.suggestedReplacements.join(', ') || 'Loading suggestions...'}
              </p>
            </div>

            <div>
              <Label htmlFor="missing-reason">Reason for Missing UID</Label>
              <Select 
                value={notFoundForm.reason} 
                onValueChange={(value) => setNotFoundForm(prev => ({ ...prev, reason: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lost_in_transit">Lost in Transit</SelectItem>
                  <SelectItem value="damaged_on_arrival">Damaged on Arrival</SelectItem>
                  <SelectItem value="not_in_package">Not Found in Package</SelectItem>
                  <SelectItem value="inventory_discrepancy">Inventory Discrepancy</SelectItem>
                  <SelectItem value="other">Other (specify in notes)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Automatic Actions</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Mark original UID as lost/RMA with specified reason</li>
                <li>• Assign replacement UID to same shipment</li>
                <li>• Update audit trail with replacement linkage</li>
                <li>• Generate incident report for tracking</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotFoundModal(false)}>
              Cancel
            </Button>
            <Button 
              disabled={!notFoundForm.missingUID || !notFoundForm.replacementUID || !notFoundForm.reason}
              onClick={() => {
                // Handle replacement logic with telemetry
                trackTelemetry('nfc.replacement.not_found', {
                  missingUID: notFoundForm.missingUID,
                  replacementUID: notFoundForm.replacementUID,
                  reason: notFoundForm.reason,
                  shipmentId: notFoundForm.shipmentId
                });
                
                console.log('Processing UID replacement:', notFoundForm);
                setShowNotFoundModal(false);
              }}
            >
              Process Replacement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Stuck Modal */}
      <Dialog open={showTransferStuckModal} onOpenChange={setShowTransferStuckModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span>Inter-Hub Transfer Issue</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Transfer Overdue:</strong> Transfer TRF-240115-ABC is 2 days past expected arrival. Action required.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Transfer Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transfer ID:</span>
                    <span className="font-mono">TRF-240115-ABC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">From:</span>
                    <span>London Hub</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">To:</span>
                    <span>Paris Hub</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expected:</span>
                    <span>2024-01-15</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge className="bg-yellow-100 text-yellow-800">Overdue</Badge>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">UID Status</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expected UIDs:</span>
                    <span className="font-medium">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Arrived:</span>
                    <span className="font-medium text-green-600">8</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Missing:</span>
                    <span className="font-medium text-red-600">4</span>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-gray-600">Missing UIDs:</p>
                  <p className="text-xs font-mono">NFC-567890, NFC-567891, NFC-567892, NFC-567893</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Resolution Action</h4>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={transferStuckForm.actionType === 'mark_arrived' ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-start space-y-2"
                  onClick={() => setTransferStuckForm(prev => ({ ...prev, actionType: 'mark_arrived' }))}
                >
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Mark Partial Arrival</span>
                  </div>
                  <span className="text-sm text-left">
                    Accept 8 arrived UIDs, mark 4 as lost in transit for RMA processing
                  </span>
                </Button>

                <Button
                  variant={transferStuckForm.actionType === 'open_incident' ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-start space-y-2"
                  onClick={() => setTransferStuckForm(prev => ({ ...prev, actionType: 'open_incident' }))}
                >
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Open Investigation</span>
                  </div>
                  <span className="text-sm text-left">
                    Create incident report and investigate with carrier/logistics partner
                  </span>
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferStuckModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // Handle transfer resolution with telemetry
                endTelemetryTimer('transfer', 'TRF-240115-ABC', {
                  actionType: transferStuckForm.actionType,
                  arrivedCount: 8,
                  missingCount: 4
                });
                
                trackTelemetry('nfc.transfer.stuck_resolved', {
                  transferId: 'TRF-240115-ABC',
                  actionType: transferStuckForm.actionType,
                  daysOverdue: 2
                });
                
                console.log('Resolving stuck transfer:', transferStuckForm);
                setShowTransferStuckModal(false);
              }}
            >
              Process Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Recall Modal */}
      <Dialog open={showSupplierRecallModal} onOpenChange={setShowSupplierRecallModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertOctagon className="h-5 w-5 text-red-600" />
              <span>Supplier Recall - Lot Quarantine</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Supplier Recall Notice:</strong> Immediate quarantine required for affected lot(s).
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="recall-lot">Affected Lot</Label>
                  <Input
                    id="recall-lot"
                    value={supplierRecallForm.lot}
                    onChange={(e) => setSupplierRecallForm(prev => ({ ...prev, lot: e.target.value }))}
                    placeholder="LOT-2024-001"
                    className="font-mono"
                  />
                </div>
                
                <div>
                  <Label htmlFor="recall-supplier">Supplier</Label>
                  <Select 
                    value={supplierRecallForm.supplier}
                    onValueChange={(value) => setSupplierRecallForm(prev => ({ ...prev, supplier: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nfc-tech-ltd">NFC-Tech Ltd</SelectItem>
                      <SelectItem value="smart-chip-co">Smart Chip Co</SelectItem>
                      <SelectItem value="antenna-solutions">Antenna Solutions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="recall-reason">Recall Reason</Label>
                  <Textarea
                    id="recall-reason"
                    value={supplierRecallForm.recallReason}
                    onChange={(e) => setSupplierRecallForm(prev => ({ ...prev, recallReason: e.target.value }))}
                    placeholder="Manufacturing defect identified..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Impact Analysis</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Affected UIDs:</span>
                    <span className="font-medium text-red-600">1,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reserved Shipments:</span>
                    <span className="font-medium text-orange-600">15</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Already Installed:</span>
                    <span className="font-medium text-green-600">487</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Available Stock:</span>
                    <span className="font-medium text-blue-600">498</span>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Affected Customers</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Luxury Brand Alpha:</span>
                      <span className="font-medium">8 shipments</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Premium Fashion Co:</span>
                      <span className="font-medium">5 shipments</span>
                    </div>
                    <div className="flex justify-between">
                      <span>High-End Accessories:</span>
                      <span className="font-medium">2 shipments</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-medium text-red-900 mb-2">Automatic Quarantine Actions</h4>
              <ul className="text-sm text-red-800 space-y-1">
                <li>• Quarantine all 498 available NFCs in lot</li>
                <li>• Block new assignments from this lot</li>
                <li>• Flag 15 reserved shipments for replacement</li>
                <li>• Generate customer notification reports</li>
                <li>• Create supplier quality incident</li>
                <li>• Installed units remain active (RMA on failure only)</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupplierRecallModal(false)}>
              Cancel
            </Button>
            <Button 
              disabled={!supplierRecallForm.lot || !supplierRecallForm.supplier || !supplierRecallForm.recallReason}
              onClick={() => {
                // Handle supplier recall with telemetry
                startTelemetryTimer('quarantine', supplierRecallForm.lot);
                
                trackTelemetry('nfc.supplier.recall_initiated', {
                  lot: supplierRecallForm.lot,
                  supplier: supplierRecallForm.supplier,
                  affectedUIDs: 1000,
                  reservedShipments: 15,
                  installedUnits: 487
                });
                
                console.log('Processing supplier recall:', supplierRecallForm);
                setShowSupplierRecallModal(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Execute Quarantine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate UID Import Modal */}
      <Dialog open={showDuplicateUIDModal} onOpenChange={setShowDuplicateUIDModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Copy className="h-5 w-5 text-yellow-600" />
              <span>Duplicate UID Import Detected</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Import Blocked:</strong> Duplicate UIDs detected in upload. Review and resolve before proceeding.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Import Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total UIDs in file:</span>
                    <span className="font-medium">250</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valid UIDs:</span>
                    <span className="font-medium text-green-600">235</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duplicate UIDs:</span>
                    <span className="font-medium text-red-600">15</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Duplicate UIDs</h4>
                <div className="max-h-32 overflow-y-auto text-xs font-mono space-y-1">
                  <div>NFC-567890 (already in LOT-2024-001)</div>
                  <div>NFC-567891 (already in LOT-2024-001)</div>
                  <div>NFC-567892 (already in LOT-2024-002)</div>
                  <div>NFC-567893 (already in LOT-2024-001)</div>
                  <div>NFC-567894 (already in LOT-2024-003)</div>
                  <div className="text-gray-500">...and 10 more</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Resolution Options</h4>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={duplicateUIDForm.resolution === 'block' ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-start space-y-2"
                  onClick={() => setDuplicateUIDForm(prev => ({ ...prev, resolution: 'block' }))}
                >
                  <div className="flex items-center space-x-2">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium">Block Import</span>
                  </div>
                  <span className="text-sm text-left">
                    Reject entire import and require file correction before retry
                  </span>
                </Button>

                <Button
                  variant={duplicateUIDForm.resolution === 'append_after_fix' ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-start space-y-2"
                  onClick={() => setDuplicateUIDForm(prev => ({ ...prev, resolution: 'append_after_fix' }))}
                >
                  <div className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span className="font-medium">Import Valid Only</span>
                  </div>
                  <span className="text-sm text-left">
                    Import 235 valid UIDs, skip duplicates and provide correction list
                  </span>
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Recommended Actions</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Download corrected file with duplicates removed</li>
                <li>• Verify UID generation process with supplier</li>
                <li>• Check for systematic UID collision patterns</li>
                <li>• Update import validation to catch future duplicates</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateUIDModal(false)}>
              Cancel Import
            </Button>
            <Button 
              onClick={() => {
                // Handle duplicate UID resolution with telemetry
                trackTelemetry('nfc.import.duplicate_resolved', {
                  totalUIDs: 250,
                  validUIDs: 235,
                  duplicateUIDs: 15,
                  resolution: duplicateUIDForm.resolution
                });
                
                console.log('Resolving duplicate UIDs:', duplicateUIDForm);
                setShowDuplicateUIDModal(false);
              }}
            >
              Process Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
}
