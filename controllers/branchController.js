const Branch = require('../models/Branch');

// @desc    Get all branches
// @route   GET /api/branches
// @access  Private/SuperAdmin
exports.getAllBranches = async (req, res) => {
    try {
        const branches = await Branch.find().sort({ createdAt: -1 });
        res.status(200).json(branches);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching branches', error: error.message });
    }
};

// @desc    Get single branch
// @route   GET /api/branches/:id
// @access  Private/SuperAdmin
exports.getBranchById = async (req, res) => {
    try {
        const branch = await Branch.findById(req.params.id);
        if (!branch) {
            return res.status(404).json({ message: 'Branch not found' });
        }
        res.status(200).json(branch);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching branch', error: error.message });
    }
};

// @desc    Create a branch
// @route   POST /api/branches
// @access  Private/SuperAdmin
exports.createBranch = async (req, res) => {
    try {
        const { name, code, address, contactNumber, isActive, gstNumber, email, website, bankDetails } = req.body;

        const existingBranch = await Branch.findOne({ code });
        if (existingBranch) {
            return res.status(400).json({ message: 'Branch code already exists' });
        }

        const branch = await Branch.create({
            name,
            code,
            address,
            contactNumber,
            isActive,
            gstNumber,
            email,
            website,
            bankDetails
        });

        res.status(201).json(branch);
    } catch (error) {
        res.status(500).json({ message: 'Error creating branch', error: error.message });
    }
};

// @desc    Update a branch
// @route   PUT /api/branches/:id
// @access  Private/SuperAdmin
exports.updateBranch = async (req, res) => {
    try {
        const { name, code, address, contactNumber, isActive, gstNumber, email, website, bankDetails } = req.body;

        // Check if branch code exists in ANOTHER branch
        if (code) {
            const existingBranch = await Branch.findOne({ code, _id: { $ne: req.params.id } });
            if (existingBranch) {
                return res.status(400).json({ message: 'Branch code already exists' });
            }
        }

        const branch = await Branch.findByIdAndUpdate(
            req.params.id,
            { name, code, address, contactNumber, isActive, gstNumber, email, website, bankDetails },
            { new: true, runValidators: true }
        );

        if (!branch) {
            return res.status(404).json({ message: 'Branch not found' });
        }

        res.status(200).json(branch);
    } catch (error) {
        res.status(500).json({ message: 'Error updating branch', error: error.message });
    }
};

// @desc    Delete a branch
// @route   DELETE /api/branches/:id
// @access  Private/SuperAdmin
exports.deleteBranch = async (req, res) => {
    try {
        const branch = await Branch.findById(req.params.id);
        if (!branch) {
            return res.status(404).json({ message: 'Branch not found' });
        }

        await branch.deleteOne();
        res.status(200).json({ message: 'Branch deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting branch', error: error.message });
    }
};
