const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
    callSid: {
        type: String,
        required: true,
        unique: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    duration: {
        type: Number,
        default: 0
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    status: {
        type: String,
        enum: ['ongoing', 'completed', 'failed'],
        default: 'ongoing'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Call', callSchema); 