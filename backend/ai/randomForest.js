/**
 * Random Forest Classifier for Process Fault Diagnosis
 * 
 * Ensembles decision trees trained with bootstrap aggregating (bagging)
 * and random feature sub-selection to classify chemical process operating states.
 */

class DecisionTreeNode {
  constructor(feature = null, threshold = null, left = null, right = null, prediction = null, probabilities = null) {
    this.feature = feature;
    this.threshold = threshold;
    this.left = left;
    this.right = right;
    this.prediction = prediction;
    this.probabilities = probabilities;
  }

  isLeaf() {
    return this.prediction !== null;
  }
}

function calculateGini(labels, classes) {
  if (labels.length === 0) return 0;
  const counts = {};
  for (const label of labels) {
    counts[label] = (counts[label] || 0) + 1;
  }
  let sumP2 = 0;
  for (const c of classes) {
    const p = (counts[c] || 0) / labels.length;
    sumP2 += p * p;
  }
  return 1.0 - sumP2;
}

export class RandomForestClassifier {
  constructor(numTrees = 20, maxDepth = 8, minSamplesSplit = 4) {
    this.numTrees = numTrees;
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.trees = [];
    this.classes = [];
    this.featureNames = [];
    this.isTrained = false;
  }

  buildTree(data, currentDepth, classes, numFeaturesToConsider) {
    const labels = data.map(d => d.label);
    const uniqueLabels = [...new Set(labels)];

    // If pure or max depth or too few samples, make leaf
    if (uniqueLabels.length === 1 || currentDepth >= this.maxDepth || data.length < this.minSamplesSplit) {
      const counts = {};
      for (const l of labels) counts[l] = (counts[l] || 0) + 1;
      let majorityClass = classes[0];
      let maxCount = -1;
      const probabilities = {};
      for (const c of classes) {
        const count = counts[c] || 0;
        probabilities[c] = data.length > 0 ? count / data.length : 0;
        if (count > maxCount) {
          maxCount = count;
          majorityClass = c;
        }
      }
      return new DecisionTreeNode(null, null, null, null, majorityClass, probabilities);
    }

    // Select random subset of features (mtry = sqrt(p))
    const shuffledFeatures = [...this.featureNames].sort(() => 0.5 - Math.random());
    const candidateFeatures = shuffledFeatures.slice(0, numFeaturesToConsider);

    let bestGiniGain = -1;
    let bestFeature = null;
    let bestThreshold = null;
    let bestLeftData = [];
    let bestRightData = [];

    const currentGini = calculateGini(labels, classes);

    for (const feature of candidateFeatures) {
      const values = data.map(d => d.features[feature]).sort((a, b) => a - b);
      // Sample a few potential split thresholds
      const step = Math.max(1, Math.floor(values.length / 10));
      for (let i = step; i < values.length; i += step) {
        const threshold = (values[i - 1] + values[i]) / 2;
        const left = [];
        const right = [];

        for (const d of data) {
          if (d.features[feature] <= threshold) left.push(d);
          else right.push(d);
        }

        if (left.length === 0 || right.length === 0) continue;

        const leftGini = calculateGini(left.map(d => d.label), classes);
        const rightGini = calculateGini(right.map(d => d.label), classes);
        const weightedGini = (left.length / data.length) * leftGini + (right.length / data.length) * rightGini;
        const gain = currentGini - weightedGini;

        if (gain > bestGiniGain) {
          bestGiniGain = gain;
          bestFeature = feature;
          bestThreshold = threshold;
          bestLeftData = left;
          bestRightData = right;
        }
      }
    }

    if (bestGiniGain <= 0 || !bestFeature) {
      const counts = {};
      for (const l of labels) counts[l] = (counts[l] || 0) + 1;
      let majorityClass = classes[0];
      let maxCount = -1;
      const probabilities = {};
      for (const c of classes) {
        const count = counts[c] || 0;
        probabilities[c] = data.length > 0 ? count / data.length : 0;
        if (count > maxCount) {
          maxCount = count;
          majorityClass = c;
        }
      }
      return new DecisionTreeNode(null, null, null, null, majorityClass, probabilities);
    }

    const left = this.buildTree(bestLeftData, currentDepth + 1, classes, numFeaturesToConsider);
    const right = this.buildTree(bestRightData, currentDepth + 1, classes, numFeaturesToConsider);

    return new DecisionTreeNode(bestFeature, bestThreshold, left, right, null, null);
  }

  fit(data, featureNames, classes) {
    this.featureNames = featureNames;
    this.classes = classes;
    this.trees = [];

    const numFeaturesToConsider = Math.max(2, Math.floor(Math.sqrt(featureNames.length)));

    for (let t = 0; t < this.numTrees; t++) {
      // Bootstrap sample (sampling with replacement)
      const bootstrap = [];
      const n = data.length;
      for (let i = 0; i < n; i++) {
        const randIdx = Math.floor(Math.random() * n);
        bootstrap.push(data[randIdx]);
      }

      const tree = this.buildTree(bootstrap, 0, classes, numFeaturesToConsider);
      this.trees.push(tree);
    }

    this.isTrained = true;
    console.log(`🌲 Random Forest trained with ${this.numTrees} trees across classes:`, classes);
  }

  predictTree(node, sample) {
    if (node.isLeaf()) {
      return node.probabilities;
    }
    const val = sample[node.feature];
    if (val === undefined || val <= node.threshold) {
      return this.predictTree(node.left, sample);
    } else {
      return this.predictTree(node.right, sample);
    }
  }

  predict(sample) {
    if (!this.isTrained || this.trees.length === 0) {
      return { fault_type: 'normal', confidence: 0.95, probabilities: { normal: 1.0 } };
    }

    const classVotes = {};
    for (const c of this.classes) classVotes[c] = 0;

    for (const tree of this.trees) {
      const probs = this.predictTree(tree, sample);
      for (const c of this.classes) {
        classVotes[c] += (probs[c] || 0);
      }
    }

    let bestClass = 'normal';
    let maxVotes = -1;
    const totalVotes = this.trees.length;
    const finalProbabilities = {};

    for (const c of this.classes) {
      const prob = classVotes[c] / totalVotes;
      finalProbabilities[c] = Number(prob.toFixed(3));
      if (prob > maxVotes) {
        maxVotes = prob;
        bestClass = c;
      }
    }

    return {
      fault_type: bestClass,
      confidence: Number(maxVotes.toFixed(2)),
      probabilities: finalProbabilities
    };
  }
}
