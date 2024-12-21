const express = require('express');
const callController = require('../controller/callController');
const DepartmentController = require('../controller/departmentController');
const DoctorController = require('../controller/doctorController');
const CalendarController = require('../controller/calendarController');
const AppointmentController = require('../controller/appointmentController');
const router = express.Router();

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
router.get('/doctors/department/:id', DoctorController.getAllDoctorsByDepartment);

//=============Calendar Api Routes==================

router.get('/calendar-events', CalendarController.getEvents);
router.post('/calendar-events', CalendarController.createEvent);
router.put('/calendar-events/:id', CalendarController.updateEvent);
router.delete('/calendar-events/:id', CalendarController.deleteEvent);

// Appointment routes
router.post('/appointments', AppointmentController.createAppointment);
router.get('/appointments/doctor/:doctorId', AppointmentController.getAppointmentsByDoctor);
router.patch('/appointments/:appointmentId/status', AppointmentController.updateAppointmentStatus);
router.get('/get-appointments-calendar', AppointmentController.getAppointmentsCalendar);

//Appointment Calendar Api Routes
router.post('/calendar-appointments', AppointmentController.createAppointmentCalendar);
router.put('/calendar-appointments/:id', AppointmentController.updateCalendarAppointment);
router.delete('/calendar-appointments/:id', AppointmentController.deleteCalendarAppointment);

module.exports = router;
