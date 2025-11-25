import React, { useEffect, useRef, useState } from "react";
import { Chart } from "chart.js";
import chartOptions from "../utils/chartOptions";
import chartColors from "../utils/chartColors";

const DonutChart = ({ data }) => {
  const chartRef = useRef(null);
  const [viewType, setViewType] = useState("day"); // default: day-wise

  useEffect(() => {
    if (!data || (!data.dayWise && !data.monthWise)) return;

    const chartData =
      viewType === "month" ? data.monthWise || [] : data.dayWise || [];
    if (!chartData.length) return;

    const ctx = chartRef.current.getContext("2d");

    // Destroy previous chart instance
    if (chartRef.current._chartInstance) {
      chartRef.current._chartInstance.destroy();
    }

    let labels = [];
    let values = [];

    if (viewType === "month") {
      // Group by month+status to avoid duplicates
      const summary = {};
      chartData.forEach((item) => {
        const key = `${item.month}-${item.status}`;
        summary[key] = (summary[key] || 0) + item.count;
      });
      labels = Object.keys(summary).map((key) => {
        const [month, status] = key.split("-");
        return `${new Date(0, month - 1).toLocaleString("en", {
          month: "short",
        })}-${status}`;
      });
      values = Object.values(summary);
    } else {
      // Day-wise grouped by status
      const summary = {};
      chartData.forEach((item) => {
        summary[item.label] = (summary[item.label] || 0) + item.value;
      });
      labels = Object.keys(summary);
      values = Object.values(summary);
    }

    const chartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: chartColors.donut.colors.slice(0, labels.length),
            borderWidth: 2,
            borderColor: "white",
          },
        ],
      },
      options: {
        ...chartOptions.donut,
        plugins: {
          ...chartOptions.donut.plugins,
          legend: {
            display: true,
            position: "bottom",
            labels: {
              font: { size: 11 },
              boxWidth: 12,
            },
          },
        },
      },
    });

    chartRef.current._chartInstance = chartInstance;

    return () => chartInstance.destroy();
  }, [data, viewType]);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
        }}
      >
        <h6 style={{ margin: 0, fontSize: "16px" }}>
          IN / OUT Status ({viewType === "day" ? "Day-wise" : "Month-wise"})
        </h6>

        <select
          value={viewType}
          onChange={(e) => setViewType(e.target.value)}
          style={{
            fontSize: "12px",
            padding: "3px 6px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            outline: "none",
            background: "#fff",
          }}
        >
          <option value="day">Day-wise</option>
          <option value="month">Month-wise</option>
        </select>
      </div>

      <canvas ref={chartRef}></canvas>
    </>
  );
};

export default DonutChart;
