const moment = require('moment-timezone');
const Doctor = require('../model/DoctorModel');
const Appointment = require('../model/AppointmentModel');

async function checkAvailability(functionArgs) {
  const { slots, doctor } = functionArgs;

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
      console.log("doctorData._id",doctorData._id);
      console.log("existingAppointment",existingAppointment);
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
    return ((startHour >= 21 || startHour < 5) && (endHour >= 21 || endHour <= 5));
  }
  
  return false;
}

async function findNextAvailableSlots(doctorData, startDateTime, duration) {
  const availableSlots = [];
  let currentDateTime = startDateTime.clone();
  if (currentDateTime.minutes() > 0) {
    currentDateTime.add(1, 'hour').startOf('hour');
  }
  const endOfWeek = startDateTime.clone().add(7, 'days');

  while (currentDateTime.isBefore(endOfWeek) && availableSlots.length < 3) {
    if (isWithinWorkingHours(currentDateTime, duration, doctorData.doctorShift)) {
      const endDateTime = currentDateTime.clone().add(duration, 'minutes');
      
      // Check for existing appointments
      const existingAppointment = await Appointment.findOne({
        doctor: doctorData._id,
        status: { $nin: ['cancelled'] },
        $or: [
          {
            appointmentDateTime: { $lt: endDateTime.toDate() },
            endDateTime: { $gt: currentDateTime.toDate() }
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