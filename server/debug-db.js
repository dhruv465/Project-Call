const mongoose = require('mongoose');

// Connect to MongoDB
async function connectAndCheck() {
  try {
    await mongoose.connect('mongodb://localhost:27017/lumina-outreach');
    console.log('Connected to MongoDB');
    
    // Get the Call collection
    const db = mongoose.connection.db;
    const callsCollection = db.collection('calls');
    
    // Count total calls
    const totalCalls = await callsCollection.countDocuments();
    console.log(`Total calls in database: ${totalCalls}`);
    
    // Get sample calls
    const sampleCalls = await callsCollection.find({}).limit(5).toArray();
    console.log('Sample calls:');
    sampleCalls.forEach((call, index) => {
      console.log(`Call ${index + 1}:`, {
        _id: call._id,
        status: call.status,
        outcome: call.outcome,
        createdAt: call.createdAt,
        startTime: call.startTime,
        scheduledAt: call.scheduledAt,
        duration: call.duration
      });
    });
    
    // Check date fields
    const callsWithStartTime = await callsCollection.countDocuments({ startTime: { $exists: true, $ne: null } });
    const callsWithCreatedAt = await callsCollection.countDocuments({ createdAt: { $exists: true, $ne: null } });
    const callsWithScheduledAt = await callsCollection.countDocuments({ scheduledAt: { $exists: true, $ne: null } });
    
    console.log(`\nDate field statistics:`);
    console.log(`Calls with startTime: ${callsWithStartTime}`);
    console.log(`Calls with createdAt: ${callsWithCreatedAt}`);
    console.log(`Calls with scheduledAt: ${callsWithScheduledAt}`);
    
    // Check status distribution
    const statusDistribution = await callsCollection.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    console.log('\nStatus distribution:', statusDistribution);
    
    // Check outcome distribution
    const outcomeDistribution = await callsCollection.aggregate([
      { $group: { _id: '$outcome', count: { $sum: 1 } } }
    ]).toArray();
    console.log('Outcome distribution:', outcomeDistribution);
    
    // Check completed calls specifically
    const completedCalls = await callsCollection.find({ status: 'completed' }).limit(10).toArray();
    console.log(`\nCompleted calls (${completedCalls.length}):`);
    completedCalls.forEach((call, index) => {
      console.log(`  ${index + 1}. Status: ${call.status}, Outcome: ${call.outcome}, Created: ${call.createdAt}`);
    });
    
    // Test the exact query used by unified analytics service
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const totalCallsLast30Days = await callsCollection.countDocuments({
      createdAt: { $gte: last30Days }
    });
    
    const successfulCallsLast30Days = await callsCollection.countDocuments({
      createdAt: { $gte: last30Days },
      status: 'completed',
      outcome: { $in: ['positive', 'interested', 'callback', 'success'] }
    });
    
    console.log(`\nLast 30 days analytics:`);
    console.log(`Total calls: ${totalCallsLast30Days}`);
    console.log(`Successful calls: ${successfulCallsLast30Days}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

connectAndCheck();
