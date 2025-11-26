/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
import "./dashboard.css";
import SidebarDashboard from "../Sidebar/sidebar";
import Header from "../Header/header";
import axios from "axios";
import { API_URL } from "../API_URL";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DonutChart from "./Charts/DonutChart";
import LineChart from "./Charts/LineChart";
import BarChart from "./Charts/BarChart";
import StatCards from "./statCards";
import errorHandlers, { handleTokenExpired } from "../utils/errorHandlers";
import StudentCurrentlyOutsideDonutChart from "./Charts/StudentCurrentlyOutsideDonutChart";

Chart.register(...registerables);

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({});
  const fetched = useRef(false);

  const fetchDashboardData = async () => {
    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await axios.get(`${API_URL}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 200) {
        setDashboardData(response.data?.data || {});
      } else {
        setDashboardData({});
      }
    } catch (error) {
      if (error.response?.status === 401) {
        handleTokenExpired();
        return;
      }
      const msg = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch dashboard data."
      );
      toast.error(msg, { autoClose: 1000 });
      setDashboardData({});
    }
  };

  useEffect(() => {
    if (!fetched.current) {
      fetched.current = true;
      fetchDashboardData();
    }
  }, []);

  return (
    <div className="d-flex assetdashboard">
      <Header />
      <SidebarDashboard />

      <div className="main-content flex-grow-1" style={{ marginTop: "56px" }}>
        <div className="container py-4">
          {/* ✔ TOP STAT CARDS */}
          <div className="row g-4 mb-4">
            <div className="col-md-4">
              <StatCards dashboardData={dashboardData} />
            </div>

            {/* ✔ MONTHLY STUDENT REGISTRATION */}
            <div className="col-md-8">
              <div className="dashboardchart-card">
                <h6>New Students Registered</h6>
                <div style={{ height: "220px" }}>
                  <LineChart data={dashboardData.monthlyDistribution || []} />
                </div>
              </div>
            </div>
          </div>

          {/* ✔ MIDDLE ROW (Horizontal + Donut) */}
          <div className="row g-3">
            {/* ✔ Students Currently Outside Distribution */}
            <div className="col-md-6">
              <div className="dashboardchart-card">
                <h6>Student Currently Outside</h6>
                <div style={{ height: "200px" }}>
                  <StudentCurrentlyOutsideDonutChart
                    data={dashboardData.currentOutsideDistribution || []}
                  />
                </div>
              </div>
            </div>

            {/* ✔ IN / OUT Donut Chart */}
            <div className="col-md-6">
              <div className="dashboardchart-card">
                <div style={{ height: "200px" }}>
                  <DonutChart data={dashboardData.lifecycleStatus || []} />
                </div>
              </div>
            </div>
          </div>

          {/* ✔ LOCATION DISTRIBUTION BAR */}
          <div className="row g-3 mt-1">
            <div className="col-md-12">
              <div className="dashboardchart-card">
                <h6>Registered Students by Hostel Location</h6>
                <div style={{ height: "230px" }}>
                  <BarChart data={dashboardData.locationDistribution || []} />
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-4 lastassettrackingfooter d-flex align-items-center gap-2">
            <img src="images/2cqrfooterlogo.png" alt="logo" width="30" />
            <strong>2cqr &copy; 2025</strong>
          </footer>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
};

export default Dashboard;
