const Expense = require('../models/expense');
const Group = require('../models/group');

exports.addExpense = async (req, res) => {
    try{
        const { groupId, amount, description, splitAmong, paidBy, splitType, splits } = req.body;

        let finalSplits = [];

        if(splitType === "custom"){
          const total = splits.reduce((sum, entry) => sum + Number(entry.amount), 0);
          if(total !== Number(amount)) {
            return res.status(400).json({ msg:"Split amount must total the expense amount" });
          }
          finalSplits = splits.map(entry => ({
            user: entry.user,
            amount: Number(entry.amount)
          }));
        }
        else{
          const perPerson = Number(amount) / splitAmong.length;
          finalSplits = splitAmong.map(userId => ({
            user: userId,
            amount: perPerson
          }));
        }
        
        const newExpense = new Expense({
            groupId,
            paidBy,
            amount,
            description,
            splitAmong: finalSplits.map(e => e.user),
            splits: finalSplits
        });

        const savedExpense = await newExpense.save();

        await Group.findByIdAndUpdate(groupId, {
            $push: { expenses: savedExpense._id }
        });
        const populatedExpense = await Expense.findById(savedExpense._id)
          .populate('paidBy', 'name email')
          .populate('splits.user', 'name email');

        res.status(201).json({msg: "Expense added successfully", expense: populatedExpense });
    }
    catch(error){
        console.error("Add Expense Error:", error);
        res.status(500).json({ msg: "Server Error" });
    }
};

exports.getGroupExpenses = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { description = "", from, to } = req.query;

    const query = { groupId };

    if (description.trim()) {
      query.description = { $regex: description.trim(), $options: 'i' };
    }

    if (from) {
      query.createdAt = {
        ...query.createdAt,
        $gte: new Date(`${from}T00:00:00.000Z`)
      };
    }
    if (to) {
      query.createdAt = {
        ...query.createdAt,
        $lte: new Date(`${to}T23:59:59.999Z`)
      };
    }


    const expenses = await Expense.find(query)
      .populate('paidBy', 'name')
      .populate('splits.user', 'name')
      .sort({ createdAt: -1 });

    const group = await Group.findById(groupId).populate('members', 'name');

    res.status(200).json({
      groupName: group.groupName,
      expenses,
      members: group.members
    });
  } catch (err) {
    console.error("Get group expenses error:", err);
    res.status(500).json({ msg: "Server error while fetching group expenses" });
  }
};
