import { toast } from "react-toastify";

const errorHandlers = {
  isBadGatewayError: (error) => {
    const data = error?.response?.data;
    return typeof data === "string" && data.includes("502 Bad Gateway");
  },

  handleCommonApiError: (error, fallbackMessage = "Something went wrong.") => {
    if (errorHandlers.isBadGatewayError(error)) {
      return "Server unavailable (502 Bad Gateway). Please try again later.";
    }

    if (error?.message === "Network Error") {
      return "Network Error. Please check your connection.";
    }

    return (
      error?.response?.data?.message ||
      error?.message ||
      fallbackMessage
    );
  },

};

  const handleTokenExpired = () => {
    toast.error("Session expired. Please login again.", {
      autoClose: 1500,
      onClose: () => {
        sessionStorage.clear();
        window.location.replace("/");
      },
    });
  };

export  { handleTokenExpired};
export default errorHandlers;
