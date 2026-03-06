// controllers/billController.js
const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Coupon = require('../models/Coupon');
const Product = null; // Removing Product dependency
// const { handleStockNotifications } = require('../utils/stockNotifications');

const VALID_PAYMENT_METHODS = ['cash', 'card', 'upi', 'bank_transfer', 'credit'];
const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'partial'];

const roundToTwo = (value) => Math.round((Number(value) || 0) * 100) / 100;
const clamp = (value, min, max) => Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);

const normalizePaymentMethod = (method) => {
  if (method === 'bank') {
    return 'bank_transfer';
  }
  if (VALID_PAYMENT_METHODS.includes(method)) {
    return method;
  }
  return 'cash';
};

const normalizePaymentStatus = (status) =>
  VALID_PAYMENT_STATUSES.includes(status) ? status : 'pending';

const calculateFinancials = ({ items, discountPercent, taxPercent, paidAmount, paymentStatus }) => {
  const subtotal = roundToTwo(items.reduce((sum, item) => sum + roundToTwo(item.total || 0), 0));
  const normalizedDiscountPercent = clamp(Number(discountPercent) || 0, 0, 100);
  const discountAmount = roundToTwo((subtotal * normalizedDiscountPercent) / 100);
  const taxableBase = roundToTwo(Math.max(subtotal - discountAmount, 0));
  const normalizedTaxPercent = clamp(Number(taxPercent) || 0, 0, 100);
  const taxAmount = roundToTwo((taxableBase * normalizedTaxPercent) / 100);
  const totalAmount = roundToTwo(taxableBase + taxAmount);

  let normalizedPaymentStatus = normalizePaymentStatus(paymentStatus);
  let normalizedPaidAmount = roundToTwo(Number(paidAmount) || 0);

  if (normalizedPaymentStatus === 'paid') {
    normalizedPaidAmount = totalAmount;
  }

  if (normalizedPaidAmount > totalAmount) {
    normalizedPaidAmount = totalAmount;
  }

  const dueAmount = roundToTwo(Math.max(totalAmount - normalizedPaidAmount, 0));
  if (normalizedPaymentStatus === 'paid' && dueAmount > 0) {
    normalizedPaymentStatus = 'partial';
  }

  return {
    subtotal,
    discountPercent: normalizedDiscountPercent,
    discountAmount,
    taxPercent: normalizedTaxPercent,
    taxAmount,
    totalAmount,
    paidAmount: normalizedPaidAmount,
    dueAmount,
    paymentStatus: normalizedPaymentStatus
  };
};

const calculateFinancialsWithCoupon = ({ items, discountPercent, taxPercent, paidAmount, paymentStatus, coupon }) => {
  const subtotal = roundToTwo(items.reduce((sum, item) => sum + roundToTwo(item.total || 0), 0));

  // Apply standard discount first
  const normalizedDiscountPercent = clamp(Number(discountPercent) || 0, 0, 100);
  let discountAmount = roundToTwo((subtotal * normalizedDiscountPercent) / 100);

  // Apply coupon discount if provided
  let couponDiscount = 0;
  if (coupon) {
    if (coupon.discountType === 'percentage') {
      couponDiscount = roundToTwo((subtotal * coupon.discountValue) / 100);
      if (coupon.maxDiscountAmount && couponDiscount > coupon.maxDiscountAmount) {
        couponDiscount = coupon.maxDiscountAmount;
      }
    } else {
      couponDiscount = coupon.discountValue;
    }
  }

  const totalDiscount = roundToTwo(discountAmount + couponDiscount);
  const taxableBase = roundToTwo(Math.max(subtotal - totalDiscount, 0));
  const normalizedTaxPercent = clamp(Number(taxPercent) || 0, 0, 100);
  const taxAmount = roundToTwo((taxableBase * normalizedTaxPercent) / 100);
  const totalAmount = roundToTwo(taxableBase + taxAmount);

  let normalizedPaymentStatus = normalizePaymentStatus(paymentStatus);
  let normalizedPaidAmount = roundToTwo(Number(paidAmount) || 0);

  if (normalizedPaymentStatus === 'paid') {
    normalizedPaidAmount = totalAmount;
  }

  if (normalizedPaidAmount > totalAmount) {
    normalizedPaidAmount = totalAmount;
  }

  const dueAmount = roundToTwo(Math.max(totalAmount - normalizedPaidAmount, 0));
  if (normalizedPaymentStatus === 'paid' && dueAmount > 0) {
    normalizedPaymentStatus = 'partial';
  }

  return {
    subtotal,
    discountPercent: normalizedDiscountPercent,
    discountAmount: totalDiscount,
    couponDiscount,
    taxPercent: normalizedTaxPercent,
    taxAmount,
    totalAmount,
    paidAmount: normalizedPaidAmount,
    dueAmount,
    paymentStatus: normalizedPaymentStatus
  };
};

