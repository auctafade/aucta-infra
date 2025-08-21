// frontend/src/lib/wgTelemetry.ts
// WG Telemetry System for Performance Analytics and User Behavior Insights

export interface WGViewOpenEvent {
  event: 'wg.view.open';
  data: {
    shipmentId: string;
    actor: string;
    ts: string;
    sessionId: string;
    referrer?: string;
    userAgent?: string;
  };
}

export interface WGOperatorSuggestedEvent {
  event: 'wg.operator.suggested';
  data: {
    operatorId: string;
    score: number;
    shipmentId: string;
    factors: {
      proximity: number;
      language: number;
      valueClearance: number;
      rating: number;
      availability: number;
    };
    ts: string;
  };
}

export interface WGSlotConflictEvent {
  event: 'wg.slot.conflict';
  data: {
    type: 'window' | 'travel' | 'hub' | 'calendar';
    shipmentId: string;
    operatorId?: string;
    conflictDetails: {
      requested: string; // ISO timestamp
      constraint: string; // description of constraint
      suggestion?: string; // alternative suggestion
    };
    ts: string;
  };
}

export interface WGConfirmTimeEvent {
  event: 'wg.confirm.time_ms';
  data: {
    shipmentId: string;
    actor: string;
    timeMs: number; // milliseconds from page open to confirm
    stages: {
      operatorSelection: number;
      scheduling: number;
      validation: number;
      chainOfCustody: number;
    };
    ts: string;
  };
}

export interface WGTimeToAssignEvent {
  event: 'wg.time_to_assign_ms';
  data: {
    shipmentId: string;
    timeMs: number; // milliseconds from Plan creation to WG assignment
    planCreatedAt: string;
    assignedAt: string;
    assignedBy: string;
    ts: string;
  };
}

export type WGTelemetryEvent = 
  | WGViewOpenEvent 
  | WGOperatorSuggestedEvent 
  | WGSlotConflictEvent 
  | WGConfirmTimeEvent 
  | WGTimeToAssignEvent;

// Performance tracking interface
export interface WGPerformanceMetrics {
  pageOpenTime: number;
  operatorSelectionTime?: number;
  schedulingTime?: number;
  validationTime?: number;
  chainOfCustodyTime?: number;
  totalConfirmTime?: number;
}

// Conflict tracking interface
export interface WGConflictTracker {
  windowConflicts: number;
  travelConflicts: number;
  hubConflicts: number;
  calendarConflicts: number;
  totalConflicts: number;
}

class WGTelemetryService {
  private static instance: WGTelemetryService;
  private events: WGTelemetryEvent[] = [];
  private performanceMetrics: Map<string, WGPerformanceMetrics> = new Map();
  private conflictTrackers: Map<string, WGConflictTracker> = new Map();
  private operatorSuggestions: Map<string, Array<{operatorId: string, score: number, timestamp: number}>> = new Map();
  
  static getInstance(): WGTelemetryService {
    if (!WGTelemetryService.instance) {
      WGTelemetryService.instance = new WGTelemetryService();
    }
    return WGTelemetryService.instance;
  }

  // Track page view opening
  trackViewOpen(shipmentId: string, actor: string, sessionId: string): void {
    const event: WGViewOpenEvent = {
      event: 'wg.view.open',
      data: {
        shipmentId,
        actor,
        sessionId,
        referrer: typeof window !== 'undefined' ? document.referrer : undefined,
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
        ts: new Date().toISOString()
      }
    };

    this.emitEvent(event);
    
    // Initialize performance tracking
    this.performanceMetrics.set(shipmentId, {
      pageOpenTime: Date.now()
    });

    // Initialize conflict tracking
    this.conflictTrackers.set(shipmentId, {
      windowConflicts: 0,
      travelConflicts: 0,
      hubConflicts: 0,
      calendarConflicts: 0,
      totalConflicts: 0
    });
  }

  // Track operator suggestion with scoring
  trackOperatorSuggested(
    shipmentId: string,
    operatorId: string, 
    score: number,
    factors: {
      proximity: number;
      language: number;
      valueClearance: number;
      rating: number;
      availability: number;
    }
  ): void {
    const event: WGOperatorSuggestedEvent = {
      event: 'wg.operator.suggested',
      data: {
        operatorId,
        score,
        shipmentId,
        factors,
        ts: new Date().toISOString()
      }
    };

    this.emitEvent(event);

    // Track suggestion for analytics
    if (!this.operatorSuggestions.has(shipmentId)) {
      this.operatorSuggestions.set(shipmentId, []);
    }
    this.operatorSuggestions.get(shipmentId)!.push({
      operatorId,
      score,
      timestamp: Date.now()
    });
  }

