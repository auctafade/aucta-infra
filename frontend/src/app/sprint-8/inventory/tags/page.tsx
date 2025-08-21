'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { inventoryApi, type HubInventoryData, type InventoryTag } from '@/lib/inventoryApi';
import Link from 'next/link';
import { 
  ChevronRight, Tag, Plus, Search, Filter, Package, QrCode, Wifi, Edit, Trash2, Eye, Download, 
  CheckCircle, Clock, AlertTriangle, Database, Smartphone, Printer, TrendingUp, TrendingDown, 
  Building2, ArrowRightLeft, RotateCcw, Calendar, MapPin, Users, BarChart3, RefreshCw, 
  Gauge, Zap, Shield, ExternalLink, Settings2, Activity, Target, AlertCircle, X
} from 'lucide-react';

export default function InventoryTagsPage() {
  const [currentView, setCurrentView] = useState('hub-overview'); // 'hub-overview' | 'hub-detail' | 'inventory-table'
  const [selectedHub, setSelectedHub] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Enhanced hub data with historical usage for calculations
  const hubData = [
    {
      id: 'HUB-PAR',
      name: 'Paris Hub',
      location: 'Paris, France',
      currentStock: {
        free: 1250,
        reserved: 340,
        appliedToday: 89
      },
      threshold: 500,
      historical: {
        tagsAppliedLast7Days: 315, // For burn rate calculation
        tagsAppliedLast30Days: 1140,
        recentUsage: true
      },
      plannedShipments: {
        next7Days: 8, // T2 shipments planned
        next14Days: 15
      },
      upcomingDemand: {
        next7Days: 285,
        next14Days: 520
      },
      status: 'healthy',
      lastUpdate: '2024-01-15 14:30',
      alertThresholds: {
        daysOfCover: 14, // Alert if < 14 days
        stockLevel: 500  // Alert if < threshold
      }
    },
    {
      id: 'HUB-LON',
      name: 'London Hub',
      location: 'London, UK',
      currentStock: {
        free: 420,
        reserved: 180,
        appliedToday: 67
      },
      threshold: 600,
      historical: {
        tagsAppliedLast7Days: 364,
        tagsAppliedLast30Days: 1470,
        recentUsage: true
      },
      plannedShipments: {
        next7Days: 12,
        next14Days: 22
      },
      upcomingDemand: {
        next7Days: 340,
        next14Days: 620
      },
      status: 'warning',
      lastUpdate: '2024-01-15 14:25',
      alertThresholds: {
        daysOfCover: 14,
        stockLevel: 600
      }
    }
  ];

  // Enhanced inventory data for hub detail view
  const mockInventory = [
    {
      id: 'TAG-001',
      batchRange: 'TAG-001',
      lot: 'LOT-2024-001',
      status: 'stock',
      reservedFor: null,
      lastMovement: '2024-01-10 09:30',
      notes: 'Premium grade, pristine condition',
      receivedDate: '2024-01-10',
      expiryDate: '2024-06-10',
      hub: 'HUB-PAR'
    },
    {
      id: 'TAG-002-010',
      batchRange: 'TAG-002 to TAG-010',
      lot: 'LOT-2024-001',
      status: 'reserved',
      reservedFor: 'SHP-2024-123',
      lastMovement: '2024-01-14 14:22',
      notes: 'Reserved for luxury watch shipment',
      receivedDate: '2024-01-10',
      expiryDate: '2024-06-10',
      hub: 'HUB-PAR'
    },
    {
      id: 'TAG-011',
      batchRange: 'TAG-011',
      lot: 'LOT-2024-002',
      status: 'applied',
      reservedFor: 'SHP-2024-124',
      lastMovement: '2024-01-15 11:45',
      notes: 'Applied at Hub Console Station 2',
      receivedDate: '2024-01-12',
      expiryDate: '2024-06-12',
      hub: 'HUB-PAR'
    },
    {
      id: 'TAG-012',
      batchRange: 'TAG-012',
      lot: 'LOT-2024-002',
      status: 'rma',
      reservedFor: null,
      lastMovement: '2024-01-13 16:20',
      notes: 'Defective adhesive - quality issue reported',
      receivedDate: '2024-01-12',
      expiryDate: '2024-06-12',
      hub: 'HUB-PAR'
    },
    {
      id: 'TAG-013-025',
      batchRange: 'TAG-013 to TAG-025',
      lot: 'LOT-2024-003',
      status: 'stock',
      reservedFor: null,
      lastMovement: '2024-01-15 08:15',
      notes: 'Fresh batch, ready for assignment',
      receivedDate: '2024-01-15',
      expiryDate: '2024-07-15',
      hub: 'HUB-LON'
    },
    {
      id: 'TAG-026-040',
      batchRange: 'TAG-026 to TAG-040',
      lot: 'LOT-2024-003',
      status: 'reserved',
      reservedFor: 'SHP-2024-125',
      lastMovement: '2024-01-15 13:30',
      notes: 'Pre-reserved for high-value electronics',
      receivedDate: '2024-01-15',
      expiryDate: '2024-07-15',
      hub: 'HUB-LON'
    }
  ];

  // Mock user role for RBAC
  const userRole = 'ops_admin'; // 'ops_admin' | 'hub_tech'

  // Additional state for enhanced functionality
  const [filterLot, setFilterLot] = useState('all');
  const [filterReservation, setFilterReservation] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showShipmentPicker, setShowShipmentPicker] = useState(false);
  const [showReceiveBatch, setShowReceiveBatch] = useState(false);
  const [showUnreserveModal, setShowUnreserveModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [showAlerts, setShowAlerts] = useState(true);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [alertContext, setAlertContext] = useState<any>(null);
  
  // UX enhancement states
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(15);
  
  // Real data states
  const [realHubData, setRealHubData] = useState<HubInventoryData[]>([]);
  const [realInventory, setRealInventory] = useState<InventoryTag[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // State management for tag operations
  const [tagHistory, setTagHistory] = useState<any[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [eventLog, setEventLog] = useState<any[]>([]);
  
  // Edge cases & telemetry
  const [quarantinedLots, setQuarantinedLots] = useState<string[]>([]);
  const [thresholdHistory, setThresholdHistory] = useState<any[]>([]);
  const [telemetryData, setTelemetryData] = useState<any>({
    transferTimes: [],
    assignmentTimes: [],
    alertResolutionTimes: {},
    rmaEvents: [],
    daysCoverTrends: {}
  });

  // Edge case: Threshold edits - log actor & reason; immediate recalculation of alert state
  const updateHubThreshold = (hubId: string, newThreshold: number, reason: string) => {
    const oldThreshold = hubData.find(h => h.id === hubId)?.threshold || 0;
    
    // Update hub data
    const updatedHubData = hubData.map(hub => 
      hub.id === hubId ? { ...hub, threshold: newThreshold } : hub
    );
    
    // Log threshold change
    const thresholdChange = {
      id: `threshold-${Date.now()}`,
      hubId,
      hubName: hubData.find(h => h.id === hubId)?.name || hubId,
      oldThreshold,
      newThreshold,
      reason,
      actor: userRole === 'ops_admin' ? 'user.ops.admin' : 'user.hub.tech',
      timestamp: new Date().toISOString(),
      alertsBeforeChange: getHubAlerts().length
    };
    
    setThresholdHistory(prev => [thresholdChange, ...prev]);
    
    // Emit event
    emitEvent('inventory.threshold.updated', thresholdChange);
    
    // Immediate recalculation of alert state would happen here
    // (in real app, this would trigger alert re-evaluation)
    console.log(`📊 Threshold updated for ${thresholdChange.hubName}: ${oldThreshold} → ${newThreshold} (${reason})`);
    
    return thresholdChange;
  };

  // Telemetry tracking functions
  const trackTransferTime = (transferId: string, startTime: Date, endTime: Date) => {
    const timeToArriveMs = endTime.getTime() - startTime.getTime();
    
    setTelemetryData((prev: any) => ({
      ...prev,
      transferTimes: [
        ...prev.transferTimes,
        {
          transferId,
          timeToArriveMs,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          days: Math.round(timeToArriveMs / (1000 * 60 * 60 * 24))
        }
      ].slice(-100) // Keep last 100 entries
    }));

    emitEvent('telemetry.transfer.time_to_arrive_ms', {
      transferId,
      timeToArriveMs,
      days: Math.round(timeToArriveMs / (1000 * 60 * 60 * 24))
    });
  };

  const trackAssignmentTime = (tagId: string, startTime: Date, endTime: Date) => {
    const assignmentTimeMs = endTime.getTime() - startTime.getTime();
    
    setTelemetryData((prev: any) => ({
      ...prev,
      assignmentTimes: [
        ...prev.assignmentTimes,
        {
          tagId,
          assignmentTimeMs,
          timestamp: endTime.toISOString()
        }
      ].slice(-100) // Keep last 100 entries
    }));

    emitEvent('telemetry.assign.time_ms', {
      tagId,
      assignmentTimeMs
    });
  };

  const trackDaysCoverTrend = (hubId: string, daysOfCover: number) => {
    const today = new Date().toISOString().split('T')[0];
    
    setTelemetryData((prev: any) => ({
      ...prev,
      daysCoverTrends: {
        ...prev.daysCoverTrends,
        [hubId]: {
          ...prev.daysCoverTrends[hubId],
          [today]: daysOfCover
        }
      }
    }));

    emitEvent('telemetry.cover.days_by_hub', {
      hubId,
      daysOfCover,
      date: today
    });
  };

  const trackRMAEvent = (tagId: string, reason: string) => {
    const rmaEvent = {
      tagId,
      reason,
      timestamp: new Date().toISOString(),
      lot: mockInventory.find(t => t.id === tagId)?.lot
    };
    
    setTelemetryData((prev: any) => ({
      ...prev,
      rmaEvents: [...prev.rmaEvents, rmaEvent].slice(-100)
    }));

    emitEvent('telemetry.rma.rate', rmaEvent);
  };

  const trackAlertResolutionTime = (alertId: string, startTime: Date, endTime: Date) => {
    const resolutionTimeMs = endTime.getTime() - startTime.getTime();
    
    setTelemetryData((prev: any) => ({
      ...prev,
      alertResolutionTimes: {
        ...prev.alertResolutionTimes,
        [alertId]: {
          resolutionTimeMs,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          minutes: Math.round(resolutionTimeMs / (1000 * 60))
        }
      }
    }));

    emitEvent('telemetry.alert.time_to_clear_ms', {
      alertId,
      resolutionTimeMs,
      minutes: Math.round(resolutionTimeMs / (1000 * 60))
    });
  };

  // Event emission framework
  const emitEvent = (eventType: string, payload: any) => {
    const event = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      payload: {
        ...payload,
        ts: new Date().toISOString(),
        actorId: userRole === 'ops_admin' ? 'user.ops.admin' : 'user.hub.tech'
      },
      timestamp: new Date().toISOString()
    };
    
    setEventLog(prev => [event, ...prev]);
    
    // In real app, this would emit to WebSocket/EventBus
    console.log('🚀 Event Emitted:', event);
    
    return event;
  };

  // Edge case: Lot quarantine - mark a lot as quarantined
  const quarantineLot = (lotId: string, reason: string) => {
    setQuarantinedLots(prev => [...prev, lotId]);
    
    // Mark all tags in this lot as quarantined
    const quarantinedTags = mockInventory
      .filter(tag => tag.lot === lotId && tag.status === 'stock')
      .map(tag => tag.id);
    
    quarantinedTags.forEach(tagId => {
      createTagMovementLog(tagId, 'QUARANTINED', {
        lotId,
        reason,
        action: 'lot_quarantine'
      });
    });
    
    emitEvent('inventory.lot.quarantined', {
      lotId,
      reason,
      tagCount: quarantinedTags.length,
      affectedTags: quarantinedTags
    });
    
    return quarantinedTags.length;
  };

  // Edge case: Release quarantine or prompt RMA
  const releaseLotQuarantine = (lotId: string, action: 'release' | 'rma', reason: string) => {
    setQuarantinedLots(prev => prev.filter(id => id !== lotId));
    
    const affectedTags = mockInventory.filter(tag => tag.lot === lotId);
    
    if (action === 'rma') {
      // Move entire lot to RMA
      affectedTags.forEach(tag => {
        markTagRMA(tag.id, `Lot ${lotId} RMA: ${reason}`);
      });
    } else {
      // Release back to stock
      affectedTags.forEach(tag => {
        createTagMovementLog(tag.id, 'QUARANTINE_RELEASED', {
          lotId,
          reason,
          action: 'lot_release'
        });
      });
    }
    
    emitEvent('inventory.lot.quarantine_resolved', {
      lotId,
      action,
      reason,
      tagCount: affectedTags.length
    });
  };

  // Tag state transition functions
  const createTagMovementLog = (tagId: string, action: string, details: any = {}) => {
    const movement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tagId,
      action,
      timestamp: new Date().toISOString(),
      actorId: userRole === 'ops_admin' ? 'user.ops.admin' : 'user.hub.tech',
      actorName: userRole === 'ops_admin' ? 'Operations Admin' : 'Hub Technician',
      ...details
    };
    
    setTagHistory(prev => [movement, ...prev]);
    return movement;
  };

  // State transition: Receive tags
  const receiveTagsBatch = (hubId: string, lot: string, quantity: number, tags: string[] = []) => {
    const receivedTags = tags.length > 0 ? tags : Array.from({ length: quantity }, (_, i) => `TAG-${Date.now()}-${i + 1}`);
    
    // Update inventory state
    const newTags = receivedTags.map(tagId => ({
      id: tagId,
      batchRange: receivedTags.length > 1 ? `${receivedTags[0]} to ${receivedTags[receivedTags.length - 1]}` : tagId,
      lot,
      status: 'stock',
      reservedFor: null,
      lastMovement: new Date().toISOString(),
      notes: `Received batch: ${lot}`,
      receivedDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months
      hub: hubId
    }));

    // Create movement logs
    receivedTags.forEach(tagId => {
      createTagMovementLog(tagId, 'RECEIVED', {
        hubId,
        lot,
        previousStatus: null,
        newStatus: 'stock',
        notes: `Batch received: ${lot}`
      });
    });

    // Emit event
    emitEvent('inventory.tag.received', {
      hubId,
      lot,
      qty: quantity,
      tagIds: receivedTags
    });

    return newTags;
  };

  // State transition: Assign to shipment
  const assignTagToShipment = (tagId: string, shipmentId: string, hubId: string) => {
    const startTime = new Date();
    // Validate preconditions with friendly error messages
    const tag = mockInventory.find(t => t.id === tagId);
    if (!tag) throw new Error(`Tag ${tagId} not found in the system. Please check the tag ID and try again.`);
    
    if (tag.status !== 'stock') {
      const statusMessage = {
        'reserved': 'already assigned to a shipment',
        'applied': 'already applied and cannot be reassigned', 
        'rma': 'marked as defective and cannot be used',
        'in_transit': 'being transferred between hubs'
      }[tag.status] || `has status: ${tag.status}`;
      throw new Error(`Cannot assign tag ${tagId} - it is ${statusMessage}. Only free stock can be assigned to shipments.`);
    }
    
    if (tag.hub !== hubId) {
      const hubName = hubData.find(h => h.id === hubId)?.name || hubId;
      const tagHubName = hubData.find(h => h.id === tag.hub)?.name || tag.hub;
      
      // Edge case: Assigning wrong Hub - propose transfer first
      const transferSuggestion = `Would you like to transfer this tag from ${tagHubName} to ${hubName} first?`;
      throw new Error(`Tag ${tagId} is located at ${tagHubName}, but you're trying to assign it at ${hubName}. Tags can only be assigned at their current hub location. ${transferSuggestion}`);
    }

    // Create movement log
    createTagMovementLog(tagId, 'ASSIGNED', {
      hubId,
      shipmentId,
      previousStatus: 'stock',
      newStatus: 'reserved',
      notes: `Assigned to shipment ${shipmentId}`
    });

    // Emit event
    emitEvent('inventory.tag.assigned', {
      tagId,
      hubId,
      shipmentId
    });

    // Track assignment time for UI efficiency telemetry
    const endTime = new Date();
    trackAssignmentTime(tagId, startTime, endTime);

    // Update tag state (in real app, this would update the database)
    console.log(`✅ Tag ${tagId} assigned to shipment ${shipmentId} at ${hubId}`);
    
    return {
      success: true,
      tagId,
      newStatus: 'reserved',
      assignedShipmentId: shipmentId
    };
  };

  // State transition: Apply tag (from Hub Console)
  const applyTag = (tagId: string, hubId: string) => {
    const tag = mockInventory.find(t => t.id === tagId);
    if (!tag) throw new Error('Tag not found');
    if (tag.status !== 'reserved') throw new Error(`Cannot apply tag with status: ${tag.status}`);

    // Create movement log
    createTagMovementLog(tagId, 'APPLIED', {
      hubId,
      previousStatus: 'reserved',
      newStatus: 'applied',
      notes: 'Applied at Hub Console'
    });

    // Emit event (this would normally come from Hub Console)
    emitEvent('tag.applied', {
      tagId,
      hubId,
      shipmentId: tag.reservedFor
    });

    console.log(`✅ Tag ${tagId} applied at ${hubId}`);
    
    return {
      success: true,
      tagId,
      newStatus: 'applied'
    };
  };

  // State transition: Unreserve tag
  const unreserveTag = (tagId: string, reason: string, isOpsOverride: boolean = false) => {
    const tag = mockInventory.find(t => t.id === tagId);
    if (!tag) throw new Error('Tag not found');
    if (tag.status !== 'reserved') throw new Error(`Cannot unreserve tag with status: ${tag.status}`);

    // Check if job has started (simulated check)
    const jobStarted = Math.random() < 0.3; // 30% chance job started
    if (jobStarted && !isOpsOverride) {
      throw new Error('Cannot unreserve: Hub job already started. Ops override required.');
    }

    // Create movement log
    createTagMovementLog(tagId, isOpsOverride ? 'UNRESERVED_OVERRIDE' : 'UNRESERVED', {
      reason,
      previousStatus: 'reserved',
      newStatus: 'stock',
      notes: isOpsOverride ? `Ops override unreserve: ${reason}` : `Unreserved: ${reason}`,
      jobStarted
    });

    // Emit event
    emitEvent('inventory.tag.unreserved', {
      tagId,
      reason,
      wasJobStarted: jobStarted,
      isOpsOverride
    });

    console.log(`✅ Tag ${tagId} unreserved: ${reason}`);
    
    return {
      success: true,
      tagId,
      newStatus: 'stock',
      reason
    };
  };

  // State transition: Mark RMA
  const markTagRMA = (tagId: string, reason: string) => {
    const tag = mockInventory.find(t => t.id === tagId);
    if (!tag) throw new Error('Tag not found');

    // Create movement log
    createTagMovementLog(tagId, 'RMA', {
      reason,
      previousStatus: tag.status,
      newStatus: 'rma',
      notes: `Marked as RMA: ${reason}`
    });

    // Emit event
    emitEvent('inventory.tag.rma', {
      tagId,
      reason,
      previousStatus: tag.status
    });

    // Track RMA event for rate telemetry
    trackRMAEvent(tagId, reason);

    console.log(`✅ Tag ${tagId} marked as RMA: ${reason}`);
    
    return {
      success: true,
      tagId,
      newStatus: 'rma',
      reason
    };
  };

  // Edge case: Check for overdue transfers
  const checkOverdueTransfers = () => {
    const now = new Date();
    const overdueTransfers = pendingTransfers.filter(transfer => {
      const etaDate = new Date(transfer.eta);
      const daysPastDue = Math.floor((now.getTime() - etaDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysPastDue > 0;
    });
    
    return overdueTransfers.map(transfer => ({
      ...transfer,
      daysPastDue: Math.floor((now.getTime() - new Date(transfer.eta).getTime()) / (1000 * 60 * 60 * 24))
    }));
  };

  // Edge case: Mark transfer as arrived or lost (opens Incident)
  const resolveOverdueTransfer = (transferId: string, resolution: 'arrived' | 'lost') => {
    if (resolution === 'arrived') {
      confirmTransferArrival(transferId);
    } else if (resolution === 'lost') {
      // Create incident for lost transfer
      const transfer = pendingTransfers.find(t => t.id === transferId);
      if (transfer) {
        const incident = {
          id: `INC-${Date.now()}`,
          type: 'lost_transfer',
          severity: 'high',
          title: `Lost Transfer: ${transfer.id}`,
          description: `Transfer of ${transfer.quantity} tags from ${transfer.fromHub} to ${transfer.toHub} is ${transfer.daysPastDue} days overdue`,
          transferId: transferId,
          createdAt: new Date().toISOString(),
          status: 'open'
        };
        
        emitEvent('incident.created', incident);
        
        // Remove from pending transfers
        setPendingTransfers(prev => prev.filter(t => t.id !== transferId));
        
        // Update inventory - mark tags as lost
        transfer.tagIds.forEach((tagId: string) => {
          createTagMovementLog(tagId, 'LOST_IN_TRANSIT', {
            transferId,
            incidentId: incident.id,
            reason: 'Transfer overdue, marked as lost'
          });
        });
      }
    }
  };

  // State transition: Transfer between hubs
  const initiateTransfer = (fromHubId: string, toHubId: string, quantity: number, specificTagIds: string[] = [], reason: string = '', eta: string = '') => {
    // Validate preconditions
    const fromHub = hubData.find(h => h.id === fromHubId);
    const toHub = hubData.find(h => h.id === toHubId);
    if (!fromHub || !toHub) throw new Error('Invalid hub selection');

    // Get available tags for transfer
    const availableTags = mockInventory.filter(t => 
      t.hub === fromHubId && 
      ['stock'].includes(t.status) && // Only stock status can be transferred
      (specificTagIds.length === 0 || specificTagIds.includes(t.id))
    );

    if (availableTags.length < quantity) {
      throw new Error(`Not enough free stock at ${fromHub.name}. You have ${availableTags.length} tags available, but need ${quantity}. Only free stock can be transferred (reserved and applied tags cannot be moved).`);
    }

    const tagsToTransfer = availableTags.slice(0, quantity);
    const transferId = `TXR-${Date.now()}`;

    // Create transfer record
    const transfer = {
      id: transferId,
      fromHubId,
      toHubId,
      fromHubName: fromHub.name,
      toHubName: toHub.name,
      quantity,
      tagIds: tagsToTransfer.map(t => t.id),
      reason,
      eta: eta || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default 1 day
      status: 'in_transit',
      initiatedAt: new Date().toISOString(),
      initiatedBy: userRole === 'ops_admin' ? 'user.ops.admin' : 'user.hub.tech'
    };

    setPendingTransfers(prev => [transfer, ...prev]);

    // Create movement logs for each tag
    tagsToTransfer.forEach(tag => {
      createTagMovementLog(tag.id, 'TRANSFER_INITIATED', {
        transferId,
        fromHubId,
        toHubId,
        previousStatus: tag.status,
        newStatus: 'in_transit',
        notes: `Transfer initiated: ${fromHub.name} → ${toHub.name}`,
        reason,
        eta: transfer.eta
      });
    });

    // Emit event
    emitEvent('inventory.tag.transferred', {
      transferId,
      fromHub: fromHubId,
      toHub: toHubId,
      qty: quantity,
      tagIds: tagsToTransfer.map(t => t.id),
      eta: transfer.eta,
      reason
    });

    console.log(`✅ Transfer initiated: ${quantity} tags from ${fromHub.name} to ${toHub.name}`);
    
    return transfer;
  };

  // State transition: Confirm transfer arrival
  const confirmTransferArrival = (transferId: string) => {
    const transfer = pendingTransfers.find(t => t.id === transferId);
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status !== 'in_transit') throw new Error('Transfer not in transit');
    
    const arrivalTime = new Date();
    const startTime = new Date(transfer.initiatedAt);

    // Update transfer status
    const updatedTransfer = {
      ...transfer,
      status: 'completed',
      arrivedAt: new Date().toISOString(),
      confirmedBy: userRole === 'ops_admin' ? 'user.ops.admin' : 'user.hub.tech'
    };

    setPendingTransfers(prev => prev.map(t => t.id === transferId ? updatedTransfer : t));

    // Create movement logs for arrival
    transfer.tagIds.forEach((tagId: string) => {
      createTagMovementLog(tagId, 'TRANSFER_ARRIVED', {
        transferId,
        fromHubId: transfer.fromHubId,
        toHubId: transfer.toHubId,
        previousStatus: 'in_transit',
        newStatus: 'stock',
        notes: `Transfer completed: now at ${transfer.toHubName}`
      });
    });

    // Emit event
    emitEvent('inventory.tag.transfer.arrived', {
      transferId,
      toHub: transfer.toHubId,
      qty: transfer.quantity,
      tagIds: transfer.tagIds
    });

    // Track transfer time telemetry
    trackTransferTime(transferId, startTime, arrivalTime);

    console.log(`✅ Transfer completed: ${transfer.quantity} tags arrived at ${transfer.toHubName}`);
    
    return updatedTransfer;
  };

  // Integration function for Tier Gate stock validation
  const validateHubStockForTierGate = (hubId: string, requiredQuantity: number = 1) => {
    const hub = hubData.find(h => h.id === hubId);
    if (!hub) {
      throw new Error(`Hub ${hubId} not found`);
    }
    
    const available = hub.currentStock.free;
    if (available < requiredQuantity) {
      // Find alternative hub with sufficient stock
      const alternativeHub = hubData.find(h => 
        h.id !== hubId && h.currentStock.free >= requiredQuantity
      );
      
      const suggestion = alternativeHub 
        ? `Consider transfer from ${alternativeHub.name} (${alternativeHub.currentStock.free} available)`
        : 'No alternative hubs have sufficient stock';
      
      throw new Error(
        `Insufficient stock at ${hub.name}: ${available} available, ${requiredQuantity} required. ${suggestion}`
      );
    }
    
    return {
      success: true,
      hubId,
      hubName: hub.name,
      available,
      required: requiredQuantity,
      message: `Stock validation passed: ${available} tags available at ${hub.name}`
    };
  };

  // Global function for external integration (Tier Gate, Hub Console)
  (window as any).aucta_inventory = {
    validateStock: validateHubStockForTierGate,
    getHubStock: (hubId: string) => {
      const hub = hubData.find(h => h.id === hubId);
      return hub ? hub.currentStock : null;
    },
    assignTag: assignTagToShipment,
    applyTag: applyTag,
    getEventLog: () => eventLog,
    emitEvent: emitEvent
  };

  // Real data loading functions
  const loadHubData = useCallback(async () => {
    try {
      setApiError(null);
      const hubData = await inventoryApi.getHubInventoryDashboard();
      setRealHubData(hubData);
      
      // If we have a selected hub, also load its inventory
      if (selectedHub) {
        const filters = {
          status: filterStatus !== 'all' ? filterStatus : undefined,
          lot: filterLot !== 'all' ? filterLot : undefined,
          search: searchQuery || undefined,
          dateFrom: filterDateFrom || undefined,
          dateTo: filterDateTo || undefined
        };
        
        const response = await inventoryApi.getHubInventoryDetail(selectedHub.id, filters);
        setRealInventory(response.inventory);
      }
      
      setDataLoaded(true);
      console.log('📊 Real data loaded from database');
    } catch (error) {
      console.error('❌ Failed to load real data:', error);
      setApiError(error instanceof Error ? error.message : 'Failed to load data');
    }
  }, [selectedHub, filterStatus, filterLot, searchQuery, filterDateFrom, filterDateTo]);

  // Auto-refresh functionality with real API calls
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setLastRefresh(new Date());
    
    try {
      await loadHubData();
      setRefreshCountdown(15); // Reset countdown
      console.log('📊 Data refreshed at', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('❌ Refresh failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadHubData]);

  // Auto-refresh timer (every 15 seconds)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          refreshData();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshData]);

  // Manual refresh handler
  const handleManualRefresh = () => {
    refreshData();
  };

  // Utility functions
  const getHubStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getHubStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'critical': return <AlertCircle className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  };

  const getTagStatusColor = (status: string) => {
    switch (status) {
      case 'stock': return 'text-green-600 bg-green-100';
      case 'reserved': return 'text-blue-600 bg-blue-100';
      case 'applied': return 'text-purple-600 bg-purple-100';
      case 'rma': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTagStatusIcon = (status: string) => {
    switch (status) {
      case 'stock': return <CheckCircle className="h-4 w-4" />;
      case 'reserved': return <Clock className="h-4 w-4" />;
      case 'applied': return <Target className="h-4 w-4" />;
      case 'rma': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Enhanced calculation functions with transparent formulas
  const calculateBurnRate7d = (tagsAppliedLast7Days: number) => {
    return tagsAppliedLast7Days / 7;
  };

  const calculateBurnRate30d = (tagsAppliedLast30Days: number) => {
    return tagsAppliedLast30Days / 30;
  };

  const calculateDaysOfCover = (freeStock: number, burnRate7d: number) => {
    if (burnRate7d === 0) {
      // Edge case: Zero burn recently → show "∞ days cover" but amber note "no recent usage; forecast uncertain"
      return { 
        value: Infinity, 
        display: '∞', 
        warning: 'no_recent_usage',
        message: 'No recent usage; forecast uncertain'
      };
    }
    const days = freeStock / burnRate7d;
    return { 
      value: days, 
      display: Math.round(days).toString(), 
      warning: null,
      message: null
    };
  };

  const getUpcomingDemand = (plannedShipments: number, window: '7d' | '14d') => {
    // Count of T2 shipments planned for this Hub within the window
    return plannedShipments;
  };

  // Alert detection functions
  const getHubAlerts = () => {
    const alerts: any[] = [];
    
    hubData.forEach(hub => {
      const burnRate7d = calculateBurnRate7d(hub.historical.tagsAppliedLast7Days);
      const burnRate30d = calculateBurnRate30d(hub.historical.tagsAppliedLast30Days);
      const daysOfCover = calculateDaysOfCover(hub.currentStock.free, burnRate7d);
      
      // Stock below threshold alert
      if (hub.currentStock.free < hub.threshold) {
        alerts.push({
          id: `stock-${hub.id}`,
          hubId: hub.id,
          hubName: hub.name,
          type: 'stock_threshold',
          severity: hub.currentStock.free < (hub.threshold * 0.5) ? 'critical' : 'warning',
          title: `Low Stock at ${hub.name}`,
          description: `${hub.currentStock.free} tags below threshold (${hub.threshold})`,
          shortfall: hub.threshold - hub.currentStock.free,
          metrics: {
            currentStock: hub.currentStock.free,
            threshold: hub.threshold,
            burnRate7d: burnRate7d,
            burnRate30d: burnRate30d,
            daysOfCover: daysOfCover
          },
          suggestedAction: 'Create transfer',
          canResolve: true
        });
      }
      
      // Days of cover below threshold alert
      if (daysOfCover.value < hub.alertThresholds.daysOfCover && daysOfCover.value !== Infinity) {
        alerts.push({
          id: `days-${hub.id}`,
          hubId: hub.id,
          hubName: hub.name,
          type: 'days_of_cover',
          severity: daysOfCover.value < 7 ? 'critical' : 'warning',
          title: `Low Coverage at ${hub.name}`,
          description: `${daysOfCover.display} days of cover remaining`,
          shortfall: Math.ceil((hub.alertThresholds.daysOfCover * burnRate7d) - hub.currentStock.free),
          metrics: {
            currentStock: hub.currentStock.free,
            daysOfCover: daysOfCover,
            burnRate7d: burnRate7d,
            burnRate30d: burnRate30d,
            targetDays: hub.alertThresholds.daysOfCover
          },
          suggestedAction: 'Create transfer',
          canResolve: true
        });
      }
      
      // No recent usage warning (Edge case: Zero burn recently)
      if (daysOfCover.warning === 'no_recent_usage') {
        alerts.push({
          id: `usage-${hub.id}`,
          hubId: hub.id,
          hubName: hub.name,
          type: 'no_usage',
          severity: 'warning',
          title: `No Recent Usage at ${hub.name}`,
          description: 'No tags applied in the last 7 days',
          shortfall: 0,
          metrics: {
            currentStock: hub.currentStock.free,
            daysOfCover: Infinity,
            burnRate7d: 0,
            burnRate30d: burnRate30d
          },
          suggestedAction: 'Review demand',
          canResolve: false
        });
      }
    });

    // Edge case: Check for overdue transfers and add them as alerts
    const overdueTransfers = checkOverdueTransfers();
    overdueTransfers.forEach(transfer => {
      alerts.push({
        id: `overdue-${transfer.id}`,
        type: 'overdue_transfer',
        severity: transfer.daysPastDue > 3 ? 'critical' : 'warning',
        title: `Overdue Transfer: ${transfer.id}`,
        description: `${transfer.quantity} tags from ${transfer.fromHubName} to ${transfer.toHubName} (${transfer.daysPastDue} days overdue)`,
        transferId: transfer.id,
        daysPastDue: transfer.daysPastDue,
        suggestedAction: 'Mark as arrived or lost',
        canResolve: true,
        resolutionActions: ['arrived', 'lost']
      });
    });
    
    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
    });
  };

  const getHubStatus = (hub: any, burnRate7d: number) => {
    const daysOfCover = calculateDaysOfCover(hub.currentStock.free, burnRate7d);
    const stockRatio = hub.currentStock.free / hub.threshold;
    
    // Edge case: Zero burn gets special handling
    if (daysOfCover.warning === 'no_recent_usage') {
      return stockRatio < 0.5 ? 'critical' : 'warning'; // Uncertain forecast
    }
    
    if (daysOfCover.value < 7 || stockRatio < 0.5) return 'critical';
    if (daysOfCover.value < 14 || stockRatio < 1) return 'warning';
    return 'healthy';
  };

  const isDateInRange = (date: string, from: string, to: string) => {
    if (!from && !to) return true;
    const checkDate = new Date(date);
    const fromDate = from ? new Date(from) : new Date('1900-01-01');
    const toDate = to ? new Date(to) : new Date('2100-01-01');
    return checkDate >= fromDate && checkDate <= toDate;
  };

  const filteredInventory = mockInventory.filter(tag => {
    if (selectedHub && tag.hub !== selectedHub.id) return false;
    
    // Edge case: Exclude quarantined lots from assignable/transferable pools
    const isQuarantined = quarantinedLots.includes(tag.lot);
    
    const matchesSearch = tag.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tag.batchRange.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tag.lot.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (tag.reservedFor && tag.reservedFor.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || tag.status === filterStatus;
    const matchesLot = filterLot === 'all' || tag.lot === filterLot;
    const matchesReservation = filterReservation === 'all' || 
                              (filterReservation === 'reserved' && tag.reservedFor) ||
                              (filterReservation === 'unreserved' && !tag.reservedFor);
    const matchesDate = isDateInRange(tag.receivedDate, filterDateFrom, filterDateTo);
    
    // Show quarantined lots only if specifically filtering for them or in quarantine view
    const showQuarantined = filterStatus === 'quarantined' || (matchesStatus && filterLot !== 'all' && isQuarantined);
    
    return matchesSearch && matchesStatus && matchesLot && matchesReservation && matchesDate && 
           (showQuarantined || !isQuarantined);
  });

  const uniqueLots = [...new Set(mockInventory.map(tag => tag.lot))];

  const handleTagSelection = (tagId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedTags([...selectedTags, tagId]);
    } else {
      setSelectedTags(selectedTags.filter(id => id !== tagId));
    }
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedTags(filteredInventory.map(tag => tag.id));
    } else {
      setSelectedTags([]);
    }
  };

  const exportToCSV = () => {
    const headers = ['Tag ID', 'Batch Range', 'Lot', 'Status', 'Reserved For', 'Last Movement', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...filteredInventory.map(tag => [
        tag.id,
        tag.batchRange,
        tag.lot,
        tag.status,
        tag.reservedFor || '',
        tag.lastMovement,
        `"${tag.notes}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tag-inventory-${selectedHub?.name || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Alerts Banner Component
  const AlertsBanner = () => {
    const alerts = getHubAlerts();
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const warningAlerts = alerts.filter(a => a.severity === 'warning');
    
    if (alerts.length === 0 || !showAlerts) return null;

    const handleCreateTransfer = (alert: any) => {
      const targetHub = hubData.find(h => h.id === alert.hubId);
      const sourceHub = hubData.find(h => h.id !== alert.hubId && h.currentStock.free > alert.shortfall);
      
      if (targetHub && sourceHub) {
        setAlertContext({
          ...alert,
          suggestedFromHub: sourceHub.id,
          suggestedToHub: targetHub.id,
          suggestedQuantity: alert.shortfall,
          reason: 'stock_balancing'
        });
        setShowTransferModal(true);
      }
    };

    const handleAdjustThreshold = (alert: any) => {
      // Open threshold adjustment modal
      console.log('Adjust threshold for:', alert);
    };

    const resolveAlert = (alertId: string) => {
      // Simulate resolving alert - in real app would update backend
      console.log('Resolving alert:', alertId);
      // This would trigger dashboard alert clearing
    };

  return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
        {/* Alert Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {criticalAlerts.length > 0 && (
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium text-red-600">{criticalAlerts.length} Critical</span>
                </div>
              )}
              {warningAlerts.length > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-600">{warningAlerts.length} Warning</span>
                </div>
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900">Stock Alerts</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAlertsExpanded(!alertsExpanded)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              {alertsExpanded ? 'Collapse' : 'Show Details'}
            </button>
            <button
              onClick={() => setShowAlerts(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Alert Summary */}
        <div className="p-4">
          {!alertsExpanded ? (
            <div className="flex flex-wrap gap-2">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                  alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  <span>{alert.hubName}</span>
                  <span className="font-medium">
                    {alert.type === 'stock_threshold' ? `${alert.shortfall} short` : `${Math.round(alert.metrics.daysOfCover)}d left`}
                  </span>
                </div>
              ))}
              {alerts.length > 3 && (
                <span className="text-sm text-gray-500">+{alerts.length - 3} more</span>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className={`border rounded-lg p-4 ${
                  alert.severity === 'critical' ? 'border-red-200 bg-red-50' :
                  alert.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                  'border-blue-200 bg-blue-50'
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {alert.severity === 'critical' ? (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        ) : alert.severity === 'warning' ? (
                          <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-blue-600" />
                        )}
                        <h4 className="font-medium text-gray-900">{alert.title}</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{alert.description}</p>
                      
                      {/* Metrics with Tooltips */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div className="group relative">
                          <div className="font-medium text-gray-700">Current Stock</div>
                          <div className="text-lg font-bold">{alert.metrics.currentStock}</div>
                          <div className="opacity-0 group-hover:opacity-100 absolute z-10 bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap transition-opacity">
                            Free stock available for assignment
                          </div>
                        </div>
                        
                        <div className="group relative">
                          <div className="font-medium text-gray-700">Burn Rate (7d)</div>
                          <div className="text-lg font-bold">{alert.metrics.burnRate7d.toFixed(1)}/day</div>
                          <div className="opacity-0 group-hover:opacity-100 absolute z-10 bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap transition-opacity">
                            Formula: Total tags applied in last 7 days ÷ 7
                          </div>
                        </div>
                        
                        <div className="group relative">
                          <div className="font-medium text-gray-700">Days of Cover</div>
                          <div className="text-lg font-bold">
                            {alert.metrics.daysOfCover === Infinity ? '∞' : Math.round(alert.metrics.daysOfCover)}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 absolute z-10 bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap transition-opacity">
                            Formula: Free stock ÷ Burn rate (7d)
                            {alert.metrics.burnRate7d === 0 && ' • ∞ indicates no recent usage'}
                          </div>
                        </div>

                        <div className="group relative">
                          <div className="font-medium text-gray-700">Upcoming Demand</div>
                          <div className="text-lg font-bold">{alert.metrics.currentStock > 0 ? hubData.find(h => h.id === alert.hubId)?.plannedShipments.next7Days || 0 : 0}</div>
                          <div className="opacity-0 group-hover:opacity-100 absolute z-10 bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap transition-opacity">
                            Count of T2 shipments planned for this Hub in next 7 days
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 ml-4">
                      {alert.canResolve && (
                        <button
                          onClick={() => handleCreateTransfer(alert)}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                          Create Transfer
                        </button>
                      )}
                      
                      {alert.type === 'stock_threshold' && (
                        <button
                          onClick={() => handleAdjustThreshold(alert)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Settings2 className="h-4 w-4" />
                          Adjust Threshold
                        </button>
                      )}
                      
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Hub Overview Component
  const HubOverview = () => (
    <div className="space-y-6">
      {/* Hub Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hubData.map((hub) => {
          const burnRate7d = calculateBurnRate7d(hub.historical.tagsAppliedLast7Days);
          const burnRate30d = calculateBurnRate30d(hub.historical.tagsAppliedLast30Days);
          const daysOfCover = calculateDaysOfCover(hub.currentStock.free, burnRate7d);
          const calculatedStatus = getHubStatus(hub, burnRate7d);
          const totalStock = hub.currentStock.free + hub.currentStock.reserved;
          
          return (
            <div 
              key={hub.id} 
              className={`bg-white rounded-lg border-2 p-6 cursor-pointer transition-all hover:shadow-lg ${getHubStatusColor(calculatedStatus)}`}
              onClick={() => {
                setSelectedHub(hub);
                setCurrentView('hub-detail');
              }}
            >
              {/* Hub Header */}
              <div className="flex justify-between items-start mb-4">
        <div>
                  <h3 className="text-xl font-semibold text-gray-900">{hub.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {hub.location}
                  </p>
        </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getHubStatusColor(calculatedStatus)}`}>
                  {getHubStatusIcon(calculatedStatus)}
                  {calculatedStatus.charAt(0).toUpperCase() + calculatedStatus.slice(1)}
                </div>
              </div>

              {/* Stock Overview */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{hub.currentStock.free}</div>
                  <div className="text-xs text-gray-500">Free</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{hub.currentStock.reserved}</div>
                  <div className="text-xs text-gray-500">Reserved</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{hub.currentStock.appliedToday}</div>
                  <div className="text-xs text-gray-500">Applied Today</div>
                </div>
              </div>

              {/* Enhanced Days of Cover with Tooltips */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center">
                  <div className="group relative">
                    <span className="text-sm font-medium text-gray-700 cursor-help">Days of Cover</span>
                    <div className="opacity-0 group-hover:opacity-100 absolute z-10 bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap transition-opacity">
                      Formula: Free stock ÷ 7-day burn rate
                      {burnRate7d === 0 && ' • ∞ indicates no recent usage'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${
                      daysOfCover.warning ? 'text-yellow-600' :
                      daysOfCover.value === Infinity ? 'text-blue-600' :
                      daysOfCover.value < 7 ? 'text-red-600' : 
                      daysOfCover.value < 14 ? 'text-yellow-600' : 
                      'text-green-600'
                    }`}>
                      {daysOfCover.display}d
                    </span>
                    {daysOfCover.warning && (
                      <div className="group relative">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 cursor-help" />
                        <div className="opacity-0 group-hover:opacity-100 absolute z-10 bottom-full right-0 mb-2 px-3 py-2 bg-yellow-100 border border-yellow-200 text-yellow-800 text-xs rounded-lg whitespace-nowrap transition-opacity">
                          {daysOfCover.message}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2 text-xs text-gray-500">
                  <div className="group relative">
                    <span className="cursor-help">7d burn: {burnRate7d.toFixed(1)}/day</span>
                    <div className="opacity-0 group-hover:opacity-100 absolute z-10 bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap transition-opacity">
                      {hub.historical.tagsAppliedLast7Days} tags applied ÷ 7 days
                    </div>
                  </div>
                  <div className="group relative">
                    <span className="cursor-help">30d burn: {burnRate30d.toFixed(1)}/day</span>
                    <div className="opacity-0 group-hover:opacity-100 absolute z-10 bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap transition-opacity">
                      {hub.historical.tagsAppliedLast30Days} tags applied ÷ 30 days
                    </div>
                  </div>
                </div>
              </div>

              {/* Threshold Status */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">vs Threshold ({hub.threshold})</span>
                <div className="flex items-center gap-1">
                  {hub.currentStock.free > hub.threshold ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <span className={hub.currentStock.free > hub.threshold ? 'text-green-600' : 'text-red-600'}>
                    {hub.currentStock.free > hub.threshold ? '+' : ''}{hub.currentStock.free - hub.threshold}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {calculatedStatus === 'warning' || calculatedStatus === 'critical' ? (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button 
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTransferModal(true);
                    }}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Create Transfer
          </button>
        </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Tag className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Tags</p>
              <p className="text-2xl font-bold text-gray-900">
                {hubData.reduce((sum, hub) => sum + hub.currentStock.free + hub.currentStock.reserved, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Free Tags</p>
              <p className="text-2xl font-bold text-gray-900">
                {hubData.reduce((sum, hub) => sum + hub.currentStock.free, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Reserved</p>
              <p className="text-2xl font-bold text-gray-900">
                {hubData.reduce((sum, hub) => sum + hub.currentStock.reserved, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Applied Today</p>
              <p className="text-2xl font-bold text-gray-900">
                {hubData.reduce((sum, hub) => sum + hub.currentStock.appliedToday, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Demand Forecast */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Demand Forecast</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hubData.map((hub) => (
            <div key={hub.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-gray-900">{hub.name}</h4>
                <span className="text-sm text-gray-500">Next 14 days</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between group relative">
                  <span className="text-sm text-gray-600 cursor-help">T2 Shipments (7d)</span>
                  <span className="font-medium">{hub.plannedShipments.next7Days} planned</span>
                  <div className="opacity-0 group-hover:opacity-100 absolute z-10 bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap transition-opacity">
                    Count of T2 shipments planned for this Hub in next 7 days
                  </div>
                </div>
                <div className="flex justify-between group relative">
                  <span className="text-sm text-gray-600 cursor-help">Tag Demand (7d)</span>
                  <span className="font-medium">{hub.upcomingDemand.next7Days} tags</span>
                  <div className="opacity-0 group-hover:opacity-100 absolute z-10 bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap transition-opacity">
                    Estimated tags needed based on planned shipments
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tag Demand (14d)</span>
                  <span className="font-medium">{hub.upcomingDemand.next14Days} tags</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${Math.min(100, (hub.upcomingDemand.next14Days / (hub.currentStock.free + hub.currentStock.reserved)) * 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">
                  Coverage: {Math.round((hub.currentStock.free + hub.currentStock.reserved) / hub.upcomingDemand.next14Days * 100)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/sprint-8" className="hover:text-gray-700">Sprint 8</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/sprint-8/inventory" className="hover:text-gray-700">Inventory</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900">Tags</span>
      </nav>

      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tag Inventory (Tier 2)</h1>
          <p className="text-gray-600 mt-2">Prevent tag shortages and ensure Tier 2 jobs never stall at the Hub</p>
        </div>
                <div className="flex items-center space-x-3">
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-sm text-gray-600">
              {autoRefresh ? `Auto-refresh in ${refreshCountdown}s` : 'Auto-refresh off'}
            </span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {autoRefresh ? 'Disable' : 'Enable'}
            </button>
          </div>

          {/* Last refresh time */}
          <div className="text-sm text-gray-500">
            Updated: {lastRefresh.toLocaleTimeString()}
          </div>

          {currentView !== 'hub-overview' && (
            <button
              onClick={() => setCurrentView('hub-overview')}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Back to Overview</span>
            </button>
          )}
          
          <button 
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Refreshing...' : 'Refresh Now'}</span>
          </button>
          
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Order Tags</span>
          </button>
        </div>
      </div>

      {/* Alerts Banner */}
      <AlertsBanner />

      {/* View Navigation */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex gap-4">
          <button
            onClick={() => setCurrentView('hub-overview')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentView === 'hub-overview' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Building2 className="h-4 w-4 inline-block mr-2" />
            Hub Overview
          </button>
          <button
            onClick={() => setCurrentView('inventory-table')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentView === 'inventory-table' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Database className="h-4 w-4 inline-block mr-2" />
            Inventory Table
          </button>
          <button
            onClick={() => setCurrentView('event-log')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentView === 'event-log' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Activity className="h-4 w-4 inline-block mr-2" />
            Event Log
            {eventLog.length > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                {eventLog.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setCurrentView('transfers')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentView === 'transfers' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ArrowRightLeft className="h-4 w-4 inline-block mr-2" />
            Transfers
            {pendingTransfers.filter(t => t.status === 'in_transit').length > 0 && (
              <span className="ml-2 bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs">
                {pendingTransfers.filter(t => t.status === 'in_transit').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Render current view */}
      {currentView === 'hub-overview' && (
        <>
          {isLoading && (
            <div className="space-y-6">
              {/* Loading skeleton for fast perceived performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2].map(i => (
                  <div key={i} className="bg-white rounded-lg border p-6 animate-pulse">
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-6 bg-gray-200 rounded w-32"></div>
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      {[1, 2, 3].map(j => (
                        <div key={j} className="text-center">
                          <div className="h-8 bg-gray-200 rounded w-12 mx-auto mb-1"></div>
                          <div className="h-3 bg-gray-200 rounded w-16 mx-auto"></div>
                        </div>
                      ))}
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!isLoading && <HubOverview />}
        </>
      )}
      
      {currentView === 'hub-detail' && selectedHub && (
        <HubDetailView hub={selectedHub} />
      )}
      
      {currentView === 'inventory-table' && (
        <InventoryTableView />
      )}

      {currentView === 'event-log' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Real-time Event Log</h3>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {eventLog.length} events captured
                  </span>
                  <button
                    onClick={() => setEventLog([])}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear Log
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                All tag movements and state transitions are automatically logged and emitted as events for dashboard integration.
              </p>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {eventLog.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No events captured yet</p>
                  <p className="text-xs mt-1">Events will appear here as you perform tag operations</p>
                </div>
              ) : (
                eventLog.map((event, index) => (
                  <div key={event.id} className={`p-4 border-b border-gray-100 ${index === 0 ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-start justify-between">
          <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-2 h-2 rounded-full ${
                            event.type.includes('received') ? 'bg-green-500' :
                            event.type.includes('assigned') ? 'bg-blue-500' :
                            event.type.includes('transferred') ? 'bg-orange-500' :
                            event.type.includes('applied') ? 'bg-purple-500' :
                            event.type.includes('unreserved') ? 'bg-yellow-500' :
                            'bg-gray-500'
                          }`} />
                          <span className="font-medium text-gray-900">{event.type}</span>
                          {index === 0 && (
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">LATEST</span>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-2">
                          <pre className="whitespace-pre-wrap font-mono text-xs bg-gray-100 p-2 rounded">
                            {JSON.stringify(event.payload, null, 2)}
                          </pre>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Actor: {event.payload.actorId}</span>
                          <span>Timestamp: {new Date(event.timestamp).toLocaleString()}</span>
                          <span>Event ID: {event.id}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {currentView === 'transfers' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Transfer Status Tracker</h3>
                <div className="text-sm text-gray-500">
                  {pendingTransfers.filter(t => t.status === 'in_transit').length} active transfers
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Monitor all inter-hub transfers and confirm arrivals to complete state transitions.
              </p>
            </div>
            
            <div className="divide-y divide-gray-200">
              {pendingTransfers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No transfers initiated yet</p>
                  <p className="text-xs mt-1">Transfer records will appear here</p>
                </div>
              ) : (
                pendingTransfers.map((transfer) => (
                  <div key={transfer.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            transfer.status === 'in_transit' ? 'bg-orange-100 text-orange-700' :
                            transfer.status === 'completed' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {transfer.status.replace('_', ' ').toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{transfer.id}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <div className="text-sm font-medium text-gray-700">From Hub</div>
                            <div className="text-sm text-gray-600">{transfer.fromHubName}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-700">To Hub</div>
                            <div className="text-sm text-gray-600">{transfer.toHubName}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-700">Quantity</div>
                            <div className="text-sm text-gray-600">{transfer.quantity} tags</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-700">ETA</div>
                            <div className="text-sm text-gray-600">
                              {new Date(transfer.eta).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        
                        {transfer.reason && (
                          <div className="mb-3">
                            <div className="text-sm font-medium text-gray-700">Reason</div>
                            <div className="text-sm text-gray-600">{transfer.reason}</div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-6 text-xs text-gray-500">
                          <span>Initiated: {new Date(transfer.initiatedAt).toLocaleString()}</span>
                          <span>By: {transfer.initiatedBy}</span>
                          {transfer.arrivedAt && (
                            <span>Completed: {new Date(transfer.arrivedAt).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        {transfer.status === 'in_transit' && (
                          <button
                            onClick={() => confirmTransferArrival(transfer.id)}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Confirm Arrival
                          </button>
                        )}
                        {transfer.status === 'completed' && (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Completed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showTransferModal && (
        <TransferModal 
          onClose={() => {
            setShowTransferModal(false);
            setAlertContext(null);
          }} 
          alertContext={alertContext}
        />
      )}
      
      {showShipmentPicker && (
        <ShipmentPickerModal onClose={() => setShowShipmentPicker(false)} tagId={activeTagId} />
      )}
      
      {showReceiveBatch && (
        <ReceiveBatchModal onClose={() => setShowReceiveBatch(false)} />
      )}
      
      {showUnreserveModal && (
        <UnreserveModal onClose={() => setShowUnreserveModal(false)} tagId={activeTagId} />
      )}
      
      {showHistoryModal && (
        <HistoryModal onClose={() => setShowHistoryModal(false)} tagId={activeTagId} />
      )}
    </div>
  );

  // Hub Detail View Component
  function HubDetailView({ hub }: { hub: any }) {
    const burnRate7d = calculateBurnRate7d(hub.historical.tagsAppliedLast7Days);
    const hubStatus = getHubStatus(hub, burnRate7d);
    
    return (
      <div className="space-y-6">
        {/* Hub Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{hub.name}</h2>
              <p className="text-gray-600 flex items-center gap-1 mt-1">
                <MapPin className="h-4 w-4" />
                {hub.location}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getHubStatusColor(hubStatus)}`}>
                {getHubStatusIcon(hubStatus)}
                {hubStatus.charAt(0).toUpperCase() + hubStatus.slice(1)}
              </div>
              <button 
                onClick={() => setCurrentView('inventory-table')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                View All Tags
              </button>
            </div>
          </div>
        </div>

        {/* Hub Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Current Stock</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Free Tags</span>
                <span className="font-medium text-green-600">{hub.currentStock.free}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Reserved</span>
                <span className="font-medium text-blue-600">{hub.currentStock.reserved}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Applied Today</span>
                <span className="font-medium text-purple-600">{hub.currentStock.appliedToday}</span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-900">Total Stock</span>
                <span className="font-bold">{hub.currentStock.free + hub.currentStock.reserved}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Burn Rate & Coverage</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">7-day average</span>
                <span className="font-medium">{hub.burnRate.sevenDay}/day</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">30-day average</span>
                <span className="font-medium">{hub.burnRate.thirtyDay}/day</span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-900">Days of Cover</span>
                <span className={`font-bold ${calculateDaysOfCover(hub.currentStock.free, hub.burnRate.sevenDay).value < 14 ? 'text-red-600' : 'text-green-600'}`}>
                  {calculateDaysOfCover(hub.currentStock.free, hub.burnRate.sevenDay).display}d
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Threshold & Actions</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Threshold</span>
                <span className="font-medium">{hub.threshold}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Above/Below</span>
                <span className={`font-medium ${hub.currentStock.free > hub.threshold ? 'text-green-600' : 'text-red-600'}`}>
                  {hub.currentStock.free > hub.threshold ? '+' : ''}{hub.currentStock.free - hub.threshold}
                </span>
              </div>
              <hr />
              <button 
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                onClick={() => setShowTransferModal(true)}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Create Transfer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced Inventory Table View Component
  function InventoryTableView() {
    return (
      <div className="space-y-6">
        {/* Advanced Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                  placeholder="Tag ID, batch, lot, or shipment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
                <option value="stock">Stock</option>
                <option value="reserved">Reserved</option>
                <option value="applied">Applied</option>
                <option value="rma">RMA</option>
            </select>
            </div>

            {/* Lot Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lot</label>
              <select
                value={filterLot}
                onChange={(e) => setFilterLot(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Lots</option>
                {uniqueLots.map(lot => (
                  <option key={lot} value={lot}>{lot}</option>
                ))}
              </select>
            </div>

            {/* Reservation Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reservation</label>
              <select
                value={filterReservation}
                onChange={(e) => setFilterReservation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="reserved">Reserved</option>
                <option value="unreserved">Unreserved</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                  setFilterLot('all');
                  setFilterReservation('all');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Clear
            </button>
          </div>
        </div>
      </div>

        {/* Bulk Actions (Ops Only) */}
        {userRole === 'ops_admin' && (
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {selectedTags.length} selected
                </span>
                {selectedTags.length > 0 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowReceiveBatch(true)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-1"
                    >
                      <Package className="h-4 w-4" />
                      Receive Batch
                    </button>
                    <button 
                      onClick={() => setShowTransferModal(true)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-1"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      Transfer
                    </button>
                    <button 
                      onClick={exportToCSV}
                      className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm flex items-center gap-1"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={exportToCSV}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export All
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Tags Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Tag Inventory {selectedHub && `- ${selectedHub.name}`}
              </h3>
              <span className="text-sm text-gray-500">
                {filteredInventory.length} tags
              </span>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                  {userRole === 'ops_admin' && (
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedTags.length === filteredInventory.length && filteredInventory.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tag ID / Batch Range</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reserved For</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Movement</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((tag) => (
                <tr key={tag.id} className="hover:bg-gray-50">
                    {userRole === 'ops_admin' && (
                  <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag.id)}
                          onChange={(e) => handleTagSelection(tag.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                  </td>
                    )}
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{tag.batchRange}</div>
                      <div className="text-xs text-gray-500">ID: {tag.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{tag.lot}</div>
                      <div className="text-xs text-gray-500">Received: {tag.receivedDate}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagStatusColor(tag.status)}`}>
                        {getTagStatusIcon(tag.status)}
                        <span className="ml-1 capitalize">{tag.status}</span>
                      </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {tag.reservedFor ? (
                          <Link href={`/sprint-8/logistics/plan/${tag.reservedFor}`} className="text-blue-600 hover:text-blue-800">
                            {tag.reservedFor}
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{tag.lastMovement}</div>
                  </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={tag.notes}>
                        {tag.notes}
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                        {/* Assign to Shipment (only for stock status) */}
                        {tag.status === 'stock' && (
                          <button 
                            onClick={() => {
                              setActiveTagId(tag.id);
                              setShowShipmentPicker(true);
                            }}
                            className="text-green-600 hover:text-green-900"
                            title="Assign to shipment"
                          >
                            <Target className="h-4 w-4" />
                      </button>
                        )}
                        
                        {/* Unreserve (Ops only, only for reserved status) */}
                        {userRole === 'ops_admin' && tag.status === 'reserved' && (
                          <button 
                            onClick={() => {
                              setActiveTagId(tag.id);
                              setShowUnreserveModal(true);
                            }}
                            className="text-yellow-600 hover:text-yellow-900"
                            title="Unreserve"
                          >
                            <RotateCcw className="h-4 w-4" />
                      </button>
                        )}
                        
                        {/* Mark RMA (for defective tags) */}
                        {tag.status !== 'rma' && (
                          <button 
                            onClick={() => {
                              if (confirm('Mark this tag as RMA (defective)?')) {
                                // Handle RMA marking
                                console.log('Mark RMA:', tag.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-900"
                            title="Mark as RMA"
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* One-Click History */}
                        <button 
                          onClick={() => {
                            setActiveTagId(tag.id);
                            setShowHistoryModal(true);
                          }}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded text-xs font-medium transition-all"
                          title="One-click audit trail"
                        >
                          <Activity className="h-3 w-3" />
                          History
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    );
  }



  // Enhanced Transfer Inter-Hub Modal
  function TransferModal({ onClose, alertContext }: { onClose: () => void; alertContext?: any }) {
    const [fromHub, setFromHub] = useState(alertContext?.suggestedFromHub || selectedHub?.id || '');
    const [toHub, setToHub] = useState(alertContext?.suggestedToHub || '');
    const [transferMode, setTransferMode] = useState<'quantity' | 'specific'>('quantity');
    const [quantity, setQuantity] = useState(alertContext?.suggestedQuantity?.toString() || '');
    const [specificIds, setSpecificIds] = useState<string[]>([]);
    const [reason, setReason] = useState(alertContext?.reason || '');
    const [eta, setEta] = useState('');
    const [errors, setErrors] = useState<string[]>([]);

    // Smart quantity suggestion logic with UX enhancements
    const getSuggestedQuantity = () => {
      if (!fromHub || !toHub) return 0;
      
      const sourceHub = hubData.find(h => h.id === fromHub);
      const destHub = hubData.find(h => h.id === toHub);
      
      if (!sourceHub || !destHub) return 0;
      
      // If opened from alert, prioritize alert suggestion
      if (alertContext?.suggestedQuantity) {
        return Math.min(alertContext.suggestedQuantity, sourceHub.currentStock.free);
      }
      
      // Calculate suggested quantity: threshold - free stock at destination, capped by source free stock
      const needed = Math.max(0, destHub.threshold - destHub.currentStock.free);
      const available = sourceHub.currentStock.free;
      
      return Math.min(needed, available);
    };

    const getAvailableForTransfer = () => {
      if (!fromHub) return [];
      return filteredInventory.filter(tag => 
        tag.hub === fromHub && 
        tag.status === 'stock' // Only free stock can be transferred
      );
    };

    const validateTransfer = () => {
      const newErrors: string[] = [];
      
      if (!fromHub) newErrors.push('Source hub is required');
      if (!toHub) newErrors.push('Destination hub is required');
      if (fromHub === toHub) newErrors.push('Source and destination must be different');
      if (!reason.trim()) newErrors.push('Transfer reason is required');
      
      if (transferMode === 'quantity') {
        if (!quantity || parseInt(quantity) <= 0) newErrors.push('Valid quantity is required');
        const available = hubData.find(h => h.id === fromHub)?.currentStock.free || 0;
        if (parseInt(quantity) > available) {
          newErrors.push(`Cannot transfer ${quantity} tags. Only ${available} available at source.`);
        }
      } else {
        if (specificIds.length === 0) newErrors.push('Select at least one tag to transfer');
        // Check if any selected tags are not free stock
        const unavailableIds = specificIds.filter(id => {
          const tag = mockInventory.find(t => t.id === id);
          return !tag || tag.status !== 'stock';
        });
        if (unavailableIds.length > 0) {
          newErrors.push(`Cannot transfer reserved/applied tags: ${unavailableIds.join(', ')}`);
        }
      }
      
      setErrors(newErrors);
      return newErrors.length === 0;
    };

    const handleConfirm = () => {
      if (validateTransfer()) {
        try {
          const transferQty = transferMode === 'quantity' ? parseInt(quantity) : specificIds.length;
          const tagIds = transferMode === 'specific' ? specificIds : [];
          
          const transfer = initiateTransfer(
            fromHub,
            toHub,
            transferQty,
            tagIds,
            reason,
            eta
          );
          
          console.log('✅ Transfer initiated:', transfer);
          
          // If this was triggered from an alert, resolve it
          if (alertContext) {
            console.log('🎯 Alert resolved via transfer:', alertContext.id);
          }
          
          onClose();
        } catch (error) {
          console.error('❌ Transfer failed:', error);
          setErrors([error instanceof Error ? error.message : 'Transfer failed']);
        }
      }
    };

    const suggestedQty = getSuggestedQuantity();
    const availableTags = getAvailableForTransfer();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Transfer Between Hubs</h3>
            {alertContext && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                <AlertTriangle className="h-4 w-4" />
                Resolving Alert
              </div>
            )}
          </div>

          {/* Smart Defaults & Alert Context */}
          {alertContext && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <h4 className="text-sm font-medium text-blue-900">Smart Transfer Setup</h4>
              </div>
              <p className="text-sm text-blue-700 mb-2">{alertContext.title}: {alertContext.description}</p>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-blue-800 font-medium mb-1">✨ We've pre-filled this form with smart defaults:</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• <strong>Quantity:</strong> {alertContext.suggestedQuantity} tags (exact shortage amount)</li>
                  <li>• <strong>Source:</strong> {hubData.find(h => h.id === fromHub)?.name} (has sufficient stock)</li>
                  <li>• <strong>Destination:</strong> {hubData.find(h => h.id === toHub)?.name} (needs stock)</li>
                  <li>• <strong>Reason:</strong> Stock balancing (you can customize this)</li>
                </ul>
                <p className="text-xs text-blue-600 mt-2 italic">Feel free to adjust any values before confirming.</p>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            {/* Hub Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Hub *</label>
                <select 
                  value={fromHub} 
                  onChange={(e) => setFromHub(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select source hub</option>
                  {hubData.map(hub => (
                    <option key={hub.id} value={hub.id}>
                      {hub.name} ({hub.currentStock.free} free)
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Hub *</label>
                <select 
                  value={toHub} 
                  onChange={(e) => setToHub(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select destination hub</option>
                  {hubData.map(hub => (
                    <option key={hub.id} value={hub.id}>
                      {hub.name} ({hub.currentStock.free}/{hub.threshold} vs threshold)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Smart Suggestion */}
            {fromHub && toHub && suggestedQty > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center">
                  <Target className="h-5 w-5 text-blue-600" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-900">Smart Suggestion</h4>
                    <p className="text-sm text-blue-700">
                      Transfer {suggestedQty} tags to bring destination to threshold level
                    </p>
                  </div>
                  <button 
                    onClick={() => setQuantity(suggestedQty.toString())}
                    className="ml-auto px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    Use Suggestion
            </button>
              </div>
              </div>
            )}

            {/* Transfer Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Transfer Method</label>
              <div className="flex space-x-6">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="quantity"
                    name="transferMode"
                    value="quantity"
                    checked={transferMode === 'quantity'}
                    onChange={(e) => setTransferMode(e.target.value as 'quantity')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="quantity" className="ml-2 text-sm text-gray-700">
                    By Quantity
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="specific"
                    name="transferMode"
                    value="specific"
                    checked={transferMode === 'specific'}
                    onChange={(e) => setTransferMode(e.target.value as 'specific')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="specific" className="ml-2 text-sm text-gray-700">
                    Select Specific Tags
                  </label>
                </div>
              </div>
            </div>

            {/* Quantity Input */}
            {transferMode === 'quantity' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Number of tags to transfer"
                  min="1"
                  max={hubData.find(h => h.id === fromHub)?.currentStock.free || 0}
                />
                {fromHub && (
                  <p className="text-xs text-gray-500 mt-1">
                    Available: {hubData.find(h => h.id === fromHub)?.currentStock.free || 0} tags
                  </p>
                )}
              </div>
            )}

            {/* Specific Tag Selection */}
            {transferMode === 'specific' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Tags ({specificIds.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg">
                  {availableTags.length > 0 ? (
                    <div className="space-y-2 p-3">
                      {availableTags.map(tag => (
                        <div key={tag.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={specificIds.includes(tag.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSpecificIds([...specificIds, tag.id]);
                              } else {
                                setSpecificIds(specificIds.filter(id => id !== tag.id));
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="ml-3 flex-1">
                            <div className="text-sm font-medium text-gray-900">{tag.batchRange}</div>
                            <div className="text-xs text-gray-500">{tag.lot} • ID: {tag.id}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-gray-500">
                      No available tags for transfer at selected hub
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Transfer Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Reason *</label>
                <select 
                  value={reason} 
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select reason</option>
                  <option value="stock_balancing">Stock balancing</option>
                  <option value="urgent_demand">Urgent demand</option>
                  <option value="capacity_optimization">Capacity optimization</option>
                  <option value="maintenance">Hub maintenance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Arrival (ETA)</label>
                <input 
                  type="datetime-local" 
                  value={eta} 
                  onChange={(e) => setEta(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Error Display */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Please correct the following:</h3>
                    <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                      {errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Transfer Summary */}
            {fromHub && toHub && (transferMode === 'quantity' ? quantity : specificIds.length > 0) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-yellow-800">Transfer Summary</h4>
                    <p className="text-sm text-yellow-700">
                      This will create a pending transfer record. Tags will move to destination when marked as "arrived".
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirm}
              disabled={!fromHub || !toHub || !reason}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              Create Transfer
            </button>
              </div>
        </div>
      </div>
    );
  }

  // Enhanced Assign to Shipment Modal with Guardrails
  function ShipmentPickerModal({ onClose, tagId }: { onClose: () => void; tagId: string | null }) {
    const [selectedShipment, setSelectedShipment] = useState('');
    const [searchShipment, setSearchShipment] = useState('');
    const [errors, setErrors] = useState<string[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    
    const mockShipments = [
      { 
        id: 'SHP-2024-200', 
        client: 'Luxury Watches Inc', 
        tier: 'T2', 
        status: 'ready',
        hub: 'HUB-PAR',
        hubName: 'Paris Hub',
        value: 50000,
        needsTags: 2,
        hasStarted: false
      },
      { 
        id: 'SHP-2024-201', 
        client: 'Premium Electronics', 
        tier: 'T2', 
        status: 'planning',
        hub: 'HUB-LON',
        hubName: 'London Hub',
        value: 25000,
        needsTags: 1,
        hasStarted: false
      },
      { 
        id: 'SHP-2024-202', 
        client: 'High-End Fashion', 
        tier: 'T2', 
        status: 'ready',
        hub: 'HUB-PAR',
        hubName: 'Paris Hub',
        value: 15000,
        needsTags: 3,
        hasStarted: true
      },
      { 
        id: 'SHP-2024-203', 
        client: 'Art Gallery', 
        tier: 'T1', 
        status: 'ready',
        hub: 'HUB-LON',
        hubName: 'London Hub',
        value: 100000,
        needsTags: 1,
        hasStarted: false
      }
    ];

    // Get current tag details
    const currentTag = mockInventory.find(tag => tag.id === tagId);
    const currentHub = selectedHub || hubData.find(hub => hub.id === currentTag?.hub);

    // Check guardrails
    const validateAssignment = (shipment: any) => {
      const newErrors: string[] = [];
      const newWarnings: string[] = [];

      // Cannot assign if no free stock
      if (!currentTag || currentTag.status !== 'stock') {
        newErrors.push('Tag must be in stock status to assign to shipment');
      }

      // T2 only restriction
      if (shipment.tier !== 'T2') {
        newErrors.push('Can only assign tags to Tier 2 (T2) shipments');
      }

      // Hub match confirmation
      if (shipment.hub !== currentHub?.id) {
        newWarnings.push(`Hub mismatch: Tag is at ${currentHub?.name}, shipment is at ${shipment.hubName}`);
      }

      // Job already started warning
      if (shipment.hasStarted) {
        newWarnings.push('This shipment has already started processing at the Hub');
      }

      setErrors(newErrors);
      setWarnings(newWarnings);
      return newErrors.length === 0;
    };

    const filteredShipments = mockShipments
      .filter(ship =>
        ship.id.toLowerCase().includes(searchShipment.toLowerCase()) ||
        ship.client.toLowerCase().includes(searchShipment.toLowerCase())
      )
      .sort((a, b) => {
        // Sort T2 shipments first, then by hub match, then by status
        if (a.tier !== b.tier) return a.tier === 'T2' ? -1 : 1;
        if (a.hub !== b.hub) {
          if (a.hub === currentHub?.id) return -1;
          if (b.hub === currentHub?.id) return 1;
        }
        return a.status === 'ready' ? -1 : 1;
      });

    const handleShipmentSelect = (shipment: any) => {
      setSelectedShipment(shipment.id);
      validateAssignment(shipment);
    };

    const handleConfirm = () => {
      const shipment = mockShipments.find(s => s.id === selectedShipment);
      if (shipment && validateAssignment(shipment) && tagId) {
        try {
          const result = assignTagToShipment(
            tagId,
            selectedShipment,
            currentHub?.id || 'HUB-PAR'
          );
          
          console.log('✅ Tag assigned successfully:', result);
          onClose();
        } catch (error) {
          console.error('❌ Assignment failed:', error);
          setErrors([error instanceof Error ? error.message : 'Assignment failed']);
        }
      }
    };

    const selectedShipmentData = mockShipments.find(s => s.id === selectedShipment);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Assign Tag {tagId} to Shipment
          </h3>

          {/* Current Tag Info */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Tag Details</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Tag ID:</span> {tagId}
              </div>
              <div>
                <span className="font-medium text-gray-700">Status:</span> 
                <span className={`ml-1 px-2 py-0.5 rounded text-xs ${getTagStatusColor(currentTag?.status || 'stock')}`}>
                  {currentTag?.status || 'stock'}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Current Hub:</span> {currentHub?.name}
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Shipments (T2 Only)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by ID or client..."
                  value={searchShipment}
                  onChange={(e) => setSearchShipment(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {filteredShipments.map(shipment => {
                  const isHubMatch = shipment.hub === currentHub?.id;
                  const isT2 = shipment.tier === 'T2';
                  
                  return (
                    <div 
                      key={shipment.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedShipment === shipment.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      } ${!isT2 ? 'opacity-50' : ''}`}
                      onClick={() => isT2 && handleShipmentSelect(shipment)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-gray-900">{shipment.id}</div>
                            {isHubMatch && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded text-xs">
                                Same Hub
                              </span>
                            )}
                            {shipment.hasStarted && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-600 rounded text-xs">
                                Started
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">{shipment.client}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {shipment.hubName} • ${shipment.value.toLocaleString()} • Needs {shipment.needsTags} tags
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            isT2 ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {shipment.tier}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            shipment.status === 'ready' 
                              ? 'bg-green-100 text-green-600' 
                              : 'bg-yellow-100 text-yellow-600'
                          }`}>
                            {shipment.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Validation Messages */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Cannot assign tag:</h3>
                    <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                      {errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {warnings.length > 0 && errors.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Please note:</h3>
                    <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                      {warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Assignment Confirmation */}
            {selectedShipmentData && errors.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Ready to Assign</h3>
                    <p className="text-sm text-green-700 mt-1">
                      Tag {tagId} will be reserved for {selectedShipmentData.id} and visible at Tier Gate and Hub Console.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirm}
              disabled={!selectedShipment || errors.length > 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
            >
              Assign Tag
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced Receive Tags Wizard Modal
  function ReceiveBatchModal({ onClose }: { onClose: () => void }) {
    const [step, setStep] = useState(1);
    const [lot, setLot] = useState('');
    const [quantity, setQuantity] = useState('');
    const [idRangeMode, setIdRangeMode] = useState<'auto' | 'manual' | 'import'>('auto');
    const [startId, setStartId] = useState('');
    const [endId, setEndId] = useState('');
    const [manualIds, setManualIds] = useState('');
    const [supplierRef, setSupplierRef] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<string[]>([]);
    const [duplicateIds, setDuplicateIds] = useState<string[]>([]);

    // Validation logic
    const validateStep1 = () => {
      const newErrors: string[] = [];
      if (!lot.trim()) newErrors.push('Lot number is required');
      if (!quantity || parseInt(quantity) <= 0) newErrors.push('Valid quantity is required');
      if (duplicateIds.length > 0) newErrors.push(`Duplicate Tag IDs detected: ${duplicateIds.join(', ')}`);
      setErrors(newErrors);
      return newErrors.length === 0;
    };

    const checkForDuplicates = (ids: string[]) => {
      // Mock duplicate check - in real app, this would call backend
      const existingIds = ['TAG-001', 'TAG-012', 'TAG-025']; // Mock existing IDs
      const duplicates = ids.filter(id => existingIds.includes(id));
      setDuplicateIds(duplicates);
      return duplicates;
    };

    const generateIdRange = () => {
      if (idRangeMode === 'auto') {
        return `Auto-generated: TAG-${Date.now()}-001 to TAG-${Date.now()}-${quantity.padStart(3, '0')}`;
      }
      if (idRangeMode === 'manual' && startId && endId) {
        return `Range: ${startId} to ${endId}`;
      }
      if (idRangeMode === 'manual' && manualIds) {
        const ids = manualIds.split(',').map(id => id.trim()).filter(Boolean);
        checkForDuplicates(ids);
        return `Manual IDs: ${ids.length} tags specified`;
      }
      return 'No IDs specified';
    };

    const handleNext = () => {
      if (step === 1 && validateStep1()) {
        setStep(2);
      }
    };

    const handleConfirm = () => {
      try {
        const tagIds = idRangeMode === 'auto' ? [] : 
                      idRangeMode === 'manual' && manualIds ? 
                      manualIds.split('\n').filter(id => id.trim()) :
                      startId && endId ? [startId, endId] : [];

        const result = receiveTagsBatch(
          selectedHub?.id || 'HUB-PAR', 
          lot, 
          parseInt(quantity), 
          tagIds
        );
        
        console.log('✅ Batch received successfully:', result.length, 'tags created');
        onClose();
      } catch (error) {
        console.error('❌ Failed to receive batch:', error);
        setErrors([error instanceof Error ? error.message : 'Failed to receive batch']);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
          {/* Wizard Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Receive Tags - Step {step} of 2
            </h3>
            <div className="flex space-x-2">
              <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            </div>
          </div>

          {/* Step 1: Basic Information */}
          {step === 1 && (
          <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number *</label>
                  <input 
                    type="text" 
                    value={lot} 
                    onChange={(e) => setLot(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., LOT-2024-004"
                  />
              </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input 
                    type="number" 
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Number of tags"
                    min="1"
                  />
              </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Reference</label>
                <input 
                  type="text" 
                  value={supplierRef} 
                  onChange={(e) => setSupplierRef(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Supplier PO number or reference"
                />
              </div>

              {/* Tag ID Method Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tag ID Assignment</label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="auto"
                      name="idMode"
                      value="auto"
                      checked={idRangeMode === 'auto'}
                      onChange={(e) => setIdRangeMode(e.target.value as 'auto')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="auto" className="ml-2 text-sm text-gray-700">
                      Auto-generate IDs (recommended)
                    </label>
              </div>

                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="manual"
                      name="idMode"
                      value="manual"
                      checked={idRangeMode === 'manual'}
                      onChange={(e) => setIdRangeMode(e.target.value as 'manual')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="manual" className="ml-2 text-sm text-gray-700">
                      Specify ID range or list
                    </label>
            </div>

                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="import"
                      name="idMode"
                      value="import"
                      checked={idRangeMode === 'import'}
                      onChange={(e) => setIdRangeMode(e.target.value as 'import')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="import" className="ml-2 text-sm text-gray-700">
                      Import from file
                    </label>
                  </div>
                </div>
              </div>

              {/* Manual ID Input */}
              {idRangeMode === 'manual' && (
                <div className="space-y-3 pl-6 border-l-2 border-blue-200">
                  <div className="grid grid-cols-2 gap-3">
            <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start ID</label>
                      <input 
                        type="text" 
                        value={startId} 
                        onChange={(e) => setStartId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="TAG-100"
                      />
              </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End ID</label>
                      <input 
                        type="text" 
                        value={endId} 
                        onChange={(e) => setEndId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="TAG-150"
                      />
              </div>
            </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Or Manual List</label>
                    <textarea 
                      value={manualIds} 
                      onChange={(e) => setManualIds(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="TAG-100, TAG-101, TAG-102..."
                      rows={3}
                    />
          </div>
        </div>
              )}

              {/* File Import */}
              {idRangeMode === 'import' && (
                <div className="pl-6 border-l-2 border-blue-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Import File</label>
                  <input 
                    type="file" 
                    accept=".csv,.txt,.xlsx"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Supported formats: CSV, TXT, XLSX</p>
      </div>
              )}

              {/* Error Display */}
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Please correct the following:</h3>
                      <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                        {errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
            </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Confirmation */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Confirm Receipt Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-800">Lot:</span> {lot}
                  </div>
                  <div>
                    <span className="font-medium text-blue-800">Quantity:</span> {quantity} tags
                  </div>
                  <div>
                    <span className="font-medium text-blue-800">Hub:</span> {selectedHub?.name || 'Current Hub'}
                  </div>
                  <div>
                    <span className="font-medium text-blue-800">Supplier Ref:</span> {supplierRef || 'None'}
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-blue-800">Tag IDs:</span> {generateIdRange()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Notes</label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Quality check notes, storage location, etc..."
                  rows={3}
                />
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Ready to Process</h3>
                    <p className="text-sm text-green-700 mt-1">
                      This will create {quantity} stock units at {selectedHub?.name || 'the current hub'} and log the movement.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between mt-6">
            <div>
              {step === 2 && (
                <button 
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  ← Back
          </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
          </button>
              {step === 1 ? (
                <button 
                  onClick={handleNext}
                  disabled={!lot || !quantity}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Next →
                </button>
              ) : (
                <button 
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Confirm Receipt
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced Unreserve Modal with Guardrails
  function UnreserveModal({ onClose, tagId }: { onClose: () => void; tagId: string | null }) {
    const [reason, setReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [requiresOverride, setRequiresOverride] = useState(false);
    const [overrideCode, setOverrideCode] = useState('');
    const [errors, setErrors] = useState<string[]>([]);

    const reasonOptions = [
      'Shipment cancelled',
      'Client request change',
      'Tag quality issue',
      'Operational requirement',
      'Planning correction',
      'Other'
    ];

    // Get tag and shipment details
    const currentTag = mockInventory.find(tag => tag.id === tagId);
    const currentShipment = currentTag?.reservedFor;

    // Mock check if hub job has started
    const mockShipments = [
      { id: 'SHP-2024-123', hasStarted: true, startTime: '2024-01-15 10:30' },
      { id: 'SHP-2024-124', hasStarted: true, startTime: '2024-01-15 11:45' },
      { id: 'SHP-2024-125', hasStarted: false, startTime: null }
    ];

    const shipmentData = mockShipments.find(s => s.id === currentShipment);
    const jobHasStarted = shipmentData?.hasStarted || false;

    // Check if override is required
    const checkRequiresOverride = () => {
      if (jobHasStarted && userRole !== 'ops_admin') {
        setRequiresOverride(true);
        return true;
      }
      setRequiresOverride(false);
      return false;
    };

    const validateUnreserve = () => {
      const newErrors: string[] = [];
      
      if (!reason.trim()) newErrors.push('Reason is required');
      if (reason === 'Other' && !customReason.trim()) newErrors.push('Custom reason is required');
      
      // Check if job has started
      if (jobHasStarted) {
        if (userRole !== 'ops_admin') {
          newErrors.push('Cannot unreserve: Hub job has started. Ops override required.');
        } else if (!overrideCode.trim()) {
          newErrors.push('Ops override code is required for started jobs');
        }
      }

      setErrors(newErrors);
      return newErrors.length === 0;
    };

    const handleConfirm = () => {
      if (validateUnreserve() && tagId) {
        try {
          const unreserveReason = reason === 'Other' ? customReason : reason;
          const isOverride = jobHasStarted && userRole === 'ops_admin';
          
          const result = unreserveTag(
            tagId,
            unreserveReason,
            isOverride
          );
          
          console.log('✅ Tag unreserved successfully:', result);
          onClose();
        } catch (error) {
          console.error('❌ Unreserve failed:', error);
          setErrors([error instanceof Error ? error.message : 'Unreserve failed']);
        }
      }
    };

    // Check override requirement on component mount
    React.useEffect(() => {
      checkRequiresOverride();
    }, []);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Unreserve Tag {tagId}
          </h3>

          {/* Tag & Shipment Info */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Current Assignment</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Tag Status:</span> 
                <span className={`ml-1 px-2 py-0.5 rounded text-xs ${getTagStatusColor('reserved')}`}>
                  Reserved
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Shipment:</span> {currentShipment || 'None'}
              </div>
              {shipmentData && (
                <>
                  <div>
                    <span className="font-medium text-gray-700">Job Status:</span> 
                    <span className={`ml-1 px-2 py-0.5 rounded text-xs ${
                      jobHasStarted ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
                    }`}>
                      {jobHasStarted ? 'Started' : 'Not Started'}
                    </span>
                  </div>
                  {jobHasStarted && (
                    <div>
                      <span className="font-medium text-gray-700">Started:</span> {shipmentData.startTime}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Warning for started jobs */}
          {jobHasStarted && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Job Already Started</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    This shipment has begun processing at the Hub. {userRole === 'ops_admin' ? 'Ops override is required.' : 'Only Ops Admin can unreserve.'}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unreserve Reason *</label>
              <select 
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a reason</option>
                {reasonOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            
            {reason === 'Other' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specify Reason *</label>
                <textarea 
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Please specify the reason for unreservation..."
                  rows={3}
                />
              </div>
            )}

            {/* Ops Override Section */}
            {jobHasStarted && userRole === 'ops_admin' && (
              <div className="border-t pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ops Override Code *</label>
                  <input 
                    type="password"
                    value={overrideCode}
                    onChange={(e) => setOverrideCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter override authorization code"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Required for unreserving tags from started jobs
                  </p>
                </div>
              </div>
            )}

            {/* Error Display */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Cannot unreserve:</h3>
                    <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                      {errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation */}
            {reason && errors.length === 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex">
                  <CheckCircle className="h-5 w-5 text-blue-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Ready to Unreserve</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Tag {tagId} will be returned to stock and removed from shipment {currentShipment}.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirm}
              disabled={!reason || errors.length > 0}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-300"
            >
              Unreserve Tag
          </button>
        </div>
      </div>
    </div>
  );
  }

  // History Modal Component
  function HistoryModal({ onClose, tagId }: { onClose: () => void; tagId: string | null }) {
    // Get actual movement history for this tag
    const tagMovements = tagHistory.filter(movement => movement.tagId === tagId);
    
    // Combine with mock historical data for demo
    const mockHistory = [
      {
        timestamp: '2024-01-10 09:30',
        action: 'Received',
        details: 'Batch LOT-2024-001 received into stock',
        user: 'system',
        shipment: null
      }
    ];

    const allHistory = [...tagMovements.map(m => ({
      timestamp: m.timestamp,
      action: m.action.replace(/_/g, ' '),
      details: m.notes || 'No details',
      user: m.actorName || m.actorId,
      shipment: m.shipmentId
    })), ...mockHistory].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Movement History - Tag {tagId}
          </h3>
          
          <div className="space-y-4">
            {allHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No movement history available for this tag
              </div>
            ) : (
              allHistory.map((entry, index) => (
              <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">{entry.action}</div>
                    <div className="text-sm text-gray-600 mt-1">{entry.details}</div>
                    {entry.shipment && (
                      <div className="text-sm text-blue-600 mt-1">
                        Shipment: {entry.shipment}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>{entry.timestamp}</div>
                    <div>{entry.user}</div>
                  </div>
                </div>
              </div>
              ))
            )}
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Export History
            </button>
          </div>
        </div>
      </div>
    );
  }
}
