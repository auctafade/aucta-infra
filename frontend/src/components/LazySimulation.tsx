// Lazy-loaded Simulation Component with Performance Optimizations
'use client';

import React, { memo, useCallback, useState, useEffect } from 'react';
import { LazyWrapper, usePerformanceMonitor, PERFORMANCE_BUDGETS, measurePerformance, useMemoizedCalculation } from '@/lib/performanceOptimizations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, BarChart3, TrendingUp, AlertTriangle } from 'lucide-react';

interface SimulationProps {
  policyData: any;
  onSimulationComplete?: (results: SimulationResults) => void;
  isVisible?: boolean;
}

interface SimulationResults {
  id: string;
  status: 'running' | 'completed' | 'error';
  progress: number;
  results?: {
    routesFlipped: number;
    marginImpact: number;
    riskScoreChanges: Array<{
      shipmentId: string;
      oldScore: number;
      newScore: number;
      impact: 'positive' | 'negative' | 'neutral';
    }>;
    recommendations: string[];
    performanceMetrics: {
      simulationTimeMs: number;
      sampledShipments: number;
      processingRate: number;
    };
  };
  error?: string;
}

// Memoized results chart component
const SimulationChart = memo<{
  results: SimulationResults['results'];
}>(({ results }) => {
  const chartData = useMemoizedCalculation(() => {
    if (!results?.riskScoreChanges) return [];
    
    const data = results.riskScoreChanges.map(change => ({
      x: change.oldScore,
      y: change.newScore,
      impact: change.impact,
      shipmentId: change.shipmentId
    }));
    
    return data;
  }, [results?.riskScoreChanges]);

  if (!results) return null;

  return (
    <div style={{
      width: '100%',
      height: '300px',
      backgroundColor: 'var(--smoke)',
      borderRadius: '6px',
      padding: 'var(--space-md)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)'
    }}>
      <h4 style={{ fontSize: 'var(--font-medium)', fontWeight: 500 }}>
        Risk Score Impact Analysis
      </h4>
      
      {/* Simple visualization */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-md)',
        marginTop: 'var(--space-md)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-large)', fontWeight: 'bold', color: '#10b981' }}>
            {chartData.filter(d => d.impact === 'positive').length}
          </div>
          <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
            Improved Scores
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-large)', fontWeight: 'bold', color: '#6b7280' }}>
            {chartData.filter(d => d.impact === 'neutral').length}
          </div>
          <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
            Unchanged
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-large)', fontWeight: 'bold', color: '#ef4444' }}>
            {chartData.filter(d => d.impact === 'negative').length}
          </div>
          <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
            Worsened Scores
          </div>
        </div>
      </div>
      
      {/* Performance metrics */}
      <div style={{
        marginTop: 'var(--space-md)',
        padding: 'var(--space-sm)',
        backgroundColor: 'var(--pure-white)',
        borderRadius: '4px',
        border: '1px solid var(--light-gray)'
      }}>
        <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
          Simulation completed in {results.performanceMetrics.simulationTimeMs}ms • 
          Processed {results.performanceMetrics.sampledShipments} shipments • 
          Rate: {results.performanceMetrics.processingRate.toFixed(0)} shipments/sec
        </div>
      </div>
    </div>
  );
});

SimulationChart.displayName = 'SimulationChart';

