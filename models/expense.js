const mongoose = require("mongoose");

const ExpenseSchema = new mongoose.Schema({
    description: String,
    amount: Number,
    paidBy: {type: mongoose.Schema.Types.ObjectId, ref:'User'},
    splitAmong: [{ type: mongoose.Schema.Types.ObjectId, ref:'User'}],
    splits: [
        {
            user: {type: mongoose.Schema.Types.ObjectId, ref:'User'},
            amount: Number
        }
    ],
    groupId: {type: mongoose.Schema.Types.ObjectId, ref: 'Group'},
    createdAt: {type: Date, default: Date.now}
});

module.exports = mongoose.model('Expense', ExpenseSchema);