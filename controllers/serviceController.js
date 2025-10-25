const Service = require('../models/Service');

// @desc    Fetch all services
// @route   GET /api/services
// @access  Private
const getServices = async (req, res) => {
  try {
    const { search, category, sortBy = 'name', sortOrder = 'asc' } = req.query;

    // Build query object
    let query = { isActive: true };

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Build sort object
    const sortObj = {};
    const order = sortOrder === 'desc' ? -1 : 1;
    sortObj[sortBy] = order;

    // Execute query
    const services = await Service.find(query).sort(sortObj);

    res.status(200).json({
      success: true,
      count: services.length,
      services
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching services'
    });
  }
};

// @desc    Get single service
// @route   GET /api/services/:id
// @access  Private
const getService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.status(200).json({
      success: true,
      service
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching service'
    });
  }
};

// @desc    Create new service
// @route   POST /api/services
// @access  Private
const createService = async (req, res) => {
  try {
    const { name, description, price, duration, category } = req.body;

    // Validation
    if (!name || !description || !price) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, and price are required'
      });
    }

    const service = await Service.create({
      name,
      description,
      price,
      duration,
      category
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      service
    });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating service'
    });
  }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private
const updateService = async (req, res) => {
  try {
    const { name, description, price, duration, category, isActive } = req.body;

    let service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Update fields
    service.name = name || service.name;
    service.description = description || service.description;
    service.price = price || service.price;
    service.duration = duration || service.duration;
    service.category = category || service.category;
    if (isActive !== undefined) service.isActive = isActive;

    await service.save();

    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating service'
    });
  }
};

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private
const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Soft delete by setting isActive to false
    service.isActive = false;
    await service.save();

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting service'
    });
  }
};

module.exports = {
  getServices,
  getService,
  createService,
  updateService,
  deleteService
};
