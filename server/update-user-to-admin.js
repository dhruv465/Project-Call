const mongoose = require('mongoose');
require('dotenv').config();

// User schema (simplified version for this script)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'manager', 'agent'], 
    default: 'agent' 
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function checkAndUpdateUserRole() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/project_call');
    console.log('Connected to MongoDB');

    // Find all users
    const users = await User.find({}).select('name email role');
    console.log('\nCurrent users and their roles:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - Role: ${user.role}`);
    });

    if (users.length === 0) {
      console.log('No users found in the database.');
      process.exit(0);
    }

    // Update the first user to admin role (you can modify this logic)
    const userToUpdate = users[0];
    
    if (userToUpdate.role !== 'admin') {
      await User.findByIdAndUpdate(userToUpdate._id, { role: 'admin' });
      console.log(`\n✅ Updated ${userToUpdate.email} role from '${userToUpdate.role}' to 'admin'`);
    } else {
      console.log(`\n✅ User ${userToUpdate.email} already has admin role`);
    }

    // Verify the update
    const updatedUser = await User.findById(userToUpdate._id);
    console.log(`\nVerification: ${updatedUser.email} now has role: ${updatedUser.role}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
checkAndUpdateUserRole();
