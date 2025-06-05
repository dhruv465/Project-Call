const mongoose = require('mongoose');

async function createTestData() {
  try {
    await mongoose.connect('mongodb://localhost:27017/lumina-outreach');
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const callsCollection = db.collection('calls');
    const leadsCollection = db.collection('leads');
    const campaignsCollection = db.collection('campaigns');
    
    // First, let's check if we have leads and campaigns
    const leadCount = await leadsCollection.countDocuments();
    const campaignCount = await campaignsCollection.countDocuments();
    
    console.log(`Existing leads: ${leadCount}, campaigns: ${campaignCount}`);
    
    // Get existing lead and campaign IDs
    const existingLead = await leadsCollection.findOne();
    const existingCampaign = await campaignsCollection.findOne();
    
    if (!existingLead || !existingCampaign) {
      console.log('Need to create a lead and campaign first...');
      
      // Create a test lead if none exists
      let leadId;
      if (!existingLead) {
        const testLead = await leadsCollection.insertOne({
          name: 'Test Lead',
          email: 'test@example.com',
          phoneNumber: '+1234567890',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        leadId = testLead.insertedId;
        console.log('Created test lead:', leadId);
      } else {
        leadId = existingLead._id;
      }
      
      // Create a test campaign if none exists
      let campaignId;
      if (!existingCampaign) {
        const testCampaign = await campaignsCollection.insertOne({
          name: 'Test Campaign',
          description: 'Test campaign for analytics',
          status: 'active',
          script: 'Hello, this is a test call.',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        campaignId = testCampaign.insertedId;
        console.log('Created test campaign:', campaignId);
      } else {
        campaignId = existingCampaign._id;
      }
      
      // Now create test calls with various statuses and outcomes
      const testCalls = [];
      const now = new Date();
      
      // Create calls from the last 7 days
      for (let i = 0; i < 20; i++) {
        const callDate = new Date(now.getTime() - (Math.random() * 7 * 24 * 60 * 60 * 1000));
        const startTime = new Date(callDate.getTime() + 1000);
        const endTime = new Date(startTime.getTime() + (Math.random() * 300 + 60) * 1000); // 1-6 minutes
        
        const statuses = ['completed', 'completed', 'completed', 'failed', 'no-answer', 'busy'];
        const outcomes = ['positive', 'interested', 'callback', 'not-interested', 'no-answer', 'busy'];
        
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        let outcome = null;
        
        if (status === 'completed') {
          outcome = outcomes[Math.floor(Math.random() * 4)]; // Only positive outcomes for completed calls
        } else {
          outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
        }
        
        const call = {
          leadId: leadId,
          campaignId: campaignId,
          phoneNumber: '+1234567890',
          status: status,
          outcome: outcome,
          priority: 'medium',
          scheduledAt: callDate,
          startTime: status === 'completed' ? startTime : null,
          endTime: status === 'completed' ? endTime : null,
          duration: status === 'completed' ? Math.floor((endTime - startTime) / 1000) : null,
          createdAt: callDate,
          updatedAt: status === 'completed' ? endTime : callDate,
          maxRetries: 3,
          retryCount: 0,
          recordCall: false
        };
        
        testCalls.push(call);
      }
      
      // Insert the test calls
      const result = await callsCollection.insertMany(testCalls);
      console.log(`Created ${result.insertedCount} test calls`);
      
      // Show summary
      const statusSummary = await callsCollection.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray();
      
      const outcomeSummary = await callsCollection.aggregate([
        { $match: { outcome: { $ne: null } } },
        { $group: { _id: '$outcome', count: { $sum: 1 } } }
      ]).toArray();
      
      console.log('Status summary:', statusSummary);
      console.log('Outcome summary:', outcomeSummary);
      
      // Test analytics queries
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      
      const totalCalls = await callsCollection.countDocuments({
        createdAt: { $gte: last30Days }
      });
      
      const successfulCalls = await callsCollection.countDocuments({
        createdAt: { $gte: last30Days },
        status: 'completed',
        outcome: { $in: ['positive', 'interested', 'callback', 'success'] }
      });
      
      console.log(`\nAnalytics test:`);
      console.log(`Total calls (last 30 days): ${totalCalls}`);
      console.log(`Successful calls (last 30 days): ${successfulCalls}`);
      console.log(`Success rate: ${totalCalls > 0 ? (successfulCalls / totalCalls * 100).toFixed(1) : 0}%`);
      
    } else {
      console.log('Using existing lead and campaign IDs');
      console.log('Lead ID:', existingLead._id);
      console.log('Campaign ID:', existingCampaign._id);
      
      // Create test calls using existing IDs
      const leadId = existingLead._id;
      const campaignId = existingCampaign._id;
      
      const testCalls = [];
      const now = new Date();
      
      // Create calls from the last 7 days
      for (let i = 0; i < 20; i++) {
        const callDate = new Date(now.getTime() - (Math.random() * 7 * 24 * 60 * 60 * 1000));
        const startTime = new Date(callDate.getTime() + 1000);
        const endTime = new Date(startTime.getTime() + (Math.random() * 300 + 60) * 1000); // 1-6 minutes
        
        const statuses = ['completed', 'completed', 'completed', 'failed', 'no-answer', 'busy'];
        const outcomes = ['positive', 'interested', 'callback', 'not-interested', 'no-answer', 'busy'];
        
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        let outcome = null;
        
        if (status === 'completed') {
          outcome = outcomes[Math.floor(Math.random() * 4)]; // Only positive outcomes for completed calls
        } else {
          outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
        }
        
        const call = {
          leadId: leadId,
          campaignId: campaignId,
          phoneNumber: '+1234567890',
          status: status,
          outcome: outcome,
          priority: 'medium',
          scheduledAt: callDate,
          startTime: status === 'completed' ? startTime : null,
          endTime: status === 'completed' ? endTime : null,
          duration: status === 'completed' ? Math.floor((endTime - startTime) / 1000) : null,
          createdAt: callDate,
          updatedAt: status === 'completed' ? endTime : callDate,
          maxRetries: 3,
          retryCount: 0,
          recordCall: false
        };
        
        testCalls.push(call);
      }
      
      // Insert the test calls
      const result = await callsCollection.insertMany(testCalls);
      console.log(`Created ${result.insertedCount} test calls`);
      
      // Show summary
      const statusSummary = await callsCollection.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray();
      
      const outcomeSummary = await callsCollection.aggregate([
        { $match: { outcome: { $ne: null } } },
        { $group: { _id: '$outcome', count: { $sum: 1 } } }
      ]).toArray();
      
      console.log('Status summary:', statusSummary);
      console.log('Outcome summary:', outcomeSummary);
      
      // Test analytics queries
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      
      const totalCalls = await callsCollection.countDocuments({
        createdAt: { $gte: last30Days }
      });
      
      const successfulCalls = await callsCollection.countDocuments({
        createdAt: { $gte: last30Days },
        status: 'completed',
        outcome: { $in: ['positive', 'interested', 'callback', 'success'] }
      });
      
      console.log(`\nAnalytics test:`);
      console.log(`Total calls (last 30 days): ${totalCalls}`);
      console.log(`Successful calls (last 30 days): ${successfulCalls}`);
      console.log(`Success rate: ${totalCalls > 0 ? (successfulCalls / totalCalls * 100).toFixed(1) : 0}%`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createTestData();
