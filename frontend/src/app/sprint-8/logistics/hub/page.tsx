'use client';

import React, { useState, useEffect } from 'react';
import { hubConsoleApi, type HubJob, type HubFilters } from '@/lib/hubConsoleApi';
import Link from 'next/link';
import { 
  ChevronRight, Building2, Search, Filter, Package, Truck, Clock, CheckCircle, 
  AlertTriangle, Eye, Edit, X, Calendar, DollarSign, MapPin, User, Shield,
  Camera, Smartphone, Tag, FileCheck, ChevronDown, MoreHorizontal, Users,
  AlertCircle, ExternalLink, Zap, Hash, TrendingUp, Settings, Upload, 
  ScanLine, Lock, RotateCcw, Save, AlertOctagon, FileImage, Plus, Trash2
} from 'lucide-react';

// Using HubJob from API instead of local Job interface

interface IntakeForm {
  otp: string;
  sealId: string;
  sealPhoto: File | null;
  photos360: File[];
  conditionNotes: string;
  hasDamage: boolean;
  damageDescription: string;
  packageBarcode?: string;
  technicianId: string;
  timestamp: string;
}

interface IncidentModal {
  isOpen: boolean;
  type: 'damage' | 'security' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ProcessingChecklist {
  // Identity/Visual Auth (both tiers)
  visualAuthCompleted: boolean;
  photoComparison: File | null;
  serialVerification: boolean;
  authPhotos: File[];
  
  // Tier 2 - Tag Application
  tagIdConfirmed: boolean;
  reservedTagId?: string;
  tagApplied: boolean;
  tagPlacementPhoto: File | null;
  tagScanTest: boolean;
  tagAppliedFinal: boolean;
  
  // Tier 3 - NFC Installation
  nfcUidConfirmed: boolean;
  reservedNfcUid?: string;
  sewingIntegrity: boolean;
  nfcReadTest: boolean;
  nfcWriteTest: boolean;
  nfcTestScreenshot: File | null;
  nfcInstalledFinal: boolean;
  
  // Evidence tracking
  evidenceGallery: {
    missing: string[];
    completed: string[];
  };
}

interface AssignmentModal {
  isOpen: boolean;
  type: 'tag' | 'nfc';
  reason: string;
  newUnitId: string;
  requiresOpsApproval: boolean;
}

interface QAValidation {
  // QA Personnel
  qaPersonnelId: string;
  qaPersonnelName: string;
  
  // Tier 2 QA (Optional)
  tier2VisualCheck: boolean;
  tier2TagPlacementApproved: boolean;
  tier2Notes: string;
  
  // Tier 3 QA (Mandatory) 
  tier3AuthPhotosReviewed: boolean;
  tier3SewingQualityApproved: boolean;
  tier3NfcLogsReviewed: boolean;
  tier3SecondPersonConfirmed: boolean;
  tier3Notes: string;
  
  // QA Results
  qaStatus: 'pending' | 'passed' | 'failed' | 'rework_required';
  qaCompletedAt?: string;
  reworkReason?: string;
  reworkInstructions?: string;
}

interface ReworkModal {
  isOpen: boolean;
  reason: string;
  instructions: string;
  severity: 'minor' | 'major' | 'critical';
}

interface OutboundPreparation {
  // Route Information
  plannedMode: 'WG' | 'DHL';
  
  // WG Outbound
  wgIntakeSlot?: string;
  wgDeliverySlot?: string;
  wgOperatorBrief?: File | null;
  wgOperatorBriefGenerated: boolean;
  
  // DHL Outbound  
  dhlLabelConfirmed: boolean;
  dhlLabelUrl?: string;
  dhlTrackingNumber?: string;
  
  // Outbound Sealing
  outboundSealRequired: boolean;
  outboundSealId?: string;
  outboundSealPhoto: File | null;
  
  // Final Documentation
  finalPhotos: File[];
  finalPhotosTaken: boolean;
  
