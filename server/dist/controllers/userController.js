"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = exports.updateUserProfile = exports.getUserProfile = exports.loginUser = exports.createUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const index_1 = require("../index");
const errorHandling_1 = require("../utils/errorHandling");
// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        // Check if user already exists
        const userExists = await User_1.default.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        // Create user
        const user = await User_1.default.create({
            name,
            email,
            password,
            role: role || 'agent',
        });
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '30d' });
        return res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token,
        });
    }
    catch (error) {
        index_1.logger.error('Error creating user:', error);
        return res.status(500).json({ message: 'Server error', error: (0, errorHandling_1.handleError)(error) });
    }
};
exports.createUser = createUser;
// @desc    Login user
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Check if user exists
        const user = await User_1.default.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Check if password matches
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '30d' });
        return res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token,
        });
    }
    catch (error) {
        index_1.logger.error('Error logging in user:', error);
        return res.status(500).json({ message: 'Server error', error: (0, errorHandling_1.handleError)(error) });
    }
};
exports.loginUser = loginUser;
// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        });
    }
    catch (error) {
        index_1.logger.error('Error getting user profile:', error);
        return res.status(500).json({ message: 'Server error', error: (0, errorHandling_1.handleError)(error) });
    }
};
exports.getUserProfile = getUserProfile;
// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const { name, email, password } = req.body;
        // Update fields
        if (name)
            user.name = name;
        if (email)
            user.email = email;
        if (password)
            user.password = password;
        // Save updated user
        const updatedUser = await user.save();
        // Generate new JWT token if email changed
        let token;
        if (email) {
            token = jsonwebtoken_1.default.sign({ id: updatedUser._id, email: updatedUser.email, role: updatedUser.role }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '30d' });
        }
        return res.status(200).json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            token: token || undefined,
        });
    }
    catch (error) {
        index_1.logger.error('Error updating user profile:', error);
        return res.status(500).json({ message: 'Server error', error: (0, errorHandling_1.handleError)(error) });
    }
};
exports.updateUserProfile = updateUserProfile;
// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to access this resource' });
        }
        const users = await User_1.default.find({}).select('-password');
        return res.status(200).json(users);
    }
    catch (error) {
        index_1.logger.error('Error getting all users:', error);
        return res.status(500).json({ message: 'Server error', error: (0, errorHandling_1.handleError)(error) });
    }
};
exports.getAllUsers = getAllUsers;
//# sourceMappingURL=userController.js.map