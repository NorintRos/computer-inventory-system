const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');

dayjs.extend(relativeTime);

module.exports = {
  // Equality check: {{#if (eq status "Available")}}
  eq: (a, b) => a === b,

  // Format date: {{formatDate dateAcquired "MMM D, YYYY"}}
  formatDate: (date, format) => {
    if (!date) return '';
    return dayjs(date).format(typeof format === 'string' ? format : 'MMM D, YYYY');
  },

  // Relative time: {{timeAgo createdAt}} -> "3 months ago"
  timeAgo: (date) => {
    if (!date) return '';
    return dayjs(date).fromNow();
  },

  // Status badge CSS class: {{statusBadge status}}
  statusBadge: (status) => {
    const map = {
      Available: 'badge-success',
      'In-Use': 'badge-warning',
      Maintenance: 'badge-info',
      Retired: 'badge-danger',
      Enabled: 'badge-success',
      Disabled: 'badge-danger',
    };
    return map[status] || 'badge-secondary';
  },

  // JSON stringify for debugging: {{json this}}
  json: (context) => JSON.stringify(context, null, 2),

  // Select helper for dropdowns: {{#select status}}...{{/select}}
  select(value, options) {
    return options.fn(this).replace(new RegExp(`value="${value}"`), `value="${value}" selected`);
  },

  // Current year for footer: {{currentYear}}
  currentYear: () => new Date().getFullYear(),
};
