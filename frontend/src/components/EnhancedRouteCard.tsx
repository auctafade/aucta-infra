'use client';

import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, Clock, DollarSign, Plane, Train,
  Car, MapPin, User, Coffee, Bed, ArrowRight, CheckCircle,
  AlertTriangle, Building2, Package, Timer, Calendar
} from 'lucide-react';

interface TransportSegment {
  type: string;
  from: string;
  to: string;
  startTime: string;
  endTime: string;
  method: string;
  cost: number;
  details: any;
}

interface RouteOption {
  id: string;
  label: string;
  description: string;
  grade: 'A' | 'B' | 'C';
  totalCost: number;
  clientPrice: number;
  estimatedDays: number;
  deliveryDate: string;
  operatorDetails: {
    totalHours: number;
    overtime: number;
    returnJourney: boolean;
  };
  segments: TransportSegment[];
  costBreakdown: {
    labor: {
      regular: number;
      overtime: number;
      perDiem: number;
      total: number;
    };
    transport: {
      flights: Array<{
        airline: string;
        flightNumber: string;
        route: string;
        departureTime: string;
        arrivalTime: string;
        cost: number;
        class: string;
      }>;
      trains: Array<{
        provider: string;
        trainNumber: string;
        route: string;
        departureTime: string;
        arrivalTime: string;
        cost: number;
        class: string;
      }>;
      groundTransport: Array<{
        type: string;
        from: string;
        to: string;
        duration: number;
        cost: number;
        method: string;
      }>;
    };
    hubFees: number;
    inventory: number;
    insurance: number;
    returnJourney: number;
    accommodation?: number;
    meals?: number;
  };
  timeline: Array<{
    step: number;
    time: string;
    location: string;
    action: string;
    duration: string;
    responsible: string;
    checkpoints: string[];
  }>;
  guardrails: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
  }>;
}

interface EnhancedRouteCardProps {
  route: RouteOption;
  isExpanded: boolean;
  onExpand: () => void;
  onSelect: () => void;
  isSelecting: boolean;
}

