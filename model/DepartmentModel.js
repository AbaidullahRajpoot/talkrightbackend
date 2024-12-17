const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    departmentName: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    headOfDepartment: {
        type: String,
        required: true
    },
    departmentPhone: {
        type: String,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);