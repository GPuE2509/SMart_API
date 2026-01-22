const jwt = require('jsonwebtoken');
const users = require('../models/User');
const bcrypt = require('bcrypt');

const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

const generateToken = (user) => {
    const token = jwt.sign({ userId: user._id}, process.env.JWT_SECRET, {
        expiresIn: '6h'
    });
    return token;
};

exports.verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

exports.signup = async (userData) => {
    try {
        const {full_name, email, password, phone} = userData;

        // Check if user already exists
        const existingUser = await users.findOne({ email });
        if (existingUser) {
            throw new Error('Email already exists');
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create new user
        const user = new users({
            full_name,
            email,
            password: hashedPassword,
            phone,
            created_at: new Date(),
            updated_at: new Date()
        });

        const savedUser = await user.save();
        
        // Remove password from response
        const userResponse = savedUser._id
        return userResponse;
    } catch (error) {
        throw error;
    }
};

exports.signin = async (email, password) => {
    try {
        const user = await users.findOne({ email });
        if (!user) {
            throw new Error('Email hoặc mật khẩu không đúng');
        }

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Email hoặc mật khẩu không đúng');
        }

        const token = generateToken(user);

        const userResponse = user.toObject();
        delete userResponse.password;

        return {
            token,
            user: userResponse
        };
    } catch (error) {
        throw error;
    }
};
