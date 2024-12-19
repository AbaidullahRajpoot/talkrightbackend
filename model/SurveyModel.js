const mongoose = require('mongoose');

const surveySchema = new mongoose.Schema({
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    ratings: {
        overall: { type: Number, min: 1, max: 5, required: true },
        waitingTime: { type: Number, min: 1, max: 5 },
        doctorBehavior: { type: Number, min: 1, max: 5 },
        cleanliness: { type: Number, min: 1, max: 5 }
    },
    feedback: {
        type: String,
        trim: true
    },
    recommendToOthers: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Survey', surveySchema);