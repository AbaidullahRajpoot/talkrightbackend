const SurveyController = require('../controller/surveyController');

async function submitSurvey(data) {
    try {
        console.log('Submitting survey with data:', data);
        const result = await SurveyController.submitSurvey(data);
        console.log('Survey submission result:', result);
        return result;
    } catch (error) {
        console.error('Error in submitSurvey function:', error);
        return {
            success: false,
            message: 'Failed to submit survey',
            error: error.message
        };
    }
}

module.exports = submitSurvey; 