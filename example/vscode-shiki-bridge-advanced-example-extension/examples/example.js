/**
 * @param {number} delay
 */
async function wait(delay) {
  return Promise(resolve => setTimeout(resolve, delay));
}