  // Completion Status
  hubJobCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
}

interface CompletionModal {
  isOpen: boolean;
  finalNotes: string;
  confirmCompletion: boolean;
}

interface EvidenceFile {
  file: File;
  hash: string;
  timestamp: string;
  actorId: string;
  type: 'intake_seal' | 'intake_360' | 'auth_photo' | 'tag_placement' | 'nfc_test' | 'final_photo' | 'outbound_seal';
  url?: string;
  validated: boolean;
  size: number;
  mimeType: string;
}

interface PhotoValidation {
  minFiles: number;
  maxFiles: number;
  maxSize: number; // bytes
  allowedTypes: string[];
  requireTimestamp: boolean;
}

interface EdgeCaseHandling {
  damageOnArrival: {
    isOpen: boolean;
    damageType: 'physical' | 'packaging' | 'missing_items' | 'other';
    severity: 'minor' | 'major' | 'critical';
    description: string;
    photos: File[];
    incidentId: string;
    pausedAt: string;
    pausedBy: string;
  };
  inventorySwap: {
    isOpen: boolean;
    itemType: 'tag' | 'nfc';
    originalId: string;
    newId: string;
    reason: string;
    opsApproval: boolean;
    swapRequestedBy: string;
    swapRequestedAt: string;
  };
  nfcFailure: {
    isOpen: boolean;
    failedUid: string;
    failureType: 'read' | 'write' | 'both';
    rmaInitiated: boolean;
    newUid: string;
    retestRequired: boolean;
    failureCount: number;
  };
  capacityWarning: {
    isOpen: boolean;
    currentLoad: number;
    dailyCapacity: number;
    projectedOverage: number;
    affectedJobs: string[];
    reprioritizationSuggested: boolean;
  };
  photoUploadFailure: {
    isOpen: boolean;
    failedFiles: File[];
    retryCount: number;
    lastError: string;
    uploadType: EvidenceFile['type'];
  };
  customsDocumentation: {
    isOpen: boolean;
    missingDocs: string[];
    customsReturn: boolean;
    destinationCountry: string;
    requiredForms: string[];
  };
}

interface TelemetryData {
  intakeStartTime?: number;
  intakeCompleteTime?: number;
  checklistStartTime?: number;
  checklistCompleteTime?: number;
  qaStartTime?: number;
  qaCompleteTime?: number;
  photoUploadAttempts: number;
  nfcTestAttempts: number;
  completionBlockedCount: number;
  sessionId: string;
}

export default function HubConsolePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHub, setSelectedHub] = useState('19'); // Default to Montaigne Experts
  const [filterTier, setFilterTier] = useState('both');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterWhen, setFilterWhen] = useState('today');
  const [filterPriority, setFilterPriority] = useState('all');
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<HubJob | null>(null);
  const [jobs, setJobs] = useState<HubJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hubs, setHubs] = useState<Array<{ id: number; hub_code: string; hub_name: string }>>([]);
  const [selectedHubDetails, setSelectedHubDetails] = useState<any>(null);
  const [loadingHubDetails, setLoadingHubDetails] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // Intake workflow state
  const [activeTab, setActiveTab] = useState<'overview' | 'intake' | 'processing' | 'qa' | 'outbound'>('overview');
  const [intakeForm, setIntakeForm] = useState<IntakeForm>({
    otp: '',
    sealId: '',
    sealPhoto: null,
    photos360: [],
    conditionNotes: '',
    hasDamage: false,
    damageDescription: '',
    packageBarcode: '',
    technicianId: 'current_user_id',
    timestamp: new Date().toISOString()
  });
  const [incidentModal, setIncidentModal] = useState<IncidentModal>({
    isOpen: false,
    type: 'damage',
    description: '',
    severity: 'medium'
  });
  const [isProcessingIntake, setIsProcessingIntake] = useState(false);
  
  // Processing workflow state
  const [processingChecklist, setProcessingChecklist] = useState<ProcessingChecklist>({
    // Identity/Visual Auth
    visualAuthCompleted: false,
    photoComparison: null,
    serialVerification: false,
    authPhotos: [],
    
    // Tier 2 - Tag
    tagIdConfirmed: false,
    reservedTagId: undefined,
    tagApplied: false,
    tagPlacementPhoto: null,
    tagScanTest: false,
    tagAppliedFinal: false,
    
    // Tier 3 - NFC
    nfcUidConfirmed: false,
    reservedNfcUid: undefined,
    sewingIntegrity: false,
    nfcReadTest: false,
    nfcWriteTest: false,
    nfcTestScreenshot: null,
    nfcInstalledFinal: false,
    
    // Evidence
    evidenceGallery: {
      missing: [],
      completed: []
    }
  });
  
  const [assignmentModal, setAssignmentModal] = useState<AssignmentModal>({
    isOpen: false,
    type: 'tag',
    reason: '',
    newUnitId: '',
    requiresOpsApproval: false
  });
  
  const [isProcessingChecklist, setIsProcessingChecklist] = useState(false);
  
  // QA workflow state
  const [qaValidation, setQAValidation] = useState<QAValidation>({
    qaPersonnelId: '',
    qaPersonnelName: '',
    tier2VisualCheck: false,
    tier2TagPlacementApproved: false,
    tier2Notes: '',
    tier3AuthPhotosReviewed: false,
    tier3SewingQualityApproved: false,
    tier3NfcLogsReviewed: false,
    tier3SecondPersonConfirmed: false,
    tier3Notes: '',
    qaStatus: 'pending',
    qaCompletedAt: undefined,
    reworkReason: undefined,
    reworkInstructions: undefined
  });
  
  const [reworkModal, setReworkModal] = useState<ReworkModal>({
    isOpen: false,
    reason: '',
    instructions: '',
    severity: 'minor'
  });
  
  const [isProcessingQA, setIsProcessingQA] = useState(false);
  
  // Outbound workflow state
  const [outboundPreparation, setOutboundPreparation] = useState<OutboundPreparation>({
    plannedMode: 'WG',
    wgOperatorBriefGenerated: false,
    dhlLabelConfirmed: false,
    outboundSealRequired: true,
    outboundSealPhoto: null,
    finalPhotos: [],
    finalPhotosTaken: false,
    hubJobCompleted: false
  });
  
  const [completionModal, setCompletionModal] = useState<CompletionModal>({
    isOpen: false,
    finalNotes: '',
    confirmCompletion: false
  });
  
  const [isProcessingOutbound, setIsProcessingOutbound] = useState(false);
  
  // Evidence management state
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [edgeCases, setEdgeCases] = useState<EdgeCaseHandling>({
    damageOnArrival: {
      isOpen: false,
      damageType: 'physical',
      severity: 'minor',
      description: '',
      photos: [],
      incidentId: '',
      pausedAt: '',
      pausedBy: ''
    },
    inventorySwap: {
      isOpen: false,
      itemType: 'tag',
      originalId: '',
      newId: '',
      reason: '',
      opsApproval: false,
      swapRequestedBy: '',
      swapRequestedAt: ''
    },
    nfcFailure: {
      isOpen: false,
      failedUid: '',
      failureType: 'read',
      rmaInitiated: false,
      newUid: '',
      retestRequired: false,
      failureCount: 0
    },
    capacityWarning: {
      isOpen: false,
      currentLoad: 0,
      dailyCapacity: 50,
      projectedOverage: 0,
      affectedJobs: [],
      reprioritizationSuggested: false
    },
    photoUploadFailure: {
      isOpen: false,
      failedFiles: [],
      retryCount: 0,
      lastError: '',
      uploadType: 'intake_seal'
    },
    customsDocumentation: {
      isOpen: false,
      missingDocs: [],
      customsReturn: false,
      destinationCountry: '',
      requiredForms: []
    }
  });
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    photoUploadAttempts: 0,
    nfcTestAttempts: 0,
    completionBlockedCount: 0,
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2)}`
  });
  const [photoValidationRules] = useState<Record<string, PhotoValidation>>({
    intake_360: {
      minFiles: 4,
      maxFiles: 12,
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      requireTimestamp: true
    },
    intake_seal: {
      minFiles: 1,
      maxFiles: 1,
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      requireTimestamp: true
    },
    auth_photo: {
      minFiles: 1,
      maxFiles: 8,
      maxSize: 8 * 1024 * 1024, // 8MB
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      requireTimestamp: true
    },
    tag_placement: {
      minFiles: 1,
      maxFiles: 1,
      maxSize: 8 * 1024 * 1024, // 8MB
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      requireTimestamp: true
    },
    nfc_test: {
      minFiles: 1,
      maxFiles: 1,
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      requireTimestamp: true
    },
    final_photo: {
      minFiles: 1,
      maxFiles: 6,
      maxSize: 8 * 1024 * 1024, // 8MB
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      requireTimestamp: true
    },
    outbound_seal: {
      minFiles: 1,
      maxFiles: 1,
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      requireTimestamp: true
    }
  });

  const mockJobs: HubJob[] = [
    {
      id: 1,
      shipment_id: 'SH-2024-001',
      hub_id: 1,
      tier: 2,
      product_category: 'luxury_watches',
      declared_value: 15000,
      value: 15000,
      status: 'in_progress',
      planned_intake_time: '2024-01-15 09:00',
      sla_deadline: '2024-01-17 17:00',
      priority: 'high',
      created_at: '2024-01-15T06:00:00Z',
      hub_name: 'London Hub',
      hub_code: 'LHR01',
      reference_sku: 'ROL-SUB-001',
      brand: 'Rolex',
      category: 'watches',
      weight: 0.5,
      sender_name: 'Marie Dubois',
      buyer_name: 'James Wilson',
      reserved_tag_id: 'TAG-001-001',
      reserved_nfc_uid: 'NFC-001-001',
      brandModel: 'Rolex Submariner',
      outboundType: 'WG',
      qaNeeded: true,
      assignedTechnician: 'Sophie Martin',
      isOverdue: false,
      hoursOverdue: 0,
      evidenceStatus: { photo: true, otp: true, seal: false },
      checklistProgress: 75
    },
    {
      id: 2,
      shipment_id: 'SH-2024-002',
      hub_id: 1,
      tier: 3,
      product_category: 'luxury_watches',
      declared_value: 45000,
      value: 45000,
      status: 'awaiting_intake',
      planned_intake_time: '2024-01-15 08:30',
      sla_deadline: '2024-01-16 16:00',
      priority: 'critical',
      created_at: '2024-01-15T05:30:00Z',
      hub_name: 'London Hub',
      hub_code: 'LHR01',
      reference_sku: 'PAT-CAL-002',
      brand: 'Patek Philippe',
      category: 'watches',
      weight: 0.4,
      sender_name: 'Jean-Pierre Blanc',
      buyer_name: 'Anna Schmidt',
      reserved_tag_id: 'TAG-002-001',
      reserved_nfc_uid: 'NFC-002-001',
      brandModel: 'Patek Philippe Calatrava',
      outboundType: 'DHL',
      qaNeeded: false,
      assignedTechnician: undefined,
      isOverdue: true,
      hoursOverdue: 4,
      evidenceStatus: { photo: false, otp: false, seal: false },
      checklistProgress: 0
    },
    {
      id: 3,
      shipment_id: 'SH-2024-003',
      hub_id: 1,
      product_category: 'luxury_watches',
      declared_value: 8500,
      created_at: '2024-01-15T11:00:00Z',
      hub_name: 'London Hub',
      hub_code: 'LHR01',
      reference_sku: 'OME-SPE-003',
      brand: 'Omega',
      category: 'watches',
      weight: 0.3,
      reserved_tag_id: 'TAG-003-001',
      reserved_nfc_uid: 'NFC-003-001',
      hoursOverdue: 0,
      tier: 2,
      value: 8500,
      planned_intake_time: '2024-01-15 14:00',
      sla_deadline: '2024-01-18 12:00',
      outboundType: 'WG',
      evidenceStatus: { photo: true, otp: true, seal: true },
      checklistProgress: 100,
      qaNeeded: true,
      status: 'waiting_qa',
      brandModel: 'Omega Speedmaster',
      sender_name: 'Carlos Rodriguez',
      buyer_name: 'Emily Chen',
      priority: 'normal',
      assignedTechnician: 'Thomas Petit',
      isOverdue: false
    },
    {
      id: 4,
      shipment_id: 'SH-2024-004',
      hub_id: 1,
      product_category: 'luxury_watches',
      declared_value: 75000,
      created_at: '2024-01-15T08:00:00Z',
      hub_name: 'London Hub',
      hub_code: 'LHR01',
      reference_sku: 'CAR-SAN-004',
      brand: 'Cartier',
      category: 'watches',
      weight: 0.6,
      reserved_tag_id: 'TAG-004-001',
      reserved_nfc_uid: 'NFC-004-001',
      hoursOverdue: 0,
      tier: 3,
      value: 78000,
      planned_intake_time: '2024-01-15 11:00',
      sla_deadline: '2024-01-17 14:00',
      outboundType: 'DHL',
      evidenceStatus: { photo: true, otp: true, seal: true },
      checklistProgress: 90,
      qaNeeded: false,
      status: 'ready_outbound',
      brandModel: 'Audemars Piguet Royal Oak',
      sender_name: 'Victoria Laurent',
      buyer_name: 'Michael Zhang',
      priority: 'high',
      assignedTechnician: 'Claire Moreau',
      isOverdue: false
    },
    {
      id: 5,
      shipment_id: 'SH-2024-005',
      hub_id: 1,
      product_category: 'luxury_watches',
      declared_value: 3500,
      created_at: '2024-01-14T13:00:00Z',
      hub_name: 'London Hub',
      hub_code: 'LHR01',
      reference_sku: 'TAG-FOR-005',
      brand: 'TAG Heuer',
      category: 'watches',
      weight: 0.2,
      reserved_tag_id: 'TAG-005-001',
      reserved_nfc_uid: 'NFC-005-001',
      tier: 2,
      value: 12000,
      planned_intake_time: '2024-01-14 16:00',
      sla_deadline: '2024-01-16 18:00',
      outboundType: 'WG',
      evidenceStatus: { photo: true, otp: false, seal: false },
      checklistProgress: 45,
      qaNeeded: true,
      status: 'overdue',
      brandModel: 'Tag Heuer Carrera',
      sender_name: 'Alessandro Rossi',
      buyer_name: 'Sarah Johnson',
      priority: 'critical',
      isOverdue: true,
      hoursOverdue: 18
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'awaiting_intake': return 'text-blue-700 bg-blue-100 border-blue-200';
      case 'in_progress': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'waiting_qa': return 'text-purple-700 bg-purple-100 border-purple-200';
      case 'ready_outbound': return 'text-green-700 bg-green-100 border-green-200';
      case 'overdue': return 'text-red-700 bg-red-100 border-red-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'awaiting_intake': return <Package className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'waiting_qa': return <CheckCircle className="h-4 w-4" />;
      case 'ready_outbound': return <Truck className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'normal': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return {
      date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
      time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    };
  };

  const getEvidenceStatus = (evidence: HubJob['evidenceStatus']) => {
    const completed = Object.values(evidence).filter(Boolean).length;
    const total = Object.keys(evidence).length;
    return `${completed}/${total}`;
  };

  // Jobs are already filtered by the API based on current filters
  const filteredJobs = jobs;


  // Sort: Overdue first, then by planned intake time
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.isOverdue && b.isOverdue) {
      return (b.hoursOverdue || 0) - (a.hoursOverdue || 0);
    }
    return new Date(a.planned_intake_time).getTime() - new Date(b.planned_intake_time).getTime();
  });

  const toggleJobSelection = (shipmentId: string) => {
    setSelectedJobs(prev => 
      prev.includes(shipmentId) 
        ? prev.filter(id => id !== shipmentId)
        : [...prev, shipmentId]
    );
  };

  const handleRowClick = (job: HubJob) => {
    setSelectedJob(job);
  };

  const todayJobs = filteredJobs.filter(job => {
    const today = new Date();
    const jobDate = new Date(job.planned_intake_time);
    return jobDate.toDateString() === today.toDateString();
  }).length;

  const overdueJobs = filteredJobs.filter(job => job.isOverdue).length;

  // Mock OTP validation - in real app would validate against backend
  const validateOTP = (otp: string, shipmentId: string): boolean => {
    // Mock validation logic
    return otp.length === 6 && /^\d{6}$/.test(otp);
  };

  const isIntakeFormValid = (): boolean => {
    const hasValidOTP = validateOTP(intakeForm.otp, selectedJob?.shipment_id || '');
    const hasSealId = intakeForm.sealId.trim().length > 0;
    const hasSealPhoto = intakeForm.sealPhoto !== null;
    const hasMinPhotos = intakeForm.photos360.length >= 4;
    const hasConditionNotes = intakeForm.conditionNotes.trim().length > 0;
    
    return hasValidOTP && hasSealId && hasSealPhoto && hasMinPhotos && hasConditionNotes;
  };

  const handleFileUpload = async (files: FileList | null, type: 'seal' | '360') => {
    if (!files) return;
    
    try {
      if (type === 'seal' && files.length > 0) {
        // Process evidence file with validation and hashing
        const evidenceFile = await processEvidenceFile(files[0], 'intake_seal');
        
        // Update evidence files state
        setEvidenceFiles(prev => [...prev.filter(f => f.type !== 'intake_seal'), evidenceFile]);
        
        // Update intake form
        setIntakeForm(prev => ({ ...prev, sealPhoto: files[0] }));
        
        console.log('Seal photo processed:', {
          hash: evidenceFile.hash,
          timestamp: evidenceFile.timestamp,
          size: evidenceFile.size
        });
      } else if (type === '360') {
        const newPhotos = Array.from(files);
        
        // Validate photo set first
        const totalPhotos = [...intakeForm.photos360, ...newPhotos];
        const validation = validatePhotoSet(totalPhotos, 'intake_360');
        if (!validation.valid) {
          alert(`Photo validation failed: ${validation.errors.join(', ')}`);
          return;
        }
        
        // Process each file
        const newEvidenceFiles: any[] = [];
        for (const file of newPhotos) {
          const evidenceFile = await processEvidenceFile(file, 'intake_360');
          newEvidenceFiles.push(evidenceFile);
        }
        
        // Update evidence files state
        setEvidenceFiles(prev => [...prev, ...newEvidenceFiles]);
        
        // Update intake form
        setIntakeForm(prev => ({ 
          ...prev, 
          photos360: [...prev.photos360, ...newPhotos].slice(0, 12) // Max 12 photos
        }));
        
        console.log(`${newPhotos.length} 360° photos processed with hashes and timestamps`);
      }
    } catch (error) {
      console.error('File upload failed:', error);
      alert(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const removePhoto = (index: number) => {
    setIntakeForm(prev => ({
      ...prev,
      photos360: prev.photos360.filter((_, i) => i !== index)
    }));
  };

  const handleIntakeSubmit = async () => {
    if (!selectedJob || !isIntakeFormValid()) return;
    
    if (intakeForm.hasDamage) {
      handleDamageOnArrival();
      return;
    }

    setIsProcessingIntake(true);
    
    try {
      // Mock API call to submit intake
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update job status
      // In real app, this would update the backend and refresh data
      console.log('Intake completed for:', selectedJob.shipment_id);
      console.log('Form data:', intakeForm);
      
              // Complete intake timer and emit enhanced intake completion event
        completeIntakeTimer();
        await emitHubIntakeDone(selectedJob.shipment_id);
        
        // Reset form and close modal
        setIntakeForm({
        otp: '',
        sealId: '',
        sealPhoto: null,
        photos360: [],
        conditionNotes: '',
        hasDamage: false,
        damageDescription: '',
        packageBarcode: '',
        technicianId: 'current_user_id',
        timestamp: new Date().toISOString()
      });
      setSelectedJob(null);
      setActiveTab('overview');
      
    } catch (error) {
      console.error('Intake submission failed:', error);
    } finally {
      setIsProcessingIntake(false);
    }
  };

  const handleIncidentReport = async () => {
    if (!selectedJob) return;
    
    try {
      // Mock incident creation
      console.log('Incident created:', {
        shipment_id: selectedJob.shipment_id,
        type: incidentModal.type,
        description: incidentModal.description,
        severity: incidentModal.severity,
        timestamp: new Date().toISOString()
      });
      
      setIncidentModal({ isOpen: false, type: 'damage', description: '', severity: 'medium' });
      
      // After incident is logged, can proceed with intake
      await handleIntakeSubmit();
      
    } catch (error) {
      console.error('Incident report failed:', error);
    }
  };

  // Processing workflow helpers
  const updateEvidenceGallery = () => {
    if (!selectedJob) return;
    
    const missing: string[] = [];
    const completed: string[] = [];
    
    // Identity/Visual Auth (both tiers)
    if (!processingChecklist.photoComparison) missing.push('Photo Comparison');
    else completed.push('Photo Comparison');
    
    if (!processingChecklist.serialVerification) missing.push('Serial Verification');
    else completed.push('Serial Verification');
    
    if (processingChecklist.authPhotos.length === 0) missing.push('Authentication Photos');
    else completed.push('Authentication Photos');
    
    if (selectedJob.tier === 2) {
      // Tier 2 specific
      if (!processingChecklist.tagIdConfirmed) missing.push('Tag ID Confirmation');
      else completed.push('Tag ID Confirmation');
      
      if (!processingChecklist.tagPlacementPhoto) missing.push('Tag Placement Photo');
      else completed.push('Tag Placement Photo');
      
    } else if (selectedJob.tier === 3) {
      // Tier 3 specific
      if (!processingChecklist.nfcUidConfirmed) missing.push('NFC UID Confirmation');
      else completed.push('NFC UID Confirmation');
      
      if (!processingChecklist.sewingIntegrity) missing.push('Sewing Integrity Check');
      else completed.push('Sewing Integrity Check');
      
      if (!processingChecklist.nfcTestScreenshot) missing.push('NFC Test Screenshot');
      else completed.push('NFC Test Screenshot');
    }
    
    setProcessingChecklist(prev => ({
      ...prev,
      evidenceGallery: { missing, completed }
    }));
  };

  const isProcessingChecklistValid = (): boolean => {
    if (!selectedJob) return false;
    
    // Common requirements
    const hasPhotoComparison = processingChecklist.photoComparison !== null;
    const hasSerialVerification = processingChecklist.serialVerification;
    const hasAuthPhotos = processingChecklist.authPhotos.length > 0;
    const baseValid = hasPhotoComparison && hasSerialVerification && hasAuthPhotos;
    
    if (selectedJob.tier === 2) {
      return baseValid && 
             processingChecklist.tagIdConfirmed && 
             processingChecklist.tagApplied && 
             processingChecklist.tagPlacementPhoto !== null;
    } else if (selectedJob.tier === 3) {
      return baseValid && 
             processingChecklist.nfcUidConfirmed && 
             processingChecklist.sewingIntegrity && 
             processingChecklist.nfcReadTest && 
             processingChecklist.nfcWriteTest && 
             processingChecklist.nfcTestScreenshot !== null;
    }
    
    return false;
  };

  const handleProcessingFileUpload = (files: FileList | null, type: 'photo_comparison' | 'auth_photos' | 'tag_placement' | 'nfc_test') => {
    if (!files) return;
    
    switch (type) {
      case 'photo_comparison':
        if (files.length > 0) {
          setProcessingChecklist(prev => ({ ...prev, photoComparison: files[0] }));
        }
        break;
      case 'auth_photos':
        const newAuthPhotos = Array.from(files);
        setProcessingChecklist(prev => ({ 
          ...prev, 
          authPhotos: [...prev.authPhotos, ...newAuthPhotos] 
        }));
        break;
      case 'tag_placement':
        if (files.length > 0) {
          setProcessingChecklist(prev => ({ ...prev, tagPlacementPhoto: files[0] }));
        }
        break;
      case 'nfc_test':
        if (files.length > 0) {
          setProcessingChecklist(prev => ({ ...prev, nfcTestScreenshot: files[0] }));
        }
        break;
    }
  };

  const removeAuthPhoto = (index: number) => {
    setProcessingChecklist(prev => ({
      ...prev,
      authPhotos: prev.authPhotos.filter((_, i) => i !== index)
    }));
  };

  const handleProcessingSubmit = async () => {
    if (!selectedJob || !isProcessingChecklistValid()) return;
    
    setIsProcessingChecklist(true);
    
    try {
      // Mock API call to complete processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const isTagApplied = selectedJob.tier === 2 && processingChecklist.tagAppliedFinal;
      const isNfcInstalled = selectedJob.tier === 3 && processingChecklist.nfcInstalledFinal;
      
              console.log('Processing completed for:', selectedJob.shipment_id);
        console.log('Checklist data:', processingChecklist);
        
        // Complete checklist timer
        completeChecklistTimer();
        
        // Inventory integrity checks and updates
      if (isTagApplied) {
        const tagId = processingChecklist.reservedTagId!;
        
        // Validate reserved item
        if (!validateReservedItem('tag', tagId)) {
          throw new Error('Tag ID mismatch - not the reserved item');
        }
        
        // Update inventory status: assigned → applied
        await updateInventoryStatus('tag', tagId, selectedJob.shipment_id);
        
        // Emit enhanced tag applied event
        await emitTagApplied(selectedJob.shipment_id, tagId);
        console.log(`Tag ${tagId} inventory status updated to 'applied'`);
      }
      
      if (isNfcInstalled) {
        const nfcUid = processingChecklist.reservedNfcUid!;
        
        // Validate reserved item
        if (!validateReservedItem('nfc', nfcUid)) {
          throw new Error('NFC UID mismatch - not the reserved item');
        }
        
        // Check if NFC tests passed
        if (!processingChecklist.nfcReadTest || !processingChecklist.nfcWriteTest) {
          // Initiate RMA flow for failed NFC
          const failureReason = `Read test: ${processingChecklist.nfcReadTest ? 'PASS' : 'FAIL'}, Write test: ${processingChecklist.nfcWriteTest ? 'PASS' : 'FAIL'}`;
          await initiateRMAFlow(nfcUid, failureReason);
          
          throw new Error('NFC tests failed - RMA flow initiated');
        }
        
        // Update inventory status: assigned → installed
        await updateInventoryStatus('nfc', nfcUid, selectedJob.shipment_id);
        
        // Emit enhanced NFC installed event
        await emitNfcInstalled(selectedJob.shipment_id, nfcUid);
        console.log(`NFC ${nfcUid} inventory status updated to 'installed'`);
      }
      
      // Move to QA tab only if access is allowed
      if (canAccessQA()) {
        setActiveTab('qa');
      } else {
        console.warn('QA access blocked - processing requirements not met');
        alert('Cannot proceed to QA - ensure all processing requirements are completed');
      }
      
    } catch (error) {
      console.error('Processing submission failed:', error);
      // Show error to user in real implementation
      alert(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingChecklist(false);
    }
  };

  const handleAssignDifferentUnit = async () => {
    if (!selectedJob) return;
    
    try {
      const oldItemId = assignmentModal.type === 'tag' ? processingChecklist.reservedTagId : processingChecklist.reservedNfcUid;
      
      // Log inventory change to TierDecision/Inventory history
      await logInventoryChange({
        type: assignmentModal.type,
        oldItemId: oldItemId,
        newItemId: assignmentModal.newUnitId,
        reason: assignmentModal.reason,
        shipmentId: selectedJob.shipment_id,
        changedBy: 'current_user_id'
      });
      
      console.log('Unit assignment change:', {
        shipment_id: selectedJob.shipment_id,
        type: assignmentModal.type,
        oldUnit: oldItemId,
        newUnit: assignmentModal.newUnitId,
        reason: assignmentModal.reason,
        requiresOpsApproval: assignmentModal.requiresOpsApproval,
        timestamp: new Date().toISOString()
      });
      
      // Update the reserved unit
      if (assignmentModal.type === 'tag') {
        setProcessingChecklist(prev => ({
          ...prev,
          reservedTagId: assignmentModal.newUnitId,
          tagIdConfirmed: false // Reset confirmation since unit changed
        }));
      } else {
        setProcessingChecklist(prev => ({
          ...prev,
          reservedNfcUid: assignmentModal.newUnitId,
          nfcUidConfirmed: false // Reset confirmation since unit changed
        }));
      }
      
      setAssignmentModal({
        isOpen: false,
        type: 'tag',
        reason: '',
        newUnitId: '',
        requiresOpsApproval: false
      });
      
    } catch (error) {
      console.error('Unit assignment failed:', error);
      alert(`Unit assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Initialize reserved units when job is selected
  useEffect(() => {
    if (selectedJob) {
      // Mock reserved unit lookup
      const mockReservedTag = `TAG-${selectedJob.shipment_id.slice(-3)}-001`;
      const mockReservedNfc = `NFC-${selectedJob.shipment_id.slice(-3)}-001`;
      
      setProcessingChecklist(prev => ({
        ...prev,
        reservedTagId: selectedJob.tier === 2 ? mockReservedTag : undefined,
        reservedNfcUid: selectedJob.tier === 3 ? mockReservedNfc : undefined
      }));
    }
  }, [selectedJob]);

  // Update evidence gallery when checklist changes
  useEffect(() => {
    updateEvidenceGallery();
  }, [processingChecklist, selectedJob]);

  // QA workflow helpers
  const isQARequired = (): boolean => {
    if (!selectedJob) return false;
    // Tier 3 always requires QA, Tier 2 is configurable (defaulting to optional)
    return selectedJob.tier === 3;
  };

  const isQAFormValid = (): boolean => {
    if (!selectedJob) return false;
    
    // Check QA personnel is assigned
    if (!qaValidation.qaPersonnelId || !qaValidation.qaPersonnelName) return false;
    
    if (selectedJob.tier === 2) {
      // Tier 2: Optional QA but if started, must complete visual check
      return qaValidation.tier2VisualCheck && qaValidation.tier2TagPlacementApproved;
    } else if (selectedJob.tier === 3) {
      // Tier 3: Mandatory QA - all items required
      return qaValidation.tier3AuthPhotosReviewed && 
             qaValidation.tier3SewingQualityApproved && 
             qaValidation.tier3NfcLogsReviewed && 
             qaValidation.tier3SecondPersonConfirmed;
    }
    
    return false;
  };

  const handleQASubmit = async (result: 'pass' | 'fail') => {
    if (!selectedJob) return;
    
    if (result === 'fail') {
      setReworkModal({ ...reworkModal, isOpen: true });
      return;
    }
    
    setIsProcessingQA(true);
    
    try {
      // Mock API call to complete QA
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const qaResult = {
        ...qaValidation,
        qaStatus: 'passed' as const,
        qaCompletedAt: new Date().toISOString()
      };
      
      console.log('QA completed for:', selectedJob.shipment_id);
      console.log('QA Result:', qaResult);
      
      // Emit QA completion event
      console.log('Event emitted: qa.completed', {
        shipment_id: selectedJob.shipment_id,
        tier: selectedJob.tier,
        qaPersonnel: qaResult.qaPersonnelName,
        qaStatus: qaResult.qaStatus,
        timestamp: qaResult.qaCompletedAt
      });
      
      // Update job status to Ready Outbound
      console.log('Status updated: Ready Outbound');
      
      // Close panel
      setSelectedJob(null);
      setActiveTab('overview');
      
    } catch (error) {
      console.error('QA submission failed:', error);
    } finally {
      setIsProcessingQA(false);
    }
  };

  const handleReworkSubmit = async () => {
    if (!selectedJob) return;
    
    try {
      const reworkData = {
        shipment_id: selectedJob.shipment_id,
        reason: reworkModal.reason,
        instructions: reworkModal.instructions,
        severity: reworkModal.severity,
        qaPersonnel: qaValidation.qaPersonnelName,
        timestamp: new Date().toISOString()
      };
      
      console.log('Rework initiated:', reworkData);
      
      // Emit rework event
      console.log('Event emitted: qa.rework_required', reworkData);
      
      // Update QA status
      setQAValidation(prev => ({
        ...prev,
        qaStatus: 'rework_required',
        reworkReason: reworkModal.reason,
        reworkInstructions: reworkModal.instructions
      }));
      
      setReworkModal({ isOpen: false, reason: '', instructions: '', severity: 'minor' });
      
      // Job status would be updated to 'rework' in real system
      console.log('Status updated: Rework Required');
      
    } catch (error) {
      console.error('Rework submission failed:', error);
    }
  };

  // Initialize QA personnel when tab is accessed
  useEffect(() => {
    if (activeTab === 'qa' && selectedJob && !qaValidation.qaPersonnelId) {
      // Mock QA personnel assignment
      setQAValidation(prev => ({
        ...prev,
        qaPersonnelId: 'qa_user_001',
        qaPersonnelName: 'Sarah Johnson' // In real app, would be current user or assigned QA person
      }));
    }
  }, [activeTab, selectedJob, qaValidation.qaPersonnelId]);

  // Outbound workflow helpers
  const generateSealId = (): string => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `SEAL-OUT-${timestamp}-${random}`;
  };

  const isOutboundFormValid = (): boolean => {
    if (!selectedJob) return false;
    
    let baseValid = true;
    
    // Check mode-specific requirements
    if (outboundPreparation.plannedMode === 'WG') {
      baseValid = outboundPreparation.wgIntakeSlot !== undefined && 
                  outboundPreparation.wgDeliverySlot !== undefined;
    } else if (outboundPreparation.plannedMode === 'DHL') {
      baseValid = outboundPreparation.dhlLabelConfirmed;
    }
    
    // Check sealing requirements
    if (outboundPreparation.outboundSealRequired) {
      baseValid = baseValid && 
                  outboundPreparation.outboundSealId !== undefined && 
                  outboundPreparation.outboundSealPhoto !== null;
    }
    
    // Check final photos
    baseValid = baseValid && 
                outboundPreparation.finalPhotos.length > 0 && 
                outboundPreparation.finalPhotosTaken;
    
    return baseValid;
  };

  const handleOutboundFileUpload = (files: FileList | null, type: 'seal_photo' | 'final_photos') => {
    if (!files) return;
    
    switch (type) {
      case 'seal_photo':
        if (files.length > 0) {
          setOutboundPreparation(prev => ({ ...prev, outboundSealPhoto: files[0] }));
        }
        break;
      case 'final_photos':
        const newPhotos = Array.from(files);
        setOutboundPreparation(prev => ({ 
          ...prev, 
          finalPhotos: [...prev.finalPhotos, ...newPhotos] 
        }));
        break;
    }
  };

  const removeFinalPhoto = (index: number) => {
    setOutboundPreparation(prev => ({
      ...prev,
      finalPhotos: prev.finalPhotos.filter((_, i) => i !== index)
    }));
  };

  const generateWGOperatorBrief = async () => {
    if (!selectedJob) return;
    
    try {
      // Mock operator brief generation
      const briefContent = `
OPERATOR BRIEF - CONFIDENTIAL
Shipment: ${selectedJob.shipment_id}
Route: Hub → ${selectedJob.buyer_name} (masked)
Value: €${selectedJob.value.toLocaleString()}
Tier: ${selectedJob.tier}
Special Instructions: Handle with care
Intake Slot: ${outboundPreparation.wgIntakeSlot}
Delivery Window: ${outboundPreparation.wgDeliverySlot}
Generated: ${new Date().toLocaleString()}
      `;
      
      // Create mock file
      const blob = new Blob([briefContent], { type: 'text/plain' });
      const file = new File([blob], `operator-brief-${selectedJob.shipment_id}.txt`, { type: 'text/plain' });
      
      setOutboundPreparation(prev => ({
        ...prev,
        wgOperatorBrief: file,
        wgOperatorBriefGenerated: true
      }));
      
      console.log('WG Operator Brief generated:', file.name);
      
    } catch (error) {
      console.error('Operator brief generation failed:', error);
    }
  };

  const handleHubCompletion = async () => {
    if (!selectedJob) return;
    
    // Run comprehensive DoD validation
    const checklistValidation = validateFullChecklist();
    const inventoryValidation = validateInventoryAtomicity();
    const tier3PassportValidation = validateTier3PassportReadiness();
    
    if (!checklistValidation.valid || !inventoryValidation.valid || !tier3PassportValidation.ready) {
      // Provide detailed DoD error messages
      let errorMessage = 'Cannot complete hub job - Definition of Done not met:\n\n';
      
      if (!checklistValidation.valid) {
        errorMessage += '❌ Checklist Requirements:\n';
        checklistValidation.errors.forEach(error => {
          errorMessage += `  • ${error}\n`;
        });
        errorMessage += '\n';
      }
      
      if (!inventoryValidation.valid) {
        errorMessage += '❌ Inventory Requirements:\n';
        inventoryValidation.errors.forEach(error => {
          errorMessage += `  • ${error}\n`;
        });
        errorMessage += '\n';
      }
      
      if (!tier3PassportValidation.ready && tier3PassportValidation.reason) {
        errorMessage += '❌ Passport Requirements:\n';
        errorMessage += `  • ${tier3PassportValidation.reason}\n\n`;
      }
      
      errorMessage += 'Please complete all requirements before attempting to close the job.';
      
      alert(errorMessage);
      return;
    }
    
    setCompletionModal({ ...completionModal, isOpen: true });
  };

  const confirmHubCompletion = async () => {
    if (!selectedJob) return;
    
    setIsProcessingOutbound(true);
    
    try {
      // Mock API call to complete hub job
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const completionData = {
        shipment_id: selectedJob.shipment_id,
        tier: selectedJob.tier,
        completedAt: new Date().toISOString(),
        completedBy: 'current_user_id',
        finalNotes: completionModal.finalNotes,
        outboundMode: outboundPreparation.plannedMode,
        sealId: outboundPreparation.outboundSealId,
        evidenceCount: {
          finalPhotos: outboundPreparation.finalPhotos.length,
          sealPhoto: outboundPreparation.outboundSealPhoto ? 1 : 0
        }
      };
      
      console.log('Hub job completed:', completionData);
      
      // Emit enhanced hub job completion event
      await emitHubJobCompleted(selectedJob.shipment_id);
      
      // Emit tier-specific events
      if (selectedJob.tier === 2 && processingChecklist.tagAppliedFinal) {
        console.log('Event emitted: tag.applied', {
          shipment_id: selectedJob.shipment_id,
          tagId: processingChecklist.reservedTagId,
          timestamp: completionData.completedAt
        });
        console.log('Passport signal: T2 ready for verification');
      }
      
      if (selectedJob.tier === 3 && processingChecklist.nfcInstalledFinal) {
        console.log('Event emitted: nfc.installed', {
          shipment_id: selectedJob.shipment_id,
          nfcUid: processingChecklist.reservedNfcUid,
          timestamp: completionData.completedAt
        });
        console.log('Passport signal: T3 ready for activation');
      }
      
      // Update outbound status
      setOutboundPreparation(prev => ({
        ...prev,
        hubJobCompleted: true,
        completedAt: completionData.completedAt,
        completedBy: completionData.completedBy
      }));
      
      setCompletionModal({ isOpen: false, finalNotes: '', confirmCompletion: false });
      
      // Close panel and refresh
      setTimeout(() => {
        setSelectedJob(null);
        setActiveTab('overview');
      }, 2000);
      
    } catch (error) {
      console.error('Hub completion failed:', error);
    } finally {
      setIsProcessingOutbound(false);
    }
  };

  // Initialize outbound data when tab is accessed
  useEffect(() => {
    if (activeTab === 'outbound' && selectedJob && !outboundPreparation.wgIntakeSlot) {
      // Mock route data initialization
      const mockIntakeSlot = '2024-01-16 09:00-10:00';
      const mockDeliverySlot = '2024-01-16 14:00-16:00';
      const mockDhlTracking = `DHL${selectedJob.shipment_id.slice(-3)}${Date.now().toString().slice(-4)}`;
      const newSealId = generateSealId();
      
      setOutboundPreparation(prev => ({
        ...prev,
        plannedMode: selectedJob.outboundType as 'WG' | 'DHL',
        wgIntakeSlot: selectedJob.outboundType === 'WG' ? mockIntakeSlot : undefined,
        wgDeliverySlot: selectedJob.outboundType === 'WG' ? mockDeliverySlot : undefined,
        dhlTrackingNumber: selectedJob.outboundType === 'DHL' ? mockDhlTracking : undefined,
        dhlLabelUrl: selectedJob.outboundType === 'DHL' ? `/logistics/dhl/${selectedJob.shipment_id}` : undefined,
        outboundSealId: newSealId
      }));
    }
  }, [activeTab, selectedJob, outboundPreparation.wgIntakeSlot]);

  // Rules & Guardrails - Workflow Enforcement
  const isIntakeCompleted = (): boolean => {
    if (!selectedJob) return false;
    
    // OTP + Seal + Photos required
    return validateOTP(intakeForm.otp, selectedJob?.shipment_id || '') && 
           intakeForm.sealId.trim() !== '' && 
           intakeForm.sealPhoto !== null && 
           intakeForm.photos360.length >= 4;
  };

  const canAccessProcessing = (): boolean => {
    // Cannot access processing without completed intake
    return isIntakeCompleted();
  };

  const canAccessQA = (): boolean => {
    // Cannot access QA without completed processing
    if (!canAccessProcessing()) return false;
    
    if (selectedJob?.tier === 2) {
      // Tier 2: Must have tag_applied=true and tag photo
      return processingChecklist.tagAppliedFinal && 
             processingChecklist.tagPlacementPhoto !== null;
    } else if (selectedJob?.tier === 3) {
      // Tier 3: Must have nfc_installed=true and read/write tests
      return processingChecklist.nfcInstalledFinal && 
             processingChecklist.nfcReadTest && 
             processingChecklist.nfcWriteTest && 
             processingChecklist.nfcTestScreenshot !== null;
    }
    
    return false;
  };

  const canAccessOutbound = (): boolean => {
    // Cannot access outbound without completed QA
    if (!canAccessQA()) return false;
    
    if (selectedJob?.tier === 3) {
      // Tier 3: QA mandatory, must be completed
      return qaValidation.qaStatus === 'passed';
    } else if (selectedJob?.tier === 2) {
      // Tier 2: QA optional, but if started must be completed
      return qaValidation.qaStatus === 'pending' || qaValidation.qaStatus === 'passed';
    }
    
    return false;
  };

  const isQAMandatory = (): boolean => {
    // QA mandatory for Tier 3, optional for Tier 2
    return selectedJob?.tier === 3;
  };

  const requiresDoubleSign = (): boolean => {
    // Double-sign required for Tier 3 (tech + QA)
    return selectedJob?.tier === 3;
  };

  const canCompleteHub = (): boolean => {
    if (!selectedJob) return false;
    
    // Run comprehensive DoD validation
    const checklistValidation = validateFullChecklist();
    const inventoryValidation = validateInventoryAtomicity();
    const tier3PassportValidation = validateTier3PassportReadiness();
    
    return checklistValidation.valid && 
           inventoryValidation.valid && 
           tier3PassportValidation.ready;
  };

  // Inventory Integrity Management
  const validateReservedItem = (type: 'tag' | 'nfc', itemId: string): boolean => {
    // Validate that the item being used is the reserved one
    if (type === 'tag') {
      return itemId === processingChecklist.reservedTagId;
    } else if (type === 'nfc') {
      return itemId === processingChecklist.reservedNfcUid;
    }
    return false;
  };

  const logInventoryChange = async (changeData: {
    type: 'tag' | 'nfc';
    oldItemId?: string;
    newItemId: string;
    reason: string;
    shipmentId: string;
    changedBy: string;
  }) => {
    try {
      // Mock API call to log inventory change
      console.log('Inventory Change Logged:', changeData);
      
      // Log to TierDecision/Inventory history
      const inventoryLog = {
        ...changeData,
        timestamp: new Date().toISOString(),
        logType: 'inventory_change',
        tableName: changeData.type === 'tag' ? 'InventoryTag' : 'InventoryNfc'
      };
      
      console.log('TierDecision/Inventory History Updated:', inventoryLog);
      
      return true;
    } catch (error) {
      console.error('Inventory change logging failed:', error);
      return false;
    }
  };

  const updateInventoryStatus = async (type: 'tag' | 'nfc', itemId: string, shipmentId: string) => {
    try {
      if (type === 'tag') {
        // InventoryTag.status = applied, assignedShipmentId = <id>
        const tagUpdate = {
          tagId: itemId,
          status: 'applied',
          assignedShipmentId: shipmentId,
          appliedAt: new Date().toISOString(),
          appliedBy: 'current_user_id'
        };
        
        console.log('InventoryTag Status Update:', tagUpdate);
        
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log(`Tag ${itemId} status: assigned → applied`);
        
      } else if (type === 'nfc') {
        // InventoryNfc.status = installed, assignedShipmentId = <id>
        const nfcUpdate = {
          nfcUid: itemId,
          status: 'installed',
          assignedShipmentId: shipmentId,
          installedAt: new Date().toISOString(),
          installedBy: 'current_user_id'
        };
        
        console.log('InventoryNfc Status Update:', nfcUpdate);
        
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log(`NFC ${itemId} status: assigned → installed`);
      }
      
      // Auto-decrement Hub counts
      await decrementHubInventory(type);
      
      return true;
    } catch (error) {
      console.error('Inventory status update failed:', error);
      return false;
    }
  };

  const decrementHubInventory = async (type: 'tag' | 'nfc') => {
    try {
      const hubCountUpdate = {
        hubId: selectedHub,
        type: type,
        operation: 'decrement',
        reason: 'applied_to_item',
        timestamp: new Date().toISOString()
      };
      
      console.log('Hub Inventory Decrement:', hubCountUpdate);
      
      // Mock API call to decrement hub counts
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log(`Hub ${selectedHub} ${type} count decremented`);
      
      return true;
    } catch (error) {
      console.error('Hub inventory decrement failed:', error);
      return false;
    }
  };

  const initiateRMAFlow = async (nfcUid: string, failureReason: string) => {
    try {
      const rmaRequest = {
        itemType: 'nfc',
        itemId: nfcUid,
        shipment_id: selectedJob?.shipment_id,
        failureReason: failureReason,
        testResults: {
          readTest: processingChecklist.nfcReadTest,
          writeTest: processingChecklist.nfcWriteTest
        },
        hubId: selectedHub,
        initiatedBy: 'current_user_id',
        timestamp: new Date().toISOString()
      };
      
      console.log('RMA Flow Initiated:', rmaRequest);
      
      // Mock API call to create RMA request
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`RMA request created for failed NFC ${nfcUid}`);
      
      return true;
    } catch (error) {
      console.error('RMA flow initiation failed:', error);
      return false;
    }
  };

  // Evidence Management System
  const generateFileHash = async (file: File): Promise<string> => {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.error('Hash generation failed:', error);
      return `mock_hash_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }
  };

  const validatePhotoFile = (file: File, type: keyof typeof photoValidationRules): { valid: boolean; errors: string[] } => {
    const rules = photoValidationRules[type];
    const errors: string[] = [];

    // File size validation
    if (file.size > rules.maxSize) {
      errors.push(`File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds limit of ${rules.maxSize / 1024 / 1024}MB`);
    }

    // File type validation
    if (!rules.allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} not allowed. Allowed types: ${rules.allowedTypes.join(', ')}`);
    }

    // Basic file validation
    if (file.size === 0) {
      errors.push('File is empty');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  };

  const validatePhotoSet = (files: File[], type: keyof typeof photoValidationRules): { valid: boolean; errors: string[] } => {
    const rules = photoValidationRules[type];
    const errors: string[] = [];

    // Minimum files validation
    if (files.length < rules.minFiles) {
      errors.push(`Minimum ${rules.minFiles} photos required, only ${files.length} provided`);
    }

    // Maximum files validation
    if (files.length > rules.maxFiles) {
      errors.push(`Maximum ${rules.maxFiles} photos allowed, ${files.length} provided`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  };

  const processEvidenceFile = async (
    file: File, 
    type: EvidenceFile['type'],
    actorId: string = 'current_user_id'
  ): Promise<EvidenceFile> => {
    // Validate file
    const validation = validatePhotoFile(file, type);
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    // Generate hash and timestamp
    const hash = await generateFileHash(file);
    const timestamp = new Date().toISOString();

    // Create evidence file record
    const evidenceFile: EvidenceFile = {
      file,
      hash,
      timestamp,
      actorId,
      type,
      validated: validation.valid,
      size: file.size,
      mimeType: file.type,
      url: URL.createObjectURL(file) // Temporary URL for display
    };

    return evidenceFile;
  };

  const linkEvidenceToPassport = async (evidenceFiles: EvidenceFile[], shipmentId: string) => {
    try {
      // Mock API call to link evidence to EON/Passport record
      const linkingData = {
        shipmentId,
        evidenceCount: evidenceFiles.length,
        evidenceHashes: evidenceFiles.map(f => f.hash),
        evidenceTypes: evidenceFiles.map(f => f.type),
        totalSize: evidenceFiles.reduce((sum, f) => sum + f.size, 0),
        linkedAt: new Date().toISOString(),
        linkedBy: 'current_user_id'
      };

      console.log('Evidence linked to EON/Passport:', linkingData);

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log(`Evidence successfully linked to Sprint 1 Passport record for ${shipmentId}`);

      return true;
    } catch (error) {
      console.error('Evidence linking failed:', error);
      return false;
    }
  };

  // Enhanced Event Emission System
  const emitHubIntakeDone = async (shipmentId: string) => {
    if (!selectedJob) return;

    const intakePhotos = evidenceFiles.filter(f => f.type === 'intake_360' || f.type === 'intake_seal');
    
    const event = {
      eventType: 'hub.intake.done',
      data: {
        shipmentId,
        hubId: selectedHub,
        sealId: intakeForm.sealId,
        photos: intakePhotos.length,
        photoHashes: intakePhotos.map(f => f.hash),
        actorId: 'current_user_id',
        ts: new Date().toISOString(),
        evidenceUrls: intakePhotos.map(f => f.url).filter(Boolean)
      }
    };

    console.log('Event emitted:', event);

    // Mock API call to emit event
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('✅ hub.intake.done event successfully emitted');
    } catch (error) {
      console.error('Event emission failed:', error);
    }
  };

  const emitTagApplied = async (shipmentId: string, tagId: string) => {
    if (!selectedJob) return;

    const tagPhoto = evidenceFiles.find(f => f.type === 'tag_placement');
    
    const event = {
      eventType: 'tag.applied',
      data: {
        shipmentId,
        hubId: selectedHub,
        tagId,
        photoUrl: tagPhoto?.url,
        photoHash: tagPhoto?.hash,
        actorId: 'current_user_id',
        ts: new Date().toISOString(),
        tier: selectedJob.tier
      }
    };

    console.log('Event emitted:', event);

    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('✅ tag.applied event successfully emitted');
    } catch (error) {
      console.error('Event emission failed:', error);
    }
  };

  const emitNfcInstalled = async (shipmentId: string, nfcUid: string) => {
    if (!selectedJob) return;

    const nfcPhoto = evidenceFiles.find(f => f.type === 'nfc_test');
    
    const event = {
      eventType: 'nfc.installed',
      data: {
        shipmentId,
        hubId: selectedHub,
        nfcUid,
        tests: {
          read: processingChecklist.nfcReadTest,
          write: processingChecklist.nfcWriteTest
        },
        photoUrl: nfcPhoto?.url,
        photoHash: nfcPhoto?.hash,
        actorId: 'current_user_id',
        ts: new Date().toISOString(),
        tier: selectedJob.tier
      }
    };

    console.log('Event emitted:', event);

    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('✅ nfc.installed event successfully emitted');
    } catch (error) {
      console.error('Event emission failed:', error);
    }
  };

  const emitHubJobCompleted = async (shipmentId: string) => {
    if (!selectedJob) return;

    const event = {
      eventType: 'hub.job.completed',
      data: {
        shipmentId,
        hubId: selectedHub,
        tier: selectedJob.tier,
        qa: qaValidation.qaStatus === 'passed' ? 'ok' : 
            qaValidation.qaStatus === 'failed' || qaValidation.qaStatus === 'rework_required' ? 'fail' : 
            selectedJob.tier === 2 ? 'ok' : 'pending',
        actorId: 'current_user_id',
        ts: new Date().toISOString(),
        evidenceCount: evidenceFiles.length,
        totalEvidenceSize: evidenceFiles.reduce((sum, f) => sum + f.size, 0)
      }
    };

    console.log('Event emitted:', event);

    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('✅ hub.job.completed event successfully emitted');
      
      // Also link all evidence to passport
      await linkEvidenceToPassport(evidenceFiles, shipmentId);
      
    } catch (error) {
      console.error('Event emission failed:', error);
    }
  };

  // Definition of Done (DoD) - Page-Level Validation
  const validateFullChecklist = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!selectedJob) {
      errors.push('No job selected');
      return { valid: false, errors };
    }

    // 1. Intake Requirements
    if (!isIntakeCompleted()) {
      errors.push('Intake not completed (OTP + seal + photos required)');
    }

    // 2. Processing Requirements  
    if (selectedJob.tier === 2) {
      if (!processingChecklist.tagAppliedFinal) {
        errors.push('Tag application not completed (tag_applied=true required)');
      }
      if (!processingChecklist.tagPlacementPhoto) {
        errors.push('Tag placement photo required');
      }
    } else if (selectedJob.tier === 3) {
      if (!processingChecklist.nfcInstalledFinal) {
        errors.push('NFC installation not completed (nfc_installed=true required)');
      }
      if (!processingChecklist.nfcReadTest || !processingChecklist.nfcWriteTest) {
        errors.push('NFC read/write tests required');
      }
      if (!processingChecklist.nfcTestScreenshot) {
        errors.push('NFC test screenshot required');
      }
    }

    // 3. QA Requirements
    if (selectedJob.tier === 3 && qaValidation.qaStatus !== 'passed') {
      errors.push('QA mandatory for Tier 3 - must pass QA validation');
    }

    // 4. Evidence Requirements
    const requiredEvidence = getRequiredEvidenceTypes();
    const missingEvidence = requiredEvidence.filter(type => 
      !evidenceFiles.some(f => f.type === type && f.validated)
    );
    if (missingEvidence.length > 0) {
      errors.push(`Missing required evidence: ${missingEvidence.join(', ')}`);
    }

    // 5. Outbound Requirements
    if (!isOutboundHandoffReady()) {
      errors.push('Outbound handoff not prepared (WG brief or DHL label required)');
    }

    return { valid: errors.length === 0, errors };
  };

  const getRequiredEvidenceTypes = (): EvidenceFile['type'][] => {
    if (!selectedJob) return [];
    
    const required: EvidenceFile['type'][] = [
      'intake_seal',
      'intake_360',
      'final_photo'
    ];

    if (selectedJob.tier === 2) {
      required.push('tag_placement');
    } else if (selectedJob.tier === 3) {
      required.push('nfc_test');
    }

    if (outboundPreparation.outboundSealRequired) {
      required.push('outbound_seal');
    }

    return required;
  };

  const isOutboundHandoffReady = (): boolean => {
    if (outboundPreparation.plannedMode === 'WG') {
      return outboundPreparation.wgOperatorBriefGenerated && 
             outboundPreparation.wgOperatorBrief !== null;
    } else if (outboundPreparation.plannedMode === 'DHL') {
      return outboundPreparation.dhlLabelConfirmed && 
             outboundPreparation.dhlLabelUrl !== undefined;
    }
    return false;
  };

  const validateTier3PassportReadiness = (): { ready: boolean; reason?: string } => {
    if (!selectedJob || selectedJob.tier !== 3) {
      return { ready: true }; // Not applicable for non-Tier 3
    }

    if (!processingChecklist.nfcInstalledFinal) {
      return { 
        ready: false, 
        reason: 'nfc_installed=true required for Tier 3 passport activation' 
      };
    }

    if (!processingChecklist.nfcReadTest || !processingChecklist.nfcWriteTest) {
      return { 
        ready: false, 
        reason: 'NFC read/write tests must pass for passport activation' 
      };
    }

    if (qaValidation.qaStatus !== 'passed') {
      return { 
        ready: false, 
        reason: 'QA must pass for Tier 3 passport activation' 
      };
    }

    return { ready: true };
  };

  const validateInventoryAtomicity = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!selectedJob) {
      errors.push('No job selected for inventory validation');
      return { valid: false, errors };
    }

    // Check if inventory operations are in consistent state
    if (selectedJob.tier === 2) {
      const tagReserved = processingChecklist.reservedTagId;
      const tagApplied = processingChecklist.tagAppliedFinal;
      
      if (tagApplied && !tagReserved) {
        errors.push('Tag applied but no reserved tag ID - inventory inconsistency');
      }
      
      if (tagReserved && !validateReservedItem('tag', tagReserved)) {
        errors.push('Tag inventory mismatch - reserved item validation failed');
      }
    } else if (selectedJob.tier === 3) {
      const nfcReserved = processingChecklist.reservedNfcUid;
      const nfcInstalled = processingChecklist.nfcInstalledFinal;
      
      if (nfcInstalled && !nfcReserved) {
        errors.push('NFC installed but no reserved NFC UID - inventory inconsistency');
      }
      
      if (nfcReserved && !validateReservedItem('nfc', nfcReserved)) {
        errors.push('NFC inventory mismatch - reserved item validation failed');
      }
    }

    return { valid: errors.length === 0, errors };
  };

  const getQAOutcomeLog = (): {
    status: string;
    details: string;
    reworkAvailable: boolean;
    loggedAt?: string;
    personnel?: string;
  } => {
    const qaStatus = qaValidation.qaStatus;
    
    return {
      status: qaStatus,
      details: qaStatus === 'passed' ? 'Quality assurance passed - all requirements met' :
               qaStatus === 'failed' ? 'Quality assurance failed - item rejected' :
               qaStatus === 'rework_required' ? `Rework required: ${qaValidation.reworkReason}` :
               'QA pending - awaiting validation',
      reworkAvailable: qaStatus === 'failed' || qaStatus === 'rework_required',
      loggedAt: qaValidation.qaCompletedAt,
      personnel: qaValidation.qaPersonnelName
    };
  };

  const getJobStateClassification = (job: HubJob): {
    state: 'overdue' | 'today' | 'tomorrow' | 'future';
    priority: 'critical' | 'high' | 'normal';
    realTimeStatus: string;
  } => {
    const now = new Date();
    const slaDeadline = new Date(job.sla_deadline);
    const plannedIntake = new Date(job.planned_intake_time);
    
    // Determine time classification
    let state: 'overdue' | 'today' | 'tomorrow' | 'future' = 'future';
    if (slaDeadline < now) {
      state = 'overdue';
    } else if (plannedIntake.toDateString() === now.toDateString()) {
      state = 'today';
    } else if (plannedIntake.toDateString() === new Date(now.getTime() + 24*60*60*1000).toDateString()) {
      state = 'tomorrow';
    }
    
    // Determine priority
    let priority: 'critical' | 'high' | 'normal' = 'normal';
    if (state === 'overdue' || job.value > 50000) {
      priority = 'critical';
    } else if (job.priority === 'high' || job.value > 20000) {
      priority = 'high';
    }
    
    // Real-time status based on actual progress
    let realTimeStatus = job.status;
    if (selectedJob?.shipment_id === job.shipment_id) {
      // Update status based on current progress
      if (outboundPreparation.hubJobCompleted) {
        realTimeStatus = 'completed';
      } else if (canAccessOutbound()) {
        realTimeStatus = 'ready_outbound';
      } else if (canAccessQA()) {
        realTimeStatus = 'waiting_qa';
      } else if (canAccessProcessing()) {
        realTimeStatus = 'in_progress';
      }
    }
    
    return { state, priority, realTimeStatus };
  };

  // UX Enhancement System
  const getEvidenceProgress = (): {
    completed: number;
    total: number;
    percentage: number;
    missing: string[];
    completedTypes: string[];
  } => {
    const requiredTypes = getRequiredEvidenceTypes();
    const completedTypes = requiredTypes.filter(type => 
      evidenceFiles.some(f => f.type === type && f.validated)
    );
    const missing = requiredTypes.filter(type => 
      !evidenceFiles.some(f => f.type === type && f.validated)
    );
    
    return {
      completed: completedTypes.length,
      total: requiredTypes.length,
      percentage: requiredTypes.length > 0 ? (completedTypes.length / requiredTypes.length) * 100 : 0,
      missing: missing.map(type => {
        switch (type) {
          case 'intake_seal': return 'Intake seal photo';
          case 'intake_360': return '360° photos (min 4)';
          case 'auth_photo': return 'Authentication photos';
          case 'tag_placement': return 'Tag placement photo';
          case 'nfc_test': return 'NFC test screenshot';
          case 'final_photo': return 'Final documentation photos';
          case 'outbound_seal': return 'Outbound seal photo';
          default: return (type as string).replace('_', ' ');
        }
      }),
      completedTypes: completedTypes.map(type => {
        switch (type) {
          case 'intake_seal': return 'Intake seal photo';
          case 'intake_360': return '360° photos';
          case 'auth_photo': return 'Authentication photos';
          case 'tag_placement': return 'Tag placement photo';
          case 'nfc_test': return 'NFC test screenshot';
          case 'final_photo': return 'Final documentation photos';
          case 'outbound_seal': return 'Outbound seal photo';
          default: return (type as string).replace('_', ' ');
        }
      })
    };
  };

  const formatLocalTime = (isoString: string): { local: string; absolute: string; timezone: string } => {
    const date = new Date(isoString);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return {
      local: date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone
      }),
      absolute: date.toISOString(),
      timezone: timeZone
    };
  };

  const handleKeyboardShortcuts = (event: KeyboardEvent) => {
    if (!selectedJob) return;
    
    // Ctrl/Cmd + shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case '1':
          event.preventDefault();
          if (canAccessProcessing()) setActiveTab('intake');
          break;
        case '2':
          event.preventDefault();
          if (canAccessProcessing()) setActiveTab('processing');
          break;
        case '3':
          event.preventDefault();
          if (canAccessQA()) setActiveTab('qa');
          break;
        case '4':
          event.preventDefault();
          if (canAccessOutbound()) setActiveTab('outbound');
          break;
        case 's':
          event.preventDefault();
          // Save/submit current tab
          if (activeTab === 'intake' && isIntakeFormValid()) {
            handleIntakeSubmit();
          } else if (activeTab === 'processing' && isProcessingChecklistValid()) {
            handleProcessingSubmit();
          }
          break;
        case 'Escape':
          event.preventDefault();
          setSelectedJob(null);
          break;
      }
    }
  };

  const handleBarcodeInput = (value: string) => {
    // Auto-detect barcode patterns and fill appropriate fields
    if (activeTab === 'intake') {
      // Check if it looks like an OTP (4-6 digits)
      if (/^\d{4,6}$/.test(value)) {
        setIntakeForm(prev => ({ ...prev, otp: value }));
        console.log('Barcode detected as OTP:', value);
      }
      // Check if it looks like a shipment ID
      else if (/^SH-\d{4}-\d{3}$/.test(value)) {
        console.log('Barcode detected as Shipment ID:', value);
        // Could auto-select job if it matches
      }
      // Generic package barcode
      else {
        setIntakeForm(prev => ({ ...prev, packageBarcode: value }));
        console.log('Barcode detected as package barcode:', value);
      }
    }
  };

  const initiateCameraCapture = async (type: EvidenceFile['type']): Promise<File | null> => {
    try {
      // Check if device supports camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });

      // Create video element
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      // Create canvas for capture
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      return new Promise((resolve) => {
        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Auto-capture after 3 seconds or manual trigger
          setTimeout(() => {
            if (context) {
              context.drawImage(video, 0, 0);
              canvas.toBlob((blob) => {
                stream.getTracks().forEach(track => track.stop());
                if (blob) {
                  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                  const file = new File([blob], `${type}-${timestamp}.jpg`, { type: 'image/jpeg' });
                  resolve(file);
                } else {
                  resolve(null);
                }
              }, 'image/jpeg', 0.9);
            }
          }, 3000);
        };
      });
    } catch (error) {
      console.error('Camera capture failed:', error);
      alert('Camera capture failed. Please use file upload instead.');
      return null;
    }
  };

  // Add keyboard event listener
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleKeyboardShortcuts(event);
      
      // Barcode scanner simulation (typically sends data followed by Enter)
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
        const value = event.target.value.trim();
        if (value && /^[A-Z0-9-]{4,20}$/.test(value)) {
          handleBarcodeInput(value);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, selectedJob]);

  // Telemetry System
  const trackTelemetry = (event: string, data: any) => {
    const telemetryEvent = {
      timestamp: Date.now(),
      sessionId: telemetry.sessionId,
      event,
      data,
      jobId: selectedJob?.shipment_id,
      hubId: selectedHub,
      tier: selectedJob?.tier
    };
    
    console.log('Telemetry:', telemetryEvent);
    
    // Mock API call to send telemetry
    // In production, this would send to analytics service
  };

  const startIntakeTimer = () => {
    setTelemetry(prev => ({ ...prev, intakeStartTime: Date.now() }));
    trackTelemetry('hub.intake.started', { jobId: selectedJob?.shipment_id });
  };

  const completeIntakeTimer = () => {
    if (telemetry.intakeStartTime) {
      const duration = Date.now() - telemetry.intakeStartTime;
      setTelemetry(prev => ({ ...prev, intakeCompleteTime: Date.now() }));
      trackTelemetry('hub.intake.time_ms', { duration, jobId: selectedJob?.shipment_id });
    }
  };

  const startChecklistTimer = () => {
    setTelemetry(prev => ({ ...prev, checklistStartTime: Date.now() }));
    trackTelemetry('hub.checklist.started', { tier: selectedJob?.tier });
  };

  const completeChecklistTimer = () => {
    if (telemetry.checklistStartTime) {
      const duration = Date.now() - telemetry.checklistStartTime;
      setTelemetry(prev => ({ ...prev, checklistCompleteTime: Date.now() }));
      trackTelemetry('hub.checklist.duration_ms', { duration, tier: selectedJob?.tier });
    }
  };

  const trackPhotoUploadAttempt = (success: boolean, error?: string) => {
    setTelemetry(prev => ({ ...prev, photoUploadAttempts: prev.photoUploadAttempts + 1 }));
    trackTelemetry('hub.photo.upload_attempt', { success, error, attempts: telemetry.photoUploadAttempts + 1 });
  };

  const trackNFCTestAttempt = (testType: 'read' | 'write', success: boolean) => {
    setTelemetry(prev => ({ ...prev, nfcTestAttempts: prev.nfcTestAttempts + 1 }));
    trackTelemetry('hub.nfc.test_attempt', { testType, success, attempts: telemetry.nfcTestAttempts + 1 });
  };

  const trackCompletionBlocked = (reason: string) => {
    setTelemetry(prev => ({ ...prev, completionBlockedCount: prev.completionBlockedCount + 1 }));
    trackTelemetry('hub.photo.missing_attempts', { reason, blockedCount: telemetry.completionBlockedCount + 1 });
  };

  // Load detailed hub information
  const loadHubDetails = async () => {
    try {
      setLoadingHubDetails(true);
      const response = await fetch('/api/hubs');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Find the selected hub
          const currentHub = data.data.find((hub: any) => hub.id.toString() === selectedHub);
          if (currentHub) {
            setSelectedHubDetails(currentHub);
          }
          
          // Update hubs list with more detailed info if available
          const hubsList = data.data.map((hub: any) => ({
            id: hub.id,
            hub_code: hub.code,
            hub_name: hub.name
          }));
          setHubs(hubsList);
        }
      }
    } catch (error) {
      console.error('Error loading hub details:', error);
    } finally {
      setLoadingHubDetails(false);
    }
  };

  // Load hub details when component mounts or selected hub changes
  React.useEffect(() => {
    loadHubDetails();
  }, [selectedHub]);

  // Initial data load
  React.useEffect(() => {
    if (hubs.length === 0) {
      loadHubDetails();
    }
  }, []);

  // Edge Case Handling System
  const handleDamageOnArrival = () => {
    const incidentId = `INC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    setEdgeCases(prev => ({
      ...prev,
      damageOnArrival: {
        ...prev.damageOnArrival,
        isOpen: true,
        incidentId,
        pausedAt: new Date().toISOString(),
        pausedBy: 'current_user_id'
      }
    }));

    trackTelemetry('hub.damage.incident_opened', { incidentId, jobId: selectedJob?.shipment_id });
  };

  const confirmDamageIncident = async () => {
    if (!selectedJob) return;

    try {
      // Pause job processing
      const pauseData = {
        jobId: selectedJob.shipment_id,
        incidentId: edgeCases.damageOnArrival.incidentId,
        damageType: edgeCases.damageOnArrival.damageType,
        severity: edgeCases.damageOnArrival.severity,
        description: edgeCases.damageOnArrival.description,
        photos: edgeCases.damageOnArrival.photos.length,
        pausedAt: edgeCases.damageOnArrival.pausedAt,
        pausedBy: edgeCases.damageOnArrival.pausedBy
      };

      console.log('Job paused due to damage:', pauseData);
      
      // Mock API call to create incident and pause job
      await new Promise(resolve => setTimeout(resolve, 1000));

      alert(`Incident ${edgeCases.damageOnArrival.incidentId} created. Job paused pending resolution.`);
      
      trackTelemetry('hub.damage.job_paused', pauseData);

      // Close modal and disable job processing
      setEdgeCases(prev => ({
        ...prev,
        damageOnArrival: { ...prev.damageOnArrival, isOpen: false }
      }));

      setSelectedJob(null); // Close job panel
      
    } catch (error) {
      console.error('Damage incident creation failed:', error);
      alert('Failed to create damage incident. Please try again.');
    }
  };

  const handleInventorySwap = (itemType: 'tag' | 'nfc', originalId: string) => {
    setEdgeCases(prev => ({
      ...prev,
      inventorySwap: {
        ...prev.inventorySwap,
        isOpen: true,
        itemType,
        originalId,
        swapRequestedBy: 'current_user_id',
        swapRequestedAt: new Date().toISOString()
      }
    }));

    trackTelemetry('hub.inventory.swap_requested', { itemType, originalId });
  };

  const confirmInventorySwap = async () => {
    if (!selectedJob) return;

    try {
      // Validate new item exists and is available
      const swapData = {
        jobId: selectedJob.shipment_id,
        itemType: edgeCases.inventorySwap.itemType,
        originalId: edgeCases.inventorySwap.originalId,
        newId: edgeCases.inventorySwap.newId,
        reason: edgeCases.inventorySwap.reason,
        swapRequestedBy: edgeCases.inventorySwap.swapRequestedBy,
        swapRequestedAt: edgeCases.inventorySwap.swapRequestedAt
      };

      console.log('Inventory swap processed:', swapData);

      // Mock API call to swap inventory items
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update processing checklist with new ID
      if (edgeCases.inventorySwap.itemType === 'tag') {
        setProcessingChecklist(prev => ({
          ...prev,
          reservedTagId: edgeCases.inventorySwap.newId
        }));
      } else {
        setProcessingChecklist(prev => ({
          ...prev,
          reservedNfcUid: edgeCases.inventorySwap.newId
        }));
      }

      trackTelemetry('hub.inventory.swap_completed', swapData);

      alert(`Inventory swap completed. New ${edgeCases.inventorySwap.itemType.toUpperCase()} ID: ${edgeCases.inventorySwap.newId}`);

      // Close modal
      setEdgeCases(prev => ({
        ...prev,
        inventorySwap: { ...prev.inventorySwap, isOpen: false }
      }));

    } catch (error) {
      console.error('Inventory swap failed:', error);
      alert('Inventory swap failed. Please contact Ops team.');
    }
  };

  const handleNFCFailure = (uid: string, failureType: 'read' | 'write' | 'both') => {
    setEdgeCases(prev => ({
      ...prev,
      nfcFailure: {
        ...prev.nfcFailure,
        isOpen: true,
        failedUid: uid,
        failureType,
        failureCount: prev.nfcFailure.failureCount + 1
      }
    }));

    trackTelemetry('hub.nfc.failure_detected', { uid, failureType, failureCount: edgeCases.nfcFailure.failureCount + 1 });
    trackTelemetry('hub.nfc.failure_rate', { tier: selectedJob?.tier });
  };

  const initiateNFCRMA = async () => {
    try {
      const rmaData = {
        failedUid: edgeCases.nfcFailure.failedUid,
        failureType: edgeCases.nfcFailure.failureType,
        jobId: selectedJob?.shipment_id,
        rmaInitiatedAt: new Date().toISOString(),
        rmaInitiatedBy: 'current_user_id'
      };

      console.log('NFC RMA initiated:', rmaData);

      // Mock API call to initiate RMA
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate new NFC UID
      const newUid = `NFC-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

      setEdgeCases(prev => ({
        ...prev,
        nfcFailure: {
          ...prev.nfcFailure,
          rmaInitiated: true,
          newUid,
          retestRequired: true
        }
      }));

      // Update processing checklist with new NFC
      setProcessingChecklist(prev => ({
        ...prev,
        reservedNfcUid: newUid,
        nfcReadTest: false,
        nfcWriteTest: false,
        nfcTestScreenshot: null
      }));

      trackTelemetry('hub.nfc.rma_initiated', { ...rmaData, newUid });

      alert(`RMA initiated for failed NFC. New NFC assigned: ${newUid}. Please re-run tests.`);

    } catch (error) {
      console.error('NFC RMA failed:', error);
      alert('NFC RMA initiation failed. Please contact technical support.');
    }
  };

  const checkHubCapacity = () => {
    const todayJobs = sortedJobs.filter(job => {
      const jobDate = new Date(job.planned_intake_time).toDateString();
      const today = new Date().toDateString();
      return jobDate === today;
    });

    const currentLoad = todayJobs.length;
    const dailyCapacity = 50; // Configurable per hub
    const projectedOverage = Math.max(0, currentLoad - dailyCapacity);

    if (projectedOverage > 0) {
      setEdgeCases(prev => ({
        ...prev,
        capacityWarning: {
          ...prev.capacityWarning,
          isOpen: true,
          currentLoad,
          dailyCapacity,
          projectedOverage,
          affectedJobs: todayJobs.slice(dailyCapacity).map(job => job.shipment_id),
          reprioritizationSuggested: true
        }
      }));

      trackTelemetry('hub.capacity.warning_triggered', { currentLoad, dailyCapacity, projectedOverage });
    }
  };

  const handlePhotoUploadFailure = (files: File[], error: string, uploadType: EvidenceFile['type']) => {
    setEdgeCases(prev => ({
      ...prev,
      photoUploadFailure: {
        ...prev.photoUploadFailure,
        isOpen: true,
        failedFiles: files,
        retryCount: prev.photoUploadFailure.retryCount + 1,
        lastError: error,
        uploadType
      }
    }));

    trackPhotoUploadAttempt(false, error);
  };

  const retryPhotoUpload = async () => {
    const { failedFiles, uploadType, retryCount } = edgeCases.photoUploadFailure;
    
    try {
      console.log(`Retrying photo upload (attempt ${retryCount + 1}):`, failedFiles);

      // Mock retry logic with better error handling
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate 80% success rate on retry
          if (Math.random() > 0.2) {
            resolve(null);
          } else {
            reject(new Error('Retry failed: Network timeout'));
          }
        }, 2000);
      });

      // Process successful retry
      for (const file of failedFiles) {
        const evidenceFile = await processEvidenceFile(file, uploadType);
        setEvidenceFiles((prev: EvidenceFile[]) => [...prev, evidenceFile]);
      }

      trackPhotoUploadAttempt(true);

      alert(`Photo upload successful on retry attempt ${retryCount + 1}`);

      // Close retry modal
      setEdgeCases(prev => ({
        ...prev,
        photoUploadFailure: { ...prev.photoUploadFailure, isOpen: false }
      }));

    } catch (error) {
      console.error('Photo upload retry failed:', error);
      setEdgeCases(prev => ({
        ...prev,
        photoUploadFailure: {
          ...prev.photoUploadFailure,
          retryCount: prev.photoUploadFailure.retryCount + 1,
          lastError: error instanceof Error ? error.message : 'Unknown error'
        }
      }));

      trackPhotoUploadAttempt(false, error instanceof Error ? error.message : 'Unknown error');
      
      if (edgeCases.photoUploadFailure.retryCount >= 3) {
        alert('Photo upload failed after multiple attempts. Please contact technical support.');
      }
    }
  };

  const checkCustomsRequirements = () => {
    if (!selectedJob) return;

    // Mock customs requirements check based on destination
    const isInternational = selectedJob.buyer_name.includes('International') || selectedJob.sender_name.includes('Export');
    
    if (isInternational) {
      const missingDocs = ['Commercial Invoice', 'Certificate of Origin', 'Export Declaration'];
      
      setEdgeCases(prev => ({
        ...prev,
        customsDocumentation: {
          ...prev.customsDocumentation,
          isOpen: true,
          missingDocs,
          customsReturn: true,
          destinationCountry: 'Various',
          requiredForms: missingDocs
        }
      }));

      trackTelemetry('hub.customs.documentation_check', { jobId: selectedJob.shipment_id, missingDocs });
    }
  };

  // Load hubs on mount
  React.useEffect(() => {
    const loadHubs = async () => {
      try {
        const hubData = await hubConsoleApi.getHubs();
        setHubs(hubData);
        if (hubData.length > 0 && !selectedHub) {
          setSelectedHub(hubData[0].id.toString());
        }
      } catch (err) {
        console.error('Failed to load hubs:', err);
        setError('Failed to load hubs');
      }
    };
    loadHubs();
  }, []);

  // Load jobs when hub or filters change
  React.useEffect(() => {
    const loadJobs = async () => {
      if (!selectedHub) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const filters: HubFilters = {
          hubId: selectedHub,
          tier: filterTier !== 'both' ? filterTier : undefined,
          status: filterStatus !== 'all' ? filterStatus : undefined,
          priority: filterPriority !== 'all' ? filterPriority : undefined,
          when: filterWhen,
          search: searchQuery || undefined
        };

        const jobData = await hubConsoleApi.getHubJobs(filters);
        setJobs(jobData);
      } catch (err) {
        console.error('Failed to load jobs:', err);
        setError('Failed to load jobs');
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
  }, [selectedHub, filterTier, filterStatus, filterWhen, filterPriority, searchQuery]);

  // Initialize telemetry and capacity check on mount
  React.useEffect(() => {
    checkHubCapacity();
    checkCustomsRequirements();
  }, [selectedJob]);

  // Start intake timer when job is selected and intake tab is active
  React.useEffect(() => {
    if (selectedJob && activeTab === 'intake' && !telemetry.intakeStartTime) {
      startIntakeTimer();
    }
  }, [selectedJob, activeTab]);

  // Start checklist timer when processing tab is active
  React.useEffect(() => {
    if (selectedJob && activeTab === 'processing' && !telemetry.checklistStartTime) {
      startChecklistTimer();
    }
  }, [selectedJob, activeTab]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/sprint-8" className="hover:text-gray-700">Sprint 8</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/sprint-8/logistics" className="hover:text-gray-700">Logistics</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900">Hub Console</span>
      </nav>

      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hub Console</h1>
          <p className="text-gray-600 mt-2">Operate all Hub-side work for Tier 2 and Tier 3 authentication and tagging</p>
        </div>
        <div className="flex space-x-3">
                    <select
            value={selectedHub}
            onChange={(e) => setSelectedHub(e.target.value)}
            className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {hubs.map(hub => (
              <option key={hub.id} value={hub.id.toString()}>
                {hub.hub_name} ({hub.hub_code})
              </option>
            ))}
          </select>
          {selectedJobs.length > 0 && (
            <button 
              onClick={() => setShowBulkActions(!showBulkActions)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2"
            >
              <Users className="h-4 w-4" />
              <span>Bulk Actions ({selectedJobs.length})</span>
          </button>
          )}
        </div>
      </div>

      {/* Detailed Hub Information */}
      {selectedHubDetails && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-blue-600" />
              Hub Manager
            </h2>
            <div className="text-sm text-gray-500">
              Monitor hub operations
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Hub Logo and Basic Info */}
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                {selectedHubDetails.logo ? (
                  <img 
                    src={selectedHubDetails.logo} 
                    alt={`${selectedHubDetails.name} logo`}
                    className="w-16 h-16 rounded-lg object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {selectedHubDetails.code}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{selectedHubDetails.name}</h3>
                  <p className="text-sm text-gray-500">Code: {selectedHubDetails.code}</p>
                  <div className="flex items-center mt-1">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      selectedHubDetails.status === 'active' ? 'bg-green-400' : 
                      selectedHubDetails.status === 'maintenance' ? 'bg-yellow-400' : 'bg-red-400'
                    }`}></div>
                    <span className={`text-xs font-medium ${
                      selectedHubDetails.status === 'active' ? 'text-green-600' : 
                      selectedHubDetails.status === 'maintenance' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {selectedHubDetails.status.charAt(0).toUpperCase() + selectedHubDetails.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Location and Contact */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  Location
                </h4>
                <p className="text-sm text-gray-900">{selectedHubDetails.location}</p>
                {selectedHubDetails.address && (
                  <div className="text-xs text-gray-600 mt-1">
                    {selectedHubDetails.address.street && <div>{selectedHubDetails.address.street}</div>}
                    <div>
                      {selectedHubDetails.address.city && selectedHubDetails.address.city}
                      {selectedHubDetails.address.postal_code && `, ${selectedHubDetails.address.postal_code}`}
                    </div>
                    {selectedHubDetails.address.country && <div>{selectedHubDetails.address.country}</div>}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {selectedHubDetails.timezone}
                </p>
              </div>
              
              {selectedHubDetails.contact_info && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    Contact
                  </h4>
                  {selectedHubDetails.contact_info.name && (
                    <p className="text-sm text-gray-900">{selectedHubDetails.contact_info.name}</p>
                  )}
                  {selectedHubDetails.contact_info.email && (
                    <p className="text-xs text-gray-600">{selectedHubDetails.contact_info.email}</p>
                  )}
                  {selectedHubDetails.contact_info.phone && (
                    <p className="text-xs text-gray-600">{selectedHubDetails.contact_info.phone}</p>
                  )}
                </div>
              )}
            </div>

            {/* Capabilities and Roles */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Shield className="h-4 w-4 mr-1" />
                  Capabilities
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedHubDetails.roles && selectedHubDetails.roles.map((role: string) => (
                    <span 
                      key={role}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        role === 'authenticator' ? 'bg-blue-100 text-blue-800' :
                        role === 'couturier' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                  ))}
                </div>
              </div>
              
              {selectedHubDetails.pricing && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    Pricing ({selectedHubDetails.pricing.currency || 'EUR'})
                  </h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    {selectedHubDetails.pricing.tier2_auth_fee > 0 && (
                      <div>Tier 2 Auth: {selectedHubDetails.pricing.tier2_auth_fee}</div>
                    )}
                    {selectedHubDetails.pricing.tier3_auth_fee > 0 && (
                      <div>Tier 3 Auth: {selectedHubDetails.pricing.tier3_auth_fee}</div>
                    )}
                    {selectedHubDetails.pricing.sew_fee > 0 && (
                      <div>Sewing: {selectedHubDetails.pricing.sew_fee}</div>
                    )}
                  </div>
                </div>
              )}
              
              {selectedHubDetails.operating_hours && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    Operating Hours
                  </h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    {Object.entries(selectedHubDetails.operating_hours).map(([day, hours]: [string, any]) => (
                      <div key={day} className="flex justify-between">
                        <span className="capitalize">{day}:</span>
                        <span className={hours.closed ? 'text-red-500' : 'text-gray-900'}>
                          {hours.closed ? 'Closed' : `${hours.open} - ${hours.close}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {selectedHubDetails.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">About This Hub</h4>
              <p className="text-sm text-gray-600 leading-relaxed">{selectedHubDetails.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today's Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{todayJobs}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">{overdueJobs}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">QA Needed</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredJobs.filter(job => job.qaNeeded && job.status === 'waiting_qa').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Truck className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ready Outbound</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredJobs.filter(job => job.status === 'ready_outbound').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Panel */}
      {showBulkActions && selectedJobs.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-purple-700">
                {selectedJobs.length} job{selectedJobs.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex space-x-2">
                <button className="bg-white border border-purple-300 text-purple-700 px-3 py-1 rounded text-sm hover:bg-purple-50">
                  Assign Technician
                </button>
                <button className="bg-white border border-purple-300 text-purple-700 px-3 py-1 rounded text-sm hover:bg-purple-50">
                  Mark Needs Rework
                </button>
                <button className="bg-white border border-purple-300 text-purple-700 px-3 py-1 rounded text-sm hover:bg-purple-50">
                  Print Intake Slips
                </button>
          </div>
          </div>
            <button 
              onClick={() => {setShowBulkActions(false); setSelectedJobs([]);}}
              className="text-purple-400 hover:text-purple-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Shipment ID, brand/model, Sender/Buyer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="both">All Tiers</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Status</option>
              <option value="awaiting_intake">Awaiting Intake</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_qa">Waiting QA</option>
              <option value="ready_outbound">Ready Outbound</option>
              <option value="overdue">Overdue</option>
            </select>
            <select
              value={filterWhen}
              onChange={(e) => setFilterWhen(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="overdue">Overdue</option>
              <option value="all">All Dates</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Priority</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              Jobs Queue ({sortedJobs.length})
            </h3>
            <div className="text-sm text-gray-500">
              Sorted by: Overdue first, then planned intake time
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedJobs.length === sortedJobs.length && sortedJobs.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedJobs(sortedJobs.map(job => job.shipment_id));
                      } else {
                        setSelectedJobs([]);
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shipment ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Planned Intake</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA Deadline</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outbound Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evidence Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center space-x-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-gray-500">Loading jobs...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="text-red-600">
                      <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                      <div className="text-sm">{error}</div>
                    </div>
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <Package className="h-6 w-6 mx-auto mb-2" />
                      <div className="text-sm">No jobs found for the selected filters</div>
                    </div>
                  </td>
                </tr>
              ) : sortedJobs.map((job) => {
                const plannedIntake = formatDateTime(job.planned_intake_time);
                const slaDeadline = formatDateTime(job.sla_deadline);
                const evidenceStatus = getEvidenceStatus(job.evidenceStatus); // Use actual job evidence status
                
                return (
                  <tr 
                    key={job.shipment_id} 
                    className={`hover:bg-gray-50 cursor-pointer ${job.isOverdue ? 'bg-red-50 border-l-4 border-red-400' : ''}`}
                    onClick={() => handleRowClick(job)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedJobs.includes(job.shipment_id)}
                        onChange={() => toggleJobSelection(job.shipment_id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center">
                            {job.shipment_id}
                            {job.isOverdue && (
                              <span className="ml-2 text-xs text-red-600 font-semibold">
                                {job.hoursOverdue}h overdue
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{job.brandModel}</div>
                          <div className="text-xs text-gray-400">
                            {job.sender_name} → {job.buyer_name}
                          </div>
                        </div>
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        job.tier === 3 
                          ? 'text-purple-700 bg-purple-100 border border-purple-200' 
                          : 'text-blue-700 bg-blue-100 border border-blue-200'
                      }`}>
                        T{job.tier}
                      </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        €{job.value.toLocaleString()}
                      </div>
                      <div className={`text-xs ${getPriorityColor(job.priority)}`}>
                        {job.priority.toUpperCase()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{plannedIntake.date}</div>
                      <div className="text-sm text-gray-500">{plannedIntake.time}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{slaDeadline.date}</div>
                      <div className="text-sm text-gray-500">{slaDeadline.time}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        job.outboundType === 'WG' 
                          ? 'text-green-700 bg-green-100' 
                          : 'text-orange-700 bg-orange-100'
                      }`}>
                        {job.outboundType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-900">{evidenceStatus}</span>
                        <div className="flex space-x-1">
                          <div className={`w-3 h-3 rounded-full ${job.evidenceStatus.photo ? 'bg-green-400' : 'bg-gray-300'}`} title="Photo" />
                          <div className={`w-3 h-3 rounded-full ${job.evidenceStatus.otp ? 'bg-green-400' : 'bg-gray-300'}`} title="OTP" />
                          <div className={`w-3 h-3 rounded-full ${job.evidenceStatus.seal ? 'bg-green-400' : 'bg-gray-300'}`} title="Seal" />
                        </div>
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div 
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${job.checklistProgress}%` }}
                          />
                      </div>
                        <span className="text-sm text-gray-700">{job.checklistProgress}%</span>
                    </div>
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {job.qaNeeded ? (
                        <span className="text-orange-600 font-medium">Y</span>
                      ) : (
                        <span className="text-gray-400">N</span>
                      )}
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                    <div className="flex space-x-2">
                        <button 
                          className="text-blue-600 hover:text-blue-900"
                          onClick={() => handleRowClick(job)}
                        >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Detail Slide-in Panel */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
          <div className="bg-white h-full w-full max-w-5xl shadow-xl overflow-y-auto transform transition-transform duration-300 ease-in-out">
            {/* Panel Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedJob.shipment_id}
                  </h2>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    selectedJob.tier === 3 
                      ? 'text-purple-700 bg-purple-100 border border-purple-200' 
                      : 'text-blue-700 bg-blue-100 border border-blue-200'
                  }`}>
                    Tier {selectedJob.tier}
                  </span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedJob.status)}`}>
                    {getStatusIcon(selectedJob.status)}
                    <span className="ml-1 capitalize">{selectedJob.status.replace('_', ' ')}</span>
                  </span>
                </div>
                <button 
                  onClick={() => {
                    setSelectedJob(null);
                    setActiveTab('overview');
                    setIntakeForm({
                      otp: '',
                      sealId: '',
                      sealPhoto: null,
                      photos360: [],
                      conditionNotes: '',
                      hasDamage: false,
                      damageDescription: '',
                      packageBarcode: '',
                      technicianId: 'current_user_id',
                      timestamp: new Date().toISOString()
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {/* Product Info */}
              <div className="mt-3 flex items-center space-x-6 text-sm text-gray-600">
                <span className="font-medium text-gray-900">{selectedJob.brandModel}</span>
                <span>€{selectedJob.value.toLocaleString()}</span>
                <span>{selectedJob.sender_name} → {selectedJob.buyer_name}</span>
                {selectedJob.assignedTechnician && (
                  <span>Tech: {selectedJob.assignedTechnician}</span>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="px-6 bg-white border-b border-gray-200">
              <nav className="flex space-x-8">
                {[
                  { id: 'overview', name: 'Overview', icon: Eye },
                  { id: 'intake', name: 'Intake (Chain of Custody)', icon: Package },
                  { id: 'processing', name: 'Processing', icon: Settings },
                  { id: 'qa', name: 'QA Validation', icon: CheckCircle },
                  { id: 'outbound', name: 'Outbound Preparation', icon: Truck }
                ].map((tab) => {
                  const Icon = tab.icon;
                  
                  // Determine if tab access is allowed
                  let isAccessible = true;
                  let accessReason = '';
                  
                  if (tab.id === 'processing' && !canAccessProcessing()) {
                    isAccessible = false;
                    accessReason = 'Complete intake first (OTP + seal + photos)';
                  } else if (tab.id === 'qa' && !canAccessQA()) {
                    isAccessible = false;
                    if (selectedJob?.tier === 2) {
                      accessReason = 'Complete processing first (tag_applied + tag photo)';
                    } else if (selectedJob?.tier === 3) {
                      accessReason = 'Complete processing first (nfc_installed + read/write tests)';
                    }
                  } else if (tab.id === 'outbound' && !canAccessOutbound()) {
                    isAccessible = false;
                    if (selectedJob?.tier === 3) {
                      accessReason = 'QA mandatory - must pass QA first';
                    } else {
                      accessReason = 'Complete QA requirements first';
                    }
                  }
                  
                  return (
                    <div key={tab.id} className="relative">
                      <button
                        onClick={() => {
                          if (isAccessible) {
                            setActiveTab(tab.id as any);
                          } else {
                            alert(`Access blocked: ${accessReason}`);
                          }
                        }}
                        disabled={!isAccessible}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : isAccessible
                            ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            : 'border-transparent text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                        title={!isAccessible ? accessReason : ''}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{tab.name}</span>
                        {!isAccessible && (
                          <div className="absolute -top-1 -right-1">
                            <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                          </div>
                        )}
                        {tab.id === 'qa' && isQAMandatory() && (
                          <span className="text-xs bg-red-100 text-red-600 px-1 py-0.5 rounded ml-1">
                            REQ
                          </span>
                        )}
                        {tab.id === 'qa' && requiresDoubleSign() && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-1 py-0.5 rounded ml-1">
                            2×
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Product:</span>
                        <span className="text-sm font-medium">{selectedJob.brandModel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Value:</span>
                        <span className="text-sm font-medium">€{selectedJob.value.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Priority:</span>
                        <span className={`text-sm font-medium ${getPriorityColor(selectedJob.priority)}`}>
                          {selectedJob.priority.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Planned Intake:</span>
                        <div className="text-right">
                          <span className="text-sm font-medium">{formatLocalTime(selectedJob.planned_intake_time).local}</span>
                          <div className="text-xs text-gray-500" title={formatLocalTime(selectedJob.planned_intake_time).absolute}>
                            {formatLocalTime(selectedJob.planned_intake_time).timezone}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">SLA Deadline:</span>
                        <div className="text-right">
                          <span className="text-sm font-medium">{formatLocalTime(selectedJob.sla_deadline).local}</span>
                          <div className="text-xs text-gray-500" title={formatLocalTime(selectedJob.sla_deadline).absolute}>
                            {formatLocalTime(selectedJob.sla_deadline).timezone}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Outbound Type:</span>
                        <span className="text-sm font-medium">{selectedJob.outboundType}</span>
                      </div>
                    </div>
                  </div>

                  {/* Workflow Progress */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Workflow Progress</h3>
          <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                          <Package className="h-5 w-5 text-gray-400" />
                          <span className="text-sm text-gray-600">Chain of Custody</span>
              </div>
                        <span className={`text-sm font-medium ${selectedJob.evidenceStatus.photo ? 'text-green-600' : 'text-gray-400'}`}>
                          {selectedJob.evidenceStatus.photo ? 'Complete' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Hash className="h-5 w-5 text-gray-400" />
                          <span className="text-sm text-gray-600">OTP Authentication</span>
                        </div>
                        <span className={`text-sm font-medium ${selectedJob.evidenceStatus.otp ? 'text-green-600' : 'text-gray-400'}`}>
                          {selectedJob.evidenceStatus.otp ? 'Complete' : 'Pending'}
                        </span>
                      </div>
                      {selectedJob.tier === 2 && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Tag className="h-5 w-5 text-gray-400" />
                            <span className="text-sm text-gray-600">Tag Application</span>
                          </div>
                          <span className="text-sm font-medium text-gray-400">Pending</span>
                        </div>
                      )}
                      {selectedJob.tier === 3 && (
                        <>
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Smartphone className="h-5 w-5 text-gray-400" />
                              <span className="text-sm text-gray-600">NFC Installation</span>
                            </div>
                            <span className="text-sm font-medium text-gray-400">Pending</span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Zap className="h-5 w-5 text-gray-400" />
                              <span className="text-sm text-gray-600">NFC Testing</span>
                            </div>
                            <span className="text-sm font-medium text-gray-400">Pending</span>
                          </div>
                        </>
                      )}
                      {selectedJob.qaNeeded && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <FileCheck className="h-5 w-5 text-gray-400" />
                            <span className="text-sm text-gray-600">QA Validation</span>
                          </div>
                          <span className="text-sm font-medium text-orange-600">Required</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'intake' && (
                <div className="max-w-4xl space-y-6">
                  {/* Enhanced Intake Header with Progress */}
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="relative">
                          {/* Progress Ring */}
                          <div className="w-16 h-16">
                            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 32 32">
                              <circle
                                cx="16"
                                cy="16"
                                r="14"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="transparent"
                                className="text-blue-200"
                              />
                              <circle
                                cx="16"
                                cy="16"
                                r="14"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="transparent"
                                strokeDasharray={`${getEvidenceProgress().percentage * 0.88} 88`}
                                className="text-blue-600"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-medium text-blue-900">
                                {Math.round(getEvidenceProgress().percentage)}%
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h3 className="font-medium text-blue-900 flex items-center space-x-2">
                            <Shield className="h-5 w-5" />
                            <span>Chain of Custody - Intake Verification</span>
                            <kbd className="px-1 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Ctrl+1</kbd>
                          </h3>
                          <p className="text-sm text-blue-700 mt-1">
                            Prove the item entered the Hub intact. Fast scan/upload flows supported.
                          </p>
                          {getEvidenceProgress().missing.length > 0 && (
                            <div className="mt-2 text-sm text-orange-600">
                              <span className="font-medium">Missing:</span> {getEvidenceProgress().missing.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-blue-700">
                          {isIntakeFormValid() ? '✅ Ready' : '⏳ Incomplete'}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          Evidence: {getEvidenceProgress().completed}/{getEvidenceProgress().total}
                        </div>
                        <div className="text-xs text-gray-500 mt-1" title={formatLocalTime(new Date().toISOString()).absolute}>
                          {formatLocalTime(new Date().toISOString()).local} ({formatLocalTime(new Date().toISOString()).timezone})
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Authentication */}
                    <div className="space-y-6">
                      {/* OTP Verification */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <Lock className="h-5 w-5 text-gray-600" />
                          <h4 className="font-medium text-gray-900">OTP Verification</h4>
                          <span className="text-red-500">*</span>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Intake OTP (from WG/DHL handoff)
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                maxLength={6}
                                value={intakeForm.otp}
                                onChange={(e) => setIntakeForm(prev => ({ ...prev, otp: e.target.value.replace(/\D/g, '') }))}
                                placeholder="123456 or scan barcode"
                                className={`w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                  intakeForm.otp && !validateOTP(intakeForm.otp, selectedJob.shipment_id) 
                                    ? 'border-red-300 bg-red-50' 
                                    : intakeForm.otp && validateOTP(intakeForm.otp, selectedJob.shipment_id)
                                    ? 'border-green-300 bg-green-50'
                                    : 'border-gray-300'
                                }`}
                                autoComplete="off"
                                autoFocus={activeTab === 'intake'}
                              />
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
                                <ScanLine className="h-4 w-4 text-gray-400" />
                                {intakeForm.otp && validateOTP(intakeForm.otp, selectedJob.shipment_id) && (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                )}
                              </div>
                            </div>
                            {intakeForm.otp && !validateOTP(intakeForm.otp, selectedJob.shipment_id) && (
                              <p className="text-sm text-red-600 mt-1">Invalid OTP format. Must be 6 digits.</p>
                            )}
                            {intakeForm.otp && validateOTP(intakeForm.otp, selectedJob.shipment_id) && (
                              <p className="text-sm text-green-600 mt-1">✓ OTP validated</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Package Barcode (Optional) */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <ScanLine className="h-5 w-5 text-gray-600" />
                          <h4 className="font-medium text-gray-900">Package Barcode</h4>
                          <span className="text-gray-400">(Optional)</span>
                        </div>
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={intakeForm.packageBarcode}
                            onChange={(e) => setIntakeForm(prev => ({ ...prev, packageBarcode: e.target.value }))}
                            placeholder="Scan or enter package barcode"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700">
                            <ScanLine className="h-4 w-4" />
                            <span>Scan Barcode</span>
            </button>
                        </div>
                      </div>

                      {/* Security Seal */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <Shield className="h-5 w-5 text-gray-600" />
                          <h4 className="font-medium text-gray-900">Security Seal</h4>
                          <span className="text-red-500">*</span>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Seal ID
                            </label>
                            <input
                              type="text"
                              value={intakeForm.sealId}
                              onChange={(e) => setIntakeForm(prev => ({ ...prev, sealId: e.target.value }))}
                              placeholder="Enter seal ID"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Seal Photo (Close-up)
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                              {intakeForm.sealPhoto ? (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <FileImage className="h-5 w-5 text-green-600" />
                                    <span className="text-sm text-gray-900">{intakeForm.sealPhoto.name}</span>
                                  </div>
                                  <button
                                    onClick={() => setIntakeForm(prev => ({ ...prev, sealPhoto: null }))}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                                                                ) : (
                                    <div className="text-center space-y-3">
                                      <div className="flex justify-center space-x-3">
                                        <label className="cursor-pointer flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50">
                                          <Camera className="h-6 w-6 text-gray-400" />
                                          <span className="text-xs text-gray-600">Camera</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={(e) => handleFileUpload(e.target.files, 'seal')}
                                          />
                                        </label>
                                        <label className="cursor-pointer flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50">
                                          <Upload className="h-6 w-6 text-gray-400" />
                                          <span className="text-xs text-gray-600">Upload</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleFileUpload(e.target.files, 'seal')}
                                          />
                                        </label>
                                      </div>
                                      <span className="text-sm text-gray-600">Seal photo required</span>
                                    </div>
                                  )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Photos & Condition */}
                    <div className="space-y-6">
                      {/* 360° Photos */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <RotateCcw className="h-5 w-5 text-gray-600" />
                          <h4 className="font-medium text-gray-900">360° Product Photos</h4>
                          <span className="text-red-500">*</span>
                        </div>
                        <div className="space-y-4">
                          <p className="text-sm text-gray-600">
                            Minimum 4 angles required. Recommended: front, back, left, right, top, bottom.
                          </p>
                          
                          {/* Photo Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            {intakeForm.photos360.map((photo, index) => (
                              <div key={index} className="relative border border-gray-200 rounded-lg p-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <FileImage className="h-4 w-4 text-green-600" />
                                    <span className="text-xs text-gray-900 truncate">{photo.name}</span>
                                  </div>
                                  <button
                                    onClick={() => removePhoto(index)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            
                            {/* Add Photo Buttons */}
                            {intakeForm.photos360.length < 12 && (
                              <>
                                <div className="border-2 border-dashed border-blue-300 rounded-lg p-3">
                                  <label className="cursor-pointer flex flex-col items-center space-y-1">
                                    <Camera className="h-6 w-6 text-blue-500" />
                                    <span className="text-xs text-blue-600 font-medium">Camera</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      multiple
                                      className="hidden"
                                      onChange={(e) => handleFileUpload(e.target.files, '360')}
                                    />
                                  </label>
                                </div>
                                <div className="border-2 border-dashed border-green-300 rounded-lg p-3">
                                  <label className="cursor-pointer flex flex-col items-center space-y-1">
                                    <Upload className="h-6 w-6 text-green-500" />
                                    <span className="text-xs text-green-600 font-medium">Upload</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      className="hidden"
                                      onChange={(e) => handleFileUpload(e.target.files, '360')}
                                    />
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                          
                          <div className="text-sm text-gray-600">
                            Photos: {intakeForm.photos360.length}/8 
                            {intakeForm.photos360.length >= 4 ? (
                              <span className="text-green-600 ml-2">✓ Minimum met</span>
                            ) : (
                              <span className="text-red-600 ml-2">Need {4 - intakeForm.photos360.length} more</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Condition Assessment */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <AlertCircle className="h-5 w-5 text-gray-600" />
                          <h4 className="font-medium text-gray-900">Condition Assessment</h4>
                          <span className="text-red-500">*</span>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Condition Notes
                            </label>
                            <textarea
                              value={intakeForm.conditionNotes}
                              onChange={(e) => setIntakeForm(prev => ({ ...prev, conditionNotes: e.target.value }))}
                              placeholder="Describe condition: scratches, wear, defects, etc."
                              rows={4}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          
              <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="damage-flag"
                              checked={intakeForm.hasDamage}
                              onChange={(e) => setIntakeForm(prev => ({ ...prev, hasDamage: e.target.checked }))}
                              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                            />
                            <label htmlFor="damage-flag" className="text-sm font-medium text-gray-700">
                              Flag damage requiring incident report
                            </label>
              </div>
                          
                          {intakeForm.hasDamage && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Damage Description
                              </label>
                              <textarea
                                value={intakeForm.damageDescription}
                                onChange={(e) => setIntakeForm(prev => ({ ...prev, damageDescription: e.target.value }))}
                                placeholder="Describe the damage in detail..."
                                rows={3}
                                className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-red-50"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit Section */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-600">
                          Form Status: {isIntakeFormValid() ? (
                            <span className="text-green-600 font-medium">✓ Ready to submit</span>
                          ) : (
                            <span className="text-red-600 font-medium">Missing required fields</span>
                          )}
                        </div>
                        {intakeForm.hasDamage && (
                          <div className="flex items-center space-x-2 text-orange-600">
                            <AlertOctagon className="h-4 w-4" />
                            <span className="text-sm font-medium">Damage flagged - incident will be created</span>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => setActiveTab('overview')}
                          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
                        >
                          Cancel
            </button>
                        <button
                          onClick={handleIntakeSubmit}
                          disabled={!isIntakeFormValid() || isProcessingIntake}
                          className={`px-6 py-2 rounded-lg font-medium flex items-center space-x-2 ${
                            isIntakeFormValid() && !isProcessingIntake
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {isProcessingIntake ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              <span>Complete Intake</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'processing' && (
                <div className="max-w-6xl space-y-6">
                  {/* Processing Header */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                        <Settings className="h-6 w-6 text-purple-600" />
                        <div>
                          <h3 className="font-medium text-purple-900">
                            {selectedJob.tier === 2 ? 'Tier 2: Authentication + Tag Application' : 'Tier 3: Authentication + NFC Installation + Sewing'}
                          </h3>
                          <p className="text-sm text-purple-700 mt-1">
                            Complete all required steps. Each item is mandatory for final approval.
                          </p>
              </div>
                      </div>
                      <div className="text-sm text-purple-700">
                        Progress: {processingChecklist.evidenceGallery.completed.length}/{processingChecklist.evidenceGallery.completed.length + processingChecklist.evidenceGallery.missing.length}
                      </div>
                    </div>
                  </div>

                  {/* Evidence Gallery */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="font-medium text-gray-900 mb-4 flex items-center space-x-2">
                      <FileImage className="h-5 w-5 text-gray-600" />
                      <span>Evidence Gallery</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-sm font-medium text-green-700 mb-2">✓ Completed ({processingChecklist.evidenceGallery.completed.length})</h5>
                        <div className="space-y-1">
                          {processingChecklist.evidenceGallery.completed.map((item, index) => (
                            <div key={index} className="flex items-center space-x-2 text-sm text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h5 className="text-sm font-medium text-red-700 mb-2">⚠ Missing ({processingChecklist.evidenceGallery.missing.length})</h5>
                        <div className="space-y-1">
                          {processingChecklist.evidenceGallery.missing.map((item, index) => (
                            <div key={index} className="flex items-center space-x-2 text-sm text-red-600">
                              <AlertCircle className="h-4 w-4" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Split content into separate file for easier editing */}
                  <div className="text-center py-8 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 font-medium">Processing Checklists Ready</p>
                    <p className="text-sm text-blue-600 mt-1">Tier-specific workflows implemented below</p>
                  </div>
                </div>
              )}

              {activeTab === 'qa' && (
                <div className="max-w-5xl space-y-6">
                  {/* QA Header */}
                  <div className={`border rounded-lg p-4 ${
                    isQARequired() 
                      ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200' 
                      : 'bg-gradient-to-r from-green-50 to-blue-50 border-green-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className={`h-6 w-6 ${isQARequired() ? 'text-red-600' : 'text-green-600'}`} />
                        <div>
                          <h3 className={`font-medium ${isQARequired() ? 'text-red-900' : 'text-green-900'}`}>
                            Quality Assurance - {selectedJob.tier === 2 ? 'Tier 2 (Optional)' : 'Tier 3 (Mandatory)'}
                          </h3>
                          <p className={`text-sm mt-1 ${isQARequired() ? 'text-red-700' : 'text-green-700'}`}>
                            {isQARequired() 
                              ? 'Second person review required before outbound approval'
                              : 'Optional quality check - can proceed directly to outbound if not needed'
                            }
                          </p>
                        </div>
                      </div>
                      <div className={`text-sm font-medium ${isQARequired() ? 'text-red-700' : 'text-green-700'}`}>
                        {isQARequired() ? 'MANDATORY' : 'OPTIONAL'}
                      </div>
                    </div>
                  </div>

                  {/* QA Personnel */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <User className="h-5 w-5 text-gray-600" />
                      <h4 className="font-medium text-gray-900">QA Personnel</h4>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Assigned QA Inspector
                        </label>
                        <input
                          type="text"
                          value={qaValidation.qaPersonnelName}
                          onChange={(e) => setQAValidation(prev => ({ ...prev, qaPersonnelName: e.target.value }))}
                          placeholder="Enter QA inspector name"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="text-sm text-gray-500 pt-6">
                        ID: {qaValidation.qaPersonnelId}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Review Checklist */}
                    <div className="space-y-6">
                      {selectedJob.tier === 2 && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center space-x-2 mb-4">
                            <Eye className="h-5 w-5 text-gray-600" />
                            <h4 className="font-medium text-gray-900">Tier 2 QA Checklist</h4>
                            <span className="text-green-600 text-sm">(Optional)</span>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="tier2-visual-check"
                                checked={qaValidation.tier2VisualCheck}
                                onChange={(e) => setQAValidation(prev => ({ ...prev, tier2VisualCheck: e.target.checked }))}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label htmlFor="tier2-visual-check" className="text-sm font-medium text-gray-700">
                                Visual inspection of tag placement photos completed
                              </label>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="tier2-tag-approved"
                                checked={qaValidation.tier2TagPlacementApproved}
                                onChange={(e) => setQAValidation(prev => ({ ...prev, tier2TagPlacementApproved: e.target.checked }))}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <label htmlFor="tier2-tag-approved" className="text-sm font-medium text-gray-700">
                                Tag placement quality approved
                              </label>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                QA Notes (Optional)
                              </label>
                              <textarea
                                value={qaValidation.tier2Notes}
                                onChange={(e) => setQAValidation(prev => ({ ...prev, tier2Notes: e.target.value }))}
                                placeholder="Any observations or notes about the tag application..."
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedJob.tier === 3 && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center space-x-2 mb-4">
                            <Shield className="h-5 w-5 text-gray-600" />
                            <h4 className="font-medium text-gray-900">Tier 3 QA Checklist</h4>
                            <span className="text-red-600 text-sm">(Mandatory)</span>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="tier3-auth-photos"
                                checked={qaValidation.tier3AuthPhotosReviewed}
                                onChange={(e) => setQAValidation(prev => ({ ...prev, tier3AuthPhotosReviewed: e.target.checked }))}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label htmlFor="tier3-auth-photos" className="text-sm font-medium text-gray-700">
                                Authentication photos reviewed and verified
                              </label>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="tier3-sewing-quality"
                                checked={qaValidation.tier3SewingQualityApproved}
                                onChange={(e) => setQAValidation(prev => ({ ...prev, tier3SewingQualityApproved: e.target.checked }))}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label htmlFor="tier3-sewing-quality" className="text-sm font-medium text-gray-700">
                                Sewing quality and stitch integrity approved
                              </label>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="tier3-nfc-logs"
                                checked={qaValidation.tier3NfcLogsReviewed}
                                onChange={(e) => setQAValidation(prev => ({ ...prev, tier3NfcLogsReviewed: e.target.checked }))}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label htmlFor="tier3-nfc-logs" className="text-sm font-medium text-gray-700">
                                NFC read/write test logs reviewed and verified
                              </label>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="tier3-second-person"
                                checked={qaValidation.tier3SecondPersonConfirmed}
                                onChange={(e) => setQAValidation(prev => ({ ...prev, tier3SecondPersonConfirmed: e.target.checked }))}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <label htmlFor="tier3-second-person" className="text-sm font-medium text-gray-700">
                                <strong>Second person review completed</strong> (different from processing technician)
                              </label>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                QA Review Notes
                              </label>
                              <textarea
                                value={qaValidation.tier3Notes}
                                onChange={(e) => setQAValidation(prev => ({ ...prev, tier3Notes: e.target.value }))}
                                placeholder="Detailed review notes, any concerns, quality observations..."
                                rows={4}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column - Evidence Review */}
                    <div className="space-y-6">
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <FileImage className="h-5 w-5 text-gray-600" />
                          <h4 className="font-medium text-gray-900">Evidence Review</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Processing Evidence Available</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Photo Comparison:</span>
                                <span className={processingChecklist.photoComparison ? 'text-green-600' : 'text-red-600'}>
                                  {processingChecklist.photoComparison ? '✓ Available' : '✗ Missing'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Authentication Photos:</span>
                                <span className={processingChecklist.authPhotos.length > 0 ? 'text-green-600' : 'text-red-600'}>
                                  {processingChecklist.authPhotos.length} photos
                                </span>
                              </div>
                              {selectedJob.tier === 2 && (
                                <div className="flex justify-between">
                                  <span>Tag Placement Photo:</span>
                                  <span className={processingChecklist.tagPlacementPhoto ? 'text-green-600' : 'text-red-600'}>
                                    {processingChecklist.tagPlacementPhoto ? '✓ Available' : '✗ Missing'}
                                  </span>
                                </div>
                              )}
                              {selectedJob.tier === 3 && (
                                <div className="flex justify-between">
                                  <span>NFC Test Screenshot:</span>
                                  <span className={processingChecklist.nfcTestScreenshot ? 'text-green-600' : 'text-red-600'}>
                                    {processingChecklist.nfcTestScreenshot ? '✓ Available' : '✗ Missing'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {selectedJob.tier === 3 && (
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <h5 className="text-sm font-medium text-blue-700 mb-2">NFC Test Results</h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span>Read Test:</span>
                                  <span className={processingChecklist.nfcReadTest ? 'text-green-600' : 'text-red-600'}>
                                    {processingChecklist.nfcReadTest ? '✓ PASS' : '✗ FAIL'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Write Test:</span>
                                  <span className={processingChecklist.nfcWriteTest ? 'text-green-600' : 'text-red-600'}>
                                    {processingChecklist.nfcWriteTest ? '✓ PASS' : '✗ FAIL'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>NFC UID:</span>
                                  <span className="text-gray-700">{processingChecklist.reservedNfcUid}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* QA Status */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <AlertCircle className="h-5 w-5 text-gray-600" />
                          <h4 className="font-medium text-gray-900">QA Status</h4>
                        </div>
                        
                        <div className="space-y-3">
                          <div className={`p-3 rounded-lg ${
                            qaValidation.qaStatus === 'pending' ? 'bg-yellow-50 text-yellow-800' :
                            qaValidation.qaStatus === 'passed' ? 'bg-green-50 text-green-800' :
                            qaValidation.qaStatus === 'failed' ? 'bg-red-50 text-red-800' :
                            'bg-orange-50 text-orange-800'
                          }`}>
                            <div className="text-sm font-medium">
                              Status: {qaValidation.qaStatus.toUpperCase().replace('_', ' ')}
                            </div>
                            {qaValidation.qaCompletedAt && (
                              <div className="text-xs mt-1">
                                Completed: {new Date(qaValidation.qaCompletedAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                          
                          {qaValidation.qaStatus === 'rework_required' && (
                            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                              <div className="text-sm font-medium text-red-800 mb-1">Rework Required</div>
                              <div className="text-sm text-red-700">
                                <div><strong>Reason:</strong> {qaValidation.reworkReason}</div>
                                <div className="mt-1"><strong>Instructions:</strong> {qaValidation.reworkInstructions}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* QA Decision Section */}
                  {qaValidation.qaStatus === 'pending' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="text-sm text-gray-600">
                            QA Form Status: {isQAFormValid() ? (
                              <span className="text-green-600 font-medium">✓ Ready for decision</span>
                            ) : (
                              <span className="text-red-600 font-medium">Complete all required items</span>
                            )}
                          </div>
                          {!isQARequired() && (
                            <div className="text-xs text-blue-600 font-medium">
                              QA is optional for Tier 2 - can skip if not needed
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => setActiveTab('processing')}
                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
                          >
                            Back to Processing
                          </button>
                          {!isQARequired() && (
                            <button
                              onClick={() => handleQASubmit('pass')}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                            >
                              Skip QA - Ready Outbound
                            </button>
                          )}
                          <button
                            onClick={() => handleQASubmit('fail')}
                            disabled={!isQAFormValid()}
                            className={`px-4 py-2 rounded-lg font-medium ${
                              isQAFormValid()
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            QA Fail - Rework
                          </button>
                          <button
                            onClick={() => handleQASubmit('pass')}
                            disabled={!isQAFormValid() || isProcessingQA}
                            className={`px-6 py-2 rounded-lg font-medium flex items-center space-x-2 ${
                              isQAFormValid() && !isProcessingQA
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {isProcessingQA ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Processing...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4" />
                                <span>QA Pass - Ready Outbound</span>
                              </>
                            )}
            </button>
          </div>
        </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'outbound' && (
                <div className="max-w-5xl space-y-6">
                  {/* Outbound Header */}
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Truck className="h-6 w-6 text-green-600" />
                        <div>
                          <h3 className="font-medium text-green-900">
                            Outbound Preparation - {outboundPreparation.plannedMode} Route
                          </h3>
                          <p className="text-sm text-green-700 mt-1">
                            Prepare return leg and finalize hub processing. All items required for completion.
                          </p>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-green-700">
                        Mode: {outboundPreparation.plannedMode}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Route & Logistics */}
                    <div className="space-y-6">
                      {outboundPreparation.plannedMode === 'WG' && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center space-x-2 mb-4">
                            <Truck className="h-5 w-5 text-gray-600" />
                            <h4 className="font-medium text-gray-900">WG Route Confirmation</h4>
                          </div>
                          
          <div className="space-y-4">
            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Confirmed Intake Slot
                              </label>
                              <input
                                type="text"
                                value={outboundPreparation.wgIntakeSlot || ''}
                                readOnly
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                              />
              </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Confirmed Delivery Slot
                              </label>
                              <input
                                type="text"
                                value={outboundPreparation.wgDeliverySlot || ''}
                                readOnly
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                              />
              </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Operator Brief
                              </label>
                              <div className="flex items-center space-x-3">
                                {outboundPreparation.wgOperatorBrief ? (
                                  <div className="flex items-center space-x-2 text-green-600">
                                    <FileCheck className="h-5 w-5" />
                                    <span className="text-sm">{outboundPreparation.wgOperatorBrief.name}</span>
            </div>
                                ) : (
                                  <span className="text-sm text-gray-500">Not generated</span>
                                )}
                                <button
                                  onClick={generateWGOperatorBrief}
                                  disabled={outboundPreparation.wgOperatorBriefGenerated}
                                  className={`px-3 py-2 text-sm rounded-lg ${
                                    outboundPreparation.wgOperatorBriefGenerated
                                      ? 'bg-green-100 text-green-700 cursor-not-allowed'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  {outboundPreparation.wgOperatorBriefGenerated ? 'Generated' : 'Generate Brief'}
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                PII will be masked automatically for operator security
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {outboundPreparation.plannedMode === 'DHL' && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center space-x-2 mb-4">
                            <Package className="h-5 w-5 text-gray-600" />
                            <h4 className="font-medium text-gray-900">DHL Label Confirmation</h4>
                          </div>
                          
                          <div className="space-y-4">
            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tracking Number
                              </label>
                              <input
                                type="text"
                                value={outboundPreparation.dhlTrackingNumber || ''}
                                readOnly
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                              />
              </div>
                            
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id="dhl-label-confirmed"
                                checked={outboundPreparation.dhlLabelConfirmed}
                                onChange={(e) => setOutboundPreparation(prev => ({ ...prev, dhlLabelConfirmed: e.target.checked }))}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label htmlFor="dhl-label-confirmed" className="text-sm font-medium text-gray-700">
                                DHL shipping label confirmed and ready
                              </label>
              </div>
                            
                            <div>
                              <a
                                href={outboundPreparation.dhlLabelUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
                              >
                                <ExternalLink className="h-4 w-4" />
                                <span>View/Create DHL Label</span>
                              </a>
                              <p className="text-xs text-gray-500 mt-1">
                                Opens DHL label management page if label is missing
                              </p>
            </div>
                          </div>
                        </div>
                      )}

                      {/* Outbound Sealing */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <Shield className="h-5 w-5 text-gray-600" />
                          <h4 className="font-medium text-gray-900">Outbound Sealing</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="seal-required"
                              checked={outboundPreparation.outboundSealRequired}
                              onChange={(e) => setOutboundPreparation(prev => ({ ...prev, outboundSealRequired: e.target.checked }))}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="seal-required" className="text-sm font-medium text-gray-700">
                              Outbound sealing required by policy
                            </label>
                          </div>
                          
                          {outboundPreparation.outboundSealRequired && (
                            <>
            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  New Outbound Seal ID
                                </label>
                                <input
                                  type="text"
                                  value={outboundPreparation.outboundSealId || ''}
                                  readOnly
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Auto-generated unique seal ID for outbound security
                                </p>
              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Outbound Seal Photo
                                </label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                                  {outboundPreparation.outboundSealPhoto ? (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <FileImage className="h-5 w-5 text-green-600" />
                                        <span className="text-sm text-gray-900">{outboundPreparation.outboundSealPhoto.name}</span>
              </div>
                                      <button
                                        onClick={() => setOutboundPreparation(prev => ({ ...prev, outboundSealPhoto: null }))}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
            </div>
                                  ) : (
                                    <label className="cursor-pointer flex flex-col items-center space-y-2">
                                      <Camera className="h-8 w-8 text-gray-400" />
                                      <span className="text-sm text-gray-600">Upload seal photo</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleOutboundFileUpload(e.target.files, 'seal_photo')}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
          </div>
        </div>
      </div>

                    {/* Right Column - Final Documentation */}
                    <div className="space-y-6">
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <Camera className="h-5 w-5 text-gray-600" />
                          <h4 className="font-medium text-gray-900">Final Documentation Photos</h4>
                          <span className="text-red-500">*</span>
            </div>
                        
                        <div className="space-y-4">
                          <p className="text-sm text-gray-600">
                            {selectedJob.tier === 2 
                              ? 'Capture final photos showing the item with tag clearly visible and properly placed.'
                              : 'Capture final photos showing the item with NFC location clearly visible and properly installed.'
                            }
                          </p>
                          
                          <div className="grid grid-cols-2 gap-3">
                            {outboundPreparation.finalPhotos.map((photo, index) => (
                              <div key={index} className="relative border border-gray-200 rounded-lg p-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <FileImage className="h-4 w-4 text-green-600" />
                                    <span className="text-xs text-gray-900 truncate">{photo.name}</span>
                                  </div>
                                  <button
                                    onClick={() => removeFinalPhoto(index)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
          </button>
            </div>
                              </div>
                            ))}
                            
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                              <label className="cursor-pointer flex flex-col items-center space-y-1">
                                <Plus className="h-6 w-6 text-gray-400" />
                                <span className="text-xs text-gray-600">Add Photo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => handleOutboundFileUpload(e.target.files, 'final_photos')}
                                />
                              </label>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="final-photos-taken"
                              checked={outboundPreparation.finalPhotosTaken}
                              onChange={(e) => setOutboundPreparation(prev => ({ ...prev, finalPhotosTaken: e.target.checked }))}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <label htmlFor="final-photos-taken" className="text-sm font-medium text-gray-700">
                              Final photos completed - {selectedJob.tier === 2 ? 'tag' : 'NFC'} clearly visible
                            </label>
                          </div>
                          
                          <div className="text-sm text-gray-600">
                            Photos: {outboundPreparation.finalPhotos.length}
                            {outboundPreparation.finalPhotos.length > 0 && outboundPreparation.finalPhotosTaken ? (
                              <span className="text-green-600 ml-2">✓ Complete</span>
                            ) : (
                              <span className="text-red-600 ml-2">Required</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Definition of Done (DoD) Status */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <Shield className="h-5 w-5 text-gray-600" />
                          <h4 className="font-medium text-gray-900">Definition of Done (DoD)</h4>
                        </div>
                        
                        <div className="space-y-3">
                          {(() => {
                            const checklistValidation = validateFullChecklist();
                            const inventoryValidation = validateInventoryAtomicity();
                            const tier3PassportValidation = validateTier3PassportReadiness();
                            const qaOutcome = getQAOutcomeLog();
                            
                            return (
                              <>
                                <div className={`p-3 rounded-lg ${
                                  checklistValidation.valid ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                                }`}>
                                  <div className="text-sm font-medium">
                                    {checklistValidation.valid ? '✅' : '❌'} Full Checklist & Evidence
                                  </div>
                                  {!checklistValidation.valid && (
                                    <div className="text-xs mt-1">
                                      {checklistValidation.errors.slice(0, 2).join(', ')}
                                      {checklistValidation.errors.length > 2 && ` +${checklistValidation.errors.length - 2} more`}
                                    </div>
                                  )}
                                </div>
                                
                                <div className={`p-3 rounded-lg ${
                                  inventoryValidation.valid ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                                }`}>
                                  <div className="text-sm font-medium">
                                    {inventoryValidation.valid ? '✅' : '❌'} Inventory Atomicity
                                  </div>
                                  {!inventoryValidation.valid && (
                                    <div className="text-xs mt-1">
                                      {inventoryValidation.errors[0]}
                                    </div>
                                  )}
                                </div>
                                
                                {selectedJob.tier === 3 && (
                                  <div className={`p-3 rounded-lg ${
                                    tier3PassportValidation.ready ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                                  }`}>
                                    <div className="text-sm font-medium">
                                      {tier3PassportValidation.ready ? '✅' : '❌'} Tier 3 Passport Readiness
                                    </div>
                                    {!tier3PassportValidation.ready && tier3PassportValidation.reason && (
                                      <div className="text-xs mt-1">
                                        {tier3PassportValidation.reason}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                <div className={`p-3 rounded-lg ${
                                  qaOutcome.status === 'passed' || (selectedJob.tier === 2 && qaOutcome.status === 'pending') 
                                    ? 'bg-green-50 text-green-800' 
                                    : qaOutcome.reworkAvailable 
                                    ? 'bg-orange-50 text-orange-800'
                                    : 'bg-red-50 text-red-800'
                                }`}>
                                  <div className="text-sm font-medium">
                                    {qaOutcome.status === 'passed' || (selectedJob.tier === 2 && qaOutcome.status === 'pending') ? '✅' : '⚠️'} QA Outcome & Logging
                                  </div>
                                  <div className="text-xs mt-1">
                                    {qaOutcome.details}
                                    {qaOutcome.reworkAvailable && ' (Rework available)'}
                                  </div>
                                </div>
                                
                                <div className={`p-3 rounded-lg ${
                                  isOutboundHandoffReady() ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                                }`}>
                                  <div className="text-sm font-medium">
                                    {isOutboundHandoffReady() ? '✅' : '❌'} Outbound Handoff Prepared
                                  </div>
                                  <div className="text-xs mt-1">
                                    {outboundPreparation.plannedMode === 'WG' 
                                      ? (outboundPreparation.wgOperatorBriefGenerated ? 'WG operator brief generated' : 'WG operator brief required')
                                      : (outboundPreparation.dhlLabelConfirmed ? 'DHL label confirmed' : 'DHL label confirmation required')
                                    }
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Completion Status */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <CheckCircle className="h-5 w-5 text-gray-600" />
                          <h4 className="font-medium text-gray-900">Hub Job Status</h4>
                        </div>
                        
                        <div className="space-y-3">
                          <div className={`p-3 rounded-lg ${
                            outboundPreparation.hubJobCompleted ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
                          }`}>
                            <div className="text-sm font-medium">
                              Status: {outboundPreparation.hubJobCompleted ? 'HUB COMPLETED' : 'IN PROGRESS'}
                            </div>
                            {outboundPreparation.completedAt && (
                              <div className="text-xs mt-1">
                                Completed: {new Date(outboundPreparation.completedAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                          
                          {outboundPreparation.hubJobCompleted && (
                            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                              <div className="text-sm font-medium text-blue-800 mb-1">Passport Signals Sent</div>
                              <div className="text-sm text-blue-700">
                                {selectedJob.tier === 2 
                                  ? '✓ T2: Ready for passport verification'
                                  : '✓ T3: Ready for passport activation'
                                }
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Completion Section */}
                  {!outboundPreparation.hubJobCompleted && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="text-sm text-gray-600">
                            Outbound Status: {canCompleteHub() ? (
                              <span className="text-green-600 font-medium">✓ Ready for completion</span>
                            ) : (
                              <span className="text-red-600 font-medium">Complete all required items</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            Final step to complete hub processing
                          </div>
                        </div>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => setActiveTab('qa')}
                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
                          >
                            Back to QA
          </button>
                          <button
                            onClick={handleHubCompletion}
                            disabled={!canCompleteHub()}
                            className={`px-6 py-2 rounded-lg font-medium flex items-center space-x-2 ${
                              canCompleteHub()
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span>Complete Hub Job</span>
                          </button>
            </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Incident Report Modal */}
      {incidentModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="h-6 w-6 text-red-600" />
                <h2 className="text-xl font-semibold text-gray-900">Create Incident Report</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">
                  Damage has been flagged during intake. An incident report must be created before processing can continue.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Incident Type</label>
                <select
                  value={incidentModal.type}
                  onChange={(e) => setIncidentModal(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="damage">Damage</option>
                  <option value="security">Security Issue</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                <select
                  value={incidentModal.severity}
                  onChange={(e) => setIncidentModal(prev => ({ ...prev, severity: e.target.value as any }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={incidentModal.description}
                  onChange={(e) => setIncidentModal(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Provide detailed description of the incident..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setIncidentModal({ isOpen: false, type: 'damage', description: '', severity: 'medium' })}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleIncidentReport}
                disabled={!incidentModal.description.trim()}
                className={`px-4 py-2 rounded-lg font-medium ${
                  incidentModal.description.trim()
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Create Incident & Continue
          </button>
        </div>
      </div>
        </div>
      )}

      {/* Assignment Modal - Different Unit */}
      {assignmentModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="h-6 w-6 text-orange-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Assign Different {assignmentModal.type === 'tag' ? 'Tag' : 'NFC'} Unit
                </h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-700">
                  Reserved {assignmentModal.type === 'tag' ? 'Tag' : 'NFC'} unit not found or unavailable. 
                  Assign a different unit and provide justification. This change will be logged and may require Ops approval.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New {assignmentModal.type === 'tag' ? 'Tag' : 'NFC'} Unit ID
                </label>
                <input
                  type="text"
                  value={assignmentModal.newUnitId}
                  onChange={(e) => setAssignmentModal(prev => ({ ...prev, newUnitId: e.target.value }))}
                  placeholder={`Enter new ${assignmentModal.type === 'tag' ? 'Tag' : 'NFC'} ID`}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Change</label>
                <textarea
                  value={assignmentModal.reason}
                  onChange={(e) => setAssignmentModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Explain why the original unit cannot be used..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="requires-ops-approval"
                  checked={assignmentModal.requiresOpsApproval}
                  onChange={(e) => setAssignmentModal(prev => ({ ...prev, requiresOpsApproval: e.target.checked }))}
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="requires-ops-approval" className="text-sm font-medium text-gray-700">
                  Requires Operations approval (recommended for high-value items)
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setAssignmentModal({ isOpen: false, type: 'tag', reason: '', newUnitId: '', requiresOpsApproval: false })}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignDifferentUnit}
                disabled={!assignmentModal.newUnitId.trim() || !assignmentModal.reason.trim()}
                className={`px-4 py-2 rounded-lg font-medium ${
                  assignmentModal.newUnitId.trim() && assignmentModal.reason.trim()
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Assign & Log Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rework Modal */}
      {reworkModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="h-6 w-6 text-red-600" />
                <h2 className="text-xl font-semibold text-gray-900">QA Failed - Initiate Rework</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">
                  Quality assurance has failed. The item must be sent for rework before it can proceed to outbound.
                  Provide detailed reason and specific instructions for the rework process.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Failure Severity</label>
                <select
                  value={reworkModal.severity}
                  onChange={(e) => setReworkModal(prev => ({ ...prev, severity: e.target.value as any }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="minor">Minor - Simple fixes required</option>
                  <option value="major">Major - Significant rework needed</option>
                  <option value="critical">Critical - Complete redo required</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Failure Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reworkModal.reason}
                  onChange={(e) => setReworkModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Describe specifically what failed QA inspection..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rework Instructions <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reworkModal.instructions}
                  onChange={(e) => setReworkModal(prev => ({ ...prev, instructions: e.target.value }))}
                  placeholder="Provide specific instructions for how to fix the issues..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-sm text-yellow-800">
                  <strong>Note:</strong> This will set the job status to "Rework Required" and notify the processing team.
                  The item cannot proceed to outbound until rework is completed and QA is passed.
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setReworkModal({ isOpen: false, reason: '', instructions: '', severity: 'minor' })}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleReworkSubmit}
                disabled={!reworkModal.reason.trim() || !reworkModal.instructions.trim()}
                className={`px-4 py-2 rounded-lg font-medium ${
                  reworkModal.reason.trim() && reworkModal.instructions.trim()
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Initiate Rework
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hub Completion Modal */}
      {completionModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <h2 className="text-xl font-semibold text-gray-900">Complete Hub Job</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700">
                  Ready to complete hub processing for <strong>{selectedJob?.shipment_id}</strong>. 
                  This will mark the job as "HubCompleted" and trigger passport readiness signals.
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Events to be triggered:</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>• <strong>hub.job.completed</strong> - Main completion event</div>
                  {selectedJob?.tier === 2 && (
                    <>
                      <div>• <strong>tag.applied</strong> - Tag application confirmed</div>
                      <div>• <strong>Passport Signal:</strong> T2 ready for verification</div>
                    </>
                  )}
                  {selectedJob?.tier === 3 && (
                    <>
                      <div>• <strong>nfc.installed</strong> - NFC installation confirmed</div>
                      <div>• <strong>Passport Signal:</strong> T3 ready for activation</div>
                    </>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Final Completion Notes (Optional)
                </label>
                <textarea
                  value={completionModal.finalNotes}
                  onChange={(e) => setCompletionModal(prev => ({ ...prev, finalNotes: e.target.value }))}
                  placeholder="Any final notes about the hub processing..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="confirm-completion"
                  checked={completionModal.confirmCompletion}
                  onChange={(e) => setCompletionModal(prev => ({ ...prev, confirmCompletion: e.target.checked }))}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="confirm-completion" className="text-sm font-medium text-gray-700">
                  I confirm all processing steps have been completed and documented
                </label>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-sm text-yellow-800">
                  <strong>Note:</strong> This action cannot be undone. The item will be marked as ready for outbound dispatch.
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setCompletionModal({ isOpen: false, finalNotes: '', confirmCompletion: false })}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmHubCompletion}
                disabled={!completionModal.confirmCompletion || isProcessingOutbound}
                className={`px-6 py-2 rounded-lg font-medium flex items-center space-x-2 ${
                  completionModal.confirmCompletion && !isProcessingOutbound
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isProcessingOutbound ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Completing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Complete Hub Job</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
