// test-card.js
require('dotenv').config();
const { generateCodeCardImage } = require('./src/generators/cardImageGen');

async function test() {
  const sampleCode = `vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> seen;
    for (int i = 0; i < nums.size(); ++i) {
        int complement = target - nums[i];
        if (seen.count(complement)) {
            return {seen[complement], i};
        }
        seen[nums[i]] = i;
    }
    return {};
}`;

  console.log('Generating image...');
  const url = await generateCodeCardImage(sampleCode, 'Two Sum - Optimal C++');
  console.log('\nFinal Hosted Image Link:\n', url);
}

test();