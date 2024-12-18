// doctorInfoService.js
const doctorController = require('../controller/doctorController');

async function getDoctorInfo(doctorName) {
  try {
    // Use the controller's getDoctorInfo method
    const result = await doctorController.getDoctorInfo();
    if (result) {
      console.log(result);
      const doctorInfo = result;
      doctorInfo[doctorName] || { department: "", languages: [], gender: "", shift: "" }
    } else {
      return { department: "", languages: [], gender: "", shift: "" };
    }
  } catch (error) {
    console.error('Error fetching doctor info:', error);
    return { department: "", languages: [], gender: "", shift: "" };cd
  }
}

module.exports = { getDoctorInfo };