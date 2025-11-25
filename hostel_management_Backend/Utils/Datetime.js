import { db, performQuery } from "../config/Database.js";

export function formatDateToYYYYMMDD(date) {
  if (!date || !(date instanceof Date)) {
    date = new Date();
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}
// export function formatDateTimeToYYYYMMDDHHMMSS(dateInput) {

//   const date = new Date(dateInput);

//   if (isNaN(date)) {
//     console.error("Invalid date input:", dateInput);
//     return null;
//   }
//   const istOffset = 5.5 * 60 * 60000; // 5.5 hrs in ms
//   const istDate = new Date(date.getTime() + istOffset);

//   const year = istDate.getFullYear();
//   const month = String(istDate.getMonth() + 1).padStart(2, '0');
//   const day = String(istDate.getDate()).padStart(2, '0');
//   const hours = String(istDate.getHours()).padStart(2, '0');
//   const minutes = String(istDate.getMinutes()).padStart(2, '0');
//   const seconds = String(istDate.getSeconds()).padStart(2, '0');

//   return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
// }
export function formatDateTimeToYYYYMMDDHHMMSS(dateStr) {
  const iso = dateStr.replace(' ', 'T');
  const d = new Date(iso); 
  if (isNaN(d)) return null;

  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');

  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

export async function getCurrentISTTime() {
  const [QueryTimeQ] = await db.query(`SELECT DATE_FORMAT(CONVERT_TZ(NOW(), '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s') AS format_time `)
  const QueryTime = QueryTimeQ[0]?.format_time
  console.log('Asset_Current_Tim1111e', QueryTime);
  return QueryTime;
}
export async function getCurrentISTDate() {
  const [QueryTimeQ] = await db.query(`SELECT DATE_FORMAT(CONVERT_TZ(NOW(), '+00:00', '+05:30'), '%Y-%m-%d') AS format_date`)
  const QueryDate = QueryTimeQ[0]?.format_date
  console.log('Asset_Current_Date', QueryDate);
  return QueryDate;
}

export function capitalizeFirstLetter(str) {
  if (typeof str !== 'string') return str;
  const trimmed = str.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function trimLetter(str) {
  if (typeof str !== 'string') return str;
  return str.trim();
}