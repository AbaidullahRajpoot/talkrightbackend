const express = require('express');
const callController = require('../controller/callController');
const DepartmentController = require('../controller/departmentController');
const DoctorController = require('../controller/doctorController');
const CalendarController = require('../controller/calendarController');
const AppointmentController = require('../controller/appointmentController');
const CalendarSlot = require('../model/CalenderSlotModel');
const router = express.Router();
const Survey = require('../model/SurveyModel');

//=============Public Api Routes==================

router.get('/call-history', callController.getCallHistory);
router.get('/call-statistics/:month/:year', callController.getMonthlyCallStatistics);

//=============Department Api Routes==================

router.post('/departments', DepartmentController.createDepartment);
router.get('/departments', DepartmentController.getAllDepartments);
router.get('/departments/:id', DepartmentController.getDepartmentById);
router.put('/departments/:id', DepartmentController.updateDepartment);
router.delete('/departments/:id', DepartmentController.deleteDepartment);

//=============Doctor Api Routes==================

router.post('/doctors', DoctorController.createDoctor);
router.get('/doctors', DoctorController.getAllDoctors);
router.get('/get-doctor-info', DoctorController.getDoctorInfo);
router.get('/doctors/:id', DoctorController.getDoctorById);
router.put('/doctors/:id', DoctorController.updateDoctor);
router.delete('/doctors/:id', DoctorController.deleteDoctor);

//=============Calendar Api Routes==================

router.get('/calendar-events', CalendarController.getEvents);
router.post('/calendar-events', CalendarController.createEvent);
router.put('/calendar-events/:id', CalendarController.updateEvent);
router.delete('/calendar-events/:id', CalendarController.deleteEvent);

// Appointment routes
router.post('/appointments', AppointmentController.createAppointment);
router.get('/appointments/doctor/:doctorId', AppointmentController.getAppointmentsByDoctor);
router.patch('/appointments/:appointmentId/status', AppointmentController.updateAppointmentStatus);

// Calendar slot routes
router.get('/calendar-slots/doctor/:doctorId', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const slots = await CalendarSlot.find({
            doctor: req.params.doctorId,
            startTime: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        }).populate('doctor').sort('startTime');

        res.json({
            success: true,
            data: slots
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/calendar-slots/block', async (req, res) => {
    try {
        const { doctorId, startTime, endTime, notes } = req.body;
        const slot = new CalendarSlot({
            doctor: doctorId,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            status: 'blocked',
            notes
        });
        await slot.save();
        res.json({
            success: true,
            data: slot
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Submit a new survey
router.post('/surveys', async (req, res) => {
    try {
        const survey = new Survey(req.body);
        await survey.save();
        res.status(201).json({
            success: true,
            message: 'Survey submitted successfully',
            data: survey
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error submitting survey',
            error: error.message
        });
    }
});

// Get surveys for a specific doctor
router.get('/surveys/doctor/:doctorId', async (req, res) => {
    try {
        const surveys = await Survey.find({ doctor: req.params.doctorId })
            .populate('appointment')
            .sort('-createdAt');
        res.json({
            success: true,
            data: surveys
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching surveys',
            error: error.message
        });
    }
});

// Get survey statistics for a doctor
router.get('/surveys/stats/doctor/:doctorId', async (req, res) => {
    try {
        const stats = await Survey.aggregate([
            { $match: { doctor: mongoose.Types.ObjectId(req.params.doctorId) } },
            {
                $group: {
                    _id: null,
                    averageOverall: { $avg: '$ratings.overall' },
                    averageWaitingTime: { $avg: '$ratings.waitingTime' },
                    averageDoctorBehavior: { $avg: '$ratings.doctorBehavior' },
                    averageCleanliness: { $avg: '$ratings.cleanliness' },
                    recommendationRate: {
                        $avg: { $cond: ['$recommendToOthers', 1, 0] }
                    },
                    totalSurveys: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: stats[0] || {
                averageOverall: 0,
                totalSurveys: 0
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching survey statistics',
            error: error.message
        });
    }
});

module.exports = router;
