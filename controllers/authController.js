const authService = require('../services/authService');

const mongoose = require('mongoose');

exports.signin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'email and password are required'
            });
        }

        const result = await authService.signin(email, password);

        res.status(200).json({
            message: 'Login successful',
            token: result.token
        });
    } catch (error) {
        if (error.message === 'Invalid credentials') {
            return res.status(401).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Failed to login',
            error: error.message
        });
    }
};

exports.signup = async (req, res) => {
    try {
        const { full_name, email, password, phone } = req.body;

        if (!email || !password || !phone || !full_name) {
            return res.status(400).json({
                message: 'full_name, phone, email and password are required'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: 'Please provide a valid email address'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: 'Password must be at least 6 characters long'
            });
        }

        const user = await authService.signup({ full_name, email, password, phone });

        res.status(201).json({
            message: 'Registrasion successfully',
            userId: user
        });
    } catch (error) {
        if (error.message === 'Email already exists') {
            return res.status(409).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Failed to register user',
            error: error.message
        });
    }
};
