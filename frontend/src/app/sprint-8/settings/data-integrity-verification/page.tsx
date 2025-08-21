'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, AlertTriangle, Play, RefreshCw, Shield, Database } from 'lucide-react';
import SettingsEventAPI from '@/lib/eventAuditSystem';

export default function DataIntegrityVerificationPage() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activePolicies, setActivePolicies] = useState<any>(null);
  const [integrityStatus, setIntegrityStatus] = useState<any>(null);
  const [duplicateTestData, setDuplicateTestData] = useState({
    policyId: 'test-policy-001',
    changeReason: 'Duplicate prevention test'
  });

  // Load active policies and integrity status on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [policiesResult, integrityResult] = await Promise.all([
        SettingsEventAPI.getActivePolicies(),
        SettingsEventAPI.checkDataIntegrity()
      ]);
      
      setActivePolicies(policiesResult);
      setIntegrityStatus(integrityResult);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const runDuplicatePreventionTest = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      const testPolicy = {
        policy_id: duplicateTestData.policyId,
        name: 'Test Policy for Duplicate Prevention',
        version: '1.0.0',
        sla_targets: {
          classification: { timeToClassify: 4 },
          pickup: { tier1ResponseHours: 24, tier2ResponseHours: 48 },
          hubProcessing: { tier1MaxHours: 4, tier2MaxHours: 8 },
          delivery: { standardDays: 7, expressionDays: 3 }
        },
        margin_thresholds: {
          global: { minimumMargin: 15, targetMargin: 25 },
          components: { wgComponent: 5, dhlComponent: 3 }
        },
        effective_date: new Date().toISOString()
      };

      // Test 1: First publish attempt
      const firstPublish = await SettingsEventAPI.publishSLAMarginPolicy({
        policyData: testPolicy,
        actorId: 'test_user@aucta.io',
        changeReason: duplicateTestData.changeReason,
        requestId: 'test-request-001'
      });

      setTestResults(prev => [...prev, {
        test: 'First Policy Publish',
        status: firstPublish.success ? 'pass' : 'fail',
        details: firstPublish.success 
          ? `Policy created successfully: ${firstPublish.policyId} (duplicate: ${firstPublish.isDuplicate})`
          : `Policy creation failed: ${firstPublish.error}`,
        response: firstPublish
      }]);

      // Test 2: Duplicate attempt with same request ID (should be prevented)
      const duplicatePublish1 = await SettingsEventAPI.publishSLAMarginPolicy({
        policyData: testPolicy,
        actorId: 'test_user@aucta.io',
        changeReason: duplicateTestData.changeReason,
        requestId: 'test-request-001' // Same request ID
      });

      setTestResults(prev => [...prev, {
        test: 'Duplicate Request ID',
        status: duplicatePublish1.isDuplicate ? 'pass' : 'fail',
        details: duplicatePublish1.isDuplicate 
          ? 'Duplicate correctly prevented by idempotency key'
          : 'Duplicate was NOT prevented - this is a violation',
        response: duplicatePublish1
      }]);

      // Test 3: Same payload, different request ID (should be prevented by payload hash)
      const duplicatePublish2 = await SettingsEventAPI.publishSLAMarginPolicy({
        policyData: testPolicy,
        actorId: 'test_user@aucta.io',
        changeReason: duplicateTestData.changeReason,
        requestId: 'test-request-002' // Different request ID
      });

      setTestResults(prev => [...prev, {
        test: 'Duplicate Payload Hash',
        status: duplicatePublish2.isDuplicate ? 'pass' : 'fail',
        details: duplicatePublish2.isDuplicate 
          ? 'Duplicate correctly prevented by payload hash'
          : 'Duplicate was NOT prevented - this is a violation',
        response: duplicatePublish2
      }]);

      // Test 4: Overlapping policy test
      const overlappingPolicy = {
        ...testPolicy,
        policy_id: duplicateTestData.policyId + '-overlap',
        name: 'Overlapping Test Policy',
        effective_date: new Date(Date.now() + 60000).toISOString() // 1 minute in future
      };

      const overlapPublish = await SettingsEventAPI.publishSLAMarginPolicy({
        policyData: overlappingPolicy,
        actorId: 'test_user@aucta.io',
        changeReason: 'Testing overlap prevention',
        requestId: 'test-request-003'
      });

      setTestResults(prev => [...prev, {
        test: 'Overlapping Policy Prevention',
        status: overlapPublish.error === 'OVERLAPPING_POLICY' ? 'pass' : 'fail',
        details: overlapPublish.error === 'OVERLAPPING_POLICY'
          ? 'Overlapping policy correctly prevented'
          : 'Overlapping policy was NOT prevented - this is a violation',
        response: overlapPublish
      }]);

      // Test 5: Refresh data integrity check
      const finalIntegrityCheck = await SettingsEventAPI.checkDataIntegrity();
      
      setTestResults(prev => [...prev, {
        test: 'Final Integrity Check',
        status: finalIntegrityCheck.success ? 'pass' : 'fail',
        details: finalIntegrityCheck.success
          ? 'No data integrity violations found'
          : `Data integrity violations: ${finalIntegrityCheck.violations?.length || 0}`,
        response: finalIntegrityCheck
      }]);

      setIntegrityStatus(finalIntegrityCheck);

    } catch (error) {
      setTestResults(prev => [...prev, {
        test: 'Test Execution',
        status: 'fail',
        details: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        response: null
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const runSchedulingTest = async () => {
    setIsRunning(true);
    
    try {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now
      const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

      // Test invalid (past) date
      const pastSchedule = await SettingsEventAPI.schedulePolicy({
        policyType: 'sla_margin',
        policyData: {
          policy_id: 'schedule-test-past',
          name: 'Past Schedule Test',
          version: '1.0.0',
          sla_targets: {},
          margin_thresholds: {}
        },
        effectiveAt: pastDate,
        actorId: 'test_user@aucta.io',
        changeReason: 'Testing past date validation'
      });

      setTestResults(prev => [...prev, {
        test: 'Past Date Validation',
        status: pastSchedule.error === 'INVALID_SCHEDULE_DATE' ? 'pass' : 'fail',
        details: pastSchedule.error === 'INVALID_SCHEDULE_DATE'
          ? 'Past date correctly rejected'
          : 'Past date was NOT rejected - this is a violation',
        response: pastSchedule
      }]);

      // Test valid future date
      const futureSchedule = await SettingsEventAPI.schedulePolicy({
        policyType: 'sla_margin',
        policyData: {
          policy_id: 'schedule-test-future',
          name: 'Future Schedule Test',
          version: '1.0.0',
          sla_targets: {},
          margin_thresholds: {}
        },
        effectiveAt: futureDate,
        actorId: 'test_user@aucta.io',
        changeReason: 'Testing future date scheduling'
      });

      setTestResults(prev => [...prev, {
        test: 'Future Date Scheduling',
        status: futureSchedule.success ? 'pass' : 'fail',
        details: futureSchedule.success
          ? `Policy scheduled successfully for ${futureDate}`
          : `Scheduling failed: ${futureSchedule.error}`,
        response: futureSchedule
      }]);

    } catch (error) {
      setTestResults(prev => [...prev, {
        test: 'Scheduling Test',
        status: 'fail',
        details: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        response: null
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container space-y-6">
      <div className="card">
        <div style={{ padding: 'var(--space-lg)' }}>
          <h1 style={{ 
            fontSize: 'var(--font-large)', 
            fontWeight: 500, 
            marginBottom: 'var(--space-sm)' 
          }}>
            Data Integrity Verification
          </h1>
          <p style={{ color: 'var(--muted)', marginBottom: 'var(--space-lg)' }}>
            Test duplicate prevention, unique constraints, and scheduling validation.
          </p>
          
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <Button onClick={runDuplicatePreventionTest} disabled={isRunning}>
              <Shield className="h-4 w-4 mr-2" />
              {isRunning ? 'Running Tests...' : 'Test Duplicate Prevention'}
            </Button>
            <Button onClick={runSchedulingTest} disabled={isRunning} variant="outline">
              <Play className="h-4 w-4 mr-2" />
              Test Scheduling Validation
            </Button>
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>

          {/* Test Configuration */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="policyId">Test Policy ID</Label>
                <Input
                  id="policyId"
                  value={duplicateTestData.policyId}
                  onChange={(e) => setDuplicateTestData(prev => ({ 
                    ...prev, 
                    policyId: e.target.value 
                  }))}
                  placeholder="Enter policy ID for testing"
                />
              </div>
              <div>
                <Label htmlFor="changeReason">Change Reason</Label>
                <Input
                  id="changeReason"
                  value={duplicateTestData.changeReason}
                  onChange={(e) => setDuplicateTestData(prev => ({ 
                    ...prev, 
                    changeReason: e.target.value 
                  }))}
                  placeholder="Enter change reason"
                />
              </div>
            </CardContent>
          </Card>

          {/* Test Results */}
          {testResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded">
                      {result.status === 'pass' && <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />}
                      {result.status === 'fail' && <XCircle className="h-5 w-5 text-red-600 mt-0.5" />}
                      {result.status === 'pending' && <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />}
                      <div className="flex-1">
                        <div className="font-medium">{result.test}</div>
                        <div className="text-sm text-gray-600">{result.details}</div>
                        {result.response && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-600 cursor-pointer">View Response</summary>
                            <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                              {JSON.stringify(result.response, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Current Data Integrity Status */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: 'var(--space-lg)' 
      }}>
        {integrityStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Integrity Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {integrityStatus.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={integrityStatus.success ? 'text-green-700' : 'text-red-700'}>
                    {integrityStatus.summary}
                  </span>
                </div>
                
                {integrityStatus.violations && integrityStatus.violations.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-red-700 mb-2">Violations Found:</h4>
                    <ul className="space-y-2">
                      {integrityStatus.violations.map((violation: any, index: number) => (
                        <li key={index} className="text-sm bg-red-50 p-2 rounded">
                          <strong>{violation.checkName}:</strong> {violation.violationCount} violations
                          {violation.details && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs text-red-600">View Details</summary>
                              <pre className="text-xs mt-1 overflow-auto">
                                {JSON.stringify(violation.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activePolicies && (
          <Card>
            <CardHeader>
              <CardTitle>Active Policies Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(activePolicies.summary).map(([type, policies]: [string, any]) => (
                  <div key={type}>
                    <h4 className="font-medium capitalize">{type.replace('_', ' ')} Policies</h4>
                    {policies.length === 0 ? (
                      <p className="text-sm text-gray-500">No active policies</p>
                    ) : (
                      <ul className="space-y-1">
                        {policies.map((policy: any, index: number) => (
                          <li key={index} className="text-sm bg-gray-50 p-2 rounded">
                            <strong>{policy.policyId}</strong> (v{policy.version})
                            <br />
                            <span className="text-gray-600">
                              {policy.state} • Effective: {new Date(policy.effectiveDate).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                <div className="mt-4 p-3 bg-blue-50 rounded">
                  <strong>Total Active Policies:</strong> {activePolicies.totalActive}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Data Integrity Requirements */}
      <Card>
        <CardHeader>
          <CardTitle>Data Integrity Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">✅ Implemented Protections</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Unique constraints for one active policy per type
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Idempotency keys prevent duplicate publishes
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Payload hash validation for content duplicates
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Effective date overlap validation
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Automatic archival of superseded policies
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Future date validation for scheduling
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">🎯 Acceptance Criteria</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Attempted duplicate publishes result in no extra rows/events
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Only one Active policy per category at a time
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  No overlapping active windows
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Idempotent operations with consistent results
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Database constraints prevent integrity violations
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Comprehensive monitoring and violation detection
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
