import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export const sendSms = async (phone, message) => {
  try {
    const apiUrl = `${process.env.SMS_API_BASE_URL}username=${
      process.env.SMS_API_USERNAME
    }&password=${process.env.SMS_API_PASSWORD}&sender_id=${
      process.env.SMS_API_SENDER_ID
    }&route=${
      process.env.SMS_API_ROUTE
    }&phonenumber=${phone}&message=${encodeURIComponent(message)}`;

    const response = await axios.get(apiUrl);
    console.log("SMS Sent →", phone, response.data);
    return true;
  } catch (error) {
    console.error("SMS sending failed →", phone, error.message);
    return false;
  }
};
