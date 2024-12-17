const Department = require('../model/DepartmentModel');

class DepartmentController {
    // Create new department
    static async createDepartment(req, res) {
        try {
            const department = new Department(req.body);
            const savedDepartment = await department.save();

            res.status(201).json({
                success: true,
                message: 'Data saved successfully',
                data: savedDepartment
            });
        } catch (error) {
            console.error('Error creating department:', error);
            res.status(400).json({
                success: false,
                message: 'Error creating department',
                error: error.message
            });
        }
    }

    // Get all departments
    static async getAllDepartments(req, res) {
        try {
            const departments = await Department.find();

            res.status(200).json({
                success: true,
                data: departments
            });
        } catch (error) {
            console.error('Error fetching departments:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching departments',
                error: error.message
            });
        }
    }

    // Get single department by ID
    static async getDepartmentById(req, res) {
        try {
            const department = await Department.findById(req.params.id);

            if (!department) {
                return res.status(404).json({
                    success: false,
                    message: 'Department not found'
                });
            }

            res.status(200).json({
                success: true,
                data: department
            });
        } catch (error) {
            console.error('Error fetching department:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching department',
                error: error.message
            });
        }
    }

    // Update department
    static async updateDepartment(req, res) {
        try {
            const department = await Department.findByIdAndUpdate(
                req.params.id,
                req.body,
                {
                    new: true,
                    runValidators: true
                }
            );

            if (!department) {
                return res.status(404).json({
                    success: false,
                    message: 'Department not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Data saved successfully',
                data: department
            });
        } catch (error) {
            console.error('Error updating department:', error);
            res.status(400).json({
                success: false,
                message: 'Error updating department',
                error: error.message
            });
        }
    }

    // Delete department
    static async deleteDepartment(req, res) {
        try {
            const department = await Department.findByIdAndDelete(req.params.id);

            if (!department) {
                return res.status(404).json({
                    success: false,
                    message: 'Department not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Department deleted successfully',
                data: department
            });
        } catch (error) {
            console.error('Error deleting department:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting department',
                error: error.message
            });
        }
    }
}

module.exports = DepartmentController;