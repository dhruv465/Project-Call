#!/usr/bin/env node

/**
 * Test script to verify voice selection saving functionality
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:8000';

async function testVoiceSelectionSaving() {
  console.log('🧪 Testing Voice Selection Saving Functionality\n');

  try {
    // 1. Get current configuration
    console.log('1️⃣ Fetching current configuration...');
    const configResponse = await axios.get(`${SERVER_URL}/api/configuration`);
    const currentConfig = configResponse.data;
    
    console.log('Current elevenLabsConfig:', {
      apiKey: currentConfig.elevenLabsConfig?.apiKey ? 'SET' : 'NOT SET',
      selectedVoiceId: currentConfig.elevenLabsConfig?.selectedVoiceId || 'NOT SET',
      availableVoices: currentConfig.elevenLabsConfig?.availableVoices?.length || 0,
      isEnabled: currentConfig.elevenLabsConfig?.isEnabled || false
    });

    // 2. Create a test configuration update with a selectedVoiceId
    const testVoiceId = 'test-voice-id-12345';
    const testApiKey = currentConfig.elevenLabsConfig?.apiKey || 'test-api-key-for-testing';
    
    console.log('\n2️⃣ Testing voice selection update...');
    console.log(`Setting selectedVoiceId to: ${testVoiceId}`);

    const updatePayload = {
      elevenLabsConfig: {
        apiKey: testApiKey,
        selectedVoiceId: testVoiceId,
        isEnabled: true,
        voiceSpeed: 1.0,
        voiceStability: 0.8,
        voiceClarity: 0.9,
        availableVoices: [
          {
            voiceId: testVoiceId,
            name: 'Test Voice',
            previewUrl: 'https://example.com/preview.mp3'
          }
        ]
      }
    };

    // 3. Send update request
    const updateResponse = await axios.put(`${SERVER_URL}/api/configuration`, updatePayload);
    
    if (updateResponse.status === 200) {
      console.log('✅ Configuration update successful');
    } else {
      console.log('❌ Configuration update failed:', updateResponse.status);
      return;
    }

    // 4. Verify the selectedVoiceId was saved
    console.log('\n3️⃣ Verifying selectedVoiceId was saved...');
    const verifyResponse = await axios.get(`${SERVER_URL}/api/configuration`);
    const updatedConfig = verifyResponse.data;
    
    const savedVoiceId = updatedConfig.elevenLabsConfig?.selectedVoiceId;
    
    if (savedVoiceId === testVoiceId) {
      console.log('✅ SUCCESS: selectedVoiceId was properly saved!');
      console.log(`   Saved value: ${savedVoiceId}`);
    } else {
      console.log('❌ FAILURE: selectedVoiceId was not saved properly');
      console.log(`   Expected: ${testVoiceId}`);
      console.log(`   Got: ${savedVoiceId}`);
    }

    // 5. Show final state
    console.log('\n4️⃣ Final configuration state:');
    console.log('Updated elevenLabsConfig:', {
      apiKey: updatedConfig.elevenLabsConfig?.apiKey ? 'SET' : 'NOT SET',
      selectedVoiceId: updatedConfig.elevenLabsConfig?.selectedVoiceId || 'NOT SET',
      availableVoices: updatedConfig.elevenLabsConfig?.availableVoices?.length || 0,
      isEnabled: updatedConfig.elevenLabsConfig?.isEnabled || false
    });

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testVoiceSelectionSaving();
