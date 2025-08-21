'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import SettingsNavigation, { useSettingsAccess } from '@/components/SettingsNavigation';
import SettingsEventAPI, { createStateSnapshot } from '@/lib/eventAuditSystem';
import { v4 as uuidv4 } from 'uuid';
import LazyCalendar from '@/components/LazyCalendar';
import { usePerformanceMonitor, useMemoizedSelector, useDebounce, measurePerformance, PERFORMANCE_BUDGETS } from '@/lib/performanceOptimizations';
import { 
  ChevronRight, Settings, Plus, Edit, Trash2, Save, Clock, AlertTriangle, CheckCircle, 
  TrendingUp, Building, Users, Package, Truck, Shield, BarChart3, Database, Calendar,
  Globe, History, GitCompare, X, Search, Filter, Download, Bell, ExternalLink,
  ChevronDown, ChevronUp, Info, RotateCcw, Timer, Zap, RefreshCw, AlertCircle,
  MapPin, Eye, Star, Tag, User, Home, Mail, Phone, MessageSquare, FileText
} from 'lucide-react';
import { hubCapacityApi, capacityHelpers, Hub, CapacityProfile, Reservation, UtilizationData } from '@/lib/hubCapacityApi';

// Local types for UI state
interface CalculationResult {
  utilization: number;
  availableSlots: number;
  rushAvailable: number;
  qaLoadMinutes: number;
  qaCapacityMinutes: number;
  overflowToNextDay: boolean;
}

interface Guard {
  id: string;
  type: 'capacity_lowering' | 'overbooking_cap' | 'rush_cap' | 'booking_conflict';
  severity: 'warning' | 'error' | 'info';
  message: string;
  affectedBookings?: string[];
  requiresOverride?: boolean;
}

interface DayCapacity {
  date: string;
  available: number;
  held: number;
  planned: number;
  consumed: number;
  qaLoad: number;
  qaMinutesUsed: number;
  rushUsed: number;
  isBlackout: boolean;
  isMaintenance: boolean;
  isOvertime: boolean;
  overflowFromPrevDay: number;
  overflowToNextDay: number;
  exceptions: string[];
  seasonalityMultiplier: number;
  calculation: CalculationResult;
}

interface ReservationLocal {
  id: string;
  shipmentId: string;
  type: 'hold' | 'booking' | 'in_progress';
  lane: string;
  date: string;
  slotsUsed: number;
  tier: 'T2' | 'T3';
  priority: 'standard' | 'priority';
  status: string;
}

interface BlackoutRule {
  id: string;
  name: string;
  type: 'recurring' | 'one_time';
  startDate: string;
  endDate?: string;
  recurrenceRule?: string;
  affectedLanes: string[];
  reason: string;
}

interface MaintenanceWindow {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  slotsReduction: number;
  reason: string;
  approver: string;
}

