// Script to update user role to admin
const mongoose = require('mongoose');
require('dotenv').config();

// User schema (simplified)
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function updateUserRole() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/projectcall');
    console.log('Connected to MongoDB');

    // Get email from command line argument
    const email = process.argv[2];
    if (!email) {
      console.log('Usage: node update-user-role.js <email>');
      process.exit(1);
    }

    // Find and update user
    const user = await User.findOneAndUpdate(
      { email: email },
      { role: 'admin' },
      { new: true }
    );

    if (!user) {
      console.log(`User with email ${email} not found`);
    } else {
      console.log(`Successfully updated user ${user.name} (${user.email}) to admin role`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error updating user role:', error);
    process.exit(1);
  }
}

updateUserRole();