  // Track slot conflicts
  trackSlotConflict(
    shipmentId: string,
    type: 'window' | 'travel' | 'hub' | 'calendar',
    conflictDetails: {
      requested: string;
      constraint: string;
      suggestion?: string;
    },
    operatorId?: string
  ): void {
    const event: WGSlotConflictEvent = {
      event: 'wg.slot.conflict',
      data: {
        type,
        shipmentId,
        operatorId,
        conflictDetails,
        ts: new Date().toISOString()
      }
    };

    this.emitEvent(event);

    // Update conflict tracker
    const tracker = this.conflictTrackers.get(shipmentId);
    if (tracker) {
      tracker[`${type}Conflicts`]++;
      tracker.totalConflicts++;
    }
  }

  // Track stage completion times
  trackStageComplete(shipmentId: string, stage: 'operatorSelection' | 'scheduling' | 'validation' | 'chainOfCustody'): void {
    const metrics = this.performanceMetrics.get(shipmentId);
    if (metrics) {
      const now = Date.now();
      const stageDuration = now - (metrics.pageOpenTime + this.getTotalPreviousStageTime(metrics, stage));
      
      switch (stage) {
        case 'operatorSelection':
          metrics.operatorSelectionTime = stageDuration;
          break;
        case 'scheduling':
          metrics.schedulingTime = stageDuration;
          break;
        case 'validation':
          metrics.validationTime = stageDuration;
          break;
        case 'chainOfCustody':
          metrics.chainOfCustodyTime = stageDuration;
          break;
      }
    }
  }

  // Track final confirmation time
  trackConfirmTime(shipmentId: string, actor: string): void {
    const metrics = this.performanceMetrics.get(shipmentId);
    if (!metrics) return;

    const totalTime = Date.now() - metrics.pageOpenTime;
    metrics.totalConfirmTime = totalTime;

    const event: WGConfirmTimeEvent = {
      event: 'wg.confirm.time_ms',
      data: {
        shipmentId,
        actor,
        timeMs: totalTime,
        stages: {
          operatorSelection: metrics.operatorSelectionTime || 0,
          scheduling: metrics.schedulingTime || 0,
          validation: metrics.validationTime || 0,
          chainOfCustody: metrics.chainOfCustodyTime || 0
        },
        ts: new Date().toISOString()
      }
    };

    this.emitEvent(event);
  }

  // Track time from Plan to assignment
  trackTimeToAssign(
    shipmentId: string,
    planCreatedAt: Date,
    assignedBy: string
  ): void {
    const now = new Date();
    const timeToAssign = now.getTime() - planCreatedAt.getTime();

    const event: WGTimeToAssignEvent = {
      event: 'wg.time_to_assign_ms',
      data: {
        shipmentId,
        timeMs: timeToAssign,
        planCreatedAt: planCreatedAt.toISOString(),
        assignedAt: now.toISOString(),
        assignedBy,
        ts: now.toISOString()
      }
    };

    this.emitEvent(event);
  }

  // Get analytics summary for a shipment
  getShipmentAnalytics(shipmentId: string) {
    const metrics = this.performanceMetrics.get(shipmentId);
    const conflicts = this.conflictTrackers.get(shipmentId);
    const suggestions = this.operatorSuggestions.get(shipmentId) || [];
    const events = this.events.filter(e => 
      'shipmentId' in e.data && e.data.shipmentId === shipmentId
    );

    return {
      performance: metrics,
      conflicts,
      operatorSuggestions: suggestions,
      events: events.length,
      timeline: events.map(e => ({
        event: e.event,
        timestamp: e.data.ts
      }))
    };
  }

  // Get global analytics
  getGlobalAnalytics() {
    const allMetrics = Array.from(this.performanceMetrics.values());
    const allConflicts = Array.from(this.conflictTrackers.values());
    
    return {
      totalSessions: allMetrics.length,
      averageConfirmTime: this.calculateAverage(allMetrics.map(m => m.totalConfirmTime).filter(Boolean)),
      conflictBreakdown: {
        window: allConflicts.reduce((sum, c) => sum + c.windowConflicts, 0),
        travel: allConflicts.reduce((sum, c) => sum + c.travelConflicts, 0),
        hub: allConflicts.reduce((sum, c) => sum + c.hubConflicts, 0),
        calendar: allConflicts.reduce((sum, c) => sum + c.calendarConflicts, 0)
      },
      performanceDistribution: this.getPerformanceDistribution(allMetrics),
      topOperatorsByScore: this.getTopOperatorsByScore()
    };
  }

  // Emit event to various analytics endpoints
  private emitEvent(event: WGTelemetryEvent): void {
    this.events.push(event);
    
    // Console logging for development
    console.log(`[WG TELEMETRY] ${event.event}:`, event.data);

    // In production, would send to analytics services:
    // - Google Analytics
    // - Mixpanel
    // - Custom analytics API
    // - Data warehouse
    
    this.sendToAnalyticsAPI(event);
    this.sendToRealTimeDashboard(event);
  }

  private sendToAnalyticsAPI(event: WGTelemetryEvent): void {
    // Simulate API call
    if (typeof window !== 'undefined') {
      // In real app, would use fetch() to send to analytics endpoint
      // fetch('/api/analytics/wg', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event)
      // });
    }
  }

  private sendToRealTimeDashboard(event: WGTelemetryEvent): void {
    // Simulate real-time dashboard update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wg-telemetry', {
        detail: event
      }));
    }
  }

  private getTotalPreviousStageTime(metrics: WGPerformanceMetrics, currentStage: string): number {
    let total = 0;
    const stages = ['operatorSelection', 'scheduling', 'validation', 'chainOfCustody'];
    const currentIndex = stages.indexOf(currentStage);
    
    for (let i = 0; i < currentIndex; i++) {
      const stage = stages[i] as keyof WGPerformanceMetrics;
      if (typeof metrics[stage] === 'number') {
        total += metrics[stage] as number;
      }
    }
    
    return total;
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private getPerformanceDistribution(metrics: WGPerformanceMetrics[]) {
    const confirmTimes = metrics.map(m => m.totalConfirmTime).filter(Boolean);
    
    return {
      under60s: confirmTimes.filter(t => t < 60000).length,
      under120s: confirmTimes.filter(t => t < 120000).length,
      under300s: confirmTimes.filter(t => t < 300000).length,
      over300s: confirmTimes.filter(t => t >= 300000).length
    };
  }

  private getTopOperatorsByScore() {
    const allSuggestions = Array.from(this.operatorSuggestions.values()).flat();
    const operatorStats = new Map<string, {total: number, count: number, avg: number}>();
    
    allSuggestions.forEach(suggestion => {
      const existing = operatorStats.get(suggestion.operatorId) || {total: 0, count: 0, avg: 0};
      existing.total += suggestion.score;
      existing.count += 1;
      existing.avg = existing.total / existing.count;
      operatorStats.set(suggestion.operatorId, existing);
    });

    return Array.from(operatorStats.entries())
      .sort((a, b) => b[1].avg - a[1].avg)
      .slice(0, 10);
  }

  // Clear data (for testing)
  clearData(): void {
    this.events = [];
    this.performanceMetrics.clear();
    this.conflictTrackers.clear();
    this.operatorSuggestions.clear();
  }
}

// Export singleton instance
export const wgTelemetryService = WGTelemetryService.getInstance();

// Utility functions for easy integration
export const trackWGViewOpen = (shipmentId: string, actor: string, sessionId: string): void => {
  wgTelemetryService.trackViewOpen(shipmentId, actor, sessionId);
};

export const trackOperatorSuggestion = (
  shipmentId: string,
  operatorId: string,
  score: number,
  factors: {
    proximity: number;
    language: number;
    valueClearance: number;
    rating: number;
    availability: number;
  }
): void => {
  wgTelemetryService.trackOperatorSuggested(shipmentId, operatorId, score, factors);
};

export const trackSlotConflict = (
  shipmentId: string,
  type: 'window' | 'travel' | 'hub' | 'calendar',
  conflictDetails: {
    requested: string;
    constraint: string;
    suggestion?: string;
  },
  operatorId?: string
): void => {
  wgTelemetryService.trackSlotConflict(shipmentId, type, conflictDetails, operatorId);
};

export const trackStageComplete = (shipmentId: string, stage: 'operatorSelection' | 'scheduling' | 'validation' | 'chainOfCustody'): void => {
  wgTelemetryService.trackStageComplete(shipmentId, stage);
};

export const trackConfirmTime = (shipmentId: string, actor: string): void => {
  wgTelemetryService.trackConfirmTime(shipmentId, actor);
};

export const trackTimeToAssign = (shipmentId: string, planCreatedAt: Date, assignedBy: string): void => {
  wgTelemetryService.trackTimeToAssign(shipmentId, planCreatedAt, assignedBy);
};
