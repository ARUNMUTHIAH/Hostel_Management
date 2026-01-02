import { API_URL } from "../API_URL";

export const studentConfig = [
  {
    dpname: "Member ID",
    mandatory: true,
    type: "text",
    edit: "0",
    bkname: "memberid",
    view: "1",
    valueType: "string",
  },

  {
    dpname: "Name",
    mandatory: true,
    type: "text",
    edit: "1",
    bkname: "name",
    view: "1",
    valueType: "string",
  },

  {
    dpname: "Department",
    mandatory: "1",
    type: "select",
    edit: "1",
    select: "single",
    bkname: "department",
    view: "1",
  },

  {
    dpname: "Degree",
    mandatory: true,
    type: "select",
    select: "single",
    edit: "1",
    bkname: "degree",
    view: "1",
  },

  // ⭐ MOBILE VALIDATION (10 DIGITS)
  {
    dpname: "Phone",
    mandatory: true,
    type: "text",
    edit: "1",
    bkname: "mobile",
    view: "1",
    valueType: "string",
    validate: (value) => /^[0-9]{10}$/.test(value),
    error: "Mobile number must be 10 digits",
  },

  // ⭐ EMAIL VALIDATION (VALID FORMAT)
  {
    dpname: "Email",
    mandatory: true,
    type: "text",
    edit: "1",
    bkname: "email",
    view: "1",
    valueType: "string",
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    error: "Invalid email format",
  },

  {
    dpname: "Expiry Date",
    mandatory: true,
    type: "date",
    edit: "1",
    bkname: "expirydate",
    view: "1",

    validate: (value) => {
      const selected = new Date(value);
      const today = new Date();
      selected.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      return selected >= today; // allow today + future
    },

    error: "Expiry date must be today or a future date",
  },
  {
    dpname: "Gender",
    mandatory: true,
    type: "select",
    select: "single",
    edit: "1",
    bkname: "gender",
    view: "1",
  },

  {
    dpname: "Institute Name",
    mandatory: true,
    type: "select",
    select: "single",
    edit: "1",
    bkname: "hostel_id",
    apilink: `${API_URL}/hostel`,
    view: "1",
  },

  {
    dpname: "Room No",
    mandatory: true,
    type: "select",
    select: "single",
    edit: "1",
    bkname: "location",
    view: "1",
  },

  {
    dpname: "Address",
    mandatory: false,
    type: "textarea",
    edit: "1",
    bkname: "address",
    view: "1",
  },

  {
    dpname: "Parent/Guardian Name",
    mandatory: false,
    type: "text",
    edit: "1",
    bkname: "parentname",
    view: "1",
    valueType: "string",
  },

  // ⭐ PARENT CONTACT 10 DIGITS
  {
    dpname: "Parent/Guardian Contact",
    mandatory: false,
    type: "text",
    edit: "1",
    bkname: "parentcontact",
    view: "1",
    valueType: "string",
    validate: (value) => /^[0-9]{10}$/.test(value),
    error: "Parent contact must be 10 digits",
  },
  {
    dpname: "Parent Email",
    mandatory: false,
    type: "text",
    edit: "1",
    bkname: "parentemail",
    view: "1",
    valueType: "string",
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    error: "Invalid email format",
  },

  {
    dpname: "Remarks",
    mandatory: false,
    type: "textarea",
    edit: "1",
    bkname: "remarks",
    view: "1",
  },
];
