const { google } = require('googleapis');
const moment = require('moment-timezone');
const doctorCalendars = require('./doctorCalendars');
const { getDoctorInfo } = require('../services/doctor-info-service');

async function checkAvailability(functionArgs) {
  const { slots, doctor } = functionArgs;

  if (!doctor || !doctorCalendars[doctor]) {
    return JSON.stringify({
      status: 'failure',
      message: 'Invalid or missing doctor name'
    });
  }

  const CALENDAR_ID = doctorCalendars[doctor];
  const doctorInfo = getDoctorInfo(doctor);

  try {
    const auth = await getAuthClient();
    console.log('Google Auth client initialized successfully');
    const calendar = google.calendar({ version: 'v3', auth });

    const currentDateTime = moment().tz('Asia/Dubai');

    const results = await Promise.all(slots.map(async (slot) => {
      const { dateTime, duration } = slot;
      const startDateTime = moment.tz(dateTime, 'Asia/Dubai');
      
      if (startDateTime.isBefore(currentDateTime)) {
        return {
          dateTime: dateTime,
          available: false,
          message: 'Requested time is in the past',
        };
      }

      if (!isWithinWorkingHours(startDateTime, duration, doctorInfo.shift)) {
        return {
          dateTime: dateTime,
          available: false,
          message: 'Requested time is outside of doctor\'s working hours',
        };
      }

      const endDateTime = startDateTime.clone().add(duration, 'minutes');

      const events = await calendar.events.list({
        calendarId: CALENDAR_ID,
        timeMin: startDateTime.toISOString(),
        timeMax: endDateTime.toISOString(),
        timeZone: 'Asia/Dubai',
        singleEvents: true,
        orderBy: 'startTime',
      });

      console.log('Events fetched for availability check:', events.data.items);

      const available = events.data.items.length === 0;
      return {
        dateTime: dateTime,
        available: available,
        events: events.data.items,
      };
    }));

    let alternativeSlots = [];
    if (!results.some(result => result.available)) {
      alternativeSlots = await findNextAvailableSlots(calendar, currentDateTime, slots[0].duration, CALENDAR_ID, doctorInfo.shift);
    }

    return JSON.stringify({
      results: results,
      alternativeSlots: alternativeSlots.map(slot => slot.format('YYYY-MM-DDTHH:mm:ss')),
    });
  } catch (error) {
    console.error('Error in checkAvailability function:', error);
    return JSON.stringify({ 
      status: 'failure', 
      message: 'An error occurred while checking availability: ' + (error.response ? error.response.data.error : error.message)
    });
  }
}

function isWithinWorkingHours(startDateTime, duration, shift) {
  const endDateTime = startDateTime.clone().add(duration, 'minutes');
  const startHour = startDateTime.hour();
  const endHour = endDateTime.hour();

  if (shift === 'Day') {
    return startHour >= 9 && endHour <= 17;
  } else if (shift === 'Night') {
    return (startHour >= 21 || startHour < 5) && (endHour >= 21 || endHour <= 5);
  }
  return false;
}

async function findNextAvailableSlots(calendar, startDateTime, duration, CALENDAR_ID, shift) {
  let currentDateTime = startDateTime.clone();
  const endOfDay = startDateTime.clone().endOf('day');
  const availableSlots = [];

  while (currentDateTime.isBefore(endOfDay) && availableSlots.length < 3) {
    if (isWithinWorkingHours(currentDateTime, duration, shift)) {
      const endDateTime = currentDateTime.clone().add(duration, 'minutes');
      const events = await calendar.events.list({
        calendarId: CALENDAR_ID,
        timeMin: currentDateTime.toISOString(),
        timeMax: endDateTime.toISOString(),
        timeZone: 'Asia/Dubai',
        singleEvents: true,
        orderBy: 'startTime',
      });

      if (events.data.items.length === 0) {
        availableSlots.push(currentDateTime.clone());
      }
    }
    currentDateTime.add(30, 'minutes');
  }

  if (availableSlots.length < 3) {
    const nextDaySlots = await findNextAvailableSlots(calendar, startDateTime.clone().add(1, 'day').startOf('day'), duration, CALENDAR_ID, shift);
    availableSlots.push(...nextDaySlots);
  }

  return availableSlots.slice(0, 3);
}

async function getAuthClient() {
  try {
    console.log('Attempting to parse GOOGLE_SERVICE_ACCOUNT_KEY...');

    let serviceAccountKey;
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    try {
      const trimmedKey = rawKey.trim().replace(/^'(.*)'$/, '$1');
      serviceAccountKey = JSON.parse(trimmedKey);
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
        subject: 'admin@talkright.net',
      },
    });
    return auth.getClient();
  } catch (error) {
    console.error('Error in getAuthClient:', error);
    throw new Error('Failed to initialize Google Auth client');
  }
}

module.exports = checkAvailability;