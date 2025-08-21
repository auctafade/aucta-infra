'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Download, FileText, CheckCircle, 
  MapPin, Euro, Clock, Shield, Send, Edit2
} from 'lucide-react';
import { generatePDF } from '@/lib/routeSheetGenerator';

export default function QuoteSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.shipmentId as string;
  
  const [shipment, setShipment] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Load quote from session
    const storedQuote = sessionStorage.getItem(`quote_${shipmentId}`);
    if (storedQuote) {
      setQuote(JSON.parse(storedQuote));
    } else {
      // Redirect back if no quote found
      router.push('/sprint-8/logistics/plan/start');
    }

    fetchShipmentDetails();
  }, [shipmentId]);

  const fetchShipmentDetails = async () => {
    try {
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
    }
  };

  const handleDownloadPDF = async () => {
    if (!quote || !shipment) return;
    
    setDownloading(true);
    try {
      const pdfBlob = await generatePDF({
        shipmentId,
        shipment,
        serviceModel: quote.serviceModel,
        tier: quote.tier,
        quote,
        hybridVariant: quote.hybridVariant,
        generatedAt: quote.createdAt || new Date().toISOString()
      });

      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `route-sheet-${shipmentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleSendQuote = async () => {
    setSending(true);
    try {
      // In real implementation, this would send the quote to the client
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clear the quote from session
      sessionStorage.removeItem(`quote_${shipmentId}`);
      
      // Show success and redirect
      alert('Quote sent successfully!');
      router.push('/sprint-8/logistics/dashboard');
    } catch (err) {
      console.error('Error sending quote:', err);
      alert('Failed to send quote');
    } finally {
      setSending(false);
    }
  };

  const getServiceModelName = () => {
    if (!quote) return '';
    
    if (quote.serviceModel === 'wg-full') return 'Full White-Glove';
    if (quote.serviceModel === 'dhl-full') return 'Full DHL';
    if (quote.serviceModel === 'hybrid') {
      return quote.hybridVariant === 'wg_to_dhl' 
        ? 'Hybrid: WG → DHL' 
        : 'Hybrid: DHL → WG';
    }
    return '';
  };

  const getTotalDuration = () => {
    if (!quote?.segments) return 0;
    return quote.segments.reduce((total: number, seg: any) => total + (seg.duration || 0), 0);
  };

  if (!quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quote...</p>
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
                href="/sprint-8/logistics/plan/start"
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Quote Summary</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Review and send quote for {shipmentId}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
            <div>
              <p className="font-semibold text-green-900">Quote Generated Successfully</p>
              <p className="text-sm text-green-700 mt-1">
                Your route sheet is ready. Download the PDF or send it directly.
              </p>
            </div>
          </div>
        </div>

        {/* Quote Overview */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quote Details</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Service Model</p>
              <p className="font-semibold text-gray-900">{getServiceModelName()}</p>
              <p className="text-sm text-gray-600">Tier {quote.tier}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 mb-1">Route</p>
              <p className="font-semibold text-gray-900">
                {shipment?.sender_city} → {shipment?.buyer_city}
              </p>
              <p className="text-sm text-gray-600">
                Est. {Math.ceil(getTotalDuration() / 24)} days
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Cost</p>
              <p className="font-semibold text-gray-900">
                €{quote.totalCost?.toFixed(2) || '0.00'}
              </p>
              <p className="text-sm text-gray-600">
                +{quote.margin || 0}% margin
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 mb-1">Client Price</p>
              <p className="font-semibold text-2xl text-blue-600">
                €{quote.clientPrice?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>

        {/* Route Segments */}
        {quote.segments && quote.segments.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Route Segments</h3>
            <div className="space-y-3">
              {quote.segments.map((segment: any, index: number) => (
                <div key={segment.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">
                        {segment.from} → {segment.to}
                      </p>
                      <p className="text-gray-600">
                        {segment.carrier || segment.type} • {segment.duration}h
                      </p>
                    </div>
                  </div>
                  <span className="font-medium text-gray-900">
                    €{segment.price?.toFixed(2) || '0.00'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cost Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown</h3>
          <div className="space-y-2 text-sm">
            {quote.transportTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Transport</span>
                <span className="font-medium">€{quote.transportTotal.toFixed(2)}</span>
              </div>
            )}
            
            {quote.laborCosts?.totalLaborCost > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">WG Labor</span>
                <span className="font-medium">€{quote.laborCosts.totalLaborCost.toFixed(2)}</span>
              </div>
            )}
            
            {quote.dhlTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">DHL Services</span>
                <span className="font-medium">€{quote.dhlTotal.toFixed(2)}</span>
              </div>
            )}
            
            {(quote.hubTotal > 0 || (quote.hubFees && Object.values(quote.hubFees).some((v: any) => v > 0))) && (
              <div className="flex justify-between">
                <span className="text-gray-600">Hub Processing</span>
                <span className="font-medium">
                  €{(quote.hubTotal || Object.values(quote.hubFees || {}).reduce((sum: number, val: any) => sum + val, 0)).toFixed(2)}
                </span>
              </div>
            )}
            
            {quote.insurance > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Insurance</span>
                <span className="font-medium">€{quote.insurance.toFixed(2)}</span>
              </div>
            )}
            
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-semibold">
                <span>Total Cost</span>
                <span>€{quote.totalCost?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between text-green-600 mt-1">
                <span>Margin {quote.marginType === 'percentage' ? `(${quote.margin || 0}%)` : ''}</span>
                <span>+€{((quote.marginType === 'percentage' ? quote.totalCost * (quote.margin / 100) : quote.margin) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg mt-2 text-blue-600">
                <span>Client Price</span>
                <span>€{quote.clientPrice?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <Link
            href={`/sprint-8/logistics/plan/mode/${shipmentId}`}
            className="inline-flex items-center px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit Quote
          </Link>

          <div className="flex space-x-4">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              {downloading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5 mr-2" />
                  Download PDF
                </>
              )}
            </button>

            <button
              onClick={handleSendQuote}
              disabled={sending}
              className={`inline-flex items-center px-6 py-3 font-medium rounded-lg transition-colors ${
                sending
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {sending ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Send Quote
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quote Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start">
            <FileText className="h-5 w-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-gray-600">
              <p className="font-semibold mb-1">Quote Information</p>
              <p>
                Generated on {new Date(quote.createdAt).toLocaleString()}. 
                This quote is valid for 7 days. The PDF contains all route details 
                and can be shared with the operations team for execution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
