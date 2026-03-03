const mongoose = require('mongoose');
const express = require('express');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

dotenv.config();

const seedUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const email = 'test@example.com';
        const password = 'password123';
        const name = 'Test User';

        let user = await User.findOne({ email });
        if (user) {
            console.log('Test user already exists');
            process.exit(0);
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();
        console.log('Test user created successfully');
        console.log('Email: test@example.com');
        console.log('Password: password123');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding database:', err);
        process.exit(1);
    }
};

seedUser();
