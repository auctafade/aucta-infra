'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, Settings } from 'lucide-react';

export default function SettingsNotFound() {
  return (
    <div className="container">
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-yellow-500" />
            </div>
            <CardTitle className="text-xl">Settings Page Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              The settings page you're looking for doesn't exist or has been moved.
            </p>
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link href="/sprint-8/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Go to Settings Overview
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/sprint-8">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
