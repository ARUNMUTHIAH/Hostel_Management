const chartOptions = {
  bar: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: "#f0f0f0" },
        ticks: { precision: 0 },
      },
    },
  },

  donut: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          boxWidth: 20,
          padding: 20,
          font: { size: 14 },
          color: "#000",
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "#000",
        titleColor: "#fff",
        bodyColor: "#fff",
      },
    },
  },

  horizontalBar: {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { color: "#f0f0f0" },
        ticks: { precision: 0 },
      },
      y: {
        grid: { display: false },
        ticks: {
          font: { size: 12 },
          color: "#000",
        },
      },
    },
  },

  line: (suggestedMax = 500) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { grid: { color: "#f0f0f0" } },
      y: {
        grid: { color: "#f0f0f0" },
        ticks: { precision: 0 },
        suggestedMax,
      },
    },
  }),
};

export default chartOptions;
