// controllers/couponController.js
const Coupon = require('../models/Coupon');

// @desc    Get all coupons
// @route   GET /api/coupons
// @access  Private (Admin/Superadmin)
exports.getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().populate('createdBy', 'username');
        res.status(200).json({ success: true, coupons });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get coupon by ID
// @route   GET /api/coupons/:id
// @access  Private (Admin/Superadmin)
exports.getCouponById = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }
        res.status(200).json({ success: true, coupon });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create new coupon
// @route   POST /api/coupons
// @access  Private (Admin/Superadmin)
exports.createCoupon = async (req, res) => {
    try {
        const {
            code,
            description,
            discountType,
            discountValue,
            minBillAmount,
            maxDiscountAmount,
            startDate,
            endDate,
            usageLimit
        } = req.body;

        // Check if coupon code already exists
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: 'Coupon code already exists' });
        }

        const coupon = await Coupon.create({
            code,
            description,
            discountType,
            discountValue,
            minBillAmount,
            maxDiscountAmount,
            startDate,
            endDate,
            usageLimit,
            createdBy: req.user._id
        });

        res.status(201).json({ success: true, coupon });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Update coupon
// @route   PUT /api/coupons/:id
// @access  Private (Admin/Superadmin)
exports.updateCoupon = async (req, res) => {
    try {
        let coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, coupon });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Delete coupon
// @route   DELETE /api/coupons/:id
// @access  Private (Admin/Superadmin)
exports.deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        await coupon.deleteOne();
        res.status(200).json({ success: true, message: 'Coupon removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Validate coupon code
// @route   POST /api/coupons/validate
// @access  Private
exports.validateCoupon = async (req, res) => {
    try {
        const { code, billAmount } = req.body;

        if (!code) {
            return res.status(400).json({ success: false, message: 'Please provide a coupon code' });
        }

        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Invalid or inactive coupon code' });
        }

        const now = new Date();

        if (now < coupon.startDate) {
            return res.status(400).json({ success: false, message: 'Coupon offer has not started yet' });
        }

        if (now > coupon.endDate) {
            return res.status(400).json({ success: false, message: 'Coupon has expired' });
        }

        if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
        }

        if (billAmount < coupon.minBillAmount) {
            return res.status(400).json({
                success: false,
                message: `Minimum bill amount to use this coupon is ₹${coupon.minBillAmount}`
            });
        }

        // Calculate discount amount for preview
        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = (billAmount * coupon.discountValue) / 100;
            if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
                discountAmount = coupon.maxDiscountAmount;
            }
        } else {
            discountAmount = coupon.discountValue;
        }

        res.status(200).json({
            success: true,
            coupon: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                discountAmount: discountAmount.toFixed(2)
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
