import axios from "axios";
import { getEASYTIMEURL } from "./EASYTIME_URL.js";

/**
 * Get EasyTime API token
 * @param {number|null} userId
 * @param {string|null} customURL
 */
export const getEasyTimeToken = async (userId = null, customURL = null) => {
  try {
    const EASYTIME_URL = customURL ?? (await getEASYTIMEURL(userId));

    if (!EASYTIME_URL) {
      throw new Error("EASYTIME URL not found");
    }

    console.log(EASYTIME_URL, "EASYTIME_URL in getEasyTimes");

    const response = await axios.post(
      `${EASYTIME_URL}/api/api-token-auth/`,
      new URLSearchParams({
        username: "admin",
        password: "Admin@123",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    console.log(response.data, "Token API Response");

    return response.data.token;
  } catch (err) {
    // ðŸ”¥ Extract REAL EasyTime error
    const realMessage =
      err.response?.data?.message ||
      err.response?.data?.detail ||
      err.response?.data?.error ||
      (typeof err.response?.data === "string" ? err.response.data : null) ||
      err.message ||
      "Unknown EasyTime token error";

    console.error("Token API Error:", realMessage);

    // âœ… Rethrow REAL error
    throw new Error(realMessage);
  }
};
