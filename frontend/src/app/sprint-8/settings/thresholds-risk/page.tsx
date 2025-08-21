'use client';

import React, { useState, useEffect } from 'react';
import SettingsNavigation, { useSettingsAccess } from '@/components/SettingsNavigation';
import SettingsEventAPI, { createStateSnapshot } from '@/lib/eventAuditSystem';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { riskThresholdsApi } from '@/lib/riskThresholdsApi';
import type { 
  RiskThresholdPolicy, 
  ValueBand, 
  FragilityRule, 
  BrandOverride, 
  LaneRisk,
  InventoryThresholds,
  RiskWeights,
  RiskComponents,
  SecurityDefaults,
  IncidentRule,
  PublishingScope,
  SimulationResult,
  ConflictItem,
  PolicyVersion,
  TelemetryData
} from '@/lib/riskThresholdsApi';
import { 
  Settings, 
  Shield, 
  AlertTriangle, 
  Clock, 
  Package, 
  Globe, 
  TrendingUp,
  Save,
  Eye,
  Calendar,
  User,
  History,
  ChevronRight,
  Info,
  Lock,
  Camera,
  Zap,
  Bell,
  Play,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Loader2,
  BarChart3,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface PolicyState {
  name: string;
  version: string;
  effectiveDate: string;
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  lastEditedBy: string;
  changeReason: string;
}

export default function ThresholdsRiskPage() {
  // Check access permissions
  const { hasAccess, currentPage } = useSettingsAccess('thresholds-risk');
  
  const [policyData, setPolicyData] = useState<RiskThresholdPolicy | null>(null);
  const sessionRef = React.useRef<string>(uuidv4()); // Session ID for correlation
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [policyState, setPolicyState] = useState<PolicyState>({
    name: '',
    version: '',
    effectiveDate: '',
    status: 'draft',
    lastEditedBy: '',
    changeReason: ''
  });

  const [valueBands, setValueBands] = useState<ValueBand[]>([]);

  const [fragilityRules, setFragilityRules] = useState<FragilityRule[]>([]);
  const [brandOverrides, setBrandOverrides] = useState<BrandOverride[]>([]);
  const [laneRisks, setLaneRisks] = useState<LaneRisk[]>([]);
  const [inventoryThresholds, setInventoryThresholds] = useState<InventoryThresholds>({
    tags: { lowStockQty: 0, minDaysOfCover: 0 },
    nfc: { lowStockQty: 0, minDaysOfCover: 0, lotFailureQuarantineThreshold: 0 },
    transferSlaHours: 0
  });
  const [riskWeights, setRiskWeights] = useState<RiskWeights>({ time: 0, cost: 0, risk: 0 });
  const [riskComponents, setRiskComponents] = useState<RiskComponents>({
    valueRisk: 0, fragilityRisk: 0, laneRisk: 0, operatorRisk: 0,
    carrierRisk: 0, addressRisk: 0, hubLoadRisk: 0
  });
  const [securityDefaults, setSecurityDefaults] = useState<SecurityDefaults>({
    otpLivenessValueThreshold: 0, sealRequiredTiers: [], 
    minPhotosPickup: 0, minPhotosIntake: 0, minPhotosDelivery: 0
  });
  const [incidentRules, setIncidentRules] = useState<IncidentRule[]>([]);
  const [publishingScope, setPublishingScope] = useState<PublishingScope>({
    newShipmentsOnly: false, unplannedDrafts: false, 
    retroactiveChanges: false, notifyRoles: []
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showGuardrails, setShowGuardrails] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [showSimulation, setShowSimulation] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  
  // Helper function to emit threshold update events
  const updateValueBandsWithEvent = async (newBands: ValueBand[], changedField: string, index?: number) => {
    const preState = createStateSnapshot(valueBands);
    setValueBands(newBands);
    setHasUnsavedChanges(true);
    
    const postState = createStateSnapshot(newBands);
    
    // Emit structured event per specification: settings.thresholds.updated
    await SettingsEventAPI.thresholdsUpdated({
      actorId: 'current_user@aucta.io',
      version: policyData?.version || '1.0.0',
      effectiveAt: policyData?.effective_date || new Date().toISOString(),
      thresholdType: 'value_bands',
      thresholdId: index !== undefined ? `value_band_${index}` : undefined,
      fieldsChanged: [changedField],
      preState,
      postState,
      sessionId: sessionRef.current
    });
  };
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [policyVersions, setPolicyVersions] = useState<PolicyVersion[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [telemetryData, setTelemetryData] = useState<TelemetryData | null>(null);

  // Load policy data on component mount
  useEffect(() => {
    loadPolicyData();
    loadTelemetryData();
  }, []);

  const loadPolicyData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load active policy
      const { policy } = await riskThresholdsApi.getActivePolicy();
      
      setPolicyData(policy);
      
      // Update state from policy data
      setPolicyState({
        name: policy.name,
        version: policy.version,
        effectiveDate: policy.effective_date,
        status: policy.state,
        lastEditedBy: policy.last_edited_by,
        changeReason: policy.change_reason
      });
      
      setValueBands(policy.value_bands);
      setFragilityRules(policy.fragility_rules);
      setBrandOverrides(policy.brand_overrides);
      setLaneRisks(policy.lane_risks);
      setInventoryThresholds(policy.inventory_thresholds);
      setRiskWeights(policy.risk_weights);
      setRiskComponents(policy.risk_components);
      setSecurityDefaults(policy.security_defaults);
      setIncidentRules(policy.incident_rules);
      setPublishingScope(policy.publishing_scope);
      
      // Load policy history
      const historyResponse = await riskThresholdsApi.getPolicyHistory(policy.policy_id, { limit: 10 });
      setPolicyVersions(historyResponse.history);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policy data');
      console.error('Error loading policy data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTelemetryData = async () => {
    try {
      const telemetry = await riskThresholdsApi.getTelemetry(30);
      setTelemetryData(telemetry);
    } catch (err) {
      console.error('Error loading telemetry data:', err);
    }
  };

  // Normalize risk weights to sum to 1
  const normalizeWeights = (weights: RiskWeights) => {
    const sum = weights.time + weights.cost + weights.risk;
    if (sum === 0) return weights;
    return {
      time: weights.time / sum,
      cost: weights.cost / sum,
      risk: weights.risk / sum
    };
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      paris: date.toLocaleString('en-GB', { 
        timeZone: 'Europe/Paris',
        dateStyle: 'medium',
        timeStyle: 'short'
      }),
      utc: date.toLocaleString('en-GB', { 
        timeZone: 'UTC',
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-yellow-100 text-yellow-800';
      case 'Published': return 'bg-green-100 text-green-800';
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Event emission helper
  const emitEvent = (type: string, payload: any) => {
    const event: EventEmission = {
      type,
      payload: {
        ...payload,
        actorId: 'current-user-id',
        ts: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    console.log('Event emitted:', event);
    // In real implementation, this would send to analytics/event bus
  };

  // Validation and conflict detection
  const validatePolicy = () => {
    const newConflicts: ConflictItem[] = [];
    
    // Check for empty/zero thresholds
    if (inventoryThresholds.tags.lowStockQty <= 0) {
      newConflicts.push({
        type: 'threshold-conflict',
        description: 'Tags low stock threshold cannot be zero or negative',
        recommendation: 'Set a positive minimum stock quantity',
        severity: 'error'
      });
    }

    // Check for conflicting value bands
    valueBands.forEach((band, index) => {
      if (band.recommendedTier === 'T1' && band.minValue > 2000) {
        newConflicts.push({
          type: 'value-policy',
          description: `Value band ${index + 1} suggests T1 for high-value items (€${band.minValue}+)`,
          recommendation: 'Consider T2 or T3 for values above €2000',
          severity: 'warning'
        });
      }
    });

    // Check risk weight normalization
    const weightSum = riskWeights.time + riskWeights.cost + riskWeights.risk;
    if (weightSum === 0) {
      newConflicts.push({
        type: 'threshold-conflict',
        description: 'Risk weights cannot all be zero',
        recommendation: 'Set at least one risk weight to a positive value',
        severity: 'error'
      });
    }

    setConflicts(newConflicts);
    return newConflicts.filter(c => c.severity === 'error').length === 0;
  };

  // Simulation functionality
  const runSimulation = async () => {
    if (!policyData) return;
    
    setIsSimulating(true);
    
    try {
      // Validate first
      if (!validatePolicy()) {
        setIsSimulating(false);
        return;
      }

      // Run simulation via API
      const result = await riskThresholdsApi.runSimulation(policyData.policy_id, {
        value_bands: valueBands,
        risk_weights: riskWeights,
        inventory_thresholds: inventoryThresholds,
        incident_rules: incidentRules
      });
      
      setSimulationResult(result);
      setShowSimulation(true);
      
      // Reload telemetry to reflect the new simulation
      loadTelemetryData();
      
    } catch (err) {
      console.error('Error running simulation:', err);
      setError(err instanceof Error ? err.message : 'Failed to run simulation');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!policyData || !validatePolicy()) return;
    
    try {
      setLoading(true);
      
      const policyUpdateData = {
        policy_id: policyData.policy_id,
        name: policyState.name,
        version: policyState.version,
        value_bands: valueBands,
        fragility_rules: fragilityRules,
        brand_overrides: brandOverrides,
        lane_risks: laneRisks,
        inventory_thresholds: inventoryThresholds,
        risk_weights: riskWeights,
        risk_components: riskComponents,
        security_defaults: securityDefaults,
        incident_rules: incidentRules,
        publishing_scope: publishingScope,
        change_reason: changeReason || 'Draft update',
        effective_date: policyState.effectiveDate,
        state: 'draft'
      };
      
      const result = await riskThresholdsApi.savePolicy(policyUpdateData);
      
      setPolicyData(result.policy);
      setHasUnsavedChanges(false);
      setShowGuardrails(result.requires_approval);
      
      // Reload policy data to reflect changes
      await loadPolicyData();
      
    } catch (err) {
      console.error('Error saving policy:', err);
      setError(err instanceof Error ? err.message : 'Failed to save policy');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishNow = () => {
    if (!validatePolicy()) return;
    
    if (showGuardrails || conflicts.some(c => c.severity === 'error')) {
      setShowApprovalModal(true);
    } else {
      publishPolicy();
    }
  };

  const publishPolicy = async () => {
    if (!policyData) return;
    
    try {
      setLoading(true);
      
      // Create pre-state snapshot for audit
      const preState = createStateSnapshot(policyData);
      
      const result = await riskThresholdsApi.publishPolicy(policyData.policy_id, {
        change_reason: changeReason
      });
      
      // Create post-state snapshot for audit
      const postState = createStateSnapshot(result);
      
      // Emit structured event per specification: settings.policy.published
      await SettingsEventAPI.policyPublished({
        actorId: 'current_user@aucta.io',
        version: result.version || policyData.version,
        effectiveAt: result.effective_date || new Date().toISOString(),
        policyType: 'risk_threshold',
        policyId: policyData.policy_id,
        publishedBy: 'current_user@aucta.io',
        preState,
        postState,
        sessionId: sessionRef.current
      });
      
      setPolicyState(prev => ({ ...prev, status: 'published' }));
      setHasUnsavedChanges(false);
      setShowApprovalModal(false);
      
      // Reload policy data to reflect published state
      await loadPolicyData();
      
    } catch (err) {
      console.error('Error publishing policy:', err);
      setError(err instanceof Error ? err.message : 'Failed to publish policy');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePublish = () => {
    console.log('Opening schedule modal...');
  };

  const handleRollback = async (version: string) => {
    if (!policyData) return;
    
    try {
      setLoading(true);
      
      const result = await riskThresholdsApi.rollbackPolicy(policyData.policy_id, {
        target_version: version,
        change_reason: `Rollback to version ${version}`
      });
      
      // Reload policy data to reflect rollback
      await loadPolicyData();
      
    } catch (err) {
      console.error('Error rolling back policy:', err);
      setError(err instanceof Error ? err.message : 'Failed to rollback policy');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state
  if (loading && !policyData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading risk policy data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !policyData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-6">
            <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Failed to Load Policy Data</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadPolicyData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Early return if no access
  if (!hasAccess) {
    return (
      <div className="main-content">
        <div className="container">
          <SettingsNavigation />
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="container space-y-6">
        <SettingsNavigation />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Thresholds & Risk Policies
            </h1>
            <p className="text-gray-600 mt-1">
              Configure operational thresholds and risk models that drive tier recommendations, 
              alerts, and system behaviors across the platform.
            </p>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Saving...</span>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Policy State Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{policyState.name}</h2>
                  <Badge className={getStatusColor(policyState.status)}>
                    {policyState.status}
                  </Badge>
                  <span className="text-sm text-gray-500">v{policyState.version}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Effective: {formatDateTime(policyState.effectiveDate).paris} (Paris)
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Last edited by {policyState.lastEditedBy}
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  <strong>Change reason:</strong> {policyState.changeReason}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={runSimulation}
                  disabled={isSimulating}
                >
                  {isSimulating ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Simulate
                </Button>
                <Button variant="outline" size="sm">
                  <History className="h-4 w-4 mr-1" />
                  History
                </Button>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-1" />
                  Compare
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Conflicts and Validation */}
              {conflicts.length > 0 && (
                <div className="space-y-2">
                  {conflicts.map((conflict, index) => (
                    <Alert 
                      key={index} 
                      className={conflict.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}
                    >
                      {conflict.severity === 'error' ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      )}
                      <AlertDescription className={conflict.severity === 'error' ? 'text-red-800' : 'text-yellow-800'}>
                        <strong>{conflict.description}</strong>
                        <br />
                        <span className="text-sm">{conflict.recommendation}</span>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {/* Simulation Results */}
              {showSimulation && simulationResult && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                        Simulation Results
                      </CardTitle>
                      <Badge 
                        variant={
                          simulationResult.estimatedImpact === 'High' ? 'destructive' :
                          simulationResult.estimatedImpact === 'Medium' ? 'default' : 'secondary'
                        }
                      >
                        {simulationResult.estimatedImpact} Impact
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {simulationResult.routeChanges.routesFlipped}
                        </div>
                        <div className="text-xs text-gray-600">Routes Flipped</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                          {simulationResult.routeChanges.newWarnings}
                        </div>
                        <div className="text-xs text-gray-600">New Warnings</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {simulationResult.routeChanges.newBlocks}
                        </div>
                        <div className="text-xs text-gray-600">New Blocks</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          +{simulationResult.alertChanges.totalAlertsChange}
                        </div>
                        <div className="text-xs text-gray-600">Total Alerts</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      Impact on {simulationResult.routeChanges.totalRoutes} total routes. 
                      New alerts: {simulationResult.alertChanges.newInventoryAlerts} inventory, 
                      {simulationResult.alertChanges.newCustomsAlerts} customs, 
                      {simulationResult.alertChanges.newIncidentRules} incident automation rules.
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {hasUnsavedChanges && (
                    <Alert className="w-auto">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>You have unsaved changes</AlertDescription>
                    </Alert>
                  )}
                  {showGuardrails && (
                    <Alert className="w-auto border-orange-200 bg-orange-50">
                      <Lock className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        Changes require two-person approval
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleSaveDraft}>
                    <Save className="h-4 w-4 mr-1" />
                    Save Draft
                  </Button>
                  <Button onClick={handlePublishNow}>
                    Publish Now
                  </Button>
                  <Button variant="outline" onClick={handleSchedulePublish}>
                    <Calendar className="h-4 w-4 mr-1" />
                    Schedule
                  </Button>
                  <Button variant="ghost">
                    Discard Changes
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Telemetry Dashboard */}
        {telemetryData && telemetryData.simulations.total_simulations > 0 && (
          <Card className="bg-gray-900 text-white">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Policy Effectiveness Telemetry ({telemetryData.period_days} days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <div className="text-xl font-bold">{telemetryData.simulations.total_simulations}</div>
                  <div className="text-gray-400">Simulations Run</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{telemetryData.simulations.avg_routes_flipped.toFixed(0)}</div>
                  <div className="text-gray-400">Avg Routes Flipped</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{telemetryData.policy_changes.total_changes}</div>
                  <div className="text-gray-400">Policy Changes</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{telemetryData.conflicts.resolved_conflicts}/{telemetryData.conflicts.total_conflicts}</div>
                  <div className="text-gray-400">Conflicts Resolved</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{(telemetryData.simulations.avg_duration_ms / 1000).toFixed(1)}s</div>
                  <div className="text-gray-400">Avg Sim Time</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approval Modal */}
        {showApprovalModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-orange-600" />
                  Two-Person Approval Required
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  These changes lower protection levels or contain errors that require additional approval.
                </p>
                <div>
                  <Label>Change Reason</Label>
                  <Textarea
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="Explain why these changes are necessary..."
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={publishPolicy}
                    disabled={!changeReason.trim()}
                  >
                    Request Approval & Publish
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowApprovalModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="value-fragility" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="value-fragility" className="text-xs">Value & Fragility</TabsTrigger>
            <TabsTrigger value="customs-lane" className="text-xs">Customs & Lane</TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs">Inventory</TabsTrigger>
            <TabsTrigger value="risk-model" className="text-xs">Risk Model</TabsTrigger>
            <TabsTrigger value="security" className="text-xs">Security & CoC</TabsTrigger>
            <TabsTrigger value="incidents" className="text-xs">Incidents</TabsTrigger>
            <TabsTrigger value="publishing" className="text-xs">Publishing</TabsTrigger>
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          </TabsList>

          {/* Value & Fragility Thresholds */}
          <TabsContent value="value-fragility" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Value & Fragility Thresholds
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Configure value bands and fragility rules that drive Tier and WG recommendations
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Value Bands */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="font-medium">Value Bands (EUR)</h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Configure value ranges that automatically suggest Tier levels and WG recommendations. These are non-blocking hints that Tier Gate will display.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="space-y-3">
                    {valueBands.map((band, index) => (
                      <div key={band.id} className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={band.minValue}
                            onChange={async (e) => {
                              const value = Number(e.target.value);
                              if (value < 0) return; // Prevent negative values
                              
                              const newBands = [...valueBands];
                              newBands[index].minValue = value;
                              await updateValueBandsWithEvent(newBands, `minValue[${index}]`, index);
                              validatePolicy();
                            }}
                            className="w-24"
                            min="0"
                          />
                          <span>-</span>
                          {band.maxValue ? (
                            <Input
                              type="number"
                              value={band.maxValue}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                if (value <= band.minValue) return; // Prevent invalid ranges
                                
                                const newBands = [...valueBands];
                                newBands[index].maxValue = value;
                                setValueBands(newBands);
                                setHasUnsavedChanges(true);
                                validatePolicy();
                              }}
                              className="w-24"
                              min={band.minValue + 1}
                            />
                          ) : (
                            <span className="w-24 text-center text-gray-500">∞</span>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Select
                                  value={band.recommendedTier}
                                  onValueChange={(value: 'T1' | 'T2' | 'T3') => {
                                    const newBands = [...valueBands];
                                    newBands[index].recommendedTier = value;
                                    setValueBands(newBands);
                                    setHasUnsavedChanges(true);
                                    // Check if lowering protection
                                    if ((value === 'T1' && band.minValue > 1000) || 
                                        (value === 'T2' && band.minValue > 5000)) {
                                      setShowGuardrails(true);
                                    }
                                    validatePolicy();
                                  }}
                                >
                                  <SelectTrigger className="w-20">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="T1">T1</SelectItem>
                                    <SelectItem value="T2">T2</SelectItem>
                                    <SelectItem value="T3">T3</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Recommended Tier for this value range. 
                                {band.recommendedTier === 'T1' && band.minValue > 1000 && (
                                  <span className="text-yellow-600"><br/>⚠️ T1 for high values may need approval</span>
                                )}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <div className="flex items-center space-x-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    checked={band.wgRecommended}
                                    onCheckedChange={(checked) => {
                                      const newBands = [...valueBands];
                                      newBands[index].wgRecommended = checked as boolean;
                                      setValueBands(newBands);
                                      setHasUnsavedChanges(true);
                                    }}
                                  />
                                  <Label className="text-sm">WG Recommended</Label>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>When enabled, Plan page will show WG recommendation hints for this value range and apply risk bump to routes that ignore the hint.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        {/* Conflict indicator */}
                        {conflicts.some(c => c.description.includes(`Value band ${index + 1}`)) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-yellow-800">This configuration may have conflicts. Check the validation messages above.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-gray-600 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    <span>Value bands create non-blocking recommendations. Brand overrides can enforce minimum tiers.</span>
                  </div>
                </div>

                {/* Fragility Rules */}
                <div>
                  <h3 className="font-medium mb-4">Fragility Rules</h3>
                  <div className="space-y-3">
                    {fragilityRules.map((rule, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Label className="w-20">Fragility {rule.fragility}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={rule.wgRecommended}
                            onCheckedChange={(checked) => {
                              const newRules = [...fragilityRules];
                              newRules[index].wgRecommended = checked as boolean;
                              setFragilityRules(newRules);
                              setHasUnsavedChanges(true);
                            }}
                          />
                          <Label className="text-sm">WG Recommended</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={rule.requiresRigidPackaging}
                            onCheckedChange={(checked) => {
                              const newRules = [...fragilityRules];
                              newRules[index].requiresRigidPackaging = checked as boolean;
                              setFragilityRules(newRules);
                              setHasUnsavedChanges(true);
                            }}
                          />
                          <Label className="text-sm">Requires Rigid Packaging</Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Brand Overrides */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Brand/Marketplace Policy Overrides</h3>
                    <Button size="sm">Add Override</Button>
                  </div>
                  <div className="space-y-3">
                    {brandOverrides.map((override, index) => (
                      <div key={override.id} className="flex items-center gap-4 p-4 border rounded-lg">
                        <Input
                          value={override.brand}
                          onChange={(e) => {
                            const newOverrides = [...brandOverrides];
                            newOverrides[index].brand = e.target.value;
                            setBrandOverrides(newOverrides);
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="Brand name"
                          className="flex-1"
                        />
                        <Input
                          value={override.marketplace}
                          onChange={(e) => {
                            const newOverrides = [...brandOverrides];
                            newOverrides[index].marketplace = e.target.value;
                            setBrandOverrides(newOverrides);
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="Marketplace"
                          className="flex-1"
                        />
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                        <Select
                          value={override.minimumTier}
                          onValueChange={(value: 'T1' | 'T2' | 'T3') => {
                            const newOverrides = [...brandOverrides];
                            newOverrides[index].minimumTier = value;
                            setBrandOverrides(newOverrides);
                            setHasUnsavedChanges(true);
                          }}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="T1">T1</SelectItem>
                            <SelectItem value="T2">T2</SelectItem>
                            <SelectItem value="T3">T3</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm">Remove</Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customs & Lane Risk */}
          <TabsContent value="customs-lane" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Customs & Lane Risk
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Configure lane-specific risk levels and document requirements
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {laneRisks.map((lane, index) => (
                  <div key={lane.id} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{lane.category}</h3>
                      <Badge variant="outline">
                        Risk Level: {(lane.baseRiskLevel * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Base Risk Level</Label>
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={lane.baseRiskLevel}
                          onChange={(e) => {
                            const newLanes = [...laneRisks];
                            newLanes[index].baseRiskLevel = Number(e.target.value);
                            setLaneRisks(newLanes);
                            setHasUnsavedChanges(true);
                          }}
                        />
                      </div>
                      
                      <div>
                        <Label>Auto-Incident Hours</Label>
                        <Input
                          type="number"
                          value={lane.autoIncidentHours}
                          onChange={(e) => {
                            const newLanes = [...laneRisks];
                            newLanes[index].autoIncidentHours = Number(e.target.value);
                            setLaneRisks(newLanes);
                            setHasUnsavedChanges(true);
                          }}
                        />
                      </div>
                      
                      <div>
                        <Label>Required Documents</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {lane.requiredDocs.map((doc, docIndex) => (
                            <Badge key={docIndex} variant="secondary" className="text-xs">
                              {doc}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Thresholds */}
          <TabsContent value="inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Inventory Thresholds
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Global defaults for inventory alerts and stock management
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tags */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Tags</h3>
                    <div className="space-y-3">
                      <div>
                        <Label>Low Stock Threshold (qty)</Label>
                        <Input
                          type="number"
                          value={inventoryThresholds.tags.lowStockQty}
                          onChange={(e) => {
                            setInventoryThresholds(prev => ({
                              ...prev,
                              tags: { ...prev.tags, lowStockQty: Number(e.target.value) }
                            }));
                            setHasUnsavedChanges(true);
                          }}
                        />
                      </div>
                      <div>
                        <Label>Min Days of Cover</Label>
                        <Input
                          type="number"
                          value={inventoryThresholds.tags.minDaysOfCover}
                          onChange={(e) => {
                            setInventoryThresholds(prev => ({
                              ...prev,
                              tags: { ...prev.tags, minDaysOfCover: Number(e.target.value) }
                            }));
                            setHasUnsavedChanges(true);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* NFC */}
                  <div className="space-y-4">
                    <h3 className="font-medium">NFC</h3>
                    <div className="space-y-3">
                      <div>
                        <Label>Low Stock Threshold (qty)</Label>
                        <Input
                          type="number"
                          value={inventoryThresholds.nfc.lowStockQty}
                          onChange={(e) => {
                            setInventoryThresholds(prev => ({
                              ...prev,
                              nfc: { ...prev.nfc, lowStockQty: Number(e.target.value) }
                            }));
                            setHasUnsavedChanges(true);
                          }}
                        />
                      </div>
                      <div>
                        <Label>Min Days of Cover</Label>
                        <Input
                          type="number"
                          value={inventoryThresholds.nfc.minDaysOfCover}
                          onChange={(e) => {
                            setInventoryThresholds(prev => ({
                              ...prev,
                              nfc: { ...prev.nfc, minDaysOfCover: Number(e.target.value) }
                            }));
                            setHasUnsavedChanges(true);
                          }}
                        />
                      </div>
                      <div>
                        <Label>Lot Failure Quarantine Threshold (%)</Label>
                        <Input
                          type="number"
                          value={inventoryThresholds.nfc.lotFailureQuarantineThreshold}
                          onChange={(e) => {
                            setInventoryThresholds(prev => ({
                              ...prev,
                              nfc: { ...prev.nfc, lotFailureQuarantineThreshold: Number(e.target.value) }
                            }));
                            setHasUnsavedChanges(true);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div>
                    <Label>Transfer SLA Target (hours)</Label>
                    <Input
                      type="number"
                      value={inventoryThresholds.transferSlaHours}
                      onChange={(e) => {
                        setInventoryThresholds(prev => ({
                          ...prev,
                          transferSlaHours: Number(e.target.value)
                        }));
                        setHasUnsavedChanges(true);
                      }}
                      className="w-32"
                    />
                    <p className="text-sm text-gray-600 mt-1">
                      Time target to clear low-stock alerts through transfers
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risk Model */}
          <TabsContent value="risk-model" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Risk Model Weights & Signals
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Configure how route scores are calculated and risk factors are weighted
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Scoring Weights */}
                <div>
                  <h3 className="font-medium mb-4">Scoring Weights</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Time Weight (α)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={riskWeights.time}
                        onChange={(e) => {
                          setRiskWeights(prev => ({ ...prev, time: Number(e.target.value) }));
                          setHasUnsavedChanges(true);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Cost Weight (β)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={riskWeights.cost}
                        onChange={(e) => {
                          setRiskWeights(prev => ({ ...prev, cost: Number(e.target.value) }));
                          setHasUnsavedChanges(true);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Risk Weight (γ)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={riskWeights.risk}
                        onChange={(e) => {
                          setRiskWeights(prev => ({ ...prev, risk: Number(e.target.value) }));
                          setHasUnsavedChanges(true);
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Normalized weights: Time {(normalizeWeights(riskWeights).time * 100).toFixed(0)}%, 
                    Cost {(normalizeWeights(riskWeights).cost * 100).toFixed(0)}%, 
                    Risk {(normalizeWeights(riskWeights).risk * 100).toFixed(0)}%
                  </div>
                </div>

                {/* Risk Components */}
                <div>
                  <h3 className="font-medium mb-4">Risk Components</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(riskComponents).map(([key, value]) => (
                      <div key={key}>
                        <Label className="capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={value}
                          onChange={(e) => {
                            setRiskComponents(prev => ({ 
                              ...prev, 
                              [key]: Number(e.target.value) 
                            }));
                            setHasUnsavedChanges(true);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security & CoC */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security & Chain of Custody Defaults
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Configure baseline security requirements and photo documentation
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-medium">Authentication</h3>
                    <div>
                      <Label>OTP + Liveness for Value ≥ (EUR)</Label>
                      <Input
                        type="number"
                        value={securityDefaults.otpLivenessValueThreshold}
                        onChange={(e) => {
                          setSecurityDefaults(prev => ({
                            ...prev,
                            otpLivenessValueThreshold: Number(e.target.value)
                          }));
                          setHasUnsavedChanges(true);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Seal Required for Tiers</Label>
                      <div className="flex gap-2 mt-1">
                        {['T1', 'T2', 'T3'].map((tier) => (
                          <div key={tier} className="flex items-center space-x-2">
                            <Checkbox
                              checked={securityDefaults.sealRequiredTiers.includes(tier as 'T2' | 'T3')}
                              onCheckedChange={(checked) => {
                                setSecurityDefaults(prev => ({
                                  ...prev,
                                  sealRequiredTiers: checked
                                    ? [...prev.sealRequiredTiers, tier as 'T2' | 'T3']
                                    : prev.sealRequiredTiers.filter(t => t !== tier)
                                }));
                                setHasUnsavedChanges(true);
                              }}
                            />
                            <Label className="text-sm">{tier}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Photo Requirements
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <Label>Minimum Photos at Pickup</Label>
                        <Input
                          type="number"
                          min="0"
                          value={securityDefaults.minPhotosPickup}
                          onChange={(e) => {
                            setSecurityDefaults(prev => ({
                              ...prev,
                              minPhotosPickup: Number(e.target.value)
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="w-20"
                        />
                      </div>
                      <div>
                        <Label>Minimum Photos at Intake</Label>
                        <Input
                          type="number"
                          min="0"
                          value={securityDefaults.minPhotosIntake}
                          onChange={(e) => {
                            setSecurityDefaults(prev => ({
                              ...prev,
                              minPhotosIntake: Number(e.target.value)
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="w-20"
                        />
                      </div>
                      <div>
                        <Label>Minimum Photos at Delivery</Label>
                        <Input
                          type="number"
                          min="0"
                          value={securityDefaults.minPhotosDelivery}
                          onChange={(e) => {
                            setSecurityDefaults(prev => ({
                              ...prev,
                              minPhotosDelivery: Number(e.target.value)
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="w-20"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Incident Automation */}
          <TabsContent value="incidents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Incident Automation & Escalation
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Configure automatic incident creation and escalation rules
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {incidentRules.map((rule, index) => (
                    <div key={rule.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{rule.trigger}</h3>
                        <Badge variant={
                          rule.severity === 'S1' ? 'destructive' :
                          rule.severity === 'S2' ? 'default' : 'secondary'
                        }>
                          {rule.severity}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Condition</Label>
                          <Input
                            value={rule.condition}
                            onChange={(e) => {
                              const newRules = [...incidentRules];
                              newRules[index].condition = e.target.value;
                              setIncidentRules(newRules);
                              setHasUnsavedChanges(true);
                            }}
                          />
                        </div>
                        <div>
                          <Label>Assign To</Label>
                          <Input
                            value={rule.assignTo}
                            onChange={(e) => {
                              const newRules = [...incidentRules];
                              newRules[index].assignTo = e.target.value;
                              setIncidentRules(newRules);
                              setHasUnsavedChanges(true);
                            }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={rule.description}
                          onChange={(e) => {
                            const newRules = [...incidentRules];
                            newRules[index].description = e.target.value;
                            setIncidentRules(newRules);
                            setHasUnsavedChanges(true);
                          }}
                          rows={2}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-medium mb-3">Escalation Rules</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="w-8 justify-center">S1</Badge>
                      <span>1 hour → auto-bump severity and notify on-call</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="w-8 justify-center">S2</Badge>
                      <span>4 hours → auto-bump severity and notify team lead</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="w-8 justify-center">S3</Badge>
                      <span>24 hours → auto-bump severity and notify manager</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Publishing & Scope */}
          <TabsContent value="publishing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Publishing & Scope
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Configure how and when policy changes are applied across the system
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Application Scope</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={publishingScope.newShipmentsOnly}
                        onCheckedChange={(checked) => {
                          setPublishingScope(prev => ({
                            ...prev,
                            newShipmentsOnly: checked as boolean
                          }));
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <Label>Apply to new shipments only</Label>
                      <Info className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={publishingScope.unplannedDrafts}
                        onCheckedChange={(checked) => {
                          setPublishingScope(prev => ({
                            ...prev,
                            unplannedDrafts: checked as boolean
                          }));
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <Label>Also apply to unplanned drafts (Tier hints)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={publishingScope.retroactiveChanges}
                        onCheckedChange={(checked) => {
                          setPublishingScope(prev => ({
                            ...prev,
                            retroactiveChanges: checked as boolean
                          }));
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <Label>Retroactively change planned shipments</Label>
                      <Badge variant="outline" className="text-xs">Not Recommended</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Notification Settings</h3>
                  <div>
                    <Label>Notify Roles on Publish</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['Ops', 'WG Coordinators', 'Hub Leads', 'Management'].map((role) => (
                        <div key={role} className="flex items-center space-x-2">
                          <Checkbox
                            checked={publishingScope.notifyRoles.includes(role)}
                            onCheckedChange={(checked) => {
                              setPublishingScope(prev => ({
                                ...prev,
                                notifyRoles: checked
                                  ? [...prev.notifyRoles, role]
                                  : prev.notifyRoles.filter(r => r !== role)
                              }));
                              setHasUnsavedChanges(true);
                            }}
                          />
                          <Label className="text-sm">{role}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Scheduling</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Effective Date/Time (Europe/Paris)</Label>
                      <Input
                        type="datetime-local"
                        value={policyState.effectiveDate.slice(0, 16)}
                        onChange={(e) => {
                          setPolicyState(prev => ({
                            ...prev,
                            effectiveDate: e.target.value + ':00'
                          }));
                          setHasUnsavedChanges(true);
                        }}
                      />
                    </div>
                    <div>
                      <Label>UTC Mirror (read-only)</Label>
                      <Input
                        value={formatDateTime(policyState.effectiveDate).utc + ' UTC'}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Policy Impact Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Policy Impact Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Value bands configured</span>
                      <Badge variant="outline">{valueBands.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Brand overrides</span>
                      <Badge variant="outline">{brandOverrides.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Lane categories</span>
                      <Badge variant="outline">{laneRisks.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Incident rules</span>
                      <Badge variant="outline">{incidentRules.length}</Badge>
                    </div>
                  </div>
                  
                  {/* Formula Explanations */}
                  <div className="pt-4 border-t space-y-3">
                    <h4 className="font-medium text-sm">Key Formulas</h4>
                    <div className="space-y-2 text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-3 w-3" />
                        <span><strong>Route Score:</strong> α×Time + β×Cost + γ×Risk</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-3 w-3" />
                        <span><strong>Customs Risk:</strong> Lane Base + Missing Docs Penalty</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-3 w-3" />
                        <span><strong>Days of Cover:</strong> Current Stock ÷ 7-day Burn Rate</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Policy Versions & Rollback */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Version History & Rollback
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {policyVersions.map((version, index) => (
                      <div key={version.version} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline"
                              className="text-xs"
                            >
                              v{version.version}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={
                                version.change_type === 'published' ? 'bg-green-100 text-green-800' :
                                version.change_type === 'created' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }
                            >
                              {version.change_type}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-600">
                            {formatDateTime(version.changed_at).paris} by {version.changed_by}
                          </div>
                          <div className="text-xs text-gray-500">{version.change_reason}</div>
                        </div>
                        {version.change_type !== 'published' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleRollback(version.version)}
                            disabled={loading}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Rollback
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* System Integration Points */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    System Integration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Tier Gate</span>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-gray-600">Recommendations & Blocks</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Quote & Plan</span>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-gray-600">Route Scoring</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Dashboard Alerts</span>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-gray-600">Alert Logic</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Inventory Pages</span>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-gray-600">Default Thresholds</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>WG Scheduling</span>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-gray-600">Security Defaults</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Hub Console</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">Local Override</Badge>
                        <span className="text-xs text-gray-600">Baseline Requirements</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Effects After Publish */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Data Effects After Publish
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-3 w-3 text-blue-600" />
                      <span>Tier Gate hints update immediately</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-3 w-3 text-blue-600" />
                      <span>Plan scoring reads new weights & risk inputs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-3 w-3 text-blue-600" />
                      <span>Dashboard alert logic updates</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-3 w-3 text-blue-600" />
                      <span>Inventory pages inherit new defaults</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-3 w-3 text-blue-600" />
                      <span>Incident automation rules activate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-yellow-600" />
                      <span>Local Hub overrides remain unchanged</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
