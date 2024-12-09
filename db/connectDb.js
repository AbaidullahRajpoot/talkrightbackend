
const mongoose = require('mongoose');

mongoose.set('strictQuery', false);

const ConnectionDb = async (MONGO_URI) => {
  try { 
    await mongoose.connect(MONGO_URI);
    console.log('mongodb connection success!');
  } catch (err) {
    console.log('mongodb connection failed!', err.message);
  }
};

module.exports = ConnectionDb;
