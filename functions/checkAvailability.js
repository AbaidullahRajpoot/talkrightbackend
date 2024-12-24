const moment = require('moment-timezone');
const Doctor = require('../model/DoctorModel');
const Appointment = require('../model/AppointmentModel');

async function checkAvailability(functionArgs) {
  const { slots, doctor } = functionArgs;
  console.log('checkAvailability function called');
  console.log('slots', slots);
  console.log('doctor', doctor);

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

    if (!doctorData) {
      return JSON.stringify({
        status: 'failure',
        message: 'Doctor not found in database'
      });
    }

    // Explicitly set timezone to Dubai for all time comparisons
    const currentDateTime = moment().tz('Asia/Dubai');

    const results = await Promise.all(slots.map(async (slot) => {
      const { dateTime, duration } = slot;
      // Ensure the slot time is also in Dubai timezone
      const startDateTime = moment.tz(dateTime, 'Asia/Dubai');
      
      // Add a buffer time (e.g., 30 minutes) for near-term appointments
      const bufferTime = currentDateTime.clone().add(30, 'minutes');
      
      // Check if requested time is too close to current time
      if (startDateTime.isBefore(bufferTime)) {
        return {
          dateTime: dateTime,
          available: false,
          message: 'Appointment time must be at least 30 minutes in the future',
        };
      }

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

      // Check for existing appointments
      const existingAppointment = await Appointment.findOne({
        doctor: doctorData._id,
        status: { $nin: ['cancelled'] },
        $or: [
          {
            appointmentDateTime: { $lt: endDateTime.toDate() },
            endDateTime: { $gt: startDateTime.toDate() }
          }
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
        }
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
  console.log('isWithinWorkingHours function called');
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
    return (startHour >= 21 || startHour < 5) && (endHour >= 21 || endHour <= 5);
  }

  return false;
}

async function findNextAvailableSlots(doctorData, startDateTime, duration) {
  console.log('findNextAvailableSlots function called');
  const availableSlots = [];
  let currentDateTime = startDateTime.clone().startOf('hour');
  const endOfWeek = startDateTime.clone().add(7, 'days');

  // Set initial time based on shift
  if (doctorData.doctorShift === 'Day') {
    currentDateTime.hour(9); // Start at 9 AM
  } else if (doctorData.doctorShift === 'Night') {
    currentDateTime.hour(21); // Start at 9 PM
  }

  while (currentDateTime.isBefore(endOfWeek) && availableSlots.length < 3) {
    // Skip to next day's shift start if current time is past shift end
    if (doctorData.doctorShift === 'Day' && currentDateTime.hour() >= 17) {
      currentDateTime.add(1, 'day').hour(9);
      continue;
    } else if (doctorData.doctorShift === 'Night' && currentDateTime.hour() >= 5) {
      currentDateTime.add(1, 'day').hour(21);
      continue;
    }

    // Skip weekends
    if (currentDateTime.day() === 0 || currentDateTime.day() === 6) {
      currentDateTime.add(1, 'day');
      if (doctorData.doctorShift === 'Day') {
        currentDateTime.hour(9);
      } else {
        currentDateTime.hour(21);
      }
      continue;
    }

    // Skip if outside working hours
    const endDateTime = currentDateTime.clone().add(duration, 'minutes');
    const startHour = currentDateTime.hour();
    const endHour = endDateTime.hour();

    if (doctorData.doctorShift === 'Day' && (startHour < 9 || endHour > 17)) {
      currentDateTime.add(30, 'minutes');
      continue;
    } else if (doctorData.doctorShift === 'Night' &&
      !((startHour >= 21 || startHour < 5) && (endHour >= 21 || endHour <= 5))) {
      currentDateTime.add(30, 'minutes');
      continue;
    }

    // Check for existing appointments
    const existingAppointment = await Appointment.findOne({
      doctor: doctorData._id,
      status: { $nin: ['cancelled'] },
      appointmentDateTime: { $lt: endDateTime.toDate() },
      endDateTime: { $gt: currentDateTime.toDate() }
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

    currentDateTime.add(30, 'minutes');
  }

  return availableSlots;
}

module.exports = checkAvailability;