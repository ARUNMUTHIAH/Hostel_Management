import CryptoJS from "crypto-js";
const SECRET_KEY = 'a3f6d8e1b2c4e5f7a9d0b3c2vicky6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2'
const JWT_SECRET = 'b4e5f7a9d0b3c2e1f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3f6d8e1'

const encryptData = (data) => {
    return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
};

const decryptData = (encryptedPayload) => {
  const bytes = CryptoJS.AES.decrypt(encryptedPayload, SECRET_KEY);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
};

export {encryptData, decryptData}