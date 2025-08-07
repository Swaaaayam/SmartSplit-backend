const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const User = require('../models/user');

router.get('/me', auth, (req, res) => {
  res.json({ msg: 'Access granted!', userId: req.user.id });
});

router.get('/all',auth, async (req, res) => {
    try {
        const users = await User.find().select('_id name email');
        res.json(users);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;

router.post('/search', auth, async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email }).select('_id name email');

    if (!user) return res.status(404).json({ msg: 'User not found' });

    res.json(user);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

