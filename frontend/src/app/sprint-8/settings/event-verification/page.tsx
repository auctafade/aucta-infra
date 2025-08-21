'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertTriangle, Play, Eye } from 'lucide-react';

export default function EventVerificationPage() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Event specifications per requirements
  const eventSpecifications = [
    {
      page: 'SLA/Margins',
      events: [
        {
          name: 'settings.sla.updated',
          fields: ['actorId', 'version', 'effectiveAt', 'fieldsChanged', 'ts', 'correlationId'],
          description: 'Emitted when SLA timing targets are modified',
          trigger: 'Field change in SLA targets section'
        },
        {
          name: 'settings.margin.updated', 
          fields: ['actorId', 'version', 'effectiveAt', 'fieldsChanged', 'ts', 'correlationId'],
          description: 'Emitted when margin thresholds are modified',
          trigger: 'Field change in margin thresholds section'
        },
        {
          name: 'settings.policy.published',
          fields: ['actorId', 'version', 'effectiveAt', 'ts', 'correlationId'],
          description: 'Emitted when SLA/margin policy is published',
          trigger: 'Publish Now button click'
        }
      ]
    },
    {
      page: 'Hub Capacity',
      events: [
        {
          name: 'settings.hub_capacity.published',
          fields: ['actorId', 'version', 'effectiveAt', 'ts', 'correlationId'],
          description: 'Emitted when hub capacity profile is published',
          trigger: 'Publish Now button click'
        },
        {
          name: 'hub_capacity.changed',
          fields: ['actorId', 'fieldsChanged', 'ts', 'correlationId'],
          description: 'Emitted when capacity settings are modified',
          trigger: 'Save Draft or configuration changes'
        }
      ]
    },
    {
      page: 'Thresholds & Risk',
      events: [
        {
          name: 'settings.thresholds.updated',
          fields: ['actorId', 'version', 'effectiveAt', 'fieldsChanged', 'ts', 'correlationId'],
          description: 'Emitted when value bands or thresholds are modified',
          trigger: 'Field change in value bands, fragility rules, etc.'
        },
        {
          name: 'settings.riskmodel.updated',
          fields: ['actorId', 'version', 'effectiveAt', 'fieldsChanged', 'ts', 'correlationId'],
          description: 'Emitted when risk model weights are modified',
          trigger: 'Field change in risk model section'
        },
        {
          name: 'settings.policy.published',
          fields: ['actorId', 'version', 'effectiveAt', 'ts', 'correlationId'],
          description: 'Emitted when risk threshold policy is published',
          trigger: 'Request Approval & Publish button click'
        }
      ]
    }
  ];

  const auditRequirements = [
    {
      requirement: 'Idempotency',
      description: 'Re-submitting the same change (same hash of payload) doesn\'t produce duplicate state',
      implementation: 'PayloadHash-based deduplication in EventProcessor',
      status: 'implemented'
    },
    {
      requirement: 'Correlation IDs',
      description: 'Related events are grouped with same correlationId',
      implementation: 'UUID-based correlation with session tracking',
      status: 'implemented'
    },
    {
      requirement: 'Pre/Post State Diffs',
      description: 'Audit trail shows who/what/when and diffs',
      implementation: 'createStateSnapshot with field-level diff calculation',
      status: 'implemented'
    },
    {
      requirement: 'One Event Per Action',
      description: 'One and only one event per confirmed action; replay safe',
      implementation: 'Backend duplicate detection via payload hash',
      status: 'implemented'
    },
    {
      requirement: 'Required Fields',
      description: 'All events include actorId, ts, correlationId per spec',
      implementation: 'Enforced by SettingsEventAPI interface',
      status: 'implemented'
    }
  ];

  const runEventTest = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      // Test event emission by calling the settings event API
      const testEvent = {
        eventType: 'settings.sla.updated',
        actorId: 'test_user@aucta.io',
        version: '1.0.0',
        effectiveAt: new Date().toISOString(),
        fieldsChanged: ['hubProcessing.tier1MaxHours'],
        ts: new Date().toISOString(),
        correlationId: 'test-correlation-001',
        eventId: 'test-event-001',
        payloadHash: 'test-hash-001',
        payload: {
          slaSection: 'hubProcessing',
          slaField: 'tier1MaxHours',
          oldValue: 4,
          newValue: 3
        },
        preState: { 'hubProcessing.tier1MaxHours': 4 },
        postState: { 'hubProcessing.tier1MaxHours': 3 }
      };

      const response = await fetch('/api/events/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': testEvent.correlationId
        },
        body: JSON.stringify(testEvent)
      });

      const result = await response.json();
      
      setTestResults([
        {
          test: 'Event API Connectivity',
          status: response.ok ? 'pass' : 'fail',
          details: response.ok ? 'Successfully connected to events API' : `API error: ${result.error}`,
          response: result
        },
        {
          test: 'Event Validation',
          status: result.success ? 'pass' : 'fail',
          details: result.success ? 'Event passed backend validation' : `Validation failed: ${result.details?.join(', ')}`,
          response: result
        },
        {
          test: 'Idempotency Check',
          status: 'pending',
          details: 'Testing duplicate event submission...',
          response: null
        }
      ]);

      // Test idempotency by sending the same event again
      const duplicateResponse = await fetch('/api/events/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': testEvent.correlationId
        },
        body: JSON.stringify(testEvent)
      });

      const duplicateResult = await duplicateResponse.json();
      
      setTestResults(prev => prev.map(test => 
        test.test === 'Idempotency Check' 
          ? {
              ...test,
              status: duplicateResult.skipped ? 'pass' : 'fail',
              details: duplicateResult.skipped 
                ? 'Duplicate event correctly skipped' 
                : 'Duplicate event was not detected',
              response: duplicateResult
            }
          : test
      ));

    } catch (error) {
      setTestResults([
        {
          test: 'Event System Test',
          status: 'fail',
          details: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          response: null
        }
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const fetchAuditTrail = async () => {
    try {
      const response = await fetch('/api/audit/settings/sla/policy-001?limit=10');
      const result = await response.json();
      
      setTestResults(prev => [...prev, {
        test: 'Audit Trail Retrieval',
        status: response.ok ? 'pass' : 'fail',
        details: response.ok 
          ? `Retrieved ${result.auditTrail?.length || 0} audit entries`
          : `Audit API error: ${result.error}`,
        response: result
      }]);
    } catch (error) {
      setTestResults(prev => [...prev, {
        test: 'Audit Trail Retrieval',
        status: 'fail',
        details: `Audit test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        response: null
      }]);
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
            Event Logging & Audit Verification
          </h1>
          <p style={{ color: 'var(--muted)', marginBottom: 'var(--space-lg)' }}>
            Verify that all critical actions emit structured, deduplicated events with correlation IDs.
          </p>
          
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <Button onClick={runEventTest} disabled={isRunning}>
              <Play className="h-4 w-4 mr-2" />
              {isRunning ? 'Running Tests...' : 'Test Event System'}
            </Button>
            <Button onClick={fetchAuditTrail} variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              Test Audit Trail
            </Button>
          </div>

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

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: 'var(--space-lg)' 
      }}>
        {eventSpecifications.map((spec, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                {spec.page}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {spec.events.map((event, eventIndex) => (
                <div key={eventIndex} className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium text-blue-700">{event.name}</h4>
                  <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                  <div className="text-xs text-gray-500">
                    <strong>Trigger:</strong> {event.trigger}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    <strong>Required Fields:</strong> {event.fields.join(', ')}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Audit & Idempotency Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {auditRequirements.map((req, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <h4 className="font-medium">{req.requirement}</h4>
                </div>
                <p className="text-sm text-gray-600">{req.description}</p>
                <div className="text-xs bg-gray-50 p-2 rounded">
                  <strong>Implementation:</strong> {req.implementation}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Flow Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-blue-50 p-4 rounded">
                <h4 className="font-medium text-blue-700 mb-2">Frontend Event Generation</h4>
                <ul className="space-y-1 text-blue-600">
                  <li>• Pre/post state snapshots created</li>
                  <li>• Correlation ID assigned per session</li>
                  <li>• Payload hash for idempotency</li>
                  <li>• SettingsEventAPI.method() called</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <h4 className="font-medium text-green-700 mb-2">Backend Event Processing</h4>
                <ul className="space-y-1 text-green-600">
                  <li>• Event validation per specification</li>
                  <li>• Duplicate detection via hash</li>
                  <li>• Storage in settings_events table</li>
                  <li>• Audit trail with state diffs</li>
                </ul>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <h4 className="font-medium text-purple-700 mb-2">Audit & Compliance</h4>
                <ul className="space-y-1 text-purple-600">
                  <li>• One event per confirmed action</li>
                  <li>• Replay-safe with idempotency</li>
                  <li>• Full who/what/when tracking</li>
                  <li>• Correlation for related events</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
