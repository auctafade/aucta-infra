# DHL Labels - Sprint 8 Logistics

## Overview

The DHL Labels page (`/sprint-8/logistics/dhl`) handles the purchase and management of shipping labels for DHL segments within planned routes. This page materializes the DHL parts of routes without changing the underlying plan.

## Purpose

- **Label Generation**: Purchase DHL shipping labels for planned route segments
- **Tracking Assignment**: Generate and assign tracking numbers to shipments
- **System Integration**: Update Hub Console, Dashboard, and Client Apps with tracking info
- **Separation of Concerns**: Handle only DHL legs, with WG legs managed elsewhere

## URL Structure

```
http://localhost:3000/sprint-8/logistics/dhl?shipment=SHIPMENT_ID&route=ROUTE_ID
```

### Parameters
- `shipment` (required): The shipment ID to process labels for
- `route` (optional): The specific route ID for reference

## Key Features

### 1. Context Header
Displays comprehensive shipment information:
- Classification (Tier, Hub assignment)
- Item details (Value, Weight, Fragility)
- Route information (Sender → Buyer, Timeline)
- SLA targets and delivery dates

### 2. Relevant Legs (per plan)
List of DHL legs in execution order with comprehensive details:
- **Route Display**: Shows Sender → Hub or Hub → Buyer with countries
- **Service Information**: Current selection (Standard/Express), ETA band
- **Rate TTL Status**: Fresh/Amber/Stale indicators with warnings
- **Status Badges**: Pending/Label Created (with tracking number)
- **Validation Badges**: Ready/Missing Data with detailed requirements
- **Expandable Options**: Click any leg to open detailed options panel

### 3. Route Leg Separation
- **DHL Legs**: Displayed for label purchase (Standard/Express)
- **WG Legs**: Shows reminder banner with link to WG Scheduling
- **Clear Distinction**: Visual separation between different leg types

### 4. Label Purchase Flow
- Individual leg label purchase
- Bulk "Purchase All Labels" option
- Real-time purchase status updates
- Error handling and retry mechanisms

### 5. Service Type Support
- **DHL Standard**: 3-day transit, standard cost
- **DHL Express**: 2-day transit, premium cost
- Automatic service detection from route plan

### 6. Tracking Integration
- Automatic tracking number generation
- DHL reference assignment
- ETA calculation and updates
- Integration with downstream systems

### 7. System Events
Emits custom events for system integration:
- `label.generated`: When a label is purchased
- `shipment.labels_complete`: When all labels are generated

## Data Flow

### Input Requirements
1. **Planned Route**: Must have completed route planning
2. **DHL Legs**: Route must contain DHL shipping segments
3. **Shipment Data**: Valid shipment with classification

### Processing Steps
1. Fetch shipment and route data
2. Filter DHL legs from route plan
3. Display purchase interface
4. Process label purchases via API simulation
5. Generate tracking numbers and references
6. Update system integrations

### Output
- Generated shipping labels (PDF)
- Tracking numbers for each DHL segment
- Integration events for Hub Console and Client Apps
- Updated shipment status with tracking info

## Integration Points

### Upstream Dependencies
- **Route Planning**: Requires completed route with DHL legs
- **Tier Gate**: Uses tier and hub assignments
- **Shipment Classification**: Depends on classification data

### Downstream Integrations
- **Hub Console**: Receives tracking updates for ETA feeds
- **Client App**: Gets live tracking for customer visibility
- **Dashboard**: Updates shipment status and progression

## User Interface

### Layout Structure
1. **Header**: Page title, shipment context, navigation
2. **Context Panel**: Shipment details, routing, timeline
3. **WG Reminder**: Banner for non-DHL legs (if any)
4. **Relevant Legs**: Detailed per-plan leg management with expandable options
5. **DHL Legs List**: Purchasable DHL segments (legacy section)
6. **Actions Panel**: Purchase buttons, status indicators
7. **Success State**: Next steps after all labels generated

### C) Options (per leg) - Comprehensive Configuration
When a leg is selected, opens a tabbed interface for complete service configuration:

#### Service & Packages Tab
- **Service Level**: Standard/Express (reflects plan suggestion, editable)
- **Signature Required**: Toggle with forced activation above value threshold  
- **Insured Value**: Default to declared value, editable within range
- **Packages**: Default single package, allow multi-parcel with weight/dims/quantities
- **Pickup vs Drop-off**: DHL pickup with date/time windows or drop-off options
- **Label Format**: PDF/PNG selection with paperless trade option

#### Addresses Tab  
- **Address Recap**: Sender/Hub/Buyer with complete validation
- **Validation State**: Format, phone, postcode validation with error display
- **Real-time Validation**: Phone/email format checking on blur

