import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Chip,
  Stack,
} from "@mui/material";
import { BsFingerprint, BsTrash, BsPlus } from "react-icons/bs";
import axios from "axios";
import { toast } from "react-toastify";
import { API_URL } from "../API_URL";
import SidebarDashboard from "../Sidebar/sidebar";

export default function BiometricConfig() {
  const token = sessionStorage.getItem("accessToken");

  const [hostels, setHostels] = useState([]);
  const [selectedHostel, setSelectedHostel] = useState(null);

  const [deviceIp, setDeviceIp] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [isAttendance, setIsAttendance] = useState(true);
  const [direction, setDirection] = useState("BOTH");
  const [openDialog, setOpenDialog] = useState(false);

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    const load = async () => {
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
    load();
  }, [token]);

  /* ================= HANDLERS ================= */
  const handleAdd = (hostel) => {
    setSelectedHostel(hostel);
    setDeviceIp("");
    setIsRegister(false);
    setIsAttendance(true);
    setDirection("BOTH");
    setOpenDialog(true);
  };

  const handleDelete = async (hostelId, deviceId) => {
    if (!window.confirm("Delete this device?")) return;

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
  };

  const handleSave = async () => {
    if (!deviceIp) return toast.error("Device IP required");

    const payload = {
      hostel_id: selectedHostel.id,
      server_ip: "72.61.239.8",
      port: 8091,
      device_ip: deviceIp,
      device_name: "Biometric Device",
      is_registration_device: isRegister ? 1 : 0,
      is_attendance_device: isAttendance ? 1 : 0,
      device_direction: direction,
    };

    await axios.post(`${API_URL}/biometric/device`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    toast.success("Device added");
    setOpenDialog(false);
    window.location.reload();
  };

  /* ================= UI ================= */
  return (
    <Box display="flex" height="100vh">
      <SidebarDashboard />

      <Box flex={1} p={4} style={{ marginTop: "54px", overflowY: "auto" }}>
        <Typography variant="h5" fontWeight={600} mb={2}>
          <BsFingerprint /> Biometric Device Management
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Configure registration and attendance devices per hostel
        </Typography>

        {hostels.map((hostel) => (
          <Card key={hostel.id} sx={{ mb: 3, borderRadius: 3 }}>
            <CardHeader
              title={<Typography fontWeight={600}>{hostel.name}</Typography>}
              action={
                <Button
                  size="small"
                  startIcon={<BsPlus />}
                  onClick={() => handleAdd(hostel)}
                >
                  Add Device
                </Button>
              }
            />

            <Divider />

            <CardContent>
              {hostel.devices.length ? (
                <Stack spacing={2}>
                  {hostel.devices.map((d) => (
                    <Box
                      key={d.id}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: "1px solid #e0e0e0",
                        background: "#fafafa",
                      }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Box>
                          <Typography fontWeight={600}>
                            {d.device_ip}
                          </Typography>
                          <Stack direction="row" spacing={1} mt={1}>
                            {d.is_registration_device === 1 && (
                              <Chip
                                label="Registration"
                                color="success"
                                size="small"
                              />
                            )}
                            {d.is_attendance_device === 1 && (
                              <Chip
                                label="Attendance"
                                color="primary"
                                size="small"
                              />
                            )}
                            <Chip
                              label={`Direction: ${d.device_direction}`}
                              size="small"
                            />
                          </Stack>
                        </Box>

                        <IconButton
                          onClick={() => handleDelete(hostel.id, d.id)}
                        >
                          <BsTrash color="red" />
                        </IconButton>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary">
                  No devices configured
                </Typography>
              )}
            </CardContent>
          </Card>
        ))}

        {/* ADD DEVICE DIALOG */}
        <Dialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          fullWidth
        >
          <DialogTitle>Add Biometric Device</DialogTitle>

          <DialogContent>
            <TextField
              fullWidth
              label="Device IP"
              value={deviceIp}
              onChange={(e) => setDeviceIp(e.target.value)}
              sx={{ mb: 2 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={isRegister}
                  onChange={(e) => setIsRegister(e.target.checked)}
                />
              }
              label="Registration Device"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={isAttendance}
                  onChange={(e) => setIsAttendance(e.target.checked)}
                />
              }
              label="Attendance Device"
            />

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
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
