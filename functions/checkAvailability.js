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
      
      if (startDateTime.isBefore(currentDateTime)) {
        return {
          dateTime: dateTime,
          available: false,
          message: 'Requested time is in the past',
        };
      }

      if (!isWithinWorkingHours(startDateTime, duration, doctorData.doctorShift)) {
        return {
          dateTime: dateTime,
          available: false,
          message: 'Requested time is outside of doctor\'s working hours',
        };
      }

      const endDateTime = startDateTime.clone().add(duration, 'minutes');

      // Get all overlapping appointments
      const existingAppointments = await Appointment.find({
        doctor: doctorData._id,
        status: { $nin: ['cancelled'] },
        $or: [
          {
            appointmentDateTime: { $lt: endDateTime.toDate() },
            endDateTime: { $gt: startDateTime.toDate() }
          }
        ]
      });

      const available = existingAppointments.length === 0;
      
      return {
        dateTime: dateTime,
        available: available,
        message: available ? 'Available' : 'Time slot is not available',
        events: existingAppointments.map(apt => ({
          summary: `Appointment with Patient`,
          start: apt.appointmentDateTime,
          end: apt.endDateTime,
          status: apt.status
        })),
        doctor: {
          name: doctorData.doctorName,
          department: doctorData.doctorDepartment.departmentName,
          languages: doctorData.doctorLanguage,
          shift: doctorData.doctorShift
        }
      };
    }));

    let alternativeSlots = [];
    if (!results.some(result => result.available)) {
      alternativeSlots = await findNextAvailableSlots(doctorData, currentDateTime, slots[0].duration);
    }

    return JSON.stringify({
      status: 'success',
      results: results,
      alternativeSlots: alternativeSlots.map(slot => ({
        dateTime: moment(slot.startTime).format('YYYY-MM-DDTHH:mm:ss'),
        duration: slot.duration,
        events: slot.events || []
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

async function findNextAvailableSlots(doctorData, startDateTime, duration) {
  const availableSlots = [];
  let currentDateTime = startDateTime.clone();
  
  // Adjust start time based on shift
  if (doctorData.doctorShift === 'Day') {
    if (currentDateTime.hour() < 9) {
      currentDateTime.hour(9).minute(0).second(0);
    } else if (currentDateTime.hour() >= 17) {
      currentDateTime.add(1, 'day').hour(9).minute(0).second(0);
    }
  } else if (doctorData.doctorShift === 'Night') {
    if (currentDateTime.hour() < 21) {
      currentDateTime.hour(21).minute(0).second(0);
    } else if (currentDateTime.hour() >= 6) {
      currentDateTime.hour(21).minute(0).second(0);
    }
  }

  const endOfWeek = startDateTime.clone().add(7, 'days');

  while (currentDateTime.isBefore(endOfWeek) && availableSlots.length < 3) {
    if (isWithinWorkingHours(currentDateTime, duration, doctorData.doctorShift)) {
      const endDateTime = currentDateTime.clone().add(duration, 'minutes');
      
      // Get all overlapping appointments
      const existingAppointments = await Appointment.find({
        doctor: doctorData._id,
        status: { $nin: ['cancelled'] },
        appointmentDateTime: { $lt: endDateTime.toDate() },
        endDateTime: { $gt: currentDateTime.toDate() }
      });

      if (existingAppointments.length === 0) {
        availableSlots.push({
          startTime: currentDateTime.toDate(),
          endTime: endDateTime.toDate(),
          duration: duration,
          events: [], // Empty array since slot is available
          doctor: {
            name: doctorData.doctorName,
            department: doctorData.doctorDepartment.departmentName,
            languages: doctorData.doctorLanguage,
            shift: doctorData.doctorShift
          }
        });
      }
    }

    // Increment time based on doctor's shift
    if (doctorData.doctorShift === 'Day') {
      if (currentDateTime.hour() >= 17) {
        currentDateTime.add(1, 'day').hour(9).minute(0).second(0);
      } else {
        currentDateTime.add(30, 'minutes');
      }
    } else if (doctorData.doctorShift === 'Night') {
      if (currentDateTime.hour() >= 6 && currentDateTime.hour() < 21) {
        currentDateTime.hour(21).minute(0).second(0);
      } else {
        currentDateTime.add(30, 'minutes');
      }
    }
  }

  return availableSlots;
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
    // Handle night shift that crosses midnight
    if (startHour >= 21) {
      // Evening part (21:00-23:59)
      return endHour >= 21 || endHour <= 6;
    } else if (startHour < 6) {
      // Early morning part (00:00-06:00)
      return endHour <= 6;
    }
    return false;
  }
  
  return false;
}

module.exports = checkAvailability;