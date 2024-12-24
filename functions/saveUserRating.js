const Rating = require('../model/RatingModel');

async function saveUserRating(params) {
    try {
        const { callQualityRating, needsAddressedRating } = params;
        console.log('callQualityRating', callQualityRating);
        console.log('needsAddressedRating', needsAddressedRating);

        // Create a new rating document
        const rating = new Rating({
            callQualityRating,
            needsAddressedRating
        });

        // Save to database
        await rating.save();

        return {
            status: 'success',
            message: 'Ratings saved successfully'
        };
    } catch (error) {
        console.error('Error saving ratings:', error);
        return {
            status: 'failure',
            message: 'Failed to save ratings: ' + error.message
        };
    }
}