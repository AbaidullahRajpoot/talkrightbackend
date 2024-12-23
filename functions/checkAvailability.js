const moment = require('moment-timezone');
const Doctor = require('../model/DoctorModel');
const Appointment = require('../model/AppointmentModel');

async function checkAvailability(functionArgs) {
  const { slots, doctor } = functionArgs;
  console.log('checkAvailability function called');

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

    const currentDateTime = moment().tz('Asia/Dubai');

    const results = await Promise.all(slots.map(async (slot) => {
      const { dateTime, duration } = slot;
      const startDateTime = moment.tz(dateTime, 'Asia/Dubai');
      
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
  console.log('isWithinWorkingHours function called for:', {
    dateTime: startDateTime.format('YYYY-MM-DD HH:mm:ss'),
    duration,
    shift
  });
  
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
    // For night shift (9 PM - 5 AM)
    if (startHour >= 21) {
      // Starting after 9 PM
      return endHour >= 21 || endHour <= 5;
    } else if (startHour < 5) {
      // Starting after midnight but before 5 AM
      return endHour <= 5;
    }
    return false;
  }
  
  return false;
}

async function findNextAvailableSlots(doctorData, startDateTime, duration) {
  console.log('findNextAvailableSlots function called');
  const availableSlots = [];
  let currentDateTime = startDateTime.clone().startOf('hour');
  const endOfWeek = startDateTime.clone().add(7, 'days');

  while (currentDateTime.isBefore(endOfWeek) && availableSlots.length < 3) {
    if (isWithinWorkingHours(currentDateTime, duration, doctorData.doctorShift)) {
      const endDateTime = currentDateTime.clone().add(duration, 'minutes');
      
      // Convert times to UTC for database comparison
      const utcStart = currentDateTime.clone().utc();
      const utcEnd = endDateTime.clone().utc();

      // Check for existing appointments
      const existingAppointment = await Appointment.findOne({
        doctor: doctorData._id,
        status: { $nin: ['cancelled'] },
        $or: [
          {
            $and: [
              { appointmentDateTime: { $lte: utcEnd.toDate() } },
              { endDateTime: { $gt: utcStart.toDate() } }
            ]
          }
        ]
      });

      console.log('Checking slot:', {
        start: currentDateTime.format('YYYY-MM-DD HH:mm:ss'),
        end: endDateTime.format('YYYY-MM-DD HH:mm:ss'),
        utcStart: utcStart.format('YYYY-MM-DD HH:mm:ss'),
        utcEnd: utcEnd.format('YYYY-MM-DD HH:mm:ss'),
        hasConflict: !!existingAppointment
      });

      if (!existingAppointment) {
        // Only add slots that are within working hours and have no conflicts
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

    // For night shift, if we pass 5 AM, jump to 9 PM of the same day
    if (doctorData.doctorShift === 'Night' && 
        currentDateTime.hour() >= 6 && 
        currentDateTime.hour() < 5) {
      currentDateTime.hour(5).minute(0).second(0);
    }
  }

  return availableSlots;
}

module.exports = checkAvailability;