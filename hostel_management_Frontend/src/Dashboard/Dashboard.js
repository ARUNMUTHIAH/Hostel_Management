/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
import "./dashboard.css";
import SidebarDashboard from "../Sidebar/sidebar";
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
  const socketInitialized = useRef(false);
  const lastFetchRef = useRef(0);

  const fetchDashboardData = async (hostelId = selectedHostel) => {
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) return; // prevent rapid refetch from socket events
    lastFetchRef.current = now;

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

  // Initialize dashboard & socket
  useEffect(() => {
    fetchDashboardData(); // initial fetch

    if (!socketInitialized.current) {
      socketInitialized.current = true;
      socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });

      socketRef.current.on("connect", () => {
        console.log("✅ Socket connected:", socketRef.current.id);
      });

      socketRef.current.on("newPunch", (data) => {
        const storedHostelId =
          sessionStorage.getItem("selectedHostelId") || selectedHostel;

        if (
          ["movement", "sms_sent", "dashboard_allowed_time_trigger"].includes(
            data.type
          )
        ) {
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

  // Refetch when hostel changes
  useEffect(() => {
    if (dashboardData.mappedHostels) {
      fetchDashboardData(selectedHostel);
    }
  }, [selectedHostel]);

  const handleHostelSelect = (value) => {
    setSelectedHostel(value);
    sessionStorage.setItem("selectedHostelId", value);
  };

  const mappedHostels = dashboardData.mappedHostels || [];

  // ================= UI =================
  return (
    <div className="d-flex assetdashboard hms-app-shell">
      <SidebarDashboard />

      <div className="main-content flex-grow-1">
        <div className="container py-3 hms-page">
          <div className="hms-page-shell dashboard-page-shell">
            <div className="hms-page-band">
              <div className="hms-page-header__title-row">
                <div className="hms-page-header__icon">
                  <i className="bi bi-speedometer2"></i>
                </div>
                <div>
                  <h1 className="hms-page-title">Dashboard Overview</h1>
                  <p className="hms-page-subtitle">Real-time hostel operations at a glance</p>
                </div>
              </div>
            </div>

            <div className="hms-action-band dashboard-hostel-band">
              <label htmlFor="hostel-filter" className="dashboard-hostel-band__label">
                <span className="dashboard-hostel-band__icon" aria-hidden="true">
                  <i className="bi bi-building"></i>
                </span>
                <span className="dashboard-hostel-band__text">
                  <span className="dashboard-hostel-band__title">Filter by Hostel</span>
                  <span className="dashboard-hostel-band__hint">Select hostel to view dashboard data</span>
                </span>
              </label>

              <div className="dashboard-hostel-band__control">
                {mappedHostels.length > 1 ? (
                  <div className="dashboard-hostel-select-wrap">
                    <i className="bi bi-funnel dashboard-hostel-select-wrap__lead" aria-hidden="true"></i>
                    <select
                      id="hostel-filter"
                      className="dashboard-hostel-select"
                      value={selectedHostel}
                      onChange={(e) => handleHostelSelect(e.target.value)}
                    >
                      <option value="all">All Hostels</option>
                      {mappedHostels.map((hostel) => (
                        <option key={hostel.id} value={hostel.id}>
                          {hostel.hostel_name}
                        </option>
                      ))}
                    </select>
                    <i className="bi bi-chevron-down dashboard-hostel-select-wrap__chevron" aria-hidden="true"></i>
                  </div>
                ) : mappedHostels.length === 1 ? (
                  <div className="dashboard-hostel-pill">
                    <i className="bi bi-building" aria-hidden="true"></i>
                    <span>{mappedHostels[0].hostel_name}</span>
                  </div>
                ) : (
                  <div className="dashboard-hostel-pill dashboard-hostel-pill--muted">
                    No hostel available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 1: Stat cards — 4 equal columns */}
          <div className="row g-3 mb-4">
            <StatCards dashboardData={dashboardData} />
          </div>

          {/* Row 2: Line chart — full width */}
          <div className="row g-3 mb-4">
            <div className="col-12">
              <div className="dashboardchart-card">
                <h6>New Students Registered</h6>
                <div style={{ height: "240px" }}>
                  <LineChart data={dashboardData.monthlyDistribution || []} />
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Donut charts */}
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="dashboardchart-card">
                <h6>Student Currently Outside Overall Count</h6>
                <div style={{ height: "220px" }}>
                  <StudentCurrentlyOutsideDonutChart
                    data={dashboardData.currentOutsideDistribution || {}}
                  />
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="dashboardchart-card">
                <h6>Student Lifecycle Status</h6>
                <div style={{ height: "220px" }}>
                  <DonutChart data={dashboardData.lifecycleStatus || {}} />
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Biometric devices */}
          <div className="row g-3 mb-4">
            <div className="col-12">
              <div className="dashboardchart-card">
                <h6>Biometric Devices Status</h6>
                <div className="hms-device-grid">
                  {(dashboardData.biometricDevices || []).map((device) => {
                    const connected = device.power_status === "Connected";
                    return (
                      <div
                        key={device.device_ip}
                        className={`hms-device-pill ${connected ? "hms-device-pill--connected" : "hms-device-pill--disconnected"}`}
                      >
                        <span className="hms-device-pill__dot"></span>
                        <span>{device.device_ip}</span>
                        <span className="hms-device-pill__status">{device.power_status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Row 5: Location bar chart */}
          <div className="row g-3 mb-4">
            <div className="col-12">
              <div className="dashboardchart-card">
                <h6>Registered Students by Hostel Location</h6>
                <div style={{ height: "260px" }}>
                  <BarChart data={dashboardData.locationDistribution || []} />
                </div>
              </div>
            </div>
          </div>

          <footer className="hms-app-footer">
            <img src="images/2cqrfooterlogo.png" alt="2cqr logo" />
            <span>2cqr &copy; 2025</span>
          </footer>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
};

export default Dashboard;
