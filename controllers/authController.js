// server/controllers/authController.js
const User = require('../models/User');
const OTP = require('../models/OTP');
const generateOTP = require('../utils/generateOTP');
const sendEmail = require('../utils/sendEmail');
const { generateToken } = require('../utils/jwt');

// Request OTP
exports.requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    // Generate OTP
    const otp = generateOTP(6);

    // Delete existing OTPs for this email
    await OTP.deleteMany({ email });

    // Save new OTP
    await OTP.create({ email, otp });

    // Send OTP via email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Online Compiler - OTP Verification</h2>
        <p>Your One-Time Password (OTP) is:</p>
        <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: 'Your OTP for Online Compiler',
      html: emailHtml,
    });

    res.status(200).json({ 
      message: 'OTP sent to your email',
      email 
    });

  } catch (error) {
    console.error('Request OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

// Verify OTP and Login
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Find OTP record
    const otpRecord = await OTP.findOne({ email, otp });

    if (!otpRecord) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    // Find or create user
    let user = await User.findOne({ email });
    
    if (!user) {
      user = await User.create({ email, isVerified: true });
    } else {
      user.isVerified = true;
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate JWT
    const token = generateToken(user._id);

    // Set HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
      },
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Verification failed' });
  }
};

// Logout
exports.logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
};
