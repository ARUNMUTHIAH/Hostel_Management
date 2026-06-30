import axios from "axios";
import { getEASYTIMEURL } from "./EASYTIME_URL.js";

const tokenCache = new Map();
const TOKEN_TTL_MS = 30 * 60 * 1000;
const API_TIMEOUT_MS = 10000;

/**
 * Get EasyTime API token
 * @param {number|null} userId
 * @param {string|null} customURL
 */
export const getEasyTimeToken = async (userId = null, customURL = null) => {
  let EASYTIME_URL = customURL;

  try {
    EASYTIME_URL = customURL ?? (await getEASYTIMEURL(userId));

    if (!EASYTIME_URL) {
      throw new Error("EASYTIME URL not found");
    }

    const cached = tokenCache.get(EASYTIME_URL);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const username = process.env.WDMS_USERNAME || "admin";
    const password = process.env.WDMS_PASSWORD || "Admin@1234";

    const response = await axios.post(
      `${EASYTIME_URL}/api/api-token-auth/`,
      new URLSearchParams({ username, password }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: API_TIMEOUT_MS,
      },
    );

    const token = response.data.token;
    tokenCache.set(EASYTIME_URL, {
      token,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });

    return token;
  } catch (err) {
    if (EASYTIME_URL) {
      tokenCache.delete(EASYTIME_URL);
    }

    const data = err.response?.data;
    const nonFieldErrors = Array.isArray(data?.non_field_errors)
      ? data.non_field_errors.join("; ")
      : null;

    const realMessage =
      nonFieldErrors ||
      data?.message ||
      data?.detail ||
      data?.error ||
      (typeof data === "string" ? data : null) ||
      err.message ||
      "Unknown EasyTime token error";

    console.error("Token API Error:", realMessage);

    throw new Error(realMessage);
  }
};
