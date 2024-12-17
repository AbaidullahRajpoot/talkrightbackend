const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    doctorName: {
        type: String,
        required: true
    },
    doctorDepartment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true
    },
    doctorPhone: {
        type: String,
        required: true
    },
    doctorLanguage: {
        type: Array,
        required: true
    },
    doctorGender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: true
    },
    doctorShift: {
        type: String,
        enum: ['Day', 'Night'],
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Doctor', doctorSchema);