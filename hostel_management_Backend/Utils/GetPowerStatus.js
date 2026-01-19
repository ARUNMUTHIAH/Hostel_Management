const POWER_THRESHOLD_MINUTES = 3;

const getPowerStatus = (lastActivity) => {
  if (!lastActivity) return "Power Disconnected";

  const last = new Date(lastActivity);
  const diffMinutes = (Date.now() - last.getTime()) / 60000;

  return diffMinutes <= POWER_THRESHOLD_MINUTES
    ? "Power Connected"
    : "Power Disconnected";
};

export default getPowerStatus;
