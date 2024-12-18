const Doctor = require('../model/DoctorModel');

/**
 * Recommends a doctor based on department and patient preferences
 * @param {Object} options - The options for doctor recommendation
 * @param {string} options.department - The medical department needed
 * @param {string} [options.language] - Preferred language of the doctor (optional)
 * @param {string} [options.gender] - Preferred gender of the doctor (optional)
 * @returns {Object} The recommendation result
 */
async function recommendDoctor({ department, language, gender }) {
  try {
    const query = {};
    
    if (department) {
      query['doctorDepartment.departmentName'] = { 
        $regex: department, 
        $options: 'i' 
      };
    }
    
    if (language) {
      query.doctorLanguage = { $in: [language] };
    }
    
    if (gender) {
      query.doctorGender = { 
        $regex: `^${gender}$`, 
        $options: 'i' 
      };
    }

    const doctors = await Doctor.find(query)
      .populate('doctorDepartment');

    if (!doctors || doctors.length === 0) {
      return {
        status: 'no_match',
        message: 'I apologize, but I couldn\'t find a doctor matching your criteria. Would you like to broaden the search?'
      };
    }

    const recommendedDoctor = doctors[Math.floor(Math.random() * doctors.length)];

    return {
      status: 'success',
      doctor: `Dr. ${recommendedDoctor.doctorName}`,
      department: recommendedDoctor.doctorDepartment.departmentName,
      languages: recommendedDoctor.doctorLanguage,
      gender: recommendedDoctor.doctorGender,
      shift: recommendedDoctor.doctorShift
    };

  } catch (error) {
    console.error('Error in recommendDoctor:', error);
    return {
      status: 'error',
      message: 'An error occurred while finding a doctor'
    };
  }
}

module.exports = recommendDoctor;