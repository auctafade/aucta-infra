# Tag Inventory Alerts System (D)

## Overview
The alerts system provides real-time monitoring of hub stock levels and proactive resolution tools to prevent tag shortages and Tier 2 job stalls.

## Alert Types

### 1. Stock Threshold Alerts
- **Trigger**: `free_stock < threshold`
- **Severity**: Warning (< threshold), Critical (< 50% of threshold)
- **Description**: Shows current stock vs. threshold with shortfall calculation

### 2. Days of Cover Alerts  
- **Trigger**: `days_of_cover < alert_threshold` (default: 14 days)
- **Severity**: Warning (< 14 days), Critical (< 7 days)
- **Description**: Shows remaining days based on current burn rate

### 3. No Recent Usage Alerts
- **Trigger**: `burn_rate_7d = 0` AND `recent_usage = false`
- **Severity**: Info
- **Description**: Flags hubs with no tag applications in last 7 days

## Calculations (Transparent Formulas)

### Burn Rate 7d
```
burn_rate_7d = total_tags_applied_last_7_days ÷ 7
```

### Burn Rate 30d
```
burn_rate_30d = total_tags_applied_last_30_days ÷ 30
```

### Days of Cover
```
days_of_cover = free_stock ÷ burn_rate_7d
```
- Shows "∞" when `burn_rate_7d = 0` (no recent usage)

### Upcoming Demand
```
upcoming_demand = count_of_T2_shipments_planned_for_hub_within_window
```

## User Interface

### Alert Banner
- **Collapsed View**: Shows summary badges with hub names and key metrics
- **Expanded View**: Full alert details with metrics, tooltips, and actions
- **Dismissible**: Users can hide alerts banner
- **Auto-updates**: Recalculates on data changes (no full reload needed)

### Tooltips
All calculations show transparent formulas on hover:
- Current Stock: "Free stock available for assignment"
- Burn Rate (7d): "Formula: Total tags applied in last 7 days ÷ 7"
- Days of Cover: "Formula: Free stock ÷ Burn rate (7d)"
- Upcoming Demand: "Count of T2 shipments planned for this Hub in next 7 days"

## Alert Actions

### Create Transfer (Primary CTA)
- **Pre-fills Transfer Modal** with:
  - Destination Hub: Alert hub
  - Source Hub: Hub with sufficient free stock
  - Suggested Quantity: Alert shortfall amount
  - Reason: "stock_balancing"
- **Smart Suggestions**: Calculates optimal transfer amounts
- **Resolves Alert**: Creating transfer clears related dashboard alerts

### Adjust Threshold
- **Secondary Action**: For stock threshold alerts
- **Opens Threshold Modal**: Allows ops to modify hub threshold
- **Immediate Effect**: Updated threshold recalculates alerts

### Dismiss Alert
- **Manual Resolution**: Marks alert as resolved
- **Dashboard Integration**: Clears corresponding dashboard alerts
- **Audit Trail**: Logs dismissal with user and timestamp

## Alert Resolution

### Automatic Resolution
- **Transfer Created**: Alert automatically resolves when transfer satisfies shortfall
- **Stock Updated**: Real-time recalculation when stock levels change
- **Threshold Adjusted**: Alert resolves if new threshold eliminates condition

### Dashboard Integration
- **Bi-directional Sync**: Resolving here clears dashboard alerts
- **Real-time Updates**: No page refresh required
- **Notification System**: Ready for WebSocket integration

## Current Demo Data

### Paris Hub (Healthy)
- Stock: 1,250 free vs. 500 threshold ✅
- Days of Cover: ~28 days ✅
- Burn Rate: 45/day (7d), 38/day (30d)

### London Hub (Warning - Triggers Alerts)
- Stock: 420 free vs. 600 threshold ⚠️ **ALERT**
- Days of Cover: ~8 days ⚠️ **ALERT** 
- Burn Rate: 52/day (7d), 49/day (30d)
- Shortfall: 180 tags

## Technical Implementation

### Real-time Calculations
- **No Backend Calls**: All calculations done client-side
- **Reactive Updates**: Alerts recalculate on state changes
- **Performance Optimized**: Calculations cached and memoized

### Integration Points
- **Transfer Modal**: Pre-fills from alert context
- **Hub Console**: Status sync ready
- **Dashboard**: Alert clearing API hooks
- **Tier Gate**: Reserved tag visibility

### Future Enhancements
- **WebSocket Integration**: Real-time updates across users
- **Machine Learning**: Predictive demand forecasting
- **Email Notifications**: Alert escalation system
- **Mobile Alerts**: Push notification support