const parseOptionalDate = (value, fallback = null) => {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const httpError = (status, message) => {
  const error = new Error(message);
  error.statusCode = status;
  return error;
};


exports.getAllBills = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, paymentStatus } = req.query;

    const filter = {};
    if (startDate && endDate) {
      filter.billDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    // Branch filtering logic
    if (req.user.role !== 'superadmin') {
      filter.branchId = req.user.branchId;
    } else if (req.query.branchId) {
      filter.branchId = req.query.branchId;
    }

    const bills = await Bill.find(filter)
      .populate('customerId', 'name email phone')
      .populate('branchId', 'name code address contactNumber gstNumber email website bankDetails')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Bill.countDocuments(filter);

    res.status(200).json({
      bills,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (err) {
    console.error("Error in getAllBills:", err); // Log for debugging
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('customerId')
      .populate('branchId', 'name code address contactNumber gstNumber email website bankDetails');
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Authorization check
    if (req.user.role !== 'superadmin' && String(bill.branchId._id) !== String(req.user.branchId)) {
      return res.status(403).json({ message: 'Forbidden: Cannot access bill from another branch' });
    }
    res.status(200).json(bill);
  } catch (err) {
    console.error("Error in getBillById:", err); // Log for debugging
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.createBill = async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.createdBy = req.user._id;

    // Determine branchId: UI provided for superadmin, or from req.user
    let branchId = req.user.role === 'superadmin' && payload.branchId ? payload.branchId : req.user.branchId;

    if (!branchId) {
      // Fallback: try active branch first, then any branch
      const Branch = mongoose.model('Branch');
      const firstBranch = await Branch.findOne({ isActive: true }) || await Branch.findOne({});
      if (firstBranch) {
        branchId = firstBranch._id;
      }
    }

    if (!branchId) {
      throw httpError(400, 'No active branch found. Please create a branch before creating a bill.');
    }

    if (!payload.customerId) {
      throw httpError(400, 'Customer ID is required.');
    }

    const customer = await Customer.findById(payload.customerId);
    if (!customer) {
      throw httpError(400, 'Invalid customer ID.');
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw httpError(400, 'Bill must contain at least one item.');
    }

    const items = [];
    let coupon = null;

    if (payload.couponCode) {
      coupon = await Coupon.findOne({ code: payload.couponCode.toUpperCase(), isActive: true });
      if (!coupon) {
        throw httpError(400, 'Invalid or inactive coupon code.');
      }

      const now = new Date();
      if (now < coupon.startDate || now > coupon.endDate) {
        throw httpError(400, 'Coupon is not valid at this time.');
      }

      if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
        throw httpError(400, 'Coupon usage limit has been reached.');
      }
    }

    for (let index = 0; index < payload.items.length; index += 1) {
      const item = payload.items[index];
      // ... existing item processing logic ...
      if (!item?.serviceId) {
        throw httpError(400, `Item ${index + 1}: Service ID is required.`);
      }

      const price = roundToTwo(Number(item.price) || 0);
      if (price < 0) {
        throw httpError(400, `Item ${index + 1}: Price cannot be negative.`);
      }

      const total = roundToTwo(price); // Services always have quantity 1

      const service = await Service.findById(item.serviceId);
      if (!service) {
        throw httpError(400, `Item ${index + 1}: Invalid service selected.`);
      }

      const itemData = {
        serviceId: service._id,
        name: item.name || service.name,
        quantity: 1,
        price,
        total,
        itemType: 'service'
      };

      items.push(itemData);
    }

    if (coupon && items.reduce((sum, it) => sum + it.total, 0) < coupon.minBillAmount) {
      throw httpError(400, `Minimum bill amount for this coupon is ₹${coupon.minBillAmount}`);
    }

    const financials = calculateFinancialsWithCoupon({
      items,
      discountPercent: payload.discountPercent,
      taxPercent: payload.taxPercent,
      paidAmount: payload.paidAmount,
      paymentStatus: payload.paymentStatus,
      coupon
    });

    const bill = new Bill({
      branchId,
      customerId: customer._id,
      customerName: customer.name,
      customerEmail: customer.email || '',
      customerPhone: customer.phone || '',
      items,
      ...financials,
      taxAmount: financials.taxAmount,
      discount: financials.discountAmount,
      couponCode: coupon ? coupon.code : undefined,
      couponDiscount: financials.couponDiscount,
      paymentMethod: normalizePaymentMethod(payload.paymentMethod),
      paymentStatus: financials.paymentStatus,
      billDate: parseOptionalDate(payload.billDate, new Date()),
      dueDate: parseOptionalDate(payload.dueDate, null),
      notes: payload.notes || '',
      createdBy: payload.createdBy
    });

    await bill.save();

    if (coupon) {
      await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
    }

    if (bill.paymentMethod === 'credit' || bill.paymentStatus !== 'paid') {
      await Customer.findByIdAndUpdate(
        bill.customerId,
        { $inc: { outstandingBalance: bill.dueAmount } },
        { new: true, runValidators: true }
      );
    }

    // await notifyProducts(new Set([...updatedProducts.keys()]));
    await bill.populate([
      { path: 'customerId', select: 'name email phone' },
      { path: 'branchId', select: 'name code address contactNumber gstNumber email website bankDetails' }
    ]);

    res.status(201).json({
      message: 'Bill created successfully',
      bill
    });
  } catch (err) {
    console.error("Error creating bill:", err); // Log the actual error for debugging

    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }

    // Differentiate between validation errors and server errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: 'Validation Error', errors: messages });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid data format', error: err.message });
    }
    if (err.code === 11000) {
      const duplicateField = Object.keys(err.keyValue)[0];
      return res.status(400).json({ message: `Duplicate entry`, error: `A bill with this ${duplicateField} already exists.` });
    }

    res.status(500).json({ message: 'Server error during bill creation', error: err.message });
  }
};

