const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const groupController = require('../controllers/groupController');

router.post('/create', auth, groupController.createGroup);
router.get('/user', auth, groupController.getUserGroups);
router.get('/:groupId/balances', auth, groupController.getGroupBalances);
router.get('/:groupId/balances/:userId', auth, groupController.getUserBalances);
router.get('/:groupId/simplify', auth, groupController.simplifyGroupDebts);
router.post('/:groupId/add-member', auth, groupController.addMemberToGroup);
router.delete('/:groupId', auth, groupController.deleteGroup);
router.patch('/:groupId', auth, groupController.updateGroup);
router.post('/:groupId/settle', auth, groupController.recordSettlement);

module.exports = router;