// Main simulation component
const SimulationComponent: React.FC<SimulationProps> = ({
  policyData,
  onSimulationComplete,
  isVisible = true
}) => {
  const [simulation, setSimulation] = useState<SimulationResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const performanceMonitor = usePerformanceMonitor('Simulation');

  const runSimulation = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    const simulationId = `sim-${Date.now()}`;
    
    setSimulation({
      id: simulationId,
      status: 'running',
      progress: 0
    });

    try {
      await measurePerformance(async () => {
        performanceMonitor.start();
        
        // Simulate progressive updates
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 50)); // Simulate processing
          setSimulation(prev => prev ? { ...prev, progress } : null);
        }

        // Mock simulation results
        const mockResults = {
          routesFlipped: Math.floor(Math.random() * 50) + 10,
          marginImpact: (Math.random() * 10 - 5), // -5% to +5%
          riskScoreChanges: Array.from({ length: 100 }, (_, i) => {
            const oldScore = Math.random() * 100;
            const newScore = oldScore + (Math.random() * 20 - 10);
            return {
              shipmentId: `ship-${i + 1}`,
              oldScore: Math.round(oldScore),
              newScore: Math.round(Math.max(0, Math.min(100, newScore))),
              impact: newScore > oldScore ? 'positive' : newScore < oldScore ? 'negative' : 'neutral'
            };
          }) as any,
          recommendations: [
            'Consider gradual rollout for high-value shipments',
            'Monitor tier gate performance for first 48 hours',
            'Review impact on hub capacity utilization'
          ],
          performanceMetrics: {
            simulationTimeMs: performanceMonitor.end(),
            sampledShipments: 1000,
            processingRate: 1000 / (performanceMonitor.end() / 1000)
          }
        };

        setSimulation({
          id: simulationId,
          status: 'completed',
          progress: 100,
          results: mockResults
        });

        onSimulationComplete?.(simulation as SimulationResults);
        
      }, PERFORMANCE_BUDGETS.SIMULATION_LOAD, 'Policy Simulation');

    } catch (error) {
      setSimulation({
        id: simulationId,
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Simulation failed'
      });
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, policyData, onSimulationComplete]);

  if (!isVisible) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Simulation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Policy Impact Simulation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <Button 
              onClick={runSimulation} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {isRunning ? 'Running Simulation...' : 'Run Impact Analysis'}
            </Button>
            
            {simulation && simulation.status === 'running' && (
              <div style={{ flex: 1, maxWidth: '300px' }}>
                <div style={{ 
                  fontSize: 'var(--font-small)', 
                  marginBottom: 'var(--space-xs)',
                  color: 'var(--muted)'
                }}>
                  Progress: {simulation.progress}%
                </div>
                <Progress value={simulation.progress} className="w-full" />
              </div>
            )}
          </div>
          
          <div style={{ 
            marginTop: 'var(--space-md)', 
            padding: 'var(--space-sm)',
            backgroundColor: 'var(--smoke)',
            borderRadius: '4px',
            fontSize: 'var(--font-small)',
            color: 'var(--muted)'
          }}>
            Simulation will analyze impact on {Math.floor(Math.random() * 500 + 500)} active shipments 
            and predict tier gate changes, margin effects, and risk score distributions.
          </div>
        </CardContent>
      </Card>

      {/* Simulation Results */}
      {simulation && simulation.status === 'completed' && simulation.results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Simulation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Key Metrics */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-md)',
              marginBottom: 'var(--space-lg)'
            }}>
              <div style={{
                padding: 'var(--space-md)',
                backgroundColor: 'var(--smoke)',
                borderRadius: '6px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 'var(--font-large)', fontWeight: 'bold', color: 'var(--true-black)' }}>
                  {simulation.results.routesFlipped}
                </div>
                <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                  Routes Affected
                </div>
              </div>
              
              <div style={{
                padding: 'var(--space-md)',
                backgroundColor: 'var(--smoke)',
                borderRadius: '6px',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: 'var(--font-large)', 
                  fontWeight: 'bold', 
                  color: simulation.results.marginImpact >= 0 ? '#10b981' : '#ef4444'
                }}>
                  {simulation.results.marginImpact >= 0 ? '+' : ''}{simulation.results.marginImpact.toFixed(1)}%
                </div>
                <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                  Margin Impact
                </div>
              </div>
              
              <div style={{
                padding: 'var(--space-md)',
                backgroundColor: 'var(--smoke)',
                borderRadius: '6px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 'var(--font-large)', fontWeight: 'bold', color: 'var(--true-black)' }}>
                  {simulation.results.riskScoreChanges.length}
                </div>
                <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                  Shipments Analyzed
                </div>
              </div>
            </div>

            {/* Chart */}
            <SimulationChart results={simulation.results} />

            {/* Recommendations */}
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <h4 style={{ 
                fontSize: 'var(--font-medium)', 
                fontWeight: 500, 
                marginBottom: 'var(--space-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-xs)'
              }}>
                <AlertTriangle className="h-4 w-4" />
                Recommendations
              </h4>
              <ul style={{ 
                listStyle: 'none',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-xs)'
              }}>
                {simulation.results.recommendations.map((rec, index) => (
                  <li key={index} style={{
                    padding: 'var(--space-sm)',
                    backgroundColor: 'var(--smoke)',
                    borderRadius: '4px',
                    fontSize: 'var(--font-small)',
                    border: '1px solid var(--light-gray)',
                    position: 'relative',
                    paddingLeft: 'var(--space-lg)'
                  }}>
                    <span style={{
                      position: 'absolute',
                      left: 'var(--space-sm)',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '4px',
                      height: '4px',
                      backgroundColor: 'var(--accent)',
                      borderRadius: '50%'
                    }} />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {simulation && simulation.status === 'error' && (
        <Card>
          <CardContent className="text-center py-8">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Simulation Failed</h3>
            <p className="text-gray-600 mb-4">{simulation.error}</p>
            <Button onClick={runSimulation} variant="outline">
              Retry Simulation
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Lazy-loaded wrapper
const LazySimulation: React.FC<SimulationProps> = (props) => {
  return (
    <LazyWrapper
      fallback={
        <Card>
          <CardContent className="text-center py-8">
            <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-4" />
            <div className="text-lg font-medium mb-2">Loading Simulation Engine...</div>
            <div className="text-gray-600">Preparing impact analysis tools</div>
          </CardContent>
        </Card>
      }
      threshold={0.1}
    >
      <SimulationComponent {...props} />
    </LazyWrapper>
  );
};

export default LazySimulation;
