const Group = require('../models/group');
const User = require('../models/user');
const Expense = require('../models/expense');
const Settlement = require('../models/settlement');
const mongoose = require('mongoose');


exports.createGroup = async (req, res) => {
    try {
        
        console.log("User ID:", req.user.id);
        console.log("Request Body:", req.body);
        
        const { groupName, members = [] } = req.body; 
        const userId = req.user.id;
        const trimmedName = groupName.trim();
        if (!groupName || !groupName.trim()) {
            return res.status(400).json({ msg: "Group name is required" });
        }

        if (!trimmedName) {
        return res.status(400).json({ msg: 'Group name is required' });
        }

        if (!members.includes(userId)) members.push(userId);

        if (members.length > 0) {
            const allUsers = await User.find({ _id: { $in: members } });
            if (allUsers.length !== members.length) {
                return res.status(400).json({ msg: "One or more member IDs are invalid" });
            }
        }

        const newGroup = new Group({
            groupName: trimmedName, 
            members: Array.from(new Set([...members, req.user.id])),
            createdBy: userId
        });

        await newGroup.save();

        res.status(201).json({ msg: 'Group created successfully', group: newGroup });
    } catch (err) {
        console.error('Create Group Error:', err);
        res.status(500).json({ msg: 'Server Error!' });
    }
};

exports.getUserGroups = async (req, res) => {
    try {
        const userId = req.user.id;
        const groups = await Group.find({ members: userId });
        res.json(groups);
    } catch(err){
        console.error("Get groups error:", err);
        res.status(500).json({msg: "Server error while fetchinf groups"});
    }
};

exports.getGroupBalances = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ msg: "Invalid group ID" });
    }

    const group = await Group.findById(groupId).populate('members', 'name email');
    if (!group) return res.status(404).json({ msg: "Group not found!" });

    const expenses = await Expense.find({ groupId });
    const settlements = await Settlement.find({ groupId });

    const balances = {};
    group.members.forEach(member => {
      balances[member._id.toString()] = {
        name: member.name,
        balance: 0
      };
    });

    expenses.forEach(exp => {
      const payer = exp.paidBy.toString();
      exp.splits.forEach(({ user, amount }) => {
        const uid = user.toString();
        if (uid !== payer) {
          balances[uid].balance -= amount;
          balances[payer].balance += amount;
        }
      });
    });

    settlements.forEach(settlement => {
      const paidBy = settlement.paidBy.toString(); 
      const paidTo = settlement.paidTo.toString(); 
      balances[paidBy].balance += settlement.amount; 
      balances[paidTo].balance -= settlement.amount; 
    });

    const result = [];
    for (let [userId, bal] of Object.entries(balances)) {
      const roundedBalance = Math.round(bal.balance * 100) / 100;

      if (roundedBalance !== 0) {
        result.push({
          user: bal.name,
          balance: roundedBalance,
          status: roundedBalance > 0 ? 'gets' : 'owes'
        });
      }
    }

    res.json({ balances: result });
  } catch (err) {
    console.error("Error calculating balances:", err);
    res.status(500).json({ msg: "Error calculating balances" });
  }
};

