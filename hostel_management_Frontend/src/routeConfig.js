import ProductTypeMaster from "./Producttypemasters/producttypemasters";
import ReportPage from "./Reports";
import StudentRegistration from "./Asset";
import Masters from "./Masters/Masters";
import NoPageFound from "./NoPageFound";
import Dashboard from "./Dashboard/Dashboard";
import Visitor from "./Visitors/Visitor";

const appRoutes = [
  { path: "/dashboard", component: Dashboard },
  { path: "/master", component: ProductTypeMaster },
  { path: "/:masterKey", component: Masters },
  { path: "/studentregistration", component: StudentRegistration },
  { path: "/report/:reportKey", component: ReportPage },
  { path: "/visitor", component: Visitor },
  { path: "/nopagefound", component: NoPageFound },
  { path: "*", component: NoPageFound },
];

export default appRoutes;
