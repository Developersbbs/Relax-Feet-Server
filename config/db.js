const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const dbURI = process.env.NODE_ENV === 'test'
      ? process.env.TEST_MONGODB_URI || `${process.env.MONGODB_URI}_test`
      : process.env.MONGODB_URI;
    await mongoose.connect(dbURI); // Simplified connection
    console.log(`MongoDB Connected to ${process.env.NODE_ENV || 'development'} DB`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

module.exports = connectDB;