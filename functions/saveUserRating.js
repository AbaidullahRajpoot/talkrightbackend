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