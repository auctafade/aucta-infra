#!/usr/bin/env node

const http = require('http');

// Test both backend and frontend APIs
async function testAPI(url, description) {
    return new Promise((resolve) => {
        console.log(`\n🧪 Testing: ${description}`);
        console.log(`📡 URL: ${url}`);
        
        const request = http.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    console.log(`✅ Status: ${res.statusCode}`);
                    console.log(`📊 Response: ${JSON.stringify(parsed, null, 2)}`);
                    resolve({ success: true, data: parsed, status: res.statusCode });
                } catch (e) {
                    console.log(`❌ Parse Error: ${e.message}`);
                    console.log(`📄 Raw: ${data.substring(0, 200)}...`);
                    resolve({ success: false, error: e.message, raw: data });
                }
            });
        });
        
        request.on('error', (error) => {
            console.log(`❌ Request Error: ${error.message}`);
            resolve({ success: false, error: error.message });
        });
        
        request.setTimeout(5000, () => {
            console.log(`❌ Timeout`);
            request.destroy();
            resolve({ success: false, error: 'Timeout' });
        });
    });
}

async function runTests() {
    console.log('🚀 AUCTA Hub Management System - Complete Integration Test');
    console.log('=' .repeat(60));
    
    // Test 1: Backend API Direct
    const backendTest = await testAPI(
        'http://localhost:4000/api/hubs',
        'Backend API Direct (/api/hubs)'
    );
    
    // Test 2: Frontend API Proxy
    const frontendTest = await testAPI(
        'http://localhost:3000/api/hubs', 
        'Frontend API Proxy (/api/hubs)'
    );
    
    // Test 3: Frontend App Status
    const appTest = await testAPI(
        'http://localhost:3000', 
        'Frontend Application Root'
    );
    
    console.log('\n' + '=' .repeat(60));
    console.log('📋 SUMMARY:');
    console.log('=' .repeat(60));
    
    console.log(`🔧 Backend API: ${backendTest.success ? '✅ Working' : '❌ Failed'}`);
    console.log(`🌐 Frontend Proxy: ${frontendTest.success ? '✅ Working' : '❌ Failed'}`);
    console.log(`📱 Frontend App: ${appTest.success ? '✅ Working' : '❌ Failed'}`);
    
    if (backendTest.success && frontendTest.success) {
        console.log('\n🎉 SUCCESS: All systems operational!');
        console.log('🏠 Hub Management: http://localhost:3000/sprint-8/logistics/hub/management');
    } else {
        console.log('\n⚠️  Some issues detected. Check logs above.');
    }
}

runTests().catch(console.error);
