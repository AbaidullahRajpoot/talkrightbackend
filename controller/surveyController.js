const Survey = require('../model/SurveyModel');

class SurveyController {
    static async submitSurvey(req, res) {
        try {
            const { appointmentId, ratings, feedback, recommendToOthers } = req.body;

            const survey = new Survey({
                appointmentId,
                ratings,
                feedback,
                recommendToOthers
            });

            const savedSurvey = await survey.save();

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
            const surveys = await Survey.find({ appointmentId })
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