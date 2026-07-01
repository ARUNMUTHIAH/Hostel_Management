/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
} from "@mui/material";
import { BsTrash, BsPlus, BsPencil } from "react-icons/bs";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_URL } from "../API_URL";
import SidebarDashboard from "../Sidebar/sidebar";
import "./BioMetricConfig.css";

const getBioTagClass = (type) => {
  if (type === "FACE") return "bio-tag--face";
  if (type === "BOTH") return "bio-tag--both";
  return "bio-tag--finger";
};

export default function BiometricConfig() {
  const token = sessionStorage.getItem("accessToken");

  const [hostels, setHostels] = useState([]);
  const [selectedHostel, setSelectedHostel] = useState(null);
  const [biometricType, setBiometricType] = useState("FINGER");

  const [deviceIp, setDeviceIp] = useState("");
  const [deviceSn, setDeviceSn] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [isAttendance, setIsAttendance] = useState(true);
  const [direction, setDirection] = useState("BOTH");

  const [openDialog, setOpenDialog] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);

  const loadData = async () => {
    try {
      const hostelRes = await axios.get(`${API_URL}/hostel`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await Promise.all(
        hostelRes.data.data.map(async (h) => {
          const d = await axios.get(`${API_URL}/biometric/devices/${h.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return { ...h, devices: d.data.data || [] };
        })
      );

      setHostels(data);
    } catch {
      toast.error("Failed to load devices");
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleAdd = (hostel) => {
    setSelectedHostel(hostel);
    setDeviceIp("");
    setDeviceSn("");
    setIsRegister(false);
    setIsAttendance(true);
    setDirection("BOTH");
    setBiometricType("FINGER");
    setIsEdit(false);
    setEditingDevice(null);
    setOpenDialog(true);
  };

  const handleEdit = (hostel, device) => {
    setSelectedHostel(hostel);
    setEditingDevice(device);
    setDeviceIp(device.device_ip);
    setDeviceSn(device.device_sn || "");
    setIsRegister(device.is_registration_device === 1);
    setIsAttendance(device.is_attendance_device === 1);
    setDirection(device.device_direction);
    setBiometricType(device.biometric_type);
    setIsEdit(true);
    setOpenDialog(true);
  };

  const handleDelete = async (hostelId, deviceId) => {
    if (!window.confirm("Delete this device?")) return;

    try {
      await axios.delete(`${API_URL}/biometric/device/${deviceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setHostels((prev) =>
        prev.map((h) =>
          h.id === hostelId
            ? { ...h, devices: h.devices.filter((d) => d.id !== deviceId) }
            : h
        )
      );

      toast.success("Device removed");
    } catch {
      toast.error("Failed to delete device");
    }
  };

  const handleSave = async () => {
    if (!deviceIp) return toast.error("Device IP required");

    const payload = {
      hostel_id: selectedHostel.id,
      server_ip:
        process.env.REACT_APP_WDMS_SERVER_IP ||
        editingDevice?.server_ip ||
        "76.13.198.196",
      port: Number(
        process.env.REACT_APP_WDMS_PORT || editingDevice?.port || 8095
      ),
      device_ip: deviceIp,
      ...(deviceSn.trim() ? { device_sn: deviceSn.trim() } : {}),
      device_name: "Biometric Device",
      is_registration_device: isRegister ? 1 : 0,
      is_attendance_device: isAttendance ? 1 : 0,
      device_direction: direction,
      biometric_type: biometricType,
    };

    try {
      if (isEdit && editingDevice) {
        await axios.put(
          `${API_URL}/biometric/device/${editingDevice.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Device updated");
      } else {
        await axios.post(`${API_URL}/biometric/device`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Device added");
      }

      setOpenDialog(false);
      loadData();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save device");
    }
  };

  const pageName =
    sessionStorage.getItem("activeSidebarName") || "Biometric Device Management";

  return (
    <div className="d-flex assetslocationmasterstable hms-app-shell">
      <SidebarDashboard />

      <div className="main-content flex-grow-1">
        <div className="container py-3 hms-page bio-page">
          <div className="hms-page-header">
            <div className="hms-page-header__title-row">
              <div className="hms-page-header__icon">
                <i className="bi bi-fingerprint"></i>
              </div>
              <div>
                <h1 className="hms-page-title">{pageName}</h1>
                <p className="hms-page-subtitle">
                  Configure registration and attendance devices per hostel
                </p>
              </div>
            </div>
          </div>

          <div className="bio-hostel-grid">
            {hostels.map((hostel) => (
              <div className="bio-hostel-card" key={hostel.id}>
                <div className="bio-hostel-card__header">
                  <div className="bio-hostel-card__title">
                    <i className="bi bi-building"></i>
                    <div>
                      <h3>{hostel.name || hostel.hostel_name}</h3>
                      <div className="bio-hostel-card__count">
                        {hostel.devices.length}{" "}
                        {hostel.devices.length === 1 ? "device" : "devices"}{" "}
                        configured
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="bio-add-btn"
                    onClick={() => handleAdd(hostel)}
                  >
                    <BsPlus size={16} />
                    Add Device
                  </button>
                </div>

                <div className="bio-hostel-card__body">
                  {hostel.devices.length > 0 ? (
                    <div className="bio-device-list">
                      {hostel.devices.map((d) => (
                        <div className="bio-device-item" key={d.id}>
                          <div className="bio-device-item__main">
                            <div className="bio-device-ip">
                              <i className="bi bi-hdd-network"></i>
                              {d.device_ip}
                            </div>
                            <div className="bio-device-tags">
                              {d.is_registration_device === 1 && (
                                <span className="bio-tag bio-tag--registration">
                                  <i className="bi bi-person-plus"></i>
                                  Registration
                                </span>
                              )}
                              <span className="bio-tag bio-tag--direction">
                                <i className="bi bi-arrow-left-right"></i>
                                Direction: {d.device_direction}
                              </span>
                              <span
                                className={`bio-tag ${getBioTagClass(
                                  d.biometric_type
                                )}`}
                              >
                                <i className="bi bi-fingerprint"></i>
                                Biometric: {d.biometric_type}
                              </span>
                            </div>
                          </div>
                          <div className="bio-device-actions">
                            <button
                              type="button"
                              className="bio-action-btn"
                              onClick={() => handleEdit(hostel, d)}
                              aria-label="Edit device"
                            >
                              <BsPencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="bio-action-btn bio-action-btn--delete"
                              onClick={() => handleDelete(hostel.id, d.id)}
                              aria-label="Delete device"
                            >
                              <BsTrash size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bio-empty-state">
                      <i className="bi bi-router"></i>
                      <p>No devices configured for this hostel</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <footer className="hms-app-footer">
            <img src="images/2cqrfooterlogo.png" alt="2cqr logo" />
            <span>2cqr &copy; 2025</span>
          </footer>
        </div>
      </div>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth>
        <DialogTitle>
          {isEdit ? "Edit Biometric Device" : "Add Biometric Device"}
        </DialogTitle>

        <DialogContent>
          <TextField
            fullWidth
            label="Device IP"
            value={deviceIp}
            onChange={(e) => setDeviceIp(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />

          {!isEdit && (
            <TextField
              fullWidth
              label="Device Serial Number (optional)"
              value={deviceSn}
              onChange={(e) => setDeviceSn(e.target.value)}
              helperText="Required if WDMS server login fails. Find SN on the device or in WDMS."
              sx={{ mb: 2 }}
            />
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={isRegister}
                onChange={(e) => setIsRegister(e.target.checked)}
              />
            }
            label="Registration Device"
          />

          <TextField
            select
            fullWidth
            label="Biometric Type"
            value={biometricType}
            onChange={(e) => setBiometricType(e.target.value)}
            sx={{ mt: 2 }}
          >
            <MenuItem value="FINGER">Fingerprint</MenuItem>
            <MenuItem value="FACE">Face</MenuItem>
            <MenuItem value="BOTH">Face & Finger</MenuItem>
          </TextField>

          <TextField
            select
            fullWidth
            label="Device Direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            sx={{ mt: 2 }}
          >
            <MenuItem value="BOTH">IN & OUT</MenuItem>
            <MenuItem value="IN">IN Only</MenuItem>
            <MenuItem value="OUT">OUT Only</MenuItem>
          </TextField>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {isEdit ? "Update" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}
