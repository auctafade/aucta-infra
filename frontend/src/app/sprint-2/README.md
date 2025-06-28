# Sprint 2: Client Dashboard

## Overview

Sprint 2 implements the complete client-facing dashboard for the AUCTA luxury authentication platform. This sprint focuses on providing authenticated clients with a secure, comprehensive interface to manage their luxury items, view authentication records, and interact with the blockchain-based authentication system.

## Architecture

### Layout System
- **Base Layout**: `layout.tsx` provides conditional routing
- **Dashboard Layout**: `ClientDashboardLayout` component wraps all authenticated pages
- **Login Bypass**: Login page (`login-client`) bypasses dashboard layout
- **Protected Routes**: All other routes require authentication and use dashboard wrapper

### Authentication Flow
```
/sprint-2/login-client → Authentication → Dashboard Redirect → Protected Routes
```

## Core Features

### 1. Authentication & Access Control
**File**: `login-client/page.tsx`
- **Frontend**: Client login interface with wallet connection
- **Backend Calls**:
  - `POST /api/auth/login` - Client authentication
  - `GET /api/auth/verify` - Token verification
  - `POST /api/wallet/connect` - Wallet connection verification

### 2. Vault Management
**File**: `vault-client/page.tsx`
- **Purpose**: Central hub for managing authenticated luxury items
- **Backend Calls**:
  - `GET /api/client/items` - Fetch all client's authenticated items
  - `GET /api/items/{id}/passport` - Retrieve item passport details
  - `GET /api/items/{id}/sbt` - Get SBT token information
  - `POST /api/items/{id}/transfer-request` - Initiate transfer process

### 3. Profile Management
**File**: `profile/page.tsx`
- **Purpose**: Client profile and KYC information management
- **Backend Calls**:
  - `GET /api/client/profile` - Fetch client profile data
  - `PUT /api/client/profile` - Update profile information
  - `GET /api/client/kyc-status` - Check KYC verification status
  - `POST /api/client/kyc-update` - Submit KYC updates

### 4. Wallet Integration
**File**: `wallet/page.tsx`
- **Purpose**: Blockchain wallet management and transaction history
- **Backend Calls**:
  - `GET /api/wallet/balance` - Get wallet balances
  - `GET /api/wallet/transactions` - Fetch transaction history
  - `POST /api/wallet/sign` - Sign blockchain transactions
  - `GET /api/wallet/sbt-tokens` - List owned SBT tokens

### 5. Security Settings
**File**: `security-settings/page.tsx`
- **Purpose**: Account security, 2FA, and access management
- **Backend Calls**:
  - `GET /api/client/security-settings` - Fetch current security settings
  - `POST /api/client/2fa/enable` - Enable two-factor authentication
  - `POST /api/client/2fa/disable` - Disable two-factor authentication
  - `PUT /api/client/password` - Change account password
  - `GET /api/client/login-history` - Fetch login activity

### 6. Proxy Services
**File**: `proxy/page.tsx`
- **Purpose**: Third-party service integrations and API proxies
- **Backend Calls**:
  - `GET /api/proxy/auction-houses` - Connected auction house integrations
  - `POST /api/proxy/connect-service` - Connect new third-party service
  - `GET /api/proxy/data-sync` - Sync data with external services

### 7. Activity Monitoring
**File**: `activity-log/page.tsx`
- **Purpose**: Comprehensive activity and audit trail
- **Backend Calls**:
  - `GET /api/client/activity` - Fetch activity log
  - `GET /api/items/{id}/history` - Get item-specific activity
  - `GET /api/blockchain/events` - Fetch blockchain events
  - `POST /api/activity/export` - Export activity data

### 8. Document Management
**File**: `documents/page.tsx`
- **Purpose**: Upload, manage, and view authentication documents
- **Backend Calls**:
  - `GET /api/client/documents` - List all client documents
  - `POST /api/documents/upload` - Upload new documents
  - `GET /api/documents/{id}` - Download specific document
  - `DELETE /api/documents/{id}` - Remove document
  - `POST /api/documents/{id}/verify` - Request document verification

### 9. Transfer Management
**File**: `transfer-request/page.tsx`
- **Purpose**: Initiate and manage ownership transfers
- **Backend Calls**:
  - `GET /api/transfers/pending` - Get pending transfer requests
  - `POST /api/transfers/create` - Create new transfer request
  - `PUT /api/transfers/{id}/approve` - Approve transfer
  - `PUT /api/transfers/{id}/reject` - Reject transfer
  - `GET /api/transfers/history` - Transfer history

### 10. Messaging System
**File**: `messages/page.tsx`
- **Purpose**: Secure communication with AUCTA support and services
- **Backend Calls**:
  - `GET /api/messages` - Fetch client messages
  - `POST /api/messages/send` - Send new message
  - `PUT /api/messages/{id}/read` - Mark message as read
  - `GET /api/messages/threads` - Get conversation threads

