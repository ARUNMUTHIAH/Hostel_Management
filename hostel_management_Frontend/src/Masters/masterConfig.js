import { API_URL } from "../API_URL";

export const masterConfig = {
  location: [
    {
      dpname: "Name",
      mandatory: "1",
      type: "text",
      default: "Enter location",
      edit: "1",
      bkname: "name",
      view: "1",
    },
  ],

  location1: [
    {
      dpname: "Name",
      mandatory: "1",
      type: "text",
      default: "Enter location 1",
      edit: "1",
      bkname: "name",
      view: "1",
    },
  ],

  location2: [
    {
      dpname: "Name",
      mandatory: "1",
      type: "text",
      default: "Enter location 2",
      edit: "1",
      bkname: "name",
      view: "1",
    },
  ],

  status: [
    {
      dpname: "Name",
      mandatory: "1",
      type: "text",
      default: "Enter Name ....",
      edit: "1",
      bkname: "name",
      view: "1",
    },
  ],

  users: [
    {
      dpname: "Username",
      mandatory: "1",
      type: "text",
      default: "Username",
      edit: "1",
      bkname: "username",
      view: "1",
    },

    {
      dpname: "Password",
      mandatory: "1",
      type: "text",
      default: "Password",
      edit: "1",
      bkname: "password",
      view: "0",
      isSensitive: true, // only for password
    },

    {
      dpname: "Email",
      mandatory: "1",
      type: "text",
      default: "Email",
      edit: "1",
      bkname: "email",
      view: "0",
    },

    {
      dpname: "Mobile No",
      mandatory: "1",
      type: "text",
      default: "Mobile No",
      edit: "1",
      bkname: "mobileno",
      view: "0",
    },

    {
      dpname: "Roles",
      mandatory: "1",
      type: "dropdown",
      default: "Select Role",
      select: "single",
      edit: "1",
      apilink: `${API_URL}/roles`,
      bkname: "role_id",
      view: "0",
    },

    // {
    //   dpname: "Status",
    //   mandatory: "1",
    //   type: "dropdown",
    //   default: "Status",
    //   select: "single",
    //   edit: "1",
    //   apilink: `${API_URL}/status`,
    //   bkname: "status",
    //   view: "0",
    // },

    {
      dpname: "Hostel",
      mandatory: "1",
      type: "multiselect",
      select: "multiple",
      edit: "1",
      apilink: `${API_URL}/hostel`,
      bkname: "hostel_id",
      view: "0",
    },
  ],

  permissions: [
    {
      dpname: "Name",
      mandatory: "1",
      type: "text",
      edit: "1",
      bkname: "name",
      view: "1",
    },
  ],

  roles: [
    {
      dpname: "Name",
      mandatory: "1",
      type: "text",
      default: "Name",
      edit: "1",
      bkname: "name",
      view: "1",
    },
    {
      dpname: "Permissions",
      mandatory: "1",
      type: "multiselect-checkbox",
      select: "multiple",
      edit: "1",
      apilink: `${API_URL}/permissions`,
      options: ["Chennai", "Madurai", "Bangalaore"],
      bkname: "permissions",
      view: "0",
    },
  ],

  sidebar: [
    {
      dpname: "Name",
      mandatory: "1",
      type: "text",
      edit: "1",
      bkname: "name",
      view: "1",
    },
    {
      dpname: "Icon",
      mandatory: "1",
      type: "text",
      edit: "1",
      bkname: "icon",
      view: "1",
    },

    {
      dpname: "Path",
      mandatory: "1",
      type: "text",
      edit: "1",
      bkname: "path",
      view: "1",
    },

    {
      dpname: "Permissions",
      mandatory: "1",
      type: "dropdown",
      select: "single",
      edit: "1",
      apilink: `${API_URL}/permissions`,
      bkname: "permission",
      view: "0",
    },

    {
      dpname: "Parent Permissions",
      mandatory: "0",
      type: "dropdown",
      select: "single",
      edit: "1",
      apilink: `${API_URL}/permissions`,
      bkname: "parent_permission",
      view: "0",
    },
  ],

  allowedtime: [
    {
      dpname: "Hostel",
      mandatory: "1",
      type: "dropdown",
      edit: "1",
      select: "single",
      apilink: `${API_URL}/hostel`,
      bkname: "hostel_id",
      view: "0",
      showInFilter: true,
    },
    {
      dpname: "Hostel",
      mandatory: "0",
      type: "dropdown",
      edit: "1",
      select: "single",
      apilink: `${API_URL}/hostel`,
      bkname: "hostel_name",
      view: "1",
      showInFilter: false,
    },

    {
      dpname: "Allowed Out Time",
      mandatory: "1",
      type: "time",
      edit: "1",
      bkname: "allowed_out_time",
      view: "1",
    },
    {
      dpname: "Expected Return Time",
      mandatory: "1",
      type: "time",
      edit: "1",
      bkname: "expected_return_time",
      view: "1",
    },
  ],
  department: [
    {
      dpname: "Department Name",
      mandatory: "1",
      type: "text",
      edit: "1",
      bkname: "name",
      view: "1",
    },

    // {
    //   dpname: "Status",
    //   mandatory: "1",
    //   type: "select",
    //   select: "single",
    //   edit: "1",
    //   bkname: "status",
    //   view: "1",
    // },
  ],

  degree: [
    {
      dpname: "Name",
      mandatory: "1",
      type: "text",
      edit: "1",
      bkname: "name",
      view: "1",
    },
  ],
  hostel: [
    {
      dpname: "Hostel Name",
      mandatory: "1",
      type: "text",
      edit: "1",
      bkname: "name",
      view: "1",
    },
    {
      dpname: "Location / Address",
      mandatory: "1",
      type: "textarea",
      edit: "1",
      bkname: "address",
      view: "0",
    },
    {
      dpname: "Warden Name",
      mandatory: "1",
      type: "text",
      edit: "1",
      bkname: "warden_name",
      view: "1",
    },
    {
      dpname: "Warden Contact",
      mandatory: "1",
      type: "number",
      edit: "1",
      bkname: "warden_contact",
      view: "1",
    },
    {
      dpname: "Hostel Type",
      mandatory: "1",
      type: "select",
      select: "single",
      options: [
        { label: "Boys", value: "Boys" },
        { label: "Girls", value: "Girls" },
        { label: "Mixed", value: "Mixed" },
      ],
      edit: "1",
      bkname: "hostel_type",
      view: "0",
    },
    {
      dpname: "Total Rooms",
      mandatory: "0",
      type: "number",
      edit: "1",
      bkname: "total_rooms",
      view: "0",
    },

    // {
    //   dpname: "Status",
    //   mandatory: "1",
    //   type: "select",
    //   select: "single",
    //   options: [
    //     { label: "Active", value: "Active" },
    //     { label: "Inactive", value: "Inactive" },
    //   ],
    //   edit: "1",
    //   bkname: "status",
    //   view: "1",
    // },
  ],
  gender: [
    {
      dpname: "Name",
      mandatory: "1",
      type: "text",
      default: "Enter Name ....",
      edit: "1",
      bkname: "name",
      view: "1",
    },
  ],
  smsconfiguration: [
    {
      dpname: "Hostel",
      mandatory: "1",
      type: "dropdown",
      edit: "1",
      select: "single",
      apilink: `${API_URL}/hostel`,
      bkname: "hostel_id",
      view: "0",
      showInFilter: true,
    },
    {
      dpname: "Name",
      mandatory: "0",
      type: "text",
      default: "Enter Name ....",
      edit: "1",
      bkname: "name",
      view: "1",
      showInFilter: false,
    },

    {
      dpname: "SMS Alert Type",
      bkname: "sms_alert_type",
      type: "select",
      showInFilter: true,
      mandatory: "1",
      view: "1",
      options: [
        { label: "Manual", value: "manual" },
        { label: "Automatic", value: "automatic" },
      ],
    },
  ],
};
