const express = require('express');
const {
  getServices,
  getService,
  createService,
  updateService,
  deleteService
} = require('../controllers/serviceController');
const { protect } = require('../middlewares/authMiddlewares');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/services
// @desc    Get all services
// @access  Private
router.get('/', getServices);

// @route   GET /api/services/:id
// @desc    Get single service
// @access  Private
router.get('/:id', getService);

// @route   POST /api/services
// @desc    Create new service
// @access  Private
router.post('/', createService);

// @route   PUT /api/services/:id
// @desc    Update service
// @access  Private
router.put('/:id', updateService);

// @route   DELETE /api/services/:id
// @desc    Delete service
// @access  Private
router.delete('/:id', deleteService);

module.exports = router;
