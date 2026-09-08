/**
 * Isolation Forest for Process Anomaly Detection
 * 
 * Implements Liu, Ting & Zhou (2008) Isolation Forest algorithm
 * for unsupervised anomaly scoring on multivariate chemical process data.
 */

class IsolationTreeNode {
  constructor(splitFeature = null, splitValue = null, left = null, right = null, size = 0) {
    this.splitFeature = splitFeature;
    this.splitValue = splitValue;
    this.left = left;
    this.right = right;
    this.size = size;
  }

  isLeaf() {
    return this.left === null && this.right === null;
  }
}

function c(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const eulerMascheroni = 0.5772156649;
  return 2.0 * (Math.log(n - 1) + eulerMascheroni) - (2.0 * (n - 1) / n);
}

export class IsolationForest {
  constructor(numTrees = 50, subSampleSize = 256, threshold = 0.58) {
    this.numTrees = numTrees;
    this.subSampleSize = subSampleSize;
    this.threshold = threshold;
    this.trees = [];
    this.featureNames = [];
    this.maxHeight = Math.ceil(Math.log2(Math.max(subSampleSize, 2)));
    this.isTrained = false;
  }

  buildTree(data, currentHeight, maxHeight) {
    if (currentHeight >= maxHeight || data.length <= 1) {
      return new IsolationTreeNode(null, null, null, null, data.length);
    }

    // Pick random feature
    const featureIdx = Math.floor(Math.random() * this.featureNames.length);
    const featureName = this.featureNames[featureIdx];

    let min = Infinity;
    let max = -Infinity;
    for (const sample of data) {
      const val = sample[featureName];
      if (val < min) min = val;
      if (val > max) max = val;
    }

    if (min === max) {
      return new IsolationTreeNode(null, null, null, null, data.length);
    }

    // Pick random split point between min and max
    const splitValue = min + Math.random() * (max - min);

    const leftData = [];
    const rightData = [];

    for (const sample of data) {
      if (sample[featureName] < splitValue) {
        leftData.push(sample);
      } else {
        rightData.push(sample);
      }
    }

    const left = this.buildTree(leftData, currentHeight + 1, maxHeight);
    const right = this.buildTree(rightData, currentHeight + 1, maxHeight);

    return new IsolationTreeNode(featureName, splitValue, left, right, data.length);
  }

  fit(data, featureNames) {
    this.featureNames = featureNames;
    this.trees = [];
    const n = data.length;
    const sampleSize = Math.min(n, this.subSampleSize);
    this.maxHeight = Math.ceil(Math.log2(Math.max(sampleSize, 2)));

    for (let t = 0; t < this.numTrees; t++) {
      // Subsample
      const subset = [];
      for (let s = 0; s < sampleSize; s++) {
        const randIdx = Math.floor(Math.random() * n);
        subset.push(data[randIdx]);
      }
      const root = this.buildTree(subset, 0, this.maxHeight);
      this.trees.push(root);
    }

    this.isTrained = true;
    console.log(`🌲 Isolation Forest trained with ${this.numTrees} trees on ${sampleSize} subsamples.`);
  }

  pathLength(sample, node, currentHeight) {
    if (node.isLeaf()) {
      return currentHeight + c(node.size);
    }

    const val = sample[node.splitFeature];
    if (val === undefined || val < node.splitValue) {
      return this.pathLength(sample, node.left, currentHeight + 1);
    } else {
      return this.pathLength(sample, node.right, currentHeight + 1);
    }
  }

  predict(sample) {
    if (!this.isTrained || this.trees.length === 0) {
      return { anomaly: false, anomaly_score: 0.2 };
    }

    let totalPathLength = 0;
    for (const tree of this.trees) {
      totalPathLength += this.pathLength(sample, tree, 0);
    }

    const avgPathLength = totalPathLength / this.trees.length;
    const cN = c(this.subSampleSize);
    const score = Math.pow(2, - (avgPathLength / cN));

    // Clamp score to [0, 1]
    const clampedScore = Math.max(0, Math.min(1, score));
    const anomaly = clampedScore >= this.threshold;

    return {
      anomaly,
      anomaly_score: Number(clampedScore.toFixed(3))
    };
  }
}
