// frontend/src/components/WGPerformanceTimer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Timer, Zap, Target, TrendingUp } from 'lucide-react';

interface PerformanceMetrics {
  operatorSelectionTime: number;
  scheduleValidationTime: number;
  constraintCheckTime: number;
  totalTimeElapsed: number;
  stage: 'operator_selection' | 'scheduling' | 'validation' | 'confirmation' | 'completed';
  targetTime: number; // 120 seconds
}

interface WGPerformanceTimerProps {
  onStageChange?: (stage: string) => void;
  onTargetExceeded?: () => void;
}

const WGPerformanceTimer: React.FC<WGPerformanceTimerProps> = ({
  onStageChange,
  onTargetExceeded
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    operatorSelectionTime: 0,
    scheduleValidationTime: 0,
    constraintCheckTime: 0,
    totalTimeElapsed: 0,
    stage: 'operator_selection',
    targetTime: 120 // 2 minutes
  });

  const [startTime] = useState(Date.now());
  const [stageStartTime, setStageStartTime] = useState(Date.now());
  const [isRunning, setIsRunning] = useState(true);
  const [hasExceededTarget, setHasExceededTarget] = useState(false);

  // Update timer every second
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const totalElapsed = Math.floor((now - startTime) / 1000);
      
      setMetrics(prev => ({ ...prev, totalTimeElapsed: totalElapsed }));

      // Check if target time exceeded
      if (totalElapsed > metrics.targetTime && !hasExceededTarget) {
        setHasExceededTarget(true);
        if (onTargetExceeded) {
          onTargetExceeded();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, startTime, metrics.targetTime, hasExceededTarget, onTargetExceeded]);

  // Advance to next stage
  const advanceStage = (nextStage: PerformanceMetrics['stage']) => {
    const now = Date.now();
    const stageTime = Math.floor((now - stageStartTime) / 1000);

    setMetrics(prev => {
      const updated = { ...prev };
      
      // Record time for current stage
      switch (prev.stage) {
        case 'operator_selection':
          updated.operatorSelectionTime = stageTime;
          break;
        case 'scheduling':
          updated.scheduleValidationTime = stageTime;
          break;
        case 'validation':
          updated.constraintCheckTime = stageTime;
          break;
      }

      updated.stage = nextStage;
      return updated;
    });

    setStageStartTime(now);
    
    if (onStageChange) {
      onStageChange(nextStage);
    }

    if (nextStage === 'completed') {
      setIsRunning(false);
    }
  };

  const getStageProgress = () => {
    const stages = ['operator_selection', 'scheduling', 'validation', 'confirmation', 'completed'];
    const currentIndex = stages.indexOf(metrics.stage);
    return ((currentIndex + 1) / stages.length) * 100;
  };

  const getPerformanceStatus = () => {
    const { totalTimeElapsed, targetTime } = metrics;
    const percentOfTarget = (totalTimeElapsed / targetTime) * 100;
    
    if (percentOfTarget <= 50) return { status: 'excellent', color: '#22c55e', message: 'Excellent pace' };
    if (percentOfTarget <= 75) return { status: 'good', color: '#3b82f6', message: 'Good pace' };
    if (percentOfTarget <= 100) return { status: 'warning', color: '#f59e0b', message: 'Approaching target' };
    return { status: 'exceeded', color: '#dc2626', message: 'Target exceeded' };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const performance = getPerformanceStatus();

  // Expose stage advancement globally for integration
  React.useEffect(() => {
    (window as any).advanceWGStage = advanceStage;
    return () => {
      delete (window as any).advanceWGStage;
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e0e0e0',
      padding: '16px',
      minWidth: '260px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      zIndex: 1000
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Timer size={16} color={performance.color} />
        <h3 style={{ fontSize: '14px', fontWeight: 600 }}>
          Assignment Timer
        </h3>
        <div style={{
          background: performance.color,
          color: '#fff',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 600,
          marginLeft: 'auto'
        }}>
          {performance.status.toUpperCase()}
        </div>
      </div>

      {/* Main Timer Display */}
      <div style={{
        textAlign: 'center',
        marginBottom: '16px',
        padding: '12px',
        background: performance.status === 'exceeded' ? '#fef2f2' : '#f8fafc',
        borderRadius: '8px',
        border: `1px solid ${performance.status === 'exceeded' ? '#fecaca' : '#e2e8f0'}`
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 700,
          color: performance.color,
          marginBottom: '4px'
        }}>
          {formatTime(metrics.totalTimeElapsed)}
        </div>
        <div style={{
          fontSize: '11px',
          color: '#666',
          fontWeight: 500
        }}>
          Target: {formatTime(metrics.targetTime)} • {performance.message}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        background: '#f0f0f0',
        borderRadius: '4px',
        height: '6px',
        marginBottom: '12px',
        overflow: 'hidden'
      }}>
        <div style={{
          background: performance.color,
          height: '100%',
          width: `${getStageProgress()}%`,
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Current Stage */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        padding: '8px',
        background: '#f8fafc',
        borderRadius: '6px'
      }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' }}>
            {metrics.stage.replace('_', ' ')}
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>
            Current stage
          </div>
        </div>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: performance.color,
          animation: isRunning ? 'pulse 2s infinite' : 'none'
        }} />
      </div>

      {/* Stage Breakdown */}
      <div style={{ fontSize: '11px', color: '#666' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Operator Selection:</span>
          <span>{formatTime(metrics.operatorSelectionTime)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Schedule Validation:</span>
          <span>{formatTime(metrics.scheduleValidationTime)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Constraint Checking:</span>
          <span>{formatTime(metrics.constraintCheckTime)}</span>
        </div>
      </div>

      {/* UX Feedback */}
      {metrics.totalTimeElapsed > 60 && metrics.stage === 'operator_selection' && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#92400e'
        }}>
          <strong>Tip:</strong> Use filters to narrow operator choices faster
        </div>
      )}

      {hasExceededTarget && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#dc2626'
        }}>
          <strong>Target exceeded:</strong> Consider simplifying the assignment process
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
        <button
          onClick={() => advanceStage('scheduling')}
          disabled={metrics.stage !== 'operator_selection'}
          style={{
            flex: 1,
            padding: '6px',
            background: metrics.stage === 'operator_selection' ? '#3b82f6' : '#e5e5e5',
            color: metrics.stage === 'operator_selection' ? '#fff' : '#999',
            border: 'none',
            borderRadius: '4px',
            fontSize: '10px',
            cursor: metrics.stage === 'operator_selection' ? 'pointer' : 'not-allowed'
          }}
        >
          Next Stage
        </button>
        <button
          onClick={() => setIsRunning(!isRunning)}
          style={{
            padding: '6px 8px',
            background: isRunning ? '#dc2626' : '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '10px',
            cursor: 'pointer'
          }}
        >
          {isRunning ? 'Pause' : 'Resume'}
        </button>
      </div>

      {/* Performance Insights */}
      {metrics.stage === 'completed' && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: metrics.totalTimeElapsed <= metrics.targetTime ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${metrics.totalTimeElapsed <= metrics.targetTime ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            {metrics.totalTimeElapsed <= metrics.targetTime ? (
              <Target size={12} color="#22c55e" />
            ) : (
              <TrendingUp size={12} color="#dc2626" />
            )}
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: metrics.totalTimeElapsed <= metrics.targetTime ? '#166534' : '#dc2626'
            }}>
              {metrics.totalTimeElapsed <= metrics.targetTime ? 'Target Achieved!' : 'Room for Improvement'}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>
            Assignment completed in {formatTime(metrics.totalTimeElapsed)}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default WGPerformanceTimer;
