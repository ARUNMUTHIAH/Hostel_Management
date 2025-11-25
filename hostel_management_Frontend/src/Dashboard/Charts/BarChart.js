// components/Charts/BarChart.js

import React, { useEffect, useRef } from "react";
import { Chart } from "chart.js";
import chartOptions from "../utils/chartOptions";
import chartColors from "../utils/chartColors";

const BarChart = ({ data }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!data.length) return;

    const ctx = chartRef.current.getContext("2d");

    // Destroy previous instance
    if (chartRef.current._chartInstance) {
      chartRef.current._chartInstance.destroy();
    }

    const sortedData = [...data].sort((a, b) => b.count - a.count).slice(0, 10);
    const labels = sortedData.map((item) => item.name);
    const values = sortedData.map((item) => item.count);
    const gradients = chartColors.bar.createGradients(
      ctx,
      chartRef.current.height
    );

    const chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Students",
            data: values,
            backgroundColor: gradients,
            borderRadius: 6,
            barThickness: 28,
            borderSkipped: false,
          },
        ],
      },
      options: chartOptions.bar,
    });

    chartRef.current._chartInstance = chartInstance;

    return () => chartInstance.destroy();
  }, [data]);

  return <canvas ref={chartRef}></canvas>;
};

export default BarChart;
