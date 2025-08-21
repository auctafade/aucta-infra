'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, AlertTriangle, Clock, User, Eye, ChevronRight, 
  MoreHorizontal, CheckCircle, X, AlertCircle, Settings, MapPin,
  Truck, Package, FileText, Calendar, Hash, ExternalLink, Timer,
  Users, Flag, RotateCcw, Pause, AlertOctagon, Badge, Target,
  Building2, MessageSquare, Edit, Save, Plus, Upload, Download,
  Phone, Mail, UserPlus, ChevronDown, Send, Image, Paperclip,
  History, Activity, CheckSquare, PlayCircle, Clipboard, Star
} from 'lucide-react';
// Removed LogisticsDashboardLayout - using custom styling like WG page
import { 
  incidentEvents, 
  emitIncidentOpened, 
  emitIncidentUpdated, 
  emitIncidentResolved,
  createIncidentDeepLink 
} from '@/lib/incidentEvents';
import { 
  IncidentEdgeCaseHandler, 
  IncidentTelemetryTracker, 
  CarrierAPIHandler,
  type IncidentDataModel,
  type DuplicateWarning,
  type ConflictWarning,
  type ManualUpdate,
  type ClientCommunication
} from '@/lib/incidentDataModel';
import IncidentAPIClient, { 
  type IncidentFilters as APIIncidentFilters,
  type CreateIncidentData,
  type TimelineEntryData,
  type CommunicationData 
} from '@/lib/api/incidentAPI';

interface Incident {
  id: string;
  type: 'customs' | 'delay' | 'damage' | 'lost' | 'docs' | 'address' | 'payment_hold';
  severity: 'S1' | 'S2' | 'S3' | 'S4';
  status: 'open' | 'investigating' | 'waiting_third_party' | 'on_hold' | 'resolved' | 'canceled';
  tier: 1 | 2 | 3;
  shipmentId: string;
  trackingId?: string;
  leg: 'sender_to_hub' | 'hub_to_buyer' | 'wg_internal';
  legDisplay: string;
  hub: 'paris' | 'london';
  carrier: 'WG' | 'DHL';
  assignee?: string;
  createdAt: string;
  dueAt: string;
  lastAction: string;
  title: string;
  description: string;
  clientName?: string;
  contactName?: string;
  isOverdue: boolean;
  priority: number;
  tags: string[];
  relatedShipments?: string[];
  resolution?: string;
  resolutionNotes?: string;
}

interface IncidentFilters {
  type: string[];
  severity: string[];
  sla: string[];
  assignment: string;
  status: string[];
  tier: string[];
  hub: string[];
  carrier: string[];
  freeText: string;
}

interface PlaybookStep {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  value?: string;
  type: 'checkbox' | 'text' | 'date' | 'file' | 'select';
  options?: string[];
}

interface PlaybookAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'warning' | 'danger';
  onClick: () => void;
}

interface TimelineEntry {
  id: string;
  timestamp: string;
  type: 'status_change' | 'owner_change' | 'comment' | 'file_upload' | 'webhook' | 'client_notification' | 'escalation' | 'system_alert' | 'action';
  user: string;
  title: string;
  description: string;
  isClientVisible: boolean;
  metadata?: any;
}

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  tags: string[];
  url: string;
}

interface CommunicationTemplate {
  id: string;
  type: string;
  stage: string;
  subject: string;
  content: string;
  isCustomizable: boolean;
}

interface CreateIncidentForm {
  type: 'customs' | 'delay' | 'damage' | 'lost' | 'docs' | 'address' | 'payment_hold';
  severity: 'S1' | 'S2' | 'S3' | 'S4';
  title: string;
  description: string;
  shipmentId: string;
  leg: 'sender_to_hub' | 'hub_to_buyer' | 'wg_internal';
  assignee?: string;
  clientName: string;
  contactName: string;
}

interface ActionModal {
  type: 'create' | 'assign' | 'severity' | 'status' | 'resolve' | 'reopen' | null;
  isOpen: boolean;
  data?: any;
}

interface ResolutionForm {
  reason: string;
  postMortem: string;
  requiresPostMortem: boolean;
  preventPassportActivation: boolean;
  overrideReason?: string;
}

const IncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filteredIncidents, setFilteredIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);
  const [selectedIncidents, setSelectedIncidents] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<IncidentFilters>({
    type: [],
    severity: [],
    sla: [],
    assignment: '',
    status: [],
    tier: [],
    hub: [],
    carrier: [],
    freeText: ''
  });
  const [sortBy, setSortBy] = useState<string>('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Detail panel state
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'playbook' | 'timeline' | 'files' | 'people'>('overview');
  const [playbookSteps, setPlaybookSteps] = useState<PlaybookStep[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [showTimelineFilter, setShowTimelineFilter] = useState('all');
  const [newComment, setNewComment] = useState('');
  const [watchers, setWatchers] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  // Action modals state
  const [actionModal, setActionModal] = useState<ActionModal>({ type: null, isOpen: false });
  const [createForm, setCreateForm] = useState<CreateIncidentForm>({
    type: 'customs',
    severity: 'S3',
    title: '',
    description: '',
    shipmentId: '',
    leg: 'sender_to_hub',
    assignee: '',
    clientName: '',
    contactName: ''
  });
  const [resolutionForm, setResolutionForm] = useState<ResolutionForm>({
    reason: '',
    postMortem: '',
    requiresPostMortem: false,
    preventPassportActivation: false,
    overrideReason: ''
  });
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [dragOverComment, setDragOverComment] = useState(false);
  const [isQuickActionMode, setIsQuickActionMode] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  
  // Edge case handling state
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);
  const [conflictWarnings, setConflictWarnings] = useState<ConflictWarning[]>([]);
  const [ownershipGaps, setOwnershipGaps] = useState<any[]>([]);
  const [carrierAPIStatus, setCarrierAPIStatus] = useState<'online' | 'offline' | 'degraded'>('online');
  const [manualModeEnabled, setManualModeEnabled] = useState(false);
  const [clientCommCooldown, setClientCommCooldown] = useState<{[key: string]: number}>({});
  const [telemetryData, setTelemetryData] = useState<{[key: string]: any}>({});

  // Mock current user for RBAC
  const currentUser = {
    id: 'user123',
    name: 'John Doe',
    role: 'ops_admin', // ops_admin, hub_tech, wg_operator
    team: 'logistics'
  };

  // Load incidents from API
  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      
      // Check API connection
      const isConnected = await IncidentAPIClient.healthCheck();
      setApiConnected(isConnected);
      
      if (!isConnected) {
        console.warn('⚠️ API not available, using fallback mock data');
        loadFallbackData();
        return;
      }
      
      // Load real incidents from API
      const response = await IncidentAPIClient.getIncidents({
        limit: 100,
        sort_by: 'priority',
        sort_order: 'desc'
      });
      
      if (response.success && response.data) {
        const convertedIncidents = response.data.incidents.map((dbIncident: any) => 
          IncidentAPIClient.convertIncidentFromDB(dbIncident)
        );
        setIncidents(convertedIncidents);
        console.log('✅ Loaded', convertedIncidents.length, 'incidents from database');
      } else {
        console.error('❌ Failed to load incidents:', response.error);
        loadFallbackData();
      }
      
    } catch (error) {
      console.error('❌ Error loading incidents:', error);
      setApiConnected(false);
      loadFallbackData();
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackData = () => {
    console.log('📋 Loading fallback mock data');
    const mockIncidents: Incident[] = [
      {
        id: 'INC-2024-001',
        type: 'damage',
        severity: 'S1',
        status: 'investigating',
        tier: 3,
        shipmentId: 'SH-20240115-001',
        trackingId: 'DHL-123456789',
        leg: 'hub_to_buyer',
        legDisplay: 'Paris Hub → Buyer',
        hub: 'paris',
        carrier: 'DHL',
        assignee: 'John Doe',
        createdAt: '2024-01-15T08:30:00Z',
        dueAt: '2024-01-15T16:30:00Z',
        lastAction: '2024-01-15T14:20:00Z',
        title: 'Luxury watch damaged during DHL transport',
        description: 'Customer reported significant damage to luxury watch face upon delivery. Package showed external damage signs.',
        clientName: 'Michael Chen',
        contactName: 'Sarah Wilson',
        isOverdue: true,
        priority: 95,
        tags: ['tier-3', 'insurance-claim', 'client-vip'],
        relatedShipments: ['SH-20240114-088'],
        resolution: '',
        resolutionNotes: ''
      },
      {
        id: 'INC-2024-002',
        type: 'customs',
        severity: 'S2',
        status: 'waiting_third_party',
        tier: 2,
        shipmentId: 'SH-20240115-002',
        leg: 'sender_to_hub',
        legDisplay: 'Sender → London Hub',
        hub: 'london',
        carrier: 'WG',
        assignee: 'Emma Thompson',
        createdAt: '2024-01-15T10:15:00Z',
        dueAt: '2024-01-16T10:15:00Z',
        lastAction: '2024-01-15T13:45:00Z',
        title: 'UK customs hold on art piece valuation',
        description: 'Customs requiring additional documentation for art piece valuation. Client needs to provide provenance certificate.',
        clientName: 'Art Gallery London',
        contactName: 'David Foster',
        isOverdue: false,
        priority: 75,
        tags: ['customs', 'documentation', 'art'],
        relatedShipments: [],
        resolution: '',
        resolutionNotes: ''
      },
      {
        id: 'INC-2024-003',
        type: 'delay',
        severity: 'S3',
      status: 'open',
        tier: 1,
        shipmentId: 'SH-20240115-003',
        leg: 'wg_internal',
        legDisplay: 'WG Operations',
        hub: 'paris',
        carrier: 'WG',
        assignee: '',
        createdAt: '2024-01-15T11:00:00Z',
        dueAt: '2024-01-15T19:00:00Z',
        lastAction: '2024-01-15T11:00:00Z',
        title: 'WG pickup delayed due to traffic',
        description: 'WG team reports significant traffic delays affecting multiple pickup routes in central Paris area.',
        clientName: 'Sophie Martin',
        contactName: 'Pierre Dubois',
        isOverdue: false,
        priority: 45,
        tags: ['traffic', 'logistics'],
        relatedShipments: ['SH-20240115-004', 'SH-20240115-005'],
        resolution: '',
        resolutionNotes: ''
      },
      {
        id: 'INC-2024-004',
        type: 'lost',
        severity: 'S1',
        status: 'on_hold',
        tier: 3,
        shipmentId: 'SH-20240114-089',
        trackingId: 'DHL-987654321',
        leg: 'hub_to_buyer',
        legDisplay: 'London Hub → Buyer',
        hub: 'london',
        carrier: 'DHL',
        assignee: 'Mark Johnson',
        createdAt: '2024-01-14T16:20:00Z',
        dueAt: '2024-01-15T04:20:00Z',
        lastAction: '2024-01-15T09:15:00Z',
        title: 'High-value jewelry package missing',
        description: 'DHL reports package as delivered but client never received. Security investigation initiated.',
        clientName: 'Premium Jewelers',
        contactName: 'Anna Rodriguez',
        isOverdue: true,
        priority: 98,
        tags: ['tier-3', 'security', 'insurance-claim', 'investigation'],
        relatedShipments: [],
        resolution: '',
        resolutionNotes: ''
      },
      {
        id: 'INC-2024-005',
        type: 'address',
        severity: 'S4',
      status: 'resolved',
        tier: 1,
        shipmentId: 'SH-20240115-006',
        leg: 'sender_to_hub',
        legDisplay: 'Sender → Paris Hub',
        hub: 'paris',
        carrier: 'WG',
        assignee: 'Lisa Chen',
        createdAt: '2024-01-15T09:30:00Z',
        dueAt: '2024-01-17T09:30:00Z',
        lastAction: '2024-01-15T15:10:00Z',
        title: 'Incorrect sender address format',
        description: 'Sender provided incomplete address format. Corrected and verified with client.',
        clientName: 'Tech Startup Inc',
        contactName: 'Alex Kim',
        isOverdue: false,
        priority: 20,
        tags: ['address', 'resolved'],
        relatedShipments: [],
        resolution: 'Contacted client and obtained correct address format. Updated in system.',
        resolutionNotes: 'Client was very responsive. No delays to shipment schedule.'
      }
    ];

    setIncidents(mockIncidents);
    console.log('📋 Loaded', mockIncidents.length, 'fallback incidents');
  };

  // Helper functions for styling
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'damage': return <AlertOctagon size={16} style={{ color: '#dc2626' }} />;
      case 'lost': return <AlertTriangle size={16} style={{ color: '#dc2626' }} />;
      case 'customs': return <FileText size={16} style={{ color: '#f59e0b' }} />;
      case 'delay': return <Clock size={16} style={{ color: '#f59e0b' }} />;
      case 'address': return <MapPin size={16} style={{ color: '#3b82f6' }} />;
      case 'docs': return <FileText size={16} style={{ color: '#3b82f6' }} />;
      case 'payment_hold': return <Target size={16} style={{ color: '#8b5cf6' }} />;
      default: return <AlertCircle size={16} style={{ color: '#6b7280' }} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'S1': return '#dc2626';
      case 'S2': return '#f59e0b';
      case 'S3': return '#3b82f6';
      case 'S4': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#f59e0b';
      case 'investigating': return '#3b82f6';
      case 'waiting_third_party': return '#8b5cf6';
      case 'on_hold': return '#ef4444';
      case 'resolved': return '#10b981';
      case 'canceled': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getTimeRemaining = (dueAt: string) => {
    const now = new Date();
    const due = new Date(dueAt);
    const diff = due.getTime() - now.getTime();
    
    if (diff <= 0) {
      const overdue = Math.abs(diff);
      const hours = Math.floor(overdue / (1000 * 60 * 60));
      const minutes = Math.floor((overdue % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m overdue`;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours < 1) {
      return `${minutes}m remaining`;
    } else if (hours < 24) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h remaining`;
    }
  };

  // Real-time SLA Timer Component
  const SLATimer: React.FC<{ incident: Incident }> = ({ incident }) => {
    const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(incident.dueAt));
    
    useEffect(() => {
      const timer = setInterval(() => {
        setTimeRemaining(getTimeRemaining(incident.dueAt));
      }, 60000); // Update every minute
      
      return () => clearInterval(timer);
    }, [incident.dueAt]);
    
    const isOverdue = new Date(incident.dueAt).getTime() < new Date().getTime();
    const isUrgent = new Date(incident.dueAt).getTime() - new Date().getTime() < 2 * 60 * 60 * 1000; // Less than 2 hours
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        color: isOverdue ? '#dc2626' : isUrgent ? '#f59e0b' : '#10b981',
        fontWeight: isOverdue || isUrgent ? 600 : 400
      }}>
        <Timer size={12} />
        <span style={{ fontSize: '12px' }}>{timeRemaining}</span>
        {isOverdue && (
          <div style={{
            background: '#dc2626',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
            marginLeft: '4px'
          }}>
            OVERDUE
          </div>
        )}
      </div>
    );
  };

  // URL parameter handling for deep linking
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const incidentId = urlParams.get('incident');
    
    if (incidentId && incidents.length > 0) {
      const incident = incidents.find(inc => inc.id === incidentId);
      if (incident) {
        setSelectedIncident(incident);
        console.log('🔗 Deep link opened incident:', incidentId);
      }
    }
  }, [incidents]);

  // Apply filters and sorting with overdue priority
  useEffect(() => {
    let filtered = [...incidents];

    // Apply filters
    if (filters.type.length > 0) {
      filtered = filtered.filter(inc => filters.type.includes(inc.type));
    }
    if (filters.severity.length > 0) {
      filtered = filtered.filter(inc => filters.severity.includes(inc.severity));
    }
    if (filters.status.length > 0) {
      filtered = filtered.filter(inc => filters.status.includes(inc.status));
    }
    if (filters.tier.length > 0) {
      filtered = filtered.filter(inc => filters.tier.includes(inc.tier.toString()));
    }
    if (filters.hub.length > 0) {
      filtered = filtered.filter(inc => filters.hub.includes(inc.hub));
    }
    if (filters.carrier.length > 0) {
      filtered = filtered.filter(inc => filters.carrier.includes(inc.carrier));
    }
    if (filters.assignment) {
      if (filters.assignment === 'unassigned') {
        filtered = filtered.filter(inc => !inc.assignee);
      } else if (filters.assignment === 'me') {
        filtered = filtered.filter(inc => inc.assignee === currentUser.name);
      }
    }
    if (filters.sla.length > 0) {
      const now = new Date();
      filtered = filtered.filter(inc => {
        const dueDate = new Date(inc.dueAt);
        const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        return filters.sla.some(sla => {
          switch (sla) {
            case 'due_2h': return hoursUntilDue <= 2 && hoursUntilDue > 0;
            case 'due_today': return hoursUntilDue <= 24 && hoursUntilDue > 2;
            case 'overdue': return hoursUntilDue <= 0;
            default: return true;
          }
        });
      });
    }
    if (filters.freeText) {
      const searchTerm = filters.freeText.toLowerCase();
      filtered = filtered.filter(inc => 
        inc.shipmentId.toLowerCase().includes(searchTerm) ||
        inc.title.toLowerCase().includes(searchTerm) ||
        inc.contactName?.toLowerCase().includes(searchTerm) ||
        inc.clientName?.toLowerCase().includes(searchTerm) ||
        inc.trackingId?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply sorting with overdue incidents prioritized
    filtered.sort((a, b) => {
      // First priority: overdue incidents always at the top
      if (a.isOverdue !== b.isOverdue) {
        return a.isOverdue ? -1 : 1;
      }
      
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'priority':
          aVal = a.priority;
          bVal = b.priority;
          break;
        case 'created':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'due':
          aVal = new Date(a.dueAt).getTime();
          bVal = new Date(b.dueAt).getTime();
          break;
        case 'severity':
          const severityOrder = { 'S1': 4, 'S2': 3, 'S3': 2, 'S4': 1 };
          aVal = severityOrder[a.severity];
          bVal = severityOrder[b.severity];
          break;
        default:
          // Default sort by priority + SLA due time
          aVal = a.priority + (a.isOverdue ? 1000 : 0);
          bVal = b.priority + (b.isOverdue ? 1000 : 0);
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredIncidents(filtered);
  }, [incidents, filters, sortBy, sortOrder]);

  const toggleIncidentSelection = (id: string) => {
    const newSelection = new Set(selectedIncidents);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIncidents(newSelection);
  };

  const selectAllIncidents = () => {
    if (selectedIncidents.size === filteredIncidents.length) {
      setSelectedIncidents(new Set());
    } else {
      setSelectedIncidents(new Set(filteredIncidents.map(inc => inc.id)));
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedIncidents.size === 0) return;
    
    // Mock bulk operations
    console.log(`Performing bulk action: ${action} on ${selectedIncidents.size} incidents`);
    
    // Clear selection after action
    setSelectedIncidents(new Set());
    setBulkAction('');
  };

  const clearAllFilters = () => {
    setFilters({
      type: [],
      severity: [],
      sla: [],
      assignment: '',
      status: [],
      tier: [],
      hub: [],
      carrier: [],
      freeText: ''
    });
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => 
      Array.isArray(value) ? value.length > 0 : value !== ''
    ).length;
  };

  // Generate playbook steps based on incident type
  const generatePlaybookSteps = (incidentType: string): PlaybookStep[] => {
    switch (incidentType) {
      case 'customs':
        return [
          { id: 'commercial_invoice', label: 'Commercial invoice present', completed: true, required: true, type: 'checkbox' },
          { id: 'hs_code', label: 'HS code verified', completed: true, required: true, type: 'text', value: '9113.20.90' },
          { id: 'incoterm', label: 'Incoterm (DAP)', completed: true, required: true, type: 'select', value: 'DAP', options: ['DAP', 'DDP', 'EXW', 'FOB'] },
          { id: 'insured_value', label: 'Insured value confirmed', completed: false, required: true, type: 'text' },
          { id: 'broker_contact', label: 'Broker contact obtained', completed: false, required: true, type: 'text' },
          { id: 'docs_sent', label: 'Documents sent timestamp', completed: false, required: true, type: 'date' }
        ];
      case 'delay':
        return [
          { id: 'root_cause', label: 'Root cause identified', completed: true, required: true, type: 'select', value: 'weather', options: ['weather', 'capacity', 'missed_pickup', 'traffic'] },
          { id: 'replan_option', label: 'Replan option selected', completed: false, required: true, type: 'select', options: ['Express', 'alternate_day', 'alternate_hub'] },
          { id: 'client_notified', label: 'Client notified', completed: false, required: true, type: 'checkbox' }
        ];
      case 'damage':
        return [
          { id: 'intake_photos', label: 'Intake damage photos', completed: true, required: true, type: 'file' },
          { id: 'condition_report', label: 'Condition report completed', completed: false, required: true, type: 'file' },
          { id: 'carrier_claim', label: 'Carrier claim initiated', completed: false, required: true, type: 'checkbox' },
          { id: 'client_contacted', label: 'Client contacted', completed: false, required: true, type: 'checkbox' },
          { id: 'resolution_path', label: 'Resolution path agreed', completed: false, required: true, type: 'select', options: ['repair', 'partial_refund', 'replacement'] }
        ];
      case 'lost':
        return [
          { id: 'last_scan', label: 'Last scan location/time verified', completed: true, required: true, type: 'text', value: 'Paris Hub - 2024-01-14 16:45' },
          { id: 'carrier_trace', label: 'Carrier trace initiated', completed: false, required: true, type: 'checkbox' },
          { id: 'wg_contact', label: 'WG contact completed', completed: false, required: true, type: 'checkbox' },
          { id: 'cctv_check', label: 'CCTV/Hub check completed', completed: false, required: true, type: 'checkbox' },
          { id: 'insurance_claim', label: 'Insurance claim filed', completed: false, required: true, type: 'checkbox' }
        ];
      default:
        return [];
    }
  };

  // Generate playbook actions based on incident type
  const generatePlaybookActions = (incidentType: string): PlaybookAction[] => {
    switch (incidentType) {
      case 'customs':
        return [
          { id: 'send_docs', label: 'Send docs', type: 'primary', onClick: () => console.log('Send docs') },
          { id: 'contact_broker', label: 'Contact broker', type: 'secondary', onClick: () => console.log('Contact broker') },
          { id: 'provide_clarifications', label: 'Provide clarifications', type: 'secondary', onClick: () => console.log('Clarifications') },
          { id: 'escalate_broker', label: 'Escalate broker', type: 'warning', onClick: () => console.log('Escalate') }
        ];
      case 'delay':
        return [
          { id: 'switch_express', label: 'Switch to Express', type: 'primary', onClick: () => console.log('Switch Express') },
          { id: 'rebook_wg', label: 'Rebook WG slot', type: 'secondary', onClick: () => console.log('Rebook WG') },
          { id: 'prioritise_hub', label: 'Prioritise Hub', type: 'secondary', onClick: () => console.log('Prioritise') },
          { id: 'notify_client', label: 'Notify client', type: 'warning', onClick: () => console.log('Notify client') }
        ];
      case 'damage':
        return [
          { id: 'open_claim', label: 'Open insurance claim', type: 'primary', onClick: () => console.log('Open claim') },
          { id: 'hold_item', label: 'Hold item', type: 'warning', onClick: () => console.log('Hold item') },
          { id: 'request_photos', label: 'Request more photos', type: 'secondary', onClick: () => console.log('Request photos') },
          { id: 'notify_client', label: 'Notify client', type: 'warning', onClick: () => console.log('Notify client') }
        ];
      case 'lost':
        return [
          { id: 'open_trace', label: 'Open trace', type: 'primary', onClick: () => console.log('Open trace') },
          { id: 'escalate_carrier', label: 'Escalate carrier', type: 'warning', onClick: () => console.log('Escalate carrier') },
          { id: 'file_claim', label: 'File claim', type: 'danger', onClick: () => console.log('File claim') },
          { id: 'notify_client', label: 'Notify client', type: 'warning', onClick: () => console.log('Notify client') }
        ];
      default:
        return [];
    }
  };

  // Mock timeline data
  const generateTimelineData = (): TimelineEntry[] => [
    {
      id: 'tl-1',
      timestamp: '2024-01-15T14:20:00Z',
      type: 'comment',
      user: 'John Doe',
      title: 'Investigation update',
      description: 'Contacted DHL depot. Package shows damage signs on external scanning. Initiating formal damage claim process.',
      isClientVisible: false
    },
    {
      id: 'tl-2',
      timestamp: '2024-01-15T13:45:00Z',
      type: 'status_change',
      user: 'System',
      title: 'Status changed to Investigating',
      description: 'Incident status updated from Open to Investigating',
      isClientVisible: true
    },
    {
      id: 'tl-3',
      timestamp: '2024-01-15T13:30:00Z',
      type: 'owner_change',
      user: 'Emma Thompson',
      title: 'Incident assigned',
      description: 'Incident assigned to John Doe',
      isClientVisible: false
    },
    {
      id: 'tl-4',
      timestamp: '2024-01-15T08:30:00Z',
      type: 'client_notification',
      user: 'System',
      title: 'Client notification sent',
      description: 'Damage report notification sent to client: "We have received a damage report for your luxury watch shipment..."',
      isClientVisible: true
    }
  ];

  // Mock file attachments
  const generateFileAttachments = (): FileAttachment[] => [
    {
      id: 'file-1',
      name: 'damage_photos_external.jpg',
      type: 'image/jpeg',
      size: 2048576,
      uploadedAt: '2024-01-15T14:15:00Z',
      uploadedBy: 'DHL System',
      tags: ['damage', 'proof'],
      url: '#'
    },
    {
      id: 'file-2',
      name: 'condition_report_initial.pdf',
      type: 'application/pdf',
      size: 512000,
      uploadedAt: '2024-01-15T13:45:00Z',
      uploadedBy: 'John Doe',
      tags: ['damage', 'report'],
      url: '#'
    }
  ];

  // Communication templates
  const communicationTemplates: CommunicationTemplate[] = [
    {
      id: 'customs_docs_sent',
      type: 'customs',
      stage: 'docs_sent',
      subject: 'Customs Documentation Submitted',
      content: 'We have submitted the required customs documentation for your shipment {shipmentId}. Expected clearance within 24-48 hours.',
      isCustomizable: true
    },
    {
      id: 'delay_express_upgrade',
      type: 'delay', 
      stage: 'upgraded',
      subject: 'Shipment Upgraded to Express',
      content: 'Due to unexpected delays, we have upgraded your shipment {shipmentId} to Express delivery at no additional cost. New ETA: {newEta}',
      isCustomizable: true
    },
    {
      id: 'damage_claim_opened',
      type: 'damage',
      stage: 'claim_opened', 
      subject: 'Insurance Claim Initiated',
      content: 'We have opened an insurance claim for the reported damage to your shipment {shipmentId}. Our team will contact you within 24 hours to discuss next steps.',
      isCustomizable: true
    },
    {
      id: 'lost_investigation',
      type: 'lost',
      stage: 'investigating',
      subject: 'Investigation Underway',
      content: 'We are actively investigating the location of your shipment {shipmentId}. We are working closely with our carrier partners and will update you within 12 hours.',
      isCustomizable: true
    }
  ];

  // Load detail data when incident is selected
  useEffect(() => {
    if (selectedIncident) {
      setPlaybookSteps(generatePlaybookSteps(selectedIncident.type));
      setTimelineEntries(generateTimelineData());
      setFileAttachments(generateFileAttachments());
      setWatchers(['Emma Thompson', 'Mark Johnson']);
      
      // Set resolution form requirements
      setResolutionForm(prev => ({
        ...prev,
        requiresPostMortem: selectedIncident.tier >= 2,
        preventPassportActivation: ['damage', 'lost'].includes(selectedIncident.type) && selectedIncident.tier === 3
      }));
      
      // Check for conflicts when viewing incident
      checkForConflicts(selectedIncident);
    }
  }, [selectedIncident]);

  // Edge case monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      // Check ownership gaps (using mock data for frontend edge case handling)
      // Note: Real ownership gap checking is handled by the backend API
      const gaps: any[] = []; // IncidentEdgeCaseHandler.checkOwnershipGaps(incidents);
      setOwnershipGaps(gaps);
      
      // Auto-escalate if needed
      gaps.forEach(gap => {
        if (gap.escalationRequired) {
          handleAutoEscalation(gap.incident, gap.timeUnassigned);
        }
      });
      
      // Simulate carrier API status changes (in real app, this would be monitoring)
      if (Math.random() < 0.05) { // 5% chance of API issues
        setCarrierAPIStatus(prev => {
          if (prev === 'online') return Math.random() < 0.5 ? 'degraded' : 'offline';
          if (prev === 'degraded') return Math.random() < 0.3 ? 'offline' : 'online';
          return Math.random() < 0.7 ? 'online' : 'degraded';
        });
      }
      
      // Update client communication cooldowns
      const now = Date.now();
      setClientCommCooldown(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          if (updated[key] <= now) {
            delete updated[key];
          }
        });
        return updated;
      });
      
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [incidents]);

  // Edge case handlers
  const checkForConflicts = (incident: Incident) => {
    // Mock conflict detection
    const conflicts: ConflictWarning[] = [];
    
    if (incident.type === 'customs' && incident.status === 'investigating') {
      // Simulate hub marking docs as missing
      if (Math.random() < 0.3) {
        conflicts.push({
          id: `conflict-${Date.now()}`,
          type: 'data_conflict',
          severity: 'blocking',
          title: 'Documentation Status Conflict',
          description: 'Hub reports commercial invoice missing, but customs clearance was attempted',
          conflictingSources: ['hub_documentation_system', 'customs_broker_api'],
          suggestedResolution: 'Verify document status with hub team before proceeding',
          autoResolvable: false
        });
      }
    }
    
    setConflictWarnings(conflicts);
  };

  const handleAutoEscalation = (incident: Incident, timeUnassigned: number) => {
    console.log('🚨 Auto-escalating incident:', {
      incidentId: incident.id,
      severity: incident.severity,
      timeUnassigned: Math.round(timeUnassigned / 60000) + ' minutes'
    });
    
    // Mock auto-assignment to ops lead
    const updatedIncident = {
      ...incident,
      assignee: 'Ops Lead',
      priority: incident.priority + 25 // Boost priority
    };
    
    setIncidents(prev => prev.map(inc => inc.id === incident.id ? updatedIncident : inc));
    
    // Add timeline entry
    const escalationEntry: TimelineEntry = {
      id: `tl-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'escalation',
      user: 'System',
      title: 'Auto-escalated due to ownership gap',
      description: `Incident auto-assigned to Ops Lead after ${Math.round(timeUnassigned / 60000)} minutes unassigned`,
      isClientVisible: false
    };
    
    if (selectedIncident?.id === incident.id) {
      setTimelineEntries(prev => [escalationEntry, ...prev]);
    }
    
    // Emit escalation event
    emitIncidentUpdated({
      incidentId: incident.id,
      field: 'auto_escalation',
      oldValue: null,
      newValue: 'ops_lead_assigned',
      reason: `Auto-escalation after ${Math.round(timeUnassigned / 60000)} minutes unassigned`
    }, { id: 'system', name: 'Auto-Escalation System' });
  };

  const checkClientCommunicationPolicy = (incidentId: string, templateType: string): { allowed: boolean; reason?: string; cooldownMinutes?: number } => {
    const cooldownKey = `${incidentId}-${templateType}`;
    const cooldownUntil = clientCommCooldown[cooldownKey];
    
    if (cooldownUntil && cooldownUntil > Date.now()) {
      return {
        allowed: false,
        reason: 'Communication cooling-off period active',
        cooldownMinutes: Math.ceil((cooldownUntil - Date.now()) / 60000)
      };
    }
    
    // Mock recent communication check
    const recentComms = timelineEntries.filter(entry => 
      entry.type === 'client_notification' && 
      Date.now() - new Date(entry.timestamp).getTime() < 30 * 60 * 1000 // 30 minutes
    );
    
    if (recentComms.length >= 2) {
      return {
        allowed: false,
        reason: 'Maximum 2 client communications per 30 minutes',
        cooldownMinutes: 15
      };
    }
    
    return { allowed: true };
  };

  const handleCarrierAPIFailure = (operation: string, context: any) => {
    setManualModeEnabled(true);
    
    const manualUpdate = CarrierAPIHandler.handleAPIFailure(operation, context.error);
    console.log('📱 Carrier API failure - Manual mode enabled:', manualUpdate);
    
    // Add manual update tracking
    if (selectedIncident) {
      const timelineEntry: TimelineEntry = {
        id: `tl-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'system_alert',
        user: 'System',
        title: 'Carrier API Failure - Manual Mode Enabled',
        description: CarrierAPIHandler.generateManualUpdatePrompt(operation, context),
        isClientVisible: false
      };
      
      setTimelineEntries(prev => [timelineEntry, ...prev]);
    }
  };

  // Validation functions
  const canResolveIncident = (incident: Incident): { canResolve: boolean; reasons: string[] } => {
    const reasons: string[] = [];
    
    // Check playbook completion
    const requiredSteps = playbookSteps.filter(step => step.required);
    const completedSteps = requiredSteps.filter(step => step.completed);
    if (completedSteps.length < requiredSteps.length) {
      reasons.push(`${requiredSteps.length - completedSteps.length} required playbook steps incomplete`);
    }
    
    // Check required files for damage incidents
    if (incident.type === 'damage') {
      const hasPhotos = fileAttachments.some(file => file.tags.includes('damage') && file.type.startsWith('image/'));
      if (!hasPhotos) {
        reasons.push('Damage photos required before resolution');
      }
    }
    
    // Check customs release confirmation
    if (incident.type === 'customs') {
      const hasReleaseConfirmation = timelineEntries.some(entry => 
        entry.description.toLowerCase().includes('release') || 
        entry.description.toLowerCase().includes('cleared')
      );
      if (!hasReleaseConfirmation) {
        reasons.push('Customs release confirmation required');
      }
    }
    
    return { canResolve: reasons.length === 0, reasons };
  };

  const getAvailableActions = (incident: Incident) => {
    const actions = [];
    
    // Basic actions available to all
    actions.push('comment', 'attach_files');
    
    // Assignment actions
    if (currentUser.role === 'ops_admin' || !incident.assignee) {
      actions.push('assign');
    }
    
    // Status and severity changes
    if (currentUser.role === 'ops_admin' || incident.assignee === currentUser.name) {
      actions.push('change_severity', 'change_status');
    }
    
    // Resolution (with validation)
    if (incident.status !== 'resolved') {
      const { canResolve } = canResolveIncident(incident);
      if (canResolve || currentUser.role === 'ops_admin') {
        actions.push('resolve');
      }
    }
    
    // Reopen
    if (incident.status === 'resolved') {
      actions.push('reopen');
    }
    
    return actions;
  };

  // Action handlers
  const handleCreateIncident = () => {
    setActionModal({ type: 'create', isOpen: true });
  };

  const handleAssignIncident = () => {
    setActionModal({ type: 'assign', isOpen: true, data: selectedIncident });
  };

  const handleChangeSeverity = () => {
    setActionModal({ type: 'severity', isOpen: true, data: selectedIncident });
  };

  const handleChangeStatus = () => {
    setActionModal({ type: 'status', isOpen: true, data: selectedIncident });
  };

  const handleResolveIncident = () => {
    if (selectedIncident) {
      const { canResolve, reasons } = canResolveIncident(selectedIncident);
      setActionModal({ 
        type: 'resolve', 
        isOpen: true, 
        data: { incident: selectedIncident, canResolve, reasons }
      });
    }
  };

  const handleReopenIncident = () => {
    setActionModal({ type: 'reopen', isOpen: true, data: selectedIncident });
  };

  const submitCreateIncident = async () => {
    try {
      if (apiConnected) {
        // Use real API
        const incidentData = IncidentAPIClient.convertIncidentForAPI({
          ...createForm,
          createdBy: currentUser.name
        });
        
        const response = await IncidentAPIClient.createIncident(incidentData);
        
        if (response.success) {
          console.log('✅ Incident created successfully:', response.data.incident_id);
          
          // Add to local state
          const newIncident = IncidentAPIClient.convertIncidentFromDB(response.data);
          setIncidents(prev => [newIncident, ...prev]);
          
          // Emit event
          emitIncidentOpened({
            incidentId: newIncident.id,
            shipmentId: newIncident.shipmentId,
            type: newIncident.type,
            severity: newIncident.severity,
            ownerId: newIncident.assignee || '',
            slaDueAt: newIncident.dueAt,
            clientName: newIncident.clientName,
            contactName: newIncident.contactName,
            leg: newIncident.legDisplay || '',
            hub: newIncident.hub || '',
            carrier: newIncident.carrier || ''
          }, { id: currentUser.id, name: currentUser.name });
          
          // Check for duplicate warnings from server
          if (response.data.duplicate_warnings?.length > 0) {
            setDuplicateWarnings(response.data.duplicate_warnings);
          }
          
          setActionModal({ type: null, isOpen: false });
          resetCreateForm();
          return;
          
        } else {
          console.error('❌ Failed to create incident:', response.error);
          alert(`Failed to create incident: ${response.error?.message || 'Unknown error'}`);
          return;
        }
      }
      
      // Fallback to local creation (when API not available)
      console.log('📋 Creating incident locally (API not available)');
      createIncidentLocally();
      
    } catch (error) {
      console.error('❌ Error creating incident:', error);
      alert('Failed to create incident. Please try again.');
    }
  };

  const createIncidentLocally = () => {
    // Check for duplicate incidents (fallback for local mode)
    const duplicates: any[] = []; // IncidentEdgeCaseHandler.checkForDuplicates(createForm, incidents);
    
    if (duplicates.length > 0) {
      setDuplicateWarnings(duplicates);
      
      // Show confirmation dialog for duplicates
      const proceed = window.confirm(
        `⚠️ Potential duplicate incidents found:\n\n${duplicates.map(d => 
          `• ${d.type.toUpperCase()} incident ${d.incidentId} (${d.status})\n  ${d.overlapReason}`
        ).join('\n\n')}\n\nDo you want to proceed with creating this incident?`
      );
      
      if (!proceed) {
        return;
      }
    }

    // Create new incident
    const newIncident: Incident = {
      id: `INC-2024-${String(incidents.length + 1).padStart(3, '0')}`,
      ...createForm,
      createdAt: new Date().toISOString(),
      dueAt: new Date(Date.now() + (createForm.severity === 'S1' ? 2 : createForm.severity === 'S2' ? 8 : 24) * 60 * 60 * 1000).toISOString(),
      lastAction: new Date().toISOString(),
      isOverdue: false,
      priority: createForm.severity === 'S1' ? 95 : createForm.severity === 'S2' ? 75 : createForm.severity === 'S3' ? 45 : 20,
      tags: [],
      hub: 'paris',
      carrier: 'WG',
      legDisplay: createForm.leg === 'sender_to_hub' ? 'Sender → Hub' :
                   createForm.leg === 'hub_to_buyer' ? 'Hub → Buyer' : 'WG Internal',
      status: 'open',
      tier: createForm.severity === 'S1' ? 3 : createForm.severity === 'S2' ? 2 : 1,
      resolution: '',
      resolutionNotes: '',
      relatedShipments: []
    };
    
    // Link related incidents if duplicates were acknowledged
    if (duplicates.length > 0) {
      newIncident.tags.push('duplicate_acknowledged');
      newIncident.relatedShipments = duplicates.map(d => d.incidentId);
      
      // Update related incidents to link back
      setIncidents(prev => prev.map(inc => {
        if (duplicates.some(d => d.incidentId === inc.id)) {
          return {
            ...inc,
            relatedShipments: [...(inc.relatedShipments || []), newIncident.id]
          };
        }
        return inc;
      }));
    }
    
    // Emit incident.opened event
    emitIncidentOpened({
      incidentId: newIncident.id,
      shipmentId: newIncident.shipmentId,
      type: newIncident.type,
      severity: newIncident.severity,
      ownerId: newIncident.assignee || '',
      slaDueAt: newIncident.dueAt,
      clientName: newIncident.clientName || '',
      contactName: newIncident.contactName || '',
      leg: newIncident.legDisplay || '',
      hub: newIncident.hub || '',
      carrier: newIncident.carrier || ''
    }, { id: currentUser.id, name: currentUser.name });
    
    setIncidents(prev => [newIncident, ...prev]);
    setActionModal({ type: null, isOpen: false });
    resetCreateForm();
  };

  const resetCreateForm = () => {
    setCreateForm({
      type: 'customs',
      severity: 'S3',
      title: '',
      description: '',
      shipmentId: '',
      leg: 'sender_to_hub',
      assignee: '',
      clientName: '',
      contactName: ''
    });
  };

  const submitResolution = () => {
    if (!selectedIncident) return;
    
    // Update incident status
    const updatedIncident = {
      ...selectedIncident,
      status: 'resolved' as const,
      resolution: resolutionForm.reason,
      resolutionNotes: resolutionForm.postMortem
    };
    
    // Emit incident.resolved event
    emitIncidentResolved({
      incidentId: selectedIncident.id,
      shipmentId: selectedIncident.shipmentId,
      outcome: resolutionForm.reason,
      postMortem: !!resolutionForm.postMortem,
      postMortemContent: resolutionForm.postMortem,
      passportImpact: resolutionForm.preventPassportActivation,
      overrideReason: resolutionForm.overrideReason
    }, { id: currentUser.id, name: currentUser.name });
    
    setIncidents(prev => prev.map(inc => inc.id === selectedIncident.id ? updatedIncident : inc));
    setSelectedIncident(updatedIncident);
    
    // Add timeline entry
    const newTimelineEntry: TimelineEntry = {
      id: `tl-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'status_change',
      user: currentUser.name,
      title: 'Incident resolved',
      description: `Resolution: ${resolutionForm.reason}${resolutionForm.postMortem ? ` | Post-mortem: ${resolutionForm.postMortem}` : ''}`,
      isClientVisible: true
    };
    
    setTimelineEntries(prev => [newTimelineEntry, ...prev]);
    setActionModal({ type: null, isOpen: false });
  };

  // Mock team members for mentions
  const teamMembers = [
    { id: '1', name: 'John Doe', role: 'ops_admin' },
    { id: '2', name: 'Emma Thompson', role: 'hub_tech' },
    { id: '3', name: 'Mark Johnson', role: 'wg_operator' },
    { id: '4', name: 'Lisa Chen', role: 'ops_admin' },
    { id: '5', name: 'Sarah Wilson', role: 'hub_tech' }
  ];

  // Quick actions for different incident types
  const getQuickActions = (incidentType: string) => {
    const actions: { [key: string]: Array<{ label: string; action: () => void; hotkey?: string }> } = {
      delay: [
        { 
          label: '🚀 Upgrade to Express', 
          action: () => handleQuickAction('upgrade_express'),
          hotkey: 'E'
        },
        { 
          label: '📅 Rebook WG Slot', 
          action: () => handleQuickAction('rebook_wg'),
          hotkey: 'R'
        },
        { 
          label: '🏢 Switch Hub', 
          action: () => handleQuickAction('switch_hub'),
          hotkey: 'H'
        },
        { 
          label: '📞 Notify Client', 
          action: () => handleQuickAction('notify_client'),
          hotkey: 'N'
        }
      ],
      customs: [
        { 
          label: '📄 Send Docs to Broker', 
          action: () => handleQuickAction('send_docs'),
          hotkey: 'D'
        },
        { 
          label: '☎️ Contact Broker', 
          action: () => handleQuickAction('contact_broker'),
          hotkey: 'B'
        },
        { 
          label: '⚡ Escalate to Express', 
          action: () => handleQuickAction('escalate_express'),
          hotkey: 'E'
        }
      ],
      damage: [
        { 
          label: '📸 Request Photos', 
          action: () => handleQuickAction('request_photos'),
          hotkey: 'P'
        },
        { 
          label: '🛡️ Open Insurance Claim', 
          action: () => handleQuickAction('open_claim'),
          hotkey: 'I'
        },
        { 
          label: '⏸️ Hold Item', 
          action: () => handleQuickAction('hold_item'),
          hotkey: 'H'
        }
      ],
      lost: [
        { 
          label: '🔍 Open Carrier Trace', 
          action: () => handleQuickAction('open_trace'),
          hotkey: 'T'
        },
        { 
          label: '🚨 Escalate to Carrier', 
          action: () => handleQuickAction('escalate_carrier'),
          hotkey: 'E'
        },
        { 
          label: '📋 File Insurance Claim', 
          action: () => handleQuickAction('file_claim'),
          hotkey: 'I'
        }
      ]
    };
    return actions[incidentType] || [];
  };

  const handleQuickAction = (actionType: string) => {
    if (!selectedIncident) return;
    
    // Mock quick actions with timeline updates
    const actionDescriptions: { [key: string]: string } = {
      upgrade_express: 'Upgraded shipment to Express delivery service',
      rebook_wg: 'Rebooked WG pickup slot for next available time',
      switch_hub: 'Switched processing to alternate hub location',
      notify_client: 'Sent proactive notification to client about delay',
      send_docs: 'Forwarded documentation package to customs broker',
      contact_broker: 'Initiated direct contact with customs broker',
      escalate_express: 'Escalated to Express customs clearance service',
      request_photos: 'Requested damage assessment photos from hub team',
      open_claim: 'Opened insurance claim with carrier partner',
      hold_item: 'Placed item on hold pending damage assessment',
      open_trace: 'Initiated full package trace with carrier systems',
      escalate_carrier: 'Escalated missing package case to carrier management',
      file_claim: 'Filed loss claim with insurance provider'
    };

    const newTimelineEntry: TimelineEntry = {
      id: `tl-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'action',
      user: currentUser.name,
      title: `Quick action: ${actionType.replace('_', ' ')}`,
      description: actionDescriptions[actionType] || `Performed ${actionType}`,
      isClientVisible: ['notify_client', 'upgrade_express', 'escalate_express'].includes(actionType)
    };

    setTimelineEntries(prev => [newTimelineEntry, ...prev]);
    
    // Emit update event
    emitIncidentUpdated({
      incidentId: selectedIncident.id,
      field: 'quick_action',
      oldValue: null,
      newValue: actionType,
      reason: `Quick action performed: ${actionDescriptions[actionType]}`
    }, { id: currentUser.id, name: currentUser.name });

    console.log('⚡ Quick action performed:', actionType);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + N: New incident
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateIncident();
        return;
      }

      // ? key: Show keyboard help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowKeyboardHelp(!showKeyboardHelp);
        return;
      }

      // Escape: Close modals/panels
      if (e.key === 'Escape') {
        if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
        } else if (actionModal.isOpen) {
          setActionModal({ type: null, isOpen: false });
        } else if (selectedIncident) {
          setSelectedIncident(null);
        }
        return;
      }

      // Quick actions when incident is selected
      if (selectedIncident && !actionModal.isOpen) {
        switch (e.key.toLowerCase()) {
          case 'r':
            if (!e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              handleResolveIncident();
            }
            break;
          case 'a':
            e.preventDefault();
            handleAssignIncident();
            break;
          case 'c':
            e.preventDefault();
            setActiveDetailTab('timeline');
            break;
          case 'f':
            e.preventDefault();
            setActiveDetailTab('files');
            break;
          case 's':
            e.preventDefault();
            handleChangeSeverity();
            break;
          case 'q':
            e.preventDefault();
            setIsQuickActionMode(!isQuickActionMode);
            break;
        }

        // Quick action hotkeys when in quick action mode
        if (isQuickActionMode) {
          const quickActions = getQuickActions(selectedIncident.type);
          const action = quickActions.find(qa => qa.hotkey?.toLowerCase() === e.key.toLowerCase());
          if (action) {
            e.preventDefault();
            action.action();
            setIsQuickActionMode(false);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIncident, actionModal.isOpen, isQuickActionMode]);

  // File drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverComment(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverComment(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverComment(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Mock file attachment
      files.forEach(file => {
        const newAttachment: FileAttachment = {
          id: `file-${Date.now()}-${Math.random()}`,
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: currentUser.name,
          tags: [],
          url: URL.createObjectURL(file)
        };
        
        setFileAttachments(prev => [newAttachment, ...prev]);
        
        // Add to timeline
        const timelineEntry: TimelineEntry = {
          id: `tl-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'file_upload',
          user: currentUser.name,
          title: 'File attached',
          description: `Uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
          isClientVisible: false
        };
        
        setTimelineEntries(prev => [timelineEntry, ...prev]);
      });
    }
  };

  if (isLoading) {
  return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading incidents...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Page Header */}
      <div style={{
        background: '#fff',
        padding: '32px 0',
        borderBottom: '1px solid #e0e0e0',
        marginBottom: '32px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #333 0%, #000 100%)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertOctagon size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', color: '#1a1a1a' }}>
                Incident Management
              </h1>
              <p style={{ color: '#666', margin: 0, fontSize: '16px' }}>
                Track, resolve, and maintain audit trail for operational issues
              </p>
            </div>
          </div>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            style={{
              background: '#000',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative'
            }}
            onClick={handleCreateIncident}
          >
            <Plus size={16} />
            New Incident
            <div style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              background: '#3b82f6',
              color: '#fff',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 600
            }}>
              ⌘N
            </div>
          </button>

          <button
            style={{
              padding: '8px 12px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setIsQuickActionMode(!isQuickActionMode)}
          >
            ⚡ Quick Actions {isQuickActionMode ? '(ON)' : ''}
          </button>

                    {/* Backend API Status Indicator */}
          <div style={{
            padding: '6px 10px',
            background: apiConnected ? '#dcfce7' : '#fecaca',
            border: `1px solid ${apiConnected ? '#bbf7d0' : '#f87171'}`,
            borderRadius: '6px',
            fontSize: '11px',
            color: apiConnected ? '#166534' : '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: apiConnected ? '#22c55e' : '#ef4444'
            }} />
            Backend: {apiConnected ? 'CONNECTED' : 'OFFLINE'}
            {!apiConnected && ' (Mock Data)'}
          </div>

          {/* Carrier API Status Indicator */}
          <div style={{
            padding: '6px 10px',
            background: carrierAPIStatus === 'online' ? '#dcfce7' : carrierAPIStatus === 'degraded' ? '#fef3c7' : '#fecaca',
            border: `1px solid ${carrierAPIStatus === 'online' ? '#bbf7d0' : carrierAPIStatus === 'degraded' ? '#fde68a' : '#f87171'}`,
            borderRadius: '6px',
            fontSize: '11px',
            color: carrierAPIStatus === 'online' ? '#166534' : carrierAPIStatus === 'degraded' ? '#92400e' : '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: carrierAPIStatus === 'online' ? '#22c55e' : carrierAPIStatus === 'degraded' ? '#f59e0b' : '#ef4444'
            }} />
            Carrier API: {carrierAPIStatus.toUpperCase()}
            {manualModeEnabled && ' (Manual Mode)'}
          </div>

          {/* Ownership Gaps Alert */}
          {ownershipGaps.length > 0 && (
            <div style={{
              padding: '6px 10px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              🚨 {ownershipGaps.length} Unassigned {ownershipGaps.length === 1 ? 'Incident' : 'Incidents'}
      </div>
          )}

          <div style={{
            padding: '6px 10px',
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#92400e'
          }}>
            💡 Press ? for shortcuts
          </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
        {/* Critical Incidents Alert */}
        {filteredIncidents.filter(i => i.isOverdue || i.severity === 'S1').length > 0 && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <AlertOctagon size={24} color="#dc2626" />
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: '#dc2626' }}>
                {filteredIncidents.filter(i => i.isOverdue).length} overdue incidents, {filteredIncidents.filter(i => i.severity === 'S1').length} critical
              </h3>
              <p style={{ fontSize: '14px', color: '#991b1b' }}>
                High-priority incidents require immediate attention
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#dc2626' }}>
                {filteredIncidents.filter(i => i.isOverdue || i.severity === 'S1').length}
              </div>
              <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>
                URGENT
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 500,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Target size={20} />
            Current Status
          </h2>
          
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
            padding: '24px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '24px' }}>
              {[
                { label: 'Open', value: filteredIncidents.filter(i => i.status !== 'resolved').length, color: '#3b82f6', desc: 'Active incidents' },
                { label: 'Overdue', value: filteredIncidents.filter(i => i.isOverdue).length, color: '#dc2626', desc: 'Past SLA deadline' },
                { label: 'Unassigned', value: filteredIncidents.filter(i => !i.assignee).length, color: '#f59e0b', desc: 'Need owner' },
                { label: 'Resolved Today', value: filteredIncidents.filter(i => {
                  const today = new Date().toDateString();
                  return i.status === 'resolved' && new Date(i.lastAction).toDateString() === today;
                }).length, color: '#10b981', desc: 'Completed today' }
              ].map((stat, index) => (
                <div key={index} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: 700,
                    color: stat.color,
                    marginBottom: '8px'
                  }}>
                    {stat.value}
                  </div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#333',
                    marginBottom: '4px'
                  }}>
                    {stat.label}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    {stat.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active Incidents Section */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 500,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Clock size={20} />
            Active Incidents ({filteredIncidents.filter(i => i.status !== 'resolved').length})
          </h2>
          
          {/* Search and Filters */}
          <div style={{ 
            background: '#fff', 
            padding: '24px', 
            borderRadius: '12px', 
            border: '1px solid #e0e0e0',
            marginBottom: '20px'
          }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
              <input
                type="text"
              placeholder="Search by Shipment ID, contact, tracking..."
              value={filters.freeText}
              onChange={(e) => setFilters(prev => ({ ...prev, freeText: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
              />
            </div>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: showFilters ? '#f3f4f6' : '#fff',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            <Filter size={16} />
            Filters
            {getActiveFiltersCount() > 0 && (
              <span style={{
                background: '#3b82f6',
                color: '#fff',
                borderRadius: '10px',
                padding: '2px 6px',
                fontSize: '12px',
                fontWeight: 500
              }}>
                {getActiveFiltersCount()}
              </span>
            )}
          </button>

          {/* Sort */}
            <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split(':');
              setSortBy(field);
              setSortOrder(order as 'asc' | 'desc');
            }}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="priority:desc">Priority (High to Low)</option>
            <option value="priority:asc">Priority (Low to High)</option>
            <option value="created:desc">Newest First</option>
            <option value="created:asc">Oldest First</option>
            <option value="due:asc">Due Soon First</option>
            <option value="due:desc">Due Later First</option>
            <option value="severity:desc">Severity (High to Low)</option>
            </select>
            
          {getActiveFiltersCount() > 0 && (
            <button
              onClick={clearAllFilters}
              style={{
                padding: '8px 16px',
                border: '1px solid #dc2626',
                borderRadius: '6px',
                background: '#fff',
                color: '#dc2626',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear All
            </button>
          )}
          </div>
          
        {/* Filter Panel */}
        {showFilters && (
          <div style={{ 
            borderTop: '1px solid #e5e7eb', 
            paddingTop: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            {/* Type Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>
                Type
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {['customs', 'delay', 'damage', 'lost', 'docs', 'address', 'payment_hold'].map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      const newTypes = filters.type.includes(type)
                        ? filters.type.filter(t => t !== type)
                        : [...filters.type, type];
                      setFilters(prev => ({ ...prev, type: newTypes }));
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      background: filters.type.includes(type) ? '#3b82f6' : '#fff',
                      color: filters.type.includes(type) ? '#fff' : '#374151',
                      cursor: 'pointer'
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>
                Severity
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {['S1', 'S2', 'S3', 'S4'].map(severity => (
                  <button
                    key={severity}
                    onClick={() => {
                      const newSeverities = filters.severity.includes(severity)
                        ? filters.severity.filter(s => s !== severity)
                        : [...filters.severity, severity];
                      setFilters(prev => ({ ...prev, severity: newSeverities }));
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      background: filters.severity.includes(severity) ? getSeverityColor(severity) : '#fff',
                      color: filters.severity.includes(severity) ? '#fff' : '#374151',
                      cursor: 'pointer'
                    }}
                  >
                    {severity}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>
                Status
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {['open', 'investigating', 'waiting_third_party', 'on_hold', 'resolved'].map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      const newStatuses = filters.status.includes(status)
                        ? filters.status.filter(s => s !== status)
                        : [...filters.status, status];
                      setFilters(prev => ({ ...prev, status: newStatuses }));
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      background: filters.status.includes(status) ? getStatusColor(status) : '#fff',
                      color: filters.status.includes(status) ? '#fff' : '#374151',
                      cursor: 'pointer'
                    }}
                  >
                    {status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignment Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>
                Assignment
              </label>
            <select
                value={filters.assignment}
                onChange={(e) => setFilters(prev => ({ ...prev, assignment: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}
              >
                <option value="">All</option>
                <option value="unassigned">Unassigned</option>
                <option value="me">Assigned to Me</option>
            </select>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedIncidents.size > 0 && (
        <div style={{
          background: '#f3f4f6',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>
              {selectedIncidents.size} incident{selectedIncidents.size !== 1 ? 's' : ''} selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">Choose action...</option>
                <option value="assign">Assign to user</option>
                <option value="severity">Change severity</option>
                <option value="status">Update status</option>
                <option value="comment">Add comment</option>
              </select>
              {bulkAction && (
                <button
                  onClick={() => handleBulkAction(bulkAction)}
                  style={{
                    padding: '6px 16px',
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Apply
            </button>
              )}
          </div>
        </div>
          <button
            onClick={() => setSelectedIncidents(new Set())}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#666',
              fontSize: '14px'
            }}
          >
            <X size={16} />
          </button>
      </div>
      )}

          {/* Incidents Cards */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>

            {filteredIncidents.map((incident) => (
              <div key={incident.id} style={{
                background: '#fff',
                borderRadius: '12px',
                padding: '24px',
                border: `2px solid ${incident.isOverdue ? '#ef4444' : incident.severity === 'S1' ? '#dc2626' : '#e0e0e0'}`,
                flex: '1',
                minWidth: '350px',
                maxWidth: '450px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onClick={() => setSelectedIncident(incident)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
              <input
                type="checkbox"
                checked={selectedIncidents.has(incident.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleIncidentSelection(incident.id);
                }}
                style={{ cursor: 'pointer' }}
                onClick={(e) => e.stopPropagation()}
              />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {getTypeIcon(incident.type)}
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 500
                }}>
                  {incident.type.toUpperCase()}
                    </span>
                  </div>
                  
              <div style={{ fontWeight: 500, color: '#3b82f6' }}>
                {incident.shipmentId}
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
                  {incident.legDisplay}
                </div>
                <div style={{ fontWeight: 500, fontSize: '13px' }}>
                  {incident.title.substring(0, 30)}...
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: getSeverityColor(incident.severity)
                }} />
                <span style={{ fontWeight: 500, color: getSeverityColor(incident.severity) }}>
                  {incident.severity}
                    </span>
                  </div>
                  
              <div style={{
                fontSize: '12px',
                color: incident.isOverdue ? '#dc2626' : '#666',
                fontWeight: incident.isOverdue ? 600 : 400
              }}>
                {getTimeRemaining(incident.dueAt)}
                    </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {incident.assignee ? (
                  <>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 500
                    }}>
                      {incident.assignee.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span style={{ fontSize: '12px' }}>{incident.assignee}</span>
                  </>
                ) : (
                  <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                    Unassigned
                  </span>
                    )}
                    </div>

              <div style={{
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 500,
                background: `${getStatusColor(incident.status)}20`,
                color: getStatusColor(incident.status),
                textAlign: 'center'
              }}>
                {incident.status.replace('_', ' ').toUpperCase()}
                    </div>

              <div style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 500,
                background: '#f3f4f6',
                color: '#374151',
                textAlign: 'center'
              }}>
                T{incident.tier}
                </div>
                
              <div style={{ fontSize: '12px', color: '#666' }}>
                {(() => {
                  const created = new Date(incident.createdAt);
                  const now = new Date();
                  const diffHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
                  if (diffHours < 24) return `${diffHours}h`;
                  const diffDays = Math.floor(diffHours / 24);
                  return `${diffDays}d`;
                })()}
                </div>

              <div style={{ fontSize: '12px', color: '#666' }}>
                {(() => {
                  const lastAction = new Date(incident.lastAction);
                  const now = new Date();
                  const diffMinutes = Math.floor((now.getTime() - lastAction.getTime()) / (1000 * 60));
                  if (diffMinutes < 60) return `${diffMinutes}m ago`;
                  const diffHours = Math.floor(diffMinutes / 60);
                  if (diffHours < 24) return `${diffHours}h ago`;
                  const diffDays = Math.floor(diffHours / 24);
                  return `${diffDays}d ago`;
                })()}
              </div>

              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '4px'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIncident(incident);
                }}
              >
                <ChevronRight size={16} />
              </button>
              </div>
            ))}
          </div>

          {filteredIncidents.length === 0 && (
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '60px 40px',
              textAlign: 'center',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Search size={24} color="#9ca3af" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                No incidents found
              </h3>
              <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
                Try adjusting your filters or create a new incident
              </p>
            </div>
          )}

            {/* Enhanced Incident Detail Panel */}
      {selectedIncident && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '600px',
          height: '100vh',
          background: '#fff',
          borderLeft: '1px solid #e5e7eb',
          zIndex: 1000,
          overflow: 'auto',
          boxShadow: '-4px 0 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Enhanced Header */}
            <div style={{ 
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              background: '#f9fafb'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {getTypeIcon(selectedIncident.type)}
                    <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
                      {selectedIncident.id}
                    </h2>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      background: `${getSeverityColor(selectedIncident.severity)}20`,
                      color: getSeverityColor(selectedIncident.severity)
                    }}>
                      {selectedIncident.severity}
                    </span>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 500,
                      background: `${getStatusColor(selectedIncident.status)}20`,
                      color: getStatusColor(selectedIncident.status)
                    }}>
                      {selectedIncident.status.replace('_', ' ').toUpperCase()}
                    </span>
                </div>
                  <p style={{ color: '#666', margin: 0, fontSize: '14px', marginBottom: '12px' }}>
                    {selectedIncident.title}
                  </p>
                  
                  {/* SLA Countdown */}
                  <div style={{
                    padding: '8px 12px',
                    background: selectedIncident.isOverdue ? '#fef2f2' : '#f0f9ff',
                    border: `1px solid ${selectedIncident.isOverdue ? '#fecaca' : '#bae6fd'}`,
                    borderRadius: '6px',
                    display: 'inline-block',
                    marginBottom: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Timer size={14} style={{ color: selectedIncident.isOverdue ? '#dc2626' : '#0284c7' }} />
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: selectedIncident.isOverdue ? '#dc2626' : '#0284c7'
                      }}>
                        SLA: {getTimeRemaining(selectedIncident.dueAt)}
                      </span>
                    </div>
                  </div>

                  {/* Quick Links */}
                  {/* One-Click Critical Data Access */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button 
                      onClick={() => window.open(`/sprint-8/logistics/shipments/${selectedIncident.shipmentId}`, '_blank')}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 500
                      }}
                    >
                      <Package size={12} />
                      Shipment {selectedIncident.shipmentId}
                      <ExternalLink size={8} />
                  </button>
                    
                    <button 
                      onClick={() => window.open(`/sprint-8/logistics/hub/jobs?shipment=${selectedIncident.shipmentId}`, '_blank')}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 500
                      }}
                    >
                      <Building2 size={12} />
                      Hub Job
                      <ExternalLink size={8} />
                  </button>
                    
                    {selectedIncident.trackingId && (
                      <button 
                        onClick={() => window.open(`https://www.dhl.com/en/express/tracking.html?AWB=${selectedIncident.trackingId}`, '_blank')}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11px',
                          background: '#f59e0b',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 500
                        }}
                      >
                        <Truck size={12} />
                        DHL {selectedIncident.trackingId}
                        <ExternalLink size={8} />
                    </button>
                  )}
                    
                    <button 
                      onClick={() => window.open(`/sprint-8/logistics/operators/${selectedIncident.assignee}`, '_blank')}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        background: '#8b5cf6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 500
                      }}
                    >
                      <User size={12} />
                      {selectedIncident.assignee || 'Unassigned'}
                      <ExternalLink size={8} />
                    </button>
                    
                    <button 
                      onClick={() => {
                        const phone = '+33123456789'; // Mock phone number
                        window.open(`tel:${phone}`);
                      }}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        background: '#06b6d4',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 500
                      }}
                    >
                      <Phone size={12} />
                      Call Client
                    </button>
                </div>
              </div>
                
                <button
                  onClick={() => setSelectedIncident(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#666',
                    padding: '8px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ 
              display: 'flex',
              borderBottom: '1px solid #e5e7eb',
              background: '#fff'
            }}>
              {[
                { key: 'overview', label: 'Overview', icon: Eye },
                { key: 'playbook', label: 'Playbook', icon: PlayCircle },
                { key: 'timeline', label: 'Timeline', icon: History },
                { key: 'files', label: 'Files', icon: Paperclip },
                { key: 'people', label: 'People', icon: Users }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeDetailTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveDetailTab(tab.key as any)}
                    style={{
                      flex: 1,
                      padding: '12px 8px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: isActive ? '#3b82f6' : '#666',
                      borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Conflict Warnings */}
            {conflictWarnings.length > 0 && (
              <div style={{
                margin: '16px 24px',
                padding: '12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>
                  ⚠️ Conflicts Detected
                </h4>
                {conflictWarnings.map(conflict => (
                  <div key={conflict.id} style={{ marginBottom: '8px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 500, color: '#dc2626' }}>{conflict.title}</div>
                    <div style={{ color: '#991b1b', marginTop: '2px' }}>{conflict.description}</div>
                    {conflict.suggestedResolution && (
                      <div style={{ color: '#059669', marginTop: '4px', fontSize: '11px' }}>
                        💡 Suggested: {conflict.suggestedResolution}
                      </div>
                    )}
            </div>
          ))}
        </div>
            )}

            {/* Related Incidents Warning */}
            {selectedIncident.relatedShipments && selectedIncident.relatedShipments.length > 0 && (
              <div style={{
                margin: '16px 24px',
                padding: '12px',
                background: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '6px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
                  🔗 Related Incidents
                </h4>
                <div style={{ fontSize: '12px', color: '#92400e' }}>
                  This incident is linked to: {selectedIncident.relatedShipments.join(', ')}
      </div>
              </div>
            )}

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {activeDetailTab === 'overview' && (
                <div style={{ padding: '24px' }}>
                  {/* Key Details Grid */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '16px',
                    marginBottom: '24px'
                  }}>
                    <div style={{
                      padding: '16px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Owner</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: '#e5e7eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: 500
                        }}>
                          {selectedIncident.assignee?.split(' ').map(n => n[0]).join('') || 'UN'}
          </div>
                        <span style={{ fontSize: '14px', fontWeight: 500 }}>
                          {selectedIncident.assignee || 'Unassigned'}
                        </span>
                      </div>
        </div>
        
                    <div style={{
                      padding: '16px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Tier</div>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>
                        Tier {selectedIncident.tier}
          </div>
                    </div>
        </div>
        
                  {/* Shipment Details */}
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Shipment Details</h3>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>Shipment ID:</span>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#3b82f6' }}>
                          {selectedIncident.shipmentId}
                        </span>
          </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>Leg:</span>
                        <span style={{ fontSize: '14px' }}>{selectedIncident.legDisplay}</span>
        </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>Carrier:</span>
                        <span style={{ fontSize: '14px' }}>{selectedIncident.carrier}</span>
      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>Hub:</span>
                        <span style={{ fontSize: '14px' }}>{selectedIncident.hub.charAt(0).toUpperCase() + selectedIncident.hub.slice(1)}</span>
    </div>
                      {selectedIncident.trackingId && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>Tracking:</span>
                          <span style={{ fontSize: '14px', fontFamily: 'monospace' }}>{selectedIncident.trackingId}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Client Information */}
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Client Information</h3>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>Client:</span>
                        <span style={{ fontSize: '14px' }}>{selectedIncident.clientName}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>Contact:</span>
                        <span style={{ fontSize: '14px' }}>{selectedIncident.contactName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Description</h3>
                    <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>
                      {selectedIncident.description}
                    </p>
                  </div>

                  {/* Tags */}
                  {selectedIncident.tags.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Tags</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {selectedIncident.tags.map(tag => (
                          <span key={tag} style={{
                            padding: '4px 8px',
                            background: '#f3f4f6',
                            color: '#374151',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 500
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution */}
                  {selectedIncident.status === 'resolved' && selectedIncident.resolution && (
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Resolution</h3>
                      <div style={{
                        padding: '12px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px'
                      }}>
                        <p style={{ fontSize: '14px', color: '#065f46', margin: 0 }}>
                          {selectedIncident.resolution}
                        </p>
                        {selectedIncident.resolutionNotes && (
                          <p style={{ fontSize: '12px', color: '#047857', margin: '8px 0 0 0', fontStyle: 'italic' }}>
                            {selectedIncident.resolutionNotes}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Playbook Tab */}
              {activeDetailTab === 'playbook' && (
                <div style={{ padding: '24px' }}>
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clipboard size={16} />
                      {selectedIncident.type.charAt(0).toUpperCase() + selectedIncident.type.slice(1)} Playbook
                    </h3>
                    <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                      Follow the checklist to ensure proper resolution. All required items must be completed.
                    </p>
                  </div>

                  {/* Checklist */}
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Checklist</h4>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {playbookSteps.map(step => (
                        <div key={step.id} style={{
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          background: step.completed ? '#f0fdf4' : '#fff'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              background: step.completed ? '#10b981' : '#e5e7eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: '2px',
                              flexShrink: 0
                            }}>
                              {step.completed && <CheckCircle size={10} style={{ color: '#fff' }} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{
                                  fontSize: '14px',
                                  fontWeight: 500,
                                  color: step.completed ? '#065f46' : '#374151'
                                }}>
                                  {step.label}
                                </span>
                                {step.required && (
                                  <span style={{
                                    fontSize: '10px',
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 500
                                  }}>
                                    REQUIRED
                                  </span>
                                )}
                              </div>
                              
                              {step.type === 'text' && (
                                <input
                                  type="text"
                                  value={step.value || ''}
                                  placeholder="Enter value..."
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                  }}
                                />
                              )}
                              
                              {step.type === 'select' && (
                                <select
                                  value={step.value || ''}
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                  }}
                                >
                                  <option value="">Select option...</option>
                                  {step.options?.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              )}
                              
                              {step.type === 'date' && (
                                <input
                                  type="datetime-local"
                                  value={step.value || ''}
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                  }}
                                />
                              )}
                              
                              {step.type === 'file' && (
                                <div style={{ marginTop: '8px' }}>
                                  <button style={{
                                    padding: '6px 12px',
                                    background: '#f3f4f6',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    <Upload size={12} />
                                    Upload File
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Actions</h4>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {generatePlaybookActions(selectedIncident.type).map(action => (
                        <button
                          key={action.id}
                          onClick={action.onClick}
                          style={{
                            padding: '8px 16px',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 500,
                            background: action.type === 'primary' ? '#3b82f6' : 
                                       action.type === 'warning' ? '#f59e0b' :
                                       action.type === 'danger' ? '#ef4444' : '#f3f4f6',
                            color: action.type === 'secondary' ? '#374151' : '#fff'
                          }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Exit Criteria */}
                  <div style={{
                    padding: '16px',
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px'
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#0369a1' }}>
                      Exit Criteria
                    </h4>
                    <p style={{ fontSize: '12px', color: '#0369a1', margin: 0 }}>
                      {selectedIncident.type === 'customs' && 'Carrier/broker marks released; update ETA.'}
                      {selectedIncident.type === 'delay' && 'New ETA confirmed and within SLA or accepted by client.'}
                      {selectedIncident.type === 'damage' && 'Claim filed & acknowledged, plan agreed with client; passport steps unblocked/updated.'}
                      {selectedIncident.type === 'lost' && 'Item found with ETA or claim accepted and next steps defined.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Timeline Tab */}
              {activeDetailTab === 'timeline' && (
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Activity Timeline</h3>
                    <select
                      value={showTimelineFilter}
                      onChange={(e) => setShowTimelineFilter(e.target.value)}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      <option value="all">All Activity</option>
                      <option value="client">Client Visible</option>
                      <option value="internal">Internal Only</option>
                    </select>
                  </div>

                  {/* Timeline Entries */}
                  <div style={{ position: 'relative' }}>
                    {/* Timeline Line */}
                    <div style={{
                      position: 'absolute',
                      left: '16px',
                      top: 0,
                      bottom: 0,
                      width: '2px',
                      background: '#e5e7eb'
                    }} />
                    
                    {timelineEntries
                      .filter(entry => showTimelineFilter === 'all' || 
                        (showTimelineFilter === 'client' && entry.isClientVisible) ||
                        (showTimelineFilter === 'internal' && !entry.isClientVisible))
                      .map(entry => (
                      <div key={entry.id} style={{ position: 'relative', paddingLeft: '40px', marginBottom: '20px' }}>
                        {/* Timeline Dot */}
                        <div style={{
                          position: 'absolute',
                          left: '8px',
                          top: '4px',
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: entry.type === 'status_change' ? '#3b82f6' :
                                     entry.type === 'client_notification' ? '#10b981' :
                                     entry.type === 'comment' ? '#f59e0b' : '#6b7280',
                          border: '3px solid #fff',
                          boxShadow: '0 0 0 1px #e5e7eb'
                        }} />
                        
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>{entry.title}</span>
                            {entry.isClientVisible && (
                              <span style={{
                                fontSize: '10px',
                                background: '#dcfce7',
                                color: '#166534',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 500
                              }}>
                                CLIENT VISIBLE
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '12px', color: '#666', margin: '0 0 4px 0' }}>
                            {entry.description}
                          </p>
                          <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                            {entry.user} • {new Date(entry.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Actions Panel */}
                  {isQuickActionMode && selectedIncident && (
                    <div style={{
                      marginTop: '24px',
                      padding: '16px',
                      background: '#f0f9ff',
                      borderRadius: '8px',
                      border: '2px solid #3b82f6'
                    }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#1e40af' }}>
                        ⚡ Quick Actions for {selectedIncident.type.toUpperCase()} Incident
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                        {getQuickActions(selectedIncident.type).map((action, index) => (
                          <button
                            key={index}
                            onClick={action.action}
                            style={{
                              padding: '8px 12px',
                              background: '#3b82f6',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <span>{action.label}</span>
                            {action.hotkey && (
                              <div style={{
                                background: 'rgba(255,255,255,0.2)',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 600
                              }}>
                                {action.hotkey}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#1e40af' }}>
                        💡 Press Q to toggle quick actions, then use the hotkeys above
                      </div>
                    </div>
                  )}

                  {/* Add Comment with @mentions and drag-drop */}
                  <div 
                    style={{
                      marginTop: '24px',
                      padding: '16px',
                      background: dragOverComment ? '#f0f9ff' : '#f9fafb',
                      borderRadius: '8px',
                      border: dragOverComment ? '2px dashed #3b82f6' : '1px solid #e5e7eb',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleFileDrop}
                  >
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                      Add Comment {dragOverComment && '📁 Drop files here!'}
                    </h4>
                    <div style={{ position: 'relative' }}>
                      <textarea
                        value={newComment}
                        onChange={(e) => {
                          setNewComment(e.target.value);
                          // Check for @mentions
                          const text = e.target.value;
                          const lastAtIndex = text.lastIndexOf('@');
                          if (lastAtIndex !== -1) {
                            const query = text.substring(lastAtIndex + 1);
                            if (query.length > 0 && !query.includes(' ')) {
                              setMentionQuery(query);
                              setShowMentions(true);
                            } else {
                              setShowMentions(false);
                            }
                          } else {
                            setShowMentions(false);
                          }
                        }}
                        placeholder="Add a comment to the timeline... Use @name to mention teammates"
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '12px',
                          resize: 'vertical'
                        }}
                      />
                      
                      {/* @mention dropdown */}
                      {showMentions && (
                        <div style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '8px',
                          right: '8px',
                          background: '#fff',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                          zIndex: 10,
                          maxHeight: '150px',
                          overflow: 'auto'
                        }}>
                          {teamMembers
                            .filter(member => member.name.toLowerCase().includes(mentionQuery.toLowerCase()))
                            .map(member => (
                              <div
                                key={member.id}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  fontSize: '12px',
                                  borderBottom: '1px solid #f3f4f6'
                                }}
                                onClick={() => {
                                  const atIndex = newComment.lastIndexOf('@');
                                  const beforeAt = newComment.substring(0, atIndex);
                                  const afterQuery = newComment.substring(atIndex + mentionQuery.length + 1);
                                  setNewComment(`${beforeAt}@${member.name} ${afterQuery}`);
                                  setShowMentions(false);
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: '#e5e7eb',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '8px',
                                  fontWeight: 500
                                }}>
                                  {member.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 500 }}>{member.name}</div>
                                  <div style={{ color: '#666', fontSize: '10px' }}>{member.role.replace('_', ' ')}</div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                          <input type="checkbox" />
                          Client visible
                        </label>
                        <span style={{ fontSize: '10px', color: '#666' }}>
                          💡 Type @ to mention teammates
                        </span>
                      </div>
                      <button 
                        onClick={() => {
                          if (newComment.trim()) {
                            // Mock add comment
                            const newTimelineEntry: TimelineEntry = {
                              id: `tl-${Date.now()}`,
                              timestamp: new Date().toISOString(),
                              type: 'comment',
                              user: currentUser.name,
                              title: 'Comment added',
                              description: newComment,
                              isClientVisible: false // Would be based on checkbox
                            };
                            setTimelineEntries(prev => [newTimelineEntry, ...prev]);
                            setNewComment('');
                          }
                        }}
                        disabled={!newComment.trim()}
                        style={{
                          padding: '6px 12px',
                          background: newComment.trim() ? '#3b82f6' : '#9ca3af',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                          fontSize: '12px',
                          fontWeight: 500
                        }}
                      >
                        Add Comment
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Files Tab */}
              {activeDetailTab === 'files' && (
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Files & Evidence</h3>
                    <button style={{
                      padding: '8px 16px',
                      background: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Upload size={14} />
                      Upload File
                    </button>
                  </div>

                  {/* Required Files Notice */}
                  {selectedIncident.type === 'damage' && (
                    <div style={{
                      padding: '12px',
                      background: '#fef3c7',
                      border: '1px solid #fde68a',
                      borderRadius: '6px',
                      marginBottom: '20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <AlertTriangle size={14} style={{ color: '#d97706' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#92400e' }}>
                          Required: Damage photos before claim
                        </span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#92400e', margin: 0 }}>
                        Upload clear photos of external and internal damage before proceeding with insurance claim.
                      </p>
                    </div>
                  )}

                  {/* File List */}
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {fileAttachments.map(file => (
                      <div key={file.id} style={{
                        padding: '12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        background: '#fff'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              background: file.type.startsWith('image/') ? '#fef3c7' : '#f3f4f6',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {file.type.startsWith('image/') ? 
                                <Image size={20} style={{ color: '#d97706' }} /> :
                                <FileText size={20} style={{ color: '#666' }} />
                              }
                            </div>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '2px' }}>
                                {file.name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#666' }}>
                                {(file.size / 1024 / 1024).toFixed(1)} MB • {file.uploadedBy} • {new Date(file.uploadedAt).toLocaleDateString()}
                              </div>
                              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                {file.tags.map(tag => (
                                  <span key={tag} style={{
                                    fontSize: '10px',
                                    background: '#f3f4f6',
                                    color: '#374151',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 500
                                  }}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button style={{
                              padding: '6px 8px',
                              background: '#f3f4f6',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px'
                            }}>
                              <Download size={12} />
                            </button>
                            <button style={{
                              padding: '6px 8px',
                              background: '#f3f4f6',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px'
                            }}>
                              <Eye size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Upload Zone */}
                  <div style={{
                    marginTop: '20px',
                    padding: '40px',
                    border: '2px dashed #d1d5db',
                    borderRadius: '8px',
                    textAlign: 'center',
                    background: '#fafafa'
                  }}>
                    <Upload size={32} style={{ color: '#9ca3af', marginBottom: '12px' }} />
                    <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                      Drag and drop files here, or click to browse
                    </p>
                    <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                      Supports: JPG, PNG, PDF, DOC (Max 10MB)
                    </p>
                  </div>
                </div>
              )}

              {/* People Tab */}
              {activeDetailTab === 'people' && (
                <div style={{ padding: '24px' }}>
                  {/* Owner Assignment */}
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Assigned Owner</h3>
                    <div style={{
                      padding: '16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      background: '#f9fafb'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: '#e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 500
                          }}>
                            {selectedIncident.assignee?.split(' ').map(n => n[0]).join('') || 'UN'}
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>
                              {selectedIncident.assignee || 'Unassigned'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {selectedIncident.assignee ? 'Operations Specialist' : 'No owner assigned'}
                            </div>
                          </div>
                        </div>
                        <button style={{
                          padding: '6px 12px',
                          background: '#fff',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}>
                          Change
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Watchers */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Watchers</h3>
                      <button style={{
                        padding: '6px 12px',
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <UserPlus size={12} />
                        Add Watcher
                      </button>
                    </div>
                    
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {watchers.map(watcher => (
                        <div key={watcher} style={{
                          padding: '8px 12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#e5e7eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 500
                            }}>
                              {watcher.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span style={{ fontSize: '12px' }}>{watcher}</span>
                          </div>
                          <button style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#666',
                            padding: '2px'
                          }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Communication Templates */}
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Client Communication</h3>
                    <div style={{
                      padding: '16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}>
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px', display: 'block' }}>
                          Template
                        </label>
                        <select
                          value={selectedTemplate}
                          onChange={(e) => setSelectedTemplate(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <option value="">Select template...</option>
                          {communicationTemplates
                            .filter(t => t.type === selectedIncident.type)
                            .map(template => (
                              <option key={template.id} value={template.id}>
                                {template.subject}
                              </option>
                            ))}
                        </select>
                      </div>
                      
                      {selectedTemplate && (
                        <div>
                          <div style={{ marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px', display: 'block' }}>
                              Subject
                            </label>
                            <input
                              type="text"
                              value={communicationTemplates.find(t => t.id === selectedTemplate)?.subject || ''}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}
                            />
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px', display: 'block' }}>
                              Message
                            </label>
                            <textarea
                              value={communicationTemplates.find(t => t.id === selectedTemplate)?.content || ''}
                              style={{
                                width: '100%',
                                minHeight: '80px',
                                padding: '8px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                fontSize: '12px',
                                resize: 'vertical'
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button style={{
                              padding: '8px 16px',
                              background: '#3b82f6',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Send size={12} />
                              Send to Client
                            </button>
                            <button style={{
                              padding: '8px 16px',
                              background: '#f3f4f6',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}>
                              Save Draft
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Actions Bar */}
            <div style={{ 
              borderTop: '1px solid #e5e7eb',
              padding: '16px 24px',
              background: '#fff'
            }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {selectedIncident.status !== 'resolved' ? (
                  <>
                    <button 
                      onClick={handleResolveIncident}
                      style={{
                        padding: '8px 16px',
                        background: canResolveIncident(selectedIncident).canResolve ? '#10b981' : '#9ca3af',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: canResolveIncident(selectedIncident).canResolve || currentUser.role === 'ops_admin' ? 'pointer' : 'not-allowed',
                        fontSize: '14px',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      disabled={!canResolveIncident(selectedIncident).canResolve && currentUser.role !== 'ops_admin'}
                    >
                      <CheckCircle size={14} />
                      Resolve
                    </button>
                    <button 
                      onClick={handleChangeStatus}
                      style={{
                        padding: '8px 16px',
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500
                      }}
                    >
                      Update Status
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={handleReopenIncident}
                    style={{
                      padding: '8px 16px',
                      background: '#f59e0b',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RotateCcw size={14} />
                    Reopen
                  </button>
                )}
                
                <button 
                  onClick={handleAssignIncident}
                  style={{
                    padding: '8px 16px',
                    background: '#fff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  <User size={14} style={{ marginRight: '4px' }} />
                  Assign
                </button>
                
                <button 
                  onClick={handleChangeSeverity}
                  style={{
                    padding: '8px 16px',
                    background: '#fff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  <Flag size={14} style={{ marginRight: '4px' }} />
                  Severity
                </button>
                
                <button 
                  onClick={() => setActiveDetailTab('timeline')}
                  style={{
                    padding: '8px 16px',
                    background: '#fff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  <MessageSquare size={14} style={{ marginRight: '4px' }} />
                  Comment
                </button>
                
                <button 
                  onClick={() => setActiveDetailTab('files')}
                  style={{
                    padding: '8px 16px',
                    background: '#fff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  <Paperclip size={14} style={{ marginRight: '4px' }} />
                  Attach
                </button>
              </div>
              
              {/* Validation warnings */}
              {selectedIncident.status !== 'resolved' && !canResolveIncident(selectedIncident).canResolve && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <AlertTriangle size={12} style={{ color: '#d97706' }} />
                    <span style={{ fontWeight: 600, color: '#92400e' }}>Cannot resolve yet</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '16px', color: '#92400e' }}>
                    {canResolveIncident(selectedIncident).reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {actionModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            {/* Create Incident Modal */}
            {actionModal.type === 'create' && (
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Create New Incident</h2>
                
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                        Type *
                      </label>
                      <select
                        value={createForm.type}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, type: e.target.value as any }))}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      >
                        <option value="customs">Customs</option>
                        <option value="delay">Delay</option>
                        <option value="damage">Damage</option>
                        <option value="lost">Lost</option>
                        <option value="docs">Documents</option>
                        <option value="address">Address</option>
                        <option value="payment_hold">Payment Hold</option>
                      </select>
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                        Severity *
                      </label>
                      <select
                        value={createForm.severity}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, severity: e.target.value as any }))}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      >
                        <option value="S1">S1 - Critical</option>
                        <option value="S2">S2 - High</option>
                        <option value="S3">S3 - Medium</option>
                        <option value="S4">S4 - Low</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                      Title *
                    </label>
                    <input
                      type="text"
                      value={createForm.title}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Brief description of the incident"
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                      Description *
                    </label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Detailed description of what happened"
                      style={{
                        width: '100%',
                        minHeight: '80px',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                        Shipment ID *
                      </label>
                      <input
                        type="text"
                        value={createForm.shipmentId}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, shipmentId: e.target.value }))}
                        placeholder="SH-20240115-001"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                        Leg *
                      </label>
                      <select
                        value={createForm.leg}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, leg: e.target.value as any }))}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      >
                        <option value="sender_to_hub">Sender → Hub</option>
                        <option value="hub_to_buyer">Hub → Buyer</option>
                        <option value="wg_internal">WG Internal</option>
                      </select>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                        Client Name *
                      </label>
                      <input
                        type="text"
                        value={createForm.clientName}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, clientName: e.target.value }))}
                        placeholder="Client company/person"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                        Contact Name *
                      </label>
                      <input
                        type="text"
                        value={createForm.contactName}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, contactName: e.target.value }))}
                        placeholder="Primary contact person"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                      Assign to
                    </label>
                    <select
                      value={createForm.assignee}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, assignee: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map(member => (
                        <option key={member.id} value={member.name}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setActionModal({ type: null, isOpen: false })}
                    style={{
                      padding: '8px 16px',
                      background: '#fff',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitCreateIncident}
                    disabled={!createForm.title || !createForm.description || !createForm.shipmentId || !createForm.clientName || !createForm.contactName}
                    style={{
                      padding: '8px 16px',
                      background: createForm.title && createForm.description && createForm.shipmentId && createForm.clientName && createForm.contactName ? '#3b82f6' : '#9ca3af',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: createForm.title && createForm.description && createForm.shipmentId && createForm.clientName && createForm.contactName ? 'pointer' : 'not-allowed',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    Create Incident
                  </button>
                </div>
              </div>
            )}

            {/* Resolve Modal */}
            {actionModal.type === 'resolve' && (
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Resolve Incident</h2>
                
                {!actionModal.data?.canResolve && currentUser.role !== 'ops_admin' && (
                  <div style={{
                    padding: '12px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <AlertTriangle size={16} style={{ color: '#dc2626' }} />
                      <span style={{ fontWeight: 600, color: '#dc2626' }}>Cannot resolve - requirements not met</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#dc2626', fontSize: '14px' }}>
                      {actionModal.data?.reasons?.map((reason: string, index: number) => (
                        <li key={index}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {currentUser.role === 'ops_admin' && !actionModal.data?.canResolve && (
                  <div style={{
                    padding: '12px',
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
                      <span style={{ fontWeight: 600, color: '#92400e' }}>Admin Override</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#92400e', margin: 0 }}>
                      You can resolve this incident as Ops Admin despite unmet requirements.
                    </p>
                  </div>
                )}
                
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                      Resolution Reason *
                    </label>
                    <textarea
                      value={resolutionForm.reason}
                      onChange={(e) => setResolutionForm(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Explain how the incident was resolved..."
                      style={{
                        width: '100%',
                        minHeight: '80px',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  
                  {resolutionForm.requiresPostMortem && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                        Post-Mortem (Required for Tier 2/3) *
                      </label>
                      <textarea
                        value={resolutionForm.postMortem}
                        onChange={(e) => setResolutionForm(prev => ({ ...prev, postMortem: e.target.value }))}
                        placeholder="What went wrong? Root cause analysis and prevention measures..."
                        style={{
                          width: '100%',
                          minHeight: '100px',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                  )}
                  
                  {resolutionForm.preventPassportActivation && (
                    <div style={{
                      padding: '12px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <AlertOctagon size={16} style={{ color: '#dc2626' }} />
                        <span style={{ fontWeight: 600, color: '#dc2626' }}>Passport Impact</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#dc2626', margin: '0 0 8px 0' }}>
                        This Tier 3 {actionModal.data?.incident?.type} incident will auto-flag to hold Passport activation until resolved.
                      </p>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#dc2626' }}>
                        <input
                          type="checkbox"
                          checked={!!resolutionForm.overrideReason}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setResolutionForm(prev => ({ ...prev, overrideReason: '' }));
                            } else {
                              setResolutionForm(prev => ({ ...prev, overrideReason: undefined }));
                            }
                          }}
                        />
                        Override passport hold (Ops Admin only)
                      </label>
                      {resolutionForm.overrideReason !== undefined && (
                        <textarea
                          value={resolutionForm.overrideReason}
                          onChange={(e) => setResolutionForm(prev => ({ ...prev, overrideReason: e.target.value }))}
                          placeholder="Reason for overriding passport hold..."
                          style={{
                            width: '100%',
                            minHeight: '60px',
                            padding: '8px',
                            border: '1px solid #dc2626',
                            borderRadius: '4px',
                            fontSize: '12px',
                            marginTop: '8px',
                            resize: 'vertical'
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setActionModal({ type: null, isOpen: false })}
                    style={{
                      padding: '8px 16px',
                      background: '#fff',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitResolution}
                    disabled={
                      !resolutionForm.reason || 
                      (resolutionForm.requiresPostMortem && !resolutionForm.postMortem) ||
                      (resolutionForm.overrideReason !== undefined && !resolutionForm.overrideReason) ||
                      (!actionModal.data?.canResolve && currentUser.role !== 'ops_admin')
                    }
                    style={{
                      padding: '8px 16px',
                      background: resolutionForm.reason && (!resolutionForm.requiresPostMortem || resolutionForm.postMortem) && (resolutionForm.overrideReason === undefined || resolutionForm.overrideReason) && (actionModal.data?.canResolve || currentUser.role === 'ops_admin') ? '#10b981' : '#9ca3af',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: resolutionForm.reason && (!resolutionForm.requiresPostMortem || resolutionForm.postMortem) && (resolutionForm.overrideReason === undefined || resolutionForm.overrideReason) && (actionModal.data?.canResolve || currentUser.role === 'ops_admin') ? 'pointer' : 'not-allowed',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    Resolve Incident
                  </button>
                </div>
              </div>
            )}

            {/* Simple modals for other actions */}
            {(actionModal.type === 'assign' || actionModal.type === 'severity' || actionModal.type === 'status' || actionModal.type === 'reopen') && (
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>
                  {actionModal.type === 'assign' && 'Assign Incident'}
                  {actionModal.type === 'severity' && 'Change Severity'}
                  {actionModal.type === 'status' && 'Update Status'}
                  {actionModal.type === 'reopen' && 'Reopen Incident'}
                </h2>
                
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                  This action would be implemented with the appropriate form fields and backend integration.
                </p>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setActionModal({ type: null, isOpen: false })}
                    style={{
                      padding: '8px 16px',
                      background: '#fff',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      console.log(`${actionModal.type} action executed`);
                      setActionModal({ type: null, isOpen: false });
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help Overlay */}
      {showKeyboardHelp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>⌨️ Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                  🎯 Global Actions
                </h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>New Incident</span>
                    <kbd style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      ⌘N
                    </kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>Show/Hide Help</span>
                    <kbd style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      ?
                    </kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>Close Modal/Panel</span>
                    <kbd style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      Esc
                    </kbd>
                  </div>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#1f2937' }}>
                  ⚡ Quick Actions (when Q mode active)
                </h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    <strong>Delay Incidents:</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px' }}>🚀 Upgrade to Express</span>
                    <kbd style={{ background: '#f3f4f6', padding: '3px 6px', borderRadius: '3px', fontSize: '11px' }}>E</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px' }}>📅 Rebook WG Slot</span>
                    <kbd style={{ background: '#f3f4f6', padding: '3px 6px', borderRadius: '3px', fontSize: '11px' }}>R</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px' }}>📞 Notify Client</span>
                    <kbd style={{ background: '#f3f4f6', padding: '3px 6px', borderRadius: '3px', fontSize: '11px' }}>N</kbd>
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                  🎛️ Incident Actions
                </h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>Resolve Incident</span>
                    <kbd style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>R</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>Assign Owner</span>
                    <kbd style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>A</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>Change Severity</span>
                    <kbd style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>S</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>Add Comment</span>
                    <kbd style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>C</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>Attach Files</span>
                    <kbd style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>F</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>Toggle Quick Actions</span>
                    <kbd style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Q</kbd>
                  </div>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#1f2937' }}>
                  🎯 Pro Tips
                </h3>
                <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
                  • <strong>30-second workflow:</strong> ⌘N → Fill form → Assign → Q → Quick action<br/>
                  • <strong>Drag files:</strong> Drop directly onto comment area<br/>
                  • <strong>@mention:</strong> Type @ in comments for team notifications<br/>
                  • <strong>One-click access:</strong> All critical data buttons in header
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #3b82f6'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e40af', marginBottom: '8px' }}>
                🚀 Speed Challenge: Create + Assign + Act in &lt; 30 seconds
              </div>
              <div style={{ fontSize: '12px', color: '#1e40af' }}>
                1. Press <kbd style={{ background: 'rgba(255,255,255,0.8)', padding: '2px 4px', borderRadius: '2px' }}>⌘N</kbd> → 
                2. Quick-fill form → 
                3. Assign owner → 
                4. Press <kbd style={{ background: 'rgba(255,255,255,0.8)', padding: '2px 4px', borderRadius: '2px' }}>Q</kbd> → 
                5. Execute quick action with hotkey
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default IncidentsPage;