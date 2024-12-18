const Doctor = require('../model/DoctorModel');
const AppointmentController = require('../controller/appointmentController');
const CalendarController = require('../controller/calendarController');
const moment = require('moment-timezone');

async function bookMeeting(functionArgs) {
    const { 
        dateTime, 
        email, 
        duration = 30, 
        confirmedDateTime = false, 
        confirmedEmail = false, 
        doctor 
    } = functionArgs;

    try {
        // Find doctor
        const doctorData = await Doctor.findOne({
            doctorName: doctor.replace('Dr. ', '')
        }).populate('doctorDepartment');

        if (!doctorData) {
            return JSON.stringify({
                status: 'failure',
                message: 'Doctor not found'
            });
        }

        const meetingDateTime = moment.tz(dateTime, 'Asia/Dubai');

        // Validations
        if (!meetingDateTime.isValid()) {
            return JSON.stringify({
                status: 'failure',
                message: 'Invalid date or time'
            });
        }

        if (!confirmedDateTime || !confirmedEmail) {
            return JSON.stringify({
                status: 'needs_confirmation',
                message: 'Please confirm appointment details',
                details: {
                    dateTime: meetingDateTime.format('MMMM D, YYYY [at] h:mm A [GST]'),
                    email: email,
                    duration: duration,
                    doctor: doctor
                }
            });
        }

        // Check availability
        const availability = await CalendarController.checkSlotAvailability(
            doctorData._id,
            meetingDateTime.toDate(),
            duration
        );

        if (!availability.available) {
            return JSON.stringify({
                status: 'failure',
                message: 'This time slot is not available',
                alternativeSlots: availability.alternativeSlots
            });
        }

        // Create appointment
        const appointmentResult = await AppointmentController.createAppointment({
            doctor: doctorData._id,
            patient: {
                name: email.split('@')[0],
                email: email
            },
            appointmentDateTime: meetingDateTime.toDate(),
            duration: duration
        });

        return JSON.stringify({
            status: 'success',
            message: 'Appointment booked successfully',
            appointment: {
                id: appointmentResult.appointmentId,
                doctor: doctor,
                dateTime: meetingDateTime.format('MMMM D, YYYY [at] h:mm A [GST]'),
                duration: duration,
                email: email
            }
        });

    } catch (error) {
        console.error('Error in bookMeeting:', error);
        return JSON.stringify({
            status: 'failure',
            message: 'An error occurred while booking the appointment: ' + error.message
        });
    }
}

module.exports = bookMeeting;