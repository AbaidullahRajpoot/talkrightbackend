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
      
      // Parse the input time as Dubai time
      const startDateTime = moment.tz(dateTime, 'YYYY-MM-DDTHH:mm:ss', 'Asia/Dubai');
      console.log('Original Dubai Time:', dateTime);
      console.log('Parsed Dubai Time:', startDateTime.format('YYYY-MM-DD HH:mm:ss Z'));
      
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
      
      // Convert to UTC for database storage
      const startDateTimeUTC = startDateTime.clone().utc();
      const endDateTimeUTC = endDateTime.clone().utc();
      
      console.log('Appointment Times:');
      console.log('Dubai Start:', startDateTime.format('YYYY-MM-DD HH:mm:ss Z'));
      console.log('Dubai End:', endDateTime.format('YYYY-MM-DD HH:mm:ss Z'));
      console.log('UTC Start:', startDateTimeUTC.format('YYYY-MM-DD HH:mm:ss Z'));
      console.log('UTC End:', endDateTimeUTC.format('YYYY-MM-DD HH:mm:ss Z'));

      // Enhanced check for existing appointments with proper time comparison
      const existingAppointment = await Appointment.findOne({
        doctor: doctorData._id,
        status: { $nin: ['cancelled', 'rejected', 'completed'] },
        $or: [
          {
            appointmentDateTime: { $lt: endDateTimeUTC.toDate() },
            endDateTime: { $gt: startDateTimeUTC.toDate() }
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
        },
        debug: {
          dubaiTime: startDateTime.format('YYYY-MM-DD HH:mm:ss Z'),
          utcTime: startDateTimeUTC.format('YYYY-MM-DD HH:mm:ss Z')
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
        dateTime: moment.tz(slot.startTime, 'Asia/Dubai').format('YYYY-MM-DDTHH:mm:ss'),
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
    return startHour >= 9 && endHour <= 17;
  } else if (shift === 'Night') {
    return (startHour >= 18 || startHour < 6) && (endHour >= 18 || endHour <= 6);
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
    }
    currentDateTime.add(30, 'minutes');
  }

  return availableSlots;
}

module.exports = checkAvailability;