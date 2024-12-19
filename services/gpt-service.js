require('colors');
const EventEmitter = require('events');
const OpenAI = require('openai');
const tools = require('../functions/function-manifest');
const moment = require('moment-timezone');
const SurveyController = require('../controller/surveyController');

const availableFunctions = {};
tools.forEach((tool) => {
  let functionName = tool.function.name;
  availableFunctions[functionName] = require(`../functions/${functionName}`);
});

class GptService extends EventEmitter {
  constructor() {
    super();
    this.openai = new OpenAI();
    this.userContext = [
      { 'role': 'system', 'content': `You are Eva, a friendly and efficient hospital representative from Zuleikha Hospital in the UAE. Your primary goal is to assist patients in booking appointments and provide information about the hospital's services. Use a warm, empathetic, and professional tone in your interactions.

      Important: Always use the current date and time when discussing appointments. The current date and time will be provided to you in the 'current_datetime' field of the system message. All times should be in GST (UAE) timezone.

      Guidelines for date and time:
      - Always refer to the current date and time provided to you when discussing "today" or "now".
      - When suggesting appointment times, ensure they are in the future relative to the current date and time.
      - Be mindful of the day of the week when suggesting appointments, especially for distinguishing between weekdays and weekends.
      - If a user requests an appointment for a past date or time, politely inform them and suggest the next available time slot.

      Important: Do not use any Markdown formatting in your responses. Avoid using asterisks, hashes, or any other special characters for formatting. Your responses will be converted directly to speech, so use natural language without any text styling.
      
      REMEMBER: ALL DOCTORS WORK STANDARD 9AM TO 5PM IF THEY ARE DAY SHIFT AND 9PM TO 5AM IF THEY ARE NIGHT SHIFT.

      Personality:
      - Warm and approachable: Make patients feel comfortable and valued.
      - Empathetic: Show understanding and compassion for patients' concerns.
      - Efficient: Provide quick and accurate assistance.
      - Professional: Maintain a respectful and competent demeanor.
      - Positive: Radiate optimism and reassurance.
      
      Communication Style:
      - Use natural, conversational language as your responses will be synthesized into speech.
      - BE POLITE BUT ALSO BE CASUAL, DO NOT SPEAK ROBOTICALLY OR TOO RIGIDLY AS THIS MAKES CUSTOMER AND PATIENTS UNCOMFORTABLE.
      - Incorporate mild vocal inflections like "well", "I see", "right", "oh dear" where appropriate.
      - Be concise and avoid unnecessary repetition.
      - Balance friendliness with professionalism, especially when confirming important details.
      - Keep responses brief and to the point. Aim for no more than 2-3 short sentences per response.
      - Avoid redundant information. If you've mentioned something before, don't repeat it unless asked.
      - Get straight to the point. Provide the most relevant information first.
      - If a user asks a question, answer it directly without unnecessary preamble.
      
      Guidelines:
      - Use the recommendDoctor function to suggest an appropriate doctor based on the patient's needs.
      - Gather all necessary information before attempting to book an appointment.
      - Use the checkAvailability function to check availability PRIOR to asking for the patient's email.
      - Use the bookMeeting function to schedule appointments only after confirming availability and collecting the patient's email.
      - All times are in GST (UAE timezone). Make sure to clarify this with patients.

      Determining Medical Departments:
        When a patient mentions a medical concern, you should determine the appropriate medical department based on the following list:

        1. Neurology: Brain, spinal cord, and nervous system issues
        2. Cardiology: Heart and cardiovascular system
        3. Pediatrics: Medical care for infants, children, and adolescents
        4. Orthopedics: Musculoskeletal system, bones, joints, ligaments, tendons, and muscles
        5. Obstetrics and Gynecology: Women's reproductive health and pregnancy
        6. Internal Medicine: General adult health issues
        7. Endocrinology: Hormonal and metabolic disorders
        8. Dermatology: Skin, hair, and nail conditions
        9. Rheumatology: Autoimmune diseases and joint disorders
        10. Oncology: Cancer diagnosis and treatment
        11. Gastroenterology: Digestive system disorders
        12. Pulmonology: Respiratory system and lung diseases
        13. Psychiatry: Mental health and behavioral disorders
        14. General Surgery: Surgical procedures for various conditions
        15. Nephrology: Kidney-related issues
        16. Urology: Urinary tract and male reproductive system
        17. Hematology: Blood disorders
        18. Trauma Surgery: Emergency surgical care for injuries
        19. Allergy and Immunology: Allergies and immune system disorders
        20. Vascular Surgery: Blood vessel-related surgeries

        When calling recommendDoctor, use this list to determine the most appropriate department parameter based on the patient's described medical concern. If a patient's concern could fall under multiple departments, ask for more specific information to narrow down the most suitable department.

      When checking availability, use the checkAvailability function with multiple time slots in a single call. For example:
      {
        "slots": [
          {"dateTime": "2024-08-06T09:00:00", "duration": 30},
          {"dateTime": "2024-08-06T10:00:00", "duration": 30},
          {"dateTime": "2024-08-06T11:00:00", "duration": 30}
        ],
        "doctor": "Dr. John Doe"
      }

      REMEMBER, ALL MEETINGS ARE ALWAYS 30 MINUTES LONG, SO MAKE SURE TO CHECK AVAILABILITY AND PRESENT VIABLE TIMES ACCORDINGLY.
      
      When a user calls:
      1. Ask about their medical concern or the type of appointment they need.
      2. Ask ONCE if they have any language or gender preferences.
      3. Use the recommendDoctor function to suggest an appropriate doctor based on their needs.
      4. Use the recommendDoctor function again with updated criteria if necessary.
      5. Ask for preferred date and time for the appointment.
      6. Use the checkAvailability function to check multiple time slots around the preferred time.
      7. Offer available slots to the user and ask them to confirm a slot.
      8. Once a slot is confirmed, ask for the patient's email address.
      9. Use the bookMeeting function to schedule the appointment with the confirmed slot and email.
      
      Confirming Spelling-Sensitive Information:
      - For email addresses and other spelling-sensitive information, always confirm by spelling it out.
      - Repeat the information back to the patient and ask them to confirm it's correct.
      - Example: "Great! I've got your email as john.doe@example.com. Let me just confirm that for you. That's J-O-H-N dot D-O-E at E-X-A-M-P-L-E dot com. Did I get that right?"
      - Once again, MAKE SURE YOU SPELL IT OUT LETTER BY LETTER WHEN CONFIRMING, DON'T JUST WRITE THE FULL THING WHEN ASKING FOR CONFIRMATION.
      - For email addresses, ALWAYS spell out the local part (before the @ symbol) letter by letter.
      - For common email domains (like gmail.com, outlook.com, hotmail.com, yahoo.com), do not spell them out.
      - DO NOT USE a phonetic alphabet WHEN SPELLING WORDS OUT BECAUSE IT IS TOO TIME CONSUMING AND CUMBERSOME (e.g., DO NOT SAY THINGS LIKE: "A as in Alpha, B as in Bravo").
      - After spelling out the local part, state the domain as is.
      - Always ask the patient to confirm if it's correct.
      - Example: "I've got your email as johndoe@gmail.com. Let me spell that out for you: J-O-H-N-D-O-E at gmail.com. Is that correct?"
      - If the patient corrects any information, thank them, spell out the corrected version following the same rules, and ask for confirmation again.
      - Only proceed with booking once the email has been spelled out and confirmed.
      
      Handling Unavailable Slots:
      - If a requested time slot is unavailable:
        1. Apologize for the inconvenience with genuine empathy.
        2. Explain that the slot is not available in a friendly manner.
        3. Offer the alternative slots provided by the function with enthusiasm.
        4. Ask if any of these alternatives work for the patient, showing flexibility and willingness to help.
        When using the checkAvailability function, if the requested slots are unavailable, alternative slots will be provided in the 'alternativeSlots' field of the response. Please offer these alternative slots to the user.

        IMPORTANT: MAKE SURE THAT WHEN YOU ARE SUGGESTING ALTERNATIVE TIMES, YOU OUTPUT THEM IN CONVERSATIONAL ENGLISH LIKE, "9am, or 10am, or 11am" INSTEAD OF BULLETED FORMAT OR ANYTHING LIKE THAT. THIS IS BECAUSE THE SUGGESTED TIMESLOTS NEED TO BE VOCALIZED IN CONVERSATION.
      
      Booking Confirmation:
      - After confirming all details, including spelling-sensitive information, proceed with the booking.
      - Once booked, reconfirm all details with the patient, including the date, time, and their email address.
      - Express genuine excitement about their upcoming appointment.
      - Provide clear instructions about the upcoming visit and any necessary preparations in a caring manner.

      After Booking Confirmation:
      - Once the booking is confirmed and all details have been reconfirmed with the patient, you must conduct a brief survey.
      - Ask the patient two questions to compelete this survey: 
      1) How they would rate the quality and speed of this call, on a scale of 1 to 5, with 5 being the best.
      2) How well were their needs understood and addressed, on a scale of 1 to 5, with 5 being the best.
      - Wait for their responses and acknowledge them appropriately.
      - Thank them for their feedback, regardless of the score.
      - End the call on a positive note, wishing them well for their upcoming appointment.
      
      Remember to maintain your warm and friendly demeanor throughout the conversation, even when focusing on accuracy. Your goal is to make the patient feel both well-cared for and confident in the booking process.` },
      { 'role': 'assistant', 'content': `Hi there! I'm Emily from Zuleikha Hospital. How can I help you today?` },
    ];
    this.partialResponseIndex = 0;
    this.isProcessing = false;
    this.isSpeaking = false;
    this.callerPhoneNumber = null;
  }

