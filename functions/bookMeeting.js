const { google } = require('googleapis');
const moment = require('moment-timezone');
const doctorCalendars = require('./doctorCalendars');

async function bookMeeting(functionArgs) {
  console.log('bookMeeting function called with args:', functionArgs);
  const { dateTime, email, duration = 30, confirmedDateTime = false, confirmedEmail = false, doctor } = functionArgs;

  if (!doctor || !doctorCalendars[doctor]) {
    return JSON.stringify({
      status: 'failure',
      message: 'Invalid or missing doctor name'
    });
  }

  const CALENDAR_ID = doctorCalendars[doctor];

  try {
    const auth = await getAuthClient();
    console.log('Google Auth client initialized successfully');
    const calendar = google.calendar({ version: 'v3', auth });

    // Validate email format
    if (!isValidEmail(email)) {
      return JSON.stringify({ 
        status: 'failure', 
        message: 'Invalid email format. Please confirm the email address.',
        needsConfirmation: true
      });
    }

    // Check if email has been confirmed
    if (!confirmedEmail) {
      return JSON.stringify({
        status: 'needs_email_confirmation',
        message: 'Please confirm the email address by spelling it out before booking.',
        email: email
      });
    }

    // Parse the dateTime in Asia/Dubai timezone
    const currentDateTime = moment().tz('Asia/Dubai');
    const meetingDateTime = moment.tz(dateTime, 'Asia/Dubai');
    
    if (!meetingDateTime.isValid()) {
      return JSON.stringify({ status: 'failure', message: 'Invalid date or time' });
    }

    // Check if the requested time is in the past
    if (meetingDateTime.isBefore(currentDateTime)) {
      return JSON.stringify({ 
        status: 'failure', 
        message: 'The requested appointment time is in the past. Please choose a future date and time.' 
      });
    }

    // If not confirmed, return a status asking for confirmation
    if (!confirmedDateTime) {
      return JSON.stringify({
        status: 'needs_date_time_confirmation',
        message: 'Please confirm all details before booking.',
        email: email,
        dateTime: meetingDateTime.format('MMMM D, YYYY [at] h:mm A [GST]'),
        duration: duration,
        doctor: doctor
      });
    }

    // Check if the slot is still available
    const endDateTime = meetingDateTime.clone().add(duration, 'minutes');
    const events = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: meetingDateTime.toISOString(),
      timeMax: endDateTime.toISOString(),
      timeZone: 'Asia/Dubai',
      singleEvents: true,
      orderBy: 'startTime',
    });

    if (events.data.items.length > 0) {
      return JSON.stringify({
        status: 'failure',
        message: 'This time slot is no longer available. Please choose another time.',
      });
    }

    // Book the meeting
    const event = {
      summary: `Appointment with ${doctor}`,
      description: `Meeting scheduled through Zuleikha Hospital booking system with ${doctor}.`,
      start: {
        dateTime: meetingDateTime.format(),
        timeZone: 'Asia/Dubai',
      },
      end: {
        dateTime: endDateTime.format(),
        timeZone: 'Asia/Dubai',
      },
      attendees: [{ email: email }],
    };

    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      resource: event,
      sendUpdates: 'all',
    });

    console.log('Meeting booking attempt result:', response);

    if (response.data && response.data.id) {
      return JSON.stringify({
        status: 'success',
        message: 'Meeting successfully booked',
        eventId: response.data.id,
        scheduledTime: meetingDateTime.format('MMMM D, YYYY [at] h:mm A [GST]'),
        doctor: doctor
      });
    } else {
      console.log('Meeting booking attempt did not return success:', response);
      return JSON.stringify({ status: 'failure', message: 'Failed to book the meeting' });
    }
  } catch (error) {
    console.error('Error in bookMeeting function:', error);
    return JSON.stringify({ 
      status: 'failure', 
      message: 'An error occurred while booking the meeting: ' + (error.response ? error.response.data.error : error.message)
    });
  }
}

async function getAuthClient() {
  try {
    console.log('Attempting to parse GOOGLE_SERVICE_ACCOUNT_KEY...');

    let serviceAccountKey;
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    try {
      // Remove surrounding single quotes if present
      const trimmedKey = rawKey.trim().replace(/^'(.*)'$/, '$1');

      // Parse the JSON
      serviceAccountKey = JSON.parse(trimmedKey);

      // Replace \\n with \n in the private_key after parsing
      if (serviceAccountKey.private_key) {
        serviceAccountKey.private_key = serviceAccountKey.private_key.replace(/\\n/g, '\n');
      }
    } catch (parseError) {
      console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_KEY:', parseError);
      console.log('Failed to parse key (first 100 characters):', rawKey.substring(0, 100) + '...');
      throw new Error('Unable to parse GOOGLE_SERVICE_ACCOUNT_KEY');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/calendar'],
      clientOptions: {
        subject: 'admin@talkright.net', // Use this to impersonate the admin user
      },
    });
    return auth.getClient();
  } catch (error) {
    console.error('Error in getAuthClient:', error);
    throw new Error('Failed to initialize Google Auth client');
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = bookMeeting;