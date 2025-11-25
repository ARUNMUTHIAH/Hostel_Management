import dbConfig from '../config/Database.js';
import nodemailer from 'nodemailer';


const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT;
const user = process.env.SMTP_MAIL;
const pass = process.env.SMTP_PASSWORD;


let mailer = nodemailer.createTransport({
  host: host,
  port: port,
  service: "gmail",
  secure: false,
  auth: {
    user: user,
    pass: pass,
    // user: dbConfig.smtpUserName,
    // pass: dbConfig.smtpPassword,
  },
  tls: {
    rejectUnauthorized: false,
  },

});

export default mailer;
