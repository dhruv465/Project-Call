/**
 * Test script to verify Cloudinary configuration and uploads
 * This can help diagnose issues with Cloudinary integration
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Create a test audio file
const createTestAudioFile = () => {
  const testFilePath = path.join(__dirname, 'test-audio.txt');
  
  // Create a simple text file (can't create actual audio programmatically easily)
  fs.writeFileSync(testFilePath, 'This is a test audio file for Cloudinary upload testing.');
  
  return testFilePath;
};

// Test Cloudinary connectivity and uploads
const testCloudinaryUpload = async () => {
  console.log('========== CLOUDINARY CONFIGURATION TEST ==========');
  console.log('Checking Cloudinary configuration...');
  
  // Check if Cloudinary is configured
  if (!process.env.CLOUDINARY_CLOUD_NAME || 
      !process.env.CLOUDINARY_API_KEY || 
      !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Cloudinary environment variables missing or incomplete');
    console.log('Required variables:');
    console.log('- CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
    console.log('- CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('- CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');
    return false;
  }

  console.log('✅ Cloudinary environment variables are set');
  console.log(`Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  
  try {
    // Test API connectivity
    console.log('\nTesting Cloudinary API connectivity...');
    const account = await cloudinary.api.ping();
    console.log('✅ Cloudinary API is accessible:', account.status);
    
    // Create and upload a test file
    console.log('\nTesting file upload to Cloudinary...');
    const testFilePath = createTestAudioFile();
    console.log(`Created test file at: ${testFilePath}`);
    
    const uploadResult = await cloudinary.uploader.upload(testFilePath, {
      resource_type: 'raw',
      folder: 'voice-test',
      public_id: `test-upload-${Date.now()}`,
      overwrite: true
    });
    
    console.log('✅ File uploaded successfully to Cloudinary');
    console.log('URL:', uploadResult.secure_url);
    console.log('Size:', uploadResult.bytes, 'bytes');
    
    // Clean up test file
    fs.unlinkSync(testFilePath);
    console.log('✅ Test file cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Cloudinary test failed:', error.message);
    console.error('Error details:', error);
    return false;
  }
};

// Run the test
testCloudinaryUpload()
  .then(success => {
    console.log('\n========== TEST RESULTS ==========');
    if (success) {
      console.log('✅ Cloudinary is properly configured and working');
    } else {
      console.log('❌ Cloudinary test failed. Please check the configuration and errors above.');
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error during test:', error);
  });
