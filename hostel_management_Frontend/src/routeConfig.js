import ProductTypeMaster from "./Producttypemasters/producttypemasters";
import ReportPage from "./Reports";
import StudentRegistration from "./Asset";
import Masters from "./Masters/Masters";
import NoPageFound from "./NoPageFound";
import Dashboard from "./Dashboard/Dashboard";

import SmsApproval from "./SmsApproval.js/SmsApproval";
import BulkSMSApproval from "./SmsApproval.js/BulkSMSApproval";
import BiometricConfig from "./Biometric/BioMetricConfig";

const appRoutes = [
  { path: "/dashboard", component: Dashboard },
  { path: "/master", component: ProductTypeMaster },
  { path: "/:masterKey", component: Masters },
  { path: "/studentregistration", component: StudentRegistration },
  { path: "/report/:reportKey", component: ReportPage },
  { path: "/latereturnsmsapproval", component: SmsApproval },
  { path: "/bulksmsapproval", component: BulkSMSApproval },
  { path: "/nopagefound", component: NoPageFound },
  { path: "/biometric_config", component: BiometricConfig },
  { path: "*", component: NoPageFound },
];

export default appRoutes;
