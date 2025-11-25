import React from 'react'
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
        // If no token is found, redirect to login page
        return <Navigate to="/" />;
    }

    // If token exists, render the protected content
    return children

}

export default ProtectedRoute;