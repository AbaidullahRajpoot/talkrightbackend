const tools = [
  {
    type: 'function',
    function: {
      name: 'checkAvailability',
      say: "Umm...",
      description: 'Checks availability for multiple meeting time slots in the Zuleikha Hospital calendar for a specific doctor, ensuring all suggested times are in the future.',
      parameters: {
        type: 'object',
        properties: {
          slots: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dateTime: {
                  type: 'string',
                  description: 'The date and time for the meeting in ISO 8601 format (e.g., "2023-07-20T14:30:00"). Interpreted in GST timezone.',
                },
                duration: {
                  type: 'number',
                  description: 'The duration of the meeting in minutes.',
                }
              },
              required: ['dateTime', 'duration']
            }
          },
          doctor: {
            type: 'string',
            description: 'The name of the doctor for whom availability is being checked.',
          }
        },
        required: ['slots', 'doctor'],
      },
      returns: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dateTime: { type: 'string' },
                available: { type: 'boolean' },
                events: { 
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      summary: { type: 'string' },
                      start: { type: 'string' },
                      end: { type: 'string' }
                    }
                  }
                }
              }
            }
          },
          alternativeSlots: {
            type: 'array',
            items: { type: 'string' },
            description: 'Up to three alternative available time slots in a human-readable format.',
          }
        }
      }
    },
  },
  {
    type: 'function',
    function: {
      name: 'bookMeeting',
      say: "Great! I'll book that appointment for you now.",
      description: 'Books a meeting in the Zuleikha Hospital calendar for the caller with a specific doctor, ensuring the appointment is in the future. Uses GST (UAE) timezone.',
      parameters: {
        type: 'object',
        properties: {
          dateTime: {
            type: 'string',
            description: 'The date and time for the meeting in ISO 8601 format (e.g., "2023-07-20T14:30:00"). Interpreted in GST timezone.',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'The email address of the person to send the meeting invite to.',
          },
          duration: {
            type: 'number',
            description: 'The duration of the meeting in minutes. Default is 30 if not specified.',
          },
          confirmedDateTime: {
            type: 'boolean',
            description: 'Whether the date and time details have been confirmed by the user.',
          },
          confirmedEmail: {
            type: 'boolean',
            description: 'Whether the email has been confirmed by spelling it out.',
          },
          doctor: {
            type: 'string',
            description: 'The name of the doctor for whom the appointment is being booked.',
          }
        },
        required: ['dateTime', 'email', 'doctor'],
      },
      returns: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['success', 'failure', 'needs_date_time_confirmation', 'needs_email_confirmation'],
            description: 'The status of the booking attempt.',
          },
          message: {
            type: 'string',
            description: 'A message describing the result of the booking attempt or requesting confirmation.',
          },
          needsConfirmation: {
            type: 'boolean',
            description: 'Indicates whether user confirmation is required before proceeding.',
          },
          email: {
            type: 'string',
            description: 'The email address provided, returned for confirmation.',
          },
          dateTime: {
            type: 'string',
            description: 'The formatted date and time of the requested meeting.',
          },
          duration: {
            type: 'number',
            description: 'The duration of the meeting in minutes.',
          },
          doctor: {
            type: 'string',
            description: 'The name of the doctor for the appointment.',
          },
          eventId: {
            type: 'string',
            description: 'The ID of the created event (only present if status is "success").',
          },
          scheduledTime: {
            type: 'string',
            description: 'The scheduled date and time of the meeting in a human-readable format in GST (only present if status is "success").',
          }
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommendDoctor',
      say: "Umm...",
      description: 'Recommends a doctor based on department and patient preferences',
      parameters: {
        type: 'object',
        properties: {
          department: { 
            type: 'string', 
            description: 'The medical department needed' 
          },
          language: { 
            type: 'string', 
            description: 'Preferred language of the doctor (optional)' 
          },
          gender: { 
            type: 'string', 
            description: 'Preferred gender of the doctor (optional)' 
          }
        },
        required: ['department']
      },
      returns: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['success', 'no_match'],
            description: 'The status of the doctor recommendation.'
          },
          message: {
            type: 'string',
            description: 'A message describing the result if no match is found.'
          },
          doctor: {
            type: 'string',
            description: 'The name of the recommended doctor.'
          },
          department: {
            type: 'string',
            description: 'The department of the recommended doctor.'
          },
          languages: {
            type: 'array',
            items: { type: 'string' },
            description: 'The languages spoken by the recommended doctor.'
          },
          gender: {
            type: 'string',
            description: 'The gender of the recommended doctor.'
          },
          shift: {
            type: 'string',
            description: 'The shift (Day or Night) of the recommended doctor.'
          }
        }
      }
    },
  },
  {
    type: 'function',
    function: {
      name: 'saveUserRating',
      say: "Thank you for your feedback!",
      description: 'Saves the user\'s feedback ratings for the quality and effectiveness of the call',
      parameters: {
        type: 'object',
        properties: {
          callQualityRating: { 
            type: 'number', 
            description: 'Rating from 1-5 for the quality and speed of the call',
            minimum: 1,
            maximum: 5
          },
          needsAddressedRating: { 
            type: 'number', 
            description: 'Rating from 1-5 for how well their needs were understood and addressed',
            minimum: 1,
            maximum: 5
          }
        },
        required: ['callQualityRating', 'needsAddressedRating']
      },
      returns: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['success', 'failure'],
            description: 'The status of saving the ratings'
          },
          message: {
            type: 'string',
            description: 'A message describing the result of saving the ratings'
          }
        }
      }
    },
  }
];

module.exports = tools;