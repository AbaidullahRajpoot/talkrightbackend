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
    notes: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('CalendarSlot', calendarSlotSchema); 