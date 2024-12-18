const doctorCalendars = require('./doctorCalendars');
const { getDoctorInfo } = require('../services/doctor-info-service');

/**
 * Recommends a doctor based on department and patient preferences
 * @param {Object} options - The options for doctor recommendation
 * @param {string} options.department - The medical department needed
 * @param {string} [options.language] - Preferred language of the doctor (optional)
 * @param {string} [options.gender] - Preferred gender of the doctor (optional)
 * @returns {Object} The recommendation result
 */
async function recommendDoctor({ department, language, gender }) {
  const availableDoctors = Object.keys(doctorCalendars).filter(doctor => {
    const info = getDoctorInfo(doctor);
    return info.department.toLowerCase() === department.toLowerCase() &&
           (language ? info.languages.includes(language) : true) &&
           (gender ? info.gender.toLowerCase() === gender.toLowerCase() : true);
  });

  if (availableDoctors.length === 0) {
    return {
      status: 'no_match',
      message: 'I apologize, but I couldn\'t find a doctor matching all your criteria. Would you like me to broaden the search?'
    };
  }

  const recommendedDoctor = availableDoctors[Math.floor(Math.random() * availableDoctors.length)];
  const doctorInfo = getDoctorInfo(recommendedDoctor);

  return {
    status: 'success',
    doctor: recommendedDoctor,
    department: doctorInfo.department,
    languages: doctorInfo.languages,
    gender: doctorInfo.gender,
    shift: doctorInfo.shift
  };
}

module.exports = recommendDoctor;