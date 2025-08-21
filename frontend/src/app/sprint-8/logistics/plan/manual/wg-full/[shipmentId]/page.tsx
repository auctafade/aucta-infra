'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Truck, FileText, Download } from 'lucide-react';
import ManualRoutePlanner from '@/components/ManualRoutePlanner';
import { generatePDF } from '@/lib/routeSheetGenerator';

export default function FullWGPlannerPage() {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.shipmentId as string;
  
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(2);

  useEffect(() => {
    fetchShipmentDetails();
    // Get tier from session storage
    const storedTier = sessionStorage.getItem(`quote_${shipmentId}_tier`);
    if (storedTier) {
      setTier(parseInt(storedTier));
    }
  }, [shipmentId]);

  const fetchShipmentDetails = async () => {
    try {
      setLoading(true);
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${base}/api/shipments/${shipmentId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch shipment');
      }
      
      const data = await response.json();
      if (data.success && data.data?.shipment) {
        setShipment(data.data.shipment);
      }
    } catch (err) {
      console.error('Error fetching shipment:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuote = async (quote: any) => {
    try {
      // Generate PDF route sheet
      const pdfBlob = await generatePDF({
        shipmentId,
        shipment,
        serviceModel: 'Full White-Glove',
        tier,
        quote,
        generatedAt: new Date().toISOString()
      });

      // Save PDF to shipment (in real implementation, upload to server)
      const formData = new FormData();
      formData.append('file', pdfBlob, `route-sheet-${shipmentId}.pdf`);
      formData.append('type', 'route_sheet');
      
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      await fetch(`${base}/api/shipments/${shipmentId}/documents`, {
        method: 'POST',
        body: formData
      });

      // Store quote in session for review
      sessionStorage.setItem(`quote_${shipmentId}`, JSON.stringify({
        ...quote,
        serviceModel: 'wg-full',
        tier,
        createdAt: new Date().toISOString()
      }));

      // Redirect to summary
      router.push(`/sprint-8/logistics/plan/summary/${shipmentId}`);
    } catch (err) {
      console.error('Error saving quote:', err);
      alert('Failed to save quote. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shipment details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link
                href={`/sprint-8/logistics/plan/mode/${shipmentId}`}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Full White-Glove Quote</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Step 3: Enter transport prices and calculate total
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">
                End-to-end WG Service
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {shipment && (
          <ManualRoutePlanner
            shipmentId={shipmentId}
            shipmentData={shipment}
            serviceModel="wg-full"
            tier={tier}
            onSave={handleSaveQuote}
          />
        )}
      </div>
    </div>
  );
}
