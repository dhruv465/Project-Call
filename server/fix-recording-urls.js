const mongoose = require('mongoose');
require('dotenv').config();

// Call schema (simplified version for this script)
const callSchema = new mongoose.Schema({
  recordingUrl: String,
  metrics: {
    twilioRecordingUrl: String,
    callRecordingUrl: String
  }
}, { timestamps: true });

const Call = mongoose.model('Call', callSchema);

async function updateExistingCallUrls() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/project_call');
    console.log('Connected to MongoDB');

    // Find calls with Twilio recording URLs
    const callsWithTwilioUrls = await Call.find({ 
      recordingUrl: { $regex: /api\.twilio\.com/ } 
    });

    console.log(`\nFound ${callsWithTwilioUrls.length} calls with Twilio recording URLs`);

    for (const call of callsWithTwilioUrls) {
      const proxyUrl = `/api/calls/${call._id}/recording?stream=true`;
      const twilioUrl = call.recordingUrl;

      await Call.findByIdAndUpdate(call._id, {
        recordingUrl: proxyUrl,
        'metrics.callRecordingUrl': proxyUrl,
        'metrics.twilioRecordingUrl': twilioUrl
      });

      console.log(`✅ Updated call ${call._id} - changed from Twilio URL to proxy URL`);
    }

    console.log(`\n✅ Successfully updated ${callsWithTwilioUrls.length} calls`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
updateExistingCallUrls();
