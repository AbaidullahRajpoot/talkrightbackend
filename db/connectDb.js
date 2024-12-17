const mongoose = require('mongoose');

const ConnectionDb = async (MONGO_URI) => {
  try { 
    const MongooseOptions = {
      dbName: "talkright",
      connectTimeoutMS: 30000, // Optional: Adjust as needed
      socketTimeoutMS: 45000   // Optional: Adjust as needed
    };
    await mongoose.connect(MONGO_URI, MongooseOptions);
    console.log('MongoDB connection successful!');
  } catch (err) {
    console.error('MongoDB connection failed!', err.message);
    console.error(err); // This will provide more detailed error information
  }
};

module.exports = ConnectionDb;
