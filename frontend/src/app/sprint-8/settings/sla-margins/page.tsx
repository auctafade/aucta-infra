'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as SLAPoliciesAPI from '@/lib/slaPoliciesApi';
import SettingsNavigation, { useSettingsAccess } from '@/components/SettingsNavigation';
import SettingsEventAPI, { createStateSnapshot } from '@/lib/eventAuditSystem';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { 
  Save, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Users, 
  History, 
  GitCompare, 
  Settings,
  Target,
  TrendingUp,
  PlayCircle,
  FileText,
  Download,
  Bell,
  Shield,
  ChevronDown,
  ChevronUp,
  Info,
  RotateCcw,
  Timer,
  Zap,
  X,
  ExternalLink,
  HelpCircle,
  RefreshCw,
  AlertCircle,
  Clock12
} from 'lucide-react';

// Use the API types
type PolicyData = SLAPoliciesAPI.PolicyData;
type SLATargets = SLAPoliciesAPI.SLATargets;
type MarginThresholds = SLAPoliciesAPI.MarginThresholds;
type SimulationResult = SLAPoliciesAPI.SimulationResult;

// Remove duplicate interface definitions - using API types now

interface HistoryEntry {
  version: string;
  editor: string;
  timestamp: string;
  changeReason: string;
  slaChanged: boolean;
  marginsChanged: boolean;
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface TelemetryData {
  editStartTime: number;
  simulationCount: number;
  simulationTotalTime: number;
  approvalLatency?: number;
  routesBlockedDelta?: number;
}

interface ApprovalRequest {
  id: string;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  approvers: Array<{
    role: 'ops_admin' | 'finance_approver';
    email: string;
    approvedAt?: string;
  }>;
  status: 'pending' | 'approved' | 'rejected';
}

interface PolicyEvent {
  type: 'settings.sla.updated' | 'settings.margin.updated' | 'settings.policy.published' | 'settings.policy.rolled_back' | 'quote.recompute.requested';
  version: string;
  effectiveAt: string;
  fieldsChanged?: string[];
  actorId: string;
  approverId?: string;
  reason?: string;
  scheduled?: boolean;
  fromVersion?: string;
  toVersion?: string;
  timestamp: string;
}

export default function SLAMarginsPage() {
  // Check access permissions
  const { hasAccess, currentPage } = useSettingsAccess('sla-margins');
  
  const [policyData, setPolicyData] = useState<PolicyData>({
    id: 'policy-001',
    policy_id: 'policy-001',
    name: 'Standard Operations Policy',
    version: '2.1.0',
    effective_date: '2024-01-15T09:00:00+01:00',
    state: 'published',
    last_edited_by: 'sarah.ops@aucta.io',
    last_edited_at: '2024-01-14T16:30:00+01:00',
    change_reason: 'Updated DHL delivery targets for Q1 2024',
    created_by: 'system',
    created_at: '2024-01-01T00:00:00+01:00',
    updated_at: '2024-01-14T16:30:00+01:00',
    sla_targets: {
      classification: { timeToClassify: 4 },
      pickups: {
        urbanWGMaxHours: 12,
        interCityWGMaxHours: 24,
        windowConstraints: 'business'
      },
      hubProcessing: {
        tier2MaxHours: 24,
        tier3MaxHours: 48,
        tier3QABuffer: 4
      },
      delivery: {
        wgFinalDeliveryMaxHours: 12,
        dhlStandardDays: 3,
        dhlExpressDays: 1
      },
      laneSpecifics: {
        euToEuMultiplier: 1.0,
        ukToEuMultiplier: 1.2,
        remoteAreaMultiplier: 1.5,
        weekendRule: 'business'
      },
      riskManagement: {
        riskBufferHours: 6,
        breachEscalationMinutes: 60
      }
    },
    margin_thresholds: {
      global: {
        minimumMargin: 15,
        targetMargin: 25
      },
      components: {
        wgComponent: 8,
        dhlComponent: 5,
        hubFeeComponent: 20,
        insuranceMarkup: 10,
        surchargesPolicy: 15
      },
      variance: {
        tolerancePercent: 10
      },
      currency: {
        base: 'EUR',
        includeVAT: true
      }
    }
  });

  const [isDraft, setIsDraft] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [approvalRequested, setApprovalRequested] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    classification: true,
    pickups: true,
    hubProcessing: true,
    delivery: true,
    laneSpecifics: false,
    riskManagement: false
  });
  
  // Enhanced state for comprehensive functionality
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [telemetryData, setTelemetryData] = useState<TelemetryData>({
    editStartTime: Date.now(),
    simulationCount: 0,
    simulationTotalTime: 0
  });
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [showRestoreDefaults, setShowRestoreDefaults] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduledPublishDate, setScheduledPublishDate] = useState('');
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [unsavedChangesWarning, setUnsavedChangesWarning] = useState(false);
  const [originalPolicyData, setOriginalPolicyData] = useState<PolicyData | null>(null);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [selectedVersionForDiff, setSelectedVersionForDiff] = useState<string>('');
  const [showTooltips, setShowTooltips] = useState(true);
  const [effectiveAtScheduled, setEffectiveAtScheduled] = useState<string>('');
  
  // Refs for tracking
  const editStartTimeRef = useRef<number>(Date.now());
  const navigationAttemptRef = useRef<boolean>(false);
  const sessionRef = useRef<string>(uuidv4()); // Session ID for correlation

  const historyData: HistoryEntry[] = [
    {
      version: '2.1.0',
      editor: 'sarah.ops@aucta.io',
      timestamp: '2024-01-14T16:30:00+01:00',
      changeReason: 'Updated DHL delivery targets for Q1 2024',
      slaChanged: true,
      marginsChanged: false
    },
    {
      version: '2.0.3',
      editor: 'mike.logistics@aucta.io',
      timestamp: '2024-01-10T11:15:00+01:00',
      changeReason: 'Increased WG pickup buffer for holiday season',
      slaChanged: true,
      marginsChanged: false
    },
    {
      version: '2.0.2',
      editor: 'alex.finance@aucta.io',
      timestamp: '2024-01-05T14:20:00+01:00',
      changeReason: 'Adjusted minimum margins per CFO directive',
      slaChanged: false,
      marginsChanged: true
    }
  ];

  // Enhanced utility functions
  const formatDateTime = (dateString: string) => {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(dateString));
  };

  const formatDateTimeWithUTC = (dateString: string) => {
    const date = new Date(dateString);
    const parisTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
    const utcTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
    return `${parisTime} CET (${utcTime} UTC)`;
  };

  // Validation functions
  const validateField = (section: string, field: string, value: any): ValidationError | null => {
    // Zero/negative value checks
    if (typeof value === 'number' && value <= 0) {
      return {
        field: `${section}.${field}`,
        message: `${field} must be greater than 0`,
        severity: 'error'
      };
    }

    // Margin-specific validations
    if (section === 'marginThresholds') {
      if (field === 'minimumMargin' && value > 50) {
        return {
          field: `${section}.${field}`,
          message: 'Minimum margin above 50% may be too restrictive',
          severity: 'warning'
        };
      }
      if (field === 'targetMargin' && value < policyData.margin_thresholds.global.minimumMargin) {
        return {
          field: `${section}.${field}`,
          message: 'Target margin should be higher than minimum margin',
          severity: 'error'
        };
      }
    }

    // SLA-specific validations
    if (section === 'slaTargets') {
      if (field === 'tier3MaxHours' && value > 72) {
        return {
          field: `${section}.${field}`,
          message: 'Tier 3 processing above 72h may breach customer expectations',
          severity: 'warning'
        };
      }
    }

    return null;
  };

  const checkForProtectionLowering = (newData: PolicyData, oldData: PolicyData): boolean => {
    // Check if margins are being lowered
    if (newData.margin_thresholds.global.minimumMargin < oldData.margin_thresholds.global.minimumMargin) return true;
    
    // Check if SLA targets are being relaxed (increased)
    if (newData.sla_targets.hubProcessing.tier2MaxHours > oldData.sla_targets.hubProcessing.tier2MaxHours) return true;
    if (newData.sla_targets.hubProcessing.tier3MaxHours > oldData.sla_targets.hubProcessing.tier3MaxHours) return true;
    
    return false;
  };

  // Event emission functions
  const emitPolicyEvent = (event: PolicyEvent) => {
    console.log('Policy Event Emitted:', event);
    // In real implementation, this would call an API endpoint
    // fetch('/api/events/policy', { method: 'POST', body: JSON.stringify(event) });
  };

  const trackTelemetry = (metric: string, value: number, metadata?: any) => {
    console.log(`Telemetry: ${metric} = ${value}`, metadata);
    // In real implementation, this would send to analytics service
  };

  // Enhanced update functions with validation
  const updateSLATargets = async (section: string, field: string, value: any) => {
    // Validate the field
    const error = validateField('slaTargets', field, value);
    if (error) {
      setValidationErrors(prev => {
        const filtered = prev.filter(e => e.field !== error.field);
        return [...filtered, error];
      });
    } else {
      setValidationErrors(prev => prev.filter(e => e.field !== `slaTargets.${field}`));
    }

    setIsDraft(true);
    setUnsavedChangesWarning(true);
    
    // Create pre-state snapshot for audit
    const preState = createStateSnapshot(policyData.sla_targets, [`${section}.${field}`]);
    const oldValue = policyData.sla_targets[section as keyof SLATargets]?.[field as any];
    
    const newData = {
      ...policyData,
      sla_targets: {
        ...policyData.sla_targets,
        [section]: {
          ...policyData.sla_targets[section as keyof SLATargets],
          [field]: value
        }
      }
    };
    
    // Create post-state snapshot for audit
    const postState = createStateSnapshot(newData.sla_targets, [`${section}.${field}`]);
    
    // Emit structured event per specification: settings.sla.updated
    await SettingsEventAPI.slaUpdated({
      actorId: 'current_user@aucta.io',
      version: policyData.version,
      effectiveAt: policyData.effectiveDate,
      slaSection: section,
      slaField: field,
      oldValue,
      newValue: value,
      preState,
      postState,
      sessionId: sessionRef.current
    });

    setPolicyData(newData);

    // Check if protection is being lowered
    if (originalPolicyData && checkForProtectionLowering(newData, originalPolicyData)) {
      setRequireApproval(true);
    }

    // Emit SLA updated event
    emitPolicyEvent({
      type: 'settings.sla.updated',
      version: policyData.version,
      effectiveAt: policyData.effectiveDate,
      fieldsChanged: [`${section}.${field}`],
      actorId: 'current_user@aucta.io',
      timestamp: new Date().toISOString()
    });
  };

  const updateMarginThresholds = async (section: string, field: string, value: any) => {
    // Validate the field
    const error = validateField('marginThresholds', field, value);
    if (error) {
      setValidationErrors(prev => {
        const filtered = prev.filter(e => e.field !== error.field);
        return [...filtered, error];
      });
    } else {
      setValidationErrors(prev => prev.filter(e => e.field !== `marginThresholds.${field}`));
    }

    setIsDraft(true);
    setUnsavedChangesWarning(true);
    
    // Create pre-state snapshot for audit
    const preState = createStateSnapshot(policyData.margin_thresholds, [`${section}.${field}`]);
    const oldValue = policyData.margin_thresholds[section as keyof MarginThresholds]?.[field as any];
    
    const newData = {
      ...policyData,
      margin_thresholds: {
        ...policyData.margin_thresholds,
        [section]: {
          ...policyData.margin_thresholds[section as keyof MarginThresholds],
          [field]: value
        }
      }
    };
    
    // Create post-state snapshot for audit
    const postState = createStateSnapshot(newData.margin_thresholds, [`${section}.${field}`]);
    
    // Emit structured event per specification: settings.margin.updated
    await SettingsEventAPI.marginUpdated({
      actorId: 'current_user@aucta.io',
      version: policyData.version,
      effectiveAt: policyData.effectiveDate,
      marginSection: section,
      marginField: field,
      oldValue,
      newValue: value,
      preState,
      postState,
      sessionId: sessionRef.current
    });

    setPolicyData(newData);

    // Check if protection is being lowered
    if (originalPolicyData && checkForProtectionLowering(newData, originalPolicyData)) {
      setRequireApproval(true);
    }

    // Emit margin updated event
    emitPolicyEvent({
      type: 'settings.margin.updated',
      version: policyData.version,
      effectiveAt: policyData.effectiveDate,
      fieldsChanged: [`${section}.${field}`],
      actorId: 'current_user@aucta.io',
      timestamp: new Date().toISOString()
    });
  };

  // Enhanced action functions
  const runSimulation = async () => {
    const startTime = Date.now();
    setIsSimulating(true);
    setSimulationProgress(0);
    setShowSimulation(true);
    
    // Simulate progressive loading
    const progressInterval = setInterval(() => {
      setSimulationProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 15;
      });
    }, 200);

    try {
      // Run simulation using API
      const response = await SLAPoliciesAPI.runSimulation(policyData.policy_id, {
        sla_targets: policyData.sla_targets,
        margin_thresholds: policyData.margin_thresholds,
        sample_shipments: [] // Use default sample
      });
      
      setSimulationResults(response.results);
      setSimulationProgress(100);
      
      // Track telemetry
      const simulationTime = Date.now() - startTime;
      setTelemetryData(prev => ({
        ...prev,
        simulationCount: prev.simulationCount + 1,
        simulationTotalTime: prev.simulationTotalTime + simulationTime
      }));
      
      trackTelemetry('policy.simulation.time_ms', simulationTime);
      trackTelemetry('policy.simulation.count', telemetryData.simulationCount + 1);
      
      // Check for large wave of "at risk" shipments
      const atRiskCount = response.results.filter(r => r.slaAtRisk).length;
      if (atRiskCount > response.results.length * 0.5) {
        alert('Warning: High number of shipments would be flagged "SLA at risk" under this policy. Consider scheduling publication later and notifying teams.');
      }
      
    } catch (error) {
      console.error('Simulation failed:', error);
      alert('Simulation failed. Please try again.');
    } finally {
      setIsSimulating(false);
      clearInterval(progressInterval);
    }
  };

  const saveDraft = async () => {
    if (!changeReason.trim()) {
      alert('Please provide a change reason');
      return;
    }
    
    // Check for validation errors
    const hasErrors = validationErrors.some(e => e.severity === 'error');
    if (hasErrors) {
      alert('Please fix all validation errors before saving');
      return;
    }
    
    try {
      // Save policy using API
      const response = await SLAPoliciesAPI.savePolicy({
        policy_id: policyData.policy_id,
        name: policyData.name,
        version: policyData.version,
        sla_targets: policyData.sla_targets,
        margin_thresholds: policyData.margin_thresholds,
        change_reason: changeReason,
        state: 'draft'
      });
      
      setPolicyData(response.policy);
      setIsDraft(false);
      setUnsavedChangesWarning(false);
      setChangeReason('');
      
      // Track edit time
      const editTime = Date.now() - editStartTimeRef.current;
      trackTelemetry('policy.edit.time_ms', editTime);
      
      console.log('Draft saved successfully');
      alert('Draft saved successfully');
      
    } catch (error) {
      console.error('Failed to save draft:', error);
      alert('Failed to save draft. Please try again.');
    }
  };

  const publishNow = async () => {
    if (!changeReason.trim()) {
      alert('Please provide a change reason');
      return;
    }
    
    // Check for validation errors
    const hasErrors = validationErrors.some(e => e.severity === 'error');
    if (hasErrors) {
      alert('Please fix all validation errors before publishing');
      return;
    }
    
    if (requireApproval && !approvalRequest) {
      // Request approval
      const newApprovalRequest: ApprovalRequest = {
        id: `approval-${Date.now()}`,
        requestedBy: 'current_user@aucta.io',
        requestedAt: new Date().toISOString(),
        reason: changeReason,
        approvers: [
          { role: 'ops_admin', email: 'ops.admin@aucta.io' },
          { role: 'finance_approver', email: 'finance.approver@aucta.io' }
        ],
        status: 'pending'
      };
      
      setApprovalRequest(newApprovalRequest);
      setApprovalRequested(true);
      
      // Track approval latency start
      setTelemetryData(prev => ({ ...prev, approvalLatency: Date.now() }));
      
      alert('Approval request sent to ops_admin and finance_approver');
      return;
    }
    
    try {
      // Use idempotent publish API with duplicate prevention
      const publishResult = await SettingsEventAPI.publishSLAMarginPolicy({
        policyData: {
          policy_id: policyData.policy_id,
          name: policyData.name,
          version: policyData.version,
          sla_targets: policyData.sla_targets,
          margin_thresholds: policyData.margin_thresholds,
          effective_date: policyData.effectiveDate
        },
        actorId: 'current_user@aucta.io',
        changeReason,
        requestId: `sla-publish-${sessionRef.current}-${Date.now()}`
      });
      
      if (!publishResult.success) {
        if (publishResult.error === 'OVERLAPPING_POLICY') {
          alert(`Cannot publish policy: ${publishResult.message}`);
          return;
        }
        throw new Error(publishResult.message || 'Policy publish failed');
      }
      
      if (publishResult.isDuplicate) {
        alert('Policy publish prevented duplicate - same policy already exists');
      } else {
        // Emit event for successful new publish
        await SettingsEventAPI.policyPublished({
          actorId: 'current_user@aucta.io',
          version: policyData.version,
          effectiveAt: policyData.effectiveDate,
          policyType: 'sla_margin',
          policyId: publishResult.policyId,
          publishedBy: 'current_user@aucta.io',
          preState: createStateSnapshot(policyData),
          postState: createStateSnapshot({ ...policyData, state: 'published' }),
          sessionId: sessionRef.current
        });
      }
      
      setPolicyData(prev => ({ ...prev, state: 'published' }));
      setIsDraft(false);
      setUnsavedChangesWarning(false);
      setChangeReason('');
      setRequireApproval(false);
      setApprovalRequested(false);
      
      console.log('Policy published successfully');
      alert('Policy published successfully! Quote engine will use new thresholds immediately.');
      
    } catch (error) {
      console.error('Failed to publish policy:', error);
      alert('Failed to publish policy. Please try again.');
    }
  };

  const schedulePublish = async () => {
    if (!scheduledPublishDate || !changeReason.trim()) {
      alert('Please provide both a scheduled date and change reason');
      return;
    }
    
    const scheduledDate = new Date(scheduledPublishDate);
    if (scheduledDate <= new Date()) {
      alert('Scheduled date must be in the future');
      return;
    }
    
    try {
      const scheduledPolicy = {
        ...policyData,
        state: 'Scheduled' as const,
        effectiveDate: scheduledDate.toISOString(),
        lastEditedBy: 'current_user@aucta.io',
        lastEditedAt: new Date().toISOString(),
        changeReason: changeReason
      };
      
      setPolicyData(scheduledPolicy);
      setIsDraft(false);
      setUnsavedChangesWarning(false);
      setShowScheduleDialog(false);
      setEffectiveAtScheduled(scheduledDate.toISOString());
      
      // Emit scheduled publish event
      emitPolicyEvent({
        type: 'settings.policy.published',
        version: scheduledPolicy.version,
        effectiveAt: scheduledPolicy.effectiveDate,
        actorId: 'current_user@aucta.io',
        reason: changeReason,
        scheduled: true,
        timestamp: new Date().toISOString()
      });
      
      console.log('Policy scheduled for publication');
      alert(`Policy scheduled for publication on ${formatDateTimeWithUTC(scheduledDate.toISOString())}`);
      
    } catch (error) {
      console.error('Failed to schedule policy:', error);
      alert('Failed to schedule policy. Please try again.');
    }
  };

  const restoreDefaults = async () => {
    if (!changeReason.trim()) {
      alert('Please provide a reason for restoring defaults');
      return;
    }
    
    const defaultPolicy: PolicyData = {
      ...policyData,
      slaTargets: {
        classification: { timeToClassify: 4 },
        pickups: {
          urbanWGMaxHours: 12,
          interCityWGMaxHours: 24,
          windowConstraints: 'business'
        },
        hubProcessing: {
          tier2MaxHours: 24,
          tier3MaxHours: 48,
          tier3QABuffer: 4
        },
        delivery: {
          wgFinalDeliveryMaxHours: 12,
          dhlStandardDays: 3,
          dhlExpressDays: 1
        },
        laneSpecifics: {
          euToEuMultiplier: 1.0,
          ukToEuMultiplier: 1.2,
          remoteAreaMultiplier: 1.5,
          weekendRule: 'business'
        },
        riskManagement: {
          riskBufferHours: 6,
          breachEscalationMinutes: 60
        }
      },
      marginThresholds: {
        global: {
          minimumMargin: 15,
          targetMargin: 25
        },
        components: {
          wgComponent: 8,
          dhlComponent: 5,
          hubFeeComponent: 20,
          insuranceMarkup: 10,
          surchargesPolicy: 15
        },
        variance: {
          tolerancePercent: 10
        },
        currency: {
          base: 'EUR',
          includeVAT: true
        }
      }
    };
    
    setPolicyData(defaultPolicy);
    setIsDraft(true);
    setUnsavedChangesWarning(true);
    setShowRestoreDefaults(false);
    setValidationErrors([]);
    
    console.log('Restored to default values');
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const computeExample = () => {
    if (!policyData.sla_targets) return 'Loading...';
    
    const { tier3MaxHours, tier3QABuffer } = policyData.sla_targets.hubProcessing;
    const { wgFinalDeliveryMaxHours } = policyData.sla_targets.delivery;
    const totalHours = tier3MaxHours + tier3QABuffer + wgFinalDeliveryMaxHours;
    
    const exampleDate = new Date();
    exampleDate.setHours(exampleDate.getHours() + totalHours);
    
    return `For Tier 3 IT→GB, your targets imply delivery by ${formatDateTime(exampleDate.toISOString())}`;
  };

  // Load policy data from API on mount
  useEffect(() => {
    const loadPolicyData = async () => {
      try {
        const response = await SLAPoliciesAPI.getActivePolicy();
        if (response.policy) {
          setPolicyData(response.policy);
          setOriginalPolicyData(response.policy);
        }
      } catch (error) {
        console.error('Failed to load policy data:', error);
        // Keep using the default mock data as fallback
        if (!originalPolicyData) {
          setOriginalPolicyData(policyData);
        }
      }
    };

    loadPolicyData();
  }, []);

  // Initialize original policy data on mount (fallback)
  useEffect(() => {
    if (!originalPolicyData && policyData.policy_id) {
      setOriginalPolicyData(policyData);
    }
  }, [policyData, originalPolicyData]);

  // Navigation warning effect
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChangesWarning) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsavedChangesWarning]);

  // Early return if no access
  if (!hasAccess) {
    return (
      <div className="container">
        <SettingsNavigation />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container space-y-6">
        <SettingsNavigation />
        {/* Unsaved Changes Warning */}
        {unsavedChangesWarning && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              You have unsaved changes. Don't forget to save your draft or publish your changes.
            </AlertDescription>
          </Alert>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium text-red-800">Please fix the following issues:</p>
                <ul className="list-disc list-inside text-red-700">
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>{error.message}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Header & Policy Mode */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  SLA & Margin Policies
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-4 h-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Define operational guardrails that drive SLA targets and margin thresholds</p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{policyData.name}</span>
                    <Badge variant="outline">v{policyData.version}</Badge>
                    <Badge variant={
                      policyData.state === 'Published' ? 'default' :
                      policyData.state === 'Scheduled' ? 'secondary' : 'outline'
                    }>
                      {policyData.state}
                    </Badge>
                    {isDraft && <Badge variant="destructive">Unsaved Changes</Badge>}
                    {effectiveAtScheduled && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Clock12 className="w-3 h-3" />
                        Scheduled
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    Effective: {formatDateTimeWithUTC(policyData.effective_date)} • 
                    Last edited by {policyData.last_edited_by} on {formatDateTime(policyData.last_edited_at)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {policyData.change_reason}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setShowHistory(true)}>
                  <History className="w-4 h-4 mr-2" />
                  History
                </Button>
                <Button variant="outline" onClick={runSimulation} disabled={isSimulating}>
                  {isSimulating ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4 mr-2" />
                  )}
                  {isSimulating ? 'Simulating...' : 'Simulate'}
                </Button>
                <Button variant="outline" disabled title="Policy scheduling available in Change Management tab">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Publish
                </Button>
                <Button variant="outline" onClick={() => setShowRestoreDefaults(true)}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Defaults
                </Button>
                <Button variant="outline" onClick={saveDraft} disabled={!isDraft || validationErrors.some(e => e.severity === 'error')}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </Button>
                <Button onClick={publishNow} disabled={validationErrors.some(e => e.severity === 'error')}>
                  {requireApproval && !approvalRequest ? (
                    <Shield className="w-4 h-4 mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  {requireApproval && !approvalRequest ? 'Request Approval' : 'Publish Now'}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

      {/* Change Reason Input */}
      {isDraft && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Label htmlFor="changeReason">Change Reason (required for saving)</Label>
              <Textarea
                id="changeReason"
                placeholder="Describe what changes you're making and why..."
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
              />
              {requireApproval && (
                <Alert>
                  <Shield className="w-4 h-4" />
                  <AlertDescription>
                    These changes lower protection levels and require two-person approval (ops_admin + approver).
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="sla" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sla">SLA Targets</TabsTrigger>
          <TabsTrigger value="margins">Margin Thresholds</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
          <TabsTrigger value="change-mgmt">Change Management</TabsTrigger>
        </TabsList>

        {/* SLA Targets Tab */}
        <TabsContent value="sla" className="space-y-6">
          <div className="space-y-6">
            
            {/* Classification */}
            <Card>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('classification')}
              >
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Classification
                  </div>
                  {expandedSections.classification ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
              {expandedSections.classification && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="timeToClassify" className="flex items-center gap-2">
                        Time to Classify (Tier Gate) - Hours
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3 h-3 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Maximum time allowed to move shipments from Draft to TierAssigned status. Used for classification SLA alerts.</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input
                        id="timeToClassify"
                        type="number"
                        value={policyData.sla_targets.classification.timeToClassify}
                        onChange={(e) => updateSLATargets('classification', 'timeToClassify', Number(e.target.value))}
                      />
                      <p className="text-sm text-gray-500 mt-1">Maximum hours from Draft → TierAssigned</p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Pickups */}
            <Card>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('pickups')}
              >
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Pickups (WG)
                  </div>
                  {expandedSections.pickups ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
              {expandedSections.pickups && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="urbanWGMaxHours">Urban WG Pickup Max Hours</Label>
                      <Input
                        id="urbanWGMaxHours"
                        type="number"
                        value={policyData.sla_targets.pickups.urbanWGMaxHours}
                        onChange={(e) => updateSLATargets('pickups', 'urbanWGMaxHours', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="interCityWGMaxHours">Inter-city WG Pickup Max Hours</Label>
                      <Input
                        id="interCityWGMaxHours"
                        type="number"
                        value={policyData.sla_targets.pickups.interCityWGMaxHours}
                        onChange={(e) => updateSLATargets('pickups', 'interCityWGMaxHours', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="windowConstraints">Pickup Window Constraints</Label>
                      <Select 
                        value={policyData.sla_targets.pickups.windowConstraints}
                        onValueChange={(value) => updateSLATargets('pickups', 'windowConstraints', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="business">Business Hours</SelectItem>
                          <SelectItem value="24_7">24/7</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Hub Processing */}
            <Card>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('hubProcessing')}
              >
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Hub Processing
                  </div>
                  {expandedSections.hubProcessing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
              {expandedSections.hubProcessing && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="tier2MaxHours">Tier 2 Max Hours</Label>
                      <Input
                        id="tier2MaxHours"
                        type="number"
                        value={policyData.sla_targets.hubProcessing.tier2MaxHours}
                        onChange={(e) => updateSLATargets('hubProcessing', 'tier2MaxHours', Number(e.target.value))}
                      />
                      <p className="text-sm text-gray-500 mt-1">Auth + tag (≤ 24h default)</p>
                    </div>
                    <div>
                      <Label htmlFor="tier3MaxHours">Tier 3 Max Hours</Label>
                      <Input
                        id="tier3MaxHours"
                        type="number"
                        value={policyData.sla_targets.hubProcessing.tier3MaxHours}
                        onChange={(e) => updateSLATargets('hubProcessing', 'tier3MaxHours', Number(e.target.value))}
                      />
                      <p className="text-sm text-gray-500 mt-1">Auth + sewing + NFC (≤ 48h default)</p>
                    </div>
                    <div>
                      <Label htmlFor="tier3QABuffer">QA Buffer (Tier 3)</Label>
                      <Input
                        id="tier3QABuffer"
                        type="number"
                        value={policyData.sla_targets.hubProcessing.tier3QABuffer}
                        onChange={(e) => updateSLATargets('hubProcessing', 'tier3QABuffer', Number(e.target.value))}
                      />
                      <p className="text-sm text-gray-500 mt-1">Additional hours for QA</p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Delivery */}
            <Card>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('delivery')}
              >
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Delivery
                  </div>
                  {expandedSections.delivery ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
              {expandedSections.delivery && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="wgFinalDeliveryMaxHours">WG Final Delivery Max Hours</Label>
                      <Input
                        id="wgFinalDeliveryMaxHours"
                        type="number"
                        value={policyData.sla_targets.delivery.wgFinalDeliveryMaxHours}
                        onChange={(e) => updateSLATargets('delivery', 'wgFinalDeliveryMaxHours', Number(e.target.value))}
                      />
                      <p className="text-sm text-gray-500 mt-1">From HubCompleted</p>
                    </div>
                    <div>
                      <Label htmlFor="dhlStandardDays">DHL Standard (Days)</Label>
                      <Input
                        id="dhlStandardDays"
                        type="number"
                        value={policyData.sla_targets.delivery.dhlStandardDays}
                        onChange={(e) => updateSLATargets('delivery', 'dhlStandardDays', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dhlExpressDays">DHL Express (Days)</Label>
                      <Input
                        id="dhlExpressDays"
                        type="number"
                        value={policyData.sla_targets.delivery.dhlExpressDays}
                        onChange={(e) => updateSLATargets('delivery', 'dhlExpressDays', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription>
                      <strong>Example:</strong> {computeExample()}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              )}
            </Card>

            {/* Lane Specifics */}
            <Card>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('laneSpecifics')}
              >
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-5 h-5" />
                    Lane Specifics (Optional Overrides)
                  </div>
                  {expandedSections.laneSpecifics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
              {expandedSections.laneSpecifics && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="euToEuMultiplier">EU↔EU Multiplier</Label>
                      <Input
                        id="euToEuMultiplier"
                        type="number"
                        step="0.1"
                        value={policyData.sla_targets.laneSpecifics.euToEuMultiplier}
                        onChange={(e) => updateSLATargets('laneSpecifics', 'euToEuMultiplier', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ukToEuMultiplier">UK↔EU Multiplier</Label>
                      <Input
                        id="ukToEuMultiplier"
                        type="number"
                        step="0.1"
                        value={policyData.sla_targets.laneSpecifics.ukToEuMultiplier}
                        onChange={(e) => updateSLATargets('laneSpecifics', 'ukToEuMultiplier', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="remoteAreaMultiplier">Remote Area Multiplier (%)</Label>
                      <Input
                        id="remoteAreaMultiplier"
                        type="number"
                        step="0.1"
                        value={policyData.sla_targets.laneSpecifics.remoteAreaMultiplier}
                        onChange={(e) => updateSLATargets('laneSpecifics', 'remoteAreaMultiplier', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="weekendRule">Weekend Rule</Label>
                      <Select 
                        value={policyData.sla_targets.laneSpecifics.weekendRule}
                        onValueChange={(value) => updateSLATargets('laneSpecifics', 'weekendRule', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="calendar">Calendar Hours</SelectItem>
                          <SelectItem value="business">Business Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Risk Management */}
            <Card>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('riskManagement')}
              >
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    SLA Buffer & Risk Signal
                  </div>
                  {expandedSections.riskManagement ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
              {expandedSections.riskManagement && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="riskBufferHours">Risk Buffer (Hours)</Label>
                      <Input
                        id="riskBufferHours"
                        type="number"
                        value={policyData.sla_targets.riskManagement.riskBufferHours}
                        onChange={(e) => updateSLATargets('riskManagement', 'riskBufferHours', Number(e.target.value))}
                      />
                      <p className="text-sm text-gray-500 mt-1">When remaining ETA &lt; buffer, flag SLA at risk</p>
                    </div>
                    <div>
                      <Label htmlFor="breachEscalationMinutes">Breach Escalation (Minutes)</Label>
                      <Input
                        id="breachEscalationMinutes"
                        type="number"
                        value={policyData.sla_targets.riskManagement.breachEscalationMinutes}
                        onChange={(e) => updateSLATargets('riskManagement', 'breachEscalationMinutes', Number(e.target.value))}
                      />
                      <p className="text-sm text-gray-500 mt-1">Auto-escalate severity after X minutes overdue</p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Margin Thresholds Tab */}
        <TabsContent value="margins" className="space-y-6">
          <div className="space-y-6">
            
            {/* Global Margins */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Global Minimum Margins
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minimumMargin">Global Minimum Margin (%)</Label>
                    <Input
                      id="minimumMargin"
                      type="number"
                      value={policyData.margin_thresholds.global.minimumMargin}
                      onChange={(e) => updateMarginThresholds('global', 'minimumMargin', Number(e.target.value))}
                    />
                    <p className="text-sm text-gray-500 mt-1">Blocks plan if below (unless admin override)</p>
                  </div>
                  <div>
                    <Label htmlFor="targetMargin">Target Margin (%)</Label>
                    <Input
                      id="targetMargin"
                      type="number"
                      value={policyData.margin_thresholds.global.targetMargin}
                      onChange={(e) => updateMarginThresholds('global', 'targetMargin', Number(e.target.value))}
                    />
                    <p className="text-sm text-gray-500 mt-1">Used in scoring (higher score when closer/above)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Component Margins */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Component Minimums
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="wgComponent">WG Component (%)</Label>
                    <Input
                      id="wgComponent"
                      type="number"
                      value={policyData.margin_thresholds.components.wgComponent}
                      onChange={(e) => updateMarginThresholds('components', 'wgComponent', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dhlComponent">DHL Component (%)</Label>
                    <Input
                      id="dhlComponent"
                      type="number"
                      value={policyData.margin_thresholds.components.dhlComponent}
                      onChange={(e) => updateMarginThresholds('components', 'dhlComponent', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="hubFeeComponent">Hub Fee Component (%)</Label>
                    <Input
                      id="hubFeeComponent"
                      type="number"
                      value={policyData.margin_thresholds.components.hubFeeComponent}
                      onChange={(e) => updateMarginThresholds('components', 'hubFeeComponent', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="insuranceMarkup">Insurance Markup (%)</Label>
                    <Input
                      id="insuranceMarkup"
                      type="number"
                      value={policyData.margin_thresholds.components.insuranceMarkup}
                      onChange={(e) => updateMarginThresholds('components', 'insuranceMarkup', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="surchargesPolicy">Surcharges Policy (%)</Label>
                    <Input
                      id="surchargesPolicy"
                      type="number"
                      value={policyData.margin_thresholds.components.surchargesPolicy}
                      onChange={(e) => updateMarginThresholds('components', 'surchargesPolicy', Number(e.target.value))}
                    />
                  </div>
                </div>
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    Each component is checked individually. Quote page uses these thresholds for red (block) / amber (warn) states.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Variance & Currency */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Variance & Currency Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="tolerancePercent">Variance Tolerance (%)</Label>
                    <Input
                      id="tolerancePercent"
                      type="number"
                      value={policyData.margin_thresholds.variance.tolerancePercent}
                      onChange={(e) => updateMarginThresholds('variance', 'tolerancePercent', Number(e.target.value))}
                    />
                    <p className="text-sm text-gray-500 mt-1">Warn if actual buy &gt; planned by X%</p>
                  </div>
                  <div>
                    <Label htmlFor="currencyBase">Currency Base</Label>
                    <Select 
                      value={policyData.margin_thresholds.currency.base}
                      onValueChange={(value) => updateMarginThresholds('currency', 'base', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="includeVAT"
                      checked={policyData.margin_thresholds.currency.includeVAT}
                      onCheckedChange={(checked) => updateMarginThresholds('currency', 'includeVAT', checked)}
                    />
                    <Label htmlFor="includeVAT">Include VAT in margin calc</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Simulation Tab */}
        <TabsContent value="simulation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5" />
                Simulation & Impact (Dry-run)
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-4 h-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Test policy changes against sample shipments before publishing</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Validate changes before publishing by testing against sample shipments and lane templates.
              </p>
              
              {isSimulating && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Running simulation...</span>
                  </div>
                  <Progress value={simulationProgress} className="w-full" />
                  <p className="text-xs text-gray-500">
                    Testing {simulationProgress < 50 ? 'sample shipments' : simulationProgress < 90 ? 'lane templates' : 'impact analysis'}...
                  </p>
                </div>
              )}
              
              <div className="flex gap-4">
                <Button onClick={runSimulation} disabled={isSimulating}>
                  {isSimulating ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4 mr-2" />
                  )}
                  {isSimulating ? 'Running...' : 'Run Simulation'}
                </Button>
                <Button variant="outline" disabled={simulationResults.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Impact Summary
                </Button>
              </div>

              {simulationResults.length > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Simulation Results</h3>
                    <div className="flex gap-2 text-sm">
                      <Badge variant="outline">
                        {simulationResults.length} shipments tested
                      </Badge>
                      <Badge variant={simulationResults.filter(r => r.slaAtRisk).length > 0 ? 'destructive' : 'default'}>
                        {simulationResults.filter(r => r.slaAtRisk).length} at risk
                      </Badge>
                    </div>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shipment ID</TableHead>
                        <TableHead>Lane</TableHead>
                        <TableHead>Current Score</TableHead>
                        <TableHead>New Score</TableHead>
                        <TableHead>Delta</TableHead>
                        <TableHead>Guardrail Hits</TableHead>
                        <TableHead>SLA At Risk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {simulationResults.map((result) => (
                        <TableRow key={result.shipmentId}>
                          <TableCell className="font-mono text-sm">{result.shipmentId}</TableCell>
                          <TableCell>{result.lane}</TableCell>
                          <TableCell className="text-center">{result.currentScore}</TableCell>
                          <TableCell className="text-center">{result.newScore}</TableCell>
                          <TableCell className={`text-center font-medium ${result.scoreDelta < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {result.scoreDelta > 0 ? '+' : ''}{result.scoreDelta}
                          </TableCell>
                          <TableCell>
                            {result.guardrailHits.length > 0 ? (
                              result.guardrailHits.map((hit, idx) => (
                                <Badge key={idx} variant="destructive" className="mr-1 text-xs">
                                  {hit}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-gray-400">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {result.slaAtRisk ? (
                              <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3" />
                                At Risk
                              </Badge>
                            ) : (
                              <Badge variant="default" className="flex items-center gap-1 w-fit">
                                <CheckCircle className="w-3 h-3" />
                                OK
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Simulation Summary */}
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Impact Summary</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Average Score Change:</span>
                        <span className={`ml-2 font-medium ${
                          simulationResults.reduce((sum, r) => sum + r.scoreDelta, 0) / simulationResults.length < 0 
                            ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {(simulationResults.reduce((sum, r) => sum + r.scoreDelta, 0) / simulationResults.length).toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Routes with Guardrail Hits:</span>
                        <span className="ml-2 font-medium text-amber-600">
                          {simulationResults.filter(r => r.guardrailHits.length > 0).length}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Performance Time:</span>
                        <span className="ml-2 font-medium">
                          {telemetryData.simulationTotalTime > 0 ? `${telemetryData.simulationTotalTime}ms` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Change Management Tab */}
        <TabsContent value="change-mgmt" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Change Management (Scheduling & Scope)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Effective Date */}
              <div>
                <Label htmlFor="effectiveDate">Effective Date/Time (Europe/Paris)</Label>
                <Input
                  id="effectiveDate"
                  type="datetime-local"
                  value={policyData.effectiveDate.slice(0, 16)}
                  onChange={(e) => setPolicyData(prev => ({
                    ...prev,
                    effectiveDate: e.target.value + '+01:00'
                  }))}
                />
                <p className="text-sm text-gray-500 mt-1">Schedule future activation</p>
              </div>

              {/* Scope */}
              <div>
                <Label>Scope</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="newQuotesOnly" defaultChecked />
                    <Label htmlFor="newQuotesOnly">Apply to new quotes only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="rescorePlanned" />
                    <Label htmlFor="rescorePlanned">Re-score planned shipments (read-only effect)</Label>
                  </div>
                </div>
                <Alert className="mt-2">
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    Existing planned shipments keep their guardrails locked to the original policy, but may display warnings if new policy would be breached.
                  </AlertDescription>
                </Alert>
              </div>

              {/* Notifications */}
              <div>
                <Label>Notifications</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="notifyOps" defaultChecked />
                    <Label htmlFor="notifyOps">Send heads-up to Ops</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="notifyHubLeads" defaultChecked />
                    <Label htmlFor="notifyHubLeads">Send heads-up to Hub Leads</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="notifyWGCoords" />
                    <Label htmlFor="notifyWGCoords">Send heads-up to WG coordinators</Label>
                  </div>
                </div>
              </div>

              {/* Approval Required */}
              {requireApproval && (
                <Alert>
                  <Shield className="w-4 h-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Two-Person Approval Required</strong></p>
                      <p>These changes lower protection levels and require approval from:</p>
                      <ul className="list-disc list-inside ml-4">
                        <li>ops_admin</li>
                        <li>finance_approver</li>
                      </ul>
                      {approvalRequested && (
                        <Badge variant="secondary">Approval Requested</Badge>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Policy Version History</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Editor</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Change Reason</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyData.map((entry) => (
                  <TableRow key={entry.version}>
                    <TableCell>
                      <Badge variant="outline">{entry.version}</Badge>
                    </TableCell>
                    <TableCell>{entry.editor}</TableCell>
                    <TableCell>{formatDateTime(entry.timestamp)}</TableCell>
                    <TableCell>{entry.changeReason}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {entry.slaChanged && <Badge variant="default">SLA</Badge>}
                        {entry.marginsChanged && <Badge variant="secondary">Margins</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <GitCompare className="w-4 h-4 mr-1" />
                          Diff
                        </Button>
                        <Button size="sm" variant="outline">
                          Rollback
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Note: Schedule Publish functionality moved to Change Management tab */}

      {/* Restore Defaults Dialog */}
      <Dialog open={showRestoreDefaults} onOpenChange={setShowRestoreDefaults}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Default Values</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                This will reset all SLA targets and margin thresholds to their default values. Any unsaved changes will be lost.
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="restoreReason">Reason for Restoring Defaults</Label>
              <Textarea
                id="restoreReason"
                placeholder="Explain why you're restoring default values..."
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreDefaults(false)}>
              Cancel
            </Button>
            <Button onClick={restoreDefaults} variant="destructive">
              <RotateCcw className="w-4 h-4 mr-2" />
              Restore Defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Request Status */}
      {approvalRequest && (
        <Dialog open={approvalRequested} onOpenChange={setApprovalRequested}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Two-Person Approval Required</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <Shield className="w-4 h-4" />
                <AlertDescription>
                  Your changes lower protection levels and require approval from authorized personnel.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <h4 className="font-medium">Approval Status</h4>
                {approvalRequest.approvers.map((approver, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <span className="font-medium">{approver.role.replace('_', ' ').toUpperCase()}</span>
                      <p className="text-sm text-gray-600">{approver.email}</p>
                    </div>
                    <Badge variant={approver.approvedAt ? 'default' : 'outline'}>
                      {approver.approvedAt ? 'Approved' : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h5 className="font-medium mb-2">Change Reason</h5>
                <p className="text-sm text-gray-700">{approvalRequest.reason}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApprovalRequested(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Telemetry Dashboard (Debug) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="mt-6 border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4" />
              Telemetry Dashboard (Debug Mode)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Edit Time:</span>
                <span className="ml-2 font-mono">
                  {((Date.now() - editStartTimeRef.current) / 1000).toFixed(1)}s
                </span>
              </div>
              <div>
                <span className="text-gray-600">Simulations:</span>
                <span className="ml-2 font-mono">{telemetryData.simulationCount}</span>
              </div>
              <div>
                <span className="text-gray-600">Sim Time:</span>
                <span className="ml-2 font-mono">{telemetryData.simulationTotalTime}ms</span>
              </div>
              <div>
                <span className="text-gray-600">Validation Errors:</span>
                <span className="ml-2 font-mono">{validationErrors.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </TooltipProvider>
  );
}