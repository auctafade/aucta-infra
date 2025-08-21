# Sprint 8: Logistics & Authentication

## Overview
A comprehensive global layout system with side navigation, role-based access control (RBAC), and logistics management capabilities.

## Goal
Create the visual and functional frame shared across all pages with a focus on logistics operations and user authentication.

## Deliverables

### ✅ Topbar
- **Logo**: AUCTA branding with blue accent
- **Global Search**: Shipments, contacts, UID search functionality
- **Clock**: Real-time clock with date display
- **Avatar**: User menu with profile and logout options

### ✅ Side Navigation (Collapsible)
- **Sections**: Logistics, Inventory, People, Billing, Settings
- **Submenus**: Detailed navigation with icons and badges
- **Badges**: Counters for pending items and notifications
- **Active State**: Visual indication of current page
- **Collapsible**: Toggle between full and compact views

### ✅ Content Area
- **Breadcrumb**: Navigation hierarchy
- **Page Title**: Clear page identification
- **Primary Actions**: CTA buttons aligned to the right

### ✅ Notifications
- **Toasts**: Success messages and alerts
- **Alert Center**: Incidents, SLA, and stock notifications
- **Priority Levels**: High, medium, low with color coding

### ✅ RBAC (Role-Based Access Control)
- **Roles**: ops_admin, hub_tech, wg_operator, exec
- **Section Hiding**: Menu items filtered by user permissions
- **Dynamic Navigation**: Content adapts to user role

### ✅ UX States
- **Skeleton Loading**: Placeholder content during data fetch
- **Empty State**: Educational content when no data
- **Error State**: Retry actions and error handling

## Route Tree (v1)

### Logistics
- `/logistics/dashboard` - Main overview and metrics
- `/logistics/new` - Create new shipments
- `/logistics/classify/:shipmentId` - Tier classification (Tier Gate)
- `/logistics/plan/:shipmentId` - Quote & planning
- `/logistics/wg/:shipmentId` - WG scheduling
- `/logistics/dhl/:shipmentId` - Label generation
- `/logistics/hub` - Hub console (list & detail)
- `/logistics/incidents` - Issue tracking and management

### Inventory
- `/inventory/tags` - Tag management
- `/inventory/nfc` - NFC chip inventory

### People
- `/people/contacts` - Contact management

### Billing
- `/billing/quotes` - Quote management

### Settings
- `/settings/sla-margins` - SLA and margin configuration
- `/settings/hub-capacity` - Hub capacity management
- `/settings/thresholds-risk` - Risk thresholds and alerts

## Technical Implementation

### Components
- **Topbar**: Fixed header with search, clock, and user controls
- **Sidebar**: Collapsible navigation with role-based filtering
- **Content Area**: Main content with breadcrumbs and actions
- **Notifications**: Toast system and alert center
- **Dashboard**: Metrics grid and data tables

### State Management
- **Sidebar Collapse**: Toggle between full and compact views
- **Active Navigation**: Track current page and section
- **User Role**: Mock user with role-based permissions
- **Notifications**: Real-time notification system

### Responsive Design
- **Mobile First**: Responsive grid layouts
- **Collapsible Sidebar**: Adaptive navigation for small screens
- **Touch Friendly**: Optimized for mobile interactions

### Accessibility
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: ARIA labels and semantic HTML
- **Color Contrast**: WCAG compliant color schemes
- **Focus Management**: Clear focus indicators

## Mock Data

### User Roles
- **ops_admin**: Full access to all features
- **hub_tech**: Logistics and inventory access
- **wg_operator**: Limited logistics and people access
- **exec**: High-level overview and billing access

### Sample Data
- **Shipments**: Mock shipment data with status tracking
- **Notifications**: Sample alerts and updates
- **Metrics**: Dashboard statistics and KPIs

## Future Enhancements

### Phase 2
- **Real-time Updates**: WebSocket integration for live data
- **Advanced Search**: Elasticsearch integration
- **Mobile App**: React Native companion app
- **API Integration**: Backend service connections

### Phase 3
- **Analytics Dashboard**: Advanced reporting and insights
- **Workflow Automation**: Process automation and approvals
- **Multi-language**: Internationalization support
- **Dark Mode**: Theme switching capability

## Getting Started

1. Navigate to `/sprint-8/logistics`
2. Explore the navigation structure
3. Test the collapsible sidebar
4. View role-based access control
5. Interact with notifications and alerts

## Dependencies

- **Next.js 14**: React framework
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **TypeScript**: Type safety and development experience

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- **Lazy Loading**: Components loaded on demand
- **Optimized Rendering**: Efficient React rendering
- **Minimal Bundle**: Tree-shaking for unused code
- **Fast Navigation**: Client-side routing

---

*Built with ❤️ for AUCTA Logistics & Authentication System*
