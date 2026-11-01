const reservationExpiry = require("./reservationExpiry");
const allocationService = require("../services/allocationService");
const { EXPIRY_SWEEP_INTERVAL_MS } = require("../config/timing");

let intervalId = null;
let isRunning = false;

const runBackgroundJobs = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    try {
      const { expiredCount } = await reservationExpiry.expireStaleReservations();
      if (expiredCount > 0) {
        console.log(`Reservation expiry sweep expired ${expiredCount} reservations`);
      }
    } catch (error) {
      console.error("Reservation expiry sweep failed:", error);
    }

    try {
      await allocationService.expireStaleWaitingEntries({});
    } catch (error) {
      console.error("Waitlist expiry sweep failed:", error);
    }
  } finally {
    isRunning = false;
  }
};

const startBackgroundJobs = () => {
  if (process.env.DISABLE_BACKGROUND_JOBS === "true" || intervalId) return;
  intervalId = setInterval(runBackgroundJobs, EXPIRY_SWEEP_INTERVAL_MS);
  void runBackgroundJobs();
};

const stopBackgroundJobs = () => {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
};

module.exports = { startBackgroundJobs, stopBackgroundJobs };
