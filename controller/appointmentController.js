const Appointment = require('../model/AppointmentModel');
const CalendarSlot = require('../model/CalendarSlotModel');
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

    
    // Get appointments in calendar format
    static async getAppointmentsCalendar(req, res) {
        try {
            const { start, end, doctorId, calendar } = req.query;
            const query = {
                status: { $nin: ['cancelled'] }
            };

            // Add date range filter
            if (start && end) {
                query.appointmentDateTime = { $gte: new Date(start) };
                query.endDateTime = { $lte: new Date(end) };
            }

            // Add doctor filter
            if (doctorId) {
                query.doctor = doctorId;
            }

            const appointments = await Appointment.find(query)
                .populate({
                    path: 'doctor',
                    populate: {
                        path: 'doctorDepartment',
                    }
                })
                .sort({ appointmentDateTime: 1 });

            const calendarEvents = appointments.map(appointment => ({
                id: appointment._id,
                title: appointment.patient.name,
                email: appointment.patient.email,
                start: appointment.appointmentDateTime,
                end: appointment.endDateTime,
                extendedProps: {
                    calendar: appointment.doctor.doctorName,
                    doctor: appointment.doctor,
                    department: appointment.doctor.doctorDepartment,
                }
            }));

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

    // Create appointment from calendar
    static async createAppointmentCalendar(req, res) {
        try {
            const {
                doctorId,
                patientName,
                patientEmail,
                appointmentDateTime,
            } = req.body;

            // Validate required fields
            if (!doctorId || !patientName || !patientEmail || !appointmentDateTime) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields are required'
                });
            }

            // Validate doctor
            const doctor = await Doctor.findById(doctorId);
            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            // Parse and validate the appointment time in Dubai timezone
            const startDateTime = moment.tz(appointmentDateTime, 'YYYY-MM-DDTHH:mm:ss', 'Asia/Dubai');
            const endDateTime = startDateTime.clone().add(30, 'minutes');

            // Convert to UTC for database queries
            const startDateTimeUTC = startDateTime.clone().utc();
            const endDateTimeUTC = endDateTime.clone().utc();

            // Check for overlapping appointments
            const existingAppointment = await Appointment.findOne({
                doctor: doctorId,
                status: { $ne: 'cancelled' },
                $or: [
                    {
                        appointmentDateTime: { $lt: endDateTimeUTC.toDate() },
                        endDateTime: { $gt: startDateTimeUTC.toDate() }
                    }
                ]
            });

            if (existingAppointment) {
                return res.status(400).json({
                    success: false,
                    message: 'Time slot is not available'
                });
            }

            // Create appointment with UTC times
            const appointment = new Appointment({
                appointmentId: `APT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                doctor: doctorId,
                patient: {
                    name: patientName,
                    email: patientEmail
                },
                appointmentDateTime: startDateTimeUTC.toDate(),
                endDateTime: endDateTimeUTC.toDate(),
                duration: 30,
                status: 'scheduled'
            });

            const savedAppointment = await appointment.save();

            // Format the response with Dubai timezone
            const formattedAppointment = {
                id: savedAppointment._id,
                title: savedAppointment.patient.name,
                start: moment(savedAppointment.appointmentDateTime).tz('Asia/Dubai').format(),
                end: moment(savedAppointment.endDateTime).tz('Asia/Dubai').format(),
                extendedProps: {
                    email: savedAppointment.patient.email,
                    doctor: {
                        _id: savedAppointment.doctor
                    }
                }
            };

            res.status(201).json({
                success: true,
                message: 'Appointment created successfully',
                data: formattedAppointment
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
 
    // Update appointment from calendar
    static async updateCalendarAppointment(req, res) {
        try {
            const { id } = req.params;
            const { start, end, title, extendedProps } = req.body;

            // Validate required fields
            if (!start || !title || !extendedProps?.doctor?._id) {
                return res.status(400).json({
                    success: false,
                    message: 'Required fields are missing'
                });
            }

            // Convert the times to Dubai timezone
            const startDateTime = moment.tz(start, 'Asia/Dubai');
            const endDateTime = moment.tz(end || startDateTime.clone().add(30, 'minutes'), 'Asia/Dubai');

            const appointment = await Appointment.findById(id);
            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    message: 'Appointment not found'
                });
            }

            // Check for overlapping appointments
            const existingAppointment = await Appointment.findOne({
                _id: { $ne: id },
                doctor: extendedProps.doctor._id,
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

            // Update appointment
            appointment.appointmentDateTime = startDateTime.toDate();
            appointment.endDateTime = endDateTime.toDate();
            appointment.patient.name = title;
            appointment.patient.email = extendedProps.email || appointment.patient.email;
            appointment.doctor = extendedProps.doctor._id;

            const updatedAppointment = await appointment.save();

            // Format the response to match frontend expectations
            const formattedAppointment = {
                id: updatedAppointment._id,
                title: updatedAppointment.patient.name,
                start: updatedAppointment.appointmentDateTime,
                end: updatedAppointment.endDateTime,
                extendedProps: {
                    email: updatedAppointment.patient.email,
                    doctor: {
                        _id: updatedAppointment.doctor
                    }
                }
            };

            res.status(200).json({
                success: true,
                message: 'Appointment updated successfully',
                data: formattedAppointment
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

    // Delete appointment from calendar
    static async deleteCalendarAppointment(req, res) {
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