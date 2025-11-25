// export const vehicleConfig = [
//   // {
//   //     dpname: "Product Type",
//   //     mandatory: "1",
//   //     type: "select",
//   //     select: "single",
//   //     edit: "1",
//   //     bkname: "product_types",
//   //     view: "1",
//   // },
//   {
//     dpname: "vehiclenumber",
//     mandatory: true,
//     type: "text",
//     edit: "1",
//     bkname: "vehiclenumber",
//     view: "1",
//     valueType: "string",
//   },
//   {
//     dpname: "vehiclerfid",
//     mandatory: false,
//     type: "text",
//     edit: "1",
//     bkname: "vehiclerfid",
//     view: "1",
//     valueType: "string",
//   },
//   {
//     dpname: "Location",
//     mandatory: true,
//     type: "select",
//     select: "single",
//     edit: "1",
//     bkname: "location",
//     view: "1",
//   },
//   // {
//   //   dpname: "Gate",
//   //   mandatory: true,
//   //   type: "select",
//   //   select: "single",
//   //   edit: "1",
//   //   bkname: "location1",
//   //   view: "1",
//   // },
//   // {
//   //   dpname: "Room No",
//   //   mandatory: true,
//   //   type: "select",
//   //   select: "single",
//   //   edit: "1",
//   //   bkname: "location2",
//   //   view: "1",
//   // },
//   //   {
//   //     dpname: "Brand",
//   //     mandatory: false,
//   //     type: "select",
//   //     select: "single",
//   //     edit: "1",
//   //     bkname: "brand",
//   //     view: "1",
//   //   },
//   // {
//   //     dpname: "AMC Status",
//   //     mandatory: true,
//   //     type: "select",
//   //     select: "single",
//   //     edit: "1",
//   //     bkname: "amcStatus",
//   //     view: "1",
//   // },
//   //   {
//   //     dpname: "Price",
//   //     mandatory: true,
//   //     type: "number",
//   //     edit: "1",
//   //     bkname: "price",
//   //     view: "1",
//   //     valueType: "number",
//   //   },
//   //   {
//   //     dpname: "Year of Purchase",
//   //     mandatory: true,
//   //     type: "date",
//   //     edit: "1",
//   //     bkname: "year_of_purchase",
//   //     view: "1",
//   //   },
//   // {
//   //     dpname: "Quantity",
//   //     mandatory: true,
//   //     type: "quantity",
//   //     edit: "1",
//   //     bkname: "quantity",
//   //     view: "1",
//   //     valueType: "number",
//   // },
//   {
//     dpname: "Status",
//     mandatory: true,
//     type: "select",
//     select: "single",
//     edit: "1",
//     bkname: "status",
//     view: "1",
//   },
//   // {
//   //     dpname: "Vendor",
//   //     mandatory: true,
//   //     type: "select",
//   //     select: "single",
//   //     edit: "1",
//   //     bkname: "vendors",
//   //     view: "1",
//   // },
//   // {
//   //     dpname: "Tag type",
//   //     mandatory: true,
//   //     type: "select",
//   //     select: "single",
//   //     edit: "1",
//   //     bkname: "tagtype",
//   //     view: "1",
//   // },
//   // {
//   //     dpname: "Attachment",
//   //     mandatory: false,
//   //     type: "file",
//   //     edit: "1",
//   //     bkname: "attachment",
//   //     view: "1",
//   // },
//   {
//     dpname: "Remarks",
//     mandatory: false,
//     type: "textarea",
//     edit: "1",
//     bkname: "remarks",
//     view: "1",
//   },
// ];

import { API_URL } from "../API_URL";

export const studentConfig = [
  {
    dpname: "Member ID",
    mandatory: true,
    type: "text",
    edit: "1",
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
    dpname: "Hostel Name",
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
    mandatory: true,
    type: "text",
    edit: "1",
    bkname: "parentname",
    view: "1",
    valueType: "string",
  },

  // ⭐ PARENT CONTACT 10 DIGITS
  {
    dpname: "Parent/Guardian Contact",
    mandatory: true,
    type: "text",
    edit: "1",
    bkname: "parentcontact",
    view: "1",
    valueType: "string",
    validate: (value) => /^[0-9]{10}$/.test(value),
    error: "Parent contact must be 10 digits",
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
