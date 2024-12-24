const Rating = require('../model/RatingModel');

async function saveUserRating(params) {
    try {
        const { callQualityRating, needsAddressedRating } = params;
        console.log('callQualityRating', callQualityRating);
        console.log('needsAddressedRating', needsAddressedRating);

        // Create a new document in the 'ratings' collection
        const ratingData = {
            callQualityRating,
            needsAddressedRating,
            timestamp: new Date().toISOString()
        };
        const rating = new Rating(ratingData);
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

module.exports = saveUserRating; 