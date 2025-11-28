import { getCurrentISTTime } from "../Utils/Datetime.js";
import bcrypt from "bcrypt";

const master_configuration = () => ({
  users: {
    table: "users",
    fields: [
      {
        name: "username",
        required: true,
        type: "string",
        unique: true,
        edit: 1,
      },
      {
        name: "password",
        required: true,
        type: "string",
        unique: true,
        edit: 1,
      },
      {
        name: "email",
        required: true,
        type: "string",
        unique: true,
        edit: 1,
        validate: (value) => {
          if (!value) return null; // Skip validation if not required
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return "Invalid email format";
          }
          return null;
        },
      },
      {
        name: "mobileno",
        required: true,
        type: "string",
        unique: true,
        edit: 1,
        validate: (value) => {
          const mobileRegex = /^[6-9]\d{9}$/;
          if (!mobileRegex.test(value)) {
            return "Mobile number must be a 10-digit number starting with 6-9";
          }
          return null;
        },
      },
      { name: "role_id", required: true, type: "number", edit: 1 },
      { name: "status", required: false, type: "number" },
      { name: "lastmodifiedon", required: false, type: "string" },
      { name: "lastmodifiedby", required: false, type: "number" },
    ],
    transform: async (data) => {
      if (data.password) data.password = await bcrypt.hash(data.password, 10);
      data.lastmodifiedon = await getCurrentISTTime();
      return data;
    },
  },
  asset: {
    table: "asset",
    fields: [
      {
        name: "vehiclenumber",
        required: true,
        type: "string",
        unique: true,
        edit: 1,
        validate: (value) => {
          if (!value) return "vehiclenumber is required";

          // Normalize value (trim + uppercase)
          const formatted = value.trim().toUpperCase();

          // Indian vehicle number format: e.g., TN10AB1234
          const vehicleNumberPattern = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/;

          if (!vehicleNumberPattern.test(formatted)) {
            return "Invalid vehicle number format. Example: TN10AB1234 or KA5MQ6789";
          }

          return null;
        },
      },
      {
        name: "vehiclerfid",
        required: false,
        type: "string",
        unique: true,
        validate: (value) => {
          if (!value) return null;
          if (typeof value !== "string" || value.length !== 24) {
            return "assetrfid must be exactly 24 characters long";
          }
          return null;
        },
      },
      // { name: 'price', required: true, type: 'number' },
      // { name: 'vendor_id', required: false, type: 'number' },
      { name: "status", required: false, type: "string" },
      // { name: 'amcstatus', required: false, type: 'number' },
      // { name: 'year_of_purchase', required: false},
      // {
      // name: 'year_of_purchase',
      // required: false,
      // type: 'string',
      // validate: (value) => {
      //     if (!value) return null;
      //     const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
      //     if (!dateRegex.test(value)) {
      //     return 'year_of_purchase must be in YYYY-MM-DD format';
      //     }
      //     const date = new Date(value);
      //     const isValidDate = !isNaN(date.getTime());
      //     if (!isValidDate) {
      //     return 'year_of_purchase must be a valid date';
      //     }
      //     return null;
      // }
      // },
      // { name: 'quantity', required: false},
      { name: "remarks", required: false },
      { name: "createdat", required: false, type: "string" },
      { name: "createdby", required: false, type: "number" },
      // { name: 'lastmodifiedat', required: false, type: 'string' },
      // { name: 'lastmodifiedby', required: false, type: 'number' }
    ],
    transform: async (data) => {
      data.createdat = await getCurrentISTTime();
      return data;
    },
  },

  roles: {
    table: "roles",
    fields: [
      { name: "name", required: true, type: "string", unique: true, edit: 1 },
      { name: "modifiedate", required: false, type: "string" },
      { name: "modifiedby", required: false, type: "number" },
      { name: "status", required: false, type: "number" },
    ],
    transform: async (data) => {
      data.modifiedate = await getCurrentISTTime();
      return data;
    },
  },
  permissions: {
    table: "permissions",
    fields: [
      { name: "name", required: true, type: "string", unique: true, edit: 1 },
      { name: "modifiedat", required: false, type: "string" },
      { name: "modifiedby", required: false, type: "number" },
      { name: "status", required: false, type: "number" },
    ],
    transform: async (data) => {
      data.modifiedate = await getCurrentISTTime();
      return data;
    },
  },
  rolepermission: {
    table: "rolepermission",
    fields: [
      { name: "role_id", required: true, type: "number" },
      { name: "permission_id", required: true, type: "number" },
    ],
  },
  assetgmastermap: {
    table: "assetgmastermap",
    fields: [
      { name: "asset_id", required: true, type: "number" },
      { name: "gmastervalue_id", required: true, type: "number" },
    ],
  },
  assetlog: {
    table: "assetlog",
    fields: [
      { name: "assetid", required: true, type: "string" },
      { name: "transtime", required: false, type: "string" },
      { name: "terminalid", required: true, type: "string" },
    ],
    transform: async (data) => {
      data.modifiedate = await getCurrentISTTime();
      return data;
    },
  },
  assetmastermap: {
    table: "assetmastermap",
    fields: [
      { name: "asset_id", required: true, type: "number" },
      { name: "master_id", required: true, type: "number" },
      { name: "value", required: true, type: "number" },
    ],
  },
  findasset: {
    table: "findasset",
    fields: [
      {
        name: "asset_id",
        required: true,
        type: "number",
        unique: true,
        edit: 1,
      },
      { name: "status", required: false, type: "number" },
      { name: "transtime", required: false, type: "string" },
    ],
    transform: async (data) => {
      data.transtime = await getCurrentISTTime();
      return data;
    },
  },
  gmaster: {
    table: "gmaster",
    fields: [
      { name: "name", required: true, type: "string", unique: true, edit: 1 },
    ],
  },
  gmastervalue: {
    table: "gmastervalue",
    fields: [
      { name: "gmaster_id", required: false },
      { name: "name", required: true, type: "string", edit: 1 },
    ],
  },

  master: {
    table: "master",
    fields: [
      // { name: 'name', required: true, type: 'string' },
      { name: "parent_id", required: false, type: "number" },
      { name: "lastmodifiedby", required: false, type: "number" },
      { name: "lastmodifiedat", required: false, type: "string" },
    ],
    transform: async (data) => {
      data.lastmodifiedat = await getCurrentISTTime();
      return data;
    },
  },

  userlocationmap: {
    table: "userlocationmap",
    fields: [
      { name: "users_id", required: true, type: "number" },
      { name: "gmastervalue_id", required: true, type: "number" },
    ],
  },
  sidebar: {
    table: "sidebar",
    fields: [
      { name: "name", required: true, type: "string", unique: true, edit: 1 },
      { name: "icon", required: true, type: "string" },
      { name: "path", required: true, type: "string", unique: true, edit: 1 },
      { name: "parent_permission", required: false, type: "number" },
      { name: "permission", required: true, type: "number" }, // FK to permissions
    ],
  },

  hostel: {
    table: "hostel",
    fields: [
      { name: "name", required: true, type: "string", unique: true, edit: 1 },
      { name: "address", required: true, type: "string", edit: 1 },
      { name: "warden_name", required: true, type: "string", edit: 1 },
      {
        name: "warden_contact",
        required: true,
        type: "string",
        edit: 1,
        validate: (value) => {
          const mobileRegex = /^[6-9]\d{9}$/;
          if (!mobileRegex.test(value)) {
            return "Mobile number must be a 10-digit number starting with 6-9";
          }
          return null;
        },
      },
      { name: "hostel_type", required: true, type: "string", edit: 1 },
      { name: "total_rooms", required: false, type: "number", edit: 1 },

      { name: "status", required: false, type: "string" },
      { name: "lastmodifiedon", required: false, type: "string" },
      { name: "lastmodifiedby", required: false, type: "number" },
    ],
  },

  allowedtime: {
    table: "allowedtime",
    fields: [
      {
        name: "hostel_id",
        required: true,
        type: "number",
        edit: 1,
        unique: true,
        // validate: (value) => {
        //   value = Number(value); // <--- ADD THIS
        //   if (!value || !Number.isInteger(value) || value <= 0) {
        //     return "Valid hostel ID is required";
        //   }
        //   return null;
        // },
      },

      {
        name: "allowed_out_time",
        required: true,
        type: "string", // store as TIME in DB
        edit: 1,
        // validate: (value) => {
        //   if (!value || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
        //     return "Allowed out time must be in HH:MM or HH:MM:SS format";
        //   }
        //   return null;
        // },
      },
      {
        name: "expected_return_time",
        required: true,
        type: "string", // store as TIME in DB
        edit: 1,
        // validate: (value) => {
        //   if (!value || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
        //     return "Expected return time must be in HH:MM or HH:MM:SS format";
        //   }
        //   return null;
        // },
      },
      // {
      //   name: "maximum_delay",
      //   required: false,
      //   type: "number",
      //   edit: 1,
      //   // validate: (value) => {
      //   //   if (value != null && (!Number.isInteger(value) || value < 0)) {
      //   //     return "Maximum delay must be a non-negative integer";
      //   //   }
      //   //   return null;
      //   // },
      // },
      // {
      //   name: "sms_trigger_time",
      //   required: false,
      //   type: "number",
      //   edit: 1,
      //   // validate: (value) => {
      //   //   if (value != null && (!Number.isInteger(value) || value < 0)) {
      //   //     return "SMS trigger time must be a non-negative integer";
      //   //   }
      //   //   return null;
      //   // },
      // },
      {
        name: "status",
        required: false,
        type: "string",
        edit: 1,
        // validate: (value) => {
        //   if (value != null && !["Active", "Inactive"].includes(value)) {
        //     return "Status must be either 'Active' or 'Inactive'";
        //   }
        //   return null;
        // },
      },
    ],

    transform: async (data) => {
      // Add timestamp
      data.lastmodifiedon = await getCurrentISTTime();

      // Default status to Active if not provided
      if (!data.status) data.status = "Active";

      // Default maximum_delay and sms_trigger_time to 0 if not provided
      // if (data.maximum_delay == null) data.maximum_delay = 0;
      // if (data.sms_trigger_time == null) data.sms_trigger_time = 0;

      return data;
    },
  },
  student: {
    table: "student",
    primaryKey: "id",
    fields: [
      { name: "name", required: true },

      { name: "memberid", required: true, unique: true },

      // ✅ mobile must be 10 digits
      {
        name: "mobile",
        unique: true,
      },

      // { name: "alternate_mobile" },

      // ✅ email validation
      {
        name: "email",
      },

      { name: "address" },
      { name: "remarks" },

      { name: "parentname" },

      // ✅ parent contact 10-digit validation
      {
        name: "parentcontact",
      },

      { name: "expirydate" },
      { name: "status" },
      { name: "createdby" },
      { name: "createdat" },
      { name: "hostel_id" },
    ],
  },
  smsconfiguration: {
    table: "hostel_sms_config",
    fields: [
      {
        name: "hostel_id", // match your DB column
        displayName: "Hostel",
        type: "dropdown",
        required: true, // required for adding/updating
        edit: 1, // editable
        unique: true, // enforce uniqueness if needed
        showInFilter: true, // whether to show in filter modal/table
      },
      {
        name: "sms_alert_type", // DB column for SMS type
        displayName: "SMS Alert Type",
        type: "dropdown", // could be dropdown with options: Manual / Automatic
        required: true,
        edit: 1,
        options: [
          { label: "Manual", value: "manual" },
          { label: "Automatic", value: "automatic" },
        ],
        showInFilter: false, // optional: hide in modal filter
      },
    ],
  },
});

export { master_configuration };
