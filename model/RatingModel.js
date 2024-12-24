const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    callQualityRating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    needsAddressedRating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // This will add createdAt and updatedAt fields automatically
});

const Rating = mongoose.model('Rating', ratingSchema);

module.exports = Rating;