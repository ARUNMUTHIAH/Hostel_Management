/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
import "./dashboard.css";
import SidebarDashboard from "../Sidebar/sidebar";
import Header from "../Header/header";
import axios from "axios";
import { API_URL, SOCKET_URL } from "../API_URL";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import DonutChart from "./Charts/DonutChart";
import LineChart from "./Charts/LineChart";
import BarChart from "./Charts/BarChart";
import StatCards from "./statCards";
import StudentCurrentlyOutsideDonutChart from "./Charts/StudentCurrentlyOutsideDonutChart";

import errorHandlers, { handleTokenExpired } from "../utils/errorHandlers";
import { io } from "socket.io-client";

Chart.register(...registerables);

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({});
  const [selectedHostel, setSelectedHostel] = useState(
    sessionStorage.getItem("selectedHostelId") || "all"
  );

  const token = sessionStorage.getItem("accessToken");
  const socketRef = useRef(null);

  // Fetch dashboard data
  const fetchDashboardData = async (hostelId = selectedHostel) => {
    try {
      const response = await axios.get(`${API_URL}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { hostel_id: hostelId !== "all" ? hostelId : undefined },
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
      toast.error(
        errorHandlers.handleCommonApiError(
          error,
          "Failed to fetch dashboard data."
        ),
        { autoClose: 1000 }
      );
      setDashboardData({});
    }
  };

  // Initialize dashboard & setup socket
  useEffect(() => {
    const initialHostel = sessionStorage.getItem("selectedHostelId") || "all";
    fetchDashboardData(initialHostel);

    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        transports: ["websocket"],
      });

      socketRef.current.on("connect", () => {
        console.log("✅ Socket connected:", socketRef.current.id);
      });

      socketRef.current.on("newPunch", (data) => {
        console.log("📩 newPunch received:", data);

        const storedHostelId =
          sessionStorage.getItem("selectedHostelId") || selectedHostel;

        if (data.type === "movement") {
          fetchDashboardData(storedHostelId);
        } else if (data.type === "sms_sent") {
          fetchDashboardData(storedHostelId);
        }
      });

      socketRef.current.on("disconnect", (reason) => {
        console.log("❌ Socket disconnected:", reason);
      });

      socketRef.current.on("connect_error", (err) => {
        console.error("⚠️ Socket error:", err.message);
      });
    }

    return () => {
      console.log("🔌 Socket cleanup skipped (Dev Strict Mode)");
      // socketRef.current?.disconnect();
    };
  }, []);

  // Refetch data when selected hostel changes
  useEffect(() => {
    if (dashboardData.mappedHostels) {
      fetchDashboardData(selectedHostel);
    }
  }, [selectedHostel]);

  // ================= UI =================
  return (
    <div className="d-flex assetdashboard">
      <Header />
      <SidebarDashboard />

      <div className="main-content flex-grow-1" style={{ marginTop: "56px" }}>
        <div className="container py-4">
          {/* HEADER */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h5 className="mb-0 fw-bold text-dark">Dashboard Overview</h5>

            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small">Filter by Hostel:</span>

              {dashboardData.mappedHostels?.length > 1 ? (
                <select
                  className="form-select form-select-sm w-auto shadow-sm"
                  value={selectedHostel}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedHostel(value);
                    sessionStorage.setItem("selectedHostelId", value);
                  }}
                >
                  <option value="all">🏨 All Hostels</option>
                  {dashboardData.mappedHostels.map((hostel) => (
                    <option key={hostel.id} value={hostel.id}>
                      {hostel.hostel_name}
                    </option>
                  ))}
                </select>
              ) : dashboardData.mappedHostels?.length === 1 ? (
                <span className="fw-semibold text-primary">
                  {dashboardData.mappedHostels[0].hostel_name}
                </span>
              ) : (
                <span className="text-muted">No Hostel</span>
              )}
            </div>
          </div>

          {/* TOP STATS */}
          <div className="row g-4 mb-4">
            <div className="col-md-4">
              <StatCards dashboardData={dashboardData} />
            </div>

            <div className="col-md-8">
              <div className="dashboardchart-card">
                <h6>New Students Registered</h6>
                <div style={{ height: "220px" }}>
                  <LineChart data={dashboardData.monthlyDistribution || []} />
                </div>
              </div>
            </div>
          </div>

          {/* MIDDLE ROW */}
          <div className="row g-3">
            <div className="col-md-6">
              <div className="dashboardchart-card">
                <h6>Student Currently Outside</h6>
                <div style={{ height: "200px" }}>
                  <StudentCurrentlyOutsideDonutChart
                    data={dashboardData.currentOutsideDistribution || {}}
                  />
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="dashboardchart-card">
                <div style={{ height: "200px" }}>
                  <DonutChart data={dashboardData.lifecycleStatus || {}} />
                </div>
              </div>
            </div>
          </div>

          {/* LOCATION DISTRIBUTION */}
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
