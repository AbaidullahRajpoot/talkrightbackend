const moment = require('moment-timezone');
const Doctor = require('../model/DoctorModel');
const Appointment = require('../model/AppointmentModel');
const CalendarSlot = require('../model/CalendarSlotModel');

async function bookMeeting(functionArgs) {
  const { dateTime, email, duration = 30, confirmedDateTime, confirmedEmail, doctor } = functionArgs;
  
  try {
    const currentDateTime = moment().tz('Asia/Dubai');
    const meetingDateTime = moment.tz(dateTime, 'Asia/Dubai');
    
    // Validate date time format
    if (!meetingDateTime.isValid()) {
      return JSON.stringify({ 
        status: 'failure', 
        message: 'Invalid date or time format. Please provide a valid date and time.' 
      });
    }

    // Check if time is in the past
    if (meetingDateTime.isBefore(currentDateTime)) {
      return JSON.stringify({ 
        status: 'failure', 
        message: 'The requested appointment time is in the past. Please choose a future time.' 
      });
    }

    // Get doctor data
    const doctorData = await Doctor.findOne({
      doctorName: doctor.replace('Dr. ', '')
    }).populate('doctorDepartment');

    if (!doctorData) {
      return JSON.stringify({
        status: 'failure',
        message: 'Doctor not found'
      });
    }

    // Request confirmation if not already confirmed
    if (!confirmedDateTime || !confirmedEmail) {
      return JSON.stringify({
        status: 'needs_confirmation',
        message: 'Please confirm the following appointment details:',
        email: email,
        dateTime: meetingDateTime.format('MMMM D, YYYY [at] h:mm A [GST]'),
        duration: duration,
        doctor: {
          name: doctorData.doctorName,
          department: doctorData.doctorDepartment.departmentName,
          languages: doctorData.doctorLanguage,
          shift: doctorData.doctorShift
        }
      });
    }

    const endDateTime = meetingDateTime.clone().add(duration, 'minutes');

    // Check if within working hours
    if (!isWithinWorkingHours(meetingDateTime, duration, doctorData.doctorShift)) {
      return JSON.stringify({
        status: 'failure',
        message: `This time is outside of Dr. ${doctorData.doctorName}'s working hours`
      });
    }

    // Check for existing appointments
    const existingAppointment = await Appointment.findOne({
      doctor: doctorData._id,
      status: { $nin: ['cancelled'] },
      $or: [
        {
          appointmentDateTime: { $lt: endDateTime.toDate() },
          endDateTime: { $gt: meetingDateTime.toDate() }
        }
      ]
    });

    if (existingAppointment) {
      return JSON.stringify({
        status: 'failure',
        message: 'This time slot is already booked. Please choose another time.'
      });
    }

    // Create appointment
    const appointment = new Appointment({
      appointmentId: `APT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      doctor: doctorData._id,
      patient: {
        name: email.split('@')[0],
        email: email
      },
      appointmentDateTime: meetingDateTime.toDate(),
      endDateTime: endDateTime.toDate(),
      duration: duration,
      status: 'scheduled',
      source: 'ai-assistant'
    });

    const savedAppointment = await appointment.save();

    // Create calendar slot
    const calendarSlot = new CalendarSlot({
      doctor: doctorData._id,
      startTime: meetingDateTime.toDate(),
      endTime: endDateTime.toDate(),
      duration: duration,
      status: 'booked',
      appointmentId: savedAppointment._id
    });

    await calendarSlot.save();

    return JSON.stringify({
      status: 'success',
      message: 'Appointment booked successfully',
      appointmentDetails: {
        id: savedAppointment.appointmentId,
        dateTime: meetingDateTime.format('MMMM D, YYYY [at] h:mm A [GST]'),
        doctor: {
          name: doctorData.doctorName,
          department: doctorData.doctorDepartment.departmentName
        },
        duration: duration
      }
    });

  } catch (error) {
    console.error('Error in bookMeeting:', error);
    return JSON.stringify({
      status: 'failure',
      message: 'Failed to book appointment: ' + error.message
    });
  }
}

function isWithinWorkingHours(startDateTime, duration, shift) {
  const endDateTime = startDateTime.clone().add(duration, 'minutes');
  const startHour = startDateTime.hour();
  const endHour = endDateTime.hour();

  // Skip weekends
  if (startDateTime.day() === 0 || startDateTime.day() === 6) {
    return false;
  }

  if (shift === 'Day') {
    return startHour >= 9 && endHour <= 17;
  } else if (shift === 'Night') {
    return (startHour >= 18 || startHour < 6) && (endHour >= 18 || endHour <= 6);
  }
  
  return false;
}

module.exports = bookMeeting;