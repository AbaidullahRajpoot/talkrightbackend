
const mongoose = require('mongoose');

mongoose.set('strictQuery', false);

const ConnectionDb = async (MONGO_URI) => {
  try { 
    const MongoseOption = { dbName: "talkright" }
    await mongoose.connect(MONGO_URI, MongoseOption);
    console.log('mongodb connection success!');
  } catch (err) {
    console.log('mongodb connection failed!', err.message);
  }
};

module.exports = ConnectionDb;
