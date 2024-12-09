const Call = require('../model/callModel');
const FormatHelper = require('../helpers/formatHelper');

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
            // Get today's date at midnight
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get all calls
            const calls = await Call.find()
                .sort({ startTime: -1 })
                .limit(100);

            // Get today's new calls
            const todayCalls = await Call.countDocuments({
                startTime: { $gte: today }
            });

            // Calculate total calls
            const totalCalls = await Call.countDocuments();

            // Calculate average duration
            const durationStats = await Call.aggregate([
                {
                    $match: {
                        duration: { $exists: true, $ne: null },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        averageDuration: { $avg: '$duration' },
                        totalDuration: { $sum: '$duration' }
                    }
                }
            ]);

            // Format duration helper function
            const formatDuration = (seconds) => {
                if (!seconds) return '0m 0s';
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = Math.floor(seconds % 60);
                return `${minutes}m ${remainingSeconds}s`;
            };

            // Get average duration
            const averageDuration = durationStats.length > 0
                ? formatDuration(durationStats[0].averageDuration)
                : '0m 0s';

            // Get total duration
            const totalDuration = durationStats.length > 0
                ? formatDuration(durationStats[0].totalDuration)
                : '0m 0s';

            res.status(200).json({
                success: true,
                data: {
                    statistics: {
                        totalCalls,
                        todayCalls,
                        averageDuration,
                        totalDuration
                    },
                    recentCalls: calls.map(call => ({
                        callSid: call.callSid,
                        phoneNumber: call.phoneNumber,
                        duration: formatDuration(call.duration),
                        status: call.status,
                        startTime: call.startTime,
                        endTime: call.endTime
                    }))
                }
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

    static async getMonthlyCallStatistics(req, res) {
        try {
            const { month, year } = req.params;

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

            // Initialize arrays for the series data
            const daysInMonth = endDate.getDate();
            const totalCallsData = new Array(daysInMonth).fill(0);
            const receivedCallsData = new Array(daysInMonth).fill(0);

            // Get all calls for the month
            const monthCalls = await Call.find({
                startTime: {
                    $gte: startDate,
                    $lte: endDate
                }
            }).sort({ startTime: 1 });

            // Process calls into daily counts
            monthCalls.forEach(call => {
                const dayIndex = new Date(call.startTime).getDate() - 1;

                // Count total calls
                totalCallsData[dayIndex]++;

                // Count received/completed calls
                if (call.status === 'completed' && call.duration > 0) {
                    receivedCallsData[dayIndex]++;
                }
            });

            // Format response for the chart
            const series = [
                {
                    name: 'Total Calls',
                    type: 'column',
                    data: totalCallsData
                },
                {
                    name: 'Received Calls',
                    type: 'line',
                    data: receivedCallsData
                }
            ];

            // Calculate summary statistics
            const completedCalls = monthCalls.filter(call => call.status === 'completed' && call.duration > 0);
            const monthSummary = {
                totalCalls: monthCalls.length,
                receivedCalls: completedCalls.length,
                failedCalls: monthCalls.filter(call => call.status === 'failed' || call.duration === 0).length,
                averageDuration: FormatHelper.formatDuration(
                    completedCalls.reduce((sum, call) => sum + (call.duration || 0), 0) / completedCalls.length || 0
                )
            };

            res.status(200).json({
                success: true,
                data: {
                    month: monthNum,
                    year: yearNum,
                    series,
                    summary: monthSummary,
                    categories: Array.from({ length: daysInMonth }, (_, i) => i + 1)
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

}

module.exports = callController;
