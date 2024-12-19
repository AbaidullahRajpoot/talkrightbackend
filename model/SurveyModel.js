const mongoose = require('mongoose');
const surveySchema = new mongoose.Schema({
   appointment: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'Appointment',
       required: true
   },
   doctor: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'Doctor',
       required: true
   },
   patient: {
       name: String,
       email: {
           type: String,
           required: true
       }
   },
   ratings: {
       overall: {
           type: Number,
           min: 1,
           max: 5,
           required: true
       },
       waitingTime: {
           type: Number,
           min: 1,
           max: 5
       },
       doctorBehavior: {
           type: Number,
           min: 1,
           max: 5
       },
       cleanliness: {
           type: Number,
           min: 1,
           max: 5
       }
   },
   feedback: {
       type: String
   },
   recommendToOthers: {
       type: Boolean
   },
   visitDate: {
       type: Date,
       required: true
   }
}, { timestamps: true });
module.exports = mongoose.model('Survey', surveySchema);