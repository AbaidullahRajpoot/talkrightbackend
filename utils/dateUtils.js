const moment = require('moment-timezone');
const { DEFAULT_TIMEZONE } = require('../config/timezone');

const dateUtils = {
  toDefaultTimezone: (date) => {
    return moment.tz(date, DEFAULT_TIMEZONE);
  },

  fromDefaultTimezone: (date) => {
    return moment(date).tz(DEFAULT_TIMEZONE);
  },

  formatToDefaultTimezone: (date) => {
    return moment.tz(date, DEFAULT_TIMEZONE).format();
  }
};

module.exports = dateUtils; 