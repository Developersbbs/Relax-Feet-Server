// models/Bill.js
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true
  },
  itemType: {
    type: String,
    enum: ['service'],
    default: 'service',
    required: true
  }
});

// Since we only support services now, we simplify the pre-validate hook
itemSchema.pre('validate', function (next) {
  this.itemType = 'service';
  if (this.serviceId) {
    this.quantity = 1; // Enforce quantity 1 for services
  }
  next();
});

const billSchema = new mongoose.Schema({
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  billNumber: {
    type: String,
    // required: true, // Moved to post-validation setup
    // unique: true // Removed global unique constraint, uniqueness is now per branch
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String,
    default: ''
  },
  customerPhone: {
    type: String,
    default: ''
  },
  items: [itemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  taxPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'partial'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'credit'],
    default: 'cash'
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  dueAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  billDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  couponCode: {
    type: String,
    uppercase: true,
    trim: true
  },
  couponDiscount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// --- IMPROVED Generate bill number hook ---
billSchema.pre('validate', async function (next) {
  // Only generate billNumber if it's a new document and billNumber is not already set
  if (this.isNew && !this.billNumber) {
    try {
      if (!this.branchId) {
        return next(new Error('branchId is required to generate a bill number'));
      }

      // Fetch the branch code
      const Branch = mongoose.model('Branch');
      const branch = await Branch.findById(this.branchId);
      if (!branch) {
        return next(new Error('Invalid branchId provided for bill generation'));
      }
      const branchCode = branch.code;

      // Find the highest existing bill number for THIS branch
      const lastBill = await this.constructor
        .findOne({ branchId: this.branchId }, { billNumber: 1 })
        .sort({ createdAt: -1 })
        .limit(1)
        .exec();

      let nextNumber = 1;
      if (lastBill && lastBill.billNumber) {
        // Expected format: BRANCHCODE-BILL-000001
        // Split by '-' and get the last part
        const parts = lastBill.billNumber.split('-');
        const lastNumberString = parts[parts.length - 1];
        const lastNumber = parseInt(lastNumberString, 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      this.billNumber = `${branchCode}-BILL-${String(nextNumber).padStart(6, '0')}`;
    } catch (err) {
      console.error("Error generating bill number:", err);
      return next(err);
    }
  }
  next();
});

// Re-add the required validator *after* the pre-validate hook
// This ensures validation runs, but only after the hook has had a chance to populate billNumber
billSchema.path('billNumber').required(true, 'Bill number is required');

module.exports = mongoose.model('Bill', billSchema);
