const Appointment = require('../model/AppointmentModel');
const CalendarSlot = require('../model/CalenderSlotModel');
const Doctor = require('../model/DoctorModel');
const moment = require('moment-timezone');

class AppointmentController {
    // Create new appointment
    static async createAppointment(req, res) {
        try {
            const {
                doctorId,
                patientName,
                patientEmail,
                patientPhone,
                appointmentDateTime,
                duration
            } = req.body;

            // Validate doctor
            const doctor = await Doctor.findById(doctorId);
            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            // Convert appointment time to Dubai timezone
            const startDateTime = moment(appointmentDateTime).add(1, 'hours');
            const endDateTime = startDateTime.clone().add(duration || 30, 'minutes');

            // Check if there's an overlapping appointment
            const existingAppointment = await Appointment.findOne({
                doctor: doctorId,
                status: { $ne: 'cancelled' },
                $or: [
                    {
                        appointmentDateTime: { $lt: endDateTime.toDate() },
                        endDateTime: { $gt: startDateTime.toDate() }
                    }
                ]
            });

            if (existingAppointment) {
                return res.status(400).json({
                    success: false,
                    message: 'Time slot is not available'
                });
            }

            // Create appointment with Dubai timezone
            const appointment = new Appointment({
                appointmentId: `APT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                doctor: doctorId,
                patient: {
                    name: patientName,
                    email: patientEmail,
                    phone: patientPhone
                },
                appointmentDateTime: startDateTime.toDate(),
                endDateTime: endDateTime.toDate(),
                duration: duration || 30,
                status: 'scheduled'
            });

            const savedAppointment = await appointment.save();

            // Return the saved appointment with adjusted time for frontend
            const responseAppointment = {
                ...savedAppointment.toObject(),
                appointmentDateTime: moment(savedAppointment.appointmentDateTime).subtract(1, 'hours').toISOString(),
                endDateTime: moment(savedAppointment.endDateTime).subtract(1, 'hours').toISOString()
            };

            res.status(201).json({
                success: true,
                message: 'Appointment created successfully',
                data: responseAppointment
            });

        } catch (error) {
            console.error('Error creating appointment:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating appointment',
                error: error.message
            });
        }
    }

    // Get appointments by doctor
    static async getAppointmentsByDoctor(req, res) {
        try {
            const { doctorId } = req.params;
            const { startDate, endDate } = req.query;

            const appointments = await Appointment.find({
                doctor: doctorId,
                appointmentDateTime: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }).sort({ appointmentDateTime: 1 });

            res.status(200).json({
                success: true,
                data: appointments
            });

        } catch (error) {
            console.error('Error fetching appointments:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching appointments',
                error: error.message
            });
        }
    }

    // Update appointment status
    static async updateAppointmentStatus(req, res) {
        try {
            const { appointmentId } = req.params;
            const { status } = req.body;

            const appointment = await Appointment.findOne({ appointmentId });
            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    message: 'Appointment not found'
                });
            }

            appointment.status = status;
            await appointment.save();

            // Update calendar slot if appointment is cancelled
            if (status === 'cancelled') {
                await CalendarSlot.findOneAndUpdate(
                    { appointmentId: appointment._id },
                    { status: 'available' }
                );
            }

            res.status(200).json({
                success: true,
                message: 'Appointment status updated successfully',
                data: appointment
            });

        } catch (error) {
            console.error('Error updating appointment:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating appointment',
                error: error.message
            });
        }
    }

    // Get appointments in calendar format
    static async getAppointmentsCalendar(req, res) {
        try {
            const { start, end, doctorId, calendar } = req.query;
            const query = {
                status: { $nin: ['cancelled'] }
            };

            if (start && end) {
                query.appointmentDateTime = { $gte: new Date(start) };
                query.endDateTime = { $lte: new Date(end) };
            }

            if (doctorId) {
                query.doctor = doctorId;
            }

            const appointments = await Appointment.find(query)
                .populate('doctor')
                .sort({ appointmentDateTime: 1 });

            const calendarEvents = appointments.map(appointment => {
                // Convert Dubai time to UTC-4
                const dubaiTime = moment.tz(appointment.appointmentDateTime, 'Asia/Dubai');
                const endDubaiTime = moment.tz(appointment.endDateTime, 'Asia/Dubai');
                
                // Subtract 8 hours (4 hours from Dubai to UTC, then 4 more to get to UTC-4)
                const adjustedStart = dubaiTime.clone().subtract(1, 'hours');
                const adjustedEnd = endDubaiTime.clone().subtract(1, 'hours');

                return {
                    id: appointment._id,
                    url: process.env.FRONTEND_URL || 'http://localhost:5000/',
                    title: appointment.patient.name,
                    start: adjustedStart.toISOString(),
                    end: adjustedEnd.toISOString(),
                    allDay: false,
                    extendedProps: {
                        calendar: appointment.doctor.doctorName,
                        doctor: appointment.doctor,
                        description: appointment.patient.name
                    }
                };
            });

            res.status(200).json({
                success: true,
                data: calendarEvents
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error fetching appointments',
                error: error.message
            });
        }
    }

    // Update appointment
    static async updateAppointment(req, res) {
        try {
            const { id } = req.params;
            const { start, end, title, extendedProps } = req.body;

            // Convert the times back to Dubai timezone by adding 1 hour
            const dubaiStart = moment(start).add(1, 'hours').toDate();
            const dubaiEnd = moment(end).add(1, 'hours').toDate();

            const appointment = await Appointment.findById(id);
            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    message: 'Appointment not found'
                });
            }

            // Check for overlapping appointments
            const existingAppointment = await Appointment.findOne({
                _id: { $ne: id }, // Exclude current appointment
                doctor: extendedProps?.doctor?._id || appointment.doctor,
                status: { $ne: 'cancelled' },
                $or: [
                    {
                        appointmentDateTime: { $lt: dubaiEnd },
                        endDateTime: { $gt: dubaiStart }
                    }
                ]
            });

            if (existingAppointment) {
                return res.status(400).json({
                    success: false,
                    message: 'Time slot is not available'
                });
            }

            // Update appointment with Dubai timezone
            appointment.appointmentDateTime = dubaiStart;
            appointment.endDateTime = dubaiEnd;
            appointment.patient.name = title;
            
            if (extendedProps?.doctor?._id) {
                appointment.doctor = extendedProps.doctor._id;
            }

            const updatedAppointment = await appointment.save();

            // Return the updated appointment with adjusted time for frontend
            const responseAppointment = {
                ...updatedAppointment.toObject(),
                appointmentDateTime: moment(updatedAppointment.appointmentDateTime).subtract(1, 'hours').toISOString(),
                endDateTime: moment(updatedAppointment.endDateTime).subtract(1, 'hours').toISOString()
            };

            res.status(200).json({
                success: true,
                message: 'Appointment updated successfully',
                data: responseAppointment
            });

        } catch (error) {
            console.error('Error updating appointment:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating appointment',
                error: error.message
            });
        }
    }

    // Delete appointment
    static async deleteAppointment(req, res) {
        try {
            const { id } = req.params;

            const appointment = await Appointment.findById(id);
            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    message: 'Appointment not found'
                });
            }

            await Appointment.findByIdAndDelete(id);

            res.status(200).json({
                success: true,
                message: 'Appointment deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting appointment:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting appointment',
                error: error.message
            });
        }
    }
}

module.exports = AppointmentController; 