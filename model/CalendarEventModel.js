const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    url: {
        type: String,
        default: ''
    },
    title: {
        type: String,
        required: true
    },
    start: {
        type: Date,
        required: true
    },
    end: {
        type: Date,
        required: true
    },
    allDay: {
        type: Boolean,
        default: false
    },
    extendedProps: {
        calendar: {
            type: String,
            required: true
        },
        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Doctor'
        },
        patient: {
            name: String,
            email: String,
            phone: String
        },
        description: String,
        location: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);