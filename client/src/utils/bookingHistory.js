export const getBookingHistory = (response) => {
  const bookings = response?.data?.data;
  if (!Array.isArray(bookings)) {
    throw new Error('The booking service returned an invalid response.');
  }
  return bookings;
};

export const getBookingHistoryError = (error) => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.response) return 'Unable to load your bookings. Please try again.';
  if (error?.message === 'The booking service returned an invalid response.') return error.message;
  return 'Unable to connect to the booking service. Please try again.';
};
