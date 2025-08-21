// frontend/src/lib/wgRBAC.ts
// Role-Based Access Control for WG Assignment System

export type UserRole = 'ops_admin' | 'hub_tech' | 'wg_operator' | 'exec';

export interface WGPermissions {
  canViewWGAssignments: boolean;
  canAssignOperators: boolean;
  canModifySchedules: boolean;
  canOverrideSLA: boolean;
  canEscalateSourcing: boolean;
  canViewOTPCodes: boolean;
  canAccessSourcingPipeline: boolean;
  canViewOperatorDetails: boolean;
  canDownloadBriefs: boolean;
  canViewAuditLogs: boolean;
}

export interface WGRBACContext {
  userId: string;
  role: UserRole;
  permissions: WGPermissions;
  sessionId: string;
  timestamp: Date;
}

// Permission matrix for different roles
const ROLE_PERMISSIONS: Record<UserRole, WGPermissions> = {
  ops_admin: {
    canViewWGAssignments: true,
    canAssignOperators: true,
    canModifySchedules: true,
    canOverrideSLA: true,
    canEscalateSourcing: true,
    canViewOTPCodes: true,
    canAccessSourcingPipeline: true,
    canViewOperatorDetails: true,
    canDownloadBriefs: true,
    canViewAuditLogs: true
  },
  hub_tech: {
    canViewWGAssignments: true,
    canAssignOperators: false, // Key restriction: cannot assign
    canModifySchedules: false, // Key restriction: cannot modify schedules
    canOverrideSLA: false,
    canEscalateSourcing: false,
    canViewOTPCodes: true, // Can view for hub operations
    canAccessSourcingPipeline: false,
    canViewOperatorDetails: true,
    canDownloadBriefs: true,
    canViewAuditLogs: false
  },
  wg_operator: {
    canViewWGAssignments: true, // Can view their own assignments
    canAssignOperators: false,
    canModifySchedules: false,
    canOverrideSLA: false,
    canEscalateSourcing: false,
    canViewOTPCodes: true, // Can view their assigned OTPs
    canAccessSourcingPipeline: false,
    canViewOperatorDetails: false, // Can only see their own details
    canDownloadBriefs: true, // Can download their own briefs
    canViewAuditLogs: false
  },
  exec: {
    canViewWGAssignments: true,
    canAssignOperators: false, // Executives don't perform operational tasks
    canModifySchedules: false,
    canOverrideSLA: false,
    canEscalateSourcing: true, // Can escalate high-level decisions
    canViewOTPCodes: false,
    canAccessSourcingPipeline: true, // Can view sourcing status
    canViewOperatorDetails: true,
    canDownloadBriefs: false,
    canViewAuditLogs: true
  }
};

// Audit action types
export type WGAuditAction = 
  | 'wg.assignment.create'
  | 'wg.assignment.modify'
  | 'wg.assignment.view'
  | 'wg.sla.override'
  | 'wg.sourcing.start'
  | 'wg.sourcing.escalate'
  | 'wg.otp.view'
  | 'wg.brief.download'
  | 'wg.schedule.modify'
  | 'wg.operator.view';

export interface WGAuditLog {
  id: string;
  action: WGAuditAction;
  userId: string;
  userRole: UserRole;
  shipmentId?: string;
  operatorId?: string;
  details: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
}

class WGRBACService {
  private static instance: WGRBACService;
  private auditLogs: WGAuditLog[] = [];
  
  static getInstance(): WGRBACService {
    if (!WGRBACService.instance) {
      WGRBACService.instance = new WGRBACService();
    }
    return WGRBACService.instance;
  }

  // Get permissions for a role
  getPermissions(role: UserRole): WGPermissions {
    return { ...ROLE_PERMISSIONS[role] };
  }

  // Create RBAC context for a user
  createContext(userId: string, role: UserRole, sessionId: string): WGRBACContext {
    return {
      userId,
      role,
      permissions: this.getPermissions(role),
      sessionId,
      timestamp: new Date()
    };
  }

  // Check if user can perform specific action
  canPerformAction(context: WGRBACContext, action: keyof WGPermissions): boolean {
    return context.permissions[action];
  }

  // Enforce permission with audit logging
  enforcePermission(
    context: WGRBACContext, 
    action: keyof WGPermissions,
    auditAction: WGAuditAction,
    details: Record<string, any> = {}
  ): boolean {
    const hasPermission = this.canPerformAction(context, action);
    
    // Log the access attempt
    this.logAuditAction({
      action: auditAction,
      userId: context.userId,
      userRole: context.role,
      details: {
        ...details,
        permission: action,
        contextTimestamp: context.timestamp
      },
      success: hasPermission,
      failureReason: hasPermission ? undefined : `Insufficient permissions: ${action}`
    });

    return hasPermission;
  }

