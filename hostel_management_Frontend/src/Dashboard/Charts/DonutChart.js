import React, { useEffect, useRef, useState } from "react";
import { Chart } from "chart.js";
import chartOptions from "../utils/chartOptions";
import chartColors from "../utils/chartColors";

const DonutChart = ({ data }) => {
  const chartRef = useRef(null);
  const [viewType, setViewType] = useState("day");

  useEffect(() => {
    if (!data || (!data.dayWise && !data.monthWise)) return;

    let chartData =
      viewType === "month" ? data.monthWise || [] : data.dayWise || [];
    if (!chartData.length) return;

    const ctx = chartRef.current.getContext("2d");

    if (chartRef.current._chartInstance) {
      chartRef.current._chartInstance.destroy();
    }

    let labels = [];
    let values = [];

    if (viewType === "month") {
      // ✅ Show only months with data
      const filteredMonths = chartData.filter(
        (item) => (item.IN || 0) + (item.OUT || 0) > 0
      );

      if (!filteredMonths.length) return;

      labels = filteredMonths.map((item) =>
        new Date(0, item.month - 1).toLocaleString("en", {
          month: "short",
        })
      );

      values = filteredMonths.map((item) => (item.IN || 0) + (item.OUT || 0));

      chartData = filteredMonths; // important for tooltip
    } else {
      labels = chartData.map((item) => item.label);
      values = chartData.map((item) => item.value);
    }

    const chartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: chartColors.donut.colors.slice(0, labels.length),
          },
        ],
      },
      options: {
        ...chartOptions.donut,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                const index = context.dataIndex;

                if (viewType === "month") {
                  const m = chartData[index];
                  return `IN: ${m.IN} , OUT: ${m.OUT}`;
                }

                return context.label + ": " + context.parsed;
              },
            },
          },

          legend: {
            display: true,
            position: "bottom",
            labels: {
              font: { size: 12 },
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
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h6>
          IN / OUT Status ({viewType === "day" ? "Day-wise" : "Month-wise"})
        </h6>

        <select
          value={viewType}
          style={{
            fontSize: "12px",
            padding: "3px 6px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            outline: "none",
            background: "#fff",
          }}
          onChange={(e) => setViewType(e.target.value)}
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