exports.getUserBalances = async (req, res) => {
  const { groupId, userId } = req.params;
  try {
    const expenses = await Expense.find({ groupId });
    const settlements = await Settlement.find({ groupId }); 
    const userMap = {};

    expenses.forEach(exp => {
      const payer = exp.paidBy.toString();
      exp.splits.forEach(({ user, amount }) => {
        const uid = user.toString();
        if (uid === userId && uid !== payer) {
          userMap[payer] = (userMap[payer] || 0) - amount;
        } else if (payer === userId && uid !== userId) {
          userMap[uid] = (userMap[uid] || 0) + amount;
        }
      });
    });

    settlements.forEach(settlement => {
      const paidBy = settlement.paidBy.toString(); 
      const paidTo = settlement.paidTo.toString(); 

      if (paidBy === userId) { 
        userMap[paidTo] = (userMap[paidTo] || 0) + settlement.amount; 
      } else if (paidTo === userId) { 
        userMap[paidBy] = (userMap[paidBy] || 0) - settlement.amount; 
      }
    });

    const userIds = Object.keys(userMap);
    const users = await User.find({ _id: { $in: userIds } });

    const result = users.map(u => ({
      name: u.name,
      userId: u._id,
      amount: userMap[u._id.toString()] || userMap[u._id]
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error("Error calculating user balances:", err);
    res.status(500).json({ msg: "Error calculating user balances" });
  }
}; 

exports.simplifyGroupDebts = async (req, res) => {
  const { groupId } = req.params;
  try {
    const group = await Group.findById(groupId).populate({
      path: 'expenses',
      populate: [
        { path: 'paidBy', select: 'name email' },
        { path: 'splits.user', select: 'name email' }
      ]
    });
    if (!group) return res.status(404).json({ msg: "Group not found!" });

    const settlements = await Settlement.find({ groupId }); 

    const netBalance = {};

    group.members.forEach(member => {
      netBalance[member._id.toString()] = 0;
    });

    group.expenses.forEach((expense) => {
      const { splits, paidBy } = expense;
      const payerId = paidBy._id.toString();

      splits.forEach(({ user,amount }) => {
        const uid = user._id ? user._id.toString() : user.toString();

        if (uid !== payerId) {
          netBalance[uid] -= amount;
          netBalance[payerId] += amount;
        }
      });
    });

    settlements.forEach(settlement => {
      const paidBy = settlement.paidBy.toString(); 
      const paidTo = settlement.paidTo.toString(); 
      netBalance[paidBy] += settlement.amount; 
      netBalance[paidTo] -= settlement.amount; 
    });


    const users = await User.find({ _id: { $in: Object.keys(netBalance) } });

    const balances = Object.keys(netBalance).map(id => ({
      userId: id,
      name: users.find(u => u._id.toString() === id)?.name || "Unknown",
      amount: netBalance[id]
    }));

    const debtors = balances.filter(b => b.amount < -0.01).sort((a, b) => a.amount - b.amount);
    const creditors = balances.filter(b => b.amount > 0.01).sort((a, b) => b.amount - a.amount);

    const transactions = [];

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const settled = Math.min(-debtor.amount, creditor.amount);

      transactions.push({
        from: debtor.name,
        fromId: debtor.userId,
        to: creditor.name,
        toId: creditor.userId,
        amount: settled.toFixed(2)
      });

      debtor.amount += settled;
      creditor.amount -= settled;

      if (Math.abs(debtor.amount) < 0.01) i++;
      if (Math.abs(creditor.amount) < 0.01) j++;
    }

    res.json({ simplifiedTransactions: transactions });
  }
  catch(err){
    console.error(err);
    res.status(500).json({ msg:"Error in simplifying debts" });
  }
};

exports.addMemberToGroup = async (req, res) => {
  const { groupId } = req.params;
  const { newMemberId } = req.body;

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    if (group.members.includes(newMemberId)) {
      return res.status(400).json({ msg: "User is already a member of this group" });
    }

    group.members.push(newMemberId);
    await group.save();

    res.status(200).json({ msg: "User added successfully", group });
  } catch (err) {
    console.error("Add member error:", err);
    res.status(500).json({ msg: "Server error while adding member" });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }

    if (!group.createdBy.equals(userId)) {
      return res.status(403).json({ msg: 'Only the creator can delete the group' });
    }

    await Expense.deleteMany({ groupId: groupId });
    await Settlement.deleteMany({ groupId: groupId });
    await Group.findByIdAndDelete(groupId);

    res.status(200).json({ msg: 'Group deleted successfully' });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { groupName, removeMemberId } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    if (groupName) group.groupName = groupName;

    if (removeMemberId) {
      group.members = group.members.filter(id => id.toString() !== removeMemberId);
    }

    await group.save();
    await group.populate('members', 'name email');

    res.json({ msg: 'Group updated successfully', group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.recordSettlement = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { paidBy, paidTo, amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(paidBy) || !mongoose.Types.ObjectId.isValid(paidTo)) {
      return res.status(400).json({ msg: "Invalid ID provided" });
    }

    if (paidBy === paidTo) {
        return res.status(400).json({ msg: "Payer and payee cannot be the same." });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found." });

    if (!group.members.includes(paidBy) || !group.members.includes(paidTo)) {
        return res.status(400).json({ msg: "Payer or payee is not a member of this group." });
    }

    const newSettlement = new Settlement({
      groupId,
      paidBy,
      paidTo, 
      amount: Number(amount)
    });

    await newSettlement.save();

    group.settlements.push(newSettlement._id);
    await group.save();

    res.status(201).json({ msg: 'Settlement recorded successfully', settlement: newSettlement });
  } catch (err) {
    console.error("Error recording settlement:", err);
    res.status(500).json({ msg: "Server error while recording settlement" });
  }
};