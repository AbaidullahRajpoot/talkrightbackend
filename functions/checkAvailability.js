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
      const startDateTime = moment.tz(dateTime, 'YYYY-MM-DDTHH:mm:ss', 'Asia/Dubai');
      
      console.log('Requested start time (Dubai):', startDateTime.format());
      
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

      // Store appointment times in UTC
      const startDateTimeUTC = startDateTime.clone().utc();
      const endDateTimeUTC = endDateTime.clone().utc();

      console.log('Checking appointment overlap:', {
        start: startDateTimeUTC.format(),
        end: endDateTimeUTC.format()
      });

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
      };
    }));

    let alternativeSlots = [];
    if (!results.some(result => result.available)) {
      alternativeSlots = await findNextAvailableSlots(doctorData, currentDateTime, slots[0].duration);
    }

    return JSON.stringify({
      status: 'success',
      results: results,
      alternativeSlots: alternativeSlots.map(slot => slot.format('YYYY-MM-DDTHH:mm:ss')),
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

  if (shift === 'Day') {
    return startHour >= 9 && endHour <= 17;
  } else if (shift === 'Night') {
    return (startHour >= 21 || startHour < 5) && (endHour >= 21 || endHour <= 5);
  }
  return false;
}

async function findNextAvailableSlots(doctorData, startDateTime, duration) {
  let currentDateTime = startDateTime.clone();
  const endOfDay = startDateTime.clone().endOf('day');
  const availableSlots = [];

  while (currentDateTime.isBefore(endOfDay) && availableSlots.length < 3) {
    if (isWithinWorkingHours(currentDateTime, duration, doctorData.doctorShift)) {
      const endDateTime = currentDateTime.clone().add(duration, 'minutes');
      
      // Convert times to UTC for database query
      const currentDateTimeUTC = currentDateTime.clone().utc();
      const endDateTimeUTC = endDateTime.clone().utc();

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
        availableSlots.push(currentDateTime.clone());
      }
    }
    currentDateTime.add(30, 'minutes');
  }

  if (availableSlots.length < 3) {
    const nextDaySlots = await findNextAvailableSlots(doctorData, startDateTime.clone().add(1, 'day').startOf('day'), duration);
    availableSlots.push(...nextDaySlots);
  }

  return availableSlots.slice(0, 3);
}

module.exports = checkAvailability;