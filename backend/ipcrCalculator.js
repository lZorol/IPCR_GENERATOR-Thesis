/**
 * IPCR Calculation Service
 * Handles all rating computations before saving to database
 */

const DEFAULT_TARGETS = {
  syllabus: 5,
  courseGuide: 5,
  slm: 5,
  tos: 5,
  gradingSheet: 5
};

const WEIGHTS = {
  syllabus: 0.5,
  courseGuide: 0.5,
  slm: 0.5,
  tos: 0.5,
  gradingSheet: 0.5
};

/**
 * Convert accomplished vs target → IPCR score (1–5)
 */
function autoRate(accomplished, target) {

  if (!target || target === 0) return 0;

  const ratio = accomplished / target;

  if (ratio >= 1.0) return 5;
  if (ratio >= 0.8) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.4) return 2;

  return 1;
}

/**
 * Calculate row rating
 * (Average of Q, E, T)
 */
function calculateRowRating(Q, E, T) {
  return Number(((Q + E + T) / 3).toFixed(2));
}

/**
 * Compute one category result
 * @param {string} category - Key: syllabus, courseGuide, slm, tos, gradingSheet (or DB name for backwards compat)
 * @param {number} accomplished
 * @param {number} [targetOverride] - If provided, use this instead of DEFAULT_TARGETS for rating
 */
function computeCategory(category, accomplished, targetOverride) {

  const target = targetOverride !== undefined && targetOverride !== null
    ? Number(targetOverride)
    : (DEFAULT_TARGETS[category] || 0);

  const score = autoRate(accomplished, target);

  const Q = score;
  const E = score;
  const T = score;

  const rating = calculateRowRating(Q, E, T);

  return {
    category,
    target,
    accomplished,
    Q,
    E,
    T,
    rating,
    weight: WEIGHTS[category] || 0
  };
}

/**
 * Calculate overall IPCR rating
 */
function calculateOverallRating(rows) {

  const total = rows.reduce((sum, r) => {
    return sum + (r.rating * r.weight);
  }, 0);

  return Number(total.toFixed(2));
}

module.exports = {
  computeCategory,
  calculateOverallRating
};