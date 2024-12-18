const Appointment = require('../model/AppointmentModel');
const CalendarEvent = require('../model/CalendarEventModel');
const Doctor = require('../model/DoctorModel');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');

class AppointmentController {
    static async createAppointment(appointmentData) {
        try {
            const appointment = new Appointment({
                appointmentId: uuidv4(),
                ...appointmentData
            });
            return await appointment.save();
        } catch (error) {
            throw new Error(`Error creating appointment: ${error.message}`);
        }
    }

    static async getAppointmentsByDoctor(doctorId, startDate, endDate) {
        try {
            return await Appointment.find({
                doctor: doctorId,
                appointmentDateTime: {
                    $gte: startDate,
                    $lte: endDate
                }
            }).populate('doctor');
        } catch (error) {
            throw new Error(`Error fetching appointments: ${error.message}`);
        }
    }

    static async getAppointmentsByPatient(email) {
        try {
            return await Appointment.find({
                'patient.email': email
            }).populate('doctor');
        } catch (error) {
            throw new Error(`Error fetching appointments: ${error.message}`);
        }
    }

    static async cancelAppointment(appointmentId, reason) {
        try {
            const appointment = await Appointment.findOneAndUpdate(
                { appointmentId },
                { 
                    status: 'cancelled',
                    cancellationReason: reason
                },
                { new: true }
            );

            if (appointment) {
                await CalendarEvent.findOneAndUpdate(
                    { id: appointment.calendarEventId },
                    { 'extendedProps.status': 'cancelled' }
                );
            }

            return appointment;
        } catch (error) {
            throw new Error(`Error cancelling appointment: ${error.message}`);
        }
    }
}

module.exports = AppointmentController; 