### 11. QR Access
**File**: `qr-access/page.tsx`
- **Purpose**: QR code generation for item access and verification
- **Backend Calls**:
  - `POST /api/qr/generate` - Generate QR codes for items
  - `GET /api/qr/{code}/verify` - Verify QR code authenticity
  - `GET /api/qr/access-logs` - QR code access history
  - `PUT /api/qr/{code}/revoke` - Revoke QR code access

### 12. Valuation Tracking
**File**: `valuation-history/page.tsx`
- **Purpose**: Track item valuations and market data
- **Backend Calls**:
  - `GET /api/valuations/items` - Get item valuations
  - `GET /api/valuations/history/{id}` - Valuation history for specific item
  - `POST /api/valuations/request` - Request professional valuation
  - `GET /api/market/trends` - Market trend data

### 13. Rewards Program
**File**: `rewards/page.tsx`
- **Purpose**: Client loyalty and rewards program management
- **Backend Calls**:
  - `GET /api/rewards/balance` - Get reward points balance
  - `GET /api/rewards/history` - Rewards transaction history
  - `POST /api/rewards/redeem` - Redeem reward points
  - `GET /api/rewards/available` - Available reward options

### 14. Inheritance Planning
**File**: `inheritance-plan/page.tsx`
- **Purpose**: Digital inheritance and succession planning for luxury items
- **Backend Calls**:
  - `GET /api/inheritance/plans` - Get inheritance plans
  - `POST /api/inheritance/create` - Create inheritance plan
  - `PUT /api/inheritance/update` - Update existing plan
  - `GET /api/inheritance/beneficiaries` - List beneficiaries
  - `POST /api/inheritance/execute` - Execute inheritance transfer

## Backend Integration Patterns

### Authentication Middleware
All Sprint 2 routes require authentication tokens:
```javascript
Headers: {
  'Authorization': 'Bearer <jwt_token>',
  'X-Client-ID': '<client_uuid>',
  'Content-Type': 'application/json'
}
```

### Error Handling
Standard error responses across all endpoints:
- `401 Unauthorized` - Invalid or expired token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `422 Unprocessable Entity` - Validation errors
- `500 Internal Server Error` - Server errors

### Data Flow
1. **Client Authentication** → JWT Token Generation
2. **Dashboard Access** → Token Validation
3. **Feature Interaction** → API Calls with Auth Headers
4. **Blockchain Operations** → Wallet Signature Required
5. **Data Updates** → Real-time UI Updates

## Security Considerations

### Authentication
- JWT tokens with expiration
- Refresh token rotation
- Multi-factor authentication support
- Session management

### Authorization
- Role-based access control (RBAC)
- Resource-level permissions
- Client data isolation
- Audit trail for all actions

### Data Protection
- End-to-end encryption for sensitive data
- Secure document storage
- PII protection compliance
- GDPR compliance features

## Development Guidelines

### State Management
- Use React hooks for local state
- Context providers for shared state
- Real-time updates via WebSocket connections
- Optimistic UI updates where appropriate

### Error Handling
- Graceful error boundaries
- User-friendly error messages
- Retry mechanisms for failed requests
- Offline state management

### Performance
- Lazy loading for dashboard components
- Pagination for large data sets
- Caching strategies for frequently accessed data
- Image optimization for document previews

## API Dependencies

### Core Services
- **Authentication Service**: User login and session management
- **Blockchain Service**: SBT operations and wallet interactions
- **Document Service**: File upload and management
- **Notification Service**: Real-time messaging and alerts

### External Integrations
- **Wallet Providers**: MetaMask, WalletConnect
- **Cloud Storage**: AWS S3 for document storage
- **Analytics**: User behavior tracking
- **Support**: Customer service integration

## Testing Strategy

### Unit Tests
- Component functionality testing
- API integration tests
- Authentication flow testing
- Form validation testing

### Integration Tests
- End-to-end user journeys
- Cross-component communication
- Backend API integration
- Error scenario handling

### Security Tests
- Authentication bypass attempts
- Authorization boundary testing
- Data access validation
- XSS and CSRF protection

## Deployment Considerations

### Environment Variables
```bash
NEXT_PUBLIC_API_BASE_URL=https://api.aucta.com
NEXT_PUBLIC_BLOCKCHAIN_RPC=wss://blockchain.aucta.com
NEXT_PUBLIC_WALLET_CONNECT_ID=<wallet_connect_project_id>
```

### Build Process
- Static generation for public pages
- Server-side rendering for dashboard
- Client-side hydration for interactive features
- Progressive Web App (PWA) support

### Monitoring
- Real-time error tracking
- Performance monitoring
- User analytics
- API response time tracking

## Future Enhancements

### Phase 1 (Sprint 3 Integration)
- Resale marketplace integration
- Enhanced transfer workflows
- Auction house connectivity

### Phase 2 (Advanced Features)
- Mobile app synchronization
- Offline functionality
- Advanced analytics dashboard
- AI-powered recommendations

### Phase 3 (Enterprise Features)
- Multi-tenant support
- Advanced reporting
- Custom branding options
- API rate limiting and quotas
