// doctorInfoService.js
const doctorController = require('../controller/doctorController');

async function getDoctorInfo(doctorName) {
  try {
    const doctorInfo = await doctorController.getDoctorInfo();
    console.log(doctorInfo);
    // Only log once for debugging
    // console.log(doctorInfo);
    
    if (!doctorName) {
      return doctorInfo;
    }
    
    return doctorInfo[doctorName] || { department: "", languages: [], gender: "", shift: "" };
  } catch (error) {
    console.error('Error fetching doctor info:', error);
    return { department: "", languages: [], gender: "", shift: "" };
  }
}

module.exports = { getDoctorInfo };