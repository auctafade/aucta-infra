// test_route_calculation.js
// Simple test to debug route calculation

const RouteCalculationEngine = require('./lib/sprint8/routeCalculationEngine');
const HubPricingService = require('./lib/sprint8/hubPricingService');

async function testRouteCalculation() {
  console.log('🧪 Testing Route Calculation...\n');

  try {
    // Initialize services
    const routeEngine = new RouteCalculationEngine();
    const hubService = new HubPricingService();

    // Sample shipment data (based on our real shipment)
    const shipmentData = {
      shipment_id: 'test-shipment-123',
      assigned_tier: 3,
      declared_value: 450.00,
      weight: 0.4, // 400g in kg
      dimensions: { length: 30, width: 20, height: 10 },
      fragility: 'medium',
      sender_name: 'Tom Holland',
      sender_address: '123 Test Street',
      sender_city: 'London',
      sender_country: 'United Kingdom',
      buyer_name: 'Mila Bourel',
      buyer_address: '456 Test Avenue',
      buyer_city: 'Nice',
      buyer_country: 'France',
      sla_target_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      pickup_window_start: new Date().toISOString()
    };

    console.log('📦 Sample Shipment:', {
      tier: shipmentData.assigned_tier,
      from: `${shipmentData.sender_city}, ${shipmentData.sender_country}`,
      to: `${shipmentData.buyer_city}, ${shipmentData.buyer_country}`,
      value: `€${shipmentData.declared_value}`,
      weight: `${shipmentData.weight}kg`
    });

    // Get available hubs
    console.log('\n🏢 Getting available hubs...');
    const hubData = await hubService.getAvailableHubs(new Date());
    console.log(`Found ${hubData.length} available hubs`);
    
    if (hubData.length > 0) {
      console.log('Sample hubs:');
      hubData.slice(0, 3).forEach(hub => {
        console.log(`  - ${hub.hub_code} (${hub.city}): Auth €${hub.tier3_auth_fee}, NFC=${hub.nfc_stock}`);
      });
    }

    // Calculate routes
    console.log('\n🗺️  Calculating route options...');
    const routes = await routeEngine.calculateRouteOptions(shipmentData, hubData);
    
    console.log(`\n✅ Generated ${routes.length} route options:`);
    routes.forEach((route, index) => {
      console.log(`\n${index + 1}. ${route.label} (Grade ${route.grade})`);
      console.log(`   Hub ID: ${route.hubId?.id || 'N/A'}, Code: ${route.hubId?.hub_code || 'N/A'}`);
      console.log(`   Hub Cou: ${route.hubCou?.id || 'N/A'}, Code: ${route.hubCou?.hub_code || 'N/A'}`);
      console.log(`   Cost Total: €${route.costBreakdown?.total || 'N/A'}`);
      console.log(`   Cost Client: €${route.costBreakdown?.clientPrice || 'N/A'}`);
      console.log(`   Days: ${route.schedule?.totalDays || 'N/A'}`);
      console.log(`   Legs: ${route.legs?.length || 0}`);
      if (route.legs?.length > 0) {
        route.legs.forEach(leg => {
          console.log(`     - ${leg.type}: ${leg.from.city} → ${leg.to.city}`);
        });
      }
      if (route.warnings?.length > 0) {
        console.log(`   Warnings: ${route.warnings.join(', ')}`);
      }
    });

    console.log('\n🎉 Route calculation test completed successfully!');

  } catch (error) {
    console.error('\n❌ Route calculation test failed:');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testRouteCalculation();
