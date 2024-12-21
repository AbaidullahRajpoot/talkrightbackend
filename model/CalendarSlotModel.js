const mongoose = require('mongoose');
const calendarSlotSchema = new mongoose.Schema({
   doctor: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'Doctor',
       required: true
   },
   startTime: {
       type: Date,
       required: true
   },
   endTime: {
       type: Date,
       required: true
   },
   duration: {
       type: Number,
       required: true,
       default: 30
   },
   status: {
       type: String,
       enum: ['available', 'booked', 'blocked'],
       default: 'available'
   },
   appointmentId: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'Appointment'
   },
   recurrence: {
       type: String,
       enum: ['none', 'daily', 'weekly'],
       default: 'none'
   },
   notes: {
       type: String
   }
}, { timestamps: true });

// Index for faster queries
calendarSlotSchema.index({ doctor: 1, startTime: 1, endTime: 1, status: 1 });

module.exports = mongoose.model('CalendarSlot', calendarSlotSchema);