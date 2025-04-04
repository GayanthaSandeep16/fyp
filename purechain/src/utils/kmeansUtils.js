// This utility function prepares data for K-Means clustering by removing the target column
// and imputing missing values with the mean of each feature. It also logs the original data,
export function prepareKMeansData(data) {
    console.log("Preparing data for K-Means by removing target column and imputing missing values...");
    console.log("Original data sample:", data.slice(0, 2));
  
    // Compute means for all features
    const featureSums = {};
    const featureCounts = {};
    data.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== "target") {
          const value = Number(row[key]);
          if (!isNaN(value) && value !== undefined && value !== null) {
            featureSums[key] = (featureSums[key] || 0) + value;
            featureCounts[key] = (featureCounts[key] || 0) + 1;
          }
        }
      });
    });
  
    const featureMeans = {};
    Object.keys(featureSums).forEach(key => {
      featureMeans[key] = featureCounts[key] > 0 ? featureSums[key] / featureCounts[key] : 0;
    });
    console.log("Computed feature means for imputation:", featureMeans);
  
    // Remove target and impute missing values
    const preparedData = data.map(row => {
      const { target, ...features } = row;
      const cleanedRow = { ...features };
      Object.keys(featureMeans).forEach(key => {
        const value = Number(cleanedRow[key]);
        cleanedRow[key] = (!isNaN(value) && value !== undefined && value !== null) ? value : featureMeans[key];
      });
      return cleanedRow;
    });
  
    console.log("Prepared data sample (after imputation):", preparedData.slice(0, 2));
    return preparedData;
  }