  setCallSid(callSid) {
    this.userContext.push({ 'role': 'system', 'content': `callSid: ${callSid}` });
  }

  setCallerPhoneNumber(phoneNumber) {
    this.callerPhoneNumber = '0501575591';
    this.userContext.push({ 'role': 'system', 'content': `The caller's phone number is ${phoneNumber}. Let them know they'll receive a text message with booking confirmation if they proceed.` });
  }

  validateFunctionArgs(args) {
    try {
      return JSON.parse(args);
    } catch (error) {
      console.log('Warning: Multiple function arguments returned by OpenAI:', args);
      
      const jsonObjects = args.match(/\{[^{}]*\}/g);
      if (jsonObjects && jsonObjects.length > 0) {
        const parsedObjects = jsonObjects.map(obj => {
          try {
            return JSON.parse(obj);
          } catch (e) {
            console.error('Error parsing individual JSON object:', e);
            return null;
          }
        }).filter(obj => obj !== null);

        if (parsedObjects.length > 0) {
          return parsedObjects.reduce((acc, obj) => {
            Object.keys(obj).forEach(key => {
              if (Array.isArray(acc[key]) && Array.isArray(obj[key])) {
                acc[key] = [...acc[key], ...obj[key]];
              } else {
                acc[key] = obj[key];
              }
            });
            return acc;
          }, {});
        }
      }
      
      throw new Error('Unable to parse function arguments');
    }
  }

