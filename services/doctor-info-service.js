// doctorInfoService.js
const doctorInfo = {
  "Dr. Laura Everson": { department: "Neurology", languages: ["English", "Spanish"], gender: "Woman", shift: "Day" },
  "Dr. Marcus Felton": { department: "Cardiology", languages: ["English", "French"], gender: "Man", shift: "Day" },
  "Dr. Amelia Brooks": { department: "Pediatrics", languages: ["English", "German"], gender: "Woman", shift: "Day" },
  "Dr. Rajiv Kapoor": { department: "Orthopedics", languages: ["Hindi", "English"], gender: "Man", shift: "Day" },
  "Dr. Sofia Martinez": { department: "Obstetrics and Gynecology", languages: ["Spanish", "English"], gender: "Woman", shift: "Day" },
  "Dr. Elias Caruso": { department: "Internal Medicine", languages: ["Italian", "English"], gender: "Man", shift: "Day" },
  "Dr. Ananya Desai": { department: "Endocrinology", languages: ["Hindi", "English"], gender: "Woman", shift: "Day" },
  "Dr. Adrian Cole": { department: "Dermatology", languages: ["English", "Portuguese"], gender: "Man", shift: "Day" },
  "Dr. Nadia Youssef": { department: "Rheumatology", languages: ["Arabic", "French"], gender: "Woman", shift: "Day" },
  "Dr. Julian Wells": { department: "Oncology", languages: ["English", "German"], gender: "Man", shift: "Day" },
  "Dr. Elena Rossi": { department: "Gastroenterology", languages: ["Italian", "English"], gender: "Woman", shift: "Day" },
  "Dr. Ahmed Kassem": { department: "Pulmonology", languages: ["Arabic", "English"], gender: "Man", shift: "Day" },
  "Dr. Chloe Rivers": { department: "Psychiatry", languages: ["English", "Dutch"], gender: "Woman", shift: "Day" },
  "Dr. David Kim": { department: "General Surgery", languages: ["Korean", "English"], gender: "Man", shift: "Day" },
  "Dr. Mei Wong": { department: "Nephrology", languages: ["Chinese", "English"], gender: "Woman", shift: "Day" },
  "Dr. Samuel Jones": { department: "Urology", languages: ["English", "Spanish"], gender: "Man", shift: "Day" },
  "Dr. Vera Schmidt": { department: "Hematology", languages: ["German", "English"], gender: "Woman", shift: "Day" },
  "Dr. Rafael Oliveira": { department: "Trauma Surgery", languages: ["Portuguese", "Spanish"], gender: "Man", shift: "Day" },
  "Dr. Ines Beltran": { department: "Allergy and Immunology", languages: ["Spanish", "English"], gender: "Woman", shift: "Day" },
  "Dr. Nikolai Petrov": { department: "Vascular Surgery", languages: ["Russian", "English"], gender: "Man", shift: "Day" },
  "Dr. Ayesha Khan": { department: "Cardiology", languages: ["Arabic", "Urdu", "English"], gender: "Woman", shift: "Night" },
  "Dr. Li Wei": { department: "Pediatrics", languages: ["Chinese", "English", "Spanish"], gender: "Woman", shift: "Night" },
  "Dr. Ahmed Al-Mansouri": { department: "Psychiatry", languages: ["Arabic", "English", "French"], gender: "Man", shift: "Night" }
};

function getDoctorInfo(doctorName) {
  return doctorInfo[doctorName] || { department: "", languages: [], gender: "", shift: "" };
}

module.exports = { getDoctorInfo };