exports.updateBill = async (req, res) => {
  try {
    const existingBill = await Bill.findById(req.params.id);
    if (!existingBill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const payload = { ...req.body };

    const customer = await Customer.findById(existingBill.customerId);
    if (!customer) {
      throw httpError(400, 'Associated customer no longer exists.');
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw httpError(400, 'Bill must contain at least one item.');
    }

    const items = [];

    for (let index = 0; index < payload.items.length; index += 1) {
      const item = payload.items[index];
      if (!item?.serviceId) {
        throw httpError(400, `Item ${index + 1}: Service ID is required.`);
      }

      const price = roundToTwo(Number(item.price) || 0);
      if (price < 0) {
        throw httpError(400, `Item ${index + 1}: Price cannot be negative.`);
      }

      const total = roundToTwo(price);

      const itemData = {
        serviceId: item.serviceId,
        name: item.name,
        quantity: 1,
        price,
        total,
        itemType: 'service'
      };

      items.push(itemData);
    }

    // Services don't need stock adjustments

    const financials = calculateFinancials({
      items,
      discountPercent: payload.discountPercent ?? existingBill.discountPercent,
      taxPercent: payload.taxPercent ?? existingBill.taxPercent,
      paidAmount: payload.paidAmount ?? existingBill.paidAmount,
      paymentStatus: payload.paymentStatus ?? existingBill.paymentStatus
    });

    const outstandingDelta = roundToTwo(existingBill.dueAmount * -1);
    const newOutstanding = financials.dueAmount;

    const updatedBill = await Bill.findByIdAndUpdate(
      existingBill._id,
      {
        items,
        subtotal: financials.subtotal,
        taxPercent: financials.taxPercent,
        taxAmount: financials.taxAmount,
        discountPercent: financials.discountPercent,
        discount: financials.discountAmount,
        totalAmount: financials.totalAmount,
        paidAmount: financials.paidAmount,
        dueAmount: financials.dueAmount,
        paymentStatus: financials.paymentStatus,
        paymentMethod: normalizePaymentMethod(payload.paymentMethod ?? existingBill.paymentMethod),
        billDate: parseOptionalDate(payload.billDate, existingBill.billDate),
        dueDate: parseOptionalDate(payload.dueDate, existingBill.dueDate),
        notes: payload.notes ?? existingBill.notes
      },
      { new: true, runValidators: true }
    ).populate('customerId', 'name email phone')
      .populate('branchId', 'name code address contactNumber gstNumber email website bankDetails');

    await Customer.findByIdAndUpdate(
      customer._id,
      { $inc: { outstandingBalance: outstandingDelta + newOutstanding } },
      { new: true, runValidators: true }
    );

    // await notifyProducts(new Set([...updatedProducts.keys()]));

    res.status(200).json({
      message: 'Bill updated successfully',
      bill: updatedBill
    });
  } catch (err) {
    console.error("Error in updateBill:", err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Validation Error', errors: messages });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid data format', error: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.deleteBill = async (req, res) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    res.status(200).json({ message: 'Bill deleted successfully' });
  } catch (err) {
    console.error("Error in deleteBill:", err); // Log for debugging
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getBranchBillingSummary = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Aggregate billing data per branch
    const branchSummary = await Bill.aggregate([
      {
        $group: {
          _id: '$branchId',
          totalBills: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          paidRevenue: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$paidAmount', 0]
            }
          },
          pendingAmount: {
            $sum: {
              $cond: [{ $ne: ['$paymentStatus', 'paid'] }, '$dueAmount', 0]
            }
          },
          todayBills: {
            $sum: {
              $cond: [{ $gte: ['$billDate', startOfDay] }, 1, 0]
            }
          },
          monthlyBills: {
            $sum: {
              $cond: [{ $gte: ['$billDate', startOfMonth] }, 1, 0]
            }
          },
          monthlyRevenue: {
            $sum: {
              $cond: [{ $gte: ['$billDate', startOfMonth] }, '$totalAmount', 0]
            }
          },
          pendingBills: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0]
            }
          },
          paidBills: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'branches',
          localField: '_id',
          foreignField: '_id',
          as: 'branch'
        }
      },
      {
        $unwind: { path: '$branch', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          branchId: '$_id',
          branchName: { $ifNull: ['$branch.name', 'Unknown Branch'] },
          branchCode: { $ifNull: ['$branch.code', 'N/A'] },
          isActive: { $ifNull: ['$branch.isActive', false] },
          totalBills: 1,
          totalRevenue: 1,
          paidRevenue: 1,
          pendingAmount: 1,
          todayBills: 1,
          monthlyBills: 1,
          monthlyRevenue: 1,
          pendingBills: 1,
          paidBills: 1
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // Get system-wide totals
    const [systemTotals] = await Bill.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalBills: { $sum: 1 },
          todayBills: {
            $sum: { $cond: [{ $gte: ['$billDate', startOfDay] }, 1, 0] }
          },
          monthlyRevenue: {
            $sum: { $cond: [{ $gte: ['$billDate', startOfMonth] }, '$totalAmount', 0] }
          },
          pendingAmount: {
            $sum: { $cond: [{ $ne: ['$paymentStatus', 'paid'] }, '$dueAmount', 0] }
          }
        }
      }
    ]);

    res.status(200).json({
      branchSummary,
      systemTotals: systemTotals || {
        totalRevenue: 0,
        totalBills: 0,
        todayBills: 0,
        monthlyRevenue: 0,
        pendingAmount: 0
      }
    });
  } catch (err) {
    console.error('Error in getBranchBillingSummary:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getBillsStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const filter = {};
    if (req.user.role !== 'superadmin') {
      filter.branchId = new mongoose.Types.ObjectId(req.user.branchId);
    } else if (req.query.branchId) {
      filter.branchId = new mongoose.Types.ObjectId(req.query.branchId);
    }

    const [
      totalBills,
      todayBills,
      monthlyBills,
      pendingPayments,
      totalRevenue
    ] = await Promise.all([
      Bill.countDocuments(filter),
      Bill.countDocuments({ ...filter, billDate: { $gte: startOfDay } }),
      Bill.countDocuments({ ...filter, billDate: { $gte: startOfMonth } }),
      Bill.countDocuments({ ...filter, paymentStatus: 'pending' }),
      Bill.aggregate([
        { $match: { ...filter, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
    ]);

    res.status(200).json({
      totalBills,
      todayBills,
      monthlyBills,
      pendingPayments,
      totalRevenue: totalRevenue[0]?.total || 0
    });
  } catch (err) {
    console.error("Error in getBillsStats:", err); // Log for debugging
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.generateInvoice = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id).populate('customerId');
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Simple invoice generation (you can use libraries like pdfkit for PDF generation)
    const invoice = {
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      customer: bill.customerId,
      items: bill.items,
      subtotal: bill.subtotal,
      taxAmount: bill.taxAmount,
      discount: bill.discount,
      totalAmount: bill.totalAmount,
      paymentStatus: bill.paymentStatus
    };

    res.status(200).json(invoice);
  } catch (err) {
    console.error("Error in generateInvoice:", err); // Log for debugging
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
