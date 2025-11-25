
const createBarGradients = (ctx, height) =>
  chartColors.bar.barColorPairs.map(([start, end]) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, start);
    gradient.addColorStop(1, end);
    return gradient;
  });

const horizontalBarGradients = (ctx) => {
  return chartColors.horizontalBar.colorPairs.map(([start, end]) => {
    const gradient = ctx.createLinearGradient(0, 0, 400, 0);
    gradient.addColorStop(0, start);
    gradient.addColorStop(1, end);
    return gradient;
  });
};

const chartColors = {
  bar: {
    barColorPairs: [
      ["#009FF7", "#9DDCFF"],
      ["#3B76DF", "#C2D8FF"],
      ["#DE5255", "#FE999B"],
      ["#F79458", "#FAB68D"],
      ["#7B5DC4", "#CBB7FC"],
      ["#009FF7", "#9DDCFF"],
      ["#3B76DF", "#C2D8FF"],
      ["#DE5255", "#FE999B"],
      ["#F79458", "#FAB68D"],
      ["#74AE61", "#B7FFA0"],
    ],
    createGradients: createBarGradients,
  },
  donut: {
    colors: ["#3B76DF", "#FB923C", "#74AE61", "#DE5255"],
  },
  horizontalBar: {
    colorPairs: [
      ["#3B76DF", "#B7D1FF"],
      ["#9A7DE1", "#C6AEFF"],
      ["#FB6568", "#FF989A"],
      ["#F79458", "#F6C1A1"],
      ["#4D9AA3", "#A1F6FF"],
      ["#74AE61", "#BEFFA8"],
    ],
    createGradients: horizontalBarGradients,
  },
  line: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    pointBackgroundColor: "#3b82f6",
    pointBorderColor: "#fff",
  },
};

export default chartColors;
