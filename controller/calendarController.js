const CalendarEvent = require('../model/CalendarEventModel');
const Doctor = require('../model/DoctorModel');
const { v4: uuidv4 } = require('uuid');

class CalendarController {
    // Create new event
    static async createEvent(req, res) {
        try {
            const eventData = {
                id: uuidv4(), // Generate unique ID
                title: req.body.title,
                start: new Date(req.body.start),
                end: new Date(req.body.end),
                allDay: req.body.allDay || false,
                url: req.body.url || '',
                extendedProps: {
                    calendar: req.body.extendedProps.calendar,
                    doctor: req.body.extendedProps.doctor,
                    description: req.body.extendedProps.description,
                }
            };

            // Validate doctor if provided
            if (req.body.doctorId) {
                const doctor = await Doctor.findById(req.body.doctorId);
                if (!doctor) {
                    return res.status(404).json({
                        success: false,
                        message: 'Doctor not found'
                    });
                }
            }

            const event = new CalendarEvent(eventData);
            const savedEvent = await event.save();

            // Populate doctor info if exists
            if (savedEvent.extendedProps.doctor) {
                await savedEvent.populate('extendedProps.doctor');
            }

            res.status(201).json({
                success: true,
                message: 'Event created successfully',
                data: savedEvent
            });
        } catch (error) {
            console.error('Error creating event:', error);
            res.status(400).json({
                success: false,
                message: 'Error creating event',
                error: error.message
            });
        }
    }

    // Get all events
    static async getEvents(req, res) {
        try {
            const { start, end, doctorId, calendar } = req.query;
            const query = {};

            // Add date range filter
            if (start && end) {
                query.start = { $gte: new Date(start) };
                query.end = { $lte: new Date(end) };
            }

            // Add doctor filter
            if (doctorId) {
                query['extendedProps.doctor'] = doctorId;
            }

            // Add calendar type filter
            if (calendar) {
                query['extendedProps.calendar'] = calendar;
            }

            const events = await CalendarEvent.find(query)
                .populate('extendedProps.doctor')
                .sort({ start: 1 });

            // Transform events to match exactly the required format
            const formattedEvents = events.map(event => ({
                id: event.id,
                url: event.url || '',
                title: event.title,
                start: event.start,
                end: event.end,
                allDay: event.allDay || false,
                extendedProps: {
                    id: event.id,
                    calendar: event.extendedProps.calendar,
                    doctor: event.extendedProps.doctor,
                    description: event.extendedProps.description,
                }
            }));

            res.status(200).json({
                success: true,
                data: formattedEvents
            });

        } catch (error) {
            console.error('Error fetching events:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching events',
                error: error.message
            });
        }
    }

    // Update event
    static async updateEvent(req, res) {
        try {
            const updateData = {
                title: req.body.title,
                start: new Date(req.body.start),
                end: new Date(req.body.end),
                allDay: req.body.allDay,
                url: req.body.url,
                'extendedProps.calendar': req.body.calendar,
                'extendedProps.description': req.body.description,
                'extendedProps.location': req.body.location,
                updatedAt: Date.now()
            };

            const event = await CalendarEvent.findOneAndUpdate(
                { id: req.params.id },
                updateData,
                {
                    new: true,
                    runValidators: true
                }
            ).populate('extendedProps.doctor');

            if (!event) {
                return res.status(404).json({
                    success: false,
                    message: 'Event not found'
                });
            }

            res.status(200).json({
                success: true,
                data: event
            });
        } catch (error) {
            console.error('Error updating event:', error);
            res.status(400).json({
                success: false,
                message: 'Error updating event',
                error: error.message
            });
        }
    }

    // Delete event
    static async deleteEvent(req, res) {
        try {
            const event = await CalendarEvent.findOneAndDelete({ id: req.params.id });

            if (!event) {
                return res.status(404).json({
                    success: false,
                    message: 'Event not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Event deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting event:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting event',
                error: error.message
            });
        }
    }
}

module.exports = CalendarController;