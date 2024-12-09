const Call = require('../model/callModel');

class callController {

    static async trackCallStart(callSid, phoneNumber) {
        try {
            const call = new Call({
                callSid,
                phoneNumber,
                status: 'ongoing'
            });
            await call.save();
            console.log(`Call tracking started for ${callSid}`);
        } catch (error) {
            console.error('Error tracking call start:', error);
        }
    }

    static async trackCallEnd(callSid) {
        try {
            const call = await Call.findOne({ callSid });
            if (call) {
                const endTime = new Date();
                const duration = Math.round((endTime - call.startTime) / 1000); // duration in seconds
                
                call.endTime = endTime;
                call.duration = duration;
                call.status = 'completed';
                await call.save();
                
                console.log(`Call tracking ended for ${callSid}, duration: ${duration}s`);
            }
        } catch (error) {
            console.error('Error tracking call end:', error);
        }
    }

    static async getCallHistory(req, res) {
        try {
            const calls = await Call.find()
                .sort({ startTime: -1 })
                .limit(100);

            res.status(200).json({
                success: true,
                data: calls
            });
        } catch (error) {
            console.error('Error fetching call history:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching call history',
                error: error.message
            });
        }
    }

}

module.exports = callController;
