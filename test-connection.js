/**
 * Test script to verify WebSocket Bridge is working
 * Run with: node test-connection.js
 */

import 'dotenv/config';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const TEST_USER_ID = process.env.TEST_USER_ID || 'lance@lwk.space';

async function testHealthCheck() {
  console.log('\n🔍 Testing health check...');
  
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Health check passed');
      console.log('   Status:', data.status);
      console.log('   Uptime:', data.uptime.toFixed(2), 'seconds');
      console.log('   Active sessions:', data.activeSessions);
      return true;
    } else {
      console.error('❌ Health check failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Health check error:', error.message);
    return false;
  }
}

async function testStartWebSocket() {
  console.log('\n🔌 Testing WebSocket start...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/start-websocket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEST_USER_ID }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ WebSocket started successfully');
      console.log('   Account ID:', data.accountId);
      console.log('   Is Demo:', data.isDemo);
      return true;
    } else {
      console.error('❌ WebSocket start failed:', data.error || 'Unknown error');
      
      if (data.error?.includes('No cTrader configuration')) {
        console.log('\n💡 Tip: Make sure you\'ve connected cTrader in mahSpeccy Settings first!');
      }
      
      return false;
    }
  } catch (error) {
    console.error('❌ WebSocket start error:', error.message);
    return false;
  }
}

async function testWebSocketStatus() {
  console.log('\n📊 Testing WebSocket status...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/websocket-status/${TEST_USER_ID}`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ WebSocket status retrieved');
      console.log('   Connected:', data.connected);
      
      if (data.connected) {
        console.log('   Account ID:', data.accountId);
        console.log('   Balance:', data.balance);
        console.log('   Equity:', data.equity);
        console.log('   Positions:', data.positions);
        console.log('   Last Update:', data.lastUpdate);
      }
      
      return true;
    } else {
      console.error('❌ WebSocket status failed');
      return false;
    }
  } catch (error) {
    console.error('❌ WebSocket status error:', error.message);
    return false;
  }
}

async function testSessions() {
  console.log('\n📋 Testing sessions list...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/sessions`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Sessions retrieved');
      console.log('   Total sessions:', data.total);
      
      if (data.sessions.length > 0) {
        data.sessions.forEach((session, i) => {
          console.log(`\n   Session ${i + 1}:`);
          console.log('     User ID:', session.userId);
          console.log('     Connected:', session.isConnected);
          console.log('     Account ID:', session.accountId);
          console.log('     Balance:', session.balance);
          console.log('     Positions:', session.positions);
        });
      }
      
      return true;
    } else {
      console.error('❌ Sessions failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Sessions error:', error.message);
    return false;
  }
}

async function testStopWebSocket() {
  console.log('\n🛑 Testing WebSocket stop...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/stop-websocket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEST_USER_ID }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ WebSocket stopped successfully');
      console.log('   Was Connected:', data.wasConnected);
      return true;
    } else {
      console.error('❌ WebSocket stop failed');
      return false;
    }
  } catch (error) {
    console.error('❌ WebSocket stop error:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   🧪 mahSpeccy WebSocket Bridge Test Suite                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('\n📍 Server URL:', SERVER_URL);
  console.log('👤 Test User:', TEST_USER_ID);
  
  const results = {
    healthCheck: false,
    startWebSocket: false,
    webSocketStatus: false,
    sessions: false,
    stopWebSocket: false,
  };
  
  // Run tests
  results.healthCheck = await testHealthCheck();
  
  if (results.healthCheck) {
    results.startWebSocket = await testStartWebSocket();
    
    if (results.startWebSocket) {
      // Wait a bit for connection to establish
      console.log('\n⏳ Waiting 3 seconds for connection to establish...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      results.webSocketStatus = await testWebSocketStatus();
      results.sessions = await testSessions();
      results.stopWebSocket = await testStopWebSocket();
    }
  }
  
  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   📊 Test Results                                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test}`);
  });
  
  console.log(`\n${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! WebSocket Bridge is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }
  
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Test suite error:', error);
  process.exit(1);
});
