const moment = require('moment-timezone');
const Doctor = require('../model/DoctorModel');
const Appointment = require('../model/AppointmentModel');

async function checkAvailability(functionArgs) {
  const { slots, doctor } = functionArgs;
  console.log('functionArgs', slots, doctor);

  if (!doctor) {
    return JSON.stringify({
      status: 'failure',
      message: 'Invalid or missing doctor name'
    });
  }

  try {
    // Get doctor info from database
    const doctorData = await Doctor.findOne({
      doctorName: doctor.replace('Dr. ', '')
    }).populate('doctorDepartment');
    console.log("DoctorData",doctorData)
    if (!doctorData) {
      return JSON.stringify({
        status: 'failure',
        message: 'Doctor not found in database'
      });
    }

    const currentDateTime = moment().tz('Asia/Dubai');

    const results = await Promise.all(slots.map(async (slot) => {
      const { dateTime, duration } = slot;
      // Convert the input time to Dubai timezone and keep it in that timezone
      const startDateTime = moment.tz(dateTime, 'Asia/Dubai');
      console.log('Requested start time (Dubai):', startDateTime.format());
      
      // Check if requested time is in the past
      if (startDateTime.isBefore(currentDateTime)) {
        return {
          dateTime: dateTime,
          available: false,
          message: 'Requested time is in the past',
        };
      }

      // Check working hours
      if (!isWithinWorkingHours(startDateTime, duration, doctorData.doctorShift)) {
        return {
          dateTime: dateTime,
          available: false,
          message: 'Requested time is outside of doctor\'s working hours',
        };
      }

      const endDateTime = startDateTime.clone().add(duration, 'minutes');
      console.log('Requested end time (Dubai):', endDateTime.format());

      // Convert times to UTC for database query while maintaining the correct time
      const startDateTimeUTC = startDateTime.clone().utc();
      const endDateTimeUTC = endDateTime.clone().utc();
      console.log('Start time (UTC):', startDateTimeUTC.format());
      console.log('End time (UTC):', endDateTimeUTC.format());

      // Enhanced check for existing appointments with proper time comparison
      const existingAppointment = await Appointment.findOne({
        doctor: doctorData._id,
        status: { $nin: ['cancelled', 'rejected', 'completed'] },
        $or: [
          {
            appointmentDateTime: { $lte: endDateTimeUTC.toDate() },
            endDateTime: { $gt: startDateTimeUTC.toDate() }
          },
        ]
      });

      const available = !existingAppointment;
      
      return {
        dateTime: dateTime,
        available: available,
        message: available ? 'Available' : 'Time slot is not available',
        doctor: {
          name: doctorData.doctorName,
          department: doctorData.doctorDepartment.departmentName,
          languages: doctorData.doctorLanguage,
          shift: doctorData.doctorShift
        },
      };
    }));

    // If no slots are available, find alternative slots
    let alternativeSlots = [];
    if (!results.some(result => result.available)) {
      alternativeSlots = await findNextAvailableSlots(doctorData, currentDateTime, slots[0].duration);
    }

    return JSON.stringify({
      status: 'success',
      results: results,
      alternativeSlots: alternativeSlots.map(slot => ({
        dateTime: moment(slot.startTime).format('YYYY-MM-DDTHH:mm:ss'),
        duration: slot.duration
      }))
    });

  } catch (error) {
    console.error('Error in checkAvailability:', error);
    return JSON.stringify({ 
      status: 'failure', 
      message: 'Error checking availability: ' + error.message 
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
    // Check if both start and end times are within 9 AM to 5 PM
    return startHour >= 9 && startHour < 17 && endHour >= 9 && endHour <= 17;
  } else if (shift === 'Night') {
    // For night shift (6 PM to 6 AM)
    if (startHour >= 18) {
      // Starting after 6 PM
      return endHour >= 18 || endHour <= 6;
    } else if (startHour < 6) {
      // Starting before 6 AM
      return endHour <= 6;
    }
  }
  
  return false;
}

async function findNextAvailableSlots(doctorData, startDateTime, duration) {
  const availableSlots = [];
  let currentDateTime = startDateTime.clone().startOf('hour');
  const endOfWeek = startDateTime.clone().add(7, 'days');

  while (currentDateTime.isBefore(endOfWeek) && availableSlots.length < 3) {
    if (isWithinWorkingHours(currentDateTime, duration, doctorData.doctorShift)) {
      const endDateTime = currentDateTime.clone().add(duration, 'minutes');
      
      // Convert times to UTC for database query
      const currentDateTimeUTC = currentDateTime.clone().utc();
      const endDateTimeUTC = endDateTime.clone().utc();

      // Check for existing appointments with proper time comparison
      const existingAppointment = await Appointment.findOne({
        doctor: doctorData._id,
        status: { $nin: ['cancelled', 'rejected', 'completed'] },
        $or: [
          {
            appointmentDateTime: { $lte: endDateTimeUTC.toDate() },
            endDateTime: { $gt: currentDateTimeUTC.toDate() }
          }
        ]
      });

      if (!existingAppointment) {
        availableSlots.push({
          startTime: currentDateTime.toDate(),
          endTime: endDateTime.toDate(),
          duration: duration,
          doctor: {
            name: doctorData.doctorName,
            department: doctorData.doctorDepartment.departmentName,
            languages: doctorData.doctorLanguage,
            shift: doctorData.doctorShift
          }
        });
      }
    }
    currentDateTime.add(30, 'minutes');
  }

  return availableSlots;
}

module.exports = checkAvailability;