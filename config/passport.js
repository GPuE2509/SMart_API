const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists with Google ID
      let user = await User.findOne({ googleId: profile.id });

      if (user) {
        // User exists, return user
        return done(null, user);
      }

      // Check if user exists with the same email
      user = await User.findOne({ email: profile.emails[0].value });

      if (user) {
        // User exists with email but no Google ID
        // Link Google account to existing user
        user.googleId = profile.id;
        user.isVerified = true; // Auto verify for Google users
        if (!user.avatar_url && profile.photos && profile.photos.length > 0) {
          user.avatar_url = profile.photos[0].value;
        }
        user.updated_at = new Date();
        await user.save();
        return done(null, user);
      }

      // Create new user
      const newUser = new User({
        googleId: profile.id,
        email: profile.emails[0].value,
        full_name: profile.displayName,
        avatar_url: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
        isVerified: true, // Auto verify for Google users
        role: 'customer',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      });

      await newUser.save();
      return done(null, newUser);
    } catch (error) {
      return done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
