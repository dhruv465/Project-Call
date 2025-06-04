const twilio = require('twilio');
const readline = require('readline');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create readline interface for input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Updates Twilio webhook URLs for voice applications
 */
async function updateTwilioWebhooks() {
  try {
    // Get Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID || await promptForInput('Enter your Twilio Account SID: ');
    const authToken = process.env.TWILIO_AUTH_TOKEN || await promptForInput('Enter your Twilio Auth Token: ');
    
    // Initialize Twilio client
    const client = twilio(accountSid, authToken);
    
    // Get base URL for webhooks
    const baseUrl = process.env.SERVER_BASE_URL || await promptForInput('Enter your server base URL (e.g., https://your-domain.com): ');
    
    console.log('\nFetching Twilio phone numbers...');
    
    // Get all phone numbers
    const incomingPhoneNumbers = await client.incomingPhoneNumbers.list();
    
    if (incomingPhoneNumbers.length === 0) {
      console.log('No phone numbers found in this Twilio account.');
      return;
    }
    
    console.log(`Found ${incomingPhoneNumbers.length} phone numbers:\n`);
    
    // Display phone numbers
    incomingPhoneNumbers.forEach((number, index) => {
      console.log(`${index + 1}. ${number.friendlyName} (${number.phoneNumber})`);
    });
    
    // Select a phone number to update
    const phoneIndex = await promptForInput('\nEnter the number to update webhooks for (or "all" for all numbers): ');
    
    let numbersToUpdate = [];
    if (phoneIndex.toLowerCase() === 'all') {
      numbersToUpdate = incomingPhoneNumbers;
    } else {
      const selectedNumber = incomingPhoneNumbers[parseInt(phoneIndex) - 1];
      if (!selectedNumber) {
        console.log('Invalid selection.');
        return;
      }
      numbersToUpdate = [selectedNumber];
    }
    
    // Configure webhook URLs
    const voiceUrl = `${baseUrl}/api/calls/voice-webhook`;
    const statusUrl = `${baseUrl}/api/calls/status-webhook`;
    
    console.log('\nUpdating webhook URLs to:');
    console.log(`Voice Webhook: ${voiceUrl}`);
    console.log(`Status Callback: ${statusUrl}`);
    
    // Update each selected number
    for (const number of numbersToUpdate) {
      await client.incomingPhoneNumbers(number.sid).update({
        voiceUrl: voiceUrl,
        voiceMethod: 'POST',
        statusCallback: statusUrl,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
      });
      
      console.log(`Updated ${number.friendlyName} (${number.phoneNumber})`);
    }
    
    console.log('\nNow configuring Twilio TwiML Apps...');
    
    // List TwiML apps
    const twimlApps = await client.applications.list();
    
    if (twimlApps.length === 0) {
      console.log('No TwiML apps found. Creating a new one...');
      
      // Create a new TwiML app
      const appName = await promptForInput('Enter a name for the new TwiML app: ');
      
      const newApp = await client.applications.create({
        friendlyName: appName,
        voiceUrl: voiceUrl,
        voiceMethod: 'POST',
        statusCallback: statusUrl,
        statusCallbackMethod: 'POST',
        voiceFallbackUrl: `${baseUrl}/api/calls/fallback-webhook`,
        voiceFallbackMethod: 'POST'
      });
      
      console.log(`Created new TwiML app: ${newApp.friendlyName} (${newApp.sid})`);
    } else {
      console.log(`Found ${twimlApps.length} TwiML apps:\n`);
      
      // Display TwiML apps
      twimlApps.forEach((app, index) => {
        console.log(`${index + 1}. ${app.friendlyName} (${app.sid})`);
      });
      
      // Select a TwiML app to update
      const appIndex = await promptForInput('\nEnter the number to update (or "all" for all apps): ');
      
      let appsToUpdate = [];
      if (appIndex.toLowerCase() === 'all') {
        appsToUpdate = twimlApps;
      } else {
        const selectedApp = twimlApps[parseInt(appIndex) - 1];
        if (!selectedApp) {
          console.log('Invalid selection.');
          return;
        }
        appsToUpdate = [selectedApp];
      }
      
      // Update each selected app
      for (const app of appsToUpdate) {
        await client.applications(app.sid).update({
          voiceUrl: voiceUrl,
          voiceMethod: 'POST',
          statusCallback: statusUrl,
          statusCallbackMethod: 'POST',
          voiceFallbackUrl: `${baseUrl}/api/calls/fallback-webhook`,
          voiceFallbackMethod: 'POST'
        });
        
        console.log(`Updated TwiML app: ${app.friendlyName} (${app.sid})`);
      }
    }
    
    console.log('\nWebhook configuration completed successfully!');
    console.log('\nIMPORTANT: Make sure your server is publicly accessible at the configured URL.');
    console.log('If using ngrok or a similar service, you\'ll need to update these webhooks when your URL changes.');
    
  } catch (error) {
    console.error('Error updating Twilio webhooks:');
    if (error.response) {
      console.error(`Status: ${error.status}`);
      console.error('Response:', error.message);
    } else {
      console.error(error.message);
    }
  } finally {
    rl.close();
  }
}

/**
 * Helper function to prompt for user input
 */
function promptForInput(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// Run the update function
updateTwilioWebhooks();
