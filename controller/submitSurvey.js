const Survey = require('../model/SurveyModel');
const Appointment = require('../model/AppointmentModel');
const Doctor = require('../model/DoctorModel');
async function submitSurvey(functionArgs) {
   const {
       appointmentId,
       ratings,
       feedback,
       recommendToOthers
   } = functionArgs;
    try {
       // Find the appointment
       const appointment = await Appointment.findOne({ appointmentId })
           .populate('doctor');
        if (!appointment) {
           return JSON.stringify({
               status: 'failure',
               message: 'Appointment not found'
           });
       }
        // Check if survey already exists
       const existingSurvey = await Survey.findOne({
           appointment: appointment._id
       });
        if (existingSurvey) {
           return JSON.stringify({
               status: 'failure',
               message: 'Survey already submitted for this appointment'
           });
       }
        // Create new survey
       const survey = new Survey({
           appointment: appointment._id,
           doctor: appointment.doctor._id,
           patient: {
               name: appointment.patient.name,
               email: appointment.patient.email
           },
           ratings: {
               overall: ratings.overall,
               waitingTime: ratings.waitingTime,
               doctorBehavior: ratings.doctorBehavior,
               cleanliness: ratings.cleanliness
           },
           feedback: feedback,
           recommendToOthers: recommendToOthers,
           visitDate: appointment.appointmentDateTime
       });
        await survey.save();
        return JSON.stringify({
           status: 'success',
           message: 'Survey submitted successfully',
           data: {
               appointmentId: appointmentId,
               doctorName: appointment.doctor.doctorName,
               surveyDate: new Date()
           }
       });
    } catch (error) {
       console.error('Error in submitSurvey:', error);
       return JSON.stringify({
           status: 'failure',
           message: 'Failed to submit survey: ' + error.message
       });
   }
}

module.exports = submitSurvey;