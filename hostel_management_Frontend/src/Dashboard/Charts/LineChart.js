import React, { useEffect, useRef } from "react";
import { Chart } from "chart.js";
import chartColors from "../utils/chartColors";
import chartOptions from "../utils/chartOptions";

const LineChart = ({ data }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    const ctx = chartRef.current.getContext("2d");

    // Destroy previous chart if it exists
    if (chartRef.current._chartInstance) {
      chartRef.current._chartInstance.destroy();
    }

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const counts = new Array(12).fill(0);
    data.forEach((item) => {
      const monthIndex = item.month - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        counts[monthIndex] = item.count;
      }
    });

    const maxValue = Math.max(...counts);
    const suggestedMax = Math.ceil(maxValue / 100) * 100 + 100;

    const lineColors = chartColors.line;

    const chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: months,
        datasets: [
          {
            label: "Students",
            data: counts,
            borderColor: lineColors.borderColor,
            backgroundColor: lineColors.backgroundColor,
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: lineColors.pointBackgroundColor,
            pointBorderColor: lineColors.pointBorderColor,
            fill: true,
          },
        ],
      },
      options: chartOptions.line(suggestedMax),
    });

    chartRef.current._chartInstance = chartInstance;

    return () => chartInstance.destroy();
  }, [data]);

  return <canvas ref={chartRef}></canvas>;
};

export default LineChart;
