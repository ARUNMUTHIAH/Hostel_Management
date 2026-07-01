import React, { useEffect, useState, useRef } from "react";
import "./login.css";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import axios from "axios";
import { API_URL } from "../API_URL";
import errorHandlers from "../utils/errorHandlers";

const LoginForm = () => {
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });
  const inputRefs = useRef({
    username: null,
    password: null,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  useEffect(() => {
    sessionStorage.clear();
  }, []);

  const validateForm = () => {
    return (
      loginData.username.trim().length > 0 &&
      loginData.password.trim().length > 0
    );
  };

  const buildNestedSidebar = (items = []) => {
    const permissionMap = {};
    const childrenMap = {};

    // Step 1: Build maps
    items.forEach((item) => {
      permissionMap[item.permission] = { ...item }; // clone to avoid mutation
      if (item.parent_permission !== null || item.parent_permission !== 0) {
        if (!childrenMap[item.parent_permission]) {
          childrenMap[item.parent_permission] = [];
        }
        childrenMap[item.parent_permission].push(item);
      }
    });

    // Step 2: Build final structure
    const sidebar = [];

    items.forEach((item) => {
      if (item.parent_permission === null || item.parent_permission === 0) {
        const permissionId = item.permission;
        const children = childrenMap[permissionId];

        if (children) {
          sidebar.push({
            ...item,
            children,
          });
        } else {
          sidebar.push({ ...item });
        }
      }
    });

    return sidebar;
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    if (validateForm()) {
      try {
        const response = await axios.post(`${API_URL}/auth/login`, loginData);

        if (response.data.status === true && response.data.accessToken) {
          // Save token and user data
          sessionStorage.setItem("accessToken", response.data.accessToken);
          sessionStorage.setItem(
            "permissions",
            JSON.stringify(response.data.permissions)
          );
          const nestedSidebar = buildNestedSidebar(response.data.sidebar);
          sessionStorage.setItem("sidebar", JSON.stringify(nestedSidebar));
          sessionStorage.setItem(
            "Username",
            JSON.stringify(response.data.Username)
          );

          toast.success(response.data.message, {
            autoClose: 2000,
            onClose: () => setIsSubmitting(false),
          });

          setTimeout(() => {
            navigate("/dashboard");
          }, 2000);
        } else {
          toast.error(response.data.message, {
            autoClose: 1000,
            onClose: () => setIsSubmitting(false),
          });
        }
      } catch (error) {
        const errorMessage = errorHandlers.handleCommonApiError(
          error,
          "Login failed. Please try again."
        );

        toast.error(errorMessage, {
          autoClose: 1000,
          onClose: () => setIsSubmitting(false),
        });
      }
    } else {
      toast.error("Please Enter All Fields....!", {
        autoClose: 1000,
        onClose: () => setIsSubmitting(false),
      });
    }
  };

  return (
    <div className="srmlogin-page">
      <div className="srmlogin-container">
        <div className="srmloginleft-panel">
          <img src="images\hms1.jpg" alt="" aria-hidden="true" />
          <div className="login-hero-content">
            <div className="login-hero-badge">
              <i className="bi bi-shield-check"></i>
              Secure Portal
            </div>
            <h1 className="login-hero-title">Hostel Management System</h1>
            <p className="login-hero-desc">
              Manage students, attendance, reports and hostel operations from one unified dashboard.
            </p>
            <ul className="login-hero-features">
              <li><i className="bi bi-people-fill"></i> Student Registration & Tracking</li>
              <li><i className="bi bi-graph-up"></i> Real-time Dashboard Analytics</li>
              <li><i className="bi bi-fingerprint"></i> Biometric Integration</li>
            </ul>
          </div>
        </div>

        <div className="srmloginright-panel">
          <div className="login-form-card srmloginform-box">
            <div className="login-form-header">
              <img
                src="/2cqr-512.png"
                className="srmloginrightsidelogo"
                alt="2cqr"
              />
              <h2>Sign in</h2>
              <p className="welcome-text">
                Welcome back <span className="wave-emoji">{"\u{1F44B}"}</span>
              </p>
            </div>

            <form onSubmit={handleLogin} className="srmloginpage login-form-body">
              <div className="login-field">
                <label htmlFor="username" className="form-label">
                  Username
                </label>
                <div className="hms-input-wrap">
                  <i className="bi bi-person"></i>
                  <input
                    type="text"
                    autoFocus
                    className="form-control"
                    id="username"
                    placeholder="Enter your username"
                    ref={(el) => (inputRefs.current.username = el)}
                    value={loginData.username}
                    onChange={(e) =>
                      setLoginData((pre) => ({
                        ...pre,
                        username: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        inputRefs.current.password?.focus();
                      }
                    }}
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <div className="login-password-group input-group">
                  <div className="hms-input-wrap">
                    <i className="bi bi-lock"></i>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-control"
                      id="password"
                      ref={(el) => (inputRefs.current.password = el)}
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData((pre) => ({
                          ...pre,
                          password: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleLogin(e);
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={togglePasswordVisibility}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <i
                      className={`bi ${
                        showPassword ? "bi-eye-slash" : "bi-eye"
                      }`}
                    ></i>
                  </button>
                </div>
              </div>

              <div className="login-form-actions">
                <button
                  type="button"
                  data-bs-toggle="modal"
                  data-bs-target="#infoModal"
                  className="forgot-password-link"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                className="btn btn-primary login-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    Please wait...
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-box-arrow-in-right"></i>
                    Sign In
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
};

export default LoginForm;
