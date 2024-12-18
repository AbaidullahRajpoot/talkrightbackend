const Doctor = require('../model/DoctorModel');
const CalendarController = require('../controller/calendarController');
const moment = require('moment-timezone');

async function checkAvailability(functionArgs) {
    const { slots, doctor } = functionArgs;

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

        const results = await Promise.all(slots.map(async (slot) => {
            const { dateTime, duration } = slot;
            const startDateTime = moment.tz(dateTime, 'Asia/Dubai');

            // Check if time is in the past
            if (startDateTime.isBefore(moment())) {
                return {
                    dateTime: dateTime,
                    available: false,
                    message: 'Time slot is in the past'
                };
            }

            // Check availability
            const availability = await CalendarController.checkSlotAvailability(
                doctorData._id,
                startDateTime.toDate(),
                duration
            );

            if (!availability.available) {
                return {
                    dateTime: dateTime,
                    available: false,
                    message: 'Time slot is not available',
                    alternativeSlots: availability.alternativeSlots
                };
            }

            return {
                dateTime: dateTime,
                available: true,
                doctor: {
                    name: doctorData.doctorName,
                    department: doctorData.doctorDepartment.departmentName
                }
            };
        }));

        return JSON.stringify({
            status: 'success',
            results: results
        });

    } catch (error) {
        console.error('Error in checkAvailability:', error);
        return JSON.stringify({
            status: 'failure',
            message: 'An error occurred while checking availability: ' + error.message
        });
    }
}

module.exports = checkAvailability;