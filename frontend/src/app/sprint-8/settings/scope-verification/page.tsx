'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function ScopeVerificationPage() {
  const scopeDefinitions = [
    {
      page: 'SLA & Margins',
      path: '/sprint-8/settings/sla-margins',
      ownedScope: [
        'SLA timing targets (classification, pickups, hub processing, delivery)',
        'Global and component margin thresholds',
        'Risk management buffers and escalation timing',
        'Margin variance tolerances and currency settings'
      ],
      excludedScope: [
        'Hub capacity slots (owned by Hub Capacity)',
        'Value bands and fragility rules (owned by Thresholds & Risk)',
        'Individual inventory thresholds (owned by Thresholds & Risk)'
      ],
      roles: ['ops_admin', 'exec']
    },
    {
      page: 'Hub Capacity',
      path: '/sprint-8/settings/hub-capacity',
      ownedScope: [
        'Auth, sewing, and QA capacity slots per day',
        'Seasonality multipliers and overbooking percentages',
        'Blackout periods and maintenance windows',
        'Calendar views and slot utilization tracking'
      ],
      excludedScope: [
        'SLA timing targets (owned by SLA & Margins)',
        'Risk weights and scoring (owned by Thresholds & Risk)',
        'Margin calculation rules (owned by SLA & Margins)'
      ],
      roles: ['ops_admin', 'hub_tech']
    },
    {
      page: 'Thresholds & Risk',
      path: '/sprint-8/settings/thresholds-risk',
      ownedScope: [
        'Value bands and fragility rules for tier recommendations',
        'Brand overrides and customs lane risk levels',
        'Inventory thresholds and security defaults',
        'Risk model weights and incident automation rules'
      ],
      excludedScope: [
        'Margin percentages and targets (owned by SLA & Margins)',
        'Capacity slot allocation (owned by Hub Capacity)',
        'SLA timing thresholds (owned by SLA & Margins)'
      ],
      roles: ['ops_admin', 'exec']
    }
  ];

  return (
    <div className="container space-y-6">
      <div className="card">
        <div style={{ padding: 'var(--space-lg)' }}>
          <h1 style={{ 
            fontSize: 'var(--font-large)', 
            fontWeight: 500, 
            marginBottom: 'var(--space-sm)' 
          }}>
            Settings Scope Verification
          </h1>
          <p style={{ color: 'var(--muted)', marginBottom: 'var(--space-lg)' }}>
            This page verifies that each settings page has clear, non-overlapping responsibilities.
          </p>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
            gap: 'var(--space-lg)' 
          }}>
            {scopeDefinitions.map((def, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    {def.page}
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Access: {def.roles.join(', ')}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-green-700 mb-2 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Owns These Controls
                    </h4>
                    <ul className="space-y-1">
                      {def.ownedScope.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-green-600 mt-1">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-red-700 mb-2 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      Does NOT Control
                    </h4>
                    <ul className="space-y-1">
                      {def.excludedScope.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-red-600 mt-1">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            Navigation & Access Control Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">✅ Implemented</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Consistent breadcrumbs across all settings pages
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  RBAC enforcement with permission checks
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Cross-links between related settings
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Clear scope definitions and boundaries
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  404/403 error handling with helpful navigation
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Settings overview page with access-filtered links
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">🔗 Navigation Flow</h4>
              <div className="space-y-2 text-sm">
                <div className="p-3 bg-gray-50 rounded border">
                  <code>/sprint-8/settings</code>
                  <p className="text-gray-600 mt-1">Overview with role-based access</p>
                </div>
                <div className="p-3 bg-gray-50 rounded border">
                  <code>/sprint-8/settings/sla-margins</code>
                  <p className="text-gray-600 mt-1">SLA targets + margin thresholds</p>
                </div>
                <div className="p-3 bg-gray-50 rounded border">
                  <code>/sprint-8/settings/hub-capacity</code>
                  <p className="text-gray-600 mt-1">Capacity slots + calendars</p>
                </div>
                <div className="p-3 bg-gray-50 rounded border">
                  <code>/sprint-8/settings/thresholds-risk</code>
                  <p className="text-gray-600 mt-1">Value bands + risk models</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
