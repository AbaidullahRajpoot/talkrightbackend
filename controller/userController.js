const twilio = require('twilio');
const Call = require('../model/callModel');

class userController {

    static async index(req, res) {
        try {
            res.status(200).json({ success: true, message: "Success", });
        } catch (error) {
            console.error("Something went wrong", error);
            res.status(500).json({ success: false, message: `Server Error ${error}` });
        }
    }

    static async getCallStatistics(req, res) {
        try {
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get all calls
            const calls = await client.calls.list();
            
            // Get today's calls
            const todayCalls = calls.filter(call => {
                const callDate = new Date(call.startTime);
                return callDate >= today;
            });

            // Calculate average duration
            const totalDuration = calls.reduce((sum, call) => {
                return sum + (parseInt(call.duration) || 0);
            }, 0);
            const averageDuration = calls.length ? Math.round(totalDuration / calls.length) : 0;

            // Format duration to minutes and seconds
            const formatDuration = (seconds) => {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                return `${minutes}m ${remainingSeconds}s`;
            };

            res.status(200).json({
                success: true,
                data: {
                    totalCalls: calls.length,
                    todayCalls: todayCalls.length,
                    averageCallTime: formatDuration(averageDuration)
                }
            });

        } catch (error) {
            console.error("Error fetching call statistics:", error);
            res.status(500).json({ 
                success: false, 
                message: "Error fetching call statistics",
                error: error.message 
            });
        }
    }

    static async getMonthlyCallStatistics(req, res) {
        try {
            const { month, year } = req.params;
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

            // Validate month and year
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);
            
            if (monthNum < 1 || monthNum > 12) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid month. Month should be between 1 and 12"
                });
            }

            // Create start and end date for the month
            const startDate = new Date(yearNum, monthNum - 1, 1);
            const endDate = new Date(yearNum, monthNum, 0); // Last day of the month
            
            // Get all calls for the month
            const calls = await client.calls.list({
                startTime: {
                    gte: startDate.toISOString(),
                    lte: endDate.toISOString()
                }
            });

            // Create daily statistics
            const dailyStats = {};
            
            // Initialize all days of the month with 0 calls
            for (let i = 1; i <= endDate.getDate(); i++) {
                dailyStats[i] = {
                    date: `${year}-${month.padStart(2, '0')}-${String(i).padStart(2, '0')}`,
                    totalCalls: 0,
                    totalDuration: 0,
                    averageDuration: 0,
                    successfulCalls: 0,
                    failedCalls: 0
                };
            }

            // Process each call
            calls.forEach(call => {
                const callDate = new Date(call.startTime);
                const day = callDate.getDate();
                
                dailyStats[day].totalCalls++;
                dailyStats[day].totalDuration += parseInt(call.duration) || 0;
                
                if (call.status === 'completed') {
                    dailyStats[day].successfulCalls++;
                } else {
                    dailyStats[day].failedCalls++;
                }

                // Calculate average duration
                dailyStats[day].averageDuration = Math.round(
                    dailyStats[day].totalDuration / dailyStats[day].totalCalls
                );
            });

            // Format the statistics
            const formattedStats = Object.values(dailyStats).map(stat => ({
                ...stat,
                totalDuration: userController.formatDuration(stat.totalDuration),
                averageDuration: userController.formatDuration(stat.averageDuration)
            }));

            res.status(200).json({
                success: true,
                data: {
                    month: monthNum,
                    year: yearNum,
                    totalCalls: calls.length,
                    dailyStatistics: formattedStats
                }
            });

        } catch (error) {
            console.error("Error fetching monthly call statistics:", error);
            res.status(500).json({ 
                success: false, 
                message: "Error fetching monthly call statistics",
                error: error.message 
            });
        }
    }

    // Helper function to format duration
    static formatDuration(seconds) {
        if (!seconds) return '0m 0s';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }

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

module.exports = userController;
