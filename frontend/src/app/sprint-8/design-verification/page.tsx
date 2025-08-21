'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DesignVerificationPage() {
  return (
    <div className="container space-y-6">
      <h1>Sprint 8 Design System Verification</h1>
      <p>This page verifies that Sprint 8 is using the same design tokens as Sprint 2.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Typography Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <h1>H1 Heading - Should use var(--font-xlarge)</h1>
            <h2>H2 Heading - Should use var(--font-large)</h2>
            <h3>H3 Heading - Should use var(--font-medium)</h3>
            <p>Body text - Should use var(--font-base) and var(--charcoal) color</p>
            <small>Small text - Should use var(--font-small)</small>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Color Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div style={{
              padding: 'var(--space-md)',
              backgroundColor: 'var(--pure-white)',
              border: '1px solid var(--light-gray)',
              borderRadius: '8px'
            }}>
              Background: var(--pure-white)
            </div>
            <div style={{
              padding: 'var(--space-md)',
              backgroundColor: 'var(--smoke)',
              color: 'var(--true-black)'
            }}>
              Background: var(--smoke)
            </div>
            <div style={{
              padding: 'var(--space-md)',
              backgroundColor: 'var(--true-black)',
              color: 'var(--pure-white)'
            }}>
              Background: var(--true-black)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spacing Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              <div style={{ padding: 'var(--space-xs)', backgroundColor: 'var(--smoke)' }}>
                space-xs padding
              </div>
              <div style={{ padding: 'var(--space-sm)', backgroundColor: 'var(--smoke)' }}>
                space-sm padding
              </div>
              <div style={{ padding: 'var(--space-md)', backgroundColor: 'var(--smoke)' }}>
                space-md padding
              </div>
              <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--smoke)' }}>
                space-lg padding
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Button Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button>Primary Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="ghost">Ghost Button</Button>
            </div>
            <p className="text-sm text-muted">
              Buttons should match Sprint 2 styling with proper hover states and transitions.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSS Variable Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <h4 className="font-medium">Colors</h4>
              <ul className="space-y-1 mt-2">
                <li>--pure-white</li>
                <li>--off-white</li>
                <li>--true-black</li>
                <li>--charcoal</li>
                <li>--smoke</li>
                <li>--muted</li>
                <li>--light-gray</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium">Typography</h4>
              <ul className="space-y-1 mt-2">
                <li>--font-micro</li>
                <li>--font-tiny</li>
                <li>--font-small</li>
                <li>--font-base</li>
                <li>--font-medium</li>
                <li>--font-large</li>
                <li>--font-xlarge</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium">Spacing</h4>
              <ul className="space-y-1 mt-2">
                <li>--space-xs (8px)</li>
                <li>--space-sm (16px)</li>
                <li>--space-md (24px)</li>
                <li>--space-lg (40px)</li>
                <li>--space-xl (64px)</li>
                <li>--space-2xl (96px)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium">Animation</h4>
              <ul className="space-y-1 mt-2">
                <li>--transition-fast</li>
                <li>--transition-base</li>
                <li>--ease-out-expo</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
