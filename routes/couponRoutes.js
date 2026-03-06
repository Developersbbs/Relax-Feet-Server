// routes/couponRoutes.js
const express = require('express');
const router = express.Router();
const {
    getAllCoupons,
    getCouponById,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    validateCoupon
} = require('../controllers/couponController');
const { protect, allowRoles } = require('../middlewares/authMiddlewares');

router.use(protect);

// Admin-only routes for managing coupons
router.route('/')
    .get(allowRoles('superadmin', 'admin'), getAllCoupons)
    .post(allowRoles('superadmin', 'admin'), createCoupon);

router.route('/:id')
    .get(allowRoles('superadmin', 'admin'), getCouponById)
    .put(allowRoles('superadmin', 'admin'), updateCoupon)
    .delete(allowRoles('superadmin', 'admin'), deleteCoupon);

// Public (authenticated) route for validating a coupon during checkout
router.post('/validate', validateCoupon);

module.exports = router;
