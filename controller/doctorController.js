const Doctor = require('../model/DoctorModel');
const Department = require('../model/DepartmentModel');

class DoctorController {
    // Create new doctor
    static async createDoctor(req, res) {
        try {
            // Verify department exists
            const department = await Department.findById(req.body.doctorDepartment);
            if (!department) {
                return res.status(404).json({
                    success: false,
                    message: 'Department not found'
                });
            }

            const doctor = new Doctor(req.body);
            const savedDoctor = await doctor.save();

            // Populate department info
            await savedDoctor.populate('doctorDepartment');

            res.status(201).json({
                success: true,
                message: 'Doctor created successfully',
                data: savedDoctor
            });
        } catch (error) {
            console.error('Error creating doctor:', error);
            res.status(400).json({
                success: false,
                message: 'Error creating doctor',
                error: error.message
            });
        }
    }

    // Get all doctors
    static async getAllDoctors(req, res) {
        try {
            const doctors = await Doctor.find()
                .populate('doctorDepartment')
                .sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                data: doctors
            });
        } catch (error) {
            console.error('Error fetching doctors:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching doctors',
                error: error.message
            });
        }
    }

    // Get doctor info
    static async getDoctorInfo() {
        try {
            const doctors = await Doctor.find()
                .populate('doctorDepartment')
                .sort({ createdAt: -1 });

            const formattedDoctorInfo = {};

            doctors.forEach(doctor => {
                formattedDoctorInfo[`Dr. ${doctor.doctorName}`] = {
                    department: doctor.doctorDepartment ? doctor.doctorDepartment.departmentName : 'Unknown',
                    languages: doctor.doctorLanguage,
                    gender: doctor.doctorGender,
                    shift: doctor.doctorShift
                };
            });

            return formattedDoctorInfo;
        } catch (error) {
            console.error('Error fetching doctors:', error);
            throw error;
        }
    }

    // Get single doctor
    static async getDoctorById(req, res) {
        try {
            const doctor = await Doctor.findById(req.params.id)
                .populate('doctorDepartment');

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            res.status(200).json({
                success: true,
                data: doctor
            });
        } catch (error) {
            console.error('Error fetching doctor:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching doctor',
                error: error.message
            });
        }
    }

    // Update doctor
    static async updateDoctor(req, res) {
        try {
            if (req.body.department) {
                // Verify department exists if being updated
                const department = await Department.findById(req.body.department);
                if (!department) {
                    return res.status(404).json({
                        success: false,
                        message: 'Department not found'
                    });
                }
            }

            const doctor = await Doctor.findByIdAndUpdate(
                req.params.id,
                req.body,
                {
                    new: true,
                    runValidators: true
                }
            ).populate('doctorDepartment');

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Doctor updated successfully',
                data: doctor
            });
        } catch (error) {
            console.error('Error updating doctor:', error);
            res.status(400).json({
                success: false,
                message: 'Error updating doctor',
                error: error.message
            });
        }
    }

    // Delete doctor
    static async deleteDoctor(req, res) {
        try {
            const doctor = await Doctor.findByIdAndDelete(req.params.id);

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Doctor deleted successfully',
                data: doctor
            });
        } catch (error) {
            console.error('Error deleting doctor:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting doctor',
                error: error.message
            });
        }
    }

}

module.exports = DoctorController;