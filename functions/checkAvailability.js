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
  console.log('Current time (UTC):', startDateTime.format('YYYY-MM-DD HH:mm:ss'));
  console.log('Current time (Dubai):', startDateTime.tz('Asia/Dubai').format('YYYY-MM-DD HH:mm:ss'));
  console.log('Doctor shift:', doctorData.doctorShift);

  const availableSlots = [];
  let currentDateTime = startDateTime.clone().startOf('hour').add(1, 'hour');
  const endOfWeek = startDateTime.clone().add(7, 'days');

  // For night shift, adjust start time to 9 PM if before 9 PM
  if (doctorData.doctorShift === 'Night') {
    console.log('Before adjustment:', currentDateTime.format('HH:mm'));
    if (currentDateTime.hour() < 21) {
      currentDateTime.hour(21).minute(0).second(0);
    }
    console.log('After adjustment:', currentDateTime.format('HH:mm'));
  }

  while (currentDateTime.isBefore(endOfWeek) && availableSlots.length < 3) {
    const isWithinHours = isWithinWorkingHours(currentDateTime, duration, doctorData.doctorShift);
    console.log(`Checking time ${currentDateTime.format('HH:mm')}, within hours: ${isWithinHours}`);
    
    if (isWithinHours) {
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
    
    // For night shift, handle day boundary
    if (doctorData.doctorShift === 'Night' && currentDateTime.hour() === 6) {
      currentDateTime.add(15, 'hours');
      console.log('Jumped to next night shift:', currentDateTime.format('HH:mm'));
    } else {
      currentDateTime.add(30, 'minutes');
    }
  }

  return availableSlots;
}

module.exports = checkAvailability;