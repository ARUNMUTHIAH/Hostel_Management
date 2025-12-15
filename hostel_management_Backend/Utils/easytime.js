import axios from "axios";
import { getEASYTIMEURL } from "./EASYTIME_URL.js";

/**
 * Get EasyTime API token
 * @param {number|null} userId - optional userId to fetch EASYTIME_URL from DB
 * @param {string|null} customURL - optional manual EASYTIME_URL
 */
export const getEasyTimeToken = async (userId = null, customURL = null) => {
  try {
    // Use custom URL if provided, otherwise fetch via userId
    const EASYTIME_URL = customURL ?? (await getEASYTIMEURL(userId));

    if (!EASYTIME_URL) {
      throw new Error("EASYTIME URL not found");
    }

    console.log(EASYTIME_URL, "EASYTIME_URL in getEasyTimes");

    const response = await axios.post(
      `${EASYTIME_URL}/api/api-token-auth/`,
      new URLSearchParams({
        username: "admin",
        password: "Admin@1234",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    console.log(response.data, "Token API Response");

    return response.data.token;
  } catch (err) {
    console.error("Token API Error:", err.response?.data || err.message);
    throw new Error("Failed to fetch EasyTime API token");
  }
};