#### Customs & Docs Tab (Cross-border only)
- **Commercial Invoice**: Shipper/recipient, HS code, declared value/currency
- **Incoterm**: DAP by default, selectable options
- **Contents Type**: "Service/Authentication return" for Hub legs
- **EORI/VAT Fields**: Required for UK/EU lanes
- **Documents Checklist**: Invoice/receipt attachment status

#### Summary Tab
- **Configuration Review**: All settings summary before purchase
- **Cost Estimation**: Base shipping + insurance + signature costs
- **Validation Status**: Ready/Issues with detailed error list

#### Guardrails (Inline Validation)
Blocks purchase if failing requirements:
- ✅ Weight/dimensions > 0
- ✅ Addresses complete with valid format
- ✅ Phone/email validation passed
- ✅ Insured value ≤ declared value  
- ✅ Cross-border: HS code + invoice data present
- ✅ UK/EU lanes: customs documentation mandatory

### D) Cost Recap - Comprehensive Financial Overview
Detailed cost breakdown and variance tracking for all DHL legs:

#### Per Leg Cost Breakdown
- **Service Level**: Shows selected DHL Standard/Express with cost impact
- **Base Cost**: Core shipping rate based on weight/dimensions/distance
- **Surcharges**: Fuel surcharge (12%), remote area surcharge (8% if applicable)
- **Insurance Cost**: Calculated at 0.2% of insured value
- **Signature Cost**: €5.00 if signature required
- **Customs Clearance**: €15.00 for cross-border shipments
- **Visual Categories**: Color-coded cost components for easy identification

#### Total Calculation
- **Aggregated Costs**: Sum of all selected DHL legs
- **Real-time Updates**: Costs recalculate based on options changes
- **Multi-leg Support**: Handles complex routes with multiple DHL segments

#### Variance vs Plan
- **Original Estimate**: Shows provisional cost from route planning
- **Current vs Plan**: Live comparison with actual configured costs
- **Percentage Variance**: Displays +/- percentage change
- **Amber Warnings**: Highlights significant variances >15% over plan
- **Cost Impact Analysis**: Explains why costs changed (service upgrades, insurance adjustments)

#### Smart Cost Features
- **Service Level Impact**: Express vs Standard cost differences
- **Option-driven Updates**: Insurance and signature costs reflect user choices
- **Regional Adjustments**: Remote area and fuel surcharges based on route
- **Currency Consistency**: All amounts in EUR with proper formatting

### Actions - Comprehensive Label Management
Complete action system for purchasing and managing DHL labels:

#### Primary Actions
- **Buy Label (per leg)**: Full validation and purchase workflow
  - Runs all validations & guardrails before purchase
  - Automatically refreshes stale rates before purchase  
  - Calls DHL API with proper error handling
  - Updates leg status to "LabelCreated" on success
  - Stores tracking number & label link
  - Shows success toast with quick actions

#### Success Toast Quick Actions  
When label is successfully created, shows interactive toast with:
- **Download**: Direct link to label PDF
- **Copy Tracking**: Copies tracking number to clipboard
- **Email to Shipper**: Sends label to designated shipper email

#### Secondary Actions
- **Refresh Rate**: Updates stale rate TTL status for continued purchasing
- **Save for Later**: Preserves leg configuration without purchasing (with validation)
- **Void Label**: Cancels generated labels with audit logging
- **Download All Labels**: Combines multiple labels into single PDF (convenience feature)

#### Action Validation & Guardrails
- **Pre-purchase Validation**: Checks all options, addresses, customs requirements
- **Rate TTL Enforcement**: Blocks purchase with stale rates, offers auto-refresh
- **Cost Variance Warnings**: Alerts for significant budget deviations
- **Audit Trail**: Logs all void operations with timestamps and reasons

#### Smart Action States
- **Context-aware Buttons**: Actions adapt based on leg status and validation state
- **Loading Indicators**: Real-time feedback during API operations
- **Error Handling**: Graceful fallbacks with detailed error messages
- **Batch Operations**: Refresh multiple stale rates, download multiple labels

### Events (emit) - System Integration
Comprehensive event emission for downstream system integration:

#### Event Types
- **dhl.label.purchased**: Core business event when label is successfully purchased
  - Data: `{ shipmentId, legId, service, costCts, trackingNumber, actorId, ts }`
  - Purpose: Updates Dashboard queues, triggers billing, records audit trail

- **dhl.tracking.added**: Tracking information available for client systems
  - Data: `{ shipmentId, legId, trackingNumber, carrier: "DHL", ts }`
  - Purpose: Triggers Sprint 2 client tracking, updates shipment status

- **dhl.pickup.scheduled**: Pickup window confirmed with DHL
  - Data: `{ shipmentId, legId, windowFrom, windowTo, ts }`
  - Purpose: Informs Hub ETA planning, coordinates logistics

