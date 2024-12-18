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

            const startDateTime = moment.tz(appointmentDateTime, 'Asia/Dubai');
            const endDateTime = startDateTime.clone().add(duration || 30, 'minutes');

            // Check slot availability
            const existingSlot = await CalendarSlot.findOne({
                doctor: doctorId,
                startTime: { $lt: endDateTime.toDate() },
                endTime: { $gt: startDateTime.toDate() },
                status: { $in: ['booked', 'blocked'] }
            });

            if (existingSlot) {
                return res.status(400).json({
                    success: false,
                    message: 'Time slot is not available'
                });
            }

            // Create appointment
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

            // Create calendar slot
            const calendarSlot = new CalendarSlot({
                doctor: doctorId,
                startTime: startDateTime.toDate(),
                endTime: endDateTime.toDate(),
                duration: duration || 30,
                status: 'booked',
                appointmentId: savedAppointment._id
            });

            await calendarSlot.save();

            res.status(201).json({
                success: true,
                message: 'Appointment created successfully',
                data: savedAppointment
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
}

module.exports = AppointmentController; 