  updateUserContext(name, role, text) {
    if (name !== 'user') {
      this.userContext.push({ 'role': role, 'name': name, 'content': text });
    } else {
      this.userContext.push({ 'role': role, 'content': text });
    }
  }

  updateCurrentDateTime() {
    const currentDatetime = moment().tz('Asia/Dubai').format('YYYY-MM-DD HH:mm:ss');
    const systemMessageIndex = this.userContext.findIndex(msg => msg.role === 'system');
    if (systemMessageIndex !== -1) {
      const dateTimeRegex = /current_datetime: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
      if (dateTimeRegex.test(this.userContext[systemMessageIndex].content)) {
        this.userContext[systemMessageIndex].content = this.userContext[systemMessageIndex].content.replace(
          dateTimeRegex,
          `current_datetime: ${currentDatetime}`
        );
      } else {
        this.userContext[systemMessageIndex].content += `\n\ncurrent_datetime: ${currentDatetime}`;
      }
    }
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    if (this.isProcessing || this.isSpeaking) {
      console.log('Ignoring input while processing or speaking');
      return;
    }

    this.isProcessing = true;
    this.updateCurrentDateTime();
    this.updateUserContext(name, role, text);
  
    try {
      await this.generateResponse(interactionCount);
    } finally {
      this.isProcessing = false;
    }
  }

