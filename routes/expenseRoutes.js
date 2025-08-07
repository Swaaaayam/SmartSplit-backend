const express = require('express');
const router = express.Router();
const { addExpense, getGroupExpenses } = require('../controllers/expenseController');
const authMiddleware = require('../middleware/auth');

router.post('/create', authMiddleware, addExpense);
router.get('/groups/:groupId', authMiddleware, getGroupExpenses);

module.exports = router;