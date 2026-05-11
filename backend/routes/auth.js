const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const db = require('../database');

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate Google OAuth URL
router.get('/google', (req, res) => {
  // Debug: Log OAuth client configuration
  console.log('\n🔍 OAuth Configuration Check:');
  console.log('Client ID:', process.env.GOOGLE_CLIENT_ID ? 'Set ✅' : 'Missing ❌');
  console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Set ✅' : 'Missing ❌');
  console.log('Redirect URI:', process.env.GOOGLE_REDIRECT_URI);

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.file'
  ];

  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      response_type: 'code',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI
    });

    console.log('Generated Auth URL:', authUrl);
    console.log('');

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ 
      error: 'Failed to generate auth URL',
      details: error.message 
    });
  }
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('http://localhost:5173?error=no_code');
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    });

    const userInfo = await oauth2.userinfo.get();
    const { id, email, name, picture } = userInfo.data;

    // Check if user exists
    db.get('SELECT * FROM users WHERE google_id = ?', [id], (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.redirect('http://localhost:5173?error=db_error');
      }

      if (user) {
        // Update existing user's tokens
        const updateQuery = `
          UPDATE users 
          SET google_drive_token = ?, profile_image = ?
          WHERE google_id = ?
        `;
        
        db.run(updateQuery, [JSON.stringify(tokens), picture, id], (err) => {
          if (err) console.error('Error updating user:', err);
        });

        // Redirect with user data
        const userData = encodeURIComponent(JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          profileImage: picture,
          tokens: tokens,
          is_regular_faculty: user.is_regular_faculty !== null ? user.is_regular_faculty : 1,
          position: user.position || ''
        }));

        res.redirect(`http://localhost:5173/auth/success?user=${userData}`);
      } else {
        // Create new user
        const insertQuery = `
          INSERT INTO users (google_id, email, name, role, department, profile_image, google_drive_token)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        // Default role is professor, department extracted from email if @lspu.edu.ph
        const department = email.includes('@lspu.edu.ph') ? 'Computer Science' : '';
        const role = 'professor';

        db.run(insertQuery, [id, email, name, role, department, picture, JSON.stringify(tokens)], function(err) {
          if (err) {
            console.error('Error creating user:', err);
            return res.redirect('http://localhost:5173?error=user_creation_failed');
          }

          const userData = encodeURIComponent(JSON.stringify({
            id: this.lastID,
            email,
            name,
            role,
            department,
            profileImage: picture,
            tokens: tokens,
            is_regular_faculty: 1
          }));

          res.redirect(`http://localhost:5173/auth/success?user=${userData}`);
        });
      }
    });
  } catch (error) {
    console.error('OAuth error:', error);
    res.redirect('http://localhost:5173?error=auth_failed');
  }
});

// Get current user
router.get('/me', (req, res) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  db.get('SELECT id, email, name, role, department, profile_image, is_regular_faculty, position FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  });
});

// Logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;