const EnhancedRouteCard: React.FC<EnhancedRouteCardProps> = ({
  route,
  isExpanded,
  onExpand,
  onSelect,
  isSelecting
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'transport' | 'costs'>('overview');

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-800 border-green-200';
      case 'B': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'C': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (timeString: string) => {
    return new Date(timeString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTotalTransportCost = () => {
    const transport = route.costBreakdown?.transport;
    if (!transport) return 0;
    
    return (transport.flights || []).reduce((sum, f) => sum + (f.cost || 0), 0) +
           (transport.trains || []).reduce((sum, t) => sum + (t.cost || 0), 0) +
           (transport.groundTransport || []).reduce((sum, g) => sum + (g.cost || 0), 0);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-gray-900">{route.label}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold border ${getGradeColor(route.grade)}`}>
                Note {route.grade}
              </span>
              {route.operatorDetails?.returnJourney && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <ArrowRight className="w-3 h-3 mr-1" />
                  Retour inclus
                </span>
              )}
            </div>
            <p className="text-gray-600 text-sm mb-3">{route.description}</p>
            
            {/* Métriques principales */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center text-gray-500 mb-1">
                  <Calendar className="w-4 h-4 mr-1" />
                  <span className="text-xs font-medium">Livraison</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{route.estimatedDays}j</p>
                <p className="text-xs text-gray-500">{formatDateTime(route.deliveryDate)}</p>
              </div>
              
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center text-gray-500 mb-1">
                  <DollarSign className="w-4 h-4 mr-1" />
                  <span className="text-xs font-medium">Prix client</span>
                </div>
                <p className="text-lg font-bold text-green-600">{formatCurrency(route.clientPrice)}</p>
                <p className="text-xs text-gray-500">Coût: {formatCurrency(route.totalCost)}</p>
              </div>
              
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center text-gray-500 mb-1">
                  <User className="w-4 h-4 mr-1" />
                  <span className="text-xs font-medium">Opérateur WG</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{route.operatorDetails?.totalHours || 0}h</p>
                <p className="text-xs text-gray-500">
                  {(route.operatorDetails?.overtime || 0) > 0 ? `+${route.operatorDetails?.overtime || 0}h sup` : 'Normal'}
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center text-gray-500 mb-1">
                  <Package className="w-4 h-4 mr-1" />
                  <span className="text-xs font-medium">Transport</span>
                </div>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(getTotalTransportCost())}</p>
                <p className="text-xs text-gray-500">
                  {route.costBreakdown?.transport?.flights?.length || 0} vols, {route.costBreakdown?.transport?.trains?.length || 0} trains
                </p>
              </div>
            </div>
          </div>
          
          <button
            onClick={onExpand}
            className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Guardrails */}
        {route.guardrails && route.guardrails.length > 0 && (
          <div className="mb-4">
            {route.guardrails.map((guardrail, idx) => (
              <div 
                key={idx}
                className={`flex items-start p-3 rounded-lg ${
                  guardrail.type === 'error' ? 'bg-red-50 border border-red-200' :
                  guardrail.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-blue-50 border border-blue-200'
                }`}
              >
                <AlertTriangle className={`w-4 h-4 mt-0.5 mr-2 ${
                  guardrail.type === 'error' ? 'text-red-500' :
                  guardrail.type === 'warning' ? 'text-yellow-500' :
                  'text-blue-500'
                }`} />
                <p className={`text-sm ${
                  guardrail.type === 'error' ? 'text-red-700' :
                  guardrail.type === 'warning' ? 'text-yellow-700' :
                  'text-blue-700'
                }`}>
                  {guardrail.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Bouton de sélection */}
        <button
          onClick={onSelect}
          disabled={isSelecting}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSelecting ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Planification en cours...
            </span>
          ) : (
            'Planifier cette route'
          )}
        </button>
      </div>

      {/* Détails expandus */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Onglets */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            {[
              { id: 'overview', label: 'Vue d\'ensemble', icon: Building2 },
              { id: 'timeline', label: 'Timeline détaillée', icon: Clock },
              { id: 'transport', label: 'Transport', icon: Plane },
              { id: 'costs', label: 'Coûts détaillés', icon: DollarSign }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center py-3 px-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Onglet Vue d'ensemble */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold mb-3">Segments de route</h4>
                  <div className="space-y-3">
                    {/* Affichage des legs existantes du backend */}
                    {(route.legs || []).map((leg, idx) => (
                      <div key={idx} className="flex items-center bg-gray-50 rounded-lg p-4">
                        <div className="flex-1">
                          <div className="flex items-center text-sm font-medium">
                            {leg.type === 'white-glove' && <User className="w-4 h-4 mr-2 text-blue-500" />}
                            {leg.type === 'dhl' && <Package className="w-4 h-4 mr-2 text-orange-500" />}
                            {leg.carrier === 'white-glove' && <User className="w-4 h-4 mr-2 text-blue-500" />}
                            <span>{leg.from?.city || leg.from?.address || 'Départ'}</span>
                            <ArrowRight className="w-4 h-4 mx-2 text-gray-400" />
                            <span>{leg.to?.city || leg.to?.address || 'Destination'}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {leg.carrier} • {leg.service || 'Service standard'}
                            {leg.processing && ` • ${leg.processing}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{formatCurrency(0)}</div>
                          <div className="text-xs text-gray-500">
                            Étape {leg.order || idx + 1}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Fallback si pas de legs */}
                    {(!route.legs || route.legs.length === 0) && (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>Segments de route en cours de calcul...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Onglet Timeline */}
            {activeTab === 'timeline' && (
              <div>
                <h4 className="text-lg font-semibold mb-4">Timeline opérationnelle détaillée</h4>
                <div className="space-y-4">
                  {(route.timeline || []).map((step, idx) => (
                    <div key={idx} className="flex">
                      <div className="flex flex-col items-center mr-4">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {step.step}
                        </div>
                        {idx < (route.timeline || []).length - 1 && (
                          <div className="w-0.5 h-16 bg-gray-300 mt-2"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-8">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h5 className="font-semibold text-gray-900">{step.action}</h5>
                              <p className="text-sm text-gray-600">{step.location}</p>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-medium">{step.time}</div>
                              <div className="text-gray-500">{step.duration}</div>
                            </div>
                          </div>
                          <div className="text-xs text-blue-600 mb-2">
                            Responsable: {step.responsible}
                          </div>
                          {step.checkpoints && step.checkpoints.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-700">Points de contrôle:</p>
                              {step.checkpoints.map((checkpoint, checkIdx) => (
                                <div key={checkIdx} className="flex items-center text-xs text-gray-600">
                                  <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                                  {checkpoint}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Onglet Transport */}
            {activeTab === 'transport' && (
              <div className="space-y-6">
                {/* Vols */}
                {route.costBreakdown?.transport?.flights && route.costBreakdown.transport.flights.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 flex items-center">
                      <Plane className="w-5 h-5 mr-2 text-blue-500" />
                      Vols ({route.costBreakdown.transport.flights.length})
                    </h4>
                    <div className="space-y-3">
                      {route.costBreakdown.transport.flights.map((flight, idx) => (
                        <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="text-sm font-bold text-blue-900">
                                {flight.airline} {flight.flightNumber}
                              </div>
                              <div className="ml-3 px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs">
                                {flight.class}
                              </div>
                            </div>
                            <div className="text-lg font-bold text-blue-900">
                              {formatCurrency(flight.cost)}
                            </div>
                          </div>
                          <div className="flex items-center text-sm text-blue-700">
                            <span>{flight.route}</span>
                            <ArrowRight className="w-4 h-4 mx-2" />
                            <span>{formatTime(flight.departureTime)} - {formatTime(flight.arrivalTime)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trains */}
                {route.costBreakdown?.transport?.trains && route.costBreakdown.transport.trains.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 flex items-center">
                      <Train className="w-5 h-5 mr-2 text-green-500" />
                      Trains ({route.costBreakdown.transport.trains.length})
                    </h4>
                    <div className="space-y-3">
                      {route.costBreakdown.transport.trains.map((train, idx) => (
                        <div key={idx} className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="text-sm font-bold text-green-900">
                                {train.provider} {train.trainNumber}
                              </div>
                              <div className="ml-3 px-2 py-1 bg-green-200 text-green-800 rounded text-xs">
                                {train.class}
                              </div>
                            </div>
                            <div className="text-lg font-bold text-green-900">
                              {formatCurrency(train.cost)}
                            </div>
                          </div>
                          <div className="flex items-center text-sm text-green-700">
                            <span>{train.route}</span>
                            <ArrowRight className="w-4 h-4 mx-2" />
                            <span>{formatTime(train.departureTime)} - {formatTime(train.arrivalTime)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transport terrestre */}
                {route.costBreakdown?.transport?.groundTransport && route.costBreakdown.transport.groundTransport.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 flex items-center">
                      <Car className="w-5 h-5 mr-2 text-gray-500" />
                      Transport terrestre ({route.costBreakdown.transport.groundTransport.length})
                    </h4>
                    <div className="space-y-3">
                      {route.costBreakdown.transport.groundTransport.map((transport, idx) => (
                        <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-bold text-gray-900">
                              {transport.method}
                            </div>
                            <div className="text-lg font-bold text-gray-900">
                              {formatCurrency(transport.cost)}
                            </div>
                          </div>
                          <div className="flex items-center text-sm text-gray-700">
                            <MapPin className="w-4 h-4 mr-1" />
                            <span>{transport.from}</span>
                            <ArrowRight className="w-4 h-4 mx-2" />
                            <span>{transport.to}</span>
                            <span className="ml-3 text-gray-500">({transport.duration}min)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Onglet Coûts détaillés */}
            {activeTab === 'costs' && (
              <div className="space-y-6">
                {/* Main d'œuvre */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Main d'œuvre opérateur WG
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-blue-700 mb-1">Heures normales</div>
                      <div className="text-lg font-bold text-blue-900">
                        {formatCurrency(route.costBreakdown?.labor?.regular || 0)}
                      </div>
                      <div className="text-xs text-blue-600">
                        {Math.min(route.operatorDetails?.totalHours || 0, 8)}h × €65/h
                      </div>
                    </div>
                    {(route.costBreakdown?.labor?.overtime || 0) > 0 && (
                      <div>
                        <div className="text-sm text-blue-700 mb-1">Heures supplémentaires</div>
                        <div className="text-lg font-bold text-blue-900">
                          {formatCurrency(route.costBreakdown?.labor?.overtime || 0)}
                        </div>
                        <div className="text-xs text-blue-600">
                          {route.operatorDetails?.overtime || 0}h × €97.50/h
                        </div>
                      </div>
                    )}
                    {(route.costBreakdown?.labor?.perDiem || 0) > 0 && (
                      <div>
                        <div className="text-sm text-blue-700 mb-1">Per diem</div>
                        <div className="text-lg font-bold text-blue-900">
                          {formatCurrency(route.costBreakdown?.labor?.perDiem || 0)}
                        </div>
                        <div className="text-xs text-blue-600">Voyage longue durée</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transport */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-green-900 mb-3">Transport total</h4>
                  <div className="text-2xl font-bold text-green-900 mb-2">
                    {formatCurrency(getTotalTransportCost())}
                  </div>
                  <div className="text-sm text-green-700">
                    Inclut tous les vols, trains et transports terrestres
                  </div>
                </div>

                {/* Voyage de retour */}
                {(route.costBreakdown?.returnJourney || 0) > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-orange-900 mb-3 flex items-center">
                      <ArrowRight className="w-5 h-5 mr-2" />
                      Voyage de retour opérateur
                    </h4>
                    <div className="text-xl font-bold text-orange-900 mb-2">
                      {formatCurrency(route.costBreakdown?.returnJourney || 0)}
                    </div>
                    <div className="text-sm text-orange-700">
                      Transport pour ramener l'opérateur à son hub
                    </div>
                  </div>
                )}

                {/* Hébergement et repas */}
                {(route.costBreakdown?.accommodation || route.costBreakdown?.meals) && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-purple-900 mb-3 flex items-center">
                      <Bed className="w-5 h-5 mr-2" />
                      Hébergement & restauration
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {route.costBreakdown?.accommodation && (
                        <div>
                          <div className="text-sm text-purple-700 mb-1">Hébergement</div>
                          <div className="text-lg font-bold text-purple-900">
                            {formatCurrency(route.costBreakdown.accommodation)}
                          </div>
                        </div>
                      )}
                      {route.costBreakdown?.meals && (
                        <div>
                          <div className="text-sm text-purple-700 mb-1">Repas</div>
                          <div className="text-lg font-bold text-purple-900">
                            {formatCurrency(route.costBreakdown.meals)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Autres frais */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600 mb-1">Frais Hub</div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatCurrency(route.costBreakdown?.hubFees || 0)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600 mb-1">Inventaire</div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatCurrency(route.costBreakdown?.inventory || 0)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600 mb-1">Assurance</div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatCurrency(route.costBreakdown?.insurance || 0)}
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm opacity-90 mb-1">Prix client final</div>
                      <div className="text-3xl font-bold">
                        {formatCurrency(route.clientPrice)}
                      </div>
                      <div className="text-sm opacity-90 mt-1">
                        Coût opérationnel: {formatCurrency(route.totalCost)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm opacity-90 mb-1">Marge</div>
                      <div className="text-xl font-bold">
                        {formatCurrency(route.clientPrice - route.totalCost)}
                      </div>
                      <div className="text-sm opacity-90">
                        {Math.round(((route.clientPrice - route.totalCost) / route.clientPrice) * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedRouteCard;