#### Integration Impact
- **Dashboard Queues**: Real-time status updates and tracking information
- **Sprint 2 Client Tracking**: Live tracking updates in client applications
- **Hub ETA Planning**: Delivery window coordination and resource planning
- **Audit Trail**: Complete activity logging for compliance and troubleshooting

#### Event Architecture
- **Fire-and-forget**: Events don't block main operations if downstream systems fail
- **Structured Data**: Consistent event schemas for reliable processing
- **Timestamp Precision**: ISO 8601 timestamps for accurate sequencing
- **Actor Tracking**: User identification for accountability

### Definition of Done (Page-level) Validation
Real-time completion tracking with 6 key criteria:

1. **Individual Configuration**: Each DHL leg configured independently
2. **Validation & Guardrails**: All legs validated before purchase allowed
3. **Individual Purchase**: Legs purchased separately as needed
4. **Labels Downloadable**: Generated labels accessible via PDF download
5. **Tracking Visibility**: Tracking information visible across systems
6. **Variance Transparency**: Cost variance vs plan clearly displayed

### UX Expectations - Performance & Usability
Optimized user experience meeting professional logistics requirements:

#### Performance Standards
- **<30 Second Purchase**: Most legs purchasable in under 30 seconds once data is valid
- **API Optimization**: 0.8-2.3 second typical purchase times (vs 2-4 seconds baseline)
- **Real-time Feedback**: Purchase time displayed in success toast ("Label created in 1.4s")
- **Failure Rate**: Reduced to 5% (from 10%) for better user experience

#### Field-level Error Handling
- **Never Lose Data**: Typed data preserved on validation errors
- **Real-time Validation**: Field errors appear immediately on blur/change
- **Specific Error Messages**: Clear, actionable feedback per field
  - "Weight exceeds DHL limit (70kg)" 
  - "Invalid postcode format"
  - "Description too short (minimum 3 characters)"
- **Field-specific Display**: Errors shown exactly where they occur in the form

#### One-click Operations
- **Buy & Download**: Primary green button for common workflow
- **Immediate Download**: Label download starts automatically after purchase
- **Success Feedback**: "Label purchased and download started" confirmation
- **Fallback Options**: "Buy Only" available as secondary action

#### Independent Leg Purchase
- **Multi-leg Support**: Purchase legs independently when multiple routes
- **Clear Labeling**: "Outbound" vs "Return" leg identification
- **Contextual Guidance**: "Buy outbound now, return leg after hub completion"
- **Flexible Workflow**: No requirement to purchase all legs simultaneously
- **Smart Defaults**: Different behavior for sender→hub vs hub→buyer legs

#### Data Persistence & Recovery
- **Auto-save Drafts**: Configuration automatically saved during typing
- **Validation Recovery**: Clear path to fix field-level errors
- **Progress Preservation**: No lost work on temporary failures
- **Real-time Sync**: Changes reflected immediately across all views

#### User Guidance
- **Purchase Readiness**: "Ready in ~2s" indicator for valid legs
- **Progress Indicators**: Clear loading states with meaningful messages
- **Validation Hints**: Proactive guidance before errors occur
- **Context Awareness**: Different messaging for different leg types

### Edge Cases & Handling
Comprehensive edge case detection and handling for production reliability:

#### Stale Rate Management
- **Amber Badge Display**: Stale rates show amber warning badge with timestamp
- **Forced Refresh**: Cannot purchase with stale rates; refresh button prominently displayed
- **Auto-refresh**: Rate TTL status automatically managed (fresh → amber → stale)
- **Telemetry**: `dhl.rate.refresh` events track refresh frequency and timing

#### Remote Area Surcharge Detection
- **Automatic Detection**: Scans locations for remote area patterns (Scottish Highlands, Channel Islands, etc.)
- **Pre-purchase Flagging**: Remote area surcharges flagged before purchase with clear cost breakdown
- **Cost Integration**: Surcharges automatically included in cost recap and variance calculations
- **Visual Indicators**: Orange badges and detailed surcharge explanations

#### Multi-parcel Validation
- **Weight Limits**: Total weight validation with 500kg reasonable limit guard
- **Volume Guards**: Prevents unrealistic total volumes (>1m³ triggers warning)
- **Per-package Validation**: Individual package weight/dimension limits (70kg, 120cm max dimension)
- **Smart Summation**: Automatic calculation of total weight across all packages

#### Address Validation & Suggestions
- **Format Validation**: Postcode format validation per country (UK: SW1A 1AA pattern)
- **Country Mismatch Detection**: Suggests corrections when city/country don't match
- **Confidence Scoring**: Suggestion confidence levels (0.8-0.9) for user trust
- **Auto-correction**: Smart postcode formatting and case correction