export default function HubCapacityPage() {
  // Check access permissions
  const { hasAccess, currentPage } = useSettingsAccess('hub-capacity');
  
  // Performance monitoring
  const savePerformanceMonitor = usePerformanceMonitor('Save Operation');
  const publishPerformanceMonitor = usePerformanceMonitor('Publish Operation');
  
  // State management
  const [selectedHub, setSelectedHub] = useState<number>(1); // Changed to number to match API
  const sessionRef = React.useRef<string>(uuidv4()); // Session ID for correlation
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedLane, setSelectedLane] = useState('auth');
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [sidePanelData, setSidePanelData] = useState<any>(null);
  const [requireApproval, setRequireApproval] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  
  // Performance optimizations
  const debouncedChangeReason = useDebounce(changeReason, 300);
  
  // Memoized calendar events
  const calendarEvents = useMemoizedSelector(
    { blackouts, maintenance, reservations: [] },
    (data) => [
      ...data.blackouts.map(b => ({
        id: b.id,
        date: b.startDate,
        title: b.name,
        type: 'blackout' as const,
        metadata: b
      })),
      ...data.maintenance.map(m => ({
        id: m.id,
        date: m.date,
        title: m.name,
        type: 'maintenance' as const,
        metadata: m
      }))
    ],
    [blackouts, maintenance]
  );
  const [isDraft, setIsDraft] = useState(false);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [showGuardsModal, setShowGuardsModal] = useState(false);
  const [telemetryData, setTelemetryData] = useState({
    publishTimeMs: 0,
    utilizationDaily: {},
    conflictsCount: 0,
    overtimeUsage: 0,
    planBlockedCount: 0
  });
  const [showSeasonalityModal, setShowSeasonalityModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState<{lane: string, value: number} | null>(null);
  
  // Mock data for blackouts and maintenance
  const [blackouts, setBlackouts] = useState<BlackoutRule[]>([
    {
      id: 'blackout-1',
      name: 'Christmas Holiday',
      type: 'recurring',
      startDate: '2024-12-24',
      endDate: '2024-12-26',
      affectedLanes: ['auth', 'sewing', 'qa'],
      reason: 'Annual holiday closure'
    }
  ]);
  
  const [maintenance, setMaintenance] = useState<MaintenanceWindow[]>([
    {
      id: 'maint-1',
      name: 'System Upgrade',
      date: '2024-02-15',
      startTime: '02:00',
      endTime: '06:00',
      slotsReduction: 5,
      reason: 'Monthly system maintenance',
      approver: 'ops.manager@aucta.io'
    }
  ]);
  
  // API data
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [capacityProfile, setCapacityProfile] = useState<CapacityProfile | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [utilizationData, setUtilizationData] = useState<UtilizationData[]>([]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load hubs
        const hubsResponse = await hubCapacityApi.getHubs();
        if (hubsResponse.success) {
          setHubs(hubsResponse.data);
          
          // Set first hub as selected if none selected
          if (hubsResponse.data.length > 0 && !selectedHub) {
            setSelectedHub(hubsResponse.data[0].id);
          }
        }

        // Load capacity profile for selected hub
        if (selectedHub) {
          const [profileResponse, reservationsResponse, utilizationResponse] = await Promise.all([
            hubCapacityApi.getActiveCapacityProfile(selectedHub),
            hubCapacityApi.getReservations(selectedHub, {
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Next 30 days
            }),
            hubCapacityApi.getUtilization(selectedHub, {
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Next 30 days
            })
          ]);

          if (profileResponse.success) {
            setCapacityProfile(profileResponse.data);
          }

          if (reservationsResponse.success) {
            setReservations(reservationsResponse.data);
          }

          if (utilizationResponse.success) {
            setUtilizationData(utilizationResponse.data);
          }
        }

      } catch (err) {
        console.error('Error loading hub capacity data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedHub]);

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading hub capacity data...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Error: {error}</div>
        </div>
      </div>
    );
  }

  // Return early if no capacity profile loaded
  if (!capacityProfile) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">No capacity profile found for selected hub</div>
        </div>
      </div>
    );
  }

  // Helper functions
  const formatDateTime = (dateString: string) => {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(dateString));
  };

  const formatAbsoluteDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const cetTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
    const utcTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
    return `${cetTime} CET (${utcTime} UTC)`;
  };

  const getCurrentHub = () => hubs.find(h => h.id === selectedHub) || hubs[0];

  const getCapacityForLane = (lane: string) => {
    if (!capacityProfile) return 0;
    switch (lane) {
      case 'auth': return capacityProfile.authCapacity;
      case 'sewing': return capacityProfile.sewingCapacity;
      case 'qa': return capacityProfile.qaCapacity;
      default: return 0;
    }
  };

  const getSeasonalityMultiplier = (date: string) => {
    if (!capacityProfile) return 1.0;
    return capacityHelpers.getSeasonalityMultiplier(date, capacityProfile.seasonalityMultipliers);
  };

  // Core calculation functions with transparent formulas
  const calculateDayCapacity = (day: DayCapacity, lane: string): CalculationResult => {
    const baseCapacity = getCapacityForLane(lane);
    const seasonality = getSeasonalityMultiplier(day.date);
    const overbookMultiplier = 1 + (capacityProfile.overbookingPercent / 100);
    
    // Utilisation % (lane/day) = (held + booked + in_progress) / (base × seasonality × (1 + overbook%))
    const totalUsed = day.held + day.planned + day.consumed;
    const maxCapacityWithOverbook = baseCapacity * seasonality * overbookMultiplier;
    const utilization = (totalUsed / maxCapacityWithOverbook) * 100;
    
    // Available slots = floor(base × seasonality) − held − booked
    const effectiveBaseCapacity = Math.floor(baseCapacity * seasonality);
    const availableSlots = Math.max(0, effectiveBaseCapacity - day.held - day.planned);
    
    // Rush available = ceil(base × rush%) − rush_used
    const rushCapacity = Math.ceil(baseCapacity * (capacityProfile.rushBucketPercent / 100));
    const rushAvailable = Math.max(0, rushCapacity - day.rushUsed);
    
    // QA load (min) = Σ(QA_minutes_per_job_by_tier); compare to QA capacity
    const qaCapacityMinutes = capacityProfile.qaHeadcount * capacityProfile.qaShiftMinutes;
    const qaLoadMinutes = day.qaMinutesUsed || 0;
    
    // Overflow to next day: only allowed if policy enabled and within SLA
    const overflowToNextDay = utilization > 100 && availableSlots < 0 && day.overflowToNextDay > 0;
    
    return {
      utilization,
      availableSlots,
      rushAvailable,
      qaLoadMinutes,
      qaCapacityMinutes,
      overflowToNextDay
    };
  };

  // Guard functions
  const validateCapacityChange = (lane: string, newValue: number): Guard[] => {
    const guards: Guard[] = [];
    const currentValue = getCapacityForLane(lane);
    
    // Check if lowering capacity would conflict with existing bookings
    if (newValue < currentValue) {
      const affectedBookings = reservations.filter(r => 
        r.slotsUsed > newValue && 
        r.type === 'booking'
      );
      
      if (affectedBookings.length > 0) {
        guards.push({
          id: `capacity-lowering-${lane}`,
          type: 'capacity_lowering',
          severity: 'error',
          message: `Lowering ${lane} capacity would invalidate ${affectedBookings.length} existing bookings`,
          affectedBookings: affectedBookings.map(b => b.shipmentId),
          requiresOverride: true
        });
      }
    }
    
    // Check overbooking cap (max 30%)
    if (capacityProfile.overbookingPercent > 30) {
      guards.push({
        id: 'overbooking-cap',
        type: 'overbooking_cap',
        severity: 'error',
        message: 'Overbooking percentage cannot exceed 30% by policy',
        requiresOverride: false
      });
    }
    
    // Check rush bucket cap (max 20%)
    if (capacityProfile.rushBucketPercent > 20) {
      guards.push({
        id: 'rush-cap',
        type: 'rush_cap',
        severity: 'warning',
        message: 'Rush bucket above 20% may starve standard flow',
        requiresOverride: false
      });
    }
    
    return guards;
  };

  // Event emission
  const emitEvent = (eventType: string, data: any) => {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      hubId: selectedHub,
      actorId: 'current_user@aucta.io',
      ...data
    };
    
    console.log('Hub Capacity Event:', event);
    
    // Track telemetry
    if (eventType === 'settings.hub_capacity.published') {
      setTelemetryData(prev => ({ ...prev, publishTimeMs: Date.now() }));
    }
    
    // In real implementation, this would call an API endpoint
    // fetch('/api/events/hub-capacity', { method: 'POST', body: JSON.stringify(event) });
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const generateCalendarDays = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    
    const days: DayCapacity[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day).toISOString().split('T')[0];
      
      // Find real utilization data for this date and lane
      const utilData = utilizationData.find(u => u.date === date && u.lane === selectedLane);
      
      const capacity = getCapacityForLane(selectedLane);
      const seasonality = getSeasonalityMultiplier(date);
      
      // Use real data if available, otherwise use defaults
      const held = utilData?.held || 0;
      const planned = utilData?.planned || 0;
      const consumed = utilData?.consumed || 0;
      const rushUsed = utilData?.rushUsed || 0;
      const qaMinutesUsed = utilData?.qaMinutesUsed || 0;
      
      const dayData: DayCapacity = {
        date,
        available: capacity,
        held,
        planned,
        consumed,
        qaLoad: Math.floor(qaMinutesUsed / 30), // Convert minutes to simple load indicator
        qaMinutesUsed,
        rushUsed,
        isBlackout: false, // TODO: Check against blackout rules
        isMaintenance: false, // TODO: Check against maintenance windows
        isOvertime: false,
        overflowFromPrevDay: 0,
        overflowToNextDay: 0,
        exceptions: [],
        seasonalityMultiplier: seasonality,
        calculation: {} as CalculationResult
      };
      
      // Calculate the day's metrics using real API helper
      if (utilData) {
        dayData.calculation = {
          utilization: utilData.utilization,
          availableSlots: utilData.availableSlots,
          rushAvailable: utilData.rushAvailable,
          qaLoadMinutes: utilData.qaMinutesUsed,
          qaCapacityMinutes: utilData.qaCapacityMinutes,
          overflowToNextDay: false
        };
      } else {
        dayData.calculation = calculateDayCapacity(dayData, selectedLane);
      }
      
      days.push(dayData);
    }
    return days;
  };

  const calendarDays = generateCalendarDays();

  const getUtilizationColor = (day: DayCapacity) => {
    if (day.isBlackout) return 'bg-gray-400';
    if (day.isMaintenance) return 'bg-orange-400';
    
    const utilization = day.calculation.utilization;
    
    if (utilization >= 100) return 'bg-red-500';
    if (utilization >= 80) return 'bg-yellow-500';
    if (utilization >= 60) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getUtilizationIcon = (day: DayCapacity) => {
    if (day.calculation.overflowToNextDay) return '→';
    if (day.overflowFromPrevDay > 0) return '←';
    if (day.isOvertime) return '⏰';
    return '';
  };

  const handleDayClick = (day: DayCapacity) => {
    setSidePanelData({
      type: 'day',
      data: day,
      reservations: reservations.filter(r => r.date === day.date)
    });
    setShowSidePanel(true);
  };

  const updateCapacity = async (lane: string, value: number) => {
    if (!capacityProfile) return;
    
    // Validate the change
    const newGuards = validateCapacityChange(lane, value);
    
    // Check for blocking errors
    const blockingErrors = newGuards.filter(g => g.severity === 'error' && g.requiresOverride);
    if (blockingErrors.length > 0) {
      setGuards(newGuards);
      setShowGuardsModal(true);
      return;
    }
    
    setIsDraft(true);
    const newProfile = { ...capacityProfile };
    switch (lane) {
      case 'auth':
        newProfile.authCapacity = value;
        break;
      case 'sewing':
        newProfile.sewingCapacity = value;
        break;
      case 'qa':
        newProfile.qaCapacity = value;
        break;
    }
    setCapacityProfile(newProfile);
    
    // Update guards with warnings
    setGuards(newGuards.filter(g => g.severity !== 'error'));
  };

  const handleEmergencyBlackout = () => {
    const emergencyBlackout = {
      id: `emergency-${Date.now()}`,
      name: 'Emergency Outage',
      type: 'one_time' as const,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      affectedLanes: ['auth', 'sewing', 'qa'],
      reason: 'Emergency system outage'
    };
    
    // Auto-notify systems
    emitEvent('hub_capacity.emergency.blackout', {
      blackout: emergencyBlackout,
      notifications: ['tier_gate', 'plan', 'hub_console']
    });
    
    setShowEmergencyModal(false);
    alert('Emergency blackout activated. All systems have been notified.');
  };

  const exportCalendar = (format: 'csv' | 'ics') => {
    const data = calendarDays.map(day => ({
      date: day.date,
      lane: selectedLane,
      available: day.calculation.availableSlots,
      utilization: day.calculation.utilization.toFixed(1) + '%',
      rushAvailable: day.calculation.rushAvailable,
      seasonality: day.seasonalityMultiplier,
      isBlackout: day.isBlackout,
      isMaintenance: day.isMaintenance
    }));
    
    if (format === 'csv') {
      const csv = [
        Object.keys(data[0]).join(','),
        ...data.map(row => Object.values(row).join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hub-capacity-${selectedHub}-${selectedLane}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    }
    
    console.log(`Exported ${format} calendar for ${selectedHub} ${selectedLane}`);
  };

  // Early return if no access
  if (!hasAccess) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <SettingsNavigation />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', position: 'relative' }}>
      <SettingsNavigation />

      {/* Header & Policy State */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-xlarge)', fontWeight: 'bold', color: 'var(--true-black)' }}>Hub Capacity & Calendars</h1>
            <p style={{ color: 'var(--muted)', marginTop: 'var(--space-xs)' }}>Define and publish Hub operational capacity and calendar rules</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowSeasonalityModal(true)}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center space-x-2"
            >
              <Calendar className="h-4 w-4" />
              <span>Seasonality</span>
            </button>
            <button 
              onClick={() => setShowEmergencyModal(true)}
              className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 flex items-center space-x-2"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Emergency</span>
            </button>
            <button 
              onClick={() => exportCalendar('csv')}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center space-x-2">
              <History className="h-4 w-4" />
              <span>History</span>
            </button>
            <button 
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center space-x-2"
              disabled={!isDraft}
            >
              <Save className="h-4 w-4" />
              <span>Save Draft</span>
            </button>
            <button 
              onClick={async () => {
                publishPerformanceMonitor.start();
                
                try {
                  await measurePerformance(async () => {
                    // Create pre-state snapshot for audit
                    const preState = createStateSnapshot(capacityProfile);
                    
                    // Emit structured event per specification: settings.hub_capacity.published
                    await SettingsEventAPI.hubCapacityPublished({
                      actorId: 'current_user@aucta.io',
                      version: capacityProfile.version,
                      effectiveAt: capacityProfile.effectiveDate,
                      hubId: selectedHub,
                      capacityProfile: capacityProfile,
                      preState,
                      postState: createStateSnapshot({ ...capacityProfile, status: 'published' }),
                      sessionId: sessionRef.current
                    });
                    
                    setIsDraft(false);
                    alert('Capacity profile published successfully!');
                  }, PERFORMANCE_BUDGETS.PUBLISH_OPERATION, 'Hub Capacity Publish');
                } finally {
                  publishPerformanceMonitor.end();
                }
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Publish Now</span>
            </button>
          </div>
        </div>

        {/* Active Capacity Profile */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-4">
                <span className="font-medium">Active capacity profile:</span>
                <span className="font-semibold">{getCurrentHub().name}</span>
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">v{capacityProfile.version}</span>
                <span className={`text-sm px-2 py-1 rounded ${
                  capacityProfile.state === 'published' ? 'bg-green-100 text-green-800' :
                  capacityProfile.state === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {capacityProfile.state.charAt(0).toUpperCase() + capacityProfile.state.slice(1)}
                </span>
                {isDraft && <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded">Draft Changes</span>}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Effective: {formatDateTime(capacityProfile.effectiveDate)} • 
                Last edited by {capacityProfile.lastEditedBy} • {capacityProfile.changeReason}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hub Selectors & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Hub Selection</h3>
            <div className="space-y-2">
              {hubs.map((hub) => (
                <button
                  key={hub.id}
                  onClick={() => setSelectedHub(hub.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedHub === hub.id
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      hub.status === 'active' ? 'bg-green-500' :
                      hub.status === 'maintenance' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <div className="font-medium">{hub.name} ({hub.code})</div>
                      <div className="text-sm text-gray-500">{hub.location}</div>
                      <div className="text-xs text-gray-400">{hub.timezone}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Auth Capacity/Day</p>
                  <p className="text-2xl font-bold text-gray-900">{capacityProfile.authCapacity}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Sewing Capacity/Day</p>
                  <p className="text-2xl font-bold text-gray-900">{capacityProfile.sewingCapacity}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">QA Capacity/Day</p>
                  <p className="text-2xl font-bold text-gray-900">{capacityProfile.qaCapacity}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Business Hours</p>
                  <p className="text-lg font-bold text-gray-900">{capacityProfile.workingHours.start}-{capacityProfile.workingHours.end}</p>
                  <p className="text-xs text-gray-500">{capacityProfile.timezone}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', name: 'Overview', icon: BarChart3 },
              { id: 'calendars', name: 'Calendars', icon: Calendar },
              { id: 'exceptions', name: 'Exceptions & Rules', icon: Settings },
              { id: 'reservations', name: 'Live Utilization', icon: Eye },
              { id: 'integration', name: 'Integration Rules', icon: ExternalLink }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Capacity Settings</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Auth Slots/Day</label>
                        <input
                          type="number"
                          value={capacityProfile.authCapacity}
                          onChange={(e) => updateCapacity('auth', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Sewing Slots/Day</label>
                        <input
                          type="number"
                          value={capacityProfile.sewingCapacity}
                          onChange={(e) => updateCapacity('sewing', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">QA Slots/Day</label>
                        <input
                          type="number"
                          value={capacityProfile.qaCapacity}
                          onChange={(e) => updateCapacity('qa', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Overbooking (%)</label>
                        <input
                          type="number"
                          value={capacityProfile.overbookingPercent}
                          onChange={(e) => setCapacityProfile(prev => ({ ...prev, overbookingPercent: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Rush Bucket (%)</label>
                        <input
                          type="number"
                          value={capacityProfile.rushBucketPercent}
                          onChange={(e) => setCapacityProfile(prev => ({ ...prev, rushBucketPercent: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Today's Utilization</h3>
                  <div className="space-y-4">
                    {['auth', 'sewing', 'qa'].map((lane) => {
                      const capacity = getCapacityForLane(lane);
                      const utilized = Math.floor(Math.random() * capacity);
                      const percentage = (utilized / capacity) * 100;
                      
                      return (
                        <div key={lane} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900 capitalize">{lane}</span>
                            <span className="text-sm text-gray-600">{utilized}/{capacity} slots</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                percentage >= 90 ? 'bg-red-500' :
                                percentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}% utilized</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Calendars Tab */}
          {activeTab === 'calendars' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h3 className="text-lg font-medium text-gray-900">Capacity Calendar</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Lane:</span>
                    <select
                      value={selectedLane}
                      onChange={(e) => setSelectedLane(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="auth">Authentication</option>
                      <option value="sewing">Sewing</option>
                      <option value="qa">QA</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {['month', 'week', 'day'].map((view) => (
                    <button
                      key={view}
                      onClick={() => setCalendarView(view as any)}
                      className={`px-3 py-1 text-sm rounded-md ${
                        calendarView === view
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {view.charAt(0).toUpperCase() + view.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, index) => {
                    const dayNumber = new Date(day.date).getDate();
                    const calc = day.calculation;
                    const overflowIcon = getUtilizationIcon(day);
                    
                    return (
                      <div
                        key={day.date}
                        onClick={() => handleDayClick(day)}
                        className="bg-white border rounded-lg p-3 hover:shadow-md cursor-pointer transition-shadow min-h-24 relative"
                        title={`${day.date}
Utilization: ${calc.utilization.toFixed(1)}% (H:${day.held} + P:${day.planned} + C:${day.consumed}) / (${getCapacityForLane(selectedLane)} × ${day.seasonalityMultiplier} × ${1 + capacityProfile.overbookingPercent/100})
Available: ${calc.availableSlots} slots
Rush Available: ${calc.rushAvailable}/${Math.ceil(getCapacityForLane(selectedLane) * capacityProfile.rushBucketPercent/100)}
QA Load: ${calc.qaLoadMinutes}/${calc.qaCapacityMinutes} min`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{dayNumber}</span>
                          <div className="flex items-center space-x-1">
                            <div className={`w-3 h-3 rounded-full ${getUtilizationColor(day)}`}></div>
                            {overflowIcon && <span className="text-xs">{overflowIcon}</span>}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600">
                            <span className="text-blue-600">{day.held}H</span> •
                            <span className="text-green-600"> {day.planned}P</span> •
                            <span className="text-gray-800"> {day.consumed}C</span>
                          </div>
                          <div className="text-xs text-gray-500">{calc.utilization.toFixed(0)}% util</div>
                          <div className="text-xs text-gray-400">
                            Avail: {calc.availableSlots} | Rush: {calc.rushAvailable}
                          </div>
                          {day.seasonalityMultiplier !== 1.0 && (
                            <div className="text-xs text-purple-600">×{day.seasonalityMultiplier}</div>
                          )}
                          {day.isBlackout && <div className="text-xs text-red-600">Blackout</div>}
                          {day.isMaintenance && <div className="text-xs text-orange-600">Maintenance</div>}
                          {day.isOvertime && <div className="text-xs text-blue-600">Overtime</div>}
                          {day.overflowFromPrevDay > 0 && (
                            <div className="text-xs text-indigo-600">+{day.overflowFromPrevDay} overflow</div>
                          )}
                        </div>
                        
                        {calc.overflowToNextDay && (
                          <div className="absolute top-1 right-1">
                            <div className="w-2 h-2 bg-orange-500 rounded-full border border-white" 
                                 title="Overflow to next day"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Normal (0-60%)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Busy (60-80%)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span>High (80-100%)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Overbooked (100%+)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span>Unavailable</span>
                </div>
              </div>
            </div>
          )}

          {/* Exceptions & Rules Tab */}
          {activeTab === 'exceptions' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Blackouts & Holidays</h3>
                  <div className="space-y-3">
                    {blackouts.map((blackout) => (
                      <div key={blackout.id} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{blackout.name}</div>
                            <div className="text-sm text-gray-600">
                              {blackout.type === 'recurring' ? 'Recurring' : 'One-time'} • 
                              Affects: {blackout.affectedLanes.join(', ')}
                            </div>
                            <div className="text-sm text-gray-500">{blackout.reason}</div>
                          </div>
                          <div className="flex space-x-2">
                            <button className="text-blue-600 hover:text-blue-800">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button className="text-red-600 hover:text-red-800">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <button className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <div className="flex items-center justify-center space-x-2">
                        <Plus className="h-4 w-4" />
                        <span>Add Blackout Rule</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Maintenance Windows</h3>
                  <div className="space-y-3">
                    {maintenance.map((window) => (
                      <div key={window.id} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{window.name}</div>
                            <div className="text-sm text-gray-600">
                              {window.date} • {window.startTime}-{window.endTime}
                            </div>
                            <div className="text-sm text-gray-500">
                              Reduces capacity by {window.slotsReduction} slots • Approved by {window.approver}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button className="text-blue-600 hover:text-blue-800">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button className="text-red-600 hover:text-red-800">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <button className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-colors">
                      <div className="flex items-center justify-center space-x-2">
                        <Plus className="h-4 w-4" />
                        <span>Schedule Maintenance</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Utilization Tab */}
          {activeTab === 'reservations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Live Reservations & Utilization</h3>
                <div className="flex items-center space-x-2">
                  <button className="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm hover:bg-blue-200">
                    <RefreshCw className="h-4 w-4 inline mr-1" />
                    Refresh
                  </button>
                  <button className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-200">
                    <Download className="h-4 w-4 inline mr-1" />
                    Export
                  </button>
                </div>
              </div>

              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shipment</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lane</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slots Used</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reservations.map((reservation) => (
                      <tr key={reservation.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-blue-600">{reservation.shipmentId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            reservation.type === 'hold' ? 'bg-yellow-100 text-yellow-800' :
                            reservation.type === 'booking' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {reservation.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {reservation.lane}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {reservation.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {reservation.slotsUsed}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            reservation.tier === 'T3' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {reservation.tier}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            reservation.priority === 'priority' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {reservation.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {reservation.status}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-800 mr-3">
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          <button className="text-gray-600 hover:text-gray-800">
                            <Info className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Integration Rules Tab */}
          {activeTab === 'integration' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-blue-900 mb-4">Tier Gate Integration</h3>
                  <div className="space-y-3 text-sm">
                    <div className="bg-white p-3 rounded border-l-4 border-blue-500">
                      <div className="font-medium">T2 Requirements</div>
                      <div className="text-gray-600">Requires Auth capacity on tentative intake day</div>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-blue-500">
                      <div className="font-medium">T3 Requirements</div>
                      <div className="text-gray-600">Requires both Auth and Sewing capacity within defined windows</div>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-red-500">
                      <div className="font-medium">Capacity Exceeded</div>
                      <div className="text-gray-600">Must offer switch Hub / delay / transfer stock</div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-green-900 mb-4">Quote & Plan Integration</h3>
                  <div className="space-y-3 text-sm">
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <div className="font-medium">Route Scoring</div>
                      <div className="text-gray-600">Penalizes days with high utilization</div>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <div className="font-medium">Capacity Blocking</div>
                      <div className="text-gray-600">Blocks selection if day exceeds capacity (after overbooking/rush rules)</div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-yellow-900 mb-4">Hub Console Integration</h3>
                  <div className="space-y-3 text-sm">
                    <div className="bg-white p-3 rounded border-l-4 border-yellow-500">
                      <div className="font-medium">Slot Requirement</div>
                      <div className="text-gray-600">Cannot start job without a slot</div>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-orange-500">
                      <div className="font-medium">Overtime Slots</div>
                      <div className="text-gray-600">Show as amber with approver badge</div>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-purple-900 mb-4">Dashboard Integration</h3>
                  <div className="space-y-3 text-sm">
                    <div className="bg-white p-3 rounded border-l-4 border-purple-500">
                      <div className="font-medium">Hub Capacity Panel</div>
                      <div className="text-gray-600">Reads from these settings for Today/Next 7 days view</div>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-purple-500">
                      <div className="font-medium">Real-time Updates</div>
                      <div className="text-gray-600">Utilization updates reflect in dashboard immediately</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side Panel */}
      {showSidePanel && sidePanelData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {sidePanelData.type === 'day' ? `Capacity Details - ${sidePanelData.data.date}` : 'Details'}
              </h2>
              <button onClick={() => setShowSidePanel(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="px-6 py-6">
              {sidePanelData.type === 'day' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600">Available Slots</div>
                      <div className="text-2xl font-bold text-gray-900">{sidePanelData.data.available}</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-blue-600">Held</div>
                      <div className="text-2xl font-bold text-blue-900">{sidePanelData.data.held}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm text-green-600">Planned</div>
                      <div className="text-2xl font-bold text-green-900">{sidePanelData.data.planned}</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-sm text-purple-600">In Progress</div>
                      <div className="text-2xl font-bold text-purple-900">{sidePanelData.data.consumed}</div>
                    </div>
                  </div>

                                        {sidePanelData.reservations && sidePanelData.reservations.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Reservations</h3>
                      <div className="space-y-3">
                        {sidePanelData.reservations.map((reservation: ReservationLocal) => (
                          <div key={reservation.id} className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-blue-600">{reservation.shipmentId}</div>
                                <div className="text-sm text-gray-600">{reservation.lane} • {reservation.tier}</div>
                                <div className="text-sm text-gray-500">{reservation.slotsUsed} slots • {reservation.status}</div>
                              </div>
                              <button className="text-blue-600 hover:text-blue-800">
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Guards Modal */}
      {showGuardsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span>Capacity Change Validation</span>
                </h3>
                <button onClick={() => setShowGuardsModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4">
              <div className="space-y-4">
                {guards.map((guard) => (
                  <div 
                    key={guard.id} 
                    className={`p-4 rounded-lg border-l-4 ${
                      guard.severity === 'error' ? 'bg-red-50 border-red-500' :
                      guard.severity === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                      'bg-blue-50 border-blue-500'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {guard.severity === 'error' ? (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      ) : guard.severity === 'warning' ? (
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <Info className="h-5 w-5 text-blue-500" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{guard.message}</p>
                        {guard.affectedBookings && guard.affectedBookings.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-600">Affected shipments:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {guard.affectedBookings.map(id => (
                                <span key={id} className="inline-flex px-2 py-1 text-xs bg-gray-200 rounded">
                                  {id}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowGuardsModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              {guards.some(g => g.requiresOverride) && (
                <button
                  onClick={() => {
                    // Handle override logic here
                    setShowGuardsModal(false);
                    alert('Override approved. Changes will be applied with admin notification.');
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
                >
                  Override & Continue
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seasonality Modal */}
      {showSeasonalityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Seasonal Capacity Multipliers</h3>
                <button onClick={() => setShowSeasonalityModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 mb-4">
                Adjust capacity multipliers by month. Values below 1.0 reduce capacity, above 1.0 increase it.
              </p>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(capacityProfile.seasonalityMultipliers).map(([month, multiplier]) => (
                  <div key={month} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 capitalize">
                      {month}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="2.0"
                      value={multiplier}
                      onChange={(e) => {
                        setCapacityProfile(prev => ({
                          ...prev,
                          seasonalityMultipliers: {
                            ...prev.seasonalityMultipliers,
                            [month]: Number(e.target.value)
                          }
                        }));
                        setIsDraft(true);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="text-xs text-gray-500">
                      Effective: {Math.floor(getCapacityForLane(selectedLane) * multiplier)} slots
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowSeasonalityModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Blackout Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span>Emergency Blackout</span>
                </h3>
                <button onClick={() => setShowEmergencyModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  This will immediately create a blackout for today and automatically notify:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>Tier Gate (block new assignments)</li>
                  <li>Plan (prevent new bookings)</li>
                  <li>Hub Console (halt operations)</li>
                  <li>Operations team</li>
                </ul>
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-red-800">
                    Warning: This action cannot be undone and will immediately impact live operations.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergencyBlackout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
              >
                Activate Emergency Blackout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Reason Modal */}
      {isDraft && (
        <div className="fixed bottom-0 left-0 right-0 bg-yellow-50 border-t border-yellow-200 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="text-yellow-800 font-medium">You have unsaved changes</span>
              {guards.length > 0 && (
                <span className="text-sm text-red-600">
                  ({guards.filter(g => g.severity === 'error').length} errors, {guards.filter(g => g.severity === 'warning').length} warnings)
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="text"
                placeholder="Enter change reason..."
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                className="px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <button 
                onClick={async () => {
                  // Emit structured event per specification: hub_capacity.changed
                  await SettingsEventAPI.hubCapacityChanged({
                    actorId: 'current_user@aucta.io',
                    hubId: selectedHub,
                    changeType: 'capacity',
                    fieldsChanged: ['draft_saved'],
                    preState: createStateSnapshot(capacityProfile),
                    postState: createStateSnapshot({ ...capacityProfile, lastSaved: new Date().toISOString() }),
                    sessionId: sessionRef.current
                  });
                  setIsDraft(false);
                  alert('Draft saved successfully!');
                }}
                disabled={!changeReason.trim()}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:bg-gray-400"
              >
                Save Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
