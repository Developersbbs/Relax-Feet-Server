const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { protect, allowRoles } = require('../middlewares/authMiddlewares');

// Route: /api/branches
router.route('/')
    .get(protect, allowRoles('superadmin'), branchController.getAllBranches)
    .post(protect, allowRoles('superadmin'), branchController.createBranch);

router.route('/:id')
    .get(protect, allowRoles('superadmin'), branchController.getBranchById)
    .put(protect, allowRoles('superadmin'), branchController.updateBranch)
    .delete(protect, allowRoles('superadmin'), branchController.deleteBranch);

module.exports = router;
