const Survey = require('../model/SurveyModel');
const mongoose = require('mongoose');

class SurveyController {
    static async submitSurvey(surveyData) {
        try {
            console.log('Received survey data:', surveyData);
            const { appointmentId, ratings, feedback, recommendToOthers } = surveyData;

            if (!appointmentId) {
                throw new Error('Appointment ID is required');
            }

            // Convert string ID to MongoDB ObjectId
            const mongoAppointmentId = mongoose.Types.ObjectId(appointmentId);

            const survey = new Survey({
                appointmentId: mongoAppointmentId,
                ratings,
                feedback,
                recommendToOthers
            });

            console.log('Created survey document:', survey);
            const savedSurvey = await survey.save();
            console.log('Saved survey:', savedSurvey);

            return {
                success: true,
                message: 'Survey submitted successfully',
                data: savedSurvey
            };
        } catch (error) {
            console.error('Error submitting survey:', error);
            return {
                success: false,
                message: 'Error submitting survey',
                error: error.message
            };
        }
    }

    static async getSurveysByAppointment(appointmentId) {
        try {
            const mongoAppointmentId = mongoose.Types.ObjectId(appointmentId);
            const surveys = await Survey.find({ appointmentId: mongoAppointmentId })
                .sort({ createdAt: -1 });
            return {
                success: true,
                data: surveys
            };
        } catch (error) {
            console.error('Error fetching surveys:', error);
            return {
                success: false,
                message: 'Error fetching surveys',
                error: error.message
            };
        }
    }
}

module.exports = SurveyController; 