  // Log audit action
  logAuditAction(log: Omit<WGAuditLog, 'id' | 'timestamp'>): void {
    const auditLog: WGAuditLog = {
      id: this.generateAuditId(),
      timestamp: new Date(),
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent(),
      ...log
    };

    this.auditLogs.push(auditLog);
    console.log(`[WG AUDIT] ${auditLog.action}:`, auditLog);

    // In real app, would send to audit logging service
    // this.auditService.log(auditLog);
  }

  // Get audit logs (filtered by permissions)
  getAuditLogs(context: WGRBACContext, filters?: {
    userId?: string;
    shipmentId?: string;
    action?: WGAuditAction;
    startDate?: Date;
    endDate?: Date;
  }): WGAuditLog[] {
    if (!this.canPerformAction(context, 'canViewAuditLogs')) {
      this.logAuditAction({
        action: 'wg.assignment.view',
        userId: context.userId,
        userRole: context.role,
        details: { resource: 'audit_logs' },
        success: false,
        failureReason: 'Insufficient permissions to view audit logs'
      });
      return [];
    }

    let logs = [...this.auditLogs];

    // Apply filters
    if (filters) {
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }
      if (filters.shipmentId) {
        logs = logs.filter(log => log.shipmentId === filters.shipmentId);
      }
      if (filters.action) {
        logs = logs.filter(log => log.action === filters.action);
      }
      if (filters.startDate) {
        logs = logs.filter(log => log.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        logs = logs.filter(log => log.timestamp <= filters.endDate!);
      }
    }

    // Log the audit log access
    this.logAuditAction({
      action: 'wg.assignment.view',
      userId: context.userId,
      userRole: context.role,
      details: { 
        resource: 'audit_logs',
        filters,
        resultCount: logs.length
      },
      success: true
    });

    return logs;
  }

  // Generate unique audit ID
  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get client IP (mock)
  private getClientIP(): string {
    // In real app, would extract from request headers
    return '192.168.1.100';
  }

  // Get user agent (mock)
  private getUserAgent(): string {
    // In real app, would extract from request headers
    return typeof window !== 'undefined' ? navigator.userAgent : 'Server-side';
  }
}

// Export singleton instance
export const wgRBACService = WGRBACService.getInstance();

// Utility functions for common RBAC operations
export const createWGContext = (userId: string, role: UserRole, sessionId: string): WGRBACContext => {
  return wgRBACService.createContext(userId, role, sessionId);
};

export const canAssignWG = (context: WGRBACContext): boolean => {
  return wgRBACService.enforcePermission(
    context, 
    'canAssignOperators',
    'wg.assignment.create'
  );
};

export const canModifyWGSchedule = (context: WGRBACContext, shipmentId: string): boolean => {
  return wgRBACService.enforcePermission(
    context, 
    'canModifySchedules',
    'wg.schedule.modify',
    { shipmentId }
  );
};

export const canOverrideSLA = (context: WGRBACContext, shipmentId: string, reason: string): boolean => {
  return wgRBACService.enforcePermission(
    context, 
    'canOverrideSLA',
    'wg.sla.override',
    { shipmentId, reason }
  );
};

export const canViewOTP = (context: WGRBACContext, shipmentId: string): boolean => {
  return wgRBACService.enforcePermission(
    context, 
    'canViewOTPCodes',
    'wg.otp.view',
    { shipmentId }
  );
};

export const canDownloadBrief = (context: WGRBACContext, shipmentId: string): boolean => {
  return wgRBACService.enforcePermission(
    context, 
    'canDownloadBriefs',
    'wg.brief.download',
    { shipmentId }
  );
};

export const canEscalateSourcing = (context: WGRBACContext, shipmentId: string): boolean => {
  return wgRBACService.enforcePermission(
    context, 
    'canEscalateSourcing',
    'wg.sourcing.escalate',
    { shipmentId }
  );
};

// Permission-aware UI helpers
export const getWGUIPermissions = (context: WGRBACContext) => {
  return {
    showAssignButton: context.permissions.canAssignOperators,
    showModifySchedule: context.permissions.canModifySchedules,
    showSLAOverride: context.permissions.canOverrideSLA,
    showOTPCodes: context.permissions.canViewOTPCodes,
    showEscalateButton: context.permissions.canEscalateSourcing,
    showOperatorDetails: context.permissions.canViewOperatorDetails,
    showDownloadBrief: context.permissions.canDownloadBriefs,
    showAuditLogs: context.permissions.canViewAuditLogs,
    isReadOnly: !context.permissions.canAssignOperators && !context.permissions.canModifySchedules
  };
};
