import React, { useEffect, useRef } from "react";
import { Chart } from "chart.js";
import chartColors from "../utils/chartColors";
import chartOptions from "../utils/chartOptions";

const StudentCurrentlyOutsideDonutChart = ({ data }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!data) return;

    const ctx = chartRef.current.getContext("2d");

    // Destroy previous chart instance if exists
    if (chartRef.current._chartInstance) {
      chartRef.current._chartInstance.destroy();
    }

    // ✔ Map new object fields to arrays for chart
    const labels = ["IN Time", "OUT Time", "Overdue"];
    const values = [
      Number(data.inTimeCount) || 0,
      Number(data.outTimeCount) || 0,
      Number(data.overdueCount) || 0,
    ];

    const chartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: chartColors.donut.colors.slice(0, labels.length),
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        ...chartOptions.donut,
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              font: { size: 12 },
              usePointStyle: true,
            },
          },
        },
      },
    });

    chartRef.current._chartInstance = chartInstance;

    return () => chartInstance.destroy();
  }, [data]);

  return <canvas ref={chartRef}></canvas>;
};

export default StudentCurrentlyOutsideDonutChart;