#### Cross-border Documentation
- **Missing Docs Detection**: Blocks purchase when required customs documentation is missing
- **Deep Link Integration**: Provides direct links to Customs Watch and document upload systems
- **HS Code Validation**: Ensures HS codes are present for all international shipments
- **Invoice Attachment**: Validates commercial invoice attachment for customs clearance

#### Label Void Management
- **Carrier Window Validation**: 24-hour void window enforcement with precise timing
- **Audit Logging**: Comprehensive audit trail with user, timestamp, reason, and cost recovery
- **Status Reversion**: Automatically reverts leg to 'pending' and forces rate refresh
- **Cost Recovery Tracking**: Tracks voided label costs for financial reconciliation

#### Currency Management
- **Dual Display**: Client currency (GBP, USD) alongside base EUR with live exchange rates
- **Margin Calculation**: All margin calculations use base EUR for consistency
- **Exchange Rate Tracking**: Exchange rate timestamps and source tracking
- **Multi-currency Support**: Flexible currency symbols and formatting

### Telemetry System
Production-grade telemetry for operational insights and performance monitoring:

#### Core Events
- **`dhl.rate.refresh`**: Rate refresh frequency, timing, and fresh/stale status
- **`dhl.purchase.time_ms`**: Purchase completion times for performance monitoring
- **`dhl.guardrail.triggered`**: Validation failures by type (address, customs, package, etc.)
- **`dhl.variance.vs_plan_pct`**: Cost variance from plan for margin impact analysis

#### Advanced Tracking
- **Session Management**: Unique session IDs for cross-system tracking
- **Performance Metrics**: API response times, user action timing, failure rates
- **Business Intelligence**: Variance patterns, guardrail effectiveness, user behavior
- **Audit Integration**: Links telemetry with audit logs for complete operational picture

#### Event Data Structure
```typescript
interface DhlTelemetryEvent {
  event: 'dhl.rate.refresh' | 'dhl.purchase.time_ms' | 'dhl.guardrail.triggered' | 'dhl.variance.vs_plan_pct';
  data: {
    legId: string;
    timeMs?: number;
    variancePercent?: number;
    type?: string;
    route?: string;
  };
  timestamp: string;
  sessionId: string;
}
```

### Visual Design
- Orange theme for DHL branding
- Clear status indicators (pending, purchasing, generated, failed)
- Service type badges (Standard vs Express)
- Progress tracking for multi-leg shipments
- Edge case warning panels and suggestion displays

## API Simulation

Since this is a demo environment, DHL API calls are simulated:

```javascript
// Mock DHL API Response
{
  success: true,
  trackingNumber: "DHL1234567890",
  dhlReference: "REF-SHIP001-LEG1", 
  labelUrl: "/api/labels/dhl/SHIP001-LEG1.pdf",
  estimatedDelivery: "2024-01-15T14:00:00Z",
  cost: 45.50,
  currency: "EUR"
}
```

## Error Handling

### Common Error Scenarios
1. **Missing Shipment ID**: Redirects with helpful message
2. **No Route Plan**: Suggests completing route planning first
3. **No DHL Legs**: Shows empty state with route review option
4. **API Failures**: Provides retry mechanisms with error details

### Recovery Actions
- Retry button for failed purchases
- Links to route planning for plan issues
- Dashboard navigation for general errors

## Testing

### Demo Page
Access `/sprint-8/logistics/dhl/demo` for:
- Sample shipments with different configurations
- Test scenarios for various route types
- Integration feature demonstrations

### Test Scenarios
1. **Single DHL Leg**: Simple standard or express route
2. **Multiple DHL Legs**: Multi-segment routing with different services
3. **Mixed Routes**: DHL + White-Glove combinations
4. **Error Cases**: API failures, missing data, etc.

## Development Notes

### File Structure
```
frontend/src/app/sprint-8/logistics/dhl/
├── page.tsx              # Main DHL Labels page
├── demo/
│   └── page.tsx          # Demo and testing page
└── README.md             # This documentation
```

### Key Components
- `DhlLabelsPage`: Main functional component
- `LabelPurchaseResult`: Type for API responses
- `DhlLeg`: Extended leg type with label status
- Event emission system for integrations

### State Management
- Shipment and route data loading
- Individual leg purchase states
- Success/error message handling
- Label generation progress tracking

### Performance Considerations
- Efficient API calls with proper loading states
- Batch operations for multiple labels
- Event-driven updates to minimize re-renders
- Optimistic UI updates for better UX

## Future Enhancements

1. **Real DHL API**: Replace simulation with actual DHL integration
2. **Label Printing**: Direct printer integration
3. **Customs Documentation**: Automatic customs form generation
4. **Cost Optimization**: Real-time rate shopping
5. **Delivery Scheduling**: Appointment booking integration