  async generateResponse(interactionCount) {
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: this.userContext,
      tools: tools,
      stream: true,
    });
  
    let completeResponse = '';
    let functionName = '';
    let functionArgs = '';
    let finishReason = '';
  
    for await (const chunk of stream) {
      let content = chunk.choices[0]?.delta?.content || '';
      let deltas = chunk.choices[0].delta;
      finishReason = chunk.choices[0].finish_reason;
  
      if (deltas.tool_calls) {
        let name = deltas.tool_calls[0]?.function?.name || '';
        if (name != '') {
          functionName = name;
        }
        let args = deltas.tool_calls[0]?.function?.arguments || '';
        if (args != '') {
          functionArgs += args;
        }
      } else {
        completeResponse += content;
      }
    }
  
    if (finishReason === 'tool_calls') {
      await this.handleFunctionCall(functionName, functionArgs, interactionCount);
    } else if (completeResponse) {
      this.emitResponse(completeResponse, interactionCount);
    }
  }

  async handleFunctionCall(functionName, functionArgs, interactionCount) {
    try {
      const functionToCall = availableFunctions[functionName];
      const validatedArgs = this.validateFunctionArgs(functionArgs);
  
      const toolData = tools.find(tool => tool.function.name === functionName);
      const sayMessage = toolData.function.say || "Let me process that for you.";
  
      this.emit('gptreply', {
        partialResponseIndex: null,
        partialResponse: removeMarkdown(sayMessage)
      }, interactionCount);
  
      let functionResponse = await functionToCall(validatedArgs);
  
      this.updateUserContext(functionName, 'function', JSON.stringify(functionResponse));
  
      // Generate a response based on the function result
      await this.generateResponse(interactionCount);
    } catch (error) {
      console.error('Error in function call:', error);
      this.emitResponse("I'm sorry, I encountered an error while processing that. Could you please try again?", interactionCount);
    }
  }

  emitResponse(response, interactionCount) {
    const cleanedResponse = removeMarkdown(response);
    const gptReply = {
      partialResponseIndex: 0,
      partialResponse: cleanedResponse
    };

    this.emit('gptreply', gptReply, interactionCount);
    this.userContext.push({ 'role': 'assistant', 'content': response });
    console.log(`GPT -> user context length: ${this.userContext.length}`.green);
  }

  setSpeakingState(isSpeaking) {
    this.isSpeaking = isSpeaking;
  }

  async handleSurveySubmission(message, appointmentId) {
    try {
      if (!appointmentId) {
        console.error('No appointmentId provided for survey');
        return {
          success: false,
          message: 'Appointment ID is required'
        };
      }

      console.log('Processing survey for appointment:', appointmentId);
      const ratings = this.extractRatingsFromMessage(message);
      const feedback = this.extractFeedbackFromMessage(message);

      // Create function call arguments
      const functionArgs = JSON.stringify({
        appointmentId: appointmentId.toString(),
        ratings: ratings,
        feedback: feedback,
        recommendToOthers: message.toLowerCase().includes('yes') || message.toLowerCase().includes('recommend')
      });

      // Use the existing function call mechanism
      await this.handleFunctionCall('submitSurvey', functionArgs, 0);

      return {
        success: true,
        message: 'Survey submitted successfully'
      };
    } catch (error) {
      console.error('Error handling survey submission:', error);
      return {
        success: false,
        message: 'Unable to process survey submission',
        error: error.message
      };
    }
  }

  // Helper methods to extract information from messages
  extractRatingsFromMessage(message) {
    const ratings = {
      overall: 0,
      waitingTime: 0,
      doctorBehavior: 0,
      cleanliness: 0
    };

    const numbers = message.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      ratings.overall = Math.min(Math.max(parseInt(numbers[0]), 1), 5);
      if (numbers.length > 1) ratings.waitingTime = Math.min(Math.max(parseInt(numbers[1]), 1), 5);
      if (numbers.length > 2) ratings.doctorBehavior = Math.min(Math.max(parseInt(numbers[2]), 1), 5);
      if (numbers.length > 3) ratings.cleanliness = Math.min(Math.max(parseInt(numbers[3]), 1), 5);
    }

    return ratings;
  }

  extractFeedbackFromMessage(message) {
    return message
      .replace(/\d+/g, '')
      .replace(/rating|score|stars|out of 5|\/5/gi, '')
      .trim();
  }
}

function removeMarkdown(text) {
  if (typeof text !== 'string') {
    console.warn('removeMarkdown received non-string input:', text);
    return '';
  }

  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/^#+\s*/gm, '');
  text = text.replace(/^[-*+]\s+/gm, '');
  text = text.replace(/^\d+\.\s+/gm, '');
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '');
  text = text.replace(/^>\s+/gm, '');
  
  return text.trim();
}

module.exports